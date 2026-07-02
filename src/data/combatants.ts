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
    color: '#8a6242',
    sprite: 'sprites/carl.png',
    outfit: { torso: '#6e4f33', head: '#e0aa80', legs: '#d8a078', feet: '#ff8ab4' },
    stats: { maxHp: 34, hp: 34, str: 6, dex: 5, con: 5, int: 3, spd: 5, maxMp: 6, mp: 6 },
    skills: ['cudgel_crack'],
    learnset: { 2: ['bomb_toss'] },
  },
  donut: {
    id: 'donut',
    name: 'PRINCESS DONUT',
    color: '#e3cfa8',
    sprite: 'sprites/donut.png',
    outfit: {
      torso: '#e3cfa8',
      head: '#efe0c0',
      patches: ['#3a332c', '#f6f0e2', '#a2703c'],
      crown: true,
    },
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
  // --- The Meadow Lark raid crew (Act III allies; levels via shared pool) ---
  brandon: {
    id: 'brandon',
    name: 'BRANDON',
    color: '#5a8ac4',
    sprite: 'sprites/brandon_an.png',
    stats: { maxHp: 30, hp: 30, str: 6, dex: 5, con: 6, int: 5, spd: 5, maxMp: 8, mp: 8 },
    skills: ['rally_cry'],
  },
  chris: {
    id: 'chris',
    name: 'CHRIS',
    color: '#8a92a8',
    sprite: 'sprites/chris_andrews.png',
    stats: { maxHp: 28, hp: 28, str: 6, dex: 4, con: 7, int: 4, spd: 4 },
    skills: ['skull_knock'],
  },
  yolanda: {
    id: 'yolanda',
    name: 'YOLANDA',
    color: '#c4785a',
    sprite: 'sprites/yolanda_martinez.png',
    stats: { maxHp: 26, hp: 26, str: 7, dex: 7, con: 4, int: 5, spd: 6 },
    skills: ['pin_cushion'],
  },
  imani: {
    id: 'imani',
    name: 'IMANI',
    color: '#7a5ac4',
    sprite: 'sprites/imani_c.png',
    stats: { maxHp: 26, hp: 26, str: 8, dex: 7, con: 4, int: 5, spd: 7 },
    skills: ['quiet_edge'],
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
  // P10 rebalance: hp 10 -> 8, str 3 -> 2 (mandatory fights forgiving).
  tunnel_rat: {
    id: 'tunnel_rat',
    name: 'TUNNEL RAT',
    color: '#8f8073',
    sprite: 'sprites/tunnel_rat.png',
    stats: { maxHp: 8, hp: 8, str: 2, dex: 3, con: 2, int: 1, spd: 5 },
    skills: [],
    xpReward: 30,
    ai: 'basic',
  },
  // Neighborhood boss: near-invulnerable until baited (phase table on the
  // encounter). P10 rebalance: hp 70 -> 52, str 9 -> 8, con 9 -> 8 - once
  // baited the fight resolves in ~4-5 rounds instead of grinding.
  hoarder: {
    id: 'hoarder',
    name: 'THE HOARDER',
    color: '#7a9a5a',
    sprite: 'sprites/hoarder.png',
    stats: { maxHp: 52, hp: 52, str: 8, dex: 3, con: 8, int: 2, spd: 3 },
    skills: ['trash_slam', 'garbage_avalanche'],
    xpReward: 120,
    ai: 'boss',
  },
  // P10 rebalance: hp 14 -> 12, str 4 -> 3.
  scuttler: {
    id: 'scuttler',
    name: 'SCUTTLER',
    color: '#b0d06a',
    sprite: 'sprites/scuttler.png',
    stats: { maxHp: 12, hp: 12, str: 3, dex: 4, con: 3, int: 1, spd: 6 },
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
  // --- Act II part 2: the workshop clan ---
  goblin_scrapper: {
    id: 'goblin_scrapper',
    name: 'GOBLIN SCRAPPER',
    color: '#8fb05a',
    sprite: 'sprites/goblin_scrapper.png',
    stats: { maxHp: 16, hp: 16, str: 5, dex: 5, con: 3, int: 3, spd: 6 },
    skills: [],
    xpReward: 30,
    ai: 'basic',
  },
  goblin_stoker: {
    id: 'goblin_stoker',
    name: 'GOBLIN STOKER',
    color: '#c98a4a',
    sprite: 'sprites/goblin_stoker.png',
    stats: { maxHp: 14, hp: 14, str: 4, dex: 4, con: 3, int: 6, spd: 5, maxMp: 8, mp: 8 },
    skills: ['ember_spit'],
    xpReward: 30,
    ai: 'caster',
  },
  // Neighborhood boss #2. Not meant to be fought: the workshop IS the weapon
  // (phase table on the encounter keeps head-on attempts hopeless).
  war_chieftain: {
    id: 'war_chieftain',
    name: 'THE WAR CHIEFTAIN',
    color: '#b0623a',
    sprite: 'sprites/war_chieftain.png',
    stats: { maxHp: 90, hp: 90, str: 12, dex: 5, con: 10, int: 3, spd: 4 },
    skills: ['skullsplitter', 'dread_bellow'],
    xpReward: 300,
    ai: 'boss',
  },
  // --- Act III: the gym and the ring ---
  trog_brute: {
    id: 'trog_brute',
    name: 'TROG BRUTE',
    color: '#7a8a5a',
    sprite: 'sprites/trog_brute.png',
    stats: { maxHp: 24, hp: 24, str: 8, dex: 4, con: 6, int: 1, spd: 4 },
    skills: [],
    xpReward: 40,
    ai: 'basic',
  },
  trog_howler: {
    id: 'trog_howler',
    name: 'TROG HOWLER',
    color: '#9a7a4a',
    sprite: 'sprites/trog_howler.png',
    stats: { maxHp: 18, hp: 18, str: 5, dex: 5, con: 4, int: 6, spd: 6, maxMp: 8, mp: 8 },
    skills: ['dread_bellow'],
    xpReward: 45,
    ai: 'caster',
  },
  tuskling: {
    id: 'tuskling',
    name: 'TUSKLING',
    color: '#d8c8b8',
    sprite: 'sprites/tuskling.png',
    stats: { maxHp: 22, hp: 22, str: 7, dex: 5, con: 5, int: 2, spd: 6 },
    skills: [],
    xpReward: 50,
    ai: 'basic',
  },
  // Borough boss: only vulnerable while derailed (phase table on the encounter).
  the_ball: {
    id: 'the_ball',
    name: 'THE BALL',
    color: '#e8a4b0',
    sprite: 'sprites/the_ball.png',
    // Pink fused flesh studded with steel plate.
    outfit: { patches: ['#8f939c', '#d8dbe0', '#c87884'] },
    stats: { maxHp: 150, hp: 150, str: 13, dex: 5, con: 12, int: 2, spd: 12 },
    skills: ['flatten', 'tusk_gore'],
    xpReward: 400,
    ai: 'boss',
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
