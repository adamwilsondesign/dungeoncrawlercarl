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

  /** True while the pointer hovers DOM UI (overlay panels), not the canvas. */
  overUi = false;

  private readonly clicks: Point[] = [];
  private readonly pressed = new Set<string>();
  private readonly held = new Set<string>();
  private rightClicks = 0;
  private leftHeld = false;
  private wheelSteps = 0;

  constructor(target: HTMLElement, toLogical: (clientX: number, clientY: number) => Point) {
    // Window-level so the position never goes stale while the pointer is
    // over a DOM overlay (narration boxes, nav) that swallows canvas events.
    window.addEventListener('mousemove', (e: MouseEvent) => {
      const p = toLogical(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.overUi = e.target !== target;
    });
    target.addEventListener('contextmenu', (e: Event) => e.preventDefault());
    target.addEventListener('mousedown', (e: MouseEvent) => {
      const p = toLogical(e.clientX, e.clientY);
      const inBounds = p.x >= 0 && p.x < LOGICAL_W && p.y >= 0 && p.y < LOGICAL_H;
      if (!inBounds) return;
      if (e.button === 0) {
        this.clicks.push(p);
        this.leftHeld = true;
      } else if (e.button === 2) this.rightClicks++;
    });
    // Release tracked on window so drags ending off-canvas still end.
    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.leftHeld = false;
    });
    // Wheel steps accumulate until a scene consumes them (dialogue scroll).
    target.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        if (e.deltaY !== 0) this.wheelSteps += Math.sign(e.deltaY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Tab steals focus and Space scrolls; both are game keys (hotspot reveal).
      // Except while a DOM overlay input is focused (CMS / editor panels).
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLSelectElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (!typing && (e.code === 'Tab' || e.code === 'Space')) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  /** True while the left mouse button is held (editor drags). */
  get mouseDown(): boolean {
    return this.leftHeld;
  }

  /** Accumulated wheel steps since last consumed (+down / -up), then reset. */
  consumeWheel(): number {
    const steps = this.wheelSteps;
    this.wheelSteps = 0;
    return steps;
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
