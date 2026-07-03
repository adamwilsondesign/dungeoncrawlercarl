/**
 * The top nav bar (P19 rebuild). Left to right:
 *   [AREA NAME]  ................  [INVENTORY] [PARTY] [MENU]
 * The old per-verb buttons are retired - the radial menu is the entire verb
 * path now - and the standalone room-name chip is consolidated here as the
 * AREA NAME element. Button art drops in at ui/icon_<glyph>.png (40x18);
 * placeholders are generated like every other asset.
 */

import type { Point, Rect, UiGlyph } from '../data/types';
import { drawPixelText, loadImage, pixelTextWidth, type LoadedImage } from './assets';
import { LOGICAL_W } from './renderer';

export type BarAction = { kind: 'inventory' } | { kind: 'party' } | { kind: 'settings' };

interface ButtonSpec {
  glyph: UiGlyph;
  label: string;
  action: BarAction;
}

interface Button extends ButtonSpec {
  rect: Rect;
  image: LoadedImage | null;
}

const BUTTON_W = 52;
const BUTTON_H = 18;
const BUTTON_GAP = 2;

const SPECS: readonly ButtonSpec[] = [
  { glyph: 'inventory', label: 'INV', action: { kind: 'inventory' } },
  { glyph: 'party', label: 'PARTY', action: { kind: 'party' } },
  { glyph: 'settings', label: 'MENU', action: { kind: 'settings' } },
];

export class IconBar {
  static readonly HEIGHT = 22;

  private readonly buttons: Button[];

  constructor() {
    // Right-aligned button block; the area-name chip owns the left side.
    const total = SPECS.length * BUTTON_W + (SPECS.length - 1) * BUTTON_GAP;
    const x0 = LOGICAL_W - total - 3;
    this.buttons = SPECS.map((spec, i) => ({
      ...spec,
      rect: { x: x0 + i * (BUTTON_W + BUTTON_GAP), y: 2, w: BUTTON_W, h: BUTTON_H },
      image: null,
    }));
  }

  /** Load button art (ui/icon_<glyph>.png) with placeholder fallback. */
  async load(): Promise<void> {
    await Promise.all(
      this.buttons.map(async (b) => {
        b.image = await loadImage(`ui/icon_${b.glyph}.png`, {
          kind: 'icon',
          glyph: b.glyph,
          label: b.label,
          w: BUTTON_W,
          h: BUTTON_H,
        });
      }),
    );
  }

  update(dtMs: number, mouse: Point): void {
    void dtMs;
    void mouse;
  }

  /** True when the bar covers this point (blocks world clicks). */
  coversPoint(p: Point): boolean {
    return p.y >= 0 && p.y < IconBar.HEIGHT;
  }

  actionAt(p: Point): BarAction | null {
    for (const b of this.buttons) {
      const r = b.rect;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
        return b.action;
      }
    }
    return null;
  }

  render(ctx: CanvasRenderingContext2D, areaLabel: string, mouse?: Point): void {
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, LOGICAL_W, IconBar.HEIGHT);
    ctx.fillStyle = '#39465e';
    ctx.fillRect(0, IconBar.HEIGHT - 1, LOGICAL_W, 1);

    // AREA NAME chip, left - truncated to the space before the buttons.
    const maxW = this.buttons[0].rect.x - 12;
    let label = areaLabel;
    while (label.length > 1 && pixelTextWidth(label) > maxW - 8) label = label.slice(0, -1);
    const chipW = pixelTextWidth(label) + 8;
    ctx.fillStyle = 'rgba(20,30,48,0.9)';
    ctx.fillRect(3, 4, chipW, 13);
    ctx.strokeStyle = '#39465e';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 4.5, chipW - 1, 12);
    drawPixelText(ctx, label, 7, 7, '#8fa3c4');

    for (const b of this.buttons) {
      if (b.image) ctx.drawImage(b.image, b.rect.x, b.rect.y);
      const hovered =
        mouse !== undefined &&
        mouse.x >= b.rect.x &&
        mouse.x < b.rect.x + b.rect.w &&
        mouse.y >= b.rect.y &&
        mouse.y < b.rect.y + b.rect.h;
      if (hovered) {
        ctx.strokeStyle = '#3fd9ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.rect.x - 0.5, b.rect.y - 0.5, b.rect.w + 1, b.rect.h + 1);
      }
    }
  }
}
