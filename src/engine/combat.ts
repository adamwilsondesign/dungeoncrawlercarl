/**
 * Turn-based combat: a separate encounter scene pushed onto the game stack.
 * Party right, enemies left, over a mood-tinted backdrop. Menu-driven turns
 * (ATTACK / SKILL / ITEM / DEFEND / FLEE), initiative by spd, data-driven
 * skills/statuses/gear, boss phase tables, XP/level rewards. Reads and
 * writes the shared GameState (inventory, gold, xp, level, equipment).
 *
 * Formulas (the combat authoring contract):
 * - Effective party stats = base + (level-1) x (+1 core stats, +6 maxHp,
 *   +3 maxMp) + equipped statMods. Enemies use their def stats as-is.
 * - attackBase = str + weapon attack (2 bare-handed) + attack statuses.
 * - defense = floor(con/2) + armor defense + defense statuses.
 * - ATTACK: hit = clamp(0.85 + 0.03*(att.dex - tgt.dex), 0.6, 0.98);
 *   damage = attackBase * rand(0.85..1.15) - defense, min 1.
 * - SKILL (always hits): (power + scaling stat) * rand(0.9..1.1) - defense.
 *   Ally-target skills with power heal power + floor(int/2) instead.
 * - ITEM: power * rand(0.9..1.1) - floor(defense/2) (explosives half-pierce).
 * - Defending halves final damage (min 1); boss phase multipliers apply to
 *   all damage enemies take, before the defend halving.
 * - Initiative: spd + rand(0..3), recomputed each round, descending.
 * - Flee: clamp(0.45 + 0.06*(avg party spd - avg enemy spd), 0.2, 0.9).
 * - Status ticks: DOTs damage at the afflicted's TURN START; stun/fear are
 *   checked at turn start (after DOTs); durations decrement at the
 *   afflicted's TURN END; cooldowns also decrement at turn end.
 *
 * Every log line is mirrored to console.info('[combat] ...') for tooling.
 */

import type {
  CombatantDef,
  CombatantStats,
  CombatUseDef,
  EncounterDef,
  ItemDef,
  Point,
  SkillDef,
  StatusEffect,
} from '../data/types';
import { drawPixelText, loadImage, outlinedPanel, pixelTextWidth, type LoadedImage } from './assets';
import type { Game, Scene } from './game';
import { drawMenuCursor } from './menus';
import { wrapText } from './narrator';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import { checkFlagCondition, type GameState } from './state';

export type CombatResult = 'victory' | 'defeat' | 'fled';

export interface CombatDeps {
  game: Game;
  state: GameState;
  items: Record<string, ItemDef>;
  skills: Record<string, SkillDef>;
  combatants: Record<string, CombatantDef>;
}

interface ActiveStatus {
  effect: StatusEffect;
  remaining: number;
}

interface Combatant {
  key: string;
  defId: string;
  name: string;
  color: string;
  side: 'party' | 'enemy';
  stats: CombatantStats;
  skills: string[];
  statuses: ActiveStatus[];
  cooldowns: Record<string, number>;
  defending: boolean;
  image: LoadedImage;
  x: number; // feet center
  y: number;
  ai: CombatantDef['ai'];
  xpReward: number;
  bossSkillPtr: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

type Mode =
  | { kind: 'intro'; t: number }
  | { kind: 'menu' }
  | { kind: 'submenu'; menu: 'skills' | 'items'; index: number }
  | { kind: 'target'; candidates: Combatant[]; index: number; confirm: (target: Combatant) => void }
  | { kind: 'enemyThink'; t: number }
  | { kind: 'pause'; t: number; ttl: number; next: () => void }
  | { kind: 'victory'; lines: string[] }
  | { kind: 'ending'; t: number; result: CombatResult };

const ROOT_ACTIONS = ['ATTACK', 'SKILL', 'ITEM', 'DEFEND', 'FLEE'] as const;
const SPRITE_W = 24;
const SPRITE_H = 32;
const DRAW_W = 36;
const DRAW_H = 48;
const MENU_PANEL = { x: 4, y: 132, w: 112, h: 64 };
const INFO_PANEL = { x: 120, y: 132, w: 196, h: 64 };
const BARE_WEAPON = 2;

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Party growth per level above 1 (documented in the header). */
function leveledStats(base: CombatantStats, level: number): CombatantStats {
  const up = level - 1;
  return {
    maxHp: base.maxHp + 6 * up,
    hp: base.maxHp + 6 * up,
    str: base.str + up,
    dex: base.dex + up,
    con: base.con + up,
    int: base.int + up,
    spd: base.spd + up,
    maxMp: base.maxMp !== undefined ? base.maxMp + 3 * up : undefined,
    mp: base.maxMp !== undefined ? base.maxMp + 3 * up : undefined,
  };
}

/** Known skills for a party member at a level (base list + learnset). */
export function knownSkills(def: CombatantDef, level: number): string[] {
  const list = [...def.skills];
  for (const [lvl, ids] of Object.entries(def.learnset ?? {})) {
    if (Number(lvl) <= level) list.push(...ids);
  }
  return list;
}

export class CombatScene implements Scene {
  onFinish: ((result: CombatResult) => void) | null = null;

  private mode: Mode = { kind: 'intro', t: 0 };
  private round = 0;
  private order: Combatant[] = [];
  private turnIndex = -1;
  private rootIndex = 0;
  private readonly floats: FloatText[] = [];
  private logLine = '';
  private logAge = 0;
  private animMs = 0;
  private lastPhaseIndex = -2;
  private lastMouse: Point = { x: -1, y: -1 };
  private finished = false;

