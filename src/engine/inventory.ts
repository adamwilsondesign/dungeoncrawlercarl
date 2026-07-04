/**
 * The INVENTORY screen - P20: a full-screen DOM overlay matching the party
 * screen's visual language. Header (title + gold + close) > per-member
 * equipped summary rows, written out in full > a large item grid (56px
 * icons, full wrapping names, stack counts) > clicking a cell opens an
 * inline detail panel with the description and VISIBLE action buttons:
 * TAKE IN HAND (the world-use flow), EQUIP ON <member>, COMBINE WITH the
 * held item. ESC or a backdrop click closes.
 *
 * Owned by RoomScene (not a Scene): ESC and input gating stay in the room's
 * update; every pointer interaction here is DOM-native.
 */

import type { CombatantDef, InventoryEntry, ItemDef } from '../data/types';
import type { LoadedImage } from './assets';
import type { GameState } from './state';
import { el, getUi } from './ui';

export interface InventoryDeps {
  state: GameState;
  items: Record<string, ItemDef>;
  combatants: Record<string, CombatantDef>;
  icons: ReadonlyMap<string, LoadedImage>;
  /** Take the item in hand for world use (closes the screen). */
  onHold: (id: string) => void;
  /** Combine the held item with another (P8 recipes; closes the screen). */
  onCombine: (a: string, b: string) => void;
  /** Equip an item onto a member (stays open; grid refreshes). */
  onEquip: (memberId: string, itemId: string) => void;
}

function iconCanvas(image: LoadedImage | undefined, sizePx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image?.width ?? 24;
  canvas.height = image?.height ?? 24;
  canvas.style.cssText = `width:${sizePx}px;height:${sizePx}px;image-rendering:pixelated`;
  const ctx = canvas.getContext('2d');
  if (ctx && image) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
  }
  return canvas;
}

export class InventoryScreen {
  private visible = false;
  private selectedId: string | null = null;
  private readonly backdrop: HTMLDivElement;
  private readonly column: HTMLDivElement;

  constructor(private readonly deps: InventoryDeps) {
    this.backdrop = el(
      'div',
      'position:fixed;inset:0;background:rgba(8,11,20,0.85);z-index:30;display:none;' +
        'justify-content:center;pointer-events:auto;cursor:auto',
    );
    this.backdrop.className = 'dcc-ui';
    this.column = el(
      'div',
      'width:100%;max-width:900px;margin:24px;padding:24px 32px;display:flex;flex-direction:column;' +
        'background:var(--dcc-bg-panel);border:2px solid var(--dcc-border-accent);overflow-y:auto',
    );
    this.column.className += ' dcc-scroll';
    this.column.addEventListener('mousedown', (e) => e.stopPropagation());
    this.backdrop.addEventListener('mousedown', () => this.close());
    this.backdrop.appendChild(this.column);
    // Above the in-playfield layers, below CMS/editor document overlays.
    getUi(); // ensure the token stylesheet exists before we show anything
    document.body.appendChild(this.backdrop);
  }

  get open(): boolean {
    return this.visible;
  }

  show(): void {
    this.visible = true;
    this.selectedId = null;
    this.backdrop.style.display = 'flex';
    this.renderPage();
  }

  close(): void {
    this.visible = false;
    this.backdrop.style.display = 'none';
  }

  /** Rebuild the whole page from live state (coarse; the screen is modal). */
  private renderPage(): void {
    const { state, items, combatants } = this.deps;
    this.column.replaceChildren();

    // Header: title, gold, close
    const header = el('div', 'display:flex;align-items:center;gap:16px');
    const title = el('div', 'flex:1', 'INVENTORY');
    title.className = 'dcc-title';
    const gold = el('div', 'font-size:16px;color:var(--dcc-gold);letter-spacing:1px', `GOLD: ${state.gold}`);
    const close = document.createElement('button');
    close.className = 'dcc-close';
    close.textContent = 'X';
    close.addEventListener('click', () => this.close());
    header.append(title, gold, close);
    this.column.appendChild(header);

    // Equipped summary, one full row per member - no cryptic abbreviations.
    const summary = el('div', 'margin:12px 0 16px;display:flex;flex-direction:column;gap:4px');
    for (const memberId of state.party) {
      const name = combatants[memberId]?.shortName ?? combatants[memberId]?.name ?? memberId.toUpperCase();
      const slots = state.getEquipped(memberId);
      const nameOf = (id?: string): string => (id ? items[id]?.name ?? id.toUpperCase() : 'nothing');
      summary.appendChild(
        el(
          'div',
          'font-size:13px;color:var(--dcc-text-muted);background:var(--dcc-bg-inset);' +
            'border:1px solid var(--dcc-border);padding:4px 12px;white-space:pre-wrap',
          `${name} - Weapon: ${nameOf(slots.weapon)}   Armor: ${nameOf(slots.armor)}   Trinket: ${nameOf(slots.trinket)}`,
        ),
      );
    }
    this.column.appendChild(summary);

    const entries = state.inventory;
    if (entries.length === 0) {
      this.column.appendChild(
        el('div', 'text-align:center;margin:48px 0;font-size:15px;color:var(--dcc-parchment)', 'Nothing yet.'),
      );
    } else {
      const main = el('div', 'display:flex;gap:24px;align-items:flex-start');
      main.appendChild(this.buildGrid(entries));
      if (this.selectedId) main.appendChild(this.buildDetail(this.selectedId));
      this.column.appendChild(main);
    }

    this.column.appendChild(
      el(
        'div',
        'margin-top:24px;text-align:center;font-size:12px;color:var(--dcc-text-dim)',
        'CLICK AN ITEM FOR ACTIONS    ESC: CLOSE',
      ),
    );
  }

