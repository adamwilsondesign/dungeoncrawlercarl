/**
 * The script runner: executes ScriptAction[] sequentially against a host
 * (the active scene). The runner is deliberately decoupled from hotspots —
 * dialogue, cutscenes and (later) combat reuse it unchanged. While any
 * script runs, the scene blocks world input but keeps narrator/dialogue
 * advancement live.
 *
 * Cutscenes are ordinary scripts run through runCutscene(): Esc requests a
 * skip, after which every remaining action applies its end state instantly
 * (host methods check `skipping`); the scene force-resolves whatever action
 * was pending when the skip was requested.
 */

import type { ScriptAction } from '../data/script';
import type {
  CutsceneDef,
  EncounterDef,
  Facing,
  ItemDef,
  SpawnPoint,
  SpriteSheetDef,
} from '../data/types';
import type { GameState } from './state';
import { audio } from './audio';
import { acquiredLine, goldLine, xpLine } from './verbs';

/** Thrown by killPlayer to unwind the running script cleanly. */
export class ScriptAbort extends Error {
  constructor() {
    super('script aborted');
    this.name = 'ScriptAbort';
  }
}

/** What a script needs from the world; implemented by the active scene. */
export interface ScriptHost {
  readonly state: GameState;
  currentRoomId(): string;
  /** Show a narrator box (speaker tag optional); resolves on dismissal. */
  narrate(text: string, speakerId?: string): Promise<void>;
  /** One-line portrait dialogue (the say() action); resolves on advance. */
  sayLine(actorId: string, text: string): Promise<void>;
  /** Play a registered DialogueTree to 'end'. */
  runDialogue(treeId: string): Promise<void>;
  getItemDef(id: string): ItemDef | undefined;
  getCutscene(id: string): CutsceneDef | undefined;
  /** Path the player to a point; resolves on arrival (or immediately if unreachable). */
  walkPlayerTo(x: number, y: number): Promise<void>;
  /** Move any actor; the player pathfinds, others glide straight. Awaits arrival. */
  moveActor(actorId: string, x: number, y: number, speed?: number): Promise<void>;
  spawnActor(spec: {
    actorId: string;
    sheet: SpriteSheetDef;
    x: number;
    y: number;
    anim?: string;
    facing?: Facing;
  }): Promise<void>;
  despawnActor(actorId: string): void;
  facePlayer(dir: Facing): void;
  playAnim(actorId: string, anim: string): void;
  /** Game-time wait, ticked by the fixed-timestep update. */
  wait(ms: number): Promise<void>;
  /** Fade to the target room; resolves once the fade-in completes. */
  gotoRoom(roomId: string, spawn?: SpawnPoint): Promise<void>;
  /** Tween the script fade overlay to an alpha (1 = black). */
  scriptFade(targetAlpha: number, ms: number): Promise<void>;
  /** Horizontal camera tween; no-op for single-screen rooms. */
  cameraPan(fromX: number, toX: number, ms: number): Promise<void>;
  setLetterbox(on: boolean): void;
  /** Idempotent achievement award: flag + queued toast. */
  awardAchievement(id: string): void;
  /** Begin the death sequence (fade + death dialog). */
  killPlayer(reason: string): void;
  /** End-of-demo: unwind to the title screen (P9 gap; used by credits). */
  quitToTitle(): void;
  /**
   * Run an encounter to completion. Applies rewards on victory (before
   * resolving); returns the result, or null if the encounter is unknown.
   * The runner handles victory/defeat scripts.
   */
  runEncounter(encounterId: string): Promise<'victory' | 'defeat' | 'fled' | null>;
  getEncounter(id: string): EncounterDef | undefined;
}

export class ScriptRunner {
  private activeCount = 0;
  private cutsceneDepth = 0;
  private skipRequested = false;

  constructor(private readonly host: ScriptHost) {}

  /** True while any script is executing (scene blocks world input). */
  get running(): boolean {
    return this.activeCount > 0;
  }

  /** True while a skippable cutscene is playing (Esc fast-forwards). */
  get inCutscene(): boolean {
    return this.cutsceneDepth > 0;
  }

  /** True once a skip was requested; host methods apply end states instantly. */
  get skipping(): boolean {
    return this.skipRequested;
  }

  requestSkip(): void {
    if (this.cutsceneDepth > 0) this.skipRequested = true;
  }

  async run(actions: readonly ScriptAction[]): Promise<void> {
    this.activeCount++;
    try {
      for (const action of actions) await this.exec(action);
    } finally {
      this.activeCount--;
    }
  }

  /** Run actions as a skippable cutscene; clears skip state when the scene ends. */
  async runCutscene(actions: readonly ScriptAction[]): Promise<void> {
    this.cutsceneDepth++;
    try {
      await this.run(actions);
    } finally {
      this.cutsceneDepth--;
      if (this.cutsceneDepth === 0) this.skipRequested = false;
    }
  }

