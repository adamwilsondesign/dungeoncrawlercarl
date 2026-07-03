/**
 * The PARTY screen (P19): opened from the top nav. Tabs across the top for
 * every current party member; each page splits into a paper doll (left) with
 * the three equip slots - WEAPON / ARMOR / TRINKET - and a full stat readout
 * (right): level, XP progress, HP/MP, core stats, known skills. Clicking a
 * slot opens a picker of eligible inventory items; picking equips through
 * the same GameState flow combat reads, so nothing combat-side changes.
 */

import type {
  CombatantDef,
  EquipSlot,
  ItemDef,
  Point,
  Rect,
  SkillDef,
} from '../data/types';
import { drawPixelText, ITEM_ICON_SIZE, outlinedPanel, pixelTextWidth, type LoadedImage } from './assets';
import { knownSkills, leveledStats } from './combat';
import type { Game, Scene } from './game';
import { drawMenuCursor } from './menus';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import { xpForLevel, type GameState } from './state';

export interface PartyDeps {
  state: GameState;
  combatants: Record<string, CombatantDef>;
  items: Record<string, ItemDef>;
  skills: Record<string, SkillDef>;
  itemIcons: ReadonlyMap<string, LoadedImage>;
}

const PANEL: Rect = { x: 6, y: 8, w: LOGICAL_W - 12, h: LOGICAL_H - 16 };
const CLOSE: Rect = { x: PANEL.x + PANEL.w - 16, y: PANEL.y + 3, w: 12, h: 10 };
const TAB_Y = PANEL.y + 16;
const TAB_H = 12;
const DOLL_X = PANEL.x + 12;
const DOLL_Y = TAB_Y + 20;
const SLOT_W = 62;
const SLOT_H = 24;
const ACCENT = '#3fd9ff';
const DIM = '#8fa3c4';
const LIT = '#ffe9a8';

const SLOTS: ReadonlyArray<{ slot: EquipSlot; label: string; dx: number; dy: number }> = [
  { slot: 'weapon', label: 'WEAPON', dx: 0, dy: 22 },
  { slot: 'armor', label: 'ARMOR', dx: 0, dy: 50 },
  { slot: 'trinket', label: 'TRINKET', dx: 0, dy: 78 },
];

function inRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

interface Picker {
  slot: EquipSlot;
  /** Eligible inventory item ids (deduped). */
  options: string[];
  selected: number;
}

export class PartyScene implements Scene {
  private tab = 0;
  private picker: Picker | null = null;

  constructor(
    private readonly game: Game,
    private readonly deps: PartyDeps,
  ) {}

  private members(): string[] {
    return this.deps.state.party;
  }

  private memberId(): string {
    const list = this.members();
    this.tab = Math.max(0, Math.min(this.tab, list.length - 1));
    return list[this.tab] ?? 'carl';
  }

  private tabRect(i: number): Rect {
    const list = this.members();
    const w = Math.min(70, Math.floor((PANEL.w - 24) / Math.max(1, list.length)));
    return { x: PANEL.x + 8 + i * (w + 3), y: TAB_Y, w, h: TAB_H };
  }

