/**
 * Room system: a Room bundles a background, sampled walkmask grid, exits,
 * actors, hotspots and depth scale bands. RoomScene drives the current room —
 * the verb/cursor system, icon bar, hotspots, click-to-walk, the narrator box,
 * script execution (as ScriptHost), and exit transitions with fade out/in.
 */

import type { ScriptAction } from '../data/script';
import type {
  ExitDef,
  Facing,
  HotspotDef,
  Point,
  RoomDef,
  SpawnPoint,
  SpriteSheetDef,
} from '../data/types';
import { Actor } from './actor';
import {
  drawPixelText,
  hasAsset,
  loadImage,
  logPlaceholder,
  makeCanvas,
  pixelTextWidth,
  type LoadedImage,
} from './assets';
import { DebugOverlay } from './debug';
import type { Game, Scene } from './game';
import { hotspotAt } from './hotspot';
import { IconBar } from './iconbar';
import { NarratorBox } from './narrator';
import { findPath, Mover, WalkGrid } from './pathfinding';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import { ScriptRunner, type ScriptHost } from './script';
import type { GameState } from './state';
import {
  emptyClickLine,
  INVENTORY_LINE,
  loadCursors,
  nextVerb,
  noItemLine,
  SETTINGS_LINE,
  unhandledLine,
  type Verb,
} from './verbs';

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

  findActor(id: string): Actor | undefined {
    return this.actors.find((a) => a.id === id);
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

  /** The exit whose rect contains the point, if any (enabled-state is the caller's). */
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

interface Timer {
  remaining: number;
  resolve: () => void;
}

export class RoomScene implements Scene, ScriptHost {
  private room: Room | null = null;
  private player: Actor | null = null;
  private readonly mover = new Mover();
  private readonly debug = new DebugOverlay();
  private readonly iconBar = new IconBar();
  private readonly narrator = new NarratorBox();
  private readonly runner = new ScriptRunner(this);
  private transition: Transition = { kind: 'loading' };

  private activeVerb: Verb = 'walk';
  private cursors: Record<Verb, LoadedImage> | null = null;
  private hover: HotspotDef | null = null;
  private readonly timers: Timer[] = [];
  private scriptWalkResolve: (() => void) | null = null;
  private gotoRoomResolve: (() => void) | null = null;

  constructor(
    private readonly game: Game,
    private readonly rooms: Record<string, RoomDef>,
    private readonly playerTemplate: PlayerTemplate,
    readonly state: GameState,
  ) {}

  /** Load the initial room, cursors and icon bar, then fade in from black. */
  async enterRoom(roomId: string): Promise<void> {
    const def = this.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    const [cursors] = await Promise.all([
      loadCursors(),
      this.iconBar.load(),
      this.loadRoom(roomId, def.playerSpawn),
    ]);
    this.cursors = cursors;
    this.transition = { kind: 'fade-in', t: 0 };
  }

  private async loadRoom(roomId: string, spawn: SpawnPoint): Promise<void> {
    const def = this.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    this.mover.stop();
    this.hover = null;
    // Never leave a script deadlocked on a walk that got interrupted by a room change.
    this.finishScriptWalk(true);

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
    this.state.currentRoom = def.id;
    this.state.playerFacing = spawn.facing;
  }

  // -------------------------------------------------------------------------
  // ScriptHost implementation
  // -------------------------------------------------------------------------

  currentRoomId(): string {
    return this.room?.def.id ?? this.state.currentRoom;
  }

  narrate(text: string, speakerId?: string): Promise<void> {
    const speaker =
      speakerId === undefined
        ? undefined
        : this.room?.findActor(speakerId)?.label ?? speakerId.toUpperCase();
    return this.narrator.show(text, speaker);
  }

  walkPlayerTo(x: number, y: number): Promise<void> {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return Promise.resolve();
    const path = findPath(room.grid, player.feet, { x, y });
    if (!path) {
      console.warn(`[script] walkPlayerTo(${x},${y}) unreachable — skipping`);
      return Promise.resolve();
    }
    this.mover.start(path);
    return new Promise((resolve) => {
      this.scriptWalkResolve = resolve;
    });
  }

  facePlayer(dir: Facing): void {
    if (!this.player) return;
    this.player.facing = dir;
    this.player.play('idle');
    this.state.playerFacing = dir;
  }

  playAnim(actorId: string, anim: string): void {
    const actor = this.room?.findActor(actorId);
    if (actor) actor.setAnim(anim);
    else console.warn(`[script] playAnim: no actor "${actorId}" in this room`);
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timers.push({ remaining: ms, resolve });
    });
  }

  gotoRoom(roomId: string, spawn?: SpawnPoint): Promise<void> {
    const def = this.rooms[roomId];
    if (!def) {
      console.warn(`[script] gotoRoom: unknown room "${roomId}"`);
      return Promise.resolve();
    }
    const target = spawn ?? def.playerSpawn;
    const exit: ExitDef = {
      id: '__script__',
      rect: { x: 0, y: 0, w: 0, h: 0 },
      targetRoom: roomId,
      targetSpawn: { x: target.x, y: target.y },
      facing: target.facing,
    };
    this.mover.stop();
    this.player?.play('idle');
    this.transition = { kind: 'fade-out', t: 0, exit };
    return new Promise((resolve) => {
      this.gotoRoomResolve = resolve;
    });
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dtMs: number): void {
    if (this.game.input.consumePress('Backquote')) this.debug.toggle();

    const room = this.room;
    room?.update(dtMs);

    switch (this.transition.kind) {
      case 'none':
        this.updateLive(dtMs);
        break;
      case 'fade-out': {
        this.drainInput();
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
        this.drainInput();
        break;
      case 'fade-in': {
        this.drainInput();
        this.transition.t += dtMs;
        if (this.transition.t >= FADE_MS) {
          this.transition = { kind: 'none' };
          const resolve = this.gotoRoomResolve;
          this.gotoRoomResolve = null;
          resolve?.();
        }
        break;
      }
    }
  }

  private updateLive(dtMs: number): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    const input = this.game.input;

    this.iconBar.update(dtMs, input.mouse);
    this.narrator.update(dtMs);
    this.tickTimers(dtMs);
    this.state.playerFacing = player.facing;

    // Narrator open: it owns all input (advance/dismiss); world is frozen.
    if (this.narrator.active) {
      const clicked = input.consumeClick() !== null;
      const spaced = input.consumePress('Space');
      const entered = input.consumePress('Enter');
      input.clearRightClicks();
      if (clicked || spaced || entered) this.narrator.advance();
      this.hover = null;
      this.stepMover(dtMs);
      return;
    }

    // Script running (walking, waiting, ...): block world input.
    if (this.runner.running) {
      input.clearClicks();
      input.clearRightClicks();
      this.hover = null;
      this.stepMover(dtMs);
      return;
    }

    // Free play: each queued right-click advances one verb.
    while (input.consumeRightClick()) this.activeVerb = nextVerb(this.activeVerb);

    this.hover = this.iconBar.coversPoint(input.mouse)
      ? null
      : this.hotspotUnderPoint(input.mouse);

    const click = input.consumeClick();
    if (click) {
      if (this.iconBar.coversPoint(click)) this.handleBarClick(click);
      else this.handleWorldClick(click);
    }

    this.stepMover(dtMs);

    const exit = room.exitAt(player.feet);
    if (exit && this.state.isExitEnabled(room.def.id, exit)) {
      this.mover.stop();
      player.play('idle');
      this.transition = { kind: 'fade-out', t: 0, exit };
    }
  }

  private stepMover(dtMs: number): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    this.mover.update(dtMs, player, (y) => room.scaleAt(y));
    if (!this.mover.active) this.finishScriptWalk();
  }

  private finishScriptWalk(force = false): void {
    if (!this.scriptWalkResolve) return;
    if (!force && this.mover.active) return;
    const resolve = this.scriptWalkResolve;
    this.scriptWalkResolve = null;
    resolve();
  }

  private tickTimers(dtMs: number): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      timer.remaining -= dtMs;
      if (timer.remaining <= 0) {
        this.timers.splice(i, 1);
        timer.resolve();
      }
    }
  }

  private drainInput(): void {
    this.game.input.clearClicks();
    this.game.input.clearRightClicks();
    this.hover = null;
  }

  private hotspotUnderPoint(p: Point): HotspotDef | null {
    const room = this.room;
    if (!room) return null;
    return hotspotAt(room.def.hotspots, p, (def) =>
      this.state.isHotspotEnabled(room.def.id, def),
    );
  }

  private handleBarClick(p: Point): void {
    const action = this.iconBar.actionAt(p);
    if (!action) return;
    if (action.kind === 'verb') this.activeVerb = action.verb;
    else if (action.kind === 'inventory') this.runLine(INVENTORY_LINE);
    else this.runLine(SETTINGS_LINE);
  }

  private handleWorldClick(click: Point): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;

    switch (this.activeVerb) {
      case 'walk': {
        const path = findPath(room.grid, player.feet, click);
        if (path) this.mover.start(path);
        break;
      }
      case 'item':
        // No inventory until P3, so ITEM always reports the empty hand.
        this.runLine(noItemLine());
        break;
      default: {
        const verb = this.activeVerb;
        const hotspot = this.hotspotUnderPoint(click);
        if (!hotspot) {
          this.runLine(emptyClickLine(verb));
        } else {
          const actions = hotspot.verbs[verb];
          if (actions) this.runScript(actions);
          else this.runLine(unhandledLine(verb, hotspot.name));
        }
      }
    }
  }

  private runScript(actions: readonly ScriptAction[]): void {
    void this.runner.run(actions).catch((err: unknown) => {
      console.error('[script] failed:', err);
    });
  }

  private runLine(text: string): void {
    this.runScript([{ type: 'narrate', text }]);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    const room = this.room;
    const mouse = this.game.input.mouse;

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
        hotspots: room.def.hotspots.map((def) => ({
          def,
          enabled: this.state.isHotspotEnabled(room.def.id, def),
        })),
        fps: this.game.fps,
        mouse,
      });
      this.iconBar.render(ctx, this.activeVerb);
      this.narrator.render(ctx);
      if (this.hover && !this.narrator.active) this.drawHoverLabel(ctx, this.hover.name);
    }

    // Fade overlay
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

    // Verb cursor, topmost
    if (
      this.cursors &&
      mouse.x >= 0 &&
      mouse.x < LOGICAL_W &&
      mouse.y >= 0 &&
      mouse.y < LOGICAL_H
    ) {
      ctx.drawImage(this.cursors[this.activeVerb], mouse.x - 6, mouse.y - 6);
    }
  }

  private drawHoverLabel(ctx: CanvasRenderingContext2D, name: string): void {
    const mouse = this.game.input.mouse;
    const w = pixelTextWidth(name);
    let x = mouse.x + 8;
    let y = mouse.y + 12;
    if (x + w + 4 > LOGICAL_W - 2) x = LOGICAL_W - 2 - w - 4;
    if (y + 9 > LOGICAL_H - 2) y = mouse.y - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 2, y - 2, w + 4, 9);
    drawPixelText(ctx, name, x, y, '#ffe9a8');
  }
}
