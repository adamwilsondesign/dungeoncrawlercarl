/**
 * Slide-in toasts (achievements, save confirmations): top-right corner,
 * elapsed-ms slide in / hold / slide out, queued when several fire together.
 * Visually distinct from narrator and dialogue boxes.
 */

import { drawPixelText, outlinedPanel, pixelTextWidth } from './assets';
import { LOGICAL_W } from './renderer';

interface Toast {
  title: string;
  sub: string;
  accent: string;
}

const SLIDE_MS = 250;
const HOLD_MS = 2600;
const HEIGHT = 22;

export class ToastManager {
  private readonly queue: Toast[] = [];
  private current: Toast | null = null;
  private t = 0;

  push(title: string, sub: string, accent = '#ffd166'): void {
    this.queue.push({ title, sub, accent });
  }

  update(dtMs: number): void {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return;
      this.current = next;
      this.t = 0;
    }
    this.t += dtMs;
    if (this.t >= SLIDE_MS + HOLD_MS + SLIDE_MS) {
      this.current = null;
      this.t = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const toast = this.current;
    if (!toast) return;

    // Slide progress: 0 offscreen (above), 1 fully shown
    let k = 1;
    if (this.t < SLIDE_MS) k = this.t / SLIDE_MS;
    else if (this.t > SLIDE_MS + HOLD_MS) k = 1 - (this.t - SLIDE_MS - HOLD_MS) / SLIDE_MS;
    k = Math.max(0, Math.min(1, k));

    const w = Math.max(pixelTextWidth(toast.title), pixelTextWidth(toast.sub)) + 14;
    const x = LOGICAL_W - w - 4;
    const y = Math.round(-HEIGHT + k * (HEIGHT + 4));

    outlinedPanel(ctx, x, y, w, HEIGHT, '#141020', toast.accent);
    ctx.fillStyle = toast.accent;
    ctx.fillRect(x, y, 3, HEIGHT);
    drawPixelText(ctx, toast.title, x + 7, y + 4, toast.accent);
    drawPixelText(ctx, toast.sub, x + 7, y + 12, '#e6eeff');
  }
}
