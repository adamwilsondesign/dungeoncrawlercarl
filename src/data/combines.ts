/**
 * Item-combining registry (the P3-planned addition, built in P8). Keys are
 * the two item ids in sorted order joined with '+', so a+b and b+a resolve
 * identically. A match either runs its `script` through the normal
 * ScriptRunner (full DSL access: narrates, flags, even killPlayer for
 * catastrophic chemistry), or — when only `result` is given — the scene
 * runs the default script: takeItem(a) + takeItem(b) + giveItem(result).
 * No match: the scene shows an in-voice "those don't combine" line.
 */

import { giveItem, killPlayer, narrate, setFlag, takeItem, type ScriptAction } from './script';

export interface CombineDef {
  /** Simple recipe: consume both inputs, produce this item. */
  result?: string;
  /** Full control: the scene runs this instead of the default recipe. */
  script?: ScriptAction[];
}

/** Normalized registry key: order-independent. */
export function combineKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

export const combines: Record<string, CombineDef> = {
  // --- The workshop chain reaction, step 1: powder + fuse = a charge ---
  [combineKey('black_powder', 'fuse_wick')]: {
    script: [
      takeItem('black_powder'),
      takeItem('fuse_wick'),
      giveItem('powder_charge'),
      narrate('You seat the wick in the keg and tamp it with professional calm. CRAFTING DETECTED. THE AUDIENCE LEANS IN.'),
    ],
  },
  // --- Step 2: charge + grease = slow, hot, reliable ---
  [combineKey('powder_charge', 'chopper_grease')]: {
    script: [
      takeItem('powder_charge'),
      takeItem('chopper_grease'),
      giveItem('primed_charge'),
      narrate('You slather the charge in engine grease. Now it burns slow, hot, and personal. Somewhere, an insurance instrument screams.'),
      setFlag('r10.charge_built', true),
    ],
  },
  // --- Catastrophic chemistry: sparks over a keg you are HOLDING ---
  [combineKey('black_powder', 'flint_striker')]: {
    script: [
      narrate('You strike sparks directly over the open keg in your arms. A bold fusion of confidence and physics.'),
      killPlayer('CAUSE OF DEATH: QUALITY CONTROL. The powder worked perfectly. That was the problem.'),
    ],
  },
  [combineKey('flint_striker', 'powder_charge')]: {
    script: [
      narrate('You test the striker an inch above the fresh charge. It passes the test. You do not.'),
      killPlayer('CAUSE OF DEATH: PREMATURE CELEBRATION. The fuse was for LATER, Crawler.'),
    ],
  },
  [combineKey('flint_striker', 'primed_charge')]: {
    script: [
      narrate('Sparks meet grease-slicked powder at hugging distance. The chemistry is excellent. The choreography is not.'),
      killPlayer('CAUSE OF DEATH: IMPATIENCE, DELUXE EDITION. Delivery FIRST. Ignition SECOND.'),
    ],
  },
  // --- Flavor non-answers that teach the grammar without solving anything ---
  [combineKey('fuse_wick', 'healing_salve')]: {
    script: [
      narrate('You rub medicine on a fuse. The fuse feels nothing. It is a fuse. THE DUNGEON RESPECTS THE OPTIMISM.'),
    ],
  },
  [combineKey('chopper_grease', 'healing_salve')]: {
    script: [
      narrate('Two ointments enter. No ointment leaves improved. Some frontiers were never meant to be crossed.'),
    ],
  },
};