  private constructor(
    private readonly deps: CombatDeps,
    private readonly encounter: EncounterDef,
    private readonly backdrop: LoadedImage,
    private readonly party: Combatant[],
    private readonly enemies: Combatant[],
  ) {}

  static async create(deps: CombatDeps, encounter: EncounterDef): Promise<CombatScene> {
    const backdrop = await loadImage(encounter.backdrop, {
      kind: 'background',
      label: encounter.backdropLabel ?? 'COMBAT',
      mood: encounter.backdropMood ?? 'boss',
    });

    const { state, combatants } = deps;
    const partyIds = (encounter.partyOverride ?? state.party).slice(0, 4);

    const buildOne = async (
      defId: string,
      side: 'party' | 'enemy',
      index: number,
      name: string,
    ): Promise<Combatant> => {
      const def = combatants[defId];
      if (!def) throw new Error(`Unknown combatant "${defId}"`);
      const image = await loadImage(def.sprite, {
        kind: 'actor',
        label: def.name,
        color: def.color,
        frameW: SPRITE_W,
        frameH: SPRITE_H,
      });
      let stats: CombatantStats;
      let skillIds: string[];
      if (side === 'party') {
        stats = leveledStats(def.stats, state.level);
        // Learnset skills by level, plus story-unlocked extras (P7 gap).
        skillIds = [...knownSkills(def, state.level), ...(state.extraSkills[defId] ?? [])];
        // Equipment stat mods
        for (const itemId of Object.values(state.getEquipped(defId))) {
          const mods = deps.items[itemId]?.equip?.statMods;
          if (!mods) continue;
          const entries = Object.entries(mods) as Array<
            ['str' | 'dex' | 'con' | 'int' | 'spd' | 'maxHp' | 'maxMp', number]
          >;
          for (const [stat, delta] of entries) {
            if (stat === 'maxHp') {
              stats.maxHp += delta;
              stats.hp += delta;
            } else if (stat === 'maxMp') {
              stats.maxMp = (stats.maxMp ?? 0) + delta;
              stats.mp = (stats.mp ?? 0) + delta;
            } else {
              stats[stat] += delta;
            }
          }
        }
      } else {
        stats = { ...def.stats, hp: def.stats.maxHp, mp: def.stats.maxMp };
        skillIds = [...def.skills];
      }
      const col = index % 2;
      return {
        key: `${side}:${index}`,
        defId,
        name,
        color: def.color,
        side,
        stats,
        skills: skillIds,
        statuses: [],
        cooldowns: {},
        defending: false,
        image,
        x: side === 'enemy' ? 60 + col * 28 : 260 - col * 28,
        y: 76 + index * 22,
        ai: def.ai ?? 'basic',
        xpReward: def.xpReward ?? 0,
        bossSkillPtr: 0,
      };
    };

    // Stable A/B/C labels for duplicate enemies
    const counts: Record<string, number> = {};
    for (const id of encounter.enemies) counts[id] = (counts[id] ?? 0) + 1;
    const seen: Record<string, number> = {};
    const enemies = await Promise.all(
      encounter.enemies.map((id, i) => {
        const def = combatants[id];
        const nth = (seen[id] = (seen[id] ?? 0) + 1);
        const name =
          (def?.name ?? id.toUpperCase()) +
          ((counts[id] ?? 0) > 1 ? ` ${'ABCD'[nth - 1] ?? nth}` : '');
        return buildOne(id, 'enemy', i, name);
      }),
    );
    const party = await Promise.all(
      partyIds.map((id, i) => buildOne(id, 'party', i, combatants[id]?.name ?? id.toUpperCase())),
    );

    const scene = new CombatScene(deps, encounter, backdrop, party, enemies);
    scene.pushLog(encounter.introText ?? 'AN ENCOUNTER BEGINS.');
    return scene;
  }

  // --- Helpers -------------------------------------------------------------

  private get all(): Combatant[] {
    return [...this.enemies, ...this.party];
  }

  private alive(c: Combatant): boolean {
    return c.stats.hp > 0;
  }

  private aliveOn(side: 'party' | 'enemy'): Combatant[] {
    return this.all.filter((c) => c.side === side && this.alive(c));
  }

  private get current(): Combatant | null {
    return this.order[this.turnIndex] ?? null;
  }

  private pushLog(text: string): void {
    this.logLine = text;
    this.logAge = 0;
    console.info(`[combat] ${text}`);
  }

  private pushFloat(c: Combatant, text: string, color: string): void {
    this.floats.push({ x: c.x, y: c.y - DRAW_H - 8, text, color, age: 0 });
  }

  private statusSum(c: Combatant, stat: 'attack' | 'defense'): number {
    let sum = 0;
    for (const s of c.statuses) {
      if (s.effect.stat !== stat) continue;
      sum += s.effect.kind === 'debuff' ? -s.effect.magnitude : s.effect.magnitude;
    }
    return sum;
  }

  private weaponAttack(c: Combatant): number {
    if (c.side !== 'party') return BARE_WEAPON;
    const weaponId = this.deps.state.getEquipped(c.defId).weapon;
    return this.deps.items[weaponId ?? '']?.equip?.attack ?? BARE_WEAPON;
  }

