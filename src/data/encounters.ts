/**
 * Encounter registry (looked up by startCombat(id)). The junk golem is the
 * boss-phase demo: its phase table keeps enemy damage-taken at 25% until the
 * flag r00.golem_core is set (simulated here by the beforeTurn hook at round
 * three — real bosses set their flags from environmental puzzle actions).
 */

import {
  awardAchievement,
  despawnActor,
  disableHotspot,
  enableExit,
  giveItem,
  narrate,
  setFlag,
} from './script';
import type { EncounterDef } from './types';

const scrapPit: EncounterDef = {
  id: 'scrap_pit',
  enemies: ['scuttler', 'scuttler', 'ember_rat'],
  partyOverride: ['carl', 'brogan'],
  backdrop: 'backgrounds/combat_scrap.png',
  backdropLabel: 'SCRAP PIT',
  backdropMood: 'boss',
  introText: 'THE NEST EMPTIES. IT IS NOT HAPPY ABOUT THE POKING.',
  rewards: { xp: 120, gold: 15, items: ['goblin_bomb'] },
  victoryScript: [
    narrate('The nest is quiet. The audience awards the standard survival applause: brief, obligatory.'),
  ],
};

const junkGolemLair: EncounterDef = {
  id: 'junk_golem_lair',
  enemies: ['junk_golem'],
  partyOverride: ['carl', 'brogan'],
  backdrop: 'backgrounds/combat_golem.png',
  backdropLabel: 'GOLEM DEN',
  backdropMood: 'boss',
  noFlee: true,
  introText: 'THE JUNK HEAP STANDS UP. IT HAS ALWAYS BEEN STANDING UP.',
  rewards: { xp: 100, gold: 30, items: ['lint_charm'] },
  phases: [
    {
      when: { flag: 'r00.golem_core' },
      enemyDamageTakenMult: 1,
      announce: 'THE CORE IS EXPOSED! THE GOLEM IS VULNERABLE!',
    },
    {
      enemyDamageTakenMult: 0.25,
      announce: 'SCRAP PLATING DEFLECTS EVERYTHING. FIND AN OPENING.',
    },
  ],
  beforeTurn: (ctx) => {
    // Simulated environmental unlock: the real bosses set this flag from a
    // puzzle action (bait, sabotage, etc). Here a panel opens on round 3.
    if (ctx.round >= 3 && !ctx.state.getFlag('r00.golem_core')) {
      ctx.state.setFlag('r00.golem_core', true);
      return 'A PANEL GRINDS OPEN ON THE GOLEM.';
    }
  },
  victoryScript: [
    narrate('The golem collapses into ordinary garbage. Somewhere, a loot table sighs with relief.'),
  ],
};

// Act I tutorial fight: Carl solo, bare hands, unmissable-easy. The intro
// text doubles as the combat UI lesson.
const firstBlood: EncounterDef = {
  id: 'first_blood',
  enemies: ['lint_mite'],
  partyOverride: ['carl'],
  backdrop: 'backgrounds/combat_entrance.png',
  backdropLabel: 'FLOOR 1 CORRIDOR',
  backdropMood: 'dungeon',
  introText: 'YOUR FIRST FIGHT. PICK AN ACTION FROM THE MENU. THE MITE WILL WAIT. PROBABLY.',
  rewards: { xp: 30 },
  victoryScript: [
    narrate('FIRST BLOOD, CRAWLER. The audience notes it was against a dust mite. The audience notes it anyway.'),
  ],
};

// ---------------------------------------------------------------------------
// Act II part 1 — the maze
// ---------------------------------------------------------------------------

// Mandatory fight 1 (gates the R05 east door)
const mazeRats: EncounterDef = {
  id: 'maze_rats',
  enemies: ['tunnel_rat', 'tunnel_rat'],
  backdrop: 'backgrounds/combat_maze.png',
  backdropLabel: 'THE MAZE',
  backdropMood: 'dungeon',
  introText: 'TWO RATS. ONE CAT. THE MATH FAVORS THE CAT.',
  rewards: { xp: 60, gold: 10 },
  victoryScript: [
    disableHotspot('mob1'),
    enableExit('east'),
    awardAchievement('blooded'),
    narrate('The scratching stops. The corridor east unclenches. THE AUDIENCE RATES YOUR FORM: ADEQUATE.'),
  ],
};