  private slotRect(i: number): Rect {
    const s = SLOTS[i];
    // Slots stack to the right of the silhouette.
    return { x: DOLL_X + 52 + s.dx, y: DOLL_Y + s.dy - 16, w: SLOT_W, h: SLOT_H };
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

  update(): void {
    const input = this.game.input;
    input.clearRightClicks();

    if (input.consumePress('Escape')) {
      if (this.picker) this.picker = null;
      else this.game.popScene();
      return;
    }

    if (this.picker) {
      const rows = this.picker.options.length + 1; // + CANCEL
      if (input.consumePress('ArrowUp')) this.picker.selected = (this.picker.selected + rows - 1) % rows;
      if (input.consumePress('ArrowDown')) this.picker.selected = (this.picker.selected + 1) % rows;
      if (input.consumePress('Enter')) {
        this.confirmPicker(this.picker.selected);
        return;
      }
      const click = input.consumeClick();
      if (click) {
        const row = this.pickerRowAt(click);
        if (row !== null) this.confirmPicker(row);
        else this.picker = null; // click-away closes the picker
      }
      return;
    }

    if (input.consumePress('ArrowLeft')) this.tab = Math.max(0, this.tab - 1);
    if (input.consumePress('ArrowRight')) this.tab = Math.min(this.members().length - 1, this.tab + 1);

    const click = input.consumeClick();
    if (!click) return;
    if (inRect(click, CLOSE)) {
      this.game.popScene();
      return;
    }
    for (let i = 0; i < this.members().length; i++) {
      if (inRect(click, this.tabRect(i))) {
        this.tab = i;
        return;
      }
    }
    for (let i = 0; i < SLOTS.length; i++) {
      if (inRect(click, this.slotRect(i))) {
        const slot = SLOTS[i].slot;
        this.picker = { slot, options: this.eligible(slot), selected: 0 };
        return;
      }
    }
  }

  private pickerPanel(): Rect {
    const rows = (this.picker?.options.length ?? 0) + 1;
    const h = 20 + rows * 12 + 6;
    return { x: 70, y: Math.max(24, 100 - h / 2), w: 180, h };
  }

  private pickerRowAt(p: Point): number | null {
    if (!this.picker) return null;
    const panel = this.pickerPanel();
    if (p.x < panel.x + 4 || p.x >= panel.x + panel.w - 4) return null;
    const row = Math.floor((p.y - (panel.y + 16)) / 12);
    const rows = this.picker.options.length + 1;
    return row >= 0 && row < rows ? row : null;
  }

  private confirmPicker(row: number): void {
    const picker = this.picker;
    if (!picker) return;
    this.picker = null;
    if (row >= picker.options.length) return; // CANCEL
    const itemId = picker.options[row];
    const def = this.deps.items[itemId];
    if (!def?.equip) return;
    this.deps.state.equipItem(this.memberId(), itemId, def.equip.slot);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { state, combatants, items, skills } = this.deps;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    outlinedPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, '#0e1420', ACCENT);
    drawPixelText(ctx, 'PARTY', LOGICAL_W / 2, PANEL.y + 4, ACCENT, 2, 'center');

    ctx.fillStyle = '#1b2432';
    ctx.fillRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h);
    drawPixelText(ctx, 'X', CLOSE.x + CLOSE.w / 2, CLOSE.y + 2, '#ff8f8f', 1, 'center');

    // Tabs
    const list = this.members();
    list.forEach((id, i) => {
      const r = this.tabRect(i);
      const def = combatants[id];
      const name = def?.shortName ?? def?.name ?? id.toUpperCase();
      const active = i === this.tab;
      ctx.fillStyle = active ? '#22314a' : '#131a26';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = active ? ACCENT : '#39465e';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      drawPixelText(ctx, name, r.x + r.w / 2, r.y + 3, active ? LIT : DIM, 1, 'center');
    });

    const id = this.memberId();
    const def = combatants[id];
    if (!def) return;
    const equipped = state.getEquipped(id);

    // --- LEFT: paper doll ---------------------------------------------------
    const dollColor = def.color;
    const dx = DOLL_X + 10;
    const dy = DOLL_Y + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(DOLL_X - 4, DOLL_Y - 6, 118, 106);
    // Stylized silhouette: head, torso, legs in the member's color.
    ctx.fillStyle = dollColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(dx + 8, dy, 12, 12); // head
    ctx.fillRect(dx + 4, dy + 14, 20, 26); // torso
    ctx.fillRect(dx, dy + 18, 4, 14); // arms
    ctx.fillRect(dx + 24, dy + 18, 4, 14);
    ctx.fillRect(dx + 6, dy + 42, 6, 20); // legs
    ctx.fillRect(dx + 16, dy + 42, 6, 20);
    ctx.globalAlpha = 1;
    drawPixelText(ctx, def.shortName ?? def.name, dx + 14, dy + 66, DIM, 1, 'center');

    // Slot boxes with connector ticks toward the doll
    SLOTS.forEach((spec, i) => {
      const r = this.slotRect(i);
      const itemId = equipped[spec.slot];
      const item = itemId ? items[itemId] : undefined;
      ctx.fillStyle = '#131a26';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = item ? ACCENT : '#39465e';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = '#39465e';
      ctx.fillRect(r.x - 6, r.y + Math.floor(r.h / 2), 6, 1);
      drawPixelText(ctx, spec.label, r.x + 3, r.y + 2, DIM);
      if (item) {
        const icon = this.deps.itemIcons.get(item.id);
        if (icon) {
          ctx.drawImage(icon, r.x + 2, r.y + 9, ITEM_ICON_SIZE / 2 + 4, ITEM_ICON_SIZE / 2 + 4);
        }
        let name = item.name;
        while (name.length > 1 && pixelTextWidth(name) > r.w - 22) name = name.slice(0, -1);
        drawPixelText(ctx, name, r.x + 20, r.y + 13, '#d8ecff');
      } else {
        drawPixelText(ctx, 'EMPTY', r.x + 20, r.y + 13, '#4a586f');
      }
    });

