/**
 * Grid A* pathfinding over the room walkmask, string-pull smoothing, and a
 * waypoint mover that drives an actor at depth-scaled speed.
 *
 * The 320x200 walkmask is sampled into an 80x50 boolean grid (4x4px cells).
 * A* is 8-directional with no corner cutting through blocked cells.
 */

import type { Facing, Point } from '../data/types';
import type { Actor } from './actor';
import type { LoadedImage } from './assets';
import { makeCanvas } from './assets';
import { LOGICAL_H, LOGICAL_W } from './renderer';

export const CELL_SIZE = 4;
export const GRID_COLS = LOGICAL_W / CELL_SIZE; // 80
export const GRID_ROWS = LOGICAL_H / CELL_SIZE; // 50

/** How far (in cells) a blocked click retargets to the nearest walkable cell. */
const RETARGET_RADIUS = 6;

/** Walk speed in logical px/sec at depth scale 1.0. */
const WALK_SPEED = 55;

export class WalkGrid {
  readonly cols = GRID_COLS;
  readonly rows = GRID_ROWS;
  private readonly cells: Uint8Array;

  private constructor(cells: Uint8Array) {
    this.cells = cells;
  }

  /**
   * Sample a walkmask image into the grid: a cell is walkable when the pixel
   * at its center is pure white (#FFFFFF).
   */
  static fromImage(mask: LoadedImage): WalkGrid {
    const [, ctx] = makeCanvas(LOGICAL_W, LOGICAL_H);
    ctx.drawImage(mask, 0, 0, LOGICAL_W, LOGICAL_H);
    const data = ctx.getImageData(0, 0, LOGICAL_W, LOGICAL_H).data;
    const cells = new Uint8Array(GRID_COLS * GRID_ROWS);
    for (let cy = 0; cy < GRID_ROWS; cy++) {
      for (let cx = 0; cx < GRID_COLS; cx++) {
        const px = cx * CELL_SIZE + 2;
        const py = cy * CELL_SIZE + 2;
        const i = (py * LOGICAL_W + px) * 4;
        const white = data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255;
        cells[cy * GRID_COLS + cx] = white ? 1 : 0;
      }
    }
    return new WalkGrid(cells);
  }

  isWalkableCell(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= GRID_COLS || cy >= GRID_ROWS) return false;
    return this.cells[cy * GRID_COLS + cx] === 1;
  }

  isWalkablePoint(x: number, y: number): boolean {
    return this.isWalkableCell(Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE));
  }

  /** Cell containing a logical point, clamped into grid bounds. */
  cellAt(x: number, y: number): Point {
    return {
      x: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / CELL_SIZE))),
      y: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / CELL_SIZE))),
    };
  }

  cellCenter(cx: number, cy: number): Point {
    return { x: cx * CELL_SIZE + 2, y: cy * CELL_SIZE + 2 };
  }
}

/** Nearest walkable cell within a square radius, by squared cell distance. */
export function nearestWalkableCell(
  grid: WalkGrid,
  cx: number,
  cy: number,
  radius: number,
): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (!grid.isWalkableCell(x, y)) continue;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// A*
// ---------------------------------------------------------------------------

/** Binary min-heap keyed by f-score, holding cell indices. */
class MinHeap {
  private readonly f: number[] = [];
  private readonly items: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(f: number, item: number): void {
    this.f.push(f);
    this.items.push(item);
    let c = this.items.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.f[p] <= this.f[c]) break;
      this.swap(p, c);
      c = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastF = this.f.pop();
    const lastI = this.items.pop();
    if (this.items.length > 0 && lastF !== undefined && lastI !== undefined) {
      this.f[0] = lastF;
      this.items[0] = lastI;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < this.f.length && this.f[l] < this.f[m]) m = l;
        if (r < this.f.length && this.f[r] < this.f[m]) m = r;
        if (m === p) break;
        this.swap(p, m);
        p = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.f[a], this.f[b]] = [this.f[b], this.f[a]];
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** 8-directional A* between cells; diagonals may not cut blocked corners. */
function astar(grid: WalkGrid, start: Point, goal: Point): Point[] | null {
  const n = GRID_COLS * GRID_ROWS;
  const index = (x: number, y: number): number => y * GRID_COLS + x;
  const startI = index(start.x, start.y);
  const goalI = index(goal.x, goal.y);

  const gCost = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();

  const heuristic = (x: number, y: number): number => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return 14 * Math.min(dx, dy) + 10 * Math.abs(dx - dy);
  };

  gCost[startI] = 0;
  open.push(heuristic(start.x, start.y), startI);

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalI) break;

    const cx = cur % GRID_COLS;
    const cy = (cur / GRID_COLS) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!grid.isWalkableCell(nx, ny)) continue;
      // No corner-cutting: a diagonal requires both orthogonal neighbors open.
      if (dx !== 0 && dy !== 0) {
        if (!grid.isWalkableCell(cx + dx, cy) || !grid.isWalkableCell(cx, cy + dy)) continue;
      }
      const ni = index(nx, ny);
      if (closed[ni]) continue;
      const ng = gCost[cur] + (dx !== 0 && dy !== 0 ? 14 : 10);
      if (gCost[ni] === -1 || ng < gCost[ni]) {
        gCost[ni] = ng;
        parent[ni] = cur;
        open.push(ng + heuristic(nx, ny), ni);
      }
    }
  }

  if (!closed[goalI]) return null;
  const cells: Point[] = [];
  for (let i = goalI; i !== -1; i = parent[i]) {
    cells.push({ x: i % GRID_COLS, y: (i / GRID_COLS) | 0 });
  }
  cells.reverse();
  return cells;
}