// Mandatory fight 2 (gates the R05b exit toward the Hoarder)
const mazePack: EncounterDef = {
  id: 'maze_pack',
  enemies: ['tunnel_rat', 'tunnel_rat', 'scuttler'],
  backdrop: 'backgrounds/combat_maze.png',
  backdropLabel: 'THE MAZE',
  backdropMood: 'dungeon',
  introText: 'THE HEAP WAS OCCUPIED. IT IS ABOUT TO BE VACANT.',
  rewards: { xp: 60, gold: 10 },
  victoryScript: [
    disableHotspot('mob2'),
    enableExit('east'),
    narrate('The pack scatters into the walls. The way toward the smell - and it is a considerable smell - stands open.'),
  ],
};

// Optional over-leveling fight (repeatable; the nest refills)
const mazeNest: EncounterDef = {
  id: 'maze_nest',
  enemies: ['ember_rat', 'ember_rat'],
  backdrop: 'backgrounds/combat_maze.png',
  backdropLabel: 'THE MAZE',
  backdropMood: 'dungeon',
  introText: 'OPTIONAL VIOLENCE DETECTED. THE AUDIENCE APPRECIATES AN OVERACHIEVER.',
  rewards: { xp: 60, items: ['healing_salve'] },
  victoryScript: [
    narrate('The nest empties. Give it an hour and something worse will move in. The dungeon calls this PROPERTY TURNOVER.'),
  ],
};

/**
 * THE HOARDER — the first combat-puzzle hybrid, and the authoring template
 * for the War Chieftain (P8) and the Ball (P9):
 * - Base phase: enemyDamageTakenMult 0.15 — attacking blind barely scratches.
 * - Gated phase: when flag 'hoarder:baited' is set (by USING the polished
 *   hubcap on her treasure midden in R06, pre-fight), damage is full.
 * - beforeTurn nags the hint from round 3 if the player charged in unbaited.
 * The bait flag is set OUTSIDE combat, so phases work whether the player
 * baits first (fight opens vulnerable) or realizes mid-wipe and dies once
 * (death restores the room-entry autosave; the bait resets with it).
 */
const hoarderLair: EncounterDef = {
  id: 'hoarder_lair',
  enemies: ['hoarder'],
  backdrop: 'backgrounds/combat_hoarder.png',
  backdropLabel: 'THE LAIR',
  backdropMood: 'boss',
  noFlee: true,
  introText: 'NEIGHBORHOOD BOSS: THE HOARDER. SHE HAS NEVER ONCE SHARED.',
  phases: [
    {
      when: { flag: 'hoarder:baited' },
      enemyDamageTakenMult: 1,
      announce: 'HER BACK IS TO THE TREASURE. NOW, CRAWLER. NOW.',
    },
    {
      enemyDamageTakenMult: 0.15,
      announce: 'SHE BARELY NOTICES YOU. HER EYES NEVER LEAVE THE PILE.',
    },
  ],
  beforeTurn: (ctx) => {
    if (ctx.round >= 3 && !ctx.state.getFlag('hoarder:baited')) {
      return 'DONUT: CARL. SHE ONLY CARES ABOUT SHINY THINGS. USE YOUR HEAD.';
    }
  },
  rewards: { xp: 120, gold: 40, items: ['healing_salve'] },
  victoryScript: [
    setFlag('map:neighborhood', true),
    giveItem('neighborhood_map'),
    narrate('MINIMAP DATA ABSORBED. THE NEIGHBORHOOD IS NOW LABELED. MOST LABELS ARE WARNINGS.'),
    awardAchievement('trash_taker'),
    despawnActor('hoarder'),
    disableHotspot('hoarder'),
    enableExit('east'),
    narrate('The pile settles into ordinary garbage. Somewhere beneath it, a burger sign flickers on.'),
  ],
};

export const encounters: Record<string, EncounterDef> = {
  [scrapPit.id]: scrapPit,
  [junkGolemLair.id]: junkGolemLair,
  [firstBlood.id]: firstBlood,
  [mazeRats.id]: mazeRats,
  [mazePack.id]: mazePack,
  [mazeNest.id]: mazeNest,
  [hoarderLair.id]: hoarderLair,
};