    // --- RIGHT: stat readout ---------------------------------------------------
    const sx = PANEL.x + 168;
    let sy = DOLL_Y - 10;
    const line = (text: string, color = '#d8ecff'): void => {
      drawPixelText(ctx, text, sx, sy, color);
      sy += 9;
    };
    const stats = leveledStats(def.stats, state.level);
    // Equip contributions (mirror combat's derivation)
    let atk = 0;
    let defense = 0;
    for (const slotId of Object.values(equipped)) {
      const eq = slotId ? items[slotId]?.equip : undefined;
      if (!eq) continue;
      atk += eq.attack ?? 0;
      defense += eq.defense ?? 0;
      for (const [stat, delta] of Object.entries(eq.statMods ?? {})) {
        if (delta === undefined) continue;
        if (stat === 'maxHp') {
          stats.maxHp += delta;
          stats.hp += delta;
        } else if (stat === 'maxMp') {
          stats.maxMp = (stats.maxMp ?? 0) + delta;
          stats.mp = (stats.mp ?? 0) + delta;
        } else if (stat === 'str' || stat === 'dex' || stat === 'con' || stat === 'int' || stat === 'spd') {
          stats[stat] += delta;
        }
      }
    }

    line(`LEVEL ${state.level}`, LIT);
    // XP bar toward the next level
    const base = xpForLevel(state.level);
    const next = xpForLevel(state.level + 1);
    const frac = Math.max(0, Math.min(1, (state.xp - base) / Math.max(1, next - base)));
    ctx.fillStyle = '#131a26';
    ctx.fillRect(sx, sy, 118, 6);
    ctx.fillStyle = '#57e6a8';
    ctx.fillRect(sx + 1, sy + 1, Math.round(116 * frac), 4);
    ctx.strokeStyle = '#39465e';
    ctx.strokeRect(sx + 0.5, sy + 0.5, 117, 5);
    sy += 9;
    line(`XP ${state.xp - base}/${next - base}`, DIM);
    line(`HP ${stats.maxHp}   MP ${stats.maxMp ?? 0}`);
    line(`STR ${stats.str}  DEX ${stats.dex}  CON ${stats.con}`);
    line(`INT ${stats.int}  SPD ${stats.spd}`);
    line(`ATTACK +${atk}   DEFENSE +${defense}`, DIM);
    sy += 2;
    line('SKILLS', ACCENT);
    const skillIds = [...knownSkills(def, state.level), ...(state.extraSkills[id] ?? [])];
    if (skillIds.length === 0) line('(none yet)', '#4a586f');
    for (const sid of skillIds.slice(0, 6)) {
      const sk = skills[sid];
      if (!sk) continue;
      const bits = [sk.name];
      if (sk.mpCost) bits.push(`${sk.mpCost}MP`);
      if (sk.cooldown) bits.push(`CD${sk.cooldown}`);
      line(bits.join('  '), '#b8c8e0');
    }
    sy += 2;
    line('STATUS: none (out of combat)', '#4a586f');

    // Bottom hotkeys
    drawPixelText(
      ctx,
      'CLICK SLOT: EQUIP   LEFT/RIGHT: MEMBER   ESC: CLOSE',
      LOGICAL_W / 2,
      PANEL.y + PANEL.h - 10,
      DIM,
      1,
      'center',
    );

    // Picker overlay
    if (this.picker) {
      const panel = this.pickerPanel();
      outlinedPanel(ctx, panel.x, panel.y, panel.w, panel.h, '#0e1420', LIT);
      drawPixelText(ctx, `EQUIP ${this.picker.slot.toUpperCase()}`, panel.x + panel.w / 2, panel.y + 4, LIT, 1, 'center');
      const rows = [...this.picker.options, '__cancel__'];
      rows.forEach((rowId, i) => {
        const y = panel.y + 16 + i * 12;
        const selected = i === this.picker?.selected;
        if (selected) {
          ctx.fillStyle = 'rgba(255,233,168,0.12)';
          ctx.fillRect(panel.x + 4, y - 1, panel.w - 8, 11);
        }
        if (rowId === '__cancel__') {
          drawPixelText(ctx, 'CANCEL', panel.x + 10, y, selected ? LIT : DIM);
        } else {
          const item = items[rowId];
          drawPixelText(ctx, item?.name ?? rowId.toUpperCase(), panel.x + 10, y, selected ? LIT : '#d8ecff');
        }
      });
      if (this.picker.options.length === 0) {
        drawPixelText(ctx, '(nothing eligible in the pack)', panel.x + panel.w / 2, panel.y + panel.h - 20, '#4a586f', 1, 'center');
      }
    }

    drawMenuCursor(ctx, this.game.input.mouse);
  }
}
