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

  constructor(target: HTMLElement, toLogical: (clientX: number, clientY: number) => Point) {
    target.addEventListener('mousemove', (e: MouseEvent) => {
      const p = toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    target.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const p = toLogical(e.clientX, e.clientY);
      if (p.x >= 0 && p.x < LOGICAL_W && p.y >= 0 && p.y < LOGICAL_H) {
        this.clicks.push(p);
      }
    });
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!e.repeat) this.pressed.add(e.code);
    });
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
