/**
 * Radial verb menu: pops at the cursor after a short hover over an
 * interactable (hotspot or enabled exit). Four discs at the cardinal points
 * - LOOK (N), HAND (E), TALK (S), WALK (W) - using the SAME cursor glyphs
 * as the top bar, so painted UI drop-ins skin both at once. The option
 * nearest the cursor's direction from the cluster center auto-highlights;
 * arrows move the highlight; Enter/Space/click fires.
 *
 * Pure draw + geometry + a tiny state machine (hidden -> opening ->
 * visible -> dismissing). RoomScene owns hover-intent, gating and firing.
 */

import type { Point } from '../data/types';
import type { LoadedImage } from './assets';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import { el, getUi } from './ui';
import type { Verb } from './verbs';

/** Logical rows covered by the DOM top nav (48px CSS at 4x upscale). */
const TOP_UI_H = 12;

export type RadialVerb = 'look' | 'hand' | 'talk' | 'walk';

/** Disc order is the cardinal order: N, E, S, W. */
export const RADIAL_ORDER: readonly RadialVerb[] = ['look', 'hand', 'talk', 'walk'];
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

const RADIUS = 23; // cluster center -> disc center
const DISC_R = 8; // disc radius (16px diameter)
const OPEN_MS = 120;
const CLOSE_MS = 80;
/** Cursor movement inside this radius keeps the current highlight. */
const DEAD_ZONE = 6;

type Phase = 'hidden' | 'opening' | 'visible' | 'dismissing';

export class RadialMenu {
  private phase: Phase = 'hidden';
  private t = 0;
  private cx = 0;
  private cy = 0;
  private label = '';
  private labelBelow = false;
  /** Index into RADIAL_ORDER; LOOK by default. */
  selected = 0;

  /** Accepting input (opening or fully visible). */
  get active(): boolean {
    return this.phase === 'opening' || this.phase === 'visible';
  }

  /** Nothing to draw at all. */
  get hidden(): boolean {
    return this.phase === 'hidden';
  }

  get verb(): RadialVerb {
    return RADIAL_ORDER[this.selected];
  }

  /** Pop the cluster at the cursor, clamped fully onscreen. */
  show(at: Point, label: string): void {
    const margin = RADIUS + DISC_R + 2;
    // The DOM label chip needs ~10px above (or below when top-clamped).
    this.labelBelow = at.y - margin - 10 < TOP_UI_H;
    const minY = TOP_UI_H + margin + (this.labelBelow ? 0 : 10);
    const maxY = LOGICAL_H - margin - (this.labelBelow ? 10 : 0);
    this.cx = Math.max(margin, Math.min(LOGICAL_W - margin, at.x));
    this.cy = Math.max(minY, Math.min(maxY, at.y));
    this.label = label;
    this.selected = 0;
    this.phase = 'opening';
    this.t = 0;
    this.syncChip();
  }

  /** The target-name label is DOM (P20): crisp text over canvas discs. */
  private chip: HTMLDivElement | null = null;

  private ensureChip(): HTMLDivElement {
    if (!this.chip) {
      this.chip = el(
        'div',
        'position:absolute;display:none;transform:translateX(-50%);padding:2px 10px;' +
          'background:rgba(4,10,18,0.92);border:1px solid var(--dcc-gold);color:var(--dcc-gold);' +
          'font-size:14px;letter-spacing:1px;white-space:nowrap',
      );
      this.chip.dataset.radialLabel = '1';
      getUi().layer('narrator').appendChild(this.chip);
    }
    return this.chip;
  }

  private syncChip(): void {
    const chip = this.ensureChip();
    if (this.phase === 'hidden') {
      chip.style.display = 'none';
      return;
    }
    const scale = getUi().scale;
    const gap = RADIUS + DISC_R + 3;
    chip.textContent = this.label;
    chip.style.display = 'block';
    chip.style.left = `${this.cx * scale}px`;
    if (this.labelBelow) {
      chip.style.top = `${(this.cy + gap) * scale}px`;
      chip.style.bottom = 'auto';
    } else {
      chip.style.top = `${(this.cy - gap) * scale - 24}px`;
      chip.style.bottom = 'auto';
    }
  }

