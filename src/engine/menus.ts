/**
 * KQ5-ish menu scenes pushed onto the game's scene stack: a generic list
 * menu (settings, save/load slots, confirms, the death dialog), the
 * achievements panel, and the title screen. All keyboard + mouse, all
 * generated chrome — zero asset files.
 */

import type { AchievementDef, Point } from '../data/types';
import { drawPixelText, outlinedPanel } from './assets';
import { audio } from './audio';
import { isAdminMode, setAdminMode } from './layouts';
import type { Game, Scene } from './game';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import type { GameState } from './state';

const PANEL_BG = '#0e1420';
const DIM = '#8fa3c4';
const LIT = '#ffe9a8';
const TEXT = '#e6eeff';

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
// Generic list menu
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

const MENU_W = 240;

export class ListMenuScene implements Scene {
  private selected = 0;
  private lastMouse: Point = { x: -1, y: -1 };

  constructor(
    private readonly game: Game,
    private readonly spec: ListMenuSpec,
  ) {
    this.selected = this.spec.items.findIndex((i) => !i.disabled);
    if (this.selected < 0) this.selected = 0;
  }

  private rowHeight(item: MenuItem): number {
    return item.sub !== undefined ? 17 : 10;
  }

  private layout(): { x: number; y: number; w: number; h: number; rows: Array<{ y: number; h: number }> } {
    const body = this.spec.body ?? [];
    let h = 16; // title zone
    h += body.length * 7 + (body.length > 0 ? 5 : 0);
    const rows: Array<{ y: number; h: number }> = [];
    let cursor = h;
    for (const item of this.spec.items) {
      const rh = this.rowHeight(item);
      rows.push({ y: cursor, h: rh });
      cursor += rh;
    }
    h = cursor + (this.spec.footer ? 12 : 6);
    const x = Math.floor((LOGICAL_W - MENU_W) / 2);
    const y = Math.floor((LOGICAL_H - h) / 2);
    return { x, y, w: MENU_W, h, rows: rows.map((r) => ({ y: r.y + y, h: r.h })) };
  }

  private move(delta: number): void {
    const items = this.spec.items;
    let i = this.selected;
    for (let step = 0; step < items.length; step++) {
      i = (i + delta + items.length) % items.length;
      if (!items[i].disabled) {
        this.selected = i;
        return;
      }
    }
  }

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();
    if (input.consumePress('Escape')) {
      this.spec.onCancel?.();
      return;
    }
    if (input.consumePress('ArrowUp')) this.move(-1);
    if (input.consumePress('ArrowDown')) this.move(1);
    if (input.consumePress('Enter') || input.consumePress('Space')) {
      const item = this.spec.items[this.selected];
      if (item && !item.disabled) {
        audio.playSfx('sfx_ui_click');
        this.spec.onPick(this.selected);
      }
      return;
    }

    const { rows, x, w } = this.layout();
    const mouse = input.mouse;
    // Hover only steals the selection when the mouse actually moves, so a
    // parked cursor never fights keyboard navigation.
    const mouseMoved = mouse.x !== this.lastMouse.x || mouse.y !== this.lastMouse.y;
    this.lastMouse = { x: mouse.x, y: mouse.y };
    if (mouseMoved) {
      const hoverRow = rows.findIndex(
        (r) => mouse.x >= x + 4 && mouse.x < x + w - 4 && mouse.y >= r.y && mouse.y < r.y + r.h,
      );
      if (hoverRow >= 0 && !this.spec.items[hoverRow].disabled) this.selected = hoverRow;
    }

    const click = input.consumeClick();
    if (click) {
      const row = rows.findIndex(
        (r) => click.x >= x + 4 && click.x < x + w - 4 && click.y >= r.y && click.y < r.y + r.h,
      );
      if (row >= 0 && !this.spec.items[row].disabled) {
        audio.playSfx('sfx_ui_click');
        this.spec.onPick(row);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const accent = this.spec.accent ?? '#3fd9ff';
    const { x, y, w, h, rows } = this.layout();

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    outlinedPanel(ctx, x, y, w, h, PANEL_BG, accent);
    drawPixelText(ctx, this.spec.title, x + w / 2, y + 5, accent, 1, 'center');

    const body = this.spec.body ?? [];
    for (let i = 0; i < body.length; i++) {
      drawPixelText(ctx, body[i], x + w / 2, y + 16 + i * 7, TEXT, 1, 'center');
    }

    this.spec.items.forEach((item, i) => {
      const row = rows[i];
      const selected = i === this.selected;
      const color = item.disabled ? '#4a586f' : selected ? LIT : DIM;
      if (selected && !item.disabled) {
        ctx.fillStyle = 'rgba(255,233,168,0.1)';
        ctx.fillRect(x + 4, row.y - 1, w - 8, row.h);
        drawPixelText(ctx, '>', x + 8, row.y + 1, LIT);
      }
      drawPixelText(ctx, item.label, x + 16, row.y + 1, color);
      if (item.sub !== undefined) {
        drawPixelText(ctx, item.sub.slice(0, 52), x + 16, row.y + 9, item.disabled ? '#3c4759' : '#7d90b0');
      }
    });

    if (this.spec.footer) {
      drawPixelText(ctx, this.spec.footer, x + w / 2, y + h - 9, DIM, 1, 'center');
    }
    drawMenuCursor(ctx, this.game.input.mouse);
  }
}

// ---------------------------------------------------------------------------
// Achievements panel
// ---------------------------------------------------------------------------

export class AchievementsScene implements Scene {
  constructor(
    private readonly game: Game,
    private readonly defs: Record<string, AchievementDef>,
    private readonly state: GameState,
  ) {}

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();
    if (
      input.consumePress('Escape') ||
      input.consumePress('Enter') ||
      input.consumeClick() !== null
    ) {
      this.game.popScene();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const x = 30;
    const y = 18;
    const w = LOGICAL_W - 60;
    const h = LOGICAL_H - 36;
    outlinedPanel(ctx, x, y, w, h, PANEL_BG, '#ffd166');
    drawPixelText(ctx, 'ACHIEVEMENTS', LOGICAL_W / 2, y + 5, '#ffd166', 1, 'center');

    const list = Object.values(this.defs);
    let rowY = y + 18;
    for (const def of list) {
      const earned = Boolean(this.state.getFlag(`ach:${def.id}`));
      const name = earned ? def.name : def.hidden ? '???' : def.name;
      const desc = earned
        ? def.description
        : def.hidden
          ? 'Keep crawling. Or stop. It finds you either way.'
          : 'LOCKED';
      drawPixelText(ctx, name, x + 8, rowY, earned ? '#ffd166' : '#5b6b85');
      drawPixelText(ctx, desc.slice(0, 62), x + 8, rowY + 7, earned ? TEXT : '#4a586f');
      rowY += 18;
      if (rowY > y + h - 20) break;
    }

    drawPixelText(ctx, 'CLICK OR ESC: CLOSE', LOGICAL_W / 2, y + h - 9, DIM, 1, 'center');
    drawMenuCursor(ctx, this.game.input.mouse);
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
