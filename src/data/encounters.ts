/**
 * Encounter registry (looked up by startCombat(id)). The junk golem is the
 * boss-phase demo: its phase table keeps enemy damage-taken at 25% until the
 * flag r00.golem_core is set (simulated here by the beforeTurn hook at round
 * three - real bosses set their flags from environmental puzzle actions).
 */

import {
  awardAchievement,
  despawnActor,
  disableHotspot,
  enableExit,
  giveItem,
  narrate,
  playCutscene,
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

/**
 * P15 set-piece: the digging-machine ambush outside the guild. The MACHINE
 * IS NOT A COMBATANT - it is spectacle in the intro text and the bracketing
 * cutscenes; a stat-check machine would wall a bare-handed level-1 Carl.
 * Two whelps, tuned to fall in 2-4 turns with no gear and no items.
 */
const goblinDiggers: EncounterDef = {
  id: 'goblin_diggers',
  enemies: ['goblin_whelp', 'goblin_whelp'],
  partyOverride: ['carl'],
  backdrop: 'backgrounds/combat_entrance.png',
  backdropLabel: 'FLOOR 1 CORRIDOR',
  backdropMood: 'dungeon',
  introText: 'THE MACHINE CIRCLES, SPIKES CHEWING WALL. ITS ESCORTS WANT THE KILL FOR THEMSELVES.',
  // P16 arrival: the steamroller drives in from the left with the whelps
  // riding it; they hop off into position and the machine idles in the
  // background of the composed scene (a prop, never a combatant).
  arrival: {
    kind: 'rollIn',
    from: 'left',
    props: ['steamroller'],
    ms: 1800,
    lines: [
      'The machine takes the corner on spiked wheels, bellowing steam, and parks itself across your exit like a verdict.',
      'The whelps hop down, rolling their shoulders. THE ESCORTS HAVE FILED FOR FIRST STRIKE. GRANTED.',
    ],
  },
  rewards: { xp: 30 },
  victoryScript: [playCutscene('act1_machine_wreck')],
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
// Act II part 1 - the maze
// ---------------------------------------------------------------------------

// Mandatory fight 1 (gates the R05 east door)
const mazeRats: EncounterDef = {
  id: 'maze_rats',
  enemies: ['tunnel_rat', 'tunnel_rat'],
  backdrop: 'backgrounds/combat_maze.png',
  backdropLabel: 'THE MAZE',
  backdropMood: 'dungeon',
  introText: 'TWO RATS. ONE CAT. THE MATH FAVORS THE CAT.',
  // P15 rebalance: 70 -> 55. The digging-machine fight adds +30 mandatory
  // xp in R03, so both maze fights shed 15 to keep every downstream level
  // breakpoint exactly where it was (140 total before the Hoarder).
  rewards: { xp: 55, gold: 10 },
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
  // P15 rebalance: 70 -> 55 (see maze_rats).
  rewards: { xp: 55, gold: 10 },
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
 * THE HOARDER - the first combat-puzzle hybrid, and the authoring template
 * for the War Chieftain (P8) and the Ball (P9):
 * - Base phase: enemyDamageTakenMult 0.15 - attacking blind barely scratches.
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
  // P16: cinematic boss transition; she ERUPTS from the trash with a shake.
  transitionKind: 'boss',
  arrival: {
    kind: 'burstIn',
    lines: ['The midden detonates outward. She was never beside the pile. She was wearing it.'],
  },
  introText: 'NEIGHBORHOOD BOSS: THE HOARDER. SHE HAS NEVER ONCE SHARED.',
  phases: [
    {
      when: { flag: 'hoarder:baited' },
      enemyDamageTakenMult: 1,
      announce: 'HER BACK IS TO THE TREASURE. NOW, CRAWLER. NOW.',
    },
    {
      // P15: 0.15 -> 0.25 - grinding head-on is slow but no longer a wall.
      enemyDamageTakenMult: 0.25,
      announce: 'SHE BARELY NOTICES YOU. HER EYES NEVER LEAVE THE PILE.',
    },
  ],
  beforeTurn: (ctx) => {
    // P15: the hint fires from ROUND ONE if the player charged in unbaited.
    if (ctx.round >= 1 && !ctx.state.getFlag('hoarder:baited')) {
      return 'DONUT: CARL. STOP HITTING IT. She only cares about SHINY things. Put something shiny on that pile and she will turn her back.';
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

// ---------------------------------------------------------------------------
// Act II part 2 - the goblin workshop
// ---------------------------------------------------------------------------

// Optional yard skirmish. Skippable entirely by asking Kivvi to wave the
// patrol off (flag goblin:covered disables the hotspot).
const goblinPatrol: EncounterDef = {
  id: 'goblin_patrol',
  enemies: ['goblin_scrapper', 'goblin_scrapper', 'goblin_stoker'],
  backdrop: 'backgrounds/combat_yard.png',
  backdropLabel: 'CHOPPER YARD',
  backdropMood: 'workshop',
  introText: 'THE PATROL OBJECTS TO YOUR EXISTENCE. STANDARD GOBLIN ONBOARDING.',
  rewards: { xp: 60, gold: 15 },
  victoryScript: [
    disableHotspot('patrol'),
    // 'covered' doubles as 'patrol resolved' so Kivvi's offer topic hides.
    setFlag('goblin:covered', true),
    narrate('The survivors bolt for the workshop, chittering your description. It is not flattering. It is not wrong.'),
  ],
};

/**
 * THE WAR CHIEFTAIN - puzzle-as-kill, authored as option (a): the DETONATION
 * cutscene kills him outright and grants all rewards by script; there is no
 * cleanup fight. This encounter exists ONLY as the head-on deterrent - the
 * phase table (Hoarder template) keeps him at 10% damage taken with the
 * System AI mocking the attempt, steering the player back to the puzzle.
 * Defeat is the normal recoverable death flow. (A 'chieftain:detonated'
 * phase is included for safety, but the door is gone after the blast, so
 * the fight is unreachable once the puzzle is solved.)
 */
const warChieftainLair: EncounterDef = {
  id: 'war_chieftain_lair',
  enemies: ['war_chieftain'],
  backdrop: 'backgrounds/combat_chieftain.png',
  backdropLabel: 'THE BOSS FLOOR',
  backdropMood: 'boss',
  noFlee: true,
  // P16: boss transition; he drops into frame filling the doorway.
  transitionKind: 'boss',
  arrival: {
    kind: 'dropIn',
    from: 'above',
    lines: ['A shape fills the door silhouette, blots it out, and lands hard enough to reorganize the anvils.'],
  },
  introText: 'NEIGHBORHOOD BOSS: THE WAR CHIEFTAIN. HE HAS BEEN LIFTING ANVILS FOR THIS.',
  phases: [
    {
      when: { flag: 'chieftain:detonated' },
      enemyDamageTakenMult: 1,
      announce: 'WHAT IS LEFT OF HIM DISAGREES WITH GRAVITY. FINISH IT.',
    },
    {
      enemyDamageTakenMult: 0.1,
      announce: 'YOUR WEAPONS BOUNCE. HE SMILES. THE ODDS BOARD STOPS TAKING BETS.',
    },
  ],
  beforeTurn: (ctx) => {
    if (ctx.round === 2 && !ctx.state.getFlag('chieftain:detonated')) {
      return 'THE AUDIENCE SUGGESTS: THIS IS A WORKSHOP FULL OF POWDER, CRAWLER. THINK LIKE AN ENGINEER.';
    }
    if (ctx.round >= 4 && !ctx.state.getFlag('chieftain:detonated')) {
      return 'DONUT: CARL. WE ARE LEAVING THE MOMENT YOU FINISH DYING.';
    }
  },
  rewards: { xp: 300, gold: 120 },
  victoryScript: [
    narrate('IMPOSSIBLE ODDS OVERCOME. THE DUNGEON DEMANDS A STEWARDS INQUIRY. THE AUDIENCE DEMANDS A REPLAY.'),
    awardAchievement('regime_change'),
    setFlag('chieftain:detonated', true),
  ],
};

// ---------------------------------------------------------------------------
// Act III - the gym and the ring
// ---------------------------------------------------------------------------

// Mandatory gym fight 1: Brandon and Yolanda ride along (4-member combat).
const gymLobby: EncounterDef = {
  id: 'gym_lobby',
  enemies: ['trog_brute', 'trog_brute', 'trog_howler'],
  partyOverride: ['carl', 'donut', 'brandon', 'yolanda'],
  backdrop: 'backgrounds/combat_gym.png',
  backdropLabel: 'PUMP CITY',
  backdropMood: 'workshop',
  introText: 'THE TROGS DEFEND THEIR GAINS. LITERALLY. THIS IS THEIR WHOLE THING.',
  rewards: { xp: 170, gold: 20 },
  victoryScript: [
    disableHotspot('mob1'),
    awardAchievement('gym_membership'),
    narrate('The cardio floor is yours. Yolanda retrieves her arrows with the efficiency of a woman who has counted them. All of them.'),
  ],
};

// Mandatory gym fight 2: Chris and Imani take the second shift.
const gymRacks: EncounterDef = {
  id: 'gym_racks',
  enemies: ['trog_brute', 'trog_brute', 'trog_howler', 'trog_howler'],
  partyOverride: ['carl', 'donut', 'chris', 'imani'],
  backdrop: 'backgrounds/combat_gym.png',
  backdropLabel: 'PUMP CITY',
  backdropMood: 'workshop',
  introText: 'THE RACK CAVE OBJECTS. THE FOREMAN HOWLS THE PAPERWORK.',
  rewards: { xp: 170, gold: 25 },
  victoryScript: [
    disableHotspot('mob2'),
    enableExit('east'),
    narrate('The racks fall quiet. Chris straightens his cap. Imani cleans her blade in one motion, which answers questions you did not ask.'),
  ],
};

/**
 * THE BALL - borough boss, the third boss pattern: TIME/PLACEMENT unlock.
 * Phase-gated like the Hoarder (flag phase) and the Chieftain (deterrent),
 * but the flag 'ball:derailed' is set by the act3_derail cutscene, which the
 * R16 bend hotspot only fires when the player has BOTH placed the rigged
 * barbell AND learned the lap timing (LOOK the Ball). Head-on while rolling
 * = 0.05 mult + mockery = recoverable steer-to-death. The raid itself is the
 * full six-fighter party and is meant to be WON at the trained level (~L6).
 */
const ballRing: EncounterDef = {
  id: 'ball_ring',
  enemies: ['the_ball', 'tuskling', 'tuskling'],
  partyOverride: ['carl', 'donut', 'brandon', 'chris', 'yolanda', 'imani'],
  backdrop: 'backgrounds/combat_ring.png',
  backdropLabel: 'THE RING',
  backdropMood: 'boss',
  noFlee: true,
  // P16: boss transition; it is ALREADY rolling - lean into it.
  transitionKind: 'boss',
  arrival: {
    kind: 'rollIn',
    from: 'right',
    ms: 1400,
    lines: ['You hear it before you see it: a landslide with table manners, taking the bend at speed.'],
  },
  introText: 'BOROUGH BOSS: THE BALL. FORTY KNIGHTS, ONE OPINION, NO BRAKES.',
  phases: [
    {
      when: { flag: 'ball:derailed' },
      enemyDamageTakenMult: 1,
      announce: 'IT IS OFF THE RAIL AND FURIOUS ABOUT PHYSICS. THE WINDOW IS OPEN, CRAWLERS.',
    },
    {
      enemyDamageTakenMult: 0.05,
      announce: 'IT IS STILL ROLLING. YOU ARE FIGHTING A COMMUTE. THE DUNGEON SUGGESTS ENGINEERING.',
    },
  ],
  beforeTurn: (ctx) => {
    if (ctx.round === 2 && !ctx.state.getFlag('ball:derailed')) {
      return 'DONUT: THE PLAN, CARL. THE BEND, THE IRON, THE COUNT. WE REHEARSED THIS SET.';
    }
  },
  rewards: { xp: 400, gold: 250, items: ['tusk_crown', 'healing_salve'] },
  victoryScript: [
    setFlag('ball:defeated', true),
    awardAchievement('derailed'),
    narrate('The Ball comes apart into knights and ladies who are, at last, allowed to stop. The ring falls silent for the first time in a season.'),
    despawnActor('ball'),
    disableHotspot('ball'),
    disableHotspot('the_bend'),
    disableHotspot('the_straight'),
    enableExit('east'),
    narrate('BOROUGH BOSS ELIMINATED. THE PLATFORM IS OPEN. THE STAIRS ARE LISTED AS: FINALLY.'),
  ],
};

export const encounters: Record<string, EncounterDef> = {
  [scrapPit.id]: scrapPit,
  [junkGolemLair.id]: junkGolemLair,
  [firstBlood.id]: firstBlood,
  [goblinDiggers.id]: goblinDiggers,
  [mazeRats.id]: mazeRats,
  [mazePack.id]: mazePack,
  [mazeNest.id]: mazeNest,
  [hoarderLair.id]: hoarderLair,
  [goblinPatrol.id]: goblinPatrol,
  [warChieftainLair.id]: warChieftainLair,
  [gymLobby.id]: gymLobby,
  [gymRacks.id]: gymRacks,
  [ballRing.id]: ballRing,
};