  private async exec(action: ScriptAction): Promise<void> {
    const { host } = this;
    const { state } = host;
    switch (action.type) {
      case 'narrate':
        await host.narrate(action.text);
        break;
      case 'say':
        await host.sayLine(action.actorId, action.text);
        break;
      case 'startDialogue':
        await host.runDialogue(action.treeId);
        break;
      case 'walkPlayerTo':
        await host.walkPlayerTo(action.x, action.y);
        break;
      case 'facePlayer':
        host.facePlayer(action.dir);
        break;
      case 'setFlag':
        state.setFlag(action.key, action.value);
        break;
      case 'ifFlag': {
        const value = state.getFlag(action.key);
        const matched =
          action.equals !== undefined ? value === action.equals : Boolean(value);
        await this.run(matched ? action.then : action.else);
        break;
      }
      case 'giveItem': {
        const def = host.getItemDef(action.id);
        if (!def) console.warn(`[script] giveItem: unknown item "${action.id}"`);
        const count = state.addItem(action.id, def?.stackable === true);
        audio.playSfx('sfx_pickup');
        await host.narrate(acquiredLine(def?.name ?? action.id.toUpperCase(), count));
        break;
      }
      case 'takeItem':
        if (!state.removeItem(action.id)) {
          console.warn(`[script] takeItem: not holding "${action.id}"`);
        }
        break;
      case 'ifItem':
        await this.run(state.hasItem(action.id) ? action.then : action.else);
        break;
      case 'playAnim':
        host.playAnim(action.actorId, action.anim);
        break;
      case 'wait':
        await host.wait(action.ms);
        break;
      case 'enableHotspot':
        state.setHotspotEnabled(host.currentRoomId(), action.id, true);
        break;
      case 'disableHotspot':
        state.setHotspotEnabled(host.currentRoomId(), action.id, false);
        break;
      case 'enableExit':
        state.setExitEnabled(host.currentRoomId(), action.id, true);
        break;
      case 'disableExit':
        state.setExitEnabled(host.currentRoomId(), action.id, false);
        break;
      case 'gotoRoom':
        await host.gotoRoom(action.roomId, action.spawn);
        break;
      case 'awardAchievement':
        host.awardAchievement(action.id);
        break;
      case 'moveActor':
        await host.moveActor(action.actorId, action.x, action.y, action.speed);
        break;
      case 'spawnActor':
        await host.spawnActor({
          actorId: action.actorId,
          sheet: action.sheet,
          x: action.x,
          y: action.y,
          anim: action.anim,
          facing: action.facing,
        });
        break;
      case 'despawnActor':
        host.despawnActor(action.actorId);
        break;
      case 'cameraPan':
        await host.cameraPan(action.fromX, action.toX, action.ms);
        break;
      case 'fadeOut':
        await host.scriptFade(1, action.ms);
        break;
      case 'fadeIn':
        await host.scriptFade(0, action.ms);
        break;
      case 'setLetterbox':
        host.setLetterbox(action.on);
        break;
      case 'musicCue':
        audio.musicCue(action.id);
        break;
      case 'sfxCue':
        audio.sfxCue(action.id);
        break;
      case 'playCutscene': {
        const def = host.getCutscene(action.id);
        if (!def) {
          console.warn(`[script] playCutscene: unknown cutscene "${action.id}"`);
          break;
        }
        const playedFlag = `scene:${action.id}:played`;
        if (!def.repeatable && state.getFlag(playedFlag)) break;
        state.setFlag(playedFlag, true);
        await this.runCutscene(def.actions);
        break;
      }
      case 'killPlayer':
        host.killPlayer(action.reason);
        throw new ScriptAbort();
      case 'autosave':
        state.autosave();
        break;
      case 'equipItem': {
        const def = host.getItemDef(action.itemId);
        if (!def?.equip) {
          console.warn(`[script] equipItem: "${action.itemId}" is not equipment`);
          break;
        }
        if (!state.equipItem(action.memberId, action.itemId, def.equip.slot)) {
          console.warn(`[script] equipItem: "${action.itemId}" not in inventory`);
        }
        break;
      }
      case 'joinParty':
        if (!state.party.includes(action.memberId)) state.party.push(action.memberId);
        break;
      case 'giveGold':
        state.gold += action.amount;
        await host.narrate(goldLine(action.amount));
        break;
      case 'addViews':
        state.views += action.amount;
        break;
      case 'learnSkill':
        state.learnSkill(action.memberId, action.skillId);
        break;
      case 'giveXp': {
        const before = state.level;
        state.addXp(action.amount);
        await host.narrate(xpLine(action.amount));
        if (state.level > before) {
          audio.playSfx('sfx_levelup');
          await host.narrate(`LEVEL UP! PARTY REACHES LEVEL ${state.level}. Try to act like this was the plan.`);
        }
        break;
      }
      case 'quitToTitle':
        host.quitToTitle();
        break;
      case 'startCombat': {
        const encounter = host.getEncounter(action.encounterId);
        if (!encounter) {
          console.warn(`[script] startCombat: unknown encounter "${action.encounterId}"`);
          break;
        }
        const result = await host.runEncounter(action.encounterId);
        if (!result) break;
        state.setFlag(`combat:${action.encounterId}:result`, result);
        if (result === 'victory') {
          if (encounter.victoryScript) await this.run(encounter.victoryScript);
        } else if (result === 'defeat') {
          if (encounter.defeatScript) {
            await this.run(encounter.defeatScript);
          } else {
            host.killPlayer(
              'Your party lost the fight. Decisively. The instant replay is already trending.',
            );
            throw new ScriptAbort();
          }
        }
        break;
      }
    }
  }
}
