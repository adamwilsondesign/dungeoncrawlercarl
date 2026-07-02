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
  ArrivalDef,
  CombatantDef,
  CombatantStats,
  CombatUseDef,
  CutsceneDef,
  EncounterDef,
  Facing,
  ItemDef,
  Point,
  SkillDef,
  SpawnPoint,
  SpriteSheetDef,
  StatusEffect,
} from '../data/types';
import { drawPixelText, loadImage, outlinedPanel, pixelTextWidth, type LoadedImage } from './assets';
import { audio } from './audio';
import type { Game, Scene } from './game';
import { drawMenuCursor } from './menus';
import { wrapText } from './narrator';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import { ScriptRunner, type ScriptHost } from './script';
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
  /** Frame size read from the actual sheet (width/3 x height/3) - never assumed. */
  fw: number;
  fh: number;
  drawW: number;
  drawH: number;
  x: number; // feet center (current; animated during arrival)
  y: number;
  tx: number; // composed-tableau slot (feet-anchored on the ground plane)
  ty: number;
  /** Not yet on stage (burstIn pops, staggered entrances). */
  hidden: boolean;
  ai: CombatantDef['ai'];
  xpReward: number;
  bossSkillPtr: number;
}

/** A non-combatant stage prop accompanying an arrival (e.g. the steamroller). */
interface StageProp {
  id: string;
  image: LoadedImage;
  fw: number;
  fh: number;
  drawW: number;
  drawH: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  hidden: boolean;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

type Mode =
  | { kind: 'transition'; t: number }
  | { kind: 'arrival'; t: number }
  | { kind: 'menu' }
  | { kind: 'submenu'; menu: 'skills' | 'items'; index: number }
  | { kind: 'target'; candidates: Combatant[]; index: number; confirm: (target: Combatant) => void }
  | { kind: 'enemyThink'; t: number }
  | { kind: 'pause'; t: number; ttl: number; next: () => void }
  | { kind: 'victory'; lines: string[] }
  | { kind: 'ending'; t: number; result: CombatResult };

const ROOT_ACTIONS = ['ATTACK', 'SKILL', 'ITEM', 'DEFEND', 'FLEE'] as const;
/** Default frame size ONLY for generating never-before-loaded sheets. */
const SPRITE_W = 24;
const SPRITE_H = 32;
/** Sprites draw at 1.5x their native frame size, feet-anchored. */
const DRAW_SCALE = 1.5;
/**
 * Layout: LEFT sidebar action menu (~25% of the width); the right ~75% is
 * the combat tableau. Party stands stage-left facing right; enemies enter
 * and hold stage-right facing left. All feet baselines sit on the painted
 * ground plane (edge at GROUND_EDGE, slots from SLOT_Y down).
 */
const SIDEBAR = { x: 2, y: 16, w: 78, h: 182 };
const FIELD_X = SIDEBAR.x + SIDEBAR.w + 4; // 84: tableau left edge
const FIELD_CX = Math.round((FIELD_X + LOGICAL_W) / 2); // 202: tableau center
const GROUND_EDGE = 132; // painted floor line y
const SLOT_Y = 146; // first feet baseline (rows step +17, front column +6)
const slotPos = (side: 'party' | 'enemy', index: number): { x: number; y: number } => {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: side === 'party' ? 148 - col * 36 : 246 + col * 34,
    y: SLOT_Y + row * 17 + col * 6,
  };
};
/** Transition timing (ms): mob = snappy, boss = cinematic w/ title card. */
const WIPE_MOB = 300;
const WIPE_BOSS = 620;
const TITLE_BOSS = 1000;
const ARRIVAL_DEFAULT_MS: Record<ArrivalDef['kind'], number> = {
  walkIn: 750,
  dropIn: 750,
  burstIn: 950,
  rollIn: 1300,
  scriptedActions: 0,
};
const LINE_HOLD_MS = 1700;
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

/** One queued arrival line: shown as the log banner, then resolved. */
interface ArrivalLine {
  text: string;
  resolve: () => void;
}

export class CombatScene implements Scene {
  onFinish: ((result: CombatResult) => void) | null = null;

  private mode: Mode = { kind: 'transition', t: 0 };
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

  // Arrival choreography state
  private readonly arrival: Required<Pick<ArrivalDef, 'kind' | 'from' | 'ms'>> & {
    lines: string[];
    actions: ArrivalDef['actions'];
  };
  private props: StageProp[] = [];
  private arrivalMoveDone = false;
  private arrivalLinesQueued = false;
  private arrivalScriptDone = true;
  private lineQueue: ArrivalLine[] = [];
  private lineT = 0;
  private arrivalRunner: ScriptRunner | null = null;
  private readonly arrivalTimers: Array<{ remaining: number; resolve: () => void }> = [];
  // Scene-local shake (drop landings, bursts, boss title)
  private shakeFx: { t: number; ms: number; amp: number } | null = null;

