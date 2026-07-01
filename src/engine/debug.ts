/**
 * Debug overlay, toggled with the backquote key: blocked walkmask cells,
 * the current path polyline, actor feet markers, exit rects, FPS and the
 * mouse position in logical coords.
 */

import type { ExitDef, Point } from '../data/types';
import type { Actor } from './actor';
import { drawPixelText } from './assets';
import { CELL_SIZE, type WalkGrid } from './pathfinding';

export interface DebugState {
  grid: WalkGrid;
  /** Current walk path including the actor's position as first point. */
  path: Point[];
  actors: Actor[];
  exits: ExitDef[];
  fps: number;
  mouse: Point;
}

export class DebugOverlay {
  enabled = false;

  toggle(): void {
    this.enabled = !this.enabled;
  }

  render(ctx: CanvasRenderingContext2D, state: DebugState): void {
    if (!this.enabled) return;

    // Blocked cells, red at 30% alpha
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    for (let cy = 0; cy < state.grid.rows; cy++) {
      for (let cx = 0; cx < state.grid.cols; cx++) {
        if (!state.grid.isWalkableCell(cx, cy)) {
          ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Exit rects, cyan
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    for (const exit of state.exits) {
      ctx.strokeRect(exit.rect.x + 0.5, exit.rect.y + 0.5, exit.rect.w - 1, exit.rect.h - 1);
    }

    // Current path, yellow polyline
    if (state.path.length > 1) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(state.path[0].x + 0.5, state.path[0].y + 0.5);
      for (let i = 1; i < state.path.length; i++) {
        ctx.lineTo(state.path[i].x + 0.5, state.path[i].y + 0.5);
      }
      ctx.stroke();
    }

    // Actor feet, green crosses
    ctx.fillStyle = '#00ff00';
    for (const actor of state.actors) {
      const fx = Math.round(actor.x);
      const fy = Math.round(actor.y);
      ctx.fillRect(fx - 2, fy, 5, 1);
      ctx.fillRect(fx, fy - 2, 1, 5);
    }

    // FPS + mouse coords, top-left
    const text = `FPS ${state.fps}  ${state.mouse.x},${state.mouse.y}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(1, 1, text.length * 4 + 3, 9);
    drawPixelText(ctx, text, 3, 3, '#ffffff');
  }
}