  /** Animated dismiss (quick fade-out). */
  dismiss(): void {
    if (this.active) {
      this.phase = 'dismissing';
      this.t = 0;
      this.syncChip();
    }
  }

  /** Instant hide (mode gates: cutscene/dialogue/menu/combat/transition). */
  forceHide(): void {
    this.phase = 'hidden';
    this.syncChip();
  }

  tick(dtMs: number): void {
    if (this.phase === 'opening') {
      this.t += dtMs;
      if (this.t >= OPEN_MS) this.phase = 'visible';
    } else if (this.phase === 'dismissing') {
      this.t += dtMs;
      if (this.t >= CLOSE_MS) {
        this.phase = 'hidden';
        this.syncChip();
      }
    }
  }

  private discCenter(i: number): Point {
    return { x: this.cx + DIRS[i][0] * RADIUS, y: this.cy + DIRS[i][1] * RADIUS };
  }

  /** The disc under a point, if any. */
  discAt(p: Point): number | null {
    for (let i = 0; i < RADIAL_ORDER.length; i++) {
      const c = this.discCenter(i);
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      if (dx * dx + dy * dy <= (DISC_R + 2) * (DISC_R + 2)) return i;
    }
    return null;
  }

  /** The cluster's own hit area (hovering here keeps it open). */
  contains(p: Point): boolean {
    const dx = p.x - this.cx;
    const dy = p.y - this.cy;
    const r = RADIUS + DISC_R + 6;
    return dx * dx + dy * dy <= r * r;
  }

  /**
   * Auto-highlight: snap the cursor's direction from the cluster center to
   * the nearest cardinal. Inside the dead zone the highlight is kept.
   */
  updateSelectionFromCursor(mouse: Point): void {
    const dx = mouse.x - this.cx;
    const dy = mouse.y - this.cy;
    if (dx * dx + dy * dy < DEAD_ZONE * DEAD_ZONE) return;
    // atan2 with y-down: -90deg = up. Quadrant snap via 45-degree bands.
    const a = Math.atan2(dy, dx);
    const deg = (a * 180) / Math.PI;
    if (deg >= -135 && deg < -45) this.selected = 0; // N: LOOK
    else if (deg >= -45 && deg < 45) this.selected = 1; // E: HAND
    else if (deg >= 45 && deg < 135) this.selected = 2; // S: TALK
    else this.selected = 3; // W: WALK
  }

  render(ctx: CanvasRenderingContext2D, icons: Record<Verb, LoadedImage>): void {
    if (this.phase === 'hidden') return;
    const k =
      this.phase === 'opening'
        ? this.t / OPEN_MS
        : this.phase === 'dismissing'
          ? 1 - this.t / CLOSE_MS
          : 1;
    const alpha = Math.max(0, Math.min(1, k));
    const spread = 0.75 + 0.25 * alpha; // discs bloom out as it fades in

    ctx.save();
    ctx.globalAlpha = alpha;

    for (let i = 0; i < RADIAL_ORDER.length; i++) {
      const cx = this.cx + DIRS[i][0] * RADIUS * spread;
      const cy = this.cy + DIRS[i][1] * RADIUS * spread;
      const isSel = i === this.selected && this.phase !== 'dismissing';
      // Filled disc backdrop + subtle accent ring (+ highlight ring on the
      // selected option) so the glyph reads over any room art.
      ctx.fillStyle = isSel ? 'rgba(30,52,74,0.95)' : 'rgba(10,17,28,0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, DISC_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isSel ? '#3fd9ff' : '#39465e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, DISC_R + (isSel ? 1 : 0), 0, Math.PI * 2);
      ctx.stroke();
      const icon = icons[RADIAL_ORDER[i]];
      ctx.drawImage(icon, Math.round(cx - icon.width / 2), Math.round(cy - icon.height / 2));
    }

    // (P20: the target-name label is a DOM chip; only discs draw here.)
    ctx.restore();
  }
}
