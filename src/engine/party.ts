/**
 * The PARTY screen - P20: a full-screen DOM overlay at native resolution.
 * Layout: dark backdrop (game peeks through) > centered column (max 900px) >
 * header (title + close) > member tabs > two columns: paper doll with the
 * member's actor sprite scaled crunchy + three clickable equip-slot cards
 * (left, ~40%), and the stat readout (right, ~60%): level + XP bar, HP/MP
 * bars, core-stat grid, attack/defense mods, skills, status. Bottom footer
 * carries the hotkeys. ESC or a backdrop click closes; arrows switch member.
 *
 * Still a Scene: keyboard flows through update() via the game loop, DOM
 * handles pointer input, dispose() tears the overlay down when popped.
 */

import type { CombatantDef, EquipSlot, ItemDef, SkillDef } from '../data/types';
import { loadImage, type LoadedImage } from './assets';
import { knownSkills, leveledStats } from './combat';
import type { Game, Scene } from './game';
import { el } from './ui';
import { xpForLevel, type GameState } from './state';

export interface PartyDeps {
  state: GameState;
  combatants: Record<string, CombatantDef>;
  items: Record<string, ItemDef>;
  skills: Record<string, SkillDef>;
  itemIcons: ReadonlyMap<string, LoadedImage>;
}

const SLOTS: ReadonlyArray<{ slot: EquipSlot; label: string }> = [
  { slot: 'weapon', label: 'WEAPON' },
  { slot: 'armor', label: 'ARMOR' },
  { slot: 'trinket', label: 'TRINKET' },
];

/** Sprite sheets are 3x3 frame grids; frame 0 is the idle-down pose. */
function spriteCanvas(image: LoadedImage, heightPx: number): HTMLCanvasElement {
  const fw = Math.max(1, Math.floor(image.width / 3));
  const fh = Math.max(1, Math.floor(image.height / 3));
  const canvas = document.createElement('canvas');
  canvas.width = fw;
  canvas.height = fh;
  const scale = heightPx / fh;
  canvas.style.cssText = `width:${Math.round(fw * scale)}px;height:${heightPx}px;image-rendering:pixelated`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, fw, fh, 0, 0, fw, fh);
  }
  return canvas;
}

function iconCanvas(image: LoadedImage | undefined, sizePx: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image?.width ?? 24;
  canvas.height = image?.height ?? 24;
  canvas.style.cssText = `width:${sizePx}px;height:${sizePx}px;image-rendering:pixelated;flex:none`;
  const ctx = canvas.getContext('2d');
  if (ctx && image) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);
  }
  return canvas;
}

function bar(fillFrac: number, color: string, label: string): HTMLDivElement {
  const wrap = el('div', 'display:flex;align-items:center;gap:12px;margin:4px 0');
  const track = el(
    'div',
    'flex:1;height:14px;background:var(--dcc-bg-inset);border:1px solid var(--dcc-border);position:relative',
  );
  const fill = el(
    'div',
    `position:absolute;left:1px;top:1px;bottom:1px;width:${Math.round(Math.max(0, Math.min(1, fillFrac)) * 100)}%;background:${color}`,
  );
  track.appendChild(fill);
  const text = el('span', 'font-size:14px;color:var(--dcc-text-primary);white-space:nowrap', label);
  wrap.append(track, text);
  return wrap;
}

export class PartyScene implements Scene {
  private tab = 0;
  private pickerSlot: EquipSlot | null = null;
  private pickerIndex = 0;
  private readonly backdrop: HTMLDivElement;
  private readonly column: HTMLDivElement;
  private disposed = false;

