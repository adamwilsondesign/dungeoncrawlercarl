/**
 * Shared data-shape definitions for rooms, actors, sprites and placeholders.
 * This module is pure types — it must not import engine code.
 */

import type { ScriptAction } from './script';

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Value type stored in GameState flags. */
export type FlagValue = boolean | number | string;

/** Verbs that hotspots can respond to (WALK never targets hotspots). */
export type ActionVerb = 'look' | 'hand' | 'talk' | 'item';

/** Glyph ids the placeholder system can paint for cursors and icon-bar icons. */
export type UiGlyph = 'walk' | 'look' | 'hand' | 'talk' | 'item' | 'inventory' | 'settings';

/** Known mood strings map to distinct placeholder palettes. */
export type Mood = 'cold' | 'dungeon' | 'safe' | 'workshop' | 'boss';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  facing: Facing;
}

/** One named animation inside a sprite sheet. Frame indices count left-to-right, top-to-bottom. */
export interface AnimDef {
  frames: number[];
  frameMs: number;
  loop: boolean;
}

export interface SpriteSheetDef {
  path: string;
  frameW: number;
  frameH: number;
  /** When true, left-facing actors reuse the *_right anims mirrored horizontally. */
  mirrorLeft?: boolean;
  anims: Record<string, AnimDef>;
}

export interface ActorDef {
  id: string;
  /** Short label shown on the generated placeholder sprite. */
  label: string;
  /** Per-character placeholder color, e.g. '#4ec9a4'. */
  color: string;
  sheet: SpriteSheetDef;
  x: number;
  y: number;
  anim: string;
  facing: Facing;
}

export interface ExitDef {
  /** Stable id so scripts can enableExit/disableExit it. */
  id: string;
  rect: Rect;
  targetRoom: string;
  targetSpawn: Point;
  facing: Facing;
}

/**
 * An interactive region. Provide `rect` or `polygon` (polygon wins when both
 * are present). Enabled-state lives in GameState under `hotspot:<room>:<id>`
 * so scripts and flags can show/hide hotspots as the story changes;
 * `enabled` here is only the initial value (default true).
 */
export interface HotspotDef {
  id: string;
  /** Short noun shown near the cursor on hover. */
  name: string;
  rect?: Rect;
  polygon?: Point[];
  enabled?: boolean;
  verbs: Partial<Record<ActionVerb, ScriptAction[]>>;
}

/**
 * KQ5-style depth band. Inside a band the scale is constant; between two
 * bands the scale interpolates linearly by foot y. Above the first band /
 * below the last band the scale clamps to that band's value.
 */
export interface ScaleBand {
  yTop: number;
  yBottom: number;
  scale: number;
}

export interface RoomDef {
  id: string;
  /** Display label printed on the generated placeholder background. */
  label: string;
  backgroundPath: string;
  backgroundMood: Mood;
  walkmaskPath: string;
  playerSpawn: SpawnPoint;
  exits: ExitDef[];
  actors: ActorDef[];
  hotspots: HotspotDef[];
  scaleBands: ScaleBand[];
  /**
   * Only used when the walkmask file is missing: extra drawing applied on top
   * of the default placeholder mask (everything below y=110 walkable).
   * Draw #000 to block, #fff to open. Axis-aligned rects recommended so the
   * 4x4 sampling stays exact.
   */
  placeholderMaskDraw?: (ctx: CanvasRenderingContext2D) => void;
}

export type PlaceholderSpec =
  | { kind: 'background'; label: string; mood: Mood }
  | { kind: 'actor'; label: string; color: string; frameW: number; frameH: number }
  | { kind: 'cursor'; glyph: UiGlyph }
  | { kind: 'icon'; glyph: UiGlyph; label: string; w: number; h: number };
