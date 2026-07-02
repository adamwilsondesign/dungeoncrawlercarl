/**
 * Mouse and keyboard input, all in logical 320x200 coordinates.
 * Clicks queue until a scene consumes them; key presses are edge-triggered
 * and consumed once (safe across multiple fixed-timestep updates per frame).
 */

import type { Point } from '../data/types';
import { LOGICAL_H, LOGICAL_W } from './renderer';

export class Input {
  /** Current mouse position in logical coords (may be outside 0..319/0..199 in the letterbox). */
  readonly mouse: Point = { x: 0, y: 0 };

  private readonly clicks: Point[] = [];
  private readonly pressed = new Set<string>();
  private readonly held = new Set<string>();
  private rightClicks = 0;

  constructor(target: HTMLElement, toLogical: (clientX: number, clientY: number) => Point) {
    target.addEventListener('mousemove', (e: MouseEvent) => {
      const p = toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    target.addEventListener('contextmenu', (e: Event) => e.preventDefault());
    target.addEventListener('mousedown', (e: MouseEvent) => {
      const p = toLogical(e.clientX, e.clientY);
      const inBounds = p.x >= 0 && p.x < LOGICAL_W && p.y >= 0 && p.y < LOGICAL_H;
      if (!inBounds) return;
      if (e.button === 0) this.clicks.push(p);
      else if (e.button === 2) this.rightClicks++;
    });
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  /** True while the physical key is held (continuous movement, P10 fix). */
  isDown(code: string): boolean {
    return this.held.has(code);
  }

  /** Take the most recent queued left-click (draining the queue), or null. */
  consumeClick(): Point | null {
    if (this.clicks.length === 0) return null;
    const last = this.clicks[this.clicks.length - 1];
    this.clicks.length = 0;
    return last;
  }

  /** Drop any queued clicks (used while transitions ignore input). */
  clearClicks(): void {
    this.clicks.length = 0;
  }

  /** Consume one queued right-click (KQ5 verb cycling); call until false. */
  consumeRightClick(): boolean {
    if (this.rightClicks === 0) return false;
    this.rightClicks--;
    return true;
  }

  /** Drop any queued right-clicks (used while scripts block input). */
  clearRightClicks(): void {
    this.rightClicks = 0;
  }

  /** True once per physical key press; consuming clears the edge. */
  consumePress(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Called by the game loop after a frame that ran at least one update. */
  endFrame(): void {
    this.pressed.clear();
  }
}
