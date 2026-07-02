/**
 * Procedural character art registry (the art-pass upgrade). Every entry is
 * keyed by the SAME asset path / character id a painted file would use, so
 * dropping real art at sprites/<id>.png or ui/portrait_<char>_<expr>.png
 * overrides these with zero code changes.
 *
 * SpriteDesign drives the sheet generator in engine/assets.ts through a
 * small set of body plans; PortraitDesign drives the drawn dialogue faces.
 */

export type BodyPlan = 'human' | 'cat' | 'small' | 'bulky' | 'critter' | 'sphere';

export interface SpriteDesign {
  plan: BodyPlan;
  /** Skin / fur / hide base. */
  skin: string;
  torso: string;
  legs?: string;
  feet?: string;
  hair?: string;
  hairStyle?: 'messy' | 'short' | 'bald' | 'skullcap' | 'trapper' | 'ponytail';
  hatColor?: string;
  ears?: 'cat' | 'rat' | 'goblin' | 'round';
  /** Fur mottling or armor plating blobs. */
  patches?: string[];
  crown?: boolean;
  cloak?: string;
  weapon?: 'bow' | 'sword' | 'club' | 'wrench' | 'spear';
  /** Oversized quiver on the back (one very specific archer). */
  quiver?: boolean;
  tusks?: boolean;
  /** Scruffy body hair / grime flecks over the torso. */
  scruff?: string;
}

const TORTIE = ['#3a332c', '#f6f0e2', '#a2703c'];

