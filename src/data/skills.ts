/**
 * Skill registry. Skills always hit; damage = (power + scaling stat) ± 10%
 * − target defense. Ally-targeted skills with power heal instead. Statuses
 * are embedded StatusEffect templates (see types.ts for tick semantics).
 */

import type { SkillDef } from './types';

export const skills: Record<string, SkillDef> = {
  // --- Carl ---
  cudgel_crack: {
    id: 'cudgel_crack',
    name: 'CUDGEL CRACK',
    cooldown: 3,
    target: 'enemy',
    power: 5,
    scaling: 'str',
    effect: { id: 'stun', name: 'STUNNED', kind: 'stun', duration: 1, magnitude: 0 },
    description: 'A skull-forward argument. Stuns the target for a turn.',
  },
  bomb_toss: {
    id: 'bomb_toss',
    name: 'BOMB TOSS',
    cooldown: 2,
    target: 'allEnemies',
    power: 8,
    scaling: 'str',
    description: 'Improvised explosive, professionally delivered. Hits everything.',
  },
  // --- Donut (and the test ally borrows the same data) ---
  magic_missile: {
    id: 'magic_missile',
    name: 'MAGIC MISSILE',
    mpCost: 3,
    target: 'enemy',
    power: 6,
    description: 'A single unerring bolt. The classic.',
  },
  missile_storm: {
    id: 'missile_storm',
    name: 'MISSILE STORM',
    mpCost: 6,
    target: 'allEnemies',
    power: 5,
    description: 'All of the bolts. At all of the problems.',
  },
  jeer: {
    id: 'jeer',
    name: 'WITHERING JEER',
    mpCost: 2,
    target: 'enemy',
    effect: { id: 'atk_down', name: 'ATK DOWN', kind: 'debuff', duration: 3, magnitude: 3, stat: 'attack' },
    description: 'An insult so precise the target hits softer for a while.',
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'SHIELD WALL',
    mpCost: 3,
    target: 'allAllies',
    effect: { id: 'def_up', name: 'DEF UP', kind: 'buff', duration: 2, magnitude: 3, stat: 'defense' },
    description: 'Everyone hides behind the idea of a shield. It works.',
  },
  mend: {
    id: 'mend',
    name: 'MEND',
    mpCost: 4,
    target: 'ally',
    power: 10,
    description: 'Stitches a party member back together. Mostly in the right order.',
  },
  // --- Enemies ---
  ember_spit: {
    id: 'ember_spit',
    name: 'EMBER SPIT',
    mpCost: 2,
    target: 'enemy',
    power: 3,
    effect: { id: 'burn', name: 'BURNING', kind: 'burn', duration: 3, magnitude: 2 },
    description: 'Flaming saliva. The dungeon is very proud of this one.',
  },
  shrapnel_rake: {
    id: 'shrapnel_rake',
    name: 'SHRAPNEL RAKE',
    cooldown: 3,
    target: 'enemy',
    power: 6,
    scaling: 'str',
    effect: { id: 'bleed', name: 'BLEEDING', kind: 'bleed', duration: 3, magnitude: 2 },
    description: 'Rusty edges at speed. Leaves a bleed.',
  },
  dread_bellow: {
    id: 'dread_bellow',
    name: 'DREAD BELLOW',
    cooldown: 4,
    target: 'allEnemies',
    effect: { id: 'fear', name: 'AFRAID', kind: 'fear', duration: 2, magnitude: 0 },
    description: 'A sound with opinions about your survival.',
  },
};
