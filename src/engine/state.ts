/**
 * Central game state: the single source of truth for story flags, the
 * current room, and player facing. Hotspot/exit enabled-state derives from
 * flags under reserved keys (`hotspot:<room>:<id>` / `exit:<room>:<id>`), so
 * scripts, save/load (P4), and the UI all read the same record. Observers
 * fire on every flag change for systems that need to react.
 */

import type { ExitDef, Facing, FlagValue, HotspotDef, InventoryEntry } from '../data/types';

export interface GameStateData {
  flags: Record<string, FlagValue>;
  currentRoom: string;
  playerFacing: Facing;
  inventory: InventoryEntry[];
  heldItem: string | null;
}

export type FlagListener = (key: string, value: FlagValue | undefined) => void;

export class GameState {
  currentRoom = '';
  playerFacing: Facing = 'down';
  /** Item id currently selected for the ITEM verb, or null. */
  heldItem: string | null = null;

  private flags: Record<string, FlagValue> = {};
  private items: InventoryEntry[] = [];
  private readonly listeners = new Set<FlagListener>();

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

  /** Plain-data snapshot; P4 will serialize this. */
  serialize(): GameStateData {
    return {
      flags: { ...this.flags },
      currentRoom: this.currentRoom,
      playerFacing: this.playerFacing,
      inventory: this.items.map((e) => ({ ...e })),
      heldItem: this.heldItem,
    };
  }
}