// ---------------------------------------------------------------------------
// String-pull smoothing
// ---------------------------------------------------------------------------

/** A straight line is walkable when every 1px sample along it lands in a walkable cell. */
function lineWalkable(grid: WalkGrid, a: Point, b: Point): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist));
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    if (!grid.isWalkablePoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

/** Skip intermediate waypoints wherever a straight walkable line exists. */
export function stringPull(grid: WalkGrid, points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && !lineWalkable(grid, points[i], points[j])) j--;
    out.push(points[j]);
    i = j;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public path query
// ---------------------------------------------------------------------------

/**
 * Compute a smoothed waypoint list from a logical point to a clicked point.
 * A blocked click retargets to the nearest walkable cell within 6 cells;
 * returns null when no path exists (caller should do nothing).
 */
export function findPath(grid: WalkGrid, from: Point, to: Point): Point[] | null {
  let start = grid.cellAt(from.x, from.y);
  if (!grid.isWalkableCell(start.x, start.y)) {
    const n = nearestWalkableCell(grid, start.x, start.y, RETARGET_RADIUS);
    if (!n) return null;
    start = n;
  }

  const clicked = grid.cellAt(to.x, to.y);
  const exact = grid.isWalkableCell(clicked.x, clicked.y);
  let goal = clicked;
  if (!exact) {
    const n = nearestWalkableCell(grid, clicked.x, clicked.y, RETARGET_RADIUS);
    if (!n) return null;
    goal = n;
  }

  const cells = astar(grid, start, goal);
  if (!cells) return null;

  const points = cells.map((c) => grid.cellCenter(c.x, c.y));
  points[0] = { x: from.x, y: from.y };
  const end = exact ? { x: to.x, y: to.y } : points[points.length - 1];
  if (points.length === 1) points.push(end);
  else points[points.length - 1] = end;

  const waypoints = stringPull(grid, points).slice(1);
  return waypoints.length > 0 ? waypoints : null;
}

// ---------------------------------------------------------------------------
// Mover
// ---------------------------------------------------------------------------

function dominantFacing(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * Drives an actor along a waypoint list at 55 px/sec multiplied by the
 * actor's current depth scale, picking walk/idle anims by segment direction.
 */
export class Mover {
  /** Logical px/sec at depth scale 1.0 (cutscenes may override per move). */
  speed = WALK_SPEED;

  private waypoints: Point[] = [];
  private index = 0;

  get active(): boolean {
    return this.index < this.waypoints.length;
  }

  /** Remaining waypoints (for the debug overlay). */
  remaining(): Point[] {
    return this.waypoints.slice(this.index);
  }

  /** Start (or immediately replace) the current path. */
  start(waypoints: Point[]): void {
    this.waypoints = waypoints;
    this.index = 0;
  }

  stop(): void {
    this.waypoints = [];
    this.index = 0;
  }

  /** Teleport the actor to the final waypoint and end the move (cutscene skip). */
  finish(actor: Actor): void {
    if (!this.active) return;
    const last = this.waypoints[this.waypoints.length - 1];
    actor.x = last.x;
    actor.y = last.y;
    this.index = this.waypoints.length;
    actor.play('idle');
  }

  update(dtMs: number, actor: Actor, scaleAt: (y: number) => number): void {
    if (!this.active) return;

    let budget = this.speed * scaleAt(actor.y) * (dtMs / 1000);
    while (budget > 0 && this.active) {
      const target = this.waypoints[this.index];
      const dx = target.x - actor.x;
      const dy = target.y - actor.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        actor.x = target.x;
        actor.y = target.y;
        this.index++;
        budget -= dist;
      } else {
        actor.x += (dx / dist) * budget;
        actor.y += (dy / dist) * budget;
        budget = 0;
      }
    }

    if (this.active) {
      const target = this.waypoints[this.index];
      const dx = target.x - actor.x;
      const dy = target.y - actor.y;
      if (dx !== 0 || dy !== 0) actor.facing = dominantFacing(dx, dy);
      actor.play('walk');
    } else {
      actor.play('idle');
    }
  }
}