  private buildGrid(entries: readonly InventoryEntry[]): HTMLDivElement {
    const { items, state } = this.deps;
    const grid = el(
      'div',
      'flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px',
    );
    for (const entry of entries) {
      const item = items[entry.id];
      const held = state.heldItem === entry.id;
      const selected = this.selectedId === entry.id;
      const cell = el(
        'div',
        'display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;cursor:pointer;' +
          'position:relative;background:var(--dcc-bg-inset);border:1px solid ' +
          (selected ? 'var(--dcc-gold)' : held ? 'var(--dcc-border-accent)' : 'var(--dcc-border)'),
      );
      cell.dataset.item = entry.id;
      cell.appendChild(iconCanvas(this.deps.icons.get(entry.id), 56));
      cell.appendChild(
        el(
          'div',
          'font-size:13px;text-align:center;overflow-wrap:anywhere;color:var(--dcc-text-primary)',
          item?.name ?? entry.id.toUpperCase(),
        ),
      );
      if (entry.count > 1) {
        cell.appendChild(
          el('span', 'position:absolute;top:4px;right:6px;font-size:12px;color:var(--dcc-cyan)', `x${entry.count}`),
        );
      }
      if (held) {
        cell.appendChild(
          el('span', 'position:absolute;top:4px;left:6px;font-size:11px;color:var(--dcc-cyan)', 'IN HAND'),
        );
      }
      cell.addEventListener('click', () => {
        this.selectedId = this.selectedId === entry.id ? null : entry.id;
        this.renderPage();
      });
      grid.appendChild(cell);
    }
    return grid;
  }

  private buildDetail(itemId: string): HTMLDivElement {
    const { items, state, combatants } = this.deps;
    const item = items[itemId];
    const panel = el(
      'div',
      'width:280px;flex:none;padding:16px;background:var(--dcc-bg-primary);border:1px solid var(--dcc-gold);' +
        'display:flex;flex-direction:column;gap:12px',
    );
    panel.dataset.detail = itemId;
    panel.appendChild(
      el('div', 'font-size:16px;font-weight:700;color:var(--dcc-gold)', item?.name ?? itemId.toUpperCase()),
    );
    panel.appendChild(el('div', 'font-size:13px;color:var(--dcc-text-muted)', item?.description ?? 'The dungeon shrugs.'));
    if (item?.use) {
      panel.appendChild(
        el('div', 'font-size:12px;color:var(--dcc-text-dim)', 'Combat consumable: usable from the ITEM menu in battle.'),
      );
    }

    const button = (label: string, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'dcc-btn';
      b.textContent = label;
      b.style.cssText += ';width:100%;text-align:left';
      b.addEventListener('click', onClick);
      return b;
    };

    const held = state.heldItem;
    if (held && held !== itemId) {
      const heldName = items[held]?.name ?? held.toUpperCase();
      panel.appendChild(button(`COMBINE WITH ${heldName}`, () => this.deps.onCombine(held, itemId)));
    }
    if (held === itemId) {
      panel.appendChild(
        button('PUT AWAY', () => {
          state.heldItem = null;
          this.renderPage();
        }),
      );
    } else {
      panel.appendChild(button('TAKE IN HAND (use in the world)', () => this.deps.onHold(itemId)));
    }
    if (item?.equip) {
      for (const memberId of state.party) {
        const name = combatants[memberId]?.shortName ?? memberId.toUpperCase();
        panel.appendChild(
          button(`EQUIP ON ${name}`, () => {
            this.deps.onEquip(memberId, itemId);
            this.renderPage();
          }),
        );
      }
    }
    return panel;
  }

  /** Legacy no-op: the screen is DOM now. */
  render(ctx: CanvasRenderingContext2D): void {
    void ctx;
  }
}
