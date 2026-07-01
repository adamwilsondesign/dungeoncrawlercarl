/**
 * Room system: a Room bundles a background, sampled walkmask grid, exits,
 * actors and depth scale bands. RoomScene drives the current room — click-to-
 * walk, exit transitions with fade out/in, and the debug overlay.
 */

import type { ExitDef, Point, RoomDef, SpawnPoint, SpriteSheetDef } from '../data/types';
import { Actor } from './actor';
import { hasAsset, loadImage, logPlaceholder, makeCanvas, type LoadedImage } from './assets';
import { DebugOverlay } from './debug';
import type { Game, Scene } from './game';
import { findPath, Mover, WalkGrid } from './pathfinding';
import { LOGICAL_H, LOGICAL_W } from './renderer';

/** Default placeholder walkmask: everything below this y is walkable. */
const PLACEHOLDER_FLOOR_Y = 110;

function buildPlaceholderMask(def: RoomDef): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, PLACEHOLDER_FLOOR_Y, LOGICAL_W, LOGICAL_H - PLACEHOLDER_FLOOR_Y);
  def.placeholderMaskDraw?.(ctx);
  return canvas;
}

export class Room {
  readonly def: RoomDef;
  readonly grid: WalkGrid;
  readonly actors: Actor[] = [];

  private readonly background: LoadedImage;
  private readonly bands: RoomDef['scaleBands'];

  private constructor(def: RoomDef, background: LoadedImage, grid: WalkGrid, actors: Actor[]) {
    this.def = def;
    this.background = background;
    this.grid = grid;
    this.actors.push(...actors);
    this.bands = [...def.scaleBands].sort((a, b) => a.yTop - b.yTop);
  }

  /** Load background, walkmask and actor sheets (placeholders where missing). */
  static async load(def: RoomDef): Promise<Room> {
    const background = await loadImage(def.backgroundPath, {
      kind: 'background',
      label: def.label,
      mood: def.backgroundMood,
    });

    let grid: WalkGrid;
    if (hasAsset(def.walkmaskPath)) {
      grid = WalkGrid.fromImage(await loadImage(def.walkmaskPath));
    } else {
      logPlaceholder(
        def.walkmaskPath,
        `generated walkmask: floor below y=${PLACEHOLDER_FLOOR_Y}` +
          (def.placeholderMaskDraw ? ' plus room-defined blockers' : ''),
      );
      grid = WalkGrid.fromImage(buildPlaceholderMask(def));
    }

    const actors = await Promise.all(
      def.actors.map(async (a) => {
        const image = await loadImage(a.sheet.path, {
          kind: 'actor',
          label: a.label,
          color: a.color,
          frameW: a.sheet.frameW,
          frameH: a.sheet.frameH,
        });
        const actor = new Actor({
          id: a.id,
          label: a.label,
          sheet: a.sheet,
          image,
          x: a.x,
          y: a.y,
          facing: a.facing,
        });
        actor.setAnim(a.anim);
        return actor;
      }),
    );

    return new Room(def, background, grid, actors);
  }

  addActor(actor: Actor): void {
    this.actors.push(actor);
  }

  /**
   * Depth scale at a foot y: constant inside a band, linearly interpolated
   * between adjacent bands, clamped beyond the first/last band.
   */
  scaleAt(y: number): number {
    const bands = this.bands;
    if (bands.length === 0) return 1;
    if (y <= bands[0].yBottom) return bands[0].scale;
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i];
      const b = bands[i + 1];
      if (y <= b.yTop) {
        const span = b.yTop - a.yBottom;
        const t = span <= 0 ? 1 : (y - a.yBottom) / span;
        return a.scale + (b.scale - a.scale) * t;
      }
      if (y <= b.yBottom) return b.scale;
    }
    return bands[bands.length - 1].scale;
  }

  /** The exit whose rect contains the point, if any. */
  exitAt(p: Point): ExitDef | null {
    for (const exit of this.def.exits) {
      const r = exit.rect;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return exit;
    }
    return null;
  }

  update(dtMs: number): void {
    for (const actor of this.actors) actor.update(dtMs);
  }

  /** Background, then actors sorted by feet y (painter's order). */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.background, 0, 0, LOGICAL_W, LOGICAL_H);
    const sorted = [...this.actors].sort((a, b) => a.y - b.y);
    for (const actor of sorted) actor.draw(ctx, this.scaleAt(actor.y));
  }
}

