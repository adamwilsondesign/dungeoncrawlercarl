/**
 * KQ5-ish menu scenes pushed onto the game's scene stack: a generic list
 * menu (settings, save/load slots, confirms, the death dialog), the
 * achievements panel, and the title screen. All keyboard + mouse, all
 * generated chrome — zero asset files.
 */

import type { AchievementDef, Point } from '../data/types';
import { drawPixelText } from './assets';
import { audio } from './audio';
import { isAdminMode, setAdminMode } from './layouts';
import type { Game, Scene } from './game';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import type { GameState } from './state';
import { el, getUi } from './ui';

const DIM = '#8fa3c4';
const LIT = '#ffe9a8';

/** Simple arrow cursor for menu scenes (the room scene draws verb cursors). */
export function drawMenuCursor(ctx: CanvasRenderingContext2D, p: Point): void {
  if (p.x < 0 || p.x >= LOGICAL_W || p.y < 0 || p.y >= LOGICAL_H) return;
  for (const [ox, oy, color] of [
    [1, 1, '#000000'],
    [0, 0, '#ffffff'],
  ] as const) {
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) ctx.fillRect(p.x + ox, p.y + i + oy, Math.min(i + 1, 4), 1);
  }
}

// ---------------------------------------------------------------------------
// Generic list menu - P20: DOM panel (settings, save/load, confirms, death)
// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  sub?: string;
  disabled?: boolean;
}

export interface ListMenuSpec {
  title: string;
  accent?: string;
  /** Text lines rendered above the items (e.g. the death reason). */
  body?: string[];
  items: MenuItem[];
  footer?: string;
  onPick: (index: number) => void;
  onCancel?: () => void;
}

export class ListMenuScene implements Scene {
  private selected = 0;
  private readonly backdrop: HTMLDivElement;
  private readonly rows: HTMLDivElement[] = [];
  private disposed = false;

  constructor(
    private readonly game: Game,
    private readonly spec: ListMenuSpec,
  ) {
    this.selected = this.spec.items.findIndex((i) => !i.disabled);
    if (this.selected < 0) this.selected = 0;

    const accent = spec.accent ?? 'var(--dcc-border-accent)';
    this.backdrop = el(
      'div',
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:32;display:flex;' +
        'align-items:center;justify-content:center;pointer-events:auto;cursor:auto',
    );
    this.backdrop.className = 'dcc-ui';
    const panel = el(
      'div',
      'min-width:380px;max-width:560px;max-height:80vh;overflow-y:auto;padding:16px 24px 12px;' +
        `background:var(--dcc-bg-panel);border:2px solid ${accent};display:flex;flex-direction:column`,
    );
    panel.className += ' dcc-scroll';
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    this.backdrop.addEventListener('mousedown', () => spec.onCancel?.());

    panel.appendChild(
      el(
        'div',
        `text-align:center;font-size:18px;font-weight:700;letter-spacing:1px;color:${accent};margin-bottom:8px`,
        spec.title,
      ),
    );
    for (const line of spec.body ?? []) {
      panel.appendChild(
        el('div', 'text-align:center;font-size:14px;color:var(--dcc-text-primary);margin:2px 0', line),
      );
    }
    const list = el('div', 'display:flex;flex-direction:column;gap:2px;margin:10px 0');
    this.spec.items.forEach((item, i) => {
      const row = el(
        'div',
        'padding:6px 12px;border-left:3px solid transparent;' +
          (item.disabled ? 'opacity:0.4;cursor:default' : 'cursor:pointer'),
      );
      row.dataset.menuItem = String(i);
      row.appendChild(el('div', 'font-size:15px', item.label));
      if (item.sub !== undefined) {
        row.appendChild(el('div', 'font-size:12px;color:var(--dcc-text-dim)', item.sub));
      }
      if (!item.disabled) {
        row.addEventListener('mouseenter', () => {
          this.selected = i;
          this.refresh();
        });
        row.addEventListener('mousedown', () => this.pick(i));
      }
      this.rows.push(row);
      list.appendChild(row);
    });
    panel.appendChild(list);
    if (spec.footer) {
      panel.appendChild(
        el('div', 'text-align:center;font-size:12px;color:var(--dcc-text-dim);margin-top:4px', spec.footer),
      );
    }
    this.backdrop.appendChild(panel);
    getUi(); // token stylesheet must exist
    document.body.appendChild(this.backdrop);
    this.refresh();
  }