  private armorDefense(c: Combatant): number {
    if (c.side !== 'party') return 0;
    const armorId = this.deps.state.getEquipped(c.defId).armor;
    return this.deps.items[armorId ?? '']?.equip?.defense ?? 0;
  }

  private attackBase(c: Combatant): number {
    return c.stats.str + this.weaponAttack(c) + this.statusSum(c, 'attack');
  }

  private defenseOf(c: Combatant): number {
    return Math.floor(c.stats.con / 2) + this.armorDefense(c) + this.statusSum(c, 'defense');
  }

  private activePhaseIndex(): number {
    const phases = this.encounter.phases;
    if (!phases) return -1;
    for (let i = 0; i < phases.length; i++) {
      const when = phases[i].when;
      if (!when || checkFlagCondition(this.deps.state, when)) return i;
    }
    return -1;
  }

  private phaseMult(): number {
    const i = this.activePhaseIndex();
    if (i < 0) return 1;
    return this.encounter.phases?.[i]?.enemyDamageTakenMult ?? 1;
  }

  private checkPhaseAnnounce(): void {
    const i = this.activePhaseIndex();
    if (i === this.lastPhaseIndex) return;
    this.lastPhaseIndex = i;
    const announce = i >= 0 ? this.encounter.phases?.[i]?.announce : undefined;
    if (announce) this.pushLog(announce);
  }

  /** Apply damage with phase multiplier + defend halving; returns dealt. */
  private applyDamage(target: Combatant, raw: number): number {
    let dmg = raw;
    if (target.side === 'enemy') dmg = Math.round(dmg * this.phaseMult());
    if (target.defending) dmg = Math.floor(dmg / 2);
    dmg = Math.max(1, dmg);
    target.stats.hp = Math.max(0, target.stats.hp - dmg);
    this.pushFloat(target, String(dmg), target.side === 'party' ? '#ff9b9b' : '#ffe9a8');
    if (!this.alive(target)) {
      this.pushLog(`${target.name} IS DOWN.`);
    }
    return dmg;
  }

  private applyStatus(target: Combatant, effect: StatusEffect): void {
    const existing = target.statuses.find((s) => s.effect.id === effect.id);
    if (existing) existing.remaining = Math.max(existing.remaining, effect.duration);
    else target.statuses.push({ effect, remaining: effect.duration });
    this.pushFloat(target, effect.name, '#c9a0ff');
  }

  // --- Turn engine ---------------------------------------------------------

  private startRound(): void {
    this.round++;
    const roster = this.all.filter((c) => this.alive(c));
    this.order = roster
      .map((c) => ({ c, init: c.stats.spd + rand(0, 3) }))
      .sort((a, b) => b.init - a.init)
      .map((e) => e.c);
    this.turnIndex = -1;
    console.info(
      `[combat] round ${this.round} order: ${this.order.map((c) => c.name).join(', ')}`,
    );
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.finished || this.mode.kind === 'victory' || this.mode.kind === 'ending') return;
    if (this.aliveOn('enemy').length === 0) {
      this.doVictory();
      return;
    }
    if (this.aliveOn('party').length === 0) {
      this.doDefeat();
      return;
    }
    this.turnIndex++;
    if (this.turnIndex >= this.order.length) {
      this.startRound();
      return;
    }
    const c = this.current;
    if (!c || !this.alive(c)) {
      this.advanceTurn();
      return;
    }
    this.beginTurn(c);
  }

  private beginTurn(c: Combatant): void {
    const hookText = this.encounter.beforeTurn?.({
      state: this.deps.state,
      round: this.round,
      turnIndex: this.turnIndex,
    });
    if (hookText) this.pushLog(hookText);
    this.checkPhaseAnnounce();

    c.defending = false;

    // DOTs tick at turn start
    for (const s of c.statuses) {
      const kind = s.effect.kind;
      if (kind === 'burn' || kind === 'bleed' || kind === 'dot') {
        const dmg = s.effect.magnitude;
        c.stats.hp = Math.max(0, c.stats.hp - dmg);
        this.pushFloat(c, `${dmg} ${s.effect.name}`, '#ff9b5e');
        this.pushLog(`${c.name} TAKES ${dmg} FROM ${s.effect.name}.`);
      }
    }
    if (!this.alive(c)) {
      this.pushLog(`${c.name} SUCCUMBS.`);
      this.endOfTurn(c);
      this.mode = { kind: 'pause', t: 0, ttl: 500, next: () => this.advanceTurn() };
      return;
    }

    // Stun / fear checks (after DOTs)
    if (c.statuses.some((s) => s.effect.kind === 'stun')) {
      this.pushLog(`${c.name} IS STUNNED AND LOSES THE TURN.`);
      this.endOfTurn(c);
      this.mode = { kind: 'pause', t: 0, ttl: 700, next: () => this.advanceTurn() };
      return;
    }
    if (c.statuses.some((s) => s.effect.kind === 'fear') && Math.random() < 0.5) {
      this.pushLog(`${c.name} COWERS IN FEAR.`);
      this.endOfTurn(c);
      this.mode = { kind: 'pause', t: 0, ttl: 700, next: () => this.advanceTurn() };
      return;
    }

    if (c.side === 'party') {
      this.rootIndex = 0;
      this.mode = { kind: 'menu' };
      console.info(`[combat] awaiting command: ${c.name}`);
    } else {
      this.mode = { kind: 'enemyThink', t: 0 };
    }
  }