  private constructor(
    private readonly deps: CombatDeps,
    private readonly encounter: EncounterDef,
    private readonly backdrop: LoadedImage,
    private readonly party: Combatant[],
    private readonly enemies: Combatant[],
    props: StageProp[],
  ) {
    const a = encounter.arrival;
    this.arrival = {
      kind: a?.kind ?? 'walkIn',
      from: a?.from ?? (a?.kind === 'dropIn' ? 'above' : a?.kind === 'rollIn' && a?.props?.length ? 'left' : 'right'),
      ms: a?.ms ?? ARRIVAL_DEFAULT_MS[a?.kind ?? 'walkIn'],
      lines: a?.lines ?? [],
      actions: a?.actions,
    };
    this.props = props;
    this.initArrivalPositions();
  }

  static async create(deps: CombatDeps, encounter: EncounterDef): Promise<CombatScene> {
    const backdrop = await loadImage(encounter.backdrop, {
      kind: 'background',
      label: encounter.backdropLabel ?? 'COMBAT',
      mood: encounter.backdropMood ?? 'boss',
    });

    const { state, combatants } = deps;
    // P9 gap change: cap raised 4 -> 6 for the raid finale (layout below
    // staggers each side into two columns so six sprites fit the field).
    const partyIds = (encounter.partyOverride ?? state.party).slice(0, 6);

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
        outfit: def.outfit,
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
      // Frame size from the ACTUAL sheet (3x3 grid) - the loader cache may
      // hold this path at a different frame size than combat's default spec
      // (the Donut-missing bug: her 20x16 room sheet sliced as 24x32 was
      // out of bounds and drew nothing).
      const fw = Math.max(1, Math.floor(image.width / 3));
      const fh = Math.max(1, Math.floor(image.height / 3));
      const slot = slotPos(side, index);
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
        fw,
        fh,
        drawW: Math.round(fw * DRAW_SCALE),
        drawH: Math.round(fh * DRAW_SCALE),
        x: slot.x,
        y: slot.y,
        tx: slot.x,
        ty: slot.y,
        hidden: false,
        ai: def.ai ?? 'basic',
        xpReward: def.xpReward ?? 0,
        bossSkillPtr: 0,
      };
    };

    // Stable A/B/C labels for duplicate enemies. Labels use the compact
    // shortName (never truncated mid-word at render time).
    const counts: Record<string, number> = {};
    for (const id of encounter.enemies) counts[id] = (counts[id] ?? 0) + 1;
    const seen: Record<string, number> = {};
    const enemies = await Promise.all(
      encounter.enemies.map((id, i) => {
        const def = combatants[id];
        const nth = (seen[id] = (seen[id] ?? 0) + 1);
        const name =
          (def?.shortName ?? def?.name ?? id.toUpperCase()) +
          ((counts[id] ?? 0) > 1 ? ` ${'ABCD'[nth - 1] ?? nth}` : '');
        return buildOne(id, 'enemy', i, name);
      }),
    );
    const party = await Promise.all(
      partyIds.map((id, i) =>
        buildOne(id, 'party', i, combatants[id]?.shortName ?? combatants[id]?.name ?? id.toUpperCase()),
      ),
    );

    // Arrival props (e.g. the steamroller): loaded like any actor sheet;
    // parked in the tableau background once the entrance ends.
    const props = await Promise.all(
      (encounter.arrival?.props ?? []).map(async (id, i): Promise<StageProp> => {
        const image = await loadImage(`sprites/${id}.png`, {
          kind: 'actor',
          label: id.toUpperCase(),
          color: '#8f939c',
          frameW: 48,
          frameH: 28,
        });
        const fw = Math.max(1, Math.floor(image.width / 3));
        const fh = Math.max(1, Math.floor(image.height / 3));
        // Park slightly left of the enemy slots so the machine stays readable
        // behind the fighters (painter's order: props draw first).
        const park = { x: 220 - i * 44, y: GROUND_EDGE + 2 };
        return {
          id,
          image,
          fw,
          fh,
          drawW: Math.round(fw * DRAW_SCALE),
          drawH: Math.round(fh * DRAW_SCALE),
          x: park.x,
          y: park.y,
          tx: park.x,
          ty: park.y,
          hidden: false,
        };
      }),
    );

    const scene = new CombatScene(deps, encounter, backdrop, party, enemies, props);
    // The theme also cues at transition start (room side); this is the
    // fallback for combats launched without the room transition.
    audio.playMusic(
      encounter.transitionKind === 'boss' || encounter.backdropMood === 'boss'
        ? 'music_boss'
        : 'music_combat',
    );
    scene.pushLog(encounter.introText ?? 'AN ENCOUNTER BEGINS.');
    return scene;
  }

  // --- Battle-start transition + enemy arrival -------------------------------

  private transitionMs(): number {
    return this.encounter.transitionKind === 'boss' ? WIPE_BOSS + TITLE_BOSS : WIPE_MOB;
  }

  /** Place enemies (and props) at their entrance start positions. */
  private initArrivalPositions(): void {
    const a = this.arrival;
    const edgeX = (i: number): number =>
      a.from === 'left' ? FIELD_X - 30 - i * 16 : LOGICAL_W + 24 + i * 16;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      switch (a.kind) {
        case 'walkIn':
        case 'rollIn':
          if (a.from === 'above') {
            e.y = -20 - i * 12;
          } else {
            e.x = edgeX(i);
          }
          break;
        case 'dropIn':
          e.y = -24 - i * 14;
          break;
        case 'burstIn':
          e.hidden = true;
          e.y = e.ty + 14;
          break;
        case 'scriptedActions':
          break; // pre-placed; the script provides the drama
      }
    }
    for (const p of this.props) {
      // Props ride in with the entrance from the same edge.
      p.x = a.from === 'left' ? FIELD_X - p.drawW - 20 : LOGICAL_W + p.drawW + 20;
    }
  }

  /** Per-enemy movement window inside the arrival (staggered entrances). */
  private arrivalWindow(i: number): { start: number; end: number } {
    const a = this.arrival;
    if (a.kind === 'burstIn') return { start: i * 170, end: i * 170 + 300 };
    if (this.props.length > 0 && a.kind === 'rollIn') {
      // Ride phase (60%), then hop to the slots (40%).
      return { start: a.ms * 0.6, end: a.ms * 0.6 + a.ms * 0.4 * 0.8 + i * 90 };
    }
    const travel = Math.max(300, a.ms - this.enemies.length * 110);
    return { start: i * 110, end: i * 110 + travel };
  }

  private easeOut = (k: number): number => 1 - (1 - k) * (1 - k);
  private easeIn = (k: number): number => k * k;

  /** Drive entrance positions for the current arrival time t. */
  private tickArrival(t: number): void {
    const a = this.arrival;
    // Props roll in during the first 60% of the arrival.
    for (const p of this.props) {
      const k = Math.min(1, t / Math.max(1, a.ms * 0.6));
      const startX = a.from === 'left' ? FIELD_X - p.drawW - 20 : LOGICAL_W + p.drawW + 20;
      p.x = Math.round(startX + (p.tx - startX) * this.easeOut(k));
      p.y = p.ty;
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const w = this.arrivalWindow(i);
      const k = Math.min(1, Math.max(0, (t - w.start) / Math.max(1, w.end - w.start)));
      switch (a.kind) {
        case 'walkIn': {
          const sx = a.from === 'left' ? FIELD_X - 30 - i * 16 : LOGICAL_W + 24 + i * 16;
          e.x = Math.round(sx + (e.tx - sx) * k);
          e.y = e.ty;
          break;
        }
        case 'dropIn': {
          const sy = -24 - i * 14;
          e.x = e.tx;
          const prev = e.y;
          e.y = Math.round(sy + (e.ty - sy) * this.easeIn(k));
          if (prev < e.ty && e.y >= e.ty && t > 0) {
            this.kickShake(180, 2);
            this.floats.push({ x: e.x, y: e.ty - e.drawH - 4, text: 'WHUMP', color: '#c9a86a', age: 0 });
          }
          break;
        }
        case 'burstIn': {
          if (t >= w.start && e.hidden) {
            e.hidden = false;
            this.kickShake(260, 3);
            audio.playSfx('sfx_rumble');
            for (let d = 0; d < 5; d++) {
              this.floats.push({
                x: e.tx - 12 + d * 6,
                y: e.ty - 6 - (d % 3) * 5,
                text: '*',
                color: d % 2 ? '#b8a878' : '#7a6a4a',
                age: d * 40,
              });
            }
          }
          e.x = e.tx;
          e.y = Math.round(e.ty + 14 * (1 - this.easeOut(k)));
          break;
        }
        case 'rollIn': {
          if (this.props.length > 0) {
            const ride = t < a.ms * 0.6;
            const prop = this.props[0];
            if (ride) {
              // Riding the machine: spaced along its roof.
              e.x = prop.x - 10 + i * 22;
              e.y = prop.y - Math.round(prop.drawH * 0.55);
            } else {
              // Hop off to the slots with a little arc.
              const fromX = prop.tx - 10 + i * 22;
              const fromY = prop.ty - Math.round(prop.drawH * 0.55);
              e.x = Math.round(fromX + (e.tx - fromX) * k);
              e.y = Math.round(fromY + (e.ty - fromY) * k - Math.sin(k * Math.PI) * 10);
            }
          } else {
            const sx = a.from === 'left' ? FIELD_X - 30 - i * 16 : LOGICAL_W + 24 + i * 16;
            e.x = Math.round(sx + (e.tx - sx) * this.easeOut(k));
            e.y = e.ty;
          }
          break;
        }
        case 'scriptedActions':
          break;
      }
    }
  }

  private arrivalMoveMs(): number {
    if (this.enemies.length === 0) return 0;
    let end = 0;
    for (let i = 0; i < this.enemies.length; i++) end = Math.max(end, this.arrivalWindow(i).end);
    return Math.max(end, this.arrival.ms);
  }

  /** Queue the authored arrival lines (after movement) exactly once. */
  private queueArrivalLines(): void {
    if (this.arrivalLinesQueued) return;
    this.arrivalLinesQueued = true;
    for (const text of this.arrival.lines) {
      this.lineQueue.push({ text, resolve: () => undefined });
    }
    if (this.arrival.kind === 'scriptedActions' && this.arrival.actions?.length) {
      this.arrivalScriptDone = false;
      const runner = new ScriptRunner(new CombatArrivalHost(this));
      this.arrivalRunner = runner;
      void runner
        .runCutscene(this.arrival.actions)
        .catch((err: unknown) => console.warn('[combat] arrival script failed:', err))
        .then(() => {
          this.arrivalScriptDone = true;
        });
    }
    if (this.lineQueue.length > 0) this.showLine(this.lineQueue[0].text);
  }

  private showLine(text: string): void {
    this.lineT = 0;
    this.pushLog(text);
  }

  /** Called by the arrival script host: display a line, resolve on advance. */
  enqueueArrivalLine(text: string): Promise<void> {
    if (this.arrivalSkipped) {
      this.pushLog(text);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.lineQueue.push({ text, resolve });
      if (this.lineQueue.length === 1) this.showLine(text);
    });
  }

  /** Called by the arrival script host: game-time wait inside combat. */
  arrivalWait(ms: number): Promise<void> {
    if (this.arrivalSkipped) return Promise.resolve();
    return new Promise((resolve) => {
      this.arrivalTimers.push({ remaining: ms, resolve });
    });
  }

  get arrivalState(): GameState {
    return this.deps.state;
  }

  kickShake(ms: number, amp: number): void {
    this.shakeFx = { t: 0, ms, amp };
  }

  private advanceLine(): void {
    const line = this.lineQueue.shift();
    line?.resolve();
    if (this.lineQueue.length > 0) this.showLine(this.lineQueue[0].text);
  }

  private arrivalFinished(): boolean {
    return this.arrivalMoveDone && this.lineQueue.length === 0 && this.arrivalScriptDone;
  }

  private arrivalSkipped = false;

  /** ESC: jump the transition + arrival to their end state (skip semantics). */
  private skipToBattle(): void {
    this.arrivalSkipped = true;
    for (const e of this.enemies) {
      e.x = e.tx;
      e.y = e.ty;
      e.hidden = false;
    }
    for (const p of this.props) {
      p.x = p.tx;
      p.y = p.ty;
    }
    this.arrivalMoveDone = true;
    this.queueArrivalLines();
    this.arrivalRunner?.requestSkip();
    for (const t of this.arrivalTimers.splice(0)) t.resolve();
    for (const line of this.lineQueue.splice(0)) line.resolve();
    this.shakeFx = null;
    if (this.mode.kind === 'transition' || this.mode.kind === 'arrival') this.startRound();
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
    this.floats.push({ x: c.x, y: c.y - c.drawH - 8, text, color, age: 0 });
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
      audio.playSfx('sfx_miss');
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
    audio.playSfx('sfx_hit');
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
    audio.playSfx('sfx_cast');
    this.pushLog(`${user.name} USES ${skill.name}: ${parts.join(', ') || 'NO EFFECT'}.`);
    this.afterAction(user);
  }

  private doItem(user: Combatant, item: ItemDef, use: CombatUseDef, targets: Combatant[]): void {
    audio.playSfx(use.target === 'allEnemies' ? 'sfx_explosion' : 'sfx_pickup');
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
    audio.playSfx(gained > 0 ? 'sfx_levelup' : 'sfx_victory');
    console.info(`[combat] victory (+${xpGain} xp, level ${state.level})`);
    this.mode = { kind: 'victory', lines };
  }

  private doDefeat(): void {
    audio.playSfx('sfx_defeat');
    this.pushLog('THE PARTY FALLS.');
    console.info('[combat] defeat');
    this.mode = { kind: 'ending', t: 0, result: 'defeat' };
  }

  private finish(result: CombatResult): void {
    if (this.finished) return;
    this.finished = true;
    audio.restorePreviousMusic();
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
    if (this.shakeFx) {
      this.shakeFx.t += dtMs;
      if (this.shakeFx.t >= this.shakeFx.ms) this.shakeFx = null;
    }
    for (let i = this.arrivalTimers.length - 1; i >= 0; i--) {
      const t = this.arrivalTimers[i];
      t.remaining -= dtMs;
      if (t.remaining <= 0) {
        this.arrivalTimers.splice(i, 1);
        t.resolve();
      }
    }

    const input = this.deps.game.input;
    const mode = this.mode;

    switch (mode.kind) {
      // Input LOCKED during the transition and the arrival; ESC skips to the
      // arrival's end state (cutscene semantics).
      case 'transition': {
        mode.t += dtMs;
        if (input.consumePress('Escape')) {
          this.skipToBattle();
          break;
        }
        input.clearClicks();
        input.clearRightClicks();
        if (mode.t >= this.transitionMs()) {
          this.mode = { kind: 'arrival', t: 0 };
          this.tickArrival(0);
        }
        break;
      }
      case 'arrival': {
        mode.t += dtMs;
        if (input.consumePress('Escape')) {
          this.skipToBattle();
          break;
        }
        this.tickArrival(mode.t);
        if (!this.arrivalMoveDone && mode.t >= this.arrivalMoveMs()) {
          this.arrivalMoveDone = true;
          this.queueArrivalLines();
        }
        // Lines: auto-advance on a timer; click/Enter/Space advances early.
        const advance =
          input.consumeClick() !== null ||
          input.consumePress('Enter') ||
          input.consumePress('Space');
        if (this.lineQueue.length > 0) {
          this.lineT += dtMs;
          if (advance || this.lineT >= LINE_HOLD_MS) this.advanceLine();
        }
        input.clearClicks();
        input.clearRightClicks();
        if (this.arrivalFinished()) this.startRound();
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
    return { x: SIDEBAR.x + 3, y: SIDEBAR.y + 26 + i * 12, w: SIDEBAR.w - 6, h: 12 };
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
          click.x >= c.x - c.drawW / 2 &&
          click.x < c.x + c.drawW / 2 &&
          click.y >= c.y - c.drawH &&
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
    const inTransition = this.mode.kind === 'transition';
    const shake = this.shakeFx
      ? {
          x: Math.round(Math.sin(this.shakeFx.t * 0.09) * this.shakeFx.amp * (1 - this.shakeFx.t / this.shakeFx.ms)),
          y: Math.round(Math.cos(this.shakeFx.t * 0.13) * this.shakeFx.amp * (1 - this.shakeFx.t / this.shakeFx.ms)),
        }
      : { x: 0, y: 0 };

    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.renderStage(ctx);
    this.renderTurnStrip(ctx);
    this.renderLog(ctx);
    this.renderProps(ctx);
    this.renderCombatants(ctx);
    this.renderFloats(ctx);
    ctx.restore();

    if (inTransition && this.mode.kind === 'transition') {
      this.renderTransition(ctx, this.mode.t);
    }
    this.renderPanels(ctx);
    if (this.mode.kind === 'victory') this.renderVictory(ctx, this.mode.lines);
    if (this.mode.kind === 'ending') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      const text = this.mode.result === 'defeat' ? 'THE PARTY FALLS.' : 'ESCAPED.';
      drawPixelText(ctx, text, LOGICAL_W / 2, 92, this.mode.result === 'defeat' ? '#ff6e6e' : '#8fa3c4', 2, 'center');
    }
    drawMenuCursor(ctx, this.deps.game.input.mouse);
  }

  /** Backdrop + the painted ground plane every combatant is anchored to. */
  private renderStage(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.backdrop, 0, 0, LOGICAL_W, LOGICAL_H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Floor plane: a hard edge line at GROUND_EDGE, darker footing below it,
    // a soft light pool where the fighters stand, and receding depth bands.
    const floor = ctx.createLinearGradient(0, GROUND_EDGE, 0, LOGICAL_H);
    floor.addColorStop(0, 'rgba(6,8,14,0.42)');
    floor.addColorStop(1, 'rgba(6,8,14,0.12)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND_EDGE, LOGICAL_W, LOGICAL_H - GROUND_EDGE);
    ctx.fillStyle = 'rgba(255,240,210,0.28)';
    ctx.fillRect(0, GROUND_EDGE, LOGICAL_W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, GROUND_EDGE + 1, LOGICAL_W, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (const y of [GROUND_EDGE + 18, GROUND_EDGE + 38, GROUND_EDGE + 58]) {
      ctx.fillRect(0, y, LOGICAL_W, 1);
    }
    const pool = ctx.createRadialGradient(FIELD_CX, 168, 8, FIELD_CX, 168, 120);
    pool.addColorStop(0, 'rgba(255,236,190,0.10)');
    pool.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, GROUND_EDGE, LOGICAL_W, LOGICAL_H - GROUND_EDGE);
  }

  /** Directional slice-wipe in from black; boss adds the title card. */
  private renderTransition(ctx: CanvasRenderingContext2D, t: number): void {
    const boss = this.encounter.transitionKind === 'boss';
    const wipeMs = boss ? WIPE_BOSS : WIPE_MOB;
    const cols = 8;
    const colW = Math.ceil(LOGICAL_W / cols);
    for (let i = 0; i < cols; i++) {
      // Staggered columns, alternating top/bottom, sweeping left to right.
      const k = Math.min(1, Math.max(0, (t / wipeMs) * 1.6 - i * 0.085));
      const remaining = Math.round(LOGICAL_H * (1 - k));
      if (remaining <= 0) continue;
      ctx.fillStyle = '#000000';
      if (i % 2 === 0) ctx.fillRect(i * colW, 0, colW, remaining);
      else ctx.fillRect(i * colW, LOGICAL_H - remaining, colW, remaining);
    }
    if (boss && t >= wipeMs) {
      // Title card: the boss's name and level, flickering over a dark press.
      const k = (t - wipeMs) / TITLE_BOSS;
      const alpha = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.fillStyle = `rgba(10,2,6,${0.72 * alpha})`;
      ctx.fillRect(0, 60, LOGICAL_W, 74);
      ctx.fillStyle = `rgba(255,110,110,${alpha})`;
      ctx.fillRect(40, 64, LOGICAL_W - 80, 1);
      ctx.fillRect(40, 129, LOGICAL_W - 80, 1);
      const lead = this.enemies[0];
      const def = lead ? this.deps.combatants[lead.defId] : undefined;
      const flicker = Math.floor(t / 90) % 5 === 0 ? 0.55 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha * flicker);
      drawPixelText(ctx, def?.name ?? 'BOSS', LOGICAL_W / 2, 78, '#ff6e6e', 2, 'center');
      drawPixelText(
        ctx,
        `LEVEL ${def?.level ?? '??'} - ${this.encounter.backdropLabel ?? 'BOSS FIGHT'}`,
        LOGICAL_W / 2,
        100,
        '#ffd9d9',
        1,
        'center',
      );
      drawPixelText(ctx, 'THE ODDS BOARD IS OPEN', LOGICAL_W / 2, 114, '#8fa3c4', 1, 'center');
      ctx.restore();
      if (this.shakeFx === null && k < 0.2) this.kickShake(420, 2);
    }
  }

  /** Stage props (behind the combatants; parked in the background). */
  private renderProps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.props) {
      if (p.hidden) continue;
      const dx = Math.round(p.x - p.drawW / 2);
      const dy = Math.round(p.y - p.drawH);
      // Drop shadow, then the idle frame (col 0/1 alternating for a chug).
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 1, p.drawW * 0.4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      const col = Math.floor(this.animMs / 260) % 2;
      const sx = (6 + col) % 3 === 0 ? 0 : ((6 + col) % 3) * p.fw;
      const sy = Math.floor((6 + col) / 3) * p.fh;
      ctx.drawImage(p.image, sx, sy, p.fw, p.fh, dx, dy, p.drawW, p.drawH);
    }
  }

  private renderCombatants(ctx: CanvasRenderingContext2D): void {
    const arriving = this.mode.kind === 'arrival' || this.mode.kind === 'transition';
    for (const c of [...this.all].sort((a, b) => a.y - b.y)) {
      if (c.hidden) continue;
      const dead = !this.alive(c);
      if (dead && c.side === 'enemy') continue;
      const isCurrent = this.current === c && !dead;
      const bob = isCurrent && Math.floor(this.animMs / 300) % 2 === 0 ? -1 : 0;
      const dx = Math.round(c.x - c.drawW / 2);
      const dy = Math.round(c.y - c.drawH + bob);
      const moving = arriving && c.side === 'enemy' && (c.x !== c.tx || c.y !== c.ty);

      // Feet-anchored drop shadow: the grounding cue under every fighter.
      if (!dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y - 1, Math.max(6, c.drawW * 0.32), 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      if (dead) ctx.globalAlpha = 0.3;
      // Row 2 of the canonical 3x3 sheet faces right: col 0 = idle, cols 1/2
      // walk. Party stands stage-left facing right (unmirrored); enemies
      // stand stage-right facing left (mirrored).
      const col = moving ? 1 + (Math.floor(this.animMs / 140) % 2) : 0;
      const sx = col * c.fw;
      const sy = 2 * c.fh;
      if (c.side === 'enemy') {
        ctx.translate(dx + c.drawW, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(c.image, sx, sy, c.fw, c.fh, 0, 0, c.drawW, c.drawH);
      } else {
        ctx.drawImage(c.image, sx, sy, c.fw, c.fh, dx, dy, c.drawW, c.drawH);
      }
      ctx.restore();

      // Name label: shortName-based, wrapped on spaces - NEVER cut mid-word.
      const nameLines = this.nameLines(c.name);
      const nameColor = isCurrent ? '#ffe9a8' : '#d8ecff';
      nameLines.forEach((line, li) => {
        const ly = c.y - c.drawH - 7 - (nameLines.length - 1 - li) * 7;
        drawPixelText(ctx, line, c.x, ly, nameColor, 1, 'center');
      });
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
          const topY = c.y - c.drawH - 7 * nameLines.length;
          ctx.fillStyle = '#ff6e6e';
          ctx.fillRect(c.x - 3, topY - 8, 7, 2);
          ctx.fillRect(c.x - 2, topY - 6, 5, 2);
          ctx.fillRect(c.x - 1, topY - 4, 3, 2);
        }
      }
      // Current-turn marker
      if (isCurrent && this.mode.kind !== 'target') {
        ctx.fillStyle = '#3fd9ff';
        ctx.fillRect(c.x - 1, c.y - c.drawH - 7 * nameLines.length - 5, 3, 3);
      }
    }
  }

  /** Wrap a combat name on word boundaries so labels never cut mid-word. */
  private nameLines(name: string): string[] {
    const MAX_W = 48;
    if (pixelTextWidth(name) <= MAX_W) return [name];
    const words = name.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && pixelTextWidth(next) > MAX_W) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  }

  private renderTurnStrip(ctx: CanvasRenderingContext2D): void {
    if (this.order.length === 0) return;
    let x = 4;
    for (let i = 0; i < this.order.length; i++) {
      const c = this.order[i];
      // HUD chips: the full short name when it fits, else the first word
      // (plus any A/B duplicate suffix) - never truncated mid-word.
      const suffix = /\s[A-D]$/.test(c.name) ? c.name.slice(-2) : '';
      const label =
        pixelTextWidth(c.name) <= 44 ? c.name : c.name.split(' ')[0].concat(suffix);
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
    // Arrival lines stay up until advanced; battle log fades after 3.5s.
    const arrivalLine = this.mode.kind === 'arrival' || this.mode.kind === 'transition';
    if (!this.logLine || (!arrivalLine && this.logAge > 3500)) return;
    const lines = wrapText(this.logLine, 74);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    lines.slice(0, 3).forEach((line, i) => {
      const w = pixelTextWidth(line) + 8;
      const x = Math.floor((LOGICAL_W - w) / 2);
      ctx.fillRect(x, 16 + i * 9, w, 9);
    });
    lines.slice(0, 3).forEach((line, i) => {
      drawPixelText(ctx, line, LOGICAL_W / 2, 18 + i * 9, '#e6eeff', 1, 'center');
    });
  }

  private renderPanels(ctx: CanvasRenderingContext2D): void {
    const c = this.current;
    const inMenu =
      this.mode.kind === 'menu' || this.mode.kind === 'submenu' || this.mode.kind === 'target';
    if (!c || c.side !== 'party' || !inMenu) return;

    // LEFT sidebar (~25% width): current actor at top, vertical actions,
    // wrapped context/help text at the bottom. The right 75% stays tableau.
    outlinedPanel(ctx, SIDEBAR.x, SIDEBAR.y, SIDEBAR.w, SIDEBAR.h, '#0e1420', '#3fd9ff');
    drawPixelText(ctx, c.name, SIDEBAR.x + 4, SIDEBAR.y + 4, '#3fd9ff');
    drawPixelText(ctx, `LV ${this.deps.state.level}`, SIDEBAR.x + 4, SIDEBAR.y + 12, '#8fa3c4');

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
      rows = list.map((s) => ({ label: s.name.slice(0, 17), dim: !this.canUseSkill(c, s) }));
      selected = this.mode.index;
      const s = list[this.mode.index];
      if (s) {
        const cd = c.cooldowns[s.id] ?? 0;
        const cost = s.mpCost !== undefined ? `MP ${s.mpCost}` : `CD ${s.cooldown ?? 0}`;
        info = `${s.name} (${cost}${cd > 0 ? `, READY IN ${cd}` : ''}) - ${s.description}`;
      } else info = 'NO SKILLS KNOWN.';
    } else if (this.mode.kind === 'submenu') {
      const list = this.itemEntries();
      rows = list.map((e) => ({ label: `${e.def.name.slice(0, 14)} X${e.count}`, dim: false }));
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
        drawPixelText(ctx, '>', r.x + 2, r.y + 3, '#ffe9a8');
      }
      drawPixelText(ctx, row.label, r.x + 9, r.y + 3, row.dim ? '#4a586f' : isSel ? '#ffe9a8' : '#b8c8e0');
    });

    // Info block at the sidebar's bottom, wrapped to the narrow column.
    const infoY = SIDEBAR.y + 92;
    ctx.fillStyle = '#39465e';
    ctx.fillRect(SIDEBAR.x + 3, infoY - 4, SIDEBAR.w - 6, 1);
    const lines = wrapText(info, Math.floor((SIDEBAR.w - 8) / 4));
    lines.slice(0, 10).forEach((line, i) => {
      drawPixelText(ctx, line, SIDEBAR.x + 4, infoY + i * 8, '#8fa3c4');
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

// ---------------------------------------------------------------------------
// Arrival script host: lets `arrival.kind === 'scriptedActions'` run real
// ScriptAction[] through the shared runner inside the combat tableau.
// Narration/say become awaitable combat banner lines; waits and cues work;
// world-only actions (rooms, actors, camera) are safe no-ops with a warning.
// ---------------------------------------------------------------------------

class CombatArrivalHost implements ScriptHost {
  constructor(private readonly scene: CombatScene) {}

  get state(): GameState {
    return this.scene.arrivalState;
  }

  private noop(what: string): void {
    console.warn(`[combat] arrival script: "${what}" is a no-op inside combat`);
  }

  currentRoomId(): string {
    return this.state.currentRoom;
  }
  narrate(text: string): Promise<void> {
    return this.scene.enqueueArrivalLine(text);
  }
  sayLine(actorId: string, text: string): Promise<void> {
    return this.scene.enqueueArrivalLine(`${actorId.toUpperCase()}: ${text}`);
  }
  runDialogue(): Promise<void> {
    this.noop('startDialogue');
    return Promise.resolve();
  }
  getItemDef(): ItemDef | undefined {
    return undefined;
  }
  getCutscene(): CutsceneDef | undefined {
    return undefined;
  }
  walkPlayerTo(): Promise<void> {
    this.noop('walkPlayerTo');
    return Promise.resolve();
  }
  moveActor(): Promise<void> {
    this.noop('moveActor');
    return Promise.resolve();
  }
  spawnActor(spec: { actorId: string; sheet: SpriteSheetDef; x: number; y: number; anim?: string; facing?: Facing }): Promise<void> {
    this.noop(`spawnActor(${spec.actorId})`);
    return Promise.resolve();
  }
  despawnActor(): void {
    this.noop('despawnActor');
  }
  facePlayer(): void {
    this.noop('facePlayer');
  }
  playAnim(): void {
    this.noop('playAnim');
  }
  wait(ms: number): Promise<void> {
    return this.scene.arrivalWait(ms);
  }
  gotoRoom(roomId: string, _spawn?: SpawnPoint): Promise<void> {
    this.noop(`gotoRoom(${roomId})`);
    return Promise.resolve();
  }
  scriptFade(): Promise<void> {
    return Promise.resolve();
  }
  cameraPan(): Promise<void> {
    return Promise.resolve();
  }
  setLetterbox(): void {
    // The transition/arrival already locks input; letterbox is a no-op here.
  }
  shake(ms: number, magnitude: number): Promise<void> {
    this.scene.kickShake(ms, magnitude);
    return this.scene.arrivalWait(ms);
  }
  refreshBackground(): Promise<void> {
    return Promise.resolve();
  }
  awardAchievement(id: string): void {
    this.noop(`awardAchievement(${id})`);
  }
  killPlayer(): void {
    this.noop('killPlayer');
  }
  quitToTitle(): void {
    this.noop('quitToTitle');
  }
  runEncounter(): Promise<'victory' | 'defeat' | 'fled' | null> {
    this.noop('startCombat');
    return Promise.resolve(null);
  }
  getEncounter(): EncounterDef | undefined {
    return undefined;
  }
}
