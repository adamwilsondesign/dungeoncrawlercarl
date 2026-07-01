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
};
