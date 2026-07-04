/**
 * Transient notifications (achievements, save confirmations, level-ups) -
 * P20: DOM toasts. They dock BELOW the top nav with a 12px gap, slide in
 * from the right, stack downward when several fire together, and
 * auto-dismiss after ~4s. Pure DOM; update() only ticks lifetimes, so the
 * game loop stays the single clock (no wall-time drift while paused).
 */

import { TopNav } from './iconbar';
import { el, type UiLayer } from './ui';

interface LiveToast {
  node: HTMLDivElement;
  ageMs: number;
}

const LIFE_MS = 4000;
const FADE_MS = 250;

export class ToastManager {
  private readonly host: HTMLDivElement;
  private readonly live: LiveToast[] = [];

  constructor(ui: UiLayer) {
    this.host = el(
      'div',
      `position:absolute;right:12px;top:${TopNav.HEIGHT + 12}px;display:flex;` +
        'flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none',
    );
    ui.layer('toasts').appendChild(this.host);
  }

  push(title: string, sub: string, accent = '#ffd166'): void {
    const node = el(
      'div',
      'background:#141020;border:1px solid ' + accent + ';border-left:4px solid ' + accent + ';' +
        'padding:6px 12px;max-width:340px;animation:dcc-slide-in 0.25s ease-out',
    );
    node.append(
      el('div', `font-size:14px;font-weight:700;color:${accent};letter-spacing:1px`, title),
      el('div', 'font-size:13px;color:var(--dcc-text-primary)', sub),
    );
    this.host.appendChild(node);
    this.live.push({ node, ageMs: 0 });
  }

  update(dtMs: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const toast = this.live[i];
      toast.ageMs += dtMs;
      if (toast.ageMs >= LIFE_MS) {
        toast.node.remove();
        this.live.splice(i, 1);
      } else if (toast.ageMs >= LIFE_MS - FADE_MS) {
        toast.node.style.opacity = String(Math.max(0, (LIFE_MS - toast.ageMs) / FADE_MS));
      }
    }
  }

  /** Legacy no-op: toasts are DOM now; nothing draws into the canvas. */
  render(ctx: CanvasRenderingContext2D): void {
    void ctx;
  }
}