  private refresh(): void {
    this.rows.forEach((row, i) => {
      const item = this.spec.items[i];
      const on = i === this.selected && !item.disabled;
      row.style.background = on ? 'rgba(255,233,168,0.10)' : 'transparent';
      row.style.borderLeftColor = on ? 'var(--dcc-gold)' : 'transparent';
      const label = row.firstElementChild;
      if (label instanceof HTMLElement) {
        label.style.color = item.disabled
          ? 'var(--dcc-text-dim)'
          : on
            ? 'var(--dcc-gold)'
            : 'var(--dcc-text-muted)';
      }
    });
  }

  private pick(i: number): void {
    const item = this.spec.items[i];
    if (!item || item.disabled) return;
    audio.playSfx('sfx_ui_click');
    this.spec.onPick(i);
  }

  private move(delta: number): void {
    const items = this.spec.items;
    let i = this.selected;
    for (let step = 0; step < items.length; step++) {
      i = (i + delta + items.length) % items.length;
      if (!items[i].disabled) {
        this.selected = i;
        this.refresh();
        this.rows[i]?.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backdrop.remove();
  }

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();
    input.clearClicks(); // pointer input is DOM-native
    input.consumeWheel();
    if (input.consumePress('Escape')) {
      this.spec.onCancel?.();
      return;
    }
    if (input.consumePress('ArrowUp')) this.move(-1);
    if (input.consumePress('ArrowDown')) this.move(1);
    if (input.consumePress('Enter') || input.consumePress('Space')) {
      this.pick(this.selected);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    void ctx; // fully DOM
  }
}

// ---------------------------------------------------------------------------
// Achievements panel - P20: DOM
// ---------------------------------------------------------------------------

export class AchievementsScene implements Scene {
  private readonly backdrop: HTMLDivElement;
  private disposed = false;

  constructor(
    private readonly game: Game,
    defs: Record<string, AchievementDef>,
    state: GameState,
  ) {
    this.backdrop = el(
      'div',
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:32;display:flex;' +
        'align-items:center;justify-content:center;pointer-events:auto;cursor:auto',
    );
    this.backdrop.className = 'dcc-ui';
    const panel = el(
      'div',
      'width:100%;max-width:640px;max-height:80vh;overflow-y:auto;margin:24px;padding:16px 24px;' +
        'background:var(--dcc-bg-panel);border:2px solid var(--dcc-gold);display:flex;flex-direction:column;gap:10px',
    );
    panel.className += ' dcc-scroll';
    panel.appendChild(
      el('div', 'text-align:center;font-size:18px;font-weight:700;letter-spacing:1px;color:var(--dcc-gold)', 'ACHIEVEMENTS'),
    );
    for (const def of Object.values(defs)) {
      const earned = Boolean(state.getFlag(`ach:${def.id}`));
      const name = earned ? def.name : def.hidden ? '???' : def.name;
      const desc = earned
        ? def.description
        : def.hidden
          ? 'Keep crawling. Or stop. It finds you either way.'
          : 'LOCKED';
      const row = el('div', earned ? '' : 'opacity:0.5');
      row.append(
        el('div', `font-size:15px;color:${earned ? 'var(--dcc-gold)' : 'var(--dcc-text-dim)'}`, name),
        el('div', 'font-size:13px;color:var(--dcc-text-muted)', desc),
      );
      panel.appendChild(row);
    }
    panel.appendChild(
      el('div', 'text-align:center;font-size:12px;color:var(--dcc-text-dim);margin-top:8px', 'CLICK OR ESC: CLOSE'),
    );
    this.backdrop.addEventListener('mousedown', () => this.game.popScene());
    this.backdrop.appendChild(panel);
    getUi();
    document.body.appendChild(this.backdrop);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backdrop.remove();
  }

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();
    input.clearClicks();
    if (input.consumePress('Escape') || input.consumePress('Enter')) {
      this.game.popScene();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    void ctx;
  }
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

export interface TitleHandlers {
  canContinue: () => boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onSettings: () => void;
  /** Hidden asset-CMS entry (unlabeled hotspot, bottom-right corner). */
  onOpenCms?: () => void;
}

export class TitleScene implements Scene {
  private selected = 0;
  private blinkMs = 0;
  private lastMouse: Point = { x: -1, y: -1 };

  constructor(
    private readonly game: Game,
    private readonly handlers: TitleHandlers,
  ) {}

  private items(): MenuItem[] {
    return [
      { label: 'NEW GAME' },
      { label: 'CONTINUE', disabled: !this.handlers.canContinue() },
      { label: 'SETTINGS' },
    ];
  }

  private rowRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: LOGICAL_W / 2 - 50, y: 128 + i * 14, w: 100, h: 12 };
  }

  private pick(i: number): void {
    audio.playSfx('sfx_ui_click');
    if (i === 0) this.handlers.onNewGame();
    else if (i === 1) this.handlers.onContinue();
    else this.handlers.onSettings();
  }

  update(dtMs: number): void {
    this.blinkMs += dtMs;
    // Same-id calls no-op, so this simply keeps the title theme current
    // whenever the title screen is active (incl. after the credits unwind).
    audio.playMusic('music_title');
    const input = this.game.input;
    const items = this.items();
    input.clearRightClicks();
    if (input.consumePress('ArrowUp')) {
      do this.selected = (this.selected + items.length - 1) % items.length;
      while (items[this.selected].disabled);
    }
    if (input.consumePress('ArrowDown')) {
      do this.selected = (this.selected + 1) % items.length;
      while (items[this.selected].disabled);
    }
    if (input.consumePress('Enter') || input.consumePress('Space')) {
      if (!items[this.selected].disabled) this.pick(this.selected);
      return;
    }
    const mouse = input.mouse;
    const mouseMoved = mouse.x !== this.lastMouse.x || mouse.y !== this.lastMouse.y;
    this.lastMouse = { x: mouse.x, y: mouse.y };
    if (mouseMoved) {
      items.forEach((item, i) => {
        const r = this.rowRect(i);
        if (!item.disabled && mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h) {
          this.selected = i;
        }
      });
    }
    const click = input.consumeClick();
    if (click) {
      // Hidden, unlabeled CMS hotspot: the bottom-right corner of the title.
      if (click.x >= LOGICAL_W - 22 && click.y >= LOGICAL_H - 14) {
        this.handlers.onOpenCms?.();
        return;
      }
      // Hidden admin-mode toggle (P18): the bottom-LEFT corner, complement
      // to the CMS corner. Per-browser flag; Shift+E in a room opens the
      // editor while it is on. The ADMIN chip below is the only feedback.
      if (click.x <= 22 && click.y >= LOGICAL_H - 14) {
        setAdminMode(!isAdminMode());
        audio.playSfx('sfx_ui_click');
        return;
      }
      items.forEach((item, i) => {
        const r = this.rowRect(i);
        if (!item.disabled && click.x >= r.x && click.x < r.x + r.w && click.y >= r.y && click.y < r.y + r.h) {
          this.pick(i);
        }
      });
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#080b14';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    // Faint floor grid backdrop
    ctx.fillStyle = '#101625';
    for (let gy = 120; gy < LOGICAL_H; gy += 12) ctx.fillRect(0, gy, LOGICAL_W, 1);

    drawPixelText(ctx, 'DUNGEON CRAWLER', LOGICAL_W / 2, 28, '#3fd9ff', 3, 'center');
    drawPixelText(ctx, 'CARL', LOGICAL_W / 2, 52, '#3fd9ff', 3, 'center');
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(LOGICAL_W / 2 - 70, 76, 140, 1);
    drawPixelText(ctx, 'THE FIRST FLOOR', LOGICAL_W / 2, 82, '#ffd166', 2, 'center');

    const items = this.items();
    items.forEach((item, i) => {
      const r = this.rowRect(i);
      const selected = i === this.selected && !item.disabled;
      const color = item.disabled ? '#37415a' : selected ? LIT : DIM;
      if (selected && Math.floor(this.blinkMs / 400) % 2 === 0) {
        drawPixelText(ctx, '>', r.x + 18, r.y + 2, LIT);
      }
      drawPixelText(ctx, item.label, LOGICAL_W / 2, r.y + 2, color, 1, 'center');
    });

    drawPixelText(ctx, 'PLACEHOLDER BUILD - ALL ART GENERATED', LOGICAL_W / 2, 188, '#37415a', 1, 'center');
    // Admin-mode indicator (P18): only ever visible once the hidden corner
    // hotspot has been toggled on - regular players never see it.
    if (isAdminMode()) {
      ctx.fillStyle = 'rgba(255,138,180,0.16)';
      ctx.fillRect(2, LOGICAL_H - 11, 34, 9);
      drawPixelText(ctx, 'ADMIN', 5, LOGICAL_H - 9, '#ff8ab4');
    }
    drawMenuCursor(ctx, this.game.input.mouse);
  }
}
