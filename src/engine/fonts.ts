/**
 * The two-font text system (P19). Both faces are OFL, self-hosted as woff2
 * (src/assets/fonts/ - no CDN, offline-safe):
 * - 'ui'  = Pixelify Sans: the game's human voice - dialogue, describe()
 *           narration, menus, HUD, labels, inventory, party screen.
 * - 'ai'  = VT323: the machine voice - announce() broadcasts and notify()
 *           interface pops, terminal-flavored and inhuman.
 *
 * Sizes are tuned for the 320x200 logical buffer at integer upscale:
 * Pixelify Sans at 10px and VT323 at 12px both sit on their pixel grids.
 * drawPixelText keeps its legacy contract (y = visual TOP of the glyphs,
 * ~6px tall at scale 1) so every existing call site lays out unchanged.
 */

import pixelifyUrl from '../assets/fonts/pixelify-sans.woff2?url';
import vt323Url from '../assets/fonts/vt323.woff2?url';

export type GameFont = 'ui' | 'ai';

interface FontSpec {
  family: string;
  fallback: string;
  /** Font size at scale 1. */
  size: number;
  /** fillText baseline offset below the legacy "glyph top" y. */
  baseline: number;
}

export const FONT_SPECS: Record<GameFont, FontSpec> = {
  // Size-matrix tested at 4x upscale: Pixelify garbles B/G and C/O below
  // 10px; VT323 is muddy below 12px. These are the smallest crisp sizes.
  ui: { family: 'Pixelify Sans', fallback: 'monospace', size: 10, baseline: 7 },
  ai: { family: 'VT323', fallback: 'monospace', size: 12, baseline: 8 },
};

let loaded = false;

/** CSS font string for a game font at a scale. */
export function fontCss(font: GameFont, scale = 1): string {
  const spec = FONT_SPECS[font];
  return `${spec.size * scale}px "${spec.family}", ${spec.fallback}`;
}

export function fontBaseline(font: GameFont, scale = 1): number {
  return FONT_SPECS[font].baseline * scale;
}

/**
 * Load both faces before anything draws (placeholder art bakes labels at
 * load time). A failed load degrades to the monospace fallback - the game
 * must still run offline with zero assets.
 */
export async function loadFonts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const faces: Array<[string, string]> = [
    ['Pixelify Sans', pixelifyUrl],
    ['VT323', vt323Url],
  ];
  await Promise.all(
    faces.map(async ([family, url]) => {
      try {
        const face = new FontFace(family, `url(${url})`);
        document.fonts.add(await face.load());
      } catch (err) {
        console.warn(`[fonts] "${family}" failed to load; using monospace fallback`, err);
      }
    }),
  );
}
