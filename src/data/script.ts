/**
 * The script DSL: a declarative ScriptAction union plus tiny builder
 * functions for authoring. All game content (hotspot responses, dialogue,
 * cutscenes) is expressed as ScriptAction[] and executed by the engine's
 * ScriptRunner. This module is pure data constructors — no engine imports —
 * so room definitions can use it freely.
 */

import type { Facing, FlagValue, SpawnPoint } from './types';

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
  /** Narrator box (and an `ach:<id>` flag) until the real system arrives. */
  | { type: 'awardAchievement'; id: string };

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
