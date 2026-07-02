/**
 * Item registry. Item icon art drops in later at ui/item_<id>.png (24x24);
 * descriptions are the in-voice LOOK text shown from the inventory screen.
 */

import type { ItemDef } from './types';

export const items: Record<string, ItemDef> = {
  rusty_key: {
    id: 'rusty_key',
    name: 'RUSTY KEY',
    description:
      "A key, pre-rusted for your inconvenience. The dungeon's locksmith has a vision.",
  },
  pocket_lint: {
    id: 'pocket_lint',
    name: 'POCKET LINT',
    description:
      'Artisanal dungeon lint. Collect enough and the audience starts a fan club. Probably.',
    stackable: true,
  },
  // --- Equipment ---
  rusty_cudgel: {
    id: 'rusty_cudgel',
    name: 'RUSTY CUDGEL',
    description: 'A length of rebar with delusions of knighthood. ATTACK +3.',
    equip: { slot: 'weapon', attack: 3 },
  },
  scrap_plate: {
    id: 'scrap_plate',
    name: 'SCRAP PLATE',
    description: 'Street signs, artfully riveted. DEFENSE +2.',
    equip: { slot: 'armor', defense: 2 },
  },
  lint_charm: {
    id: 'lint_charm',
    name: 'LINT CHARM',
    description: 'Compressed luck, pocket-grade. SPD +2.',
    equip: { slot: 'trinket', statMods: { spd: 2 } },
  },
  // --- Act I starting kit ---
  carls_jacket: {
    id: 'carls_jacket',
    name: "CARL'S JACKET",
    description:
      'Your own winter jacket, formally registered as ARMOR. The System is very pleased with itself. DEFENSE +2.',
    equip: { slot: 'armor', defense: 2 },
  },
  fingerless_gloves: {
    id: 'fingerless_gloves',
    name: 'FINGERLESS GLOVES',
    description: 'Maximum grip, minimum warmth. The System calls this a fair trade. DEX +1.',
    equip: { slot: 'trinket', statMods: { dex: 1 } },
  },
  stale_biscuit: {
    id: 'stale_biscuit',
    name: 'STALE BISCUIT',
    description: 'A dungeon ration of uncertain age. Edible in the legal sense. Restores a little HP.',
    stackable: true,
    use: { target: 'ally', heal: true, power: 6 },
  },
  // --- Act II part 1 ---
  dynamite: {
    id: 'dynamite',
    name: 'DYNAMITE',
    description:
      "Demolition-grade persuasion, fuse included. Carl's love language. Hits every enemy. Single use.",
    stackable: true,
    use: { target: 'allEnemies', power: 16 },
  },
  polished_hubcap: {
    id: 'polished_hubcap',
    name: 'POLISHED HUBCAP',
    description:
      'The shiniest object left in the maze. Worthless to you. Priceless to anything that hoards.',
  },
  neighborhood_map: {
    id: 'neighborhood_map',
    name: 'NEIGHBORHOOD MAP',
    description:
      'The Hoarder had the whole block memorized. Now the memorizing is your problem too. Minimap data: acquired.',
  },
  riot_vest: {
    id: 'riot_vest',
    name: 'RIOT VEST',
    description: 'Somebody upstairs came prepared. It was not enough. It might be for you. DEFENSE +3.',
    equip: { slot: 'armor', defense: 3 },
  },
  // --- Act II part 2: the chain-reaction puzzle ---
  fuse_wick: {
    id: 'fuse_wick',
    name: 'FUSE WICK',
    description:
      'Waxed starter cord off a copper chopper. Goblins use it to wake engines. It would wake other things too.',
  },
  chopper_grease: {
    id: 'chopper_grease',
    name: 'CHOPPER GREASE',
    description:
      'A tin of engine grease, thick as regret. Burns slow and mean. The label is a goblin skull winking.',
  },
  black_powder: {
    id: 'black_powder',
    name: 'POWDER KEG',
    description:
      'A carry-size keg of blasting powder. The stenciling says NO SPARK, NO FLAME, NO EXCEPTIONS. It means it.',
  },
  powder_charge: {
    id: 'powder_charge',
    name: 'POWDER CHARGE',
    description:
      'Keg plus wick: a question with exactly one answer. Bare powder burns fast and rude - it wants something to slow it down.',
  },
  primed_charge: {
    id: 'primed_charge',
    name: 'PRIMED CHARGE',
    description:
      'Grease-slicked and wick-fitted. Slow, hot, reliable. It needs a delivery vehicle and a very good reason.',
  },
  flint_striker: {
    id: 'flint_striker',
    name: 'FLINT STRIKER',
    description:
      "Kivvi's spark tool. One squeeze, one spark. Point it away from everything you love, which around here is a short list.",
  },
  chrome_talons: {
    id: 'chrome_talons',
    name: 'FITTED TALONS',
    description:
      'Goblin-machined claw caps, sized for a very particular customer. Somebody in that workshop understood royalty. ATTACK +4.',
    equip: { slot: 'weapon', attack: 4 },
  },
  goblin_wrench: {
    id: 'goblin_wrench',
    name: 'TORQUE WRENCH',
    description: 'A goblin wrench with a grip worn smooth by better hands. STR +1.',
    equip: { slot: 'trinket', statMods: { str: 1 } },
  },
  coal_chunk: {
    id: 'coal_chunk',
    name: 'COAL CHUNK',
    description: 'Souvenir-grade coal. The dungeon assures you it will one day be a diamond. It is lying.',
    stackable: true,
  },
  // --- Act III: the trap, the gym, the ring ---
  trip_cord: {
    id: 'trip_cord',
    name: 'TRIP CORD',
    description:
      'Braided cable from a downed sign, ankle-height ambitions. Strung tight across a narrow spot, it asks one question.',
  },
  powder_pouch: {
    id: 'powder_pouch',
    name: 'POWDER POUCH',
    description:
      "A miner's belt pouch of blasting powder, palm-sized. Small charge, strong opinions. You know this recipe by now.",
  },
  tripline_charge: {
    id: 'tripline_charge',
    name: 'TRIPLINE CHARGE',
    description:
      'Cord plus powder: a welcome mat for people who follow you into narrow places. Needs a chokepoint.',
  },
  kettle_crusher: {
    id: 'kettle_crusher',
    name: 'KETTLE CRUSHER',
    description:
      'A kettlebell on a wrist strap. Somewhere between a mace and a gym membership. ATTACK +5.',
    equip: { slot: 'weapon', attack: 5 },
  },
  weight_belt: {
    id: 'weight_belt',
    name: 'WEIGHT BELT',
    description: 'A lifting belt, troll-notched. Your spine writes a thank-you note. CON +2.',
    equip: { slot: 'trinket', statMods: { con: 2 } },
  },
  barbell: {
    id: 'barbell',
    name: 'BARBELL',
    description:
      'Two hundred pounds of honest iron. Useless as a weapon, magnificent as an obstruction. Rails exist. Thoughts occur.',
  },
  det_cord: {
    id: 'det_cord',
    name: 'DET CORD',
    description:
      'Demolition cord from the ring maintenance chest. Burns instant and total. Do not confuse with licorice.',
  },
  rigged_barbell: {
    id: 'rigged_barbell',
    name: 'RIGGED BARBELL',
    description:
      'Iron plus det cord: a derailment kit. It wants a bend in the rail and impeccable timing.',
  },
  tusk_crown: {
    id: 'tusk_crown',
    name: 'TUSK CROWN',
    description:
      'A circlet of polished tusk tips from the Ball. Royalty recognizes royalty. INT +2.',
    equip: { slot: 'trinket', statMods: { int: 2 } },
  },
  // --- Combat consumables ---
  goblin_bomb: {
    id: 'goblin_bomb',
    name: 'GOBLIN BOMB',
    description: "Improvised explosive, Carl's signature. Hits every enemy. Single use.",
    stackable: true,
    use: { target: 'allEnemies', power: 14 },
  },
  healing_salve: {
    id: 'healing_salve',
    name: 'HEALING SALVE',
    description: 'Smells illegal. Restores a chunk of HP to one ally.',
    stackable: true,
    use: { target: 'ally', heal: true, power: 14 },
  },
};
