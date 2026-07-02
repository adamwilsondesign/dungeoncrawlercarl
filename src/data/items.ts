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
