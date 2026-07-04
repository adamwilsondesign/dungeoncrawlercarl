/**
 * The top nav (P20: DOM rebuild). Left to right:
 *   [AREA NAME]  [LIVE n]            [INVENTORY] [PARTY] [MENU]
 * Rendered as crisp native-resolution HTML above the canvas: a solid-backdrop
 * bar (~48px CSS) docked to the top of the playfield. The AREA NAME chip is a
 * static label (visually distinct from the buttons); the three buttons carry
 * a small canvas-drawn glyph + a text label. The LIVE viewer counter (the
 * diegetic score) rides here too once the show has premiered.
 */

import type { UiGlyph } from '../data/types';
import { drawUiGlyph } from './assets';
import { el, type UiLayer } from './ui';

export type BarAction = 'inventory' | 'party' | 'settings';

const NAV_H = 48;

function glyphCanvas(glyph: UiGlyph): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 12;
  canvas.height = 12;
  canvas.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;flex:none';
  const ctx = canvas.getContext('2d');
  if (ctx) drawUiGlyph(ctx, glyph, 0, 0, '#cfe0ff');
  return canvas;
}

export class TopNav {
  private readonly bar: HTMLDivElement;
  private readonly areaChip: HTMLSpanElement;
  private readonly liveChip: HTMLSpanElement;
  private readonly liveCount: HTMLSpanElement;

  constructor(ui: UiLayer, onAction: (action: BarAction) => void) {
    this.bar = el(
      'div',
      [
        'position:absolute', 'left:0', 'right:0', 'top:0', `height:${NAV_H}px`,
        'display:flex', 'align-items:center', 'gap:8px', 'padding:0 12px',
        'background:var(--dcc-bg-primary)', 'border-bottom:2px solid var(--dcc-border)',
        'pointer-events:auto', 'cursor:auto',
      ].join(';'),
    );

    // AREA NAME: a static label, deliberately not button-styled.
    this.areaChip = el(
      'span',
      'font-size:14px;color:var(--dcc-text-muted);letter-spacing:1px;padding:4px 10px;' +
        'border-left:3px solid var(--dcc-border);white-space:nowrap;overflow:hidden;' +
        'text-overflow:ellipsis;max-width:40%',
      '',
    );

    // LIVE viewer count (diegetic score); hidden until the premiere.
    this.liveChip = el(
      'span',
      'display:none;align-items:center;gap:6px;font-size:13px;color:#ffd9d9;' +
        'padding:3px 8px;background:var(--dcc-bg-inset);border:1px solid var(--dcc-border)',
    );
    const dot = el('span', 'width:8px;height:8px;background:var(--dcc-danger);animation:dcc-blink 1.2s infinite');
    this.liveCount = el('span', '', 'LIVE 0');
    this.liveChip.append(dot, this.liveCount);

    const spacer = el('span', 'flex:1');

    const button = (glyph: UiGlyph, label: string, action: BarAction): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'dcc-btn';
      b.dataset.nav = action;
      b.style.cssText +=
        ';display:flex;align-items:center;gap:8px;height:34px;padding:0 14px;font-size:14px;letter-spacing:1px';
      b.append(glyphCanvas(glyph), document.createTextNode(label));
      b.addEventListener('click', () => onAction(action));
      return b;
    };

    this.bar.append(
      this.areaChip,
      this.liveChip,
      spacer,
      button('inventory', 'INVENTORY', 'inventory'),
      button('party', 'PARTY', 'party'),
      button('settings', 'MENU', 'settings'),
    );
    ui.layer('nav').appendChild(this.bar);
    this.setVisible(false);
  }

  /** Nav height in CSS px (other layers dock beneath it). */
  static readonly HEIGHT = NAV_H;

  setArea(label: string): void {
    if (this.areaChip.textContent !== label) this.areaChip.textContent = label;
  }

  setViews(views: number): void {
    if (views > 0) {
      this.liveChip.style.display = 'flex';
      const text = `LIVE ${views.toLocaleString('en-US')}`;
      if (this.liveCount.textContent !== text) this.liveCount.textContent = text;
    } else {
      this.liveChip.style.display = 'none';
    }
  }

  setVisible(on: boolean): void {
    this.bar.style.display = on ? 'flex' : 'none';
  }
}
