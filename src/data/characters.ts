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
    color: '#8a6242',
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
    // Purple: her color of choice (accessories, name plate) - fur is tortie.
    color: '#b08ad8',
    portrait: { characterId: 'donut', expressions: ['neutral', 'smug'] },
    portraitSide: 'right',
  },
  mordecai: {
    id: 'mordecai',
    name: 'MORDECAI',
    color: '#b08a5a',
    portrait: { characterId: 'mordecai', expressions: ['neutral', 'worried'] },
  },
  hoarder: {
    id: 'hoarder',
    name: 'THE HOARDER',
    color: '#7a9a5a',
    portrait: { characterId: 'hoarder', expressions: ['neutral', 'angry'] },
  },
  tally: {
    id: 'tally',
    name: 'TALLY',
    color: '#9a8f72',
    portrait: { characterId: 'tally', expressions: ['neutral', 'smug'] },
  },
  kivvi: {
    id: 'kivvi',
    name: 'KIVVI',
    color: '#9ec46a',
    portrait: { characterId: 'kivvi', expressions: ['neutral', 'smug'] },
  },
  war_chieftain: {
    id: 'war_chieftain',
    name: 'THE WAR CHIEFTAIN',
    color: '#b0623a',
    portrait: { characterId: 'war_chieftain', expressions: ['neutral', 'angry'] },
  },
  // --- Act III ---
  frank: {
    id: 'frank',
    name: 'FRANK Q',
    color: '#a05a5a',
    portrait: { characterId: 'frank', expressions: ['neutral', 'smug'] },
  },
  maggie: {
    id: 'maggie',
    name: 'MAGGIE MY',
    color: '#c47a9e',
    portrait: { characterId: 'maggie', expressions: ['neutral', 'smug'] },
  },
  brandon: {
    id: 'brandon',
    name: 'BRANDON AN',
    color: '#5a8ac4',
    portrait: { characterId: 'brandon', expressions: ['neutral', 'worried'] },
  },
  chris: {
    id: 'chris',
    name: 'CHRIS ANDREWS',
    color: '#8a92a8',
    portrait: { characterId: 'chris', expressions: ['neutral', 'worried'] },
  },
  yolanda: {
    id: 'yolanda',
    name: 'YOLANDA MARTINEZ',
    // Medical scrubs teal (her silhouette anchor is the oversized quiver).
    color: '#5aa8a0',
    portrait: { characterId: 'yolanda', expressions: ['neutral', 'smug'] },
  },
  imani: {
    id: 'imani',
    name: 'IMANI C',
    color: '#7a5ac4',
    portrait: { characterId: 'imani', expressions: ['neutral', 'worried'] },
  },
  agatha: {
    id: 'agatha',
    name: 'AGATHA',
    color: '#c4b05a',
    portrait: { characterId: 'agatha', expressions: ['neutral', 'angry'] },
  },
};