  /** Durations and cooldowns decrement at the owner's turn end. */
  private endOfTurn(c: Combatant): void {
    for (let i = c.statuses.length - 1; i >= 0; i--) {
      const s = c.statuses[i];
      s.remaining--;
      if (s.remaining <= 0) {
        this.pushLog(`${c.name}: ${s.effect.name} WEARS OFF.`);
        c.statuses.splice(i, 1);
      }
    }
    for (const id of Object.keys(c.cooldowns)) {
      if (c.cooldowns[id] > 0) c.cooldowns[id]--;
    }
  }

  private afterAction(c: Combatant): void {
    this.endOfTurn(c);
    this.mode = { kind: 'pause', t: 0, ttl: 650, next: () => this.advanceTurn() };
  }

  // --- Actions ---------------------------------------------------------------

  private doAttack(attacker: Combatant, target: Combatant): void {
    const hitChance = clamp(0.85 + 0.03 * (attacker.stats.dex - target.stats.dex), 0.6, 0.98);
    if (Math.random() > hitChance) {
      this.pushFloat(target, 'MISS', '#8fa3c4');
      this.pushLog(`${attacker.name} ATTACKS ${target.name}: MISS.`);
      this.afterAction(attacker);
      return;
    }
    const raw = Math.max(
      0,
      Math.round(this.attackBase(attacker) * rand(0.85, 1.15)) - this.defenseOf(target),
    );
    const dealt = this.applyDamage(target, raw);
    this.pushLog(`${attacker.name} ATTACKS ${target.name}: ${dealt} DMG.`);
    this.afterAction(attacker);
  }

  private canUseSkill(c: Combatant, skill: SkillDef): boolean {
    if (skill.mpCost !== undefined && (c.stats.mp ?? 0) < skill.mpCost) return false;
    if ((c.cooldowns[skill.id] ?? 0) > 0) return false;
    return true;
  }

