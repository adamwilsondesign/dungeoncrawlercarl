/**
 * The script runner: executes ScriptAction[] sequentially against a host
 * (the active scene). The runner is deliberately decoupled from hotspots —
 * dialogue and cutscenes (P3+) reuse it unchanged. While any script runs,
 * the scene blocks world input but keeps narrator advancement live.
 */

import type { ScriptAction } from '../data/script';
import type { Facing, ItemDef, SpawnPoint } from '../data/types';
import type { GameState } from './state';
import { achievementLine, acquiredLine } from './verbs';

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
  /** Path the player to a point; resolves on arrival (or immediately if unreachable). */
  walkPlayerTo(x: number, y: number): Promise<void>;
  facePlayer(dir: Facing): void;
  playAnim(actorId: string, anim: string): void;
  /** Game-time wait, ticked by the fixed-timestep update. */
  wait(ms: number): Promise<void>;
  /** Fade to the target room; resolves once the fade-in completes. */
  gotoRoom(roomId: string, spawn?: SpawnPoint): Promise<void>;
}

export class ScriptRunner {
  private activeCount = 0;

  constructor(private readonly host: ScriptHost) {}

  /** True while any script is executing (scene blocks world input). */
  get running(): boolean {
    return this.activeCount > 0;
  }

  async run(actions: readonly ScriptAction[]): Promise<void> {
    this.activeCount++;
    try {
      for (const action of actions) await this.exec(action);
    } finally {
      this.activeCount--;
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
        state.setFlag(`ach:${action.id}`, true);
        await host.narrate(achievementLine(action.id));
        break;
    }
  }
}
