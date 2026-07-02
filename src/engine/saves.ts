/**
 * Save persistence: three manual slots plus one autosave, stored in
 * localStorage under dcc_save_<slot>. GameState.serialize() is the payload;
 * the envelope adds a version, timestamp, room label and playtime for the
 * slot list UI.
 */

import type { GameStateData } from './state';

export type SaveSlot = 'auto' | '1' | '2' | '3';

export const MANUAL_SLOTS: readonly SaveSlot[] = ['1', '2', '3'];
export const ALL_SLOTS: readonly SaveSlot[] = ['auto', '1', '2', '3'];

export interface SaveFile {
  version: number;
  savedAt: number;
  roomLabel: string;
  playtimeMs: number;
  data: GameStateData;
}

const SAVE_VERSION = 2; // v2: party/gold/xp/level/equipment added in P5

function storageKey(slot: SaveSlot): string {
  return `dcc_save_${slot}`;
}

export function makeSaveFile(roomLabel: string, playtimeMs: number, data: GameStateData): SaveFile {
  return { version: SAVE_VERSION, savedAt: Date.now(), roomLabel, playtimeMs, data };
}

export function writeSave(slot: SaveSlot, file: SaveFile): boolean {
  try {
    localStorage.setItem(storageKey(slot), JSON.stringify(file));
    return true;
  } catch (err) {
    console.warn(`[saves] failed to write slot "${slot}"`, err);
    return false;
  }
}

export function readSave(slot: SaveSlot): SaveFile | null {
  try {
    const raw = localStorage.getItem(storageKey(slot));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as SaveFile).version !== SAVE_VERSION ||
      typeof (parsed as SaveFile).data !== 'object'
    ) {
      console.warn(`[saves] slot "${slot}" has an incompatible format — ignoring`);
      return null;
    }
    return parsed as SaveFile;
  } catch (err) {
    console.warn(`[saves] failed to read slot "${slot}"`, err);
    return null;
  }
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatPlaytime(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
}
