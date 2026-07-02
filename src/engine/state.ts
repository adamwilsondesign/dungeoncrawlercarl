/**
 * Central game state: the single source of truth for story flags, the
 * current room, and player facing. Hotspot/exit enabled-state derives from
 * flags under reserved keys (`hotspot:<room>:<id>` / `exit:<room>:<id>`), so
 * scripts, save/load (P4), and the UI all read the same record. Observers
 * fire on every flag change for systems that need to react.
 */

import type {
  EquipSlot,
  ExitDef,
  Facing,
  FlagValue,
  HotspotDef,
  InventoryEntry,
} from '../data/types';

export type PartyEquipment = Record<string, Partial<Record<EquipSlot, string>>>;

export interface GameStateData {
  flags: Record<string, FlagValue>;
  currentRoom: string;
  playerFacing: Facing;
  playerX: number;
  playerY: number;
  playtimeMs: number;
  inventory: InventoryEntry[];
  heldItem: string | null;
  party: string[];
  gold: number;
  xp: number;
  level: number;
  equipment: PartyEquipment;
}

/** Cumulative XP required to REACH a level (level 1 = 0, 2 = 100, 3 = 300...). */
export function xpForLevel(level: number): number {
  return (50 * (level - 1) * level) | 0;
}

/** Evaluate a FlagCondition against any flag source (GameState, hooks ctx). */
export function checkFlagCondition(
  source: { getFlag(key: string): FlagValue | undefined },
  cond: import('../data/types').FlagCondition,
): boolean {
  const value = source.getFlag(cond.flag);
  const base = cond.equals !== undefined ? value === cond.equals : Boolean(value);
  return cond.not ? !base : base;
}

export type FlagListener = (key: string, value: FlagValue | undefined) => void;

export class GameState {
  currentRoom = '';
  playerFacing: Facing = 'down';
  playerX = 0;
  playerY = 0;
  playtimeMs = 0;
  /** Item id currently selected for the ITEM verb, or null. */
  heldItem: string | null = null;
  /** Wired by the active scene; lets content trigger checkpoints. */
  autosaveHook: (() => void) | null = null;

  /** Active party member ids (Carl always first). Encounters may override. */
  party: string[] = ['carl'];
  gold = 0;
  /** Shared XP pool; the whole party levels together. */
  xp = 0;
  level = 1;
  /** memberId -> slot -> equipped item id. */
  equipment: PartyEquipment = {};

  private flags: Record<string, FlagValue> = {};
  private items: InventoryEntry[] = [];
  private readonly listeners = new Set<FlagListener>();

