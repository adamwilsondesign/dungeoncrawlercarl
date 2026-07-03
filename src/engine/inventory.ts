/**
 * Full-screen KQ5-ish inventory grid. Clicking a slot selects the item as
 * the held ITEM (the scene switches the cursor and closes the screen);
 * right-clicking a slot shows the item's in-voice description (P19: the
 * LOOK verb no longer exists as a mode). Esc or the X button closes.
 */

import type { InventoryEntry, ItemDef, Point, Rect } from '../data/types';
import { drawPixelText, ITEM_ICON_SIZE, outlinedPanel, type LoadedImage } from './assets';
import { LOGICAL_H, LOGICAL_W } from './renderer';

export type InventoryAction =
  | { kind: 'close' }
  | { kind: 'select'; id: string }
  | { kind: 'look'; id: string }
  | { kind: 'equip'; id: string }
  /** Held item + clicked slot: try the combines registry (P8). */
  | { kind: 'combine'; a: string; b: string }
  /** Clicked the currently-held slot: cancel the hold (P9 UX fix). */
  | { kind: 'unhold' };

const PANEL: Rect = { x: 8, y: 12, w: LOGICAL_W - 16, h: LOGICAL_H - 24 };
const CLOSE: Rect = { x: PANEL.x + PANEL.w - 16, y: PANEL.y + 3, w: 12, h: 10 };
const COLS = 6;
const ROWS = 3;
const CELL_W = 46;
const CELL_H = 40;
const CELL_GAP = 3;
const GRID_X = 16;
const GRID_Y = 34;

const ACCENT = '#3fd9ff';

function slotRect(i: number): Rect {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: GRID_X + col * (CELL_W + CELL_GAP),
    y: GRID_Y + row * (CELL_H + CELL_GAP),
    w: CELL_W,
    h: CELL_H,
  };
}

function inRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export class InventoryScreen {
  private visible = false;

  get open(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  /**
   * Resolve a click into an action: `examine` (right-click, P19) shows the
   * in-voice description; with an item already held, clicking a DIFFERENT
   * slot is a combine intent (P8); equipment items EQUIP; anything else
   * selects as the held ITEM.
   */
  actionAt(
    p: Point,
    examine: boolean,
    entries: readonly InventoryEntry[],
    defs: Record<string, ItemDef>,
    heldItem: string | null = null,
  ): InventoryAction | null {
    if (inRect(p, CLOSE)) return { kind: 'close' };
    for (let i = 0; i < Math.min(entries.length, COLS * ROWS); i++) {
      if (inRect(p, slotRect(i))) {
        const id = entries[i].id;
        if (examine) return { kind: 'look', id };
        if (heldItem && heldItem === id) return { kind: 'unhold' };
        if (heldItem && heldItem !== id) return { kind: 'combine', a: heldItem, b: id };
        if (defs[id]?.equip) return { kind: 'equip', id };
        return { kind: 'select', id };
      }
    }
    return null;
  }

  render(
    ctx: CanvasRenderingContext2D,
    entries: readonly InventoryEntry[],
    defs: Record<string, ItemDef>,
    icons: ReadonlyMap<string, LoadedImage>,
    heldItem: string | null,
    equipSummary: readonly string[] = [],
    gold = 0,
  ): void {
    if (!this.visible) return;

    // Dim the room, then the panel
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    outlinedPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, '#0e1420', ACCENT);

    drawPixelText(ctx, 'INVENTORY', LOGICAL_W / 2, PANEL.y + 5, ACCENT, 2, 'center');
    drawPixelText(ctx, `GOLD: ${gold}`, PANEL.x + 8, PANEL.y + 7, '#ffd166');
    equipSummary.slice(0, 2).forEach((line, i) => {
      drawPixelText(ctx, line.slice(0, 72), PANEL.x + 8, PANEL.y + 15 + i * 7, '#7d90b0');
    });

    // Close button
    ctx.fillStyle = '#1b2432';
    ctx.fillRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h);
    drawPixelText(ctx, 'X', CLOSE.x + CLOSE.w / 2, CLOSE.y + 3, '#ff8f8f', 1, 'center');

    if (entries.length === 0) {
      drawPixelText(
        ctx,
        'NOTHING YET. THE AUDIENCE LAUGHS.',
        LOGICAL_W / 2,
        GRID_Y + 50,
        '#8fa3c4',
        1,
        'center',
      );
    }

    for (let i = 0; i < Math.min(entries.length, COLS * ROWS); i++) {
      const entry = entries[i];
      const r = slotRect(i);
      const held = entry.id === heldItem;
      ctx.fillStyle = '#131a26';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = held ? ACCENT : '#39465e';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      const icon = icons.get(entry.id);
      if (icon) {
        ctx.drawImage(icon, r.x + Math.floor((r.w - ITEM_ICON_SIZE) / 2), r.y + 3);
      }
      const def = defs[entry.id];
      const name = def?.name ?? entry.id.toUpperCase();
      drawPixelText(ctx, name.slice(0, 11), r.x + r.w / 2, r.y + r.h - 8, '#d8ecff', 1, 'center');
      if (def?.equip) drawPixelText(ctx, 'E', r.x + 3, r.y + 3, ACCENT);
      if (entry.count > 1) {
        drawPixelText(ctx, `X${entry.count}`, r.x + r.w - 3 - (String(entry.count).length + 1) * 4 + 1, r.y + 3, ACCENT);
      }
    }

    drawPixelText(
      ctx,
      'CLICK: TAKE/EQUIP - RIGHT-CLICK: EXAMINE - ESC: CLOSE',
      LOGICAL_W / 2,
      PANEL.y + PANEL.h - 10,
      '#8fa3c4',
      1,
      'center',
    );
  }
}
