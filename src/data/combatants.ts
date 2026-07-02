/**
 * Combatant registry: party members and enemies share one shape. Party
 * members level with the shared XP pool (+1 all core stats, +6 maxHp,
 * +3 maxMp per level) and unlock skills via their learnset.
 */

import type { CombatantDef } from './types';

export const combatants: Record<string, CombatantDef> = {
  // --- Party ---
  carl: {
    id: 'carl',
    name: 'CARL',
    color: '#f2a65a',
    sprite: 'sprites/carl.png',
    stats: { maxHp: 34, hp: 34, str: 6, dex: 5, con: 5, int: 3, spd: 5, maxMp: 6, mp: 6 },
    skills: ['cudgel_crack'],
    learnset: { 2: ['bomb_toss'] },
  },
  donut: {
    id: 'donut',
    name: 'PRINCESS DONUT',
    color: '#ff8ad8',
    sprite: 'sprites/donut.png',
    stats: { maxHp: 24, hp: 24, str: 3, dex: 7, con: 3, int: 8, spd: 8, maxMp: 12, mp: 12 },
    skills: ['magic_missile'],
    learnset: { 2: ['missile_storm'], 3: ['jeer'] },
  },
  // Test ally for P5 demos (borrows the caster skill data Donut uses)
  brogan: {
    id: 'brogan',
    name: 'BROGAN',
    color: '#8fb2e0',
    sprite: 'sprites/brogan.png',
    stats: { maxHp: 30, hp: 30, str: 5, dex: 4, con: 6, int: 6, spd: 4, maxMp: 10, mp: 10 },
    skills: ['shield_wall', 'magic_missile', 'jeer', 'mend'],
    learnset: { 2: ['missile_storm'] },
  },
  // --- Enemies ---
  // Tutorial enemy: dies in one or two bare-handed hits, threatens nothing.
  lint_mite: {
    id: 'lint_mite',
    name: 'LINT MITE',
    color: '#c9c2a6',
    sprite: 'sprites/lint_mite.png',
    stats: { maxHp: 6, hp: 6, str: 2, dex: 2, con: 2, int: 1, spd: 2 },
    skills: [],
    xpReward: 30,
    ai: 'basic',
  },
  tunnel_rat: {
    id: 'tunnel_rat',
    name: 'TUNNEL RAT',
    color: '#8f8073',
    sprite: 'sprites/tunnel_rat.png',
    stats: { maxHp: 10, hp: 10, str: 3, dex: 3, con: 2, int: 1, spd: 5 },
    skills: [],
    xpReward: 30,
    ai: 'basic',
  },
  // Neighborhood boss: near-invulnerable until baited (phase table on the encounter)
  hoarder: {
    id: 'hoarder',
    name: 'THE HOARDER',
    color: '#7a9a5a',
    sprite: 'sprites/hoarder.png',
    stats: { maxHp: 70, hp: 70, str: 9, dex: 3, con: 9, int: 2, spd: 3 },
    skills: ['trash_slam', 'garbage_avalanche'],
    xpReward: 120,
    ai: 'boss',
  },
  scuttler: {
    id: 'scuttler',
    name: 'SCUTTLER',
    color: '#b0d06a',
    sprite: 'sprites/scuttler.png',
    stats: { maxHp: 14, hp: 14, str: 4, dex: 4, con: 3, int: 1, spd: 6 },
    skills: [],
    xpReward: 40,
    ai: 'basic',
  },
  ember_rat: {
    id: 'ember_rat',
    name: 'EMBER RAT',
    color: '#e07a4f',
    sprite: 'sprites/ember_rat.png',
    stats: { maxHp: 12, hp: 12, str: 3, dex: 5, con: 2, int: 5, spd: 7, maxMp: 8, mp: 8 },
    skills: ['ember_spit'],
    xpReward: 40,
    ai: 'caster',
  },
  junk_golem: {
    id: 'junk_golem',
    name: 'JUNK GOLEM',
    color: '#9a8f7a',
    sprite: 'sprites/junk_golem.png',
    stats: { maxHp: 48, hp: 48, str: 8, dex: 3, con: 8, int: 2, spd: 3 },
    skills: ['shrapnel_rake', 'dread_bellow'],
    xpReward: 100,
    ai: 'boss',
  },
};
