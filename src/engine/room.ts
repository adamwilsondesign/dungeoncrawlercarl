/**
 * Room system: a Room bundles a background, sampled walkmask grid, exits,
 * actors, hotspots and depth scale bands. RoomScene drives the current room —
 * the verb/cursor system, icon bar, hotspots, click-to-walk, the narrator
 * box, dialogue, inventory, cutscenes (camera/letterbox/fades/actor moves,
 * Esc-skippable), save/load, achievements toasts, the death flow, and exit
 * transitions. It implements ScriptHost for the shared runner.
 */

import { combineKey, type CombineDef } from '../data/combines';
import { giveItem, takeItem, type ScriptAction } from '../data/script';
import type {
  CharacterDef,
  CombatantDef,
  CutsceneDef,
  AchievementDef,
  DialogueTree,
  EncounterDef,
  ExitDef,
  Facing,
  ItemDef,
  Point,
  PropDef,
  Rect,
  RoomDef,
  RoomLayout,
  SkillDef,
  SpawnPoint,
  SpriteSheetDef,
  VoiceChannel,
} from '../data/types';
import { CombatScene, type CombatResult } from './combat';
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
import { DialogueBox, DialoguePlayer } from './dialogue';
import { EditorScene } from './editor';
import type { Game, Scene } from './game';
import { TopNav, type BarAction } from './iconbar';
import { InventoryScreen } from './inventory';
import { getUi } from './ui';
import { AchievementsScene, ListMenuScene } from './menus';
import { NarratorBox, wrapText } from './narrator';
import { dominantFacing, findPath, Mover, PLAYER_WALK_SPEED, WalkGrid } from './pathfinding';
import { buildProp, buildPropFromImage, propFromHotspot, RuntimeProp } from './props';
import { effectivePropDefs, getRoomLayout, isAdminMode } from './layouts';
import { RadialMenu, type RadialVerb } from './radial';
import { LOGICAL_H, LOGICAL_W } from './renderer';
import {
  formatPlaytime,
  formatTimestamp,
  makeSaveFile,
  MANUAL_SLOTS,
  readSave,
  writeSave,
  type SaveSlot,
} from './saves';
import { audio } from './audio';
import { ScriptAbort, ScriptRunner, type ScriptHost } from './script';
import type { GameState } from './state';
import { ToastManager } from './toasts';
import { cantCombineLine, loadCursors, unhandledLine, wrongItemLine, type Verb } from './verbs';
import { PartyScene } from './party';

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
  readonly actors: Actor[] = [];
  /**
   * Runtime props (P17): authored PropDefs first (visible art wins hover
   * priority), then legacy hotspots converted to invisible internal props.
   */
  readonly props: RuntimeProp[] = [];
  /** Full background width; wider than 320 enables cameraPan. */
  readonly width: number;

  private background: LoadedImage;
  private readonly bands: RoomDef['scaleBands'];
  /** The mask-derived grid; the effective grid re-adds live prop blockers. */
  private readonly baseGrid: WalkGrid;
  private effectiveGrid: WalkGrid;

  private constructor(def: RoomDef, background: LoadedImage, grid: WalkGrid, actors: Actor[]) {
    this.def = def;
    this.background = background;
    this.baseGrid = grid;
    this.effectiveGrid = grid;
    this.actors.push(...actors);
    this.bands = [...def.scaleBands].sort((a, b) => a.yTop - b.yTop);
    this.width = Math.max(LOGICAL_W, def.backgroundWidth ?? LOGICAL_W);
  }

  /** The walk grid with all enabled prop blockers composed in. */
  get grid(): WalkGrid {
    return this.effectiveGrid;
  }

  /**
   * Load background, walkmask and actor sheets (placeholders where missing).
   * `bg` overrides the base background (flag-gated variants, resolved by the
   * caller who has GameState access).
   */
  static async load(
    def: RoomDef,
    bg?: { path: string; label: string; draw?: RoomDef['placeholderArtDraw'] },
    layout?: RoomLayout | null,
  ): Promise<Room> {
    const background = await loadImage(bg?.path ?? def.backgroundPath, {
      kind: 'background',
      label: bg?.label ?? def.label,
      mood: def.backgroundMood,
      draw: bg ? bg.draw : def.placeholderArtDraw,
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
          outfit: a.sheet.placeholderOutfit,
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

    const room = new Room(def, background, grid, actors);
    await room.loadProps(layout ?? null);
    return room;
  }

  /**
   * Build authored props (art + shapes) with any saved layout overrides
   * merged in (P18), then convert legacy hotspots.
   */
  private async loadProps(layout: RoomLayout | null): Promise<void> {
    const defs = effectivePropDefs(this.def.id, this.def.props ?? [], layout);
    const authored = await Promise.all(defs.map((p) => buildProp(p, this.scaleAt(p.y))));
    this.props.push(...authored);
    this.props.push(...this.def.hotspots.map((h) => propFromHotspot(this.def.id, h)));
    this.rebuildGrid();
  }

  // --- Editor support (P18): live placement rebuilds -------------------------

  findProp(id: string): RuntimeProp | undefined {
    return this.props.find((p) => p.id === id);
  }

  /**
   * Rebuild an existing prop from a patched def, reusing its loaded image
   * (synchronous: safe to call every frame during an editor drag). The new
   * prop previews the def's enabled value directly - the editor pauses the
   * scene, so the flag sync reconciles on resume.
   */
  rebuildPropSync(def: PropDef): RuntimeProp | null {
    const i = this.props.findIndex((p) => p.id === def.id);
    const image = i >= 0 ? this.props[i].imageRef : null;
    if (i < 0 || !image) return null;
    const next = buildPropFromImage(def, image, this.scaleAt(def.y));
    next.enabled = def.enabled !== false;
    this.props[i] = next;
    this.rebuildGrid();
    return next;
  }

  /** Editor: place a brand-new prop (art loads through the normal tiers). */
  async addPropLive(def: PropDef): Promise<RuntimeProp> {
    const prop = await buildProp(def, this.scaleAt(def.y));
    // Keep authored-props-before-legacy ordering for hover priority.
    const firstLegacy = this.props.findIndex((p) => p.legacy);
    if (firstLegacy < 0) this.props.push(prop);
    else this.props.splice(firstLegacy, 0, prop);
    this.rebuildGrid();
    return prop;
  }

  /** Editor: drop a prop entirely (hidden authored / removed added). */
  removePropLive(id: string): boolean {
    const i = this.props.findIndex((p) => p.id === id);
    if (i < 0) return false;
    this.props.splice(i, 1);
    this.rebuildGrid();
    return true;
  }

  /**
   * Sync live prop enabled-state from the flag store; recompose the walk
   * grid only when a blocker-carrying prop actually toggled.
   */
  syncProps(isEnabled: (prop: RuntimeProp) => boolean): void {
    let blockersChanged = false;
    for (const prop of this.props) {
      const enabled = isEnabled(prop);
      if (enabled !== prop.enabled) {
        prop.enabled = enabled;
        if (prop.blocker) blockersChanged = true;
      }
    }
    if (blockersChanged) this.rebuildGrid();
  }

  rebuildGrid(): void {
    const rects = this.props
      .filter((p) => p.enabled && p.blocker !== null)
      .map((p) => p.blocker as Rect);
    this.effectiveGrid = this.baseGrid.withBlockedRects(rects);
  }

  /** First enabled interactive prop containing the point (array order wins). */
  propAt(p: Point): RuntimeProp | null {
    for (const prop of this.props) {
      if (prop.enabled && prop.hitTest(p)) return prop;
    }
    return null;
  }

  addActor(actor: Actor): void {
    this.actors.push(actor);
  }

  /** Swap the background live (flag-gated variants, e.g. the R01 collapse). */
  setBackground(image: LoadedImage): void {
    this.background = image;
  }

  removeActor(id: string): boolean {
    const index = this.actors.findIndex((a) => a.id === id);
    if (index === -1) return false;
    this.actors.splice(index, 1);
    return true;
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

  /**
   * Background, then props + actors interleaved in painter's order: both
   * sort by baseline y (props may pin a z via zOverride), so Carl walks
   * behind a streetlamp at feet-y above its base and in front below it.
   * Ties keep props behind actors (stable sort, props listed first).
   */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.background, 0, 0, this.width, LOGICAL_H);
    const entries: Array<{ z: number; draw: () => void }> = [];
    for (const prop of this.props) {
      if (!prop.enabled || !prop.hasArt) continue;
      entries.push({ z: prop.z, draw: () => prop.draw(ctx) });
    }
    for (const actor of this.actors) {
      entries.push({ z: actor.y, draw: () => actor.draw(ctx, this.scaleAt(actor.y)) });
    }
    entries.sort((a, b) => a.z - b.z);
    for (const e of entries) e.draw();
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

/** Everything the scene needs to resolve content references. */
export interface GameContent {
  rooms: Record<string, RoomDef>;
  player: PlayerTemplate;
  characters: Record<string, CharacterDef>;
  dialogues: Record<string, DialogueTree>;
  items: Record<string, ItemDef>;
  cutscenes: Record<string, CutsceneDef>;
  achievements: Record<string, AchievementDef>;
  skills: Record<string, SkillDef>;
  combatants: Record<string, CombatantDef>;
  encounters: Record<string, EncounterDef>;
  /** Item-combining recipes (P8), keyed by combineKey(a, b). */
  combines: Record<string, CombineDef>;
  startRoom: string;
  /** Gear equipped silently at New Game (P19: the paper doll starts kitted). */
  starterEquipment?: ReadonlyArray<{ member: string; item: string }>;
}

/** Callbacks up into the app shell (main.ts owns the title screen). */
export interface GameFlow {
  quitToTitle: () => void;
}

const FADE_MS = 250;
const LETTERBOX_H = 20;
const LETTERBOX_MS = 250;
/** Hover dwell before the radial verb menu pops (hover intent). */
const RADIAL_HOVER_MS = 180;

type Transition =
  | { kind: 'none' }
  | { kind: 'fade-out'; t: number; exit: ExitDef }
  | { kind: 'loading' }
  | { kind: 'fade-in'; t: number };

interface Timer {
  remaining: number;
  resolve: () => void;
}

interface Tween {
  from: number;
  to: number;
  ms: number;
  t: number;
  resolve: () => void;
}

interface SceneMove {
  actor: Actor;
  mover: Mover;
  resolve: () => void;
}

export class RoomScene implements Scene, ScriptHost {
  private room: Room | null = null;
  private player: Actor | null = null;
  private readonly mover = new Mover();
  private readonly debug = new DebugOverlay();
  private readonly nav = new TopNav(getUi(), (action) => this.handleBarAction(action));
  private readonly narrator = new NarratorBox(getUi());
  private readonly dialogue = new DialogueBox(getUi());
  private readonly dialoguePlayer: DialoguePlayer;
  private readonly invScreen: InventoryScreen;
  private readonly toasts = new ToastManager(getUi());
  private readonly runner = new ScriptRunner(this);
  private keyWalking = false;
  /** Hotspot-reveal pin (H toggles; persisted as a UI pref, not save data). */
  private revealPinned = localStorage.getItem('dcc_reveal_pin') === '1';
  // Radial verb menu: hover-intent tracking + the target it was shown for.
  private readonly radial = new RadialMenu();
  private radialTarget:
    | { kind: 'prop'; def: RuntimeProp }
    | { kind: 'exit'; def: ExitDef }
    | null = null;
  private hoverIntentKey: string | null = null;
  private hoverIntentMs = 0;
  /** Explicitly dismissed (ESC/click-away) over this target: no re-pop until the cursor leaves it. */
  private radialCooldownKey: string | null = null;
  private hoverExit: ExitDef | null = null;
  private transition: Transition = { kind: 'loading' };

  /** Radial disc glyphs (same slots the old verb cursors used). */
  private cursors: Record<Verb, LoadedImage> | null = null;
  /** The always-on inspector's lens cursor (P19). */
  private magnifier: LoadedImage | null = null;
  private readonly itemIcons = new Map<string, LoadedImage>();
  private hover: RuntimeProp | null = null;
  private readonly timers: Timer[] = [];
  private scriptWalkResolve: (() => void) | null = null;
  private gotoRoomResolve: (() => void) | null = null;
  private readonly sceneMovers: SceneMove[] = [];

  // Cinematics
  private cameraX = 0;
  private cameraTween: Tween | null = null;
  private scriptFadeAlpha = 0;
  private fadeTween: Tween | null = null;
  private letterboxOn = false;
  private letterboxT = 0;
  // Screen shake + dust plume (the shake script action / combat intros)
  private shakeFx: { t: number; ms: number; amp: number } | null = null;
  private readonly dust: Array<{ x: number; y: number; vx: number; vy: number; age: number; ttl: number; c: string }> = [];
  // Pre-combat flash (mob = quick pop, boss = heavier strobes)
  private combatFlash: { t: number; ms: number; boss: boolean } | null = null;

  private dying = false;
  private pendingRoomEnter = false;

  constructor(
    private readonly game: Game,
    private readonly content: GameContent,
    readonly state: GameState,
    private readonly flow: GameFlow,
  ) {
    state.autosaveHook = () => this.autosaveNow();
    this.invScreen = new InventoryScreen({
      state,
      items: content.items,
      combatants: content.combatants,
      icons: this.itemIcons,
      onHold: (id) => {
        this.state.heldItem = id;
        this.invScreen.close();
      },
      onCombine: (a, b) => this.resolveCombine(a, b),
      onEquip: (memberId, itemId) => this.equipTo(memberId, itemId),
    });
    this.dialoguePlayer = new DialoguePlayer({
      trees: content.dialogues,
      characters: content.characters,
      state,
      box: this.dialogue,
      runScript: (actions) => this.runner.run(actions),
      fallbackCharacter: (id) => {
        const actor = this.room?.findActor(id);
        return actor ? { name: actor.label, color: '#9aa7b8' } : null;
      },
      isSkipping: () => this.runner.skipping,
    });
  }

  // -------------------------------------------------------------------------
  // Entry points (title screen / flow)
  // -------------------------------------------------------------------------

  async startNewGame(): Promise<void> {
    this.state.reset();
    // P19 starter gear: seeded directly (no acquisition narration) so the
    // party screen's paper doll is dressed from the first frame of Act I.
    for (const seed of this.content.starterEquipment ?? []) {
      const def = this.content.items[seed.item];
      if (!def?.equip) continue;
      this.state.addItem(seed.item, def.stackable === true);
      this.state.equipItem(seed.member, seed.item, def.equip.slot);
    }
    this.resetOverlays();
    await this.enterRoom(this.content.startRoom);
  }

  async continueFromAutosave(): Promise<boolean> {
    return this.loadSlot('auto');
  }

  async loadSlot(slot: SaveSlot): Promise<boolean> {
    const file = readSave(slot);
    if (!file) return false;
    const roomDef = this.content.rooms[file.data.currentRoom];
    if (!roomDef) {
      console.warn(`[saves] slot "${slot}" references unknown room "${file.data.currentRoom}"`);
      return false;
    }
    this.state.restore(file.data);
    this.resetOverlays();
    await this.enterRoom(this.state.currentRoom, {
      x: this.state.playerX,
      y: this.state.playerY,
      facing: this.state.playerFacing,
    });
    return true;
  }

  saveToSlot(slot: SaveSlot): boolean {
    const label = this.room?.def.label ?? this.state.currentRoom;
    return writeSave(slot, makeSaveFile(label, this.state.playtimeMs, this.state.serialize()));
  }

  private autosaveNow(): void {
    if (this.dying) return;
    this.saveToSlot('auto');
  }

  /** Clear death/cinematic overlays when (re)entering play from a menu path. */
  private resetOverlays(): void {
    this.dying = false;
    this.scriptFadeAlpha = 0;
    this.fadeTween?.resolve();
    this.fadeTween = null;
    this.cameraTween?.resolve();
    this.cameraTween = null;
    this.cameraX = 0;
    this.letterboxOn = false;
    this.letterboxT = 0;
  }

  /** Load a room (initial or from save) and fade in; onEnter runs after the fade. */
  async enterRoom(roomId: string, spawn?: SpawnPoint): Promise<void> {
    const def = this.content.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    this.transition = { kind: 'loading' };
    await this.ensureUiLoaded();
    await this.loadRoom(roomId, spawn ?? def.playerSpawn);
    // Per-room music: explicit musicId or the mood default, crossfaded.
    audio.playRoomMusic(def.backgroundMood, def.musicId);
    this.transition = { kind: 'fade-in', t: 0 };
  }

  private async ensureUiLoaded(): Promise<void> {
    if (this.cursors) return;
    const [cursors, magnifier] = await Promise.all([
      loadCursors(),
      loadImage('ui/cursor_magnify.png', { kind: 'cursor', glyph: 'magnify' }),
      this.loadItemIcons(),
    ]);
    this.cursors = cursors;
    this.magnifier = magnifier;
  }

  private async loadItemIcons(): Promise<void> {
    await Promise.all(
      Object.values(this.content.items).map(async (item) => {
        const icon = await loadImage(`ui/item_${item.id}.png`, {
          kind: 'item',
          label: item.name,
        });
        this.itemIcons.set(item.id, icon);
      }),
    );
  }

  private async loadRoom(roomId: string, spawn: SpawnPoint): Promise<void> {
    const def = this.content.rooms[roomId];
    if (!def) throw new Error(`Unknown room "${roomId}"`);
    this.mover.stop();
    this.mover.speed = 55;
    this.hover = null;
    this.hoverExit = null;
    this.cameraX = 0;
    // Never leave scripts deadlocked on moves interrupted by a room change.
    this.finishScriptWalk(true);
    for (const move of this.sceneMovers.splice(0)) move.resolve();

    const layout = await getRoomLayout(def.id);
    const room = await Room.load(def, this.resolveBackgroundSpec(def), layout);
    // Resolve prop enabled-state before anything paths on the walk grid.
    room.syncProps((p) =>
      this.state.isHotspotEnabled(def.id, { id: p.id, enabled: p.initialEnabled }),
    );
    const sheet = this.content.player.sheet;
    const image = await loadImage(sheet.path, {
      kind: 'actor',
      label: this.content.player.label,
      color: this.content.player.color,
      frameW: sheet.frameW,
      frameH: sheet.frameH,
      outfit: sheet.placeholderOutfit,
    });
    const player = new Actor({
      id: 'player',
      label: this.content.player.label,
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
    this.state.playerX = spawn.x;
    this.state.playerY = spawn.y;
    this.pendingRoomEnter = true;
  }

  /** After the fade-in: run RoomDef.onEnter through the runner, then autosave. */
  private handleRoomEntered(): void {
    if (!this.pendingRoomEnter) return;
    this.pendingRoomEnter = false;
    const actions = this.room?.def.onEnter;
    if (actions && actions.length > 0) {
      void this.runner
        .run(actions)
        .then(() => this.autosaveNow())
        .catch((err: unknown) => {
          if (!(err instanceof ScriptAbort)) console.error('[script] onEnter failed:', err);
        });
    } else {
      this.autosaveNow();
    }
  }

  // -------------------------------------------------------------------------
  // ScriptHost implementation
  // -------------------------------------------------------------------------

  currentRoomId(): string {
    return this.room?.def.id ?? this.state.currentRoom;
  }

  narrate(text: string, speakerId?: string, channel?: VoiceChannel): Promise<void> {
    if (this.runner.skipping) return Promise.resolve();
    const speaker =
      speakerId === undefined
        ? undefined
        : this.room?.findActor(speakerId)?.label ?? speakerId.toUpperCase();
    return this.narrator.show(text, speaker, channel);
  }

  sayLine(actorId: string, text: string): Promise<void> {
    return this.dialoguePlayer.say(actorId, text);
  }

  runDialogue(treeId: string): Promise<void> {
    return this.dialoguePlayer.play(treeId);
  }

  getItemDef(id: string): ItemDef | undefined {
    return this.content.items[id];
  }

  getCutscene(id: string): CutsceneDef | undefined {
    return this.content.cutscenes[id];
  }

  walkPlayerTo(x: number, y: number): Promise<void> {
    return this.moveActor('player', x, y);
  }

  moveActor(actorId: string, x: number, y: number, speed?: number): Promise<void> {
    const room = this.room;
    const actor = actorId === 'player' ? this.player : room?.findActor(actorId);
    if (!room || !actor) {
      console.warn(`[script] moveActor: no actor "${actorId}" in this room`);
      return Promise.resolve();
    }
    if (this.runner.skipping) {
      actor.x = x;
      actor.y = y;
      actor.play('idle');
      return Promise.resolve();
    }
    if (actor === this.player) {
      const path = findPath(room.grid, actor.feet, { x, y }) ?? [{ x, y }];
      this.mover.speed = speed ?? 55;
      this.mover.start(path);
      return new Promise((resolve) => {
        this.scriptWalkResolve = resolve;
      });
    }
    const mover = new Mover();
    mover.speed = speed ?? 55;
    mover.start([{ x, y }]);
    return new Promise((resolve) => {
      this.sceneMovers.push({ actor, mover, resolve });
    });
  }

  async spawnActor(spec: {
    actorId: string;
    sheet: SpriteSheetDef;
    x: number;
    y: number;
    anim?: string;
    facing?: Facing;
  }): Promise<void> {
    const room = this.room;
    if (!room) return;
    this.despawnActor(spec.actorId);
    const character = this.content.characters[spec.actorId];
    const label = character?.name ?? spec.actorId.toUpperCase();
    const color = character?.color ?? '#9aa7b8';
    const image = await loadImage(spec.sheet.path, {
      kind: 'actor',
      label,
      color,
      frameW: spec.sheet.frameW,
      frameH: spec.sheet.frameH,
      outfit: spec.sheet.placeholderOutfit,
    });
    const actor = new Actor({
      id: spec.actorId,
      label,
      sheet: spec.sheet,
      image,
      x: spec.x,
      y: spec.y,
      facing: spec.facing ?? 'down',
    });
    actor.setAnim(spec.anim ?? 'idle_down');
    room.addActor(actor);
  }

  despawnActor(actorId: string): void {
    if (actorId === 'player') {
      console.warn('[script] despawnActor: refusing to despawn the player');
      return;
    }
    for (let i = this.sceneMovers.length - 1; i >= 0; i--) {
      if (this.sceneMovers[i].actor.id === actorId) {
        this.sceneMovers[i].resolve();
        this.sceneMovers.splice(i, 1);
      }
    }
    this.room?.removeActor(actorId);
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
    if (this.runner.skipping) return Promise.resolve();
    return new Promise((resolve) => {
      this.timers.push({ remaining: ms, resolve });
    });
  }

  gotoRoom(roomId: string, spawn?: SpawnPoint): Promise<void> {
    const def = this.content.rooms[roomId];
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

  scriptFade(targetAlpha: number, ms: number): Promise<void> {
    if (this.runner.skipping || ms <= 0) {
      this.scriptFadeAlpha = targetAlpha;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.fadeTween = { from: this.scriptFadeAlpha, to: targetAlpha, ms, t: 0, resolve };
    });
  }

  cameraPan(fromX: number, toX: number, ms: number): Promise<void> {
    const maxX = Math.max(0, (this.room?.width ?? LOGICAL_W) - LOGICAL_W);
    if (maxX <= 0) return Promise.resolve(); // single-screen room: no-op
    const clamp = (v: number): number => Math.max(0, Math.min(maxX, v));
    if (this.runner.skipping || ms <= 0) {
      this.cameraX = clamp(toX);
      return Promise.resolve();
    }
    this.cameraX = clamp(fromX);
    return new Promise((resolve) => {
      this.cameraTween = { from: clamp(fromX), to: clamp(toX), ms, t: 0, resolve };
    });
  }

  setLetterbox(on: boolean): void {
    this.letterboxOn = on;
    if (this.runner.skipping) this.letterboxT = on ? 1 : 0;
  }

  shake(ms: number, magnitude: number): Promise<void> {
    if (this.runner.skipping) return Promise.resolve();
    this.shakeFx = { t: 0, ms, amp: magnitude };
    // Dust plume: debris motes kicked up from the floor line, drifting up.
    for (let i = 0; i < 26; i++) {
      this.dust.push({
        x: Math.random() * LOGICAL_W,
        y: 104 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 18,
        age: 0,
        ttl: 900 + Math.random() * 900,
        c: Math.random() < 0.5 ? 'rgba(180,170,150,0.6)' : 'rgba(120,115,105,0.5)',
      });
    }
    return this.wait(ms);
  }

  /** The active flag-gated background variant for a room, if any. */
  private resolveBackgroundSpec(def: RoomDef): {
    path: string;
    label: string;
    draw?: RoomDef['placeholderArtDraw'];
  } {
    for (const alt of def.altBackgrounds ?? []) {
      if (this.state.getFlag(alt.flag)) {
        return { path: alt.path, label: alt.label ?? def.label, draw: alt.draw };
      }
    }
    return { path: def.backgroundPath, label: def.label, draw: def.placeholderArtDraw };
  }

  async refreshBackground(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const bg = this.resolveBackgroundSpec(room.def);
    const image = await loadImage(bg.path, {
      kind: 'background',
      label: bg.label,
      mood: room.def.backgroundMood,
      draw: bg.draw,
    });
    room.setBackground(image);
  }

  awardAchievement(id: string): void {
    const key = `ach:${id}`;
    if (this.state.getFlag(key)) return; // idempotent
    this.state.setFlag(key, true);
    const def = this.content.achievements[id];
    if (!def) console.warn(`[achievements] unknown achievement "${id}"`);
    audio.playSfx('sfx_achievement');
    this.toasts.push('ACHIEVEMENT UNLOCKED', def?.name ?? id.toUpperCase());
  }

  killPlayer(reason: string): void {
    if (this.dying) return;
    this.dying = true;
    this.mover.stop();
    audio.playSfx('sfx_death');
    this.awardAchievement('first_death');
    void this.scriptFadeForDeath().then(() => this.openDeathDialog(reason));
  }

  quitToTitle(): void {
    this.flow.quitToTitle();
  }

  getEncounter(id: string): EncounterDef | undefined {
    return this.content.encounters[id];
  }

  async runEncounter(encounterId: string): Promise<CombatResult | null> {
    const encounter = this.content.encounters[encounterId];
    if (!encounter) {
      console.warn(`[combat] unknown encounter "${encounterId}"`);
      return null;
    }
    // Scene-level battle transition, world side: the theme cues at transition
    // start, then a flash (mob) or flash + shake (boss) plays over the room
    // before the combat scene wipes in on top.
    const boss = encounter.transitionKind === 'boss';
    audio.playMusic(boss || encounter.backdropMood === 'boss' ? 'music_boss' : 'music_combat');
    console.info(`[combat] transition: ${boss ? 'boss' : 'mob'} (${encounterId})`);
    this.combatFlash = { t: 0, ms: boss ? 650 : 300, boss };
    if (boss) void this.shake(650, 3);
    await this.wait(boss ? 650 : 300);
    const scene = await CombatScene.create(
      {
        game: this.game,
        state: this.state,
        items: this.content.items,
        skills: this.content.skills,
        combatants: this.content.combatants,
      },
      encounter,
    );
    return new Promise((resolve) => {
      scene.onFinish = resolve;
      this.game.pushScene(scene);
    });
  }

  private scriptFadeForDeath(): Promise<void> {
    return new Promise((resolve) => {
      this.fadeTween = { from: this.scriptFadeAlpha, to: 1, ms: 600, t: 0, resolve };
    });
  }

  // -------------------------------------------------------------------------
  // Menus (settings, save/load, death)
  // -------------------------------------------------------------------------

  openSettingsMenu(): void {
    const menu = new ListMenuScene(this.game, {
      title: 'SYSTEM MENU',
      items: [
        { label: 'SAVE GAME' },
        { label: 'LOAD GAME' },
        { label: 'ACHIEVEMENTS' },
        { label: 'QUIT TO TITLE' },
        { label: 'RETURN' },
      ],
      footer: 'ESC: RETURN',
      onPick: (i) => {
        if (i === 0) this.openSaveLoadMenu('save');
        else if (i === 1) this.openSaveLoadMenu('load');
        else if (i === 2) {
          this.game.pushScene(
            new AchievementsScene(this.game, this.content.achievements, this.state),
          );
        } else if (i === 3) {
          this.game.popTo(this);
          this.flow.quitToTitle();
        } else this.game.popScene();
      },
      onCancel: () => this.game.popScene(),
    });
    this.game.pushScene(menu);
  }

  openSaveLoadMenu(mode: 'save' | 'load'): void {
    const slots: SaveSlot[] = mode === 'save' ? [...MANUAL_SLOTS] : ['auto', ...MANUAL_SLOTS];
    const items = slots.map((slot) => {
      const file = readSave(slot);
      return {
        label: slot === 'auto' ? 'AUTOSAVE' : `SLOT ${slot}`,
        sub: file
          ? `${file.roomLabel} - ${formatTimestamp(file.savedAt)} - ${formatPlaytime(file.playtimeMs)}`
          : 'EMPTY',
        disabled: mode === 'load' && !file,
      };
    });
    const menu = new ListMenuScene(this.game, {
      title: mode === 'save' ? 'SAVE GAME' : 'LOAD GAME',
      items,
      footer: 'ESC: BACK',
      onPick: (i) => {
        const slot = slots[i];
        if (mode === 'save') {
          if (readSave(slot)) this.confirmOverwrite(slot);
          else this.doSave(slot);
        } else {
          this.game.popTo(this);
          void this.loadSlot(slot);
        }
      },
      onCancel: () => this.game.popScene(),
    });
    this.game.pushScene(menu);
  }

  private confirmOverwrite(slot: SaveSlot): void {
    this.game.pushScene(
      new ListMenuScene(this.game, {
        title: `OVERWRITE SLOT ${slot}?`,
        items: [{ label: 'NO' }, { label: 'YES' }],
        onPick: (i) => {
          if (i === 1) this.doSave(slot);
          else this.game.popScene();
        },
        onCancel: () => this.game.popScene(),
      }),
    );
  }

  private equipTo(memberId: string, itemId: string): void {
    const def = this.content.items[itemId];
    if (!def?.equip) return;
    if (this.state.equipItem(memberId, itemId, def.equip.slot)) {
      const who = this.content.combatants[memberId]?.name ?? memberId.toUpperCase();
      this.toasts.push('EQUIPPED', `${def.name} - ${who}`, '#3fd9ff');
    }
  }

  private doSave(slot: SaveSlot): void {
    const ok = this.saveToSlot(slot);
    this.game.popTo(this);
    this.toasts.push(ok ? 'GAME SAVED' : 'SAVE FAILED', `SLOT ${slot.toUpperCase()}`, '#3fd9ff');
  }

  private openDeathDialog(reason: string): void {
    const body = wrapText(reason, 52);
    body.push('', 'The dungeon thanks you for your participation.');
    this.game.pushScene(
      new ListMenuScene(this.game, {
        title: 'CRAWLER STATUS: DECEASED',
        accent: '#ff6e6e',
        body,
        items: [{ label: 'TRY AGAIN' }, { label: 'RESTORE' }, { label: 'QUIT TO TITLE' }],
        footer: 'DEATH IS A MINOR SETBACK',
        onPick: (i) => {
          if (i === 0) {
            this.game.popTo(this);
            void this.restartFromCheckpoint();
          } else if (i === 1) {
            this.openSaveLoadMenu('load');
          } else {
            this.game.popTo(this);
            this.flow.quitToTitle();
          }
        },
        // No onCancel: death must be answered.
      }),
    );
  }

  private async restartFromCheckpoint(): Promise<void> {
    if (readSave('auto')) {
      const ok = await this.loadSlot('auto');
      if (ok) return;
    }
    // No autosave: restart the current room from its spawn, state intact.
    this.resetOverlays();
    await this.enterRoom(this.state.currentRoom || this.content.startRoom);
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dtMs: number): void {
    if (this.game.input.consumePress('Backquote')) this.debug.toggle();

    this.state.playtimeMs += dtMs;
    this.tickCinematics(dtMs);
    this.radial.tick(dtMs);

    const room = this.room;
    room?.update(dtMs);
    // Prop enabled-state follows the flag store every frame (cheap diff);
    // the walk grid recomposes only when a blocker-carrying prop toggles.
    room?.syncProps((p) =>
      this.state.isHotspotEnabled(room.def.id, { id: p.id, enabled: p.initialEnabled }),
    );

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
          this.handleRoomEntered();
        }
        break;
      }
    }
  }

  updatePassive(dtMs: number): void {
    this.toasts.update(dtMs);
  }

  private tickCinematics(dtMs: number): void {
    if (this.fadeTween) {
      const tw = this.fadeTween;
      tw.t += dtMs;
      const k = Math.min(1, tw.t / tw.ms);
      this.scriptFadeAlpha = tw.from + (tw.to - tw.from) * k;
      if (k >= 1) {
        this.fadeTween = null;
        tw.resolve();
      }
    }
    if (this.cameraTween) {
      const tw = this.cameraTween;
      tw.t += dtMs;
      const k = Math.min(1, tw.t / tw.ms);
      this.cameraX = tw.from + (tw.to - tw.from) * k;
      if (k >= 1) {
        this.cameraTween = null;
        tw.resolve();
      }
    }
    const target = this.letterboxOn ? 1 : 0;
    const step = dtMs / LETTERBOX_MS;
    this.letterboxT =
      this.letterboxT < target
        ? Math.min(target, this.letterboxT + step)
        : Math.max(target, this.letterboxT - step);

    if (this.shakeFx) {
      this.shakeFx.t += dtMs;
      if (this.shakeFx.t >= this.shakeFx.ms) this.shakeFx = null;
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.age += dtMs;
      p.x += (p.vx * dtMs) / 1000;
      p.y += (p.vy * dtMs) / 1000;
      p.vy += (6 * dtMs) / 1000; // drift slows as it rises
      if (p.age > p.ttl) this.dust.splice(i, 1);
    }
    if (this.combatFlash) {
      this.combatFlash.t += dtMs;
      if (this.combatFlash.t >= this.combatFlash.ms) this.combatFlash = null;
    }
  }

  /** Current shake pixel offset (0,0 when idle). */
  private shakeOffset(): Point {
    const fx = this.shakeFx;
    if (!fx) return { x: 0, y: 0 };
    const decay = 1 - fx.t / fx.ms;
    const a = fx.amp * decay;
    return {
      x: Math.round(Math.sin(fx.t * 0.09) * a),
      y: Math.round(Math.cos(fx.t * 0.13) * a),
    };
  }

  private updateLive(dtMs: number): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    const input = this.game.input;

    this.narrator.update(dtMs);
    this.dialogue.update(dtMs);
    this.toasts.update(dtMs);
    this.tickTimers(dtMs);
    this.state.playerFacing = player.facing;
    this.state.playerX = player.x;
    this.state.playerY = player.y;

    // Same gates as world clicks: no radial during scripts, boxes, menus.
    if (
      this.dying ||
      this.runner.running ||
      this.dialogue.active ||
      this.narrator.active ||
      this.invScreen.open
    ) {
      this.radial.forceHide();
      this.hoverIntentMs = 0;
    }

    if (this.dying) {
      this.drainInput();
      return;
    }

    // Esc during a cutscene fast-forwards it, whatever is currently pending.
    if (this.runner.inCutscene && input.consumePress('Escape')) {
      this.skipCutscene();
      return;
    }

    // Dialogue box (lines or choices) owns input first.
    if (this.dialogue.active) {
      input.clearRightClicks();
      const wheel = input.consumeWheel();
      if (wheel !== 0) this.dialogue.scrollBy(wheel);
      if (input.consumePress('Escape')) this.dialogue.cancel();
      if (input.consumePress('ArrowUp')) this.dialogue.moveSelection(-1);
      if (input.consumePress('ArrowDown')) this.dialogue.moveSelection(1);
      if (input.consumePress('Enter')) this.dialogue.confirm();
      if (input.consumePress('Space')) this.dialogue.advanceIntent();
      this.dialogue.hover(input.mouse);
      const click = input.consumeClick();
      if (click) this.dialogue.click(click);
      this.hover = null;
      this.hoverExit = null;
      this.stepMovers(dtMs);
      return;
    }

    // Narrator open: it owns all input (advance/dismiss); world is frozen.
    if (this.narrator.active) {
      const clicked = input.consumeClick() !== null;
      const spaced = input.consumePress('Space');
      const entered = input.consumePress('Enter');
      input.clearRightClicks();
      if (clicked || spaced || entered) this.narrator.advance();
      this.hover = null;
      this.hoverExit = null;
      this.stepMovers(dtMs);
      return;
    }

    // Inventory screen (P20: DOM-native): the room only guards world input
    // and handles ESC; every pointer interaction happens inside the overlay.
    if (this.invScreen.open) {
      if (input.consumePress('Escape')) this.invScreen.close();
      input.clearClicks();
      input.clearRightClicks();
      input.consumeWheel();
      this.hover = null;
      this.hoverExit = null;
      return;
    }

    // Script running (walking, waiting, ...): block world input.
    if (this.runner.running) {
      input.clearClicks();
      input.clearRightClicks();
      this.hover = null;
      this.hoverExit = null;
      this.stepMovers(dtMs);
      return;
    }

    // Free play (P19): right-click is cancel/deselect - drop the held item
    // and dismiss the radial. Arms the same re-pop cooldown as Escape so
    // the wheel stays down until the cursor leaves the target.
    while (input.consumeRightClick()) {
      if (this.state.heldItem) this.state.heldItem = null;
      if (this.radial.active) {
        this.radial.dismiss();
        this.radialCooldownKey = this.hover
          ? `h:${this.hover.id}`
          : this.hoverExit
            ? `e:${this.hoverExit.id}`
            : this.radialCooldownKey;
      }
    }

    // P18: the hidden admin room editor. Gated on the per-browser admin
    // flag (localStorage, never GameState) - players without it never see
    // any editor UI and Shift+E stays a dead key.
    if (
      isAdminMode() &&
      (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) &&
      input.consumePress('KeyE') &&
      this.room
    ) {
      this.radial.forceHide();
      this.game.pushScene(new EditorScene(this.game, this.room));
      return;
    }

    // Hotspot-reveal pin toggle (discoverability fix); persists across reloads.
    if (input.consumePress('KeyH')) {
      this.revealPinned = !this.revealPinned;
      localStorage.setItem('dcc_reveal_pin', this.revealPinned ? '1' : '0');
      this.toasts.push('HOTSPOT REVEAL', this.revealPinned ? 'PINNED ON (H)' : 'OFF (HOLD TAB)', '#3fd9ff');
    }

    // One-time, in-voice UI pointer (once ever, not per save). New key so
    // players who saw the pre-wheel hint get the updated one exactly once.
    if (!localStorage.getItem('dcc_hint_ui') && (this.room?.props.some((p) => p.interactive) ?? false)) {
      localStorage.setItem('dcc_hint_ui', '1');
      localStorage.setItem('dcc_hint_reveal', '1'); // retire the old hint
      // The AI addressing the Crawler directly: this rides the broadcast.
      this.runScript([
        {
          type: 'narrate',
          channel: 'announce',
          text: 'A tip from the booth, Crawler: hold TAB to see everything in a room worth touching - press H to keep it lit. Hover a thing and the wheel appears: pick from it, or tap S to look, W to grab, D to talk, A to walk over. The dungeon hides nothing. It merely declines to point.',
        },
      ]);
      return;
    }

    const worldMouse = this.toWorld(input.mouse);
    // No world hover while the pointer rides DOM UI (nav, narration boxes):
    // it keeps the radial from ghost-popping under a panel.
    this.hover = input.overUi ? null : this.propUnderPoint(worldMouse);
    const exitUnderMouse = input.overUi ? null : room.exitAt(worldMouse);
    this.hoverExit =
      !this.hover && exitUnderMouse && this.state.isExitEnabled(room.def.id, exitUnderMouse)
        ? exitUnderMouse
        : null;

    // --- Radial verb menu -------------------------------------------------
    // Hover an interactable for RADIAL_HOVER_MS and the wheel pops at the
    // cursor. Not in ITEM-held mode (a click there means "use item on it").
    const itemHeld = this.state.heldItem !== null;
    const hoverKey = this.hover ? `h:${this.hover.id}` : this.hoverExit ? `e:${this.hoverExit.id}` : null;
    if (this.radial.active) {
      // Dismiss when the cursor leaves both the shown target and the wheel.
      const t = this.radialTarget;
      const overShown =
        (t?.kind === 'prop' && this.hover === t.def) ||
        (t?.kind === 'exit' && this.hoverExit === t.def);
      if (!overShown && !this.radial.contains(input.mouse)) this.radial.dismiss();
    }
    if (this.radial.active) {
      if (input.consumePress('Escape')) {
        this.radial.dismiss();
        this.radialCooldownKey = hoverKey;
      } else {
        // P19 WASD verb shortcuts: fire immediately on the hovered target.
        // S = LOOK (N disc), W = GRAB/hand (E), D = TALK (S), A = walk (W).
        const shortcuts: ReadonlyArray<readonly [string, number]> = [
          ['KeyS', 0],
          ['KeyW', 1],
          ['KeyD', 2],
          ['KeyA', 3],
        ];
        for (const [code, disc] of shortcuts) {
          if (input.consumePress(code)) {
            this.radial.selected = disc;
            this.fireRadial(this.radial.verb);
            this.stepMovers(dtMs);
            this.checkExitArrival();
            return;
          }
        }
        if (input.consumePress('ArrowUp')) this.radial.selected = 0;
        if (input.consumePress('ArrowRight')) this.radial.selected = 1;
        if (input.consumePress('ArrowDown')) this.radial.selected = 2;
        if (input.consumePress('ArrowLeft')) this.radial.selected = 3;
        this.radial.updateSelectionFromCursor(input.mouse);
        const rClick = input.consumeClick();
        if (rClick) {
          const disc = this.radial.discAt(rClick);
          if (disc !== null) {
            this.radial.selected = disc;
            this.fireRadial(this.radial.verb);
          } else if (this.radial.contains(rClick) || hoverKey) {
            // Flick-and-click: any click while the wheel is up fires the
            // direction-highlighted option.
            this.fireRadial(this.radial.verb);
          } else {
            this.radial.dismiss();
            this.radialCooldownKey = hoverKey;
          }
        } else if (input.consumePress('Enter') || input.consumePress('Space')) {
          this.fireRadial(this.radial.verb);
        }
      }
      this.hoverIntentMs = 0;
      this.stepMovers(dtMs);
      this.checkExitArrival(); // world simulation continues under the wheel
      return; // the wheel owns world input while it is up
    }
    // No wheel while Carl is already walking somewhere (incl. a WALK just
    // fired at an exit - re-opening would swallow the arrival transition).
    if (this.radialCooldownKey !== null && hoverKey !== this.radialCooldownKey) {
      this.radialCooldownKey = null; // left the dismissed target: re-arm
    }
    if (
      !itemHeld &&
      hoverKey &&
      hoverKey !== this.radialCooldownKey &&
      this.radial.hidden &&
      !this.mover.active
    ) {
      if (this.hoverIntentKey === hoverKey) {
        this.hoverIntentMs += dtMs;
        if (this.hoverIntentMs >= RADIAL_HOVER_MS) {
          this.radialTarget = this.hover
            ? { kind: 'prop', def: this.hover }
            : this.hoverExit
              ? { kind: 'exit', def: this.hoverExit }
              : null;
          if (this.radialTarget) {
            const label = this.hover ? this.hover.name ?? 'THAT' : 'EXIT';
            this.radial.show(input.mouse, label);
            console.info(`[radial] open: ${label}`);
          }
        }
      } else {
        this.hoverIntentKey = hoverKey;
        this.hoverIntentMs = 0;
      }
    } else {
      this.hoverIntentKey = hoverKey;
      this.hoverIntentMs = 0;
    }

    const click = input.consumeClick();
    if (click) this.handleWorldClick(this.toWorld(click));

    // Continuous keyboard walking - ARROWS ONLY (P19: WASD became the
    // radial verb shortcuts). Shares the walkmask and speed with
    // click-to-walk; a key move cancels any active click path.
    const kx = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
    const ky = (input.isDown('ArrowDown') ? 1 : 0) - (input.isDown('ArrowUp') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      this.mover.stop();
      const norm = kx !== 0 && ky !== 0 ? Math.SQRT1_2 : 1;
      const step = PLAYER_WALK_SPEED * room.scaleAt(player.y) * (dtMs / 1000) * norm;
      const nx = player.x + kx * step;
      const ny = player.y + ky * step;
      if (kx !== 0 && room.grid.isWalkablePoint(nx, player.y)) player.x = nx;
      if (ky !== 0 && room.grid.isWalkablePoint(player.x, ny)) player.y = ny;
      player.facing = dominantFacing(kx, ky);
      player.play('walk');
      this.keyWalking = true;
    } else if (this.keyWalking) {
      this.keyWalking = false;
      if (!this.mover.active) player.play('idle');
    }

    this.stepMovers(dtMs);
    this.checkExitArrival();
  }

  /** Player feet inside an enabled exit rect: start the room transition. */
  private checkExitArrival(): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    const exit = room.exitAt(player.feet);
    if (exit && this.state.isExitEnabled(room.def.id, exit)) {
      this.mover.stop();
      player.play('idle');
      audio.playSfx('sfx_door');
      this.transition = { kind: 'fade-out', t: 0, exit };
    }
  }

  private toWorld(p: Point): Point {
    return { x: p.x + Math.round(this.cameraX), y: p.y };
  }

  private skipCutscene(): void {
    this.runner.requestSkip();
    if (this.player) this.mover.finish(this.player);
    this.finishScriptWalk(true);
    for (const move of this.sceneMovers.splice(0)) {
      move.mover.finish(move.actor);
      move.resolve();
    }
    if (this.cameraTween) {
      this.cameraX = this.cameraTween.to;
      const { resolve } = this.cameraTween;
      this.cameraTween = null;
      resolve();
    }
    if (this.fadeTween) {
      this.scriptFadeAlpha = this.fadeTween.to;
      const { resolve } = this.fadeTween;
      this.fadeTween = null;
      resolve();
    }
    this.letterboxT = this.letterboxOn ? 1 : 0;
    this.flushTimers();
    this.narrator.skipAll();
    this.dialogue.forceResolveAll();
  }

  private stepMovers(dtMs: number): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    this.mover.update(dtMs, player, (y) => room.scaleAt(y));
    if (!this.mover.active) {
      this.mover.speed = 55;
      this.finishScriptWalk();
    }
    for (let i = this.sceneMovers.length - 1; i >= 0; i--) {
      const move = this.sceneMovers[i];
      move.mover.update(dtMs, move.actor, (y) => room.scaleAt(y));
      if (!move.mover.active) {
        this.sceneMovers.splice(i, 1);
        move.resolve();
      }
    }
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

  private flushTimers(): void {
    for (const timer of this.timers.splice(0)) timer.resolve();
  }

  private drainInput(): void {
    this.game.input.clearClicks();
    this.game.input.clearRightClicks();
    this.hover = null;
    this.hoverExit = null;
    this.radial.forceHide();
  }

  /** First enabled interactive prop under the point (props include legacy hotspots). */
  private propUnderPoint(p: Point): RuntimeProp | null {
    return this.room?.propAt(p) ?? null;
  }

  /** Top-nav clicks arrive straight from the DOM; gate them to free play. */
  private handleBarAction(action: BarAction): void {
    if (
      !this.game.isTop(this) ||
      this.transition.kind !== 'none' ||
      this.runner.running ||
      this.dialogue.active ||
      this.narrator.active ||
      this.invScreen.open ||
      this.dying
    ) {
      return;
    }
    audio.playSfx('sfx_ui_click');
    this.radial.forceHide();
    if (action === 'inventory') this.invScreen.show();
    else if (action === 'party') this.openPartyScreen();
    else this.openSettingsMenu();
  }

  /** RoomScene leaves the stack (quit to title): hide the persistent HUD. */
  dispose(): void {
    this.nav.setVisible(false);
    this.narrator.skipAll();
    this.dialogue.forceResolveAll();
    this.invScreen.close();
    this.radial.forceHide();
  }

  private openPartyScreen(): void {
    this.game.pushScene(
      new PartyScene(this.game, {
        state: this.state,
        combatants: this.content.combatants,
        items: this.content.items,
        skills: this.content.skills,
        itemIcons: this.itemIcons,
      }),
    );
  }

  /**
   * P19 click model: a held item applies to the prop under the click; a
   * bare click on an interactable pops the radial right there (no hover
   * dwell needed); anything else - empty space, exits - walks Carl.
   */
  private handleWorldClick(click: Point): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;

    // Clicks inside an enabled EXIT always walk (props may visually cover
    // exits - the staircase beam - and walking is what an exit click means).
    const exit = room.exitAt(click);
    const exitEnabled = exit !== null && this.state.isExitEnabled(room.def.id, exit);
    const prop = exitEnabled ? null : this.propUnderPoint(click);
    if (this.state.heldItem && prop) {
      this.handleItemClick(click);
      return;
    }
    if (prop && !this.state.heldItem) {
      this.radialTarget = { kind: 'prop', def: prop };
      this.radial.show(this.game.input.mouse, prop.name ?? 'THAT');
      console.info(`[radial] open: ${prop.name ?? 'THAT'}`);
      return;
    }
    const path = findPath(room.grid, player.feet, click);
    if (path) {
      this.mover.speed = 55;
      this.mover.start(path);
    }
  }

  private handleItemClick(click: Point): void {
    const held = this.state.heldItem;
    if (!held) return;
    const heldName = this.content.items[held]?.name ?? held.toUpperCase();
    const prop = this.propUnderPoint(click);
    if (!prop) return; // caller walks instead

    const propName = prop.name ?? 'THAT';
    const handler = prop.verbs.item;
    if (!handler) {
      this.runLine(wrongItemLine(heldName, propName));
      return;
    }
    if (Array.isArray(handler)) {
      this.runScript(handler);
      return;
    }
    const actions = handler[held] ?? handler['default'];
    if (actions) this.runScript(actions);
    else this.runLine(wrongItemLine(heldName, propName));
  }

  // -------------------------------------------------------------------------
  // Radial verb menu: firing + the WALK approach affordance
  // -------------------------------------------------------------------------

  /** Fire a radial pick: same dispatch as the top-bar flow. */
  private fireRadial(verb: RadialVerb): void {
    const target = this.radialTarget;
    this.radial.dismiss();
    if (!target) return;
    console.info(`[radial] fire: ${verb} -> ${target.kind}:${target.def.id}`);
    audio.playSfx('sfx_verb');
    if (verb === 'walk') {
      this.walkToRadialTarget(target);
      return;
    }
    if (target.kind === 'exit') {
      this.runLine(unhandledLine(verb, 'EXIT'));
      return;
    }
    const actions = target.def.verbs[verb];
    if (actions) this.runScript(actions);
    else this.runLine(unhandledLine(verb, target.def.name ?? 'THAT'));
  }

  /**
   * WALK from the radial: approach the target. Exits are walked into (the
   * normal arrival transition fires); props get the nearest reachable
   * point just outside their hit bounds, then Carl turns to face them.
   */
  private walkToRadialTarget(
    target: { kind: 'prop'; def: RuntimeProp } | { kind: 'exit'; def: ExitDef },
  ): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    if (target.kind === 'exit') {
      const r = target.def.rect;
      const path = findPath(room.grid, player.feet, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
      if (path) {
        this.mover.speed = 55;
        this.mover.start(path);
      }
      return;
    }
    const r = target.def.bounds;
    const cx = Math.round(r.x + r.w / 2);
    const cy = Math.round(r.y + r.h / 2);
    const clampP = (p: Point): Point => ({
      x: Math.max(4, Math.min(LOGICAL_W - 4, Math.round(p.x))),
      y: Math.max(4, Math.min(LOGICAL_H - 4, Math.round(p.y))),
    });
    // Just-outside candidates: below the bounds first (hotspots usually sit
    // on walls/furniture), then beside them, then level with the player.
    const candidates: Point[] = [
      { x: cx, y: r.y + r.h + 4 },
      { x: cx, y: r.y + r.h + 12 },
      { x: r.x - 6, y: Math.max(r.y + r.h + 2, player.feet.y) },
      { x: r.x + r.w + 6, y: Math.max(r.y + r.h + 2, player.feet.y) },
      { x: cx, y: player.feet.y },
    ];
    for (const c of candidates) {
      const p = clampP(c);
      if (!room.grid.isWalkablePoint(p.x, p.y)) continue;
      if (!findPath(room.grid, player.feet, p)) continue;
      const dir = dominantFacing(cx - p.x, cy - p.y);
      this.runScript([
        { type: 'walkPlayerTo', x: p.x, y: p.y },
        { type: 'facePlayer', dir },
      ]);
      return;
    }
    // Nothing adjacent is reachable: plain walk toward it (may stop short).
    const path = findPath(room.grid, player.feet, { x: cx, y: cy });
    if (path) {
      this.mover.speed = 55;
      this.mover.start(path);
    }
  }

  /**
   * P8 combine resolution: close the inventory, drop the held item, then
   * either run the recipe's script, the default consume-both-produce-result
   * script, or the in-voice refusal line.
   */
  private resolveCombine(a: string, b: string): void {
    this.invScreen.close();
    this.state.heldItem = null;
    const recipe = this.content.combines[combineKey(a, b)];
    const nameOf = (id: string): string => this.content.items[id]?.name ?? id.toUpperCase();
    if (!recipe) {
      this.runLine(cantCombineLine(nameOf(a), nameOf(b)));
    } else if (recipe.script) {
      this.runScript(recipe.script);
    } else if (recipe.result) {
      this.runScript([takeItem(a), takeItem(b), giveItem(recipe.result)]);
    }
  }

  private runScript(actions: readonly ScriptAction[]): void {
    void this.runner.run(actions).catch((err: unknown) => {
      if (!(err instanceof ScriptAbort)) console.error('[script] failed:', err);
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
    const isTop = this.game.isTop(this);

    if (room) {
      const shake = this.shakeOffset();
      ctx.save();
      ctx.translate(-Math.round(this.cameraX) + shake.x, shake.y);
      room.draw(ctx);
      // Dust plume motes (shake action / collapse beat)
      for (const p of this.dust) {
        const fade = p.age > p.ttl * 0.6 ? 1 - (p.age - p.ttl * 0.6) / (p.ttl * 0.4) : 1;
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.age % 400 < 200 ? 2 : 1, 1);
      }
      ctx.globalAlpha = 1;
      // P19 (bug 5): every art-less interactable gets a visible anchor - a
      // small pulsing glint at its hit bounds - so legacy hotspots are never
      // invisible surprises. Props with real art are their own affordance.
      if (this.transition.kind === 'none' && !this.dying) {
        const t = this.state.playtimeMs;
        for (const prop of room.props) {
          if (!prop.enabled || !prop.interactive || prop.hasArt) continue;
          const b = prop.bounds;
          if (b.w <= 0) continue;
          const gx = Math.round(b.x + b.w / 2);
          const gy = Math.round(b.y + b.h - 3);
          let seed = 0;
          for (let i = 0; i < prop.id.length; i++) seed += prop.id.charCodeAt(i);
          const pulse = 0.45 + 0.3 * Math.sin(t / 420 + seed);
          ctx.globalAlpha = Math.max(0.15, pulse);
          ctx.fillStyle = '#ffe9a8';
          ctx.fillRect(gx, gy - 2, 1, 5);
          ctx.fillRect(gx - 2, gy, 5, 1);
          ctx.globalAlpha = Math.max(0.1, pulse * 0.6);
          ctx.fillRect(gx - 1, gy - 1, 3, 3);
        }
        ctx.globalAlpha = 1;
      }
      this.debug.render(ctx, {
        grid: room.grid,
        path:
          this.player && this.mover.active
            ? [this.player.feet, ...this.mover.remaining()]
            : [],
        actors: room.actors,
        exits: room.def.exits,
        hotspots: room.props.map((p) => ({
          def: {
            id: p.id,
            name: p.name ?? p.id,
            rect: p.outline.rect ?? (p.outline.polygon ? undefined : p.bounds),
            polygon: p.outline.polygon,
            verbs: {},
          },
          enabled: p.enabled,
        })),
        fps: this.game.fps,
        mouse,
      });
      ctx.restore();

      // Hotspot reveal (discoverability fix): hold TAB/SPACE or pin with H.
      // Only active interactables show; suppressed whenever input is blocked
      // (cutscenes, dialogue, inventory, transitions, other scenes on top).
      if (this.revealVisible(isTop)) this.drawReveal(ctx);

      // P20: HUD chrome is DOM - keep it fed with live state.
      this.nav.setVisible(isTop);
      this.nav.setArea(this.room?.def.label ?? '');
      this.nav.setViews(this.state.views);
      // Cinematic letterbox bars
      if (this.letterboxT > 0) {
        const barH = Math.round(LETTERBOX_H * this.letterboxT);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, LOGICAL_W, barH);
        ctx.fillRect(0, LOGICAL_H - barH, LOGICAL_W, barH);
      }

      if (!this.narrator.active && !this.dialogue.active && isTop && this.radial.hidden) {
        if (this.hover) this.drawHoverLabel(ctx, this.hover.name ?? 'THAT');
        else if (this.hoverExit) this.drawHoverLabel(ctx, 'EXIT');
      }
      // Radial verb menu: above the reveal overlay and the hover chip.
      if (!this.radial.hidden && this.cursors && isTop) {
        this.radial.render(ctx, this.cursors);
      }
    }

    // Fade overlay: the stronger of the room transition and the script fade
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
    alpha = Math.max(alpha, this.scriptFadeAlpha);
    if (alpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    // Pre-combat flash: mob = one hard white pop; boss = heavier strobes
    // trending red. Renders over everything (the combat scene wipes in next).
    if (this.combatFlash) {
      const f = this.combatFlash;
      const k = f.t / f.ms;
      const pulses = f.boss ? 3 : 2;
      const wave = Math.abs(Math.sin(k * Math.PI * pulses));
      const strength = wave * (f.boss ? 0.85 : 0.7) * (1 - k * 0.25);
      ctx.fillStyle = f.boss
        ? `rgba(255,${Math.round(200 - 140 * k)},${Math.round(190 - 160 * k)},${strength})`
        : `rgba(255,255,255,${strength})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }

    // Cursor, topmost — only while this scene has input focus.
    if (
      isTop &&
      this.cursors &&
      mouse.x >= 0 &&
      mouse.x < LOGICAL_W &&
      mouse.y >= 0 &&
      mouse.y < LOGICAL_H
    ) {
      const held = this.state.heldItem;
      const heldIcon = held ? this.itemIcons.get(held) : undefined;
      const img = heldIcon ?? this.magnifier ?? this.cursors.look;
      const half = Math.floor(img.width / 2);
      // Over an interactable, frame the cursor with pixel corner brackets so
      // the hit reads instantly, before the name label registers. (Skipped
      // while the radial is up - the wheel already marks the target.)
      if (
        (this.hover || this.hoverExit) &&
        !this.narrator.active &&
        !this.dialogue.active &&
        this.radial.hidden
      ) {
        const s = half + 3;
        ctx.strokeStyle = this.hover ? '#3fd9ff' : '#ffd166';
        ctx.lineWidth = 1;
        const corners: Array<[number, number, number, number]> = [
          [-s, -s, 4, 0], [-s, -s, 0, 4],
          [s, -s, -4, 0], [s, -s, 0, 4],
          [-s, s, 4, 0], [-s, s, 0, -4],
          [s, s, -4, 0], [s, s, 0, -4],
        ];
        ctx.beginPath();
        for (const [dx, dy, lx, ly] of corners) {
          ctx.moveTo(mouse.x + dx + 0.5, mouse.y + dy + 0.5);
          ctx.lineTo(mouse.x + dx + lx + 0.5, mouse.y + dy + ly + 0.5);
        }
        ctx.stroke();
      }
      ctx.drawImage(img, mouse.x - half, mouse.y - half);
    }
  }

  private drawHoverLabel(ctx: CanvasRenderingContext2D, name: string): void {
    const mouse = this.game.input.mouse;
    const w = pixelTextWidth(name);
    let x = mouse.x + 8;
    let y = mouse.y + 12;
    if (x + w + 6 > LOGICAL_W - 2) x = LOGICAL_W - 2 - w - 6;
    if (y + 11 > LOGICAL_H - 2) y = mouse.y - 16;
    ctx.fillStyle = 'rgba(4,10,18,0.9)';
    ctx.fillRect(x - 3, y - 3, w + 6, 11);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2.5, y - 2.5, w + 5, 10);
    drawPixelText(ctx, name, x, y, '#ffe9a8');
  }

  /** The reveal shows only while the player actually has world input. */
  private revealVisible(isTop: boolean): boolean {
    const input = this.game.input;
    const wanted = this.revealPinned || input.isDown('Tab') || input.isDown('Space');
    return (
      wanted &&
      isTop &&
      this.transition.kind === 'none' &&
      !this.runner.running &&
      !this.narrator.active &&
      !this.dialogue.active &&
      !this.invScreen.open &&
      !this.dying
    );
  }

  /** Pixel-style outlines + name chips over every ACTIVE hotspot and exit. */
  private drawReveal(ctx: CanvasRenderingContext2D): void {
    const room = this.room;
    if (!room) return;
    // 500ms two-phase blink keeps the overlay alive without heavy glow.
    const bright = Math.floor(this.state.playtimeMs / 500) % 2 === 0;

    const chip = (text: string, cx: number, topY: number, color: string): void => {
      const w = pixelTextWidth(text);
      let x = Math.round(cx - w / 2);
      x = Math.max(2, Math.min(x, LOGICAL_W - w - 2));
      let y = topY - 10;
      if (y < 14) y = topY + 2; // keep chips clear of the DOM nav band
      ctx.fillStyle = 'rgba(4,10,18,0.85)';
      ctx.fillRect(x - 2, y - 1, w + 4, 9);
      drawPixelText(ctx, text, x, y, color);
    };

    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);
    ctx.lineWidth = 1;

    // The radial shows its own name chip; skip the reveal chip for that
    // prop so the two overlays don't stack the same label.
    const radialPropId =
      !this.radial.hidden && this.radialTarget?.kind === 'prop'
        ? this.radialTarget.def.id
        : null;

    // Every ACTIVE interactive prop (incl. converted legacy hotspots),
    // outlined by its hit shape. Decorations never highlight.
    for (const prop of room.props) {
      if (!prop.enabled || !prop.interactive) continue;
      const color = bright ? '#3fd9ff' : '#2a93b3';
      if (prop.id === radialPropId) {
        continue; // outline + chip both yield to the radial cluster
      }
      const name = prop.name ?? prop.id;
      const shape = prop.outline;
      if (shape.polygon && shape.polygon.length >= 3) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        shape.polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 0.5, p.y + 0.5) : ctx.lineTo(p.x + 0.5, p.y + 0.5)));
        ctx.closePath();
        ctx.stroke();
        const xs = shape.polygon.map((p) => p.x);
        const ys = shape.polygon.map((p) => p.y);
        chip(name, (Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys), '#bdeeff');
      } else if (shape.rect) {
        const r = shape.rect;
        ctx.strokeStyle = color;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        chip(name, r.x + r.w / 2, r.y, '#bdeeff');
      }
    }

    for (const exit of room.def.exits) {
      if (!this.state.isExitEnabled(room.def.id, exit)) continue;
      const r = exit.rect;
      ctx.strokeStyle = bright ? '#ffd166' : '#b3922f';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      // Direction arrow toward the screen edge, so exits read as doors.
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const label = cx < 60 ? '< EXIT' : cx > 260 ? 'EXIT >' : 'EXIT';
      chip(label, cx, Math.max(cy - 6, r.y), '#ffe9a8');
    }

    ctx.restore();
  }
}
