/**
 * Encounter registry (looked up by startCombat(id)). The junk golem is the
 * boss-phase demo: its phase table keeps enemy damage-taken at 25% until the
 * flag r00.golem_core is set (simulated here by the beforeTurn hook at round
 * three — real bosses set their flags from environmental puzzle actions).
 */

import { narrate } from './script';
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

export const encounters: Record<string, EncounterDef> = {
  [scrapPit.id]: scrapPit,
  [junkGolemLair.id]: junkGolemLair,
  [firstBlood.id]: firstBlood,
};
