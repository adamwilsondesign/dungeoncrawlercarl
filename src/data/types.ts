/**
 * Shared data-shape definitions for rooms, actors, sprites and placeholders.
 * This module is pure types — it must not import engine code.
 */

export type Facing = 'up' | 'down' | 'left' | 'right';

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
  rect: Rect;
  targetRoom: string;
  targetSpawn: Point;
  facing: Facing;
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
  | { kind: 'actor'; label: string; color: string; frameW: number; frameH: number };