  /** Add XP; returns how many levels were gained. */
  addXp(amount: number): number {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= xpForLevel(this.level + 1)) {
      this.level++;
      gained++;
    }
    if (gained > 0) {
      for (const listener of this.listeners) listener('party:level', this.level);
    }
    return gained;
  }

  /**
   * Equip an inventory item into a member's slot; anything previously in the
   * slot returns to the inventory. Returns false if the item isn't held.
   */
  equipItem(memberId: string, itemId: string, slot: EquipSlot): boolean {
    if (!this.removeItem(itemId)) return false;
    const slots = (this.equipment[memberId] ??= {});
    const previous = slots[slot];
    if (previous) this.addItem(previous, false);
    slots[slot] = itemId;
    for (const listener of this.listeners) listener(`equip:${memberId}:${slot}`, itemId);
    return true;
  }

  getEquipped(memberId: string): Partial<Record<EquipSlot, string>> {
    return this.equipment[memberId] ?? {};
  }

  /** Write the autosave slot (content checkpoints call this via the autosave() action). */
  autosave(): void {
    this.autosaveHook?.();
  }

  /** Fresh state for New Game. Listeners and hooks are kept. */
  reset(): void {
    this.flags = {};
    this.items = [];
    this.heldItem = null;
    this.currentRoom = '';
    this.playerFacing = 'down';
    this.playerX = 0;
    this.playerY = 0;
    this.playtimeMs = 0;
    this.party = ['carl'];
    this.gold = 0;
    this.xp = 0;
    this.level = 1;
    this.equipment = {};
  }

  /** Restore from a save payload (inverse of serialize). */
  restore(data: GameStateData): void {
    this.flags = { ...data.flags };
    this.items = data.inventory.map((e) => ({ ...e }));
    this.heldItem = data.heldItem;
    this.currentRoom = data.currentRoom;
    this.playerFacing = data.playerFacing;
    this.playerX = data.playerX;
    this.playerY = data.playerY;
    this.playtimeMs = data.playtimeMs;
    this.party = [...(data.party ?? ['carl'])];
    this.gold = data.gold ?? 0;
    this.xp = data.xp ?? 0;
    this.level = data.level ?? 1;
    this.equipment = {};
    for (const [member, slots] of Object.entries(data.equipment ?? {})) {
      this.equipment[member] = { ...slots };
    }
  }

  getFlag(key: string): FlagValue | undefined {
    return this.flags[key];
  }

  setFlag(key: string, value: FlagValue): void {
    if (this.flags[key] === value) return;
    this.flags[key] = value;
    for (const listener of this.listeners) listener(key, value);
  }

  /** Subscribe to flag changes; returns an unsubscribe function. */
  subscribe(listener: FlagListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Inventory ------------------------------------------------------------

  /** Ordered inventory entries (stackables share one entry with a count). */
  get inventory(): readonly InventoryEntry[] {
    return this.items;
  }

  /** Add one of the item; returns how many the player now holds. */
  addItem(id: string, stackable: boolean): number {
    const existing = this.items.find((e) => e.id === id);
    if (existing && stackable) existing.count++;
    else this.items.push({ id, count: 1 });
    const total = this.countItem(id);
    for (const listener of this.listeners) listener(`inv:${id}`, total);
    return total;
  }

  /** Remove one of the item; clears heldItem when none remain. */
  removeItem(id: string): boolean {
    const index = this.items.findIndex((e) => e.id === id);
    if (index === -1) return false;
    const entry = this.items[index];
    if (entry.count > 1) entry.count--;
    else this.items.splice(index, 1);
    if (this.heldItem === id && !this.hasItem(id)) this.heldItem = null;
    for (const listener of this.listeners) listener(`inv:${id}`, this.countItem(id));
    return true;
  }

  hasItem(id: string): boolean {
    return this.items.some((e) => e.id === id);
  }

  countItem(id: string): number {
    return this.items.reduce((n, e) => (e.id === id ? n + e.count : n), 0);
  }

  // --- Hotspot / exit enabled-state (flag-backed) --------------------------

  static hotspotKey(roomId: string, hotspotId: string): string {
    return `hotspot:${roomId}:${hotspotId}`;
  }

  static exitKey(roomId: string, exitId: string): string {
    return `exit:${roomId}:${exitId}`;
  }

  /** Enabled unless a flag overrides; falls back to the def's initial value. */
  isHotspotEnabled(roomId: string, hotspot: HotspotDef): boolean {
    const v = this.flags[GameState.hotspotKey(roomId, hotspot.id)];
    return v === undefined ? hotspot.enabled !== false : Boolean(v);
  }

  setHotspotEnabled(roomId: string, hotspotId: string, enabled: boolean): void {
    this.setFlag(GameState.hotspotKey(roomId, hotspotId), enabled);
  }

  isExitEnabled(roomId: string, exit: ExitDef): boolean {
    const v = this.flags[GameState.exitKey(roomId, exit.id)];
    return v === undefined ? true : Boolean(v);
  }

  setExitEnabled(roomId: string, exitId: string, enabled: boolean): void {
    this.setFlag(GameState.exitKey(roomId, exitId), enabled);
  }

  /** Plain-data snapshot used by the save system. */
  serialize(): GameStateData {
    return {
      flags: { ...this.flags },
      currentRoom: this.currentRoom,
      playerFacing: this.playerFacing,
      playerX: this.playerX,
      playerY: this.playerY,
      playtimeMs: this.playtimeMs,
      inventory: this.items.map((e) => ({ ...e })),
      heldItem: this.heldItem,
      party: [...this.party],
      gold: this.gold,
      xp: this.xp,
      level: this.level,
      equipment: Object.fromEntries(
        Object.entries(this.equipment).map(([member, slots]) => [member, { ...slots }]),
      ),
    };
  }
}
