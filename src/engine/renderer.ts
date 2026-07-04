/**
 * Canvas management: all game logic renders into an offscreen 320x200 buffer,
 * which is blitted to the visible canvas at the largest integer scale that
 * fits the window, centered with black letterboxing. Pixel-crisp everywhere
 * (device-pixel-ratio aware, image smoothing disabled on every context).
 */

import type { Point } from '../data/types';

export const LOGICAL_W = 320;
export const LOGICAL_H = 200;

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

export class Renderer {
  /** Offscreen 320x200 buffer every scene draws into. */
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  private readonly screen: HTMLCanvasElement;
  private readonly screenCtx: CanvasRenderingContext2D;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(screen: HTMLCanvasElement) {
    this.screen = screen;
    this.screenCtx = get2d(screen);
    this.buffer = document.createElement('canvas');
    this.buffer.width = LOGICAL_W;
    this.buffer.height = LOGICAL_H;
    this.ctx = get2d(this.buffer);
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Called after every resize so the DOM overlay can track the playfield. */
  onLayoutChange: (() => void) | null = null;

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    this.screen.width = w;
    this.screen.height = h;
    this.scale = Math.max(1, Math.floor(Math.min(w / LOGICAL_W, h / LOGICAL_H)));
    this.offsetX = Math.floor((w - LOGICAL_W * this.scale) / 2);
    this.offsetY = Math.floor((h - LOGICAL_H * this.scale) / 2);
    // Resizing a canvas resets its context state.
    this.screenCtx.imageSmoothingEnabled = false;
    this.onLayoutChange?.();
  }

  /** The playfield rect and per-logical-px scale, in CSS pixels. */
  layoutCss(): { x: number; y: number; w: number; h: number; scale: number } {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: this.offsetX / dpr,
      y: this.offsetY / dpr,
      w: (LOGICAL_W * this.scale) / dpr,
      h: (LOGICAL_H * this.scale) / dpr,
      scale: this.scale / dpr,
    };
  }

  /** Blit the offscreen buffer to the visible canvas. */
  present(): void {
    const c = this.screenCtx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.screen.width, this.screen.height);
    c.drawImage(
      this.buffer,
      this.offsetX,
      this.offsetY,
      LOGICAL_W * this.scale,
      LOGICAL_H * this.scale,
    );
  }

  /** Convert a client (CSS px) coordinate into logical 320x200 space. */
  toLogical(clientX: number, clientY: number): Point {
    const rect = this.screen.getBoundingClientRect();
    const px = (clientX - rect.left) * (this.screen.width / rect.width);
    const py = (clientY - rect.top) * (this.screen.height / rect.height);
    return {
      x: Math.floor((px - this.offsetX) / this.scale),
      y: Math.floor((py - this.offsetY) / this.scale),
    };
  }
}