export const spriteDesigns: Record<string, SpriteDesign> = {
  // --- Leads ---
  'sprites/carl.png': {
    plan: 'human',
    skin: '#e0aa80',
    hair: '#2e241c',
    hairStyle: 'messy',
    torso: '#6e4f33',
    legs: '#d8a078', // bare legs
    feet: '#ff8ab4', // the Crocs
  },
  'sprites/donut_cat.png': {
    plan: 'cat',
    skin: '#e3cfa8',
    torso: '#e3cfa8',
    ears: 'cat',
    patches: TORTIE,
  },
  'sprites/donut.png': {
    plan: 'cat',
    skin: '#e3cfa8',
    torso: '#e3cfa8',
    ears: 'cat',
    patches: TORTIE,
    crown: true,
  },
  // --- Act I ---
  'sprites/mordecai.png': {
    plan: 'human',
    skin: '#9a8a72',
    hair: '#6e604c',
    hairStyle: 'bald',
    ears: 'rat',
    torso: '#5c4a30',
    legs: '#43361f',
    feet: '#33280e',
    scruff: '#7d6e56',
  },
  'sprites/npc.png': {
    plan: 'human',
    skin: '#d8a078',
    hair: '#4a3a26',
    hairStyle: 'short',
    torso: '#4e6e5a',
    legs: '#3a4a52',
    feet: '#2c3138',
  },
  'sprites/brogan.png': {
    plan: 'human',
    skin: '#c9a082',
    hair: '#8a6a3a',
    hairStyle: 'short',
    torso: '#4a6a94',
    legs: '#374a5c',
    feet: '#2c3138',
    weapon: 'club',
  },
  // --- Act II ---
  'sprites/tally.png': {
    plan: 'small',
    skin: '#c9a082',
    hair: '#6e604c',
    hairStyle: 'bald',
    ears: 'round',
    torso: '#9a8f72',
    legs: '#6e6450',
    feet: '#4a4238',
    scruff: '#7d6e56',
  },
  'sprites/hoarder.png': {
    plan: 'bulky',
    skin: '#7a9a5a',
    torso: '#5c6e3a',
    patches: ['#4a552c', '#8a7a4a', '#3d4426'],
    scruff: '#43502a',
  },
  'sprites/hoarder_large.png': {
    plan: 'bulky',
    skin: '#7a9a5a',
    torso: '#5c6e3a',
    patches: ['#4a552c', '#8a7a4a', '#3d4426'],
    scruff: '#43502a',
  },
  'sprites/kivvi.png': {
    plan: 'small',
    skin: '#8fb05a',
    hair: '#3d4a24',
    hairStyle: 'ponytail',
    ears: 'goblin',
    torso: '#6e5a3a', // work apron
    legs: '#4a3a24',
    feet: '#33280e',
    weapon: 'wrench',
  },
  'sprites/goblin_scrapper.png': {
    plan: 'small',
    skin: '#8fb05a',
    hairStyle: 'bald',
    ears: 'goblin',
    torso: '#5c5248',
    legs: '#43362a',
    feet: '#2c231a',
    weapon: 'spear',
  },
  'sprites/goblin_stoker.png': {
    plan: 'small',
    skin: '#9aba62',
    hairStyle: 'bald',
    ears: 'goblin',
    torso: '#7a4a2a',
    legs: '#4a3a24',
    feet: '#2c231a',
  },
  'sprites/war_chieftain.png': {
    plan: 'bulky',
    skin: '#7aa04a',
    torso: '#5c4a30',
    patches: ['#8f7d3a', '#4a3d24'],
    tusks: true,
    weapon: 'club',
  },
  // --- Act III: hostiles ---
  'sprites/frank_q.png': {
    plan: 'human',
    skin: '#d8a078',
    hair: '#3a2c1c',
    hairStyle: 'short',
    torso: '#7a3a3a',
    legs: '#43362a',
    feet: '#2c231a',
    weapon: 'sword',
  },
  'sprites/maggie_my.png': {
    plan: 'human',
    skin: '#e0b08a',
    hair: '#8a4a2a',
    hairStyle: 'ponytail',
    torso: '#8a5a7a',
    legs: '#3d3345',
    feet: '#2c231a',
  },
  // --- Act III: the crew ---
  'sprites/brandon_an.png': {
    plan: 'human',
    skin: '#d8b08a',
    hair: '#1c1814',
    hairStyle: 'short',
    torso: '#5a8ac4',
    legs: '#37455c',
    feet: '#2c3138',
  },
  'sprites/chris_andrews.png': {
    plan: 'human',
    skin: '#c9a082',
    hairStyle: 'skullcap',
    hatColor: '#8a92a8',
    torso: '#6e6a62',
    legs: '#43413a',
    feet: '#2c2a24',
  },
  'sprites/yolanda_martinez.png': {
    plan: 'small',
    skin: '#c98a62',
    hair: '#3a2c24',
    hairStyle: 'ponytail',
    torso: '#5aa8a0', // scrubs
    legs: '#41807a',
    feet: '#f0f0e8', // sensible shoes
    weapon: 'bow',
    quiver: true,
  },
  'sprites/imani_c.png': {
    plan: 'human',
    skin: '#8a5a3a',
    hair: '#14100c',
    hairStyle: 'short',
    torso: '#5aa8a0', // scrubs under the cloak
    legs: '#41807a',
    feet: '#2c2a24',
    cloak: '#3d2c5c',
    weapon: 'sword',
  },
  'sprites/agatha.png': {
    plan: 'small',
    skin: '#d8b09a',
    hairStyle: 'trapper',
    hatColor: '#b03a3a',
    torso: '#c4b05a', // scarf pile
    patches: ['#8a5a7a', '#5a8a7a', '#b07a4a'],
    legs: '#5c4a3a',
    feet: '#3a2c1c',
  },
  // --- Enemies ---
  'sprites/lint_mite.png': { plan: 'critter', skin: '#c9c2a6', torso: '#c9c2a6' },
  'sprites/tunnel_rat.png': { plan: 'critter', skin: '#8f8073', torso: '#8f8073', ears: 'rat' },
  'sprites/scuttler.png': { plan: 'critter', skin: '#b0d06a', torso: '#b0d06a' },
  'sprites/ember_rat.png': {
    plan: 'critter',
    skin: '#e07a4f',
    torso: '#e07a4f',
    ears: 'rat',
    patches: ['#ffb46a'],
  },
  'sprites/junk_golem.png': {
    plan: 'bulky',
    skin: '#9a8f7a',
    torso: '#7a705c',
    patches: ['#6b6252', '#b0a068'],
  },
  'sprites/trog_brute.png': {
    plan: 'bulky',
    skin: '#7a8a5a',
    torso: '#62703f',
    scruff: '#55613a',
  },
  'sprites/trog_howler.png': {
    plan: 'small',
    skin: '#9a7a4a',
    hairStyle: 'bald',
    ears: 'goblin',
    torso: '#7a6038',
    legs: '#5c4a2c',
    feet: '#3a2c18',
  },
  'sprites/tuskling.png': {
    plan: 'small',
    skin: '#e0a8a0',
    hairStyle: 'bald',
    torso: '#8f939c', // plate armor
    legs: '#6b6e76',
    feet: '#4a4d54',
    tusks: true,
    weapon: 'spear',
  },
  'sprites/the_ball.png': {
    plan: 'sphere',
    skin: '#e8a4b0',
    torso: '#e8a4b0',
    patches: ['#8f939c', '#d8dbe0', '#c87884'],
    tusks: true,
  },
  'sprites/ball_room.png': {
    plan: 'sphere',
    skin: '#e8a4b0',
    torso: '#e8a4b0',
    patches: ['#8f939c', '#d8dbe0', '#c87884'],
    tusks: true,
  },
};

