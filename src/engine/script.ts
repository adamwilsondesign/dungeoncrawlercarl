/**
 * The script runner: executes ScriptAction[] sequentially against a host
 * (the active scene). The runner is deliberately decoupled from hotspots —
 * dialogue and cutscenes (P3+) reuse it unchanged. While any script runs,
 * the scene blocks world input but keeps narrator advancement live.
 */

import type { ScriptAction } from '../data/script';
import type { Facing, SpawnPoint } from '../data/types';
import type { GameState } from './state';
import { achievementLine } from './verbs';

/** What a script needs from the world; implemented by the active scene. */
export interface ScriptHost {
  readonly state: GameState;
  currentRoomId(): string;
  /** Show a narrator box (speaker tag optional); resolves on dismissal. */
  narrate(text: string, speakerId?: string): Promise<void>;
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
        // TEMP until P3 dialogue: a narrator-style box tagged with the speaker.
        await host.narrate(action.text, action.actorId);
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
      case 'giveItem':
        console.info(`[script] giveItem "${action.id}" — inventory arrives in P3 (no-op)`);
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
