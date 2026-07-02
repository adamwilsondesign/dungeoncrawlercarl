/**
 * The KQ5-style icon bar: hidden until the mouse touches the top of the
 * logical screen, then slides down (elapsed-ms based). Holds the five verb
 * icons plus INVENTORY and SETTINGS buttons. While it covers the mouse, the
 * world receives no clicks.
 */

import type { Point, Rect, UiGlyph } from '../data/types';
import { loadImage, type LoadedImage } from './assets';
import { LOGICAL_W } from './renderer';
import type { Verb } from './verbs';

export type BarAction =
  | { kind: 'verb'; verb: Verb }
  | { kind: 'inventory' }
  | { kind: 'settings' };

interface ButtonSpec {
  glyph: UiGlyph;
  label: string;
  action: BarAction;
}

interface Button extends ButtonSpec {
  rect: Rect;
  image: LoadedImage | null;
}

const BUTTON_W = 40;
const BUTTON_H = 18;
const BUTTON_GAP = 2;

const SPECS: readonly ButtonSpec[] = [
  { glyph: 'walk', label: 'WALK', action: { kind: 'verb', verb: 'walk' } },
  { glyph: 'look', label: 'LOOK', action: { kind: 'verb', verb: 'look' } },
  { glyph: 'hand', label: 'HAND', action: { kind: 'verb', verb: 'hand' } },
  { glyph: 'talk', label: 'TALK', action: { kind: 'verb', verb: 'talk' } },
  { glyph: 'item', label: 'ITEM', action: { kind: 'verb', verb: 'item' } },
  { glyph: 'inventory', label: 'INV', action: { kind: 'inventory' } },
  { glyph: 'settings', label: 'MENU', action: { kind: 'settings' } },
];

export class IconBar {
  static readonly HEIGHT = 22;

  private readonly buttons: Button[];
  private progress = 1; // pinned fully shown (P10 fix)

  constructor() {
    const total = SPECS.length * BUTTON_W + (SPECS.length - 1) * BUTTON_GAP;
    const x0 = Math.floor((LOGICAL_W - total) / 2);
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
    // P10 fix: the bar is pinned — always visible, no hover slide. The old
    // trigger/hysteresis behavior is retired; the fields stay for the
    // geometry math (progress locked at 1).
    void mouse;
    void dtMs;
    this.progress = 1;
  }

  /** True when the sliding bar currently covers this point (blocks world clicks). */
  coversPoint(p: Point): boolean {
    return this.progress > 0 && p.y >= 0 && p.y < Math.round(this.progress * IconBar.HEIGHT);
  }

  /** The button action at a point, honoring the current slide offset. */
  actionAt(p: Point): BarAction | null {
    const yOff = this.yOffset();
    for (const b of this.buttons) {
      const r = b.rect;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y + yOff && p.y < r.y + r.h + yOff) {
        return b.action;
      }
    }
    return null;
  }

  private yOffset(): number {
    return Math.round((this.progress - 1) * IconBar.HEIGHT);
  }

  render(ctx: CanvasRenderingContext2D, activeVerb: Verb): void {
    if (this.progress <= 0) return;
    const yOff = this.yOffset();

    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, yOff, LOGICAL_W, IconBar.HEIGHT);
    ctx.fillStyle = '#39465e';
    ctx.fillRect(0, yOff + IconBar.HEIGHT - 1, LOGICAL_W, 1);

    for (const b of this.buttons) {
      const y = b.rect.y + yOff;
      if (b.image) ctx.drawImage(b.image, b.rect.x, y);
      const isActive = b.action.kind === 'verb' && b.action.verb === activeVerb;
      if (isActive) {
        ctx.strokeStyle = '#3fd9ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.rect.x - 0.5, y - 0.5, b.rect.w + 1, b.rect.h + 1);
        ctx.fillStyle = 'rgba(63,217,255,0.15)';
        ctx.fillRect(b.rect.x, y, b.rect.w, b.rect.h);
      }
    }
  }
}