  private doSkill(user: Combatant, skill: SkillDef, targets: Combatant[]): void {
    if (skill.mpCost !== undefined) user.stats.mp = (user.stats.mp ?? 0) - skill.mpCost;
    if (skill.cooldown !== undefined) user.cooldowns[skill.id] = skill.cooldown + 1;

    const friendly = skill.target === 'ally' || skill.target === 'self' || skill.target === 'allAllies';
    const parts: string[] = [];
    for (const target of targets) {
      if (!this.alive(target)) continue;
      if (skill.power !== undefined) {
        if (friendly) {
          const healed = skill.power + Math.floor(user.stats.int / 2);
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healed);
          this.pushFloat(target, `+${healed}`, '#a8e6a0');
          parts.push(`${target.name} +${healed} HP`);
        } else {
          // Attack buffs/debuffs apply to skill damage too (so taunts matter vs bosses).
          const scale = skill.scaling === 'str' ? user.stats.str : user.stats.int;
          const base = skill.power + scale + this.statusSum(user, 'attack');
          const raw = Math.max(
            0,
            Math.round(base * rand(0.9, 1.1)) - this.defenseOf(target),
          );
          const dealt = this.applyDamage(target, raw);
          parts.push(`${target.name} ${dealt} DMG`);
        }
      }
      if (skill.effect && this.alive(target)) {
        this.applyStatus(target, skill.effect);
        parts.push(`${target.name} ${skill.effect.name}`);
      }
    }
    this.pushLog(`${user.name} USES ${skill.name}: ${parts.join(', ') || 'NO EFFECT'}.`);
    this.afterAction(user);
  }

  private doItem(user: Combatant, item: ItemDef, use: CombatUseDef, targets: Combatant[]): void {
    this.deps.state.removeItem(item.id); // consumed from the SHARED inventory
    const parts: string[] = [];
    for (const target of targets) {
      if (!this.alive(target)) continue;
      if (use.power !== undefined) {
        if (use.heal) {
          const healed = use.power;
          target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healed);
          this.pushFloat(target, `+${healed}`, '#a8e6a0');
          parts.push(`${target.name} +${healed} HP`);
        } else {
          const raw = Math.max(
            0,
            Math.round(use.power * rand(0.9, 1.1)) - Math.floor(this.defenseOf(target) / 2),
          );
          const dealt = this.applyDamage(target, raw);
          parts.push(`${target.name} ${dealt} DMG`);
        }
      }
      if (use.effect && this.alive(target)) {
        this.applyStatus(target, use.effect);
        parts.push(`${target.name} ${use.effect.name}`);
      }
    }
    this.pushLog(`${user.name} USES ${item.name}: ${parts.join(', ') || 'NO EFFECT'}.`);
    this.afterAction(user);
  }

  private doDefend(c: Combatant): void {
    // endOfTurn runs first so the flag survives until this combatant's next turn start.
    this.pushLog(`${c.name} DEFENDS. INCOMING DAMAGE HALVED.`);
    this.endOfTurn(c);
    c.defending = true;
    this.mode = { kind: 'pause', t: 0, ttl: 450, next: () => this.advanceTurn() };
  }

  private doFlee(c: Combatant): void {
    if (this.encounter.noFlee) {
      this.pushLog('ESCAPE IS NOT ON THE MENU FOR THIS ONE.');
      return; // mercy: does not consume the turn
    }
    const avg = (list: Combatant[]): number =>
      list.reduce((n, x) => n + x.stats.spd, 0) / Math.max(1, list.length);
    const chance = clamp(0.45 + 0.06 * (avg(this.aliveOn('party')) - avg(this.aliveOn('enemy'))), 0.2, 0.9);
    if (Math.random() < chance) {
      this.pushLog('THE PARTY ESCAPES. DIGNITY OPTIONAL.');
      this.mode = { kind: 'ending', t: 0, result: 'fled' };
      return;
    }
    this.pushLog(`${c.name} FAILS TO ESCAPE.`);
    this.afterAction(c);
  }

  // --- Targeting helpers ------------------------------------------------------

  private targetsFor(user: Combatant, spec: SkillDef['target']): Combatant[] {
    const foes = this.aliveOn(user.side === 'party' ? 'enemy' : 'party');
    const friends = this.aliveOn(user.side);
    switch (spec) {
      case 'enemy':
      case 'allEnemies':
        return foes;
      case 'ally':
      case 'allAllies':
        return friends;
      case 'self':
        return [user];
    }
  }

  private pickTargetThen(candidates: Combatant[], confirm: (t: Combatant) => void): void {
    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      confirm(candidates[0]);
      return;
    }
    this.mode = { kind: 'target', candidates, index: 0, confirm };
  }

  // --- Enemy AI ----------------------------------------------------------------

  private runEnemyAi(c: Combatant): void {
    const usable = c.skills
      .map((id) => this.deps.skills[id])
      .filter((s): s is SkillDef => Boolean(s) && this.canUseSkill(c, s));
    const partyTargets = this.aliveOn('party');
    const pickTarget = (): Combatant =>
      partyTargets[Math.floor(Math.random() * partyTargets.length)];

    let skill: SkillDef | undefined;
    if ((c.ai === 'boss' || c.ai === 'caster') && usable.length > 0) {
      // Deterministic: always the first ready skill (cooldowns stagger them).
      skill = usable[0];
    } else if (usable.length > 0 && Math.random() < 0.5) {
      skill = usable[Math.floor(Math.random() * usable.length)];
    }

    if (skill) {
      const targets =
        skill.target === 'enemy'
          ? [pickTarget()]
          : this.targetsFor(c, skill.target);
      this.doSkill(c, skill, targets);
      return;
    }
    this.doAttack(c, pickTarget());
  }

  // --- Victory / defeat -----------------------------------------------------

  private doVictory(): void {
    const { state, combatants, items } = this.deps;
    const rewards = this.encounter.rewards;
    const xpGain =
      rewards?.xp ?? this.enemies.reduce((n, e) => n + e.xpReward, 0);
    const lines: string[] = ['VICTORY!', ''];
    if (xpGain > 0) lines.push(`+${xpGain} XP`);
    if (rewards?.gold) {
      state.gold += rewards.gold;
      lines.push(`+${rewards.gold} GOLD`);
    }
    for (const itemId of rewards?.items ?? []) {
      const def = items[itemId];
      state.addItem(itemId, def?.stackable === true);
      lines.push(`FOUND: ${def?.name ?? itemId.toUpperCase()}`);
    }

    const before = state.level;
    const beforeSkills = new Set(
      this.party.flatMap((m) => knownSkills(combatants[m.defId], before)),
    );
    const gained = state.addXp(xpGain);
    if (gained > 0) {
      lines.push('', `LEVEL UP! PARTY REACHES LEVEL ${state.level}`);
      lines.push('+1 ALL STATS, +6 HP, +3 MP');
      for (const m of this.party) {
        for (const id of knownSkills(combatants[m.defId], state.level)) {
          if (!beforeSkills.has(id)) {
            lines.push(`${m.name} LEARNS ${this.deps.skills[id]?.name ?? id.toUpperCase()}`);
          }
        }
      }
    }
    console.info(`[combat] victory (+${xpGain} xp, level ${state.level})`);
    this.mode = { kind: 'victory', lines };
  }

  private doDefeat(): void {
    this.pushLog('THE PARTY FALLS.');
    console.info('[combat] defeat');
    this.mode = { kind: 'ending', t: 0, result: 'defeat' };
  }

  private finish(result: CombatResult): void {
    if (this.finished) return;
    this.finished = true;
    this.deps.game.popScene();
    this.onFinish?.(result);
  }

  // --- Update ----------------------------------------------------------------

  update(dtMs: number): void {
    this.animMs += dtMs;
    this.logAge += dtMs;
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dtMs;
      f.y -= dtMs * 0.02;
      if (f.age > 900) this.floats.splice(i, 1);
    }

    const input = this.deps.game.input;
    const mode = this.mode;

    switch (mode.kind) {
      case 'intro': {
        mode.t += dtMs;
        if (mode.t > 1400 || input.consumeClick() || input.consumePress('Enter') || input.consumePress('Space')) {
          this.startRound();
        }
        break;
      }
      case 'pause': {
        mode.t += dtMs;
        input.clearClicks();
        if (mode.t >= mode.ttl) mode.next();
        break;
      }
      case 'enemyThink': {
        mode.t += dtMs;
        input.clearClicks();
        if (mode.t >= 500) {
          const c = this.current;
          if (c) this.runEnemyAi(c);
        }
        break;
      }
      case 'menu':
        this.updateRootMenu();
        break;
      case 'submenu':
        this.updateSubmenu(mode);
        break;
      case 'target':
        this.updateTargeting(mode);
        break;
      case 'victory': {
        if (input.consumeClick() || input.consumePress('Enter') || input.consumePress('Space')) {
          this.finish('victory');
        }
        break;
      }
      case 'ending': {
        mode.t += dtMs;
        input.clearClicks();
        if (mode.t >= 1100) this.finish(mode.result);
        break;
      }
    }
    input.clearRightClicks();
  }

  private menuRowRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: MENU_PANEL.x + 3, y: MENU_PANEL.y + 14 + i * 10, w: MENU_PANEL.w - 6, h: 10 };
  }

  private hoverRow(p: Point, count: number): number | null {
    for (let i = 0; i < count; i++) {
      const r = this.menuRowRect(i);
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return i;
    }
    return null;
  }

  private mouseMoved(): boolean {
    const m = this.deps.game.input.mouse;
    const moved = m.x !== this.lastMouse.x || m.y !== this.lastMouse.y;
    this.lastMouse = { x: m.x, y: m.y };
    return moved;
  }

  private updateRootMenu(): void {
    const input = this.deps.game.input;
    const c = this.current;
    if (!c) return;
    if (input.consumePress('ArrowUp')) this.rootIndex = (this.rootIndex + 4) % 5;
    if (input.consumePress('ArrowDown')) this.rootIndex = (this.rootIndex + 1) % 5;
    if (this.mouseMoved()) {
      const row = this.hoverRow(input.mouse, 5);
      if (row !== null) this.rootIndex = row;
    }
    const click = input.consumeClick();
    let confirmed = input.consumePress('Enter') || input.consumePress('Space');
    if (click) {
      const row = this.hoverRow(click, 5);
      if (row !== null) {
        this.rootIndex = row;
        confirmed = true;
      }
    }
    if (!confirmed) return;

    switch (ROOT_ACTIONS[this.rootIndex]) {
      case 'ATTACK':
        this.pickTargetThen(this.aliveOn('enemy'), (t) => this.doAttack(c, t));
        break;
      case 'SKILL':
        this.mode = { kind: 'submenu', menu: 'skills', index: 0 };
        break;
      case 'ITEM':
        this.mode = { kind: 'submenu', menu: 'items', index: 0 };
        break;
      case 'DEFEND':
        this.doDefend(c);
        break;
      case 'FLEE':
        this.doFlee(c);
        break;
    }
  }

  private skillEntries(c: Combatant): SkillDef[] {
    return c.skills
      .map((id) => this.deps.skills[id])
      .filter((s): s is SkillDef => Boolean(s));
  }

  private itemEntries(): Array<{ def: ItemDef; use: CombatUseDef; count: number }> {
    const out: Array<{ def: ItemDef; use: CombatUseDef; count: number }> = [];
    for (const entry of this.deps.state.inventory) {
      const def = this.deps.items[entry.id];
      if (def?.use) out.push({ def, use: def.use, count: entry.count });
    }
    return out;
  }

  private updateSubmenu(mode: Extract<Mode, { kind: 'submenu' }>): void {
    const input = this.deps.game.input;
    const c = this.current;
    if (!c) return;
    const count = mode.menu === 'skills' ? this.skillEntries(c).length : this.itemEntries().length;

    if (input.consumePress('Escape')) {
      this.mode = { kind: 'menu' };
      return;
    }
    if (count === 0) {
      if (input.consumeClick() || input.consumePress('Enter')) this.mode = { kind: 'menu' };
      return;
    }
    if (input.consumePress('ArrowUp')) mode.index = (mode.index + count - 1) % count;
    if (input.consumePress('ArrowDown')) mode.index = (mode.index + 1) % count;
    if (this.mouseMoved()) {
      const row = this.hoverRow(input.mouse, count);
      if (row !== null) mode.index = row;
    }
    const click = input.consumeClick();
    let confirmed = input.consumePress('Enter') || input.consumePress('Space');
    if (click) {
      const row = this.hoverRow(click, count);
      if (row !== null) {
        mode.index = row;
        confirmed = true;
      } else {
        this.mode = { kind: 'menu' }; // click outside: back
        return;
      }
    }
    if (!confirmed) return;

    if (mode.menu === 'skills') {
      const skill = this.skillEntries(c)[mode.index];
      if (!skill || !this.canUseSkill(c, skill)) {
        this.pushLog(skill ? 'NOT READY (MP OR COOLDOWN).' : 'NO SKILL THERE.');
        return;
      }
      if (skill.target === 'enemy' || skill.target === 'ally') {
        this.pickTargetThen(this.targetsFor(c, skill.target), (t) => this.doSkill(c, skill, [t]));
      } else {
        this.doSkill(c, skill, this.targetsFor(c, skill.target));
      }
    } else {
      const entry = this.itemEntries()[mode.index];
      if (!entry) return;
      if (entry.use.target === 'enemy' || entry.use.target === 'ally') {
        this.pickTargetThen(this.targetsFor(c, entry.use.target), (t) =>
          this.doItem(c, entry.def, entry.use, [t]),
        );
      } else {
        this.doItem(c, entry.def, entry.use, this.targetsFor(c, entry.use.target));
      }
    }
  }

  private updateTargeting(mode: Extract<Mode, { kind: 'target' }>): void {
    const input = this.deps.game.input;
    if (input.consumePress('Escape')) {
      this.mode = { kind: 'menu' };
      return;
    }
    const n = mode.candidates.length;
    if (input.consumePress('ArrowUp') || input.consumePress('ArrowLeft')) {
      mode.index = (mode.index + n - 1) % n;
    }
    if (input.consumePress('ArrowDown') || input.consumePress('ArrowRight')) {
      mode.index = (mode.index + 1) % n;
    }
    const click = input.consumeClick();
    if (click) {
      const hit = mode.candidates.findIndex(
        (c) =>
          click.x >= c.x - DRAW_W / 2 &&
          click.x < c.x + DRAW_W / 2 &&
          click.y >= c.y - DRAW_H &&
          click.y < c.y + 12,
      );
      if (hit >= 0) {
        mode.confirm(mode.candidates[hit]);
        return;
      }
    }
    if (input.consumePress('Enter') || input.consumePress('Space')) {
      mode.confirm(mode.candidates[mode.index]);
    }
  }

  // --- Render ----------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.backdrop, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    this.renderTurnStrip(ctx);
    this.renderLog(ctx);
    this.renderCombatants(ctx);
    this.renderPanels(ctx);
    this.renderFloats(ctx);
    if (this.mode.kind === 'victory') this.renderVictory(ctx, this.mode.lines);
    if (this.mode.kind === 'ending') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      const text = this.mode.result === 'defeat' ? 'THE PARTY FALLS.' : 'ESCAPED.';
      drawPixelText(ctx, text, LOGICAL_W / 2, 92, this.mode.result === 'defeat' ? '#ff6e6e' : '#8fa3c4', 2, 'center');
    }
    drawMenuCursor(ctx, this.deps.game.input.mouse);
  }

  private renderCombatants(ctx: CanvasRenderingContext2D): void {
    for (const c of [...this.all].sort((a, b) => a.y - b.y)) {
      const dead = !this.alive(c);
      if (dead && c.side === 'enemy') continue;
      const isCurrent = this.current === c && !dead;
      const bob = isCurrent && Math.floor(this.animMs / 300) % 2 === 0 ? -1 : 0;
      const dx = Math.round(c.x - DRAW_W / 2);
      const dy = Math.round(c.y - DRAW_H + bob);

      ctx.save();
      if (dead) ctx.globalAlpha = 0.3;
      // Frame 6 = idle_right in the canonical 3x3 sheet; party mirrors to face left.
      const sx = (6 % 3) * SPRITE_W;
      const sy = Math.floor(6 / 3) * SPRITE_H;
      if (c.side === 'party') {
        ctx.translate(dx + DRAW_W, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(c.image, sx, sy, SPRITE_W, SPRITE_H, 0, 0, DRAW_W, DRAW_H);
      } else {
        ctx.drawImage(c.image, sx, sy, SPRITE_W, SPRITE_H, dx, dy, DRAW_W, DRAW_H);
      }
      ctx.restore();

      // Name + bars
      drawPixelText(ctx, c.name.slice(0, 12), c.x, c.y - DRAW_H - 7, isCurrent ? '#ffe9a8' : '#d8ecff', 1, 'center');
      const barX = c.x - 17;
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(barX, c.y + 2, 34, 4);
      const hpFrac = c.stats.hp / c.stats.maxHp;
      ctx.fillStyle = hpFrac > 0.5 ? '#7fd4a3' : hpFrac > 0.25 ? '#ffd166' : '#ff6e6e';
      ctx.fillRect(barX + 1, c.y + 3, Math.round(32 * hpFrac), 2);
      if (c.side === 'party' && c.stats.maxMp) {
        ctx.fillStyle = '#101828';
        ctx.fillRect(barX, c.y + 7, 34, 3);
        ctx.fillStyle = '#7fb2e0';
        ctx.fillRect(barX + 1, c.y + 8, Math.round(32 * ((c.stats.mp ?? 0) / c.stats.maxMp)), 1);
      }

      // Status tags
      let tagX = barX;
      const tagY = c.side === 'party' ? c.y + 12 : c.y + 8;
      for (const s of c.statuses.slice(0, 3)) {
        const tag = s.effect.name.slice(0, 3);
        const w = pixelTextWidth(tag) + 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(tagX, tagY, w, 7);
        drawPixelText(ctx, tag, tagX + 2, tagY + 1, s.effect.kind === 'buff' ? '#a8e6a0' : '#ff9b5e');
        tagX += w + 2;
      }
      if (c.defending) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(tagX, tagY, 15, 7);
        drawPixelText(ctx, 'DEF', tagX + 2, tagY + 1, '#7fd4ff');
      }

      // Target selector
      if (this.mode.kind === 'target') {
        const idx = this.mode.candidates.indexOf(c);
        if (idx >= 0 && idx === this.mode.index && Math.floor(this.animMs / 250) % 2 === 0) {
          ctx.fillStyle = '#ff6e6e';
          ctx.fillRect(c.x - 3, c.y - DRAW_H - 15, 7, 2);
          ctx.fillRect(c.x - 2, c.y - DRAW_H - 13, 5, 2);
          ctx.fillRect(c.x - 1, c.y - DRAW_H - 11, 3, 2);
        }
      }
      // Current-turn marker
      if (isCurrent && this.mode.kind !== 'target') {
        ctx.fillStyle = '#3fd9ff';
        ctx.fillRect(c.x - 1, c.y - DRAW_H - 12, 3, 3);
      }
    }
  }

  private renderTurnStrip(ctx: CanvasRenderingContext2D): void {
    if (this.order.length === 0) return;
    let x = 4;
    for (let i = 0; i < this.order.length; i++) {
      const c = this.order[i];
      const label = c.name.slice(0, 7);
      const w = pixelTextWidth(label) + 6;
      const isCurrent = i === this.turnIndex;
      const dead = !this.alive(c);
      ctx.fillStyle = isCurrent ? '#243a52' : 'rgba(10,17,32,0.85)';
      ctx.fillRect(x, 2, w, 11);
      if (isCurrent) {
        ctx.strokeStyle = '#3fd9ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, 2.5, w - 1, 10);
      }
      drawPixelText(ctx, label, x + 3, 5, dead ? '#4a586f' : isCurrent ? '#ffe9a8' : '#8fa3c4');
      x += w + 2;
      if (x > LOGICAL_W - 30) break;
    }
  }

  private renderLog(ctx: CanvasRenderingContext2D): void {
    if (!this.logLine || this.logAge > 3500) return;
    const w = pixelTextWidth(this.logLine.slice(0, 76)) + 8;
    const x = Math.floor((LOGICAL_W - w) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x, 16, w, 9);
    drawPixelText(ctx, this.logLine.slice(0, 76), LOGICAL_W / 2, 18, '#e6eeff', 1, 'center');
  }

  private renderPanels(ctx: CanvasRenderingContext2D): void {
    const c = this.current;
    const inMenu =
      this.mode.kind === 'menu' || this.mode.kind === 'submenu' || this.mode.kind === 'target';
    if (!c || c.side !== 'party' || !inMenu) return;

    outlinedPanel(ctx, MENU_PANEL.x, MENU_PANEL.y, MENU_PANEL.w, MENU_PANEL.h, '#0e1420', '#3fd9ff');
    drawPixelText(ctx, `${c.name} - LV ${this.deps.state.level}`, MENU_PANEL.x + 4, MENU_PANEL.y + 4, '#3fd9ff');

    let rows: Array<{ label: string; dim: boolean }> = [];
    let selected = -1;
    let info = '';

    if (this.mode.kind === 'menu' || this.mode.kind === 'target') {
      rows = ROOT_ACTIONS.map((a) => ({
        label: a,
        dim: a === 'FLEE' && Boolean(this.encounter.noFlee),
      }));
      selected = this.rootIndex;
      info =
        this.mode.kind === 'target'
          ? 'CHOOSE A TARGET. ARROWS + ENTER, OR CLICK. ESC: BACK'
          : 'ARROWS + ENTER, OR CLICK.';
    } else if (this.mode.kind === 'submenu' && this.mode.menu === 'skills') {
      const list = this.skillEntries(c);
      rows = list.map((s) => ({ label: s.name.slice(0, 16), dim: !this.canUseSkill(c, s) }));
      selected = this.mode.index;
      const s = list[this.mode.index];
      if (s) {
        const cd = c.cooldowns[s.id] ?? 0;
        const cost = s.mpCost !== undefined ? `MP ${s.mpCost}` : `CD ${s.cooldown ?? 0}`;
        info = `${s.name} (${cost}${cd > 0 ? `, READY IN ${cd}` : ''}) - ${s.description}`;
      } else info = 'NO SKILLS KNOWN.';
    } else if (this.mode.kind === 'submenu') {
      const list = this.itemEntries();
      rows = list.map((e) => ({ label: `${e.def.name.slice(0, 13)} X${e.count}`, dim: false }));
      selected = this.mode.index;
      const e = list[this.mode.index];
      info = e ? e.def.description : 'NO USABLE ITEMS. THE AUDIENCE WINCES.';
    }

    rows.slice(0, 5).forEach((row, i) => {
      const r = this.menuRowRect(i);
      const isSel = i === selected && this.mode.kind !== 'target';
      if (isSel) {
        ctx.fillStyle = 'rgba(255,233,168,0.12)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        drawPixelText(ctx, '>', r.x + 2, r.y + 2, '#ffe9a8');
      }
      drawPixelText(ctx, row.label, r.x + 9, r.y + 2, row.dim ? '#4a586f' : isSel ? '#ffe9a8' : '#b8c8e0');
    });

    outlinedPanel(ctx, INFO_PANEL.x, INFO_PANEL.y, INFO_PANEL.w, INFO_PANEL.h, '#0e1420', '#39465e');
    const lines = wrapText(info, Math.floor((INFO_PANEL.w - 10) / 4));
    lines.slice(0, 7).forEach((line, i) => {
      drawPixelText(ctx, line, INFO_PANEL.x + 5, INFO_PANEL.y + 5 + i * 8, '#8fa3c4');
    });
  }

  private renderFloats(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floats) {
      const alpha = f.age > 600 ? 1 - (f.age - 600) / 300 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      drawPixelText(ctx, f.text, Math.round(f.x) + 1, Math.round(f.y) + 1, '#000000', 1, 'center');
      drawPixelText(ctx, f.text, Math.round(f.x), Math.round(f.y), f.color, 1, 'center');
      ctx.restore();
    }
  }

  private renderVictory(ctx: CanvasRenderingContext2D, lines: string[]): void {
    const h = 30 + lines.length * 8;
    const w = 200;
    const x = (LOGICAL_W - w) / 2;
    const y = (LOGICAL_H - h) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    outlinedPanel(ctx, x, y, w, h, '#0e1420', '#ffd166');
    lines.forEach((line, i) => {
      const isTitle = i === 0;
      drawPixelText(
        ctx,
        line,
        LOGICAL_W / 2,
        y + 8 + i * 8,
        isTitle ? '#ffd166' : line.startsWith('LEVEL') ? '#a8e6a0' : '#e6eeff',
        isTitle ? 2 : 1,
        'center',
      );
    });
    drawPixelText(ctx, 'CLICK OR ENTER', LOGICAL_W / 2, y + h - 9, '#8fa3c4', 1, 'center');
  }
}