// ---------------------------------------------------------------------------
// Portraits (48x48 dialogue faces) - keyed by character id; the file a real
// painting would use is ui/portrait_<characterId>_<expression>.png.
// ---------------------------------------------------------------------------

export interface PortraitDesign {
  /** Panel frame/backdrop accent (usually the character's plate color). */
  accent: string;
  skin: string;
  hair?: string;
  hairStyle?: 'messy' | 'short' | 'bald' | 'ponytail';
  ears?: 'cat' | 'rat' | 'goblin' | 'round';
  /** Cat face: wide flat head, whiskers, muzzle. */
  catFace?: boolean;
  patches?: string[];
  crown?: boolean;
  skullcap?: string;
  trapperHat?: string;
  scarves?: string[];
  stubble?: boolean;
  beard?: string;
  snout?: boolean;
  tusks?: boolean;
  collar?: string;
}

export const portraitDesigns: Record<string, PortraitDesign> = {
  carl: {
    accent: '#8a6242',
    skin: '#e0aa80',
    hair: '#2e241c',
    hairStyle: 'messy',
    stubble: true,
    collar: '#6e4f33',
  },
  donut: {
    accent: '#b08ad8',
    skin: '#e3cfa8',
    catFace: true,
    ears: 'cat',
    patches: TORTIE,
    crown: true,
    collar: '#7a5ac4',
  },
  mordecai: {
    accent: '#8f7d66',
    skin: '#9a8a72',
    ears: 'rat',
    snout: true,
    beard: '#6e604c',
    collar: '#5c4a30',
  },
  npc: { accent: '#4ec9a4', skin: '#d8a078', hair: '#4a3a26', hairStyle: 'short', collar: '#4e6e5a' },
  hoarder: {
    accent: '#7a9a5a',
    skin: '#7a9a5a',
    hairStyle: 'bald',
    patches: ['#4a552c', '#8a7a4a'],
    tusks: true,
    collar: '#43502a',
  },
  tally: {
    accent: '#9a8f72',
    skin: '#c9a082',
    hairStyle: 'bald',
    ears: 'round',
    beard: '#7d6e56',
    collar: '#9a8f72',
  },
  kivvi: {
    accent: '#9ec46a',
    skin: '#8fb05a',
    hair: '#3d4a24',
    hairStyle: 'ponytail',
    ears: 'goblin',
    collar: '#6e5a3a',
  },
  war_chieftain: {
    accent: '#b0623a',
    skin: '#7aa04a',
    hairStyle: 'bald',
    ears: 'goblin',
    tusks: true,
    collar: '#5c4a30',
  },
  frank: { accent: '#a05a5a', skin: '#d8a078', hair: '#3a2c1c', hairStyle: 'short', stubble: true, collar: '#7a3a3a' },
  maggie: { accent: '#c47a9e', skin: '#e0b08a', hair: '#8a4a2a', hairStyle: 'ponytail', collar: '#8a5a7a' },
  brandon: { accent: '#5a8ac4', skin: '#d8b08a', hair: '#1c1814', hairStyle: 'short', collar: '#5a8ac4' },
  chris: { accent: '#8a92a8', skin: '#c9a082', hairStyle: 'bald', skullcap: '#8a92a8', collar: '#6e6a62' },
  yolanda: { accent: '#5aa8a0', skin: '#c98a62', hair: '#3a2c24', hairStyle: 'ponytail', collar: '#5aa8a0' },
  imani: { accent: '#7a5ac4', skin: '#8a5a3a', hair: '#14100c', hairStyle: 'short', collar: '#3d2c5c' },
  agatha: {
    accent: '#c4b05a',
    skin: '#d8b09a',
    hairStyle: 'bald',
    trapperHat: '#b03a3a',
    scarves: ['#8a5a7a', '#5a8a7a', '#c4b05a'],
    collar: '#c4b05a',
  },
};
