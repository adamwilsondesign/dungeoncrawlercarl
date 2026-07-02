/**
 * Registry-driven asset catalog for the CMS. Every consumable asset id is
 * enumerated from the live registries (rooms, encounters, sprite designs,
 * characters x expressions, items, verbs/UI glyphs) - never hand-listed -
 * so newly authored content appears in the CMS automatically. Each entry
 * carries the exact drop-in filename and the PlaceholderSpec needed to
 * render "what is currently used" (including procedural art) to a canvas.
 */

import { allAudioIds } from './audio';
import { spriteDesigns } from './spriteArt';
import type {
  CharacterDef,
  EncounterDef,
  ItemDef,
  PlaceholderSpec,
  RoomDef,
} from './types';

export interface CatalogEntry {
  /** Asset id == the path a real file would use under src/assets/. */
  id: string;
  category: 'backgrounds' | 'masks' | 'sprites' | 'portraits' | 'items' | 'ui' | 'audio';
  label: string;
  /** Human-readable expected format. */
  spec: string;
  /** Expected pixel size where known (dimension check on upload). */
  expectW?: number;
  expectH?: number;
  /** Spec to regenerate the procedural fallback for thumbnail/download. */
  placeholder?: PlaceholderSpec;
}

export interface CatalogSource {
  rooms: Record<string, RoomDef>;
  encounters: Record<string, EncounterDef>;
  characters: Record<string, CharacterDef>;
  items: Record<string, ItemDef>;
}

/** Frame sizes for sprite thumbnails, by body plan (thumbnail fidelity only). */
const PLAN_FRAMES: Record<string, [number, number]> = {
  human: [24, 32],
  small: [18, 22],
  cat: [20, 16],
  critter: [20, 14],
  bulky: [36, 48],
  sphere: [40, 40],
};

const VERBS = ['walk', 'look', 'hand', 'talk', 'item'] as const;
const BAR_GLYPHS = ['walk', 'look', 'hand', 'talk', 'item', 'inventory', 'settings'] as const;

export function buildAssetCatalog(src: CatalogSource): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const seen = new Set<string>();
  const add = (e: CatalogEntry): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push(e);
  };

  // Room backgrounds + walkmasks
  for (const room of Object.values(src.rooms)) {
    add({
      id: room.backgroundPath,
      category: 'backgrounds',
      label: room.label,
      spec: '320x200 PNG scene',
      expectW: 320,
      expectH: 200,
      placeholder: {
        kind: 'background',
        label: room.label,
        mood: room.backgroundMood,
        draw: room.placeholderArtDraw,
      },
    });
    add({
      id: room.walkmaskPath,
      category: 'masks',
      label: `${room.label} walkmask`,
      spec: '320x200 PNG, pure #ffffff = walkable',
      expectW: 320,
      expectH: 200,
    });
  }

  // Combat backdrops come from the encounter registry
  for (const enc of Object.values(src.encounters)) {
    add({
      id: enc.backdrop,
      category: 'backgrounds',
      label: enc.backdropLabel ?? enc.id,
      spec: '320x200 PNG combat backdrop',
      expectW: 320,
      expectH: 200,
      placeholder: {
        kind: 'background',
        label: enc.backdropLabel ?? 'COMBAT',
        mood: enc.backdropMood ?? 'boss',
      },
    });
  }

  // Character sprite sheets from the sprite-design registry
  for (const [path, design] of Object.entries(spriteDesigns)) {
    const [fw, fh] = PLAN_FRAMES[design.plan] ?? [24, 32];
    add({
      id: path,
      category: 'sprites',
      label: path.replace(/^sprites\//, '').replace(/\.png$/, ''),
      spec: `3x3 frame grid PNG (rows: down/up/right; cols: idle/walk/walk), ~${fw}x${fh} per frame`,
      expectW: fw * 3,
      expectH: fh * 3,
      placeholder: {
        kind: 'actor',
        label: path,
        color: design.torso,
        frameW: fw,
        frameH: fh,
      },
    });
  }

  // Portraits: every character x its declared expressions
  for (const ch of Object.values(src.characters)) {
    for (const expr of ch.portrait.expressions) {
      add({
        id: `ui/portrait_${ch.portrait.characterId}_${expr}.png`,
        category: 'portraits',
        label: `${ch.name} (${expr})`,
        spec: '48x48 PNG portrait',
        expectW: 48,
        expectH: 48,
        placeholder: { kind: 'portrait', label: ch.name, color: ch.color, expression: expr },
      });
    }
  }

  // Inventory item icons
  for (const item of Object.values(src.items)) {
    add({
      id: `ui/item_${item.id}.png`,
      category: 'items',
      label: item.name,
      spec: '24x24 PNG icon',
      expectW: 24,
      expectH: 24,
      placeholder: { kind: 'item', label: item.name },
    });
  }

  // Verb cursors + icon-bar buttons
  for (const verb of VERBS) {
    add({
      id: `ui/cursor_${verb}.png`,
      category: 'ui',
      label: `${verb} cursor`,
      spec: '16x16-ish PNG cursor',
      placeholder: { kind: 'cursor', glyph: verb },
    });
  }
  for (const glyph of BAR_GLYPHS) {
    add({
      id: `ui/icon_${glyph}.png`,
      category: 'ui',
      label: `${glyph} bar button`,
      spec: '40x18 PNG button',
      expectW: 40,
      expectH: 18,
      placeholder: { kind: 'icon', glyph, label: glyph.toUpperCase(), w: 40, h: 18 },
    });
  }

  // Audio: every music loop and one-shot from the audio registry. A real
  // file (Blob override or bundled at src/assets/audio/<id>.ogg|mp3|wav)
  // beats the synth, exactly like the art tiers.
  for (const id of allAudioIds()) {
    const isMusic = id.startsWith('music_');
    add({
      id: `audio/${id}.ogg`,
      category: 'audio',
      label: id.replace(/^(music|sfx)_/, '').replace(/_/g, ' ') + (isMusic ? ' (music)' : ' (sfx)'),
      spec: isMusic
        ? 'OGG/MP3/WAV seamless loop (overrides the synth track)'
        : 'OGG/MP3/WAV one-shot (overrides the synth effect)',
    });
  }

  return out;
}