  constructor(
    private readonly game: Game,
    private readonly deps: PartyDeps,
  ) {
    this.backdrop = el(
      'div',
      'position:fixed;inset:0;background:rgba(8,11,20,0.85);z-index:30;display:flex;' +
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
    document.body.appendChild(this.backdrop);
    void this.renderPage();
  }

  private members(): string[] {
    return this.deps.state.party;
  }

  private memberId(): string {
    const list = this.members();
    this.tab = Math.max(0, Math.min(this.tab, list.length - 1));
    return list[this.tab] ?? 'carl';
  }

  private eligible(slot: EquipSlot): string[] {
    const { state, items } = this.deps;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const entry of state.inventory) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      if (items[entry.id]?.equip?.slot === slot) out.push(entry.id);
    }
    return out;
  }

  private close(): void {
    this.game.popScene(); // dispose() removes the DOM
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.backdrop.remove();
  }

  // --- page render ------------------------------------------------------------

  private async renderPage(): Promise<void> {
    const { state, combatants, items, skills } = this.deps;
    const id = this.memberId();
    const def = combatants[id];
    if (!def || this.disposed) return;

    this.column.replaceChildren();

    // Header: title + close
    const header = el('div', 'display:flex;align-items:center;justify-content:space-between');
    const title = el('div', '', 'PARTY');
    title.className = 'dcc-title';
    const close = document.createElement('button');
    close.className = 'dcc-close';
    close.textContent = 'X';
    close.addEventListener('click', () => this.close());
    header.append(title, close);

    // Tabs
    const tabs = el('div', 'display:flex;gap:8px;margin:12px 0 24px');
    this.members().forEach((memberId, i) => {
      const cdef = combatants[memberId];
      const b = document.createElement('button');
      b.className = 'dcc-btn';
      b.dataset.tab = memberId;
      b.textContent = cdef?.shortName ?? cdef?.name ?? memberId.toUpperCase();
      b.style.cssText +=
        ';font-size:16px;padding:6px 20px;letter-spacing:1px' +
        (i === this.tab
          ? ';background:#22314a;border:1px solid var(--dcc-border-accent);color:var(--dcc-gold)'
          : '');
      b.addEventListener('click', () => {
        this.tab = i;
        this.pickerSlot = null;
        void this.renderPage();
      });
      tabs.appendChild(b);
    });

    // --- LEFT: paper doll ------------------------------------------------------
    const left = el('div', 'width:40%;display:flex;flex-direction:column;gap:12px');
    const dollBox = el(
      'div',
      'display:flex;justify-content:center;align-items:flex-end;height:220px;' +
        'background:var(--dcc-bg-inset);border:1px solid var(--dcc-border);padding:10px',
    );
    const sheet = await loadImage(def.sprite, {
      kind: 'actor',
      label: def.shortName ?? def.name,
      color: def.color,
      frameW: 24,
      frameH: 32,
      outfit: def.outfit,
    });
    if (this.disposed) return;
    dollBox.appendChild(spriteCanvas(sheet, 200));
    left.appendChild(dollBox);

    const equipped = state.getEquipped(id);
    for (const spec of SLOTS) {
      const itemId = equipped[spec.slot];
      const item = itemId ? items[itemId] : undefined;
      const rowBtn = el(
        'div',
        'display:flex;align-items:center;gap:12px;padding:8px 12px;cursor:pointer;' +
          'background:var(--dcc-bg-inset);border:1px solid ' +
          (item ? 'var(--dcc-border-accent)' : 'var(--dcc-border)') +
          (item ? '' : ';opacity:0.66'),
      );
      rowBtn.dataset.slot = spec.slot;
      rowBtn.append(
        el('span', 'font-size:12px;color:var(--dcc-text-dim);width:64px;flex:none;letter-spacing:1px', spec.label),
        iconCanvas(item ? this.deps.itemIcons.get(item.id) : undefined, 40),
        el(
          'span',
          'font-size:14px;flex:1;min-width:0;overflow-wrap:anywhere;' +
            (item ? 'color:var(--dcc-text-primary)' : 'color:var(--dcc-text-dim)'),
          item ? item.name : 'EMPTY',
        ),
      );
      rowBtn.addEventListener('click', () => {
        this.pickerSlot = this.pickerSlot === spec.slot ? null : spec.slot;
        this.pickerIndex = 0;
        void this.renderPage();
      });
      left.appendChild(rowBtn);

      // Inline picker under the active slot row
      if (this.pickerSlot === spec.slot) {
        left.appendChild(this.buildPicker(spec.slot));
      }
    }

    // --- RIGHT: stat readout ---------------------------------------------------
    const right = el('div', 'width:60%;display:flex;flex-direction:column');
    const stats = leveledStats(def.stats, state.level);
    let atk = 0;
    let defense = 0;
    for (const slotId of Object.values(equipped)) {
      const eq = slotId ? items[slotId]?.equip : undefined;
      if (!eq) continue;
      atk += eq.attack ?? 0;
      defense += eq.defense ?? 0;
      for (const [stat, delta] of Object.entries(eq.statMods ?? {})) {
        if (delta === undefined) continue;
        if (stat === 'maxHp') stats.maxHp += delta;
        else if (stat === 'maxMp') stats.maxMp = (stats.maxMp ?? 0) + delta;
        else if (stat === 'str' || stat === 'dex' || stat === 'con' || stat === 'int' || stat === 'spd') {
          stats[stat] += delta;
        }
      }
    }
    const base = xpForLevel(state.level);
    const next = xpForLevel(state.level + 1);

    const levelHead = el('div', 'font-size:22px;font-weight:700;color:var(--dcc-gold)', `LEVEL ${state.level}`);
    right.appendChild(levelHead);
    right.appendChild(
      bar((state.xp - base) / Math.max(1, next - base), 'var(--dcc-notify)', `XP ${state.xp - base}/${next - base}`),
    );
    right.appendChild(bar(1, 'var(--dcc-danger)', `HP ${stats.maxHp}/${stats.maxHp}`));
    right.appendChild(bar(1, 'var(--dcc-cyan)', `MP ${stats.maxMp ?? 0}/${stats.maxMp ?? 0}`));

    const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:12px 0;font-size:14px');
    for (const [label, value] of [
      ['STR', stats.str],
      ['DEX', stats.dex],
      ['CON', stats.con],
      ['INT', stats.int],
      ['SPD', stats.spd],
    ] as const) {
      const cell = el(
        'div',
        'display:flex;justify-content:space-between;background:var(--dcc-bg-inset);padding:3px 10px;border:1px solid var(--dcc-border)',
      );
      cell.append(el('span', 'color:var(--dcc-text-muted)', label), el('span', 'color:var(--dcc-text-primary)', String(value)));
      grid.appendChild(cell);
    }
    right.appendChild(grid);
    right.appendChild(el('div', 'font-size:14px;color:var(--dcc-text-muted)', `ATTACK +${atk}   DEFENSE +${defense}`));

    const skillsHead = el('div', '', 'SKILLS');
    skillsHead.className = 'dcc-section';
    right.appendChild(skillsHead);
    const skillIds = [...knownSkills(def, state.level), ...(state.extraSkills[id] ?? [])];
    if (skillIds.length === 0) {
      right.appendChild(el('div', 'font-size:14px;color:var(--dcc-text-dim)', '(none yet)'));
    }
    for (const sid of skillIds) {
      const sk = skills[sid];
      if (!sk) continue;
      const rowEl = el('div', 'margin-bottom:6px');
      const meta = [sk.mpCost ? `${sk.mpCost} MP` : null, sk.cooldown ? `CD ${sk.cooldown}` : null]
        .filter(Boolean)
        .join('  ');
      rowEl.append(
        el('div', 'font-size:14px;color:var(--dcc-text-primary)', `${sk.name}${meta ? `  -  ${meta}` : ''}`),
        el('div', 'font-size:12px;color:var(--dcc-text-dim)', sk.description),
      );
      right.appendChild(rowEl);
    }

    const statusHead = el('div', '', 'STATUS');
    statusHead.className = 'dcc-section';
    right.append(statusHead, el('div', 'font-size:14px;color:var(--dcc-text-dim)', 'none (out of combat)'));

    const main = el('div', 'display:flex;gap:32px;flex:1;align-items:flex-start');
    main.append(left, right);

    const footer = el(
      'div',
      'margin-top:24px;text-align:center;font-size:12px;color:var(--dcc-text-dim)',
      '← → : SWITCH MEMBER    ESC: CLOSE',
    );

    this.column.append(header, tabs, main, footer);
  }

  private buildPicker(slot: EquipSlot): HTMLDivElement {
    const { items } = this.deps;
    const options = this.eligible(slot);
    const panel = el('div', 'background:var(--dcc-bg-primary);border:1px solid var(--dcc-gold);padding:8px 12px');
    panel.dataset.picker = slot;
    panel.appendChild(
      el('div', 'font-size:12px;color:var(--dcc-gold);letter-spacing:1px;margin-bottom:6px', `EQUIP ${slot.toUpperCase()}`),
    );
    if (options.length === 0) {
      panel.appendChild(el('div', 'font-size:13px;color:var(--dcc-text-dim)', 'Nothing eligible in the pack.'));
    }
    options.forEach((itemId, i) => {
      const item = items[itemId];
      const rowEl = el(
        'div',
        'display:flex;align-items:center;gap:10px;padding:5px 8px;cursor:pointer;font-size:14px;' +
          (i === this.pickerIndex
            ? 'background:rgba(255,233,168,0.10);color:var(--dcc-gold)'
            : 'color:var(--dcc-text-primary)'),
      );
      rowEl.dataset.pick = itemId;
      rowEl.append(
        iconCanvas(this.deps.itemIcons.get(itemId), 28),
        el('span', 'overflow-wrap:anywhere', item?.name ?? itemId.toUpperCase()),
      );
      rowEl.addEventListener('click', () => this.equip(slot, itemId));
      panel.appendChild(rowEl);
    });
    const cancel = el('div', 'padding:5px 8px;cursor:pointer;font-size:13px;color:var(--dcc-text-dim)', 'CANCEL');
    cancel.addEventListener('click', () => {
      this.pickerSlot = null;
      void this.renderPage();
    });
    panel.appendChild(cancel);
    return panel;
  }

  private equip(slot: EquipSlot, itemId: string): void {
    if (this.deps.items[itemId]?.equip) this.deps.state.equipItem(this.memberId(), itemId, slot);
    this.pickerSlot = null;
    void this.renderPage();
  }

  // --- Scene ------------------------------------------------------------------

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();
    input.clearClicks(); // pointer input is DOM-native here
    input.consumeWheel();

    if (input.consumePress('Escape')) {
      if (this.pickerSlot) {
        this.pickerSlot = null;
        void this.renderPage();
      } else this.close();
      return;
    }

    if (this.pickerSlot) {
      const options = this.eligible(this.pickerSlot);
      if (input.consumePress('ArrowUp') && options.length > 0) {
        this.pickerIndex = (this.pickerIndex + options.length - 1) % options.length;
        void this.renderPage();
      }
      if (input.consumePress('ArrowDown') && options.length > 0) {
        this.pickerIndex = (this.pickerIndex + 1) % options.length;
        void this.renderPage();
      }
      if (input.consumePress('Enter')) {
        const pick = options[this.pickerIndex];
        if (pick && this.pickerSlot) this.equip(this.pickerSlot, pick);
      }
      return;
    }

    if (input.consumePress('ArrowLeft') && this.tab > 0) {
      this.tab--;
      void this.renderPage();
    }
    if (input.consumePress('ArrowRight') && this.tab < this.members().length - 1) {
      this.tab++;
      void this.renderPage();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    void ctx; // fully DOM
  }
}
