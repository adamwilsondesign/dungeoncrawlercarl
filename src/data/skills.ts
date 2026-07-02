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
  // --- Donut, story-unlocked in R08 ---
  claw_flurry: {
    id: 'claw_flurry',
    name: 'CLAW FLURRY',
    cooldown: 2,
    target: 'enemy',
    power: 9,
    scaling: 'str',
    description: 'Eighteen razors, royal provenance, no mana required.',
  },
  // --- The Meadow Lark raid crew (signature moves) ---
  rally_cry: {
    id: 'rally_cry',
    name: 'RALLY CRY',
    mpCost: 3,
    target: 'allAllies',
    effect: { id: 'atk_up', name: 'ATK UP', kind: 'buff', duration: 3, magnitude: 2, stat: 'attack' },
    description: 'Night-shift steadiness, out loud. Everybody hits a little harder.',
  },
  skull_knock: {
    id: 'skull_knock',
    name: 'SKULL KNOCK',
    cooldown: 3,
    target: 'enemy',
    power: 6,
    scaling: 'str',
    effect: { id: 'stun', name: 'STUNNED', kind: 'stun', duration: 1, magnitude: 0 },
    description: 'The metal cap is not decorative. Stuns the target.',
  },
  pin_cushion: {
    id: 'pin_cushion',
    name: 'PIN CUSHION',
    cooldown: 2,
    target: 'enemy',
    power: 8,
    scaling: 'str',
    description: 'Three arrows before the first one lands. The quiver never seems lighter.',
  },
  quiet_edge: {
    id: 'quiet_edge',
    name: 'QUIET EDGE',
    cooldown: 2,
    target: 'enemy',
    power: 12,
    scaling: 'str',
    description: 'One clean line, no announcement. She has done this more than she says.',
  },
  // --- The Ball ---
  flatten: {
    id: 'flatten',
    name: 'FLATTEN',
    cooldown: 3,
    target: 'allEnemies',
    power: 5,
    scaling: 'str',
    description: 'The whole mass shrugs through the party at once.',
  },
  tusk_gore: {
    id: 'tusk_gore',
    name: 'TUSK GORE',
    cooldown: 2,
    target: 'enemy',
    power: 9,
    scaling: 'str',
    description: 'A dozen fused tusks agree on one target.',
  },
  // --- The War Chieftain ---
  skullsplitter: {
    id: 'skullsplitter',
    name: 'SKULLSPLITTER',
    cooldown: 2,
    target: 'enemy',
    power: 10,
    scaling: 'str',
    description: 'A hammer the size of a door, applied like a stamp.',
  },
  // --- The Hoarder ---
  trash_slam: {
    id: 'trash_slam',
    name: 'TRASH SLAM',
    cooldown: 2,
    target: 'enemy',
    power: 7,
    scaling: 'str',
    description: 'A compacted century of garbage, applied directly.',
  },
  garbage_avalanche: {
    id: 'garbage_avalanche',
    name: 'GARBAGE AVALANCHE',
    cooldown: 4,
    target: 'allEnemies',
    power: 4,
    scaling: 'str',
    description: 'The pile fights back. All of it. At once.',
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
