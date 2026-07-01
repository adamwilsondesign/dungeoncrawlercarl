/**
 * Character registry: name plates, placeholder colors, and portrait
 * expression sets for the dialogue system. Portrait art drops in later at
 * ui/portrait_<characterId>_<expression>.png (48x48).
 */

import type { CharacterDef } from './types';

export const characters: Record<string, CharacterDef> = {
  carl: {
    id: 'carl',
    name: 'CARL',
    color: '#f2a65a',
    portrait: { characterId: 'carl', expressions: ['neutral', 'annoyed'] },
  },
  npc: {
    id: 'npc',
    name: 'SURVIVOR',
    color: '#4ec9a4',
    portrait: { characterId: 'npc', expressions: ['neutral', 'worried'] },
  },
  donut: {
    id: 'donut',
    name: 'PRINCESS DONUT',
    color: '#ff8ad8',
    portrait: { characterId: 'donut', expressions: ['neutral', 'smug'] },
    portraitSide: 'right',
  },
};
