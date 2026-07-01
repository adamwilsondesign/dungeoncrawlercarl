/**
 * The script DSL: a declarative ScriptAction union plus tiny builder
 * functions for authoring. All game content (hotspot responses, dialogue,
 * cutscenes) is expressed as ScriptAction[] and executed by the engine's
 * ScriptRunner. This module is pure data constructors — no engine imports —
 * so room definitions can use it freely.
 */

import type { Facing, FlagValue, SpawnPoint, SpriteSheetDef } from './types';

export type ScriptAction =
  | { type: 'narrate'; text: string }
  /** A one-line dialogue box: portrait + name plate, no choices. */
  | { type: 'say'; actorId: string; text: string }
  /** Play a registered DialogueTree from its entry node until it routes to 'end'. */
  | { type: 'startDialogue'; treeId: string }
  | { type: 'walkPlayerTo'; x: number; y: number }
  | { type: 'facePlayer'; dir: Facing }
  | { type: 'setFlag'; key: string; value: FlagValue }
  | { type: 'ifFlag'; key: string; equals?: FlagValue; then: ScriptAction[]; else: ScriptAction[] }
  /** Add to inventory (stacks if the ItemDef is stackable) + in-voice confirmation. */
  | { type: 'giveItem'; id: string }
  /** Remove one of the item from inventory (silent; warns if absent). */
  | { type: 'takeItem'; id: string }
  /** Branch on whether the player holds at least one of the item. */
  | { type: 'ifItem'; id: string; then: ScriptAction[]; else: ScriptAction[] }
  | { type: 'playAnim'; actorId: string; anim: string }
  | { type: 'wait'; ms: number }
  | { type: 'enableHotspot'; id: string }
  | { type: 'disableHotspot'; id: string }
  | { type: 'enableExit'; id: string }
  | { type: 'disableExit'; id: string }
  | { type: 'gotoRoom'; roomId: string; spawn?: SpawnPoint }
  /** Idempotent: sets ach:<id> and shows a slide-in toast (no-op if already earned). */
  | { type: 'awardAchievement'; id: string }
  // --- Cutscene actions (P4) ---
  /** Move an actor and await arrival. The player pathfinds; others glide straight. */
  | { type: 'moveActor'; actorId: string; x: number; y: number; speed?: number }
  /** Add an actor to the current room for a scene (name/color resolve from characters). */
  | { type: 'spawnActor'; actorId: string; sheet: SpriteSheetDef; x: number; y: number; anim?: string; facing?: Facing }
  | { type: 'despawnActor'; actorId: string }
  /** Horizontal camera tween for rooms wider than 320; no-op on single-screen rooms. */
  | { type: 'cameraPan'; fromX: number; toX: number; ms: number }
  | { type: 'fadeOut'; ms: number }
  | { type: 'fadeIn'; ms: number }
  /** Cinematic top/bottom black bars on or off. */
  | { type: 'setLetterbox'; on: boolean }
  /** Logged no-op until the audio system lands; keep cue ids stable. */
  | { type: 'musicCue'; id: string }
  | { type: 'sfxCue'; id: string }
  /** Play a registered cutscene (once per scene:<id>:played unless repeatable). */
  | { type: 'playCutscene'; id: string }
  /** Kill the player: aborts the running script and opens the death dialog. */
  | { type: 'killPlayer'; reason: string }
  /** Write the autosave slot (content checkpoints). */
  | { type: 'autosave' };

export const narrate = (text: string): ScriptAction => ({ type: 'narrate', text });

export const say = (actorId: string, text: string): ScriptAction => ({ type: 'say', actorId, text });

export const walkPlayerTo = (x: number, y: number): ScriptAction => ({ type: 'walkPlayerTo', x, y });

export const facePlayer = (dir: Facing): ScriptAction => ({ type: 'facePlayer', dir });

export const setFlag = (key: string, value: FlagValue): ScriptAction => ({ type: 'setFlag', key, value });

/**
 * Branch on a flag. Without `equals`, truthiness of the flag decides;
 * with `equals`, strict equality against that value decides.
 */
export const ifFlag = (
  key: string,
  then: ScriptAction[],
  elseActions: ScriptAction[] = [],
  equals?: FlagValue,
): ScriptAction => ({ type: 'ifFlag', key, equals, then, else: elseActions });

export const startDialogue = (treeId: string): ScriptAction => ({ type: 'startDialogue', treeId });

export const giveItem = (id: string): ScriptAction => ({ type: 'giveItem', id });

export const takeItem = (id: string): ScriptAction => ({ type: 'takeItem', id });

export const ifItem = (
  id: string,
  then: ScriptAction[],
  elseActions: ScriptAction[] = [],
): ScriptAction => ({ type: 'ifItem', id, then, else: elseActions });

export const playAnim = (actorId: string, anim: string): ScriptAction => ({ type: 'playAnim', actorId, anim });

export const wait = (ms: number): ScriptAction => ({ type: 'wait', ms });

export const enableHotspot = (id: string): ScriptAction => ({ type: 'enableHotspot', id });

export const disableHotspot = (id: string): ScriptAction => ({ type: 'disableHotspot', id });

export const enableExit = (id: string): ScriptAction => ({ type: 'enableExit', id });

export const disableExit = (id: string): ScriptAction => ({ type: 'disableExit', id });

export const gotoRoom = (roomId: string, spawn?: SpawnPoint): ScriptAction => ({
  type: 'gotoRoom',
  roomId,
  spawn,
});

export const awardAchievement = (id: string): ScriptAction => ({ type: 'awardAchievement', id });

export const moveActor = (
  actorId: string,
  x: number,
  y: number,
  opts: { speed?: number } = {},
): ScriptAction => ({ type: 'moveActor', actorId, x, y, speed: opts.speed });

export const spawnActor = (
  actorId: string,
  sheet: SpriteSheetDef,
  x: number,
  y: number,
  opts: { anim?: string; facing?: Facing } = {},
): ScriptAction => ({ type: 'spawnActor', actorId, sheet, x, y, anim: opts.anim, facing: opts.facing });

export const despawnActor = (actorId: string): ScriptAction => ({ type: 'despawnActor', actorId });

export const cameraPan = (fromX: number, toX: number, ms: number): ScriptAction => ({
  type: 'cameraPan',
  fromX,
  toX,
  ms,
});

export const fadeOut = (ms: number): ScriptAction => ({ type: 'fadeOut', ms });

export const fadeIn = (ms: number): ScriptAction => ({ type: 'fadeIn', ms });

export const setLetterbox = (on: boolean): ScriptAction => ({ type: 'setLetterbox', on });

export const musicCue = (id: string): ScriptAction => ({ type: 'musicCue', id });

export const sfxCue = (id: string): ScriptAction => ({ type: 'sfxCue', id });

export const playCutscene = (id: string): ScriptAction => ({ type: 'playCutscene', id });

export const killPlayer = (reason: string): ScriptAction => ({ type: 'killPlayer', reason });

export const autosave = (): ScriptAction => ({ type: 'autosave' });