// ---------------------------------------------------------------------------
// RoomScene
// ---------------------------------------------------------------------------

export interface PlayerTemplate {
  label: string;
  color: string;
  sheet: SpriteSheetDef;
}

const FADE_MS = 250;

type Transition =
  | { kind: 'none' }
  | { kind: 'fade-out'; t: number; exit: ExitDef }
  | { kind: 'loading' }
  | { kind: 'fade-in'; t: number };

export class RoomScene implements Scene {
  private room: Room | null = null;
  private player: Actor | null = null;
  private readonly mover = new Mover();
  private readonly debug = new DebugOverlay();
  private transition: Transition = { kind: 'loading' };

  constructor(
    private readonly game: Game,
    private readonly rooms: Record<string, RoomDef>,
    private readonly playerTemplate: PlayerTemplate,
  ) {}

  /** Load the initial room and fade in from black. */
  async enterRoom(roomId: string): Promise<void> {
    const def = this.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    await this.loadRoom(roomId, def.playerSpawn);
    this.transition = { kind: 'fade-in', t: 0 };
  }

  private async loadRoom(roomId: string, spawn: SpawnPoint): Promise<void> {
    const def = this.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    this.mover.stop();

    const room = await Room.load(def);
    const sheet = this.playerTemplate.sheet;
    const image = await loadImage(sheet.path, {
      kind: 'actor',
      label: this.playerTemplate.label,
      color: this.playerTemplate.color,
      frameW: sheet.frameW,
      frameH: sheet.frameH,
    });
    const player = new Actor({
      id: 'player',
      label: this.playerTemplate.label,
      sheet,
      image,
      x: spawn.x,
      y: spawn.y,
      facing: spawn.facing,
    });
    player.play('idle');
    room.addActor(player);

    this.room = room;
    this.player = player;
  }

  update(dtMs: number): void {
    if (this.game.input.consumePress('Backquote')) this.debug.toggle();

    const room = this.room;
    room?.update(dtMs);

    switch (this.transition.kind) {
      case 'none': {
        if (!room || !this.player) break;
        const click = this.game.input.consumeClick();
        if (click) {
          const path = findPath(room.grid, this.player.feet, click);
          if (path) this.mover.start(path);
        }
        this.mover.update(dtMs, this.player, (y) => room.scaleAt(y));
        const exit = room.exitAt(this.player.feet);
        if (exit) {
          this.mover.stop();
          this.player.play('idle');
          this.transition = { kind: 'fade-out', t: 0, exit };
        }
        break;
      }
      case 'fade-out': {
        this.game.input.clearClicks();
        this.transition.t += dtMs;
        if (this.transition.t >= FADE_MS) {
          const exit = this.transition.exit;
          this.transition = { kind: 'loading' };
          void this.loadRoom(exit.targetRoom, { ...exit.targetSpawn, facing: exit.facing }).then(
            () => {
              this.transition = { kind: 'fade-in', t: 0 };
            },
          );
        }
        break;
      }
      case 'loading':
        this.game.input.clearClicks();
        break;
      case 'fade-in': {
        this.game.input.clearClicks();
        this.transition.t += dtMs;
        if (this.transition.t >= FADE_MS) this.transition = { kind: 'none' };
        break;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const room = this.room;
    if (room) {
      room.draw(ctx);
      this.debug.render(ctx, {
        grid: room.grid,
        path:
          this.player && this.mover.active
            ? [this.player.feet, ...this.mover.remaining()]
            : [],
        actors: room.actors,
        exits: room.def.exits,
        fps: this.game.fps,
        mouse: this.game.input.mouse,
      });
    }

    let alpha = 0;
    switch (this.transition.kind) {
      case 'none':
        alpha = 0;
        break;
      case 'fade-out':
        alpha = Math.min(1, this.transition.t / FADE_MS);
        break;
      case 'loading':
        alpha = 1;
        break;
      case 'fade-in':
        alpha = 1 - Math.min(1, this.transition.t / FADE_MS);
        break;
    }
    if (alpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
  }
}
