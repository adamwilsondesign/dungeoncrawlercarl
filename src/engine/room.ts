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
  HotspotDef,
  ItemDef,
  Point,
  RoomDef,
  SkillDef,
  SpawnPoint,
  SpriteSheetDef,
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
import type { Game, Scene } from './game';
import { hotspotAt } from './hotspot';
import { IconBar } from './iconbar';
import { InventoryScreen } from './inventory';
import { AchievementsScene, ListMenuScene } from './menus';
import { NarratorBox, wrapText } from './narrator';
import { dominantFacing, findPath, Mover, PLAYER_WALK_SPEED, WalkGrid } from './pathfinding';
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
import { ScriptAbort, ScriptRunner, type ScriptHost } from './script';
import type { GameState } from './state';
import { ToastManager } from './toasts';
import {
  cantCombineLine,
  emptyClickLine,
  itemOnNothingLine,
  loadCursors,
  nextVerb,
  noItemLine,
  unhandledLine,
  wrongItemLine,
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
  /** Full background width; wider than 320 enables cameraPan. */
  readonly width: number;

  private readonly background: LoadedImage;
  private readonly bands: RoomDef['scaleBands'];

  private constructor(def: RoomDef, background: LoadedImage, grid: WalkGrid, actors: Actor[]) {
    this.def = def;
    this.background = background;
    this.grid = grid;
    this.actors.push(...actors);
    this.bands = [...def.scaleBands].sort((a, b) => a.yTop - b.yTop);
    this.width = Math.max(LOGICAL_W, def.backgroundWidth ?? LOGICAL_W);
  }

  /** Load background, walkmask and actor sheets (placeholders where missing). */
  static async load(def: RoomDef): Promise<Room> {
    const background = await loadImage(def.backgroundPath, {
      kind: 'background',
      label: def.label,
      mood: def.backgroundMood,
      draw: def.placeholderArtDraw,
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

    return new Room(def, background, grid, actors);
  }

  addActor(actor: Actor): void {
    this.actors.push(actor);
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

  /** Background, then actors sorted by feet y (painter's order). */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.background, 0, 0, this.width, LOGICAL_H);
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
}

/** Callbacks up into the app shell (main.ts owns the title screen). */
export interface GameFlow {
  quitToTitle: () => void;
}

const FADE_MS = 250;
const LETTERBOX_H = 20;
const LETTERBOX_MS = 250;

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
  private readonly iconBar = new IconBar();
  private readonly narrator = new NarratorBox();
  private readonly dialogue = new DialogueBox();
  private readonly dialoguePlayer: DialoguePlayer;
  private readonly invScreen = new InventoryScreen();
  private readonly toasts = new ToastManager();
  private readonly runner = new ScriptRunner(this);
  private keyWalking = false;
  /** Hotspot-reveal pin (H toggles; persisted as a UI pref, not save data). */
  private revealPinned = localStorage.getItem('dcc_reveal_pin') === '1';
  private hoverExit: ExitDef | null = null;
  private transition: Transition = { kind: 'loading' };

  private activeVerb: Verb = 'walk';
  private cursors: Record<Verb, LoadedImage> | null = null;
  private readonly itemIcons = new Map<string, LoadedImage>();
  private hover: HotspotDef | null = null;
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

  private dying = false;
  private pendingRoomEnter = false;

  constructor(
    private readonly game: Game,
    private readonly content: GameContent,
    readonly state: GameState,
    private readonly flow: GameFlow,
  ) {
    state.autosaveHook = () => this.autosaveNow();
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
    this.transition = { kind: 'fade-in', t: 0 };
  }

  private async ensureUiLoaded(): Promise<void> {
    if (this.cursors) return;
    const [cursors] = await Promise.all([loadCursors(), this.iconBar.load(), this.loadItemIcons()]);
    this.cursors = cursors;
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

    const room = await Room.load(def);
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

  narrate(text: string, speakerId?: string): Promise<void> {
    if (this.runner.skipping) return Promise.resolve();
    const speaker =
      speakerId === undefined
        ? undefined
        : this.room?.findActor(speakerId)?.label ?? speakerId.toUpperCase();
    return this.narrator.show(text, speaker);
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

  awardAchievement(id: string): void {
    const key = `ach:${id}`;
    if (this.state.getFlag(key)) return; // idempotent
    this.state.setFlag(key, true);
    const def = this.content.achievements[id];
    if (!def) console.warn(`[achievements] unknown achievement "${id}"`);
    this.toasts.push('ACHIEVEMENT UNLOCKED', def?.name ?? id.toUpperCase());
  }

  killPlayer(reason: string): void {
    if (this.dying) return;
    this.dying = true;
    this.mover.stop();
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

  /** Equip an equipment item: straight to Carl solo, else pick the member. */
  private startEquipFlow(itemId: string): void {
    const def = this.content.items[itemId];
    const equip = def?.equip;
    if (!equip) return;
    const party = this.state.party;
    if (party.length <= 1) {
      this.equipTo(party[0] ?? 'carl', itemId);
      return;
    }
    this.game.pushScene(
      new ListMenuScene(this.game, {
        title: `EQUIP ${def.name}`,
        items: party.map((id) => ({
          label: this.content.combatants[id]?.name ?? id.toUpperCase(),
        })),
        footer: 'ESC: BACK',
        onPick: (i) => {
          this.game.popScene();
          this.equipTo(party[i], itemId);
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

  private equipSummaryLines(): string[] {
    return this.state.party.map((memberId) => {
      const who = this.content.combatants[memberId]?.name ?? memberId.toUpperCase();
      const slots = this.state.getEquipped(memberId);
      const nameOf = (id?: string): string =>
        id ? this.content.items[id]?.name ?? id.toUpperCase() : '-';
      return `${who}: W:${nameOf(slots.weapon)} A:${nameOf(slots.armor)} T:${nameOf(slots.trinket)}`;
    });
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
  }

  private updateLive(dtMs: number): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;
    const input = this.game.input;

    const barMouse = this.invScreen.open ? { x: -1, y: -1 } : input.mouse;
    this.iconBar.update(dtMs, barMouse);
    this.narrator.update(dtMs);
    this.dialogue.update(dtMs);
    this.toasts.update(dtMs);
    this.tickTimers(dtMs);
    this.state.playerFacing = player.facing;
    this.state.playerX = player.x;
    this.state.playerY = player.y;

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

    // Inventory screen: world paused; LOOK examines, other verbs select.
    if (this.invScreen.open) {
      while (input.consumeRightClick()) this.activeVerb = nextVerb(this.activeVerb);
      if (input.consumePress('Escape')) this.invScreen.close();
      const click = input.consumeClick();
      if (click) {
        const action = this.invScreen.actionAt(
          click,
          this.activeVerb,
          this.state.inventory,
          this.content.items,
          this.state.heldItem,
        );
        if (action?.kind === 'close') this.invScreen.close();
        else if (action?.kind === 'select') {
          this.state.heldItem = action.id;
          this.activeVerb = 'item';
          this.invScreen.close();
        } else if (action?.kind === 'unhold') {
          this.state.heldItem = null;
          this.activeVerb = 'walk';
        } else if (action?.kind === 'combine') {
          this.resolveCombine(action.a, action.b);
        } else if (action?.kind === 'equip') {
          this.startEquipFlow(action.id);
        } else if (action?.kind === 'look') {
          const def = this.content.items[action.id];
          this.runLine(def?.description ?? `It's ${action.id}. The dungeon shrugs.`);
        }
      }
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

    // Free play: each queued right-click advances one verb.
    while (input.consumeRightClick()) this.activeVerb = nextVerb(this.activeVerb);

    // Hotspot-reveal pin toggle (discoverability fix); persists across reloads.
    if (input.consumePress('KeyH')) {
      this.revealPinned = !this.revealPinned;
      localStorage.setItem('dcc_reveal_pin', this.revealPinned ? '1' : '0');
      this.toasts.push('HOTSPOT REVEAL', this.revealPinned ? 'PINNED ON (H)' : 'OFF (HOLD TAB)', '#3fd9ff');
    }

    // One-time, in-voice pointer at the reveal key (once ever, not per save).
    if (!localStorage.getItem('dcc_hint_reveal') && (this.room?.def.hotspots.length ?? 0) > 0) {
      localStorage.setItem('dcc_hint_reveal', '1');
      this.runLine(
        'A TIP FROM THE BOOTH, CRAWLER: hold TAB to see everything in a room worth touching. Press H to keep it lit. The dungeon hides nothing. It merely declines to point.',
      );
      return;
    }

    const worldMouse = this.toWorld(input.mouse);
    this.hover = this.iconBar.coversPoint(input.mouse) ? null : this.hotspotUnderPoint(worldMouse);
    const exitUnderMouse = room.exitAt(worldMouse);
    this.hoverExit =
      !this.hover && exitUnderMouse && this.state.isExitEnabled(room.def.id, exitUnderMouse)
        ? exitUnderMouse
        : null;

    const click = input.consumeClick();
    if (click) {
      if (this.iconBar.coversPoint(click)) this.handleBarClick(click);
      else this.handleWorldClick(this.toWorld(click));
    }

    // P10: continuous keyboard walking (arrows + WASD). Shares the walkmask
    // and speed with click-to-walk; gated by the same blocks above (scripts,
    // inventory, transitions). A key move cancels any active click path.
    const kx =
      (input.isDown('ArrowRight') || input.isDown('KeyD') ? 1 : 0) -
      (input.isDown('ArrowLeft') || input.isDown('KeyA') ? 1 : 0);
    const ky =
      (input.isDown('ArrowDown') || input.isDown('KeyS') ? 1 : 0) -
      (input.isDown('ArrowUp') || input.isDown('KeyW') ? 1 : 0);
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

    const exit = room.exitAt(player.feet);
    if (exit && this.state.isExitEnabled(room.def.id, exit)) {
      this.mover.stop();
      player.play('idle');
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
    else if (action.kind === 'inventory') this.invScreen.show();
    else this.openSettingsMenu();
  }

  private handleWorldClick(click: Point): void {
    const room = this.room;
    const player = this.player;
    if (!room || !player) return;

    switch (this.activeVerb) {
      case 'walk': {
        const path = findPath(room.grid, player.feet, click);
        if (path) {
          this.mover.speed = 55;
          this.mover.start(path);
        }
        break;
      }
      case 'item':
        this.handleItemClick(click);
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

  private handleItemClick(click: Point): void {
    const held = this.state.heldItem;
    if (!held) {
      this.runLine(noItemLine());
      return;
    }
    const heldName = this.content.items[held]?.name ?? held.toUpperCase();
    const hotspot = this.hotspotUnderPoint(click);
    if (!hotspot) {
      this.runLine(itemOnNothingLine(heldName));
      return;
    }
    const handler = hotspot.verbs.item;
    if (!handler) {
      this.runLine(wrongItemLine(heldName, hotspot.name));
      return;
    }
    if (Array.isArray(handler)) {
      this.runScript(handler);
      return;
    }
    const actions = handler[held] ?? handler['default'];
    if (actions) this.runScript(actions);
    else this.runLine(wrongItemLine(heldName, hotspot.name));
  }

  /**
   * P8 combine resolution: close the inventory, drop the held item, then
   * either run the recipe's script, the default consume-both-produce-result
   * script, or the in-voice refusal line.
   */
  private resolveCombine(a: string, b: string): void {
    this.invScreen.close();
    this.state.heldItem = null;
    this.activeVerb = 'walk';
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
      ctx.save();
      ctx.translate(-Math.round(this.cameraX), 0);
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
      ctx.restore();

      // Hotspot reveal (discoverability fix): hold TAB/SPACE or pin with H.
      // Only active interactables show; suppressed whenever input is blocked
      // (cutscenes, dialogue, inventory, transitions, other scenes on top).
      if (this.revealVisible(isTop)) this.drawReveal(ctx);

      this.iconBar.render(ctx, this.activeVerb);
      this.invScreen.render(
        ctx,
        this.state.inventory,
        this.content.items,
        this.itemIcons,
        this.state.heldItem,
        this.invScreen.open ? this.equipSummaryLines() : [],
        this.state.gold,
      );

      // Cinematic letterbox bars
      if (this.letterboxT > 0) {
        const barH = Math.round(LETTERBOX_H * this.letterboxT);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, LOGICAL_W, barH);
        ctx.fillRect(0, LOGICAL_H - barH, LOGICAL_W, barH);
      }

      this.narrator.render(ctx);
      this.dialogue.render(ctx);
      // Compact room-name chip, tucked under the pinned icon bar (P10 fix:
      // replaces the old full-width title baked into the background art).
      const roomName = this.room?.def.label;
      if (roomName) {
        const w = pixelTextWidth(roomName) + 6;
        ctx.fillStyle = 'rgba(10,17,32,0.7)';
        ctx.fillRect(2, IconBar.HEIGHT + 2, w, 9);
        drawPixelText(ctx, roomName, 5, IconBar.HEIGHT + 4, '#8fa3c4');
      }
      // Diegetic score: broadcast viewer count, once the show has premiered.
      if (this.state.views > 0) {
        const label = `LIVE ${this.state.views}`;
        const w = pixelTextWidth(label) + 9;
        const y = IconBar.HEIGHT + 2;
        ctx.fillStyle = 'rgba(10,17,32,0.85)';
        ctx.fillRect(LOGICAL_W - w - 2, y, w, 9);
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(LOGICAL_W - w + 1, y + 3, 3, 3);
        drawPixelText(ctx, label, LOGICAL_W - w + 6, y + 2, '#ffd9d9');
      }
      this.toasts.render(ctx);
      if (!this.narrator.active && !this.dialogue.active && isTop) {
        if (this.hover) this.drawHoverLabel(ctx, this.hover.name);
        else if (this.hoverExit) this.drawHoverLabel(ctx, 'EXIT');
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
      const heldIcon =
        this.activeVerb === 'item' && held ? this.itemIcons.get(held) : undefined;
      const img = heldIcon ?? this.cursors[this.activeVerb];
      const half = Math.floor(img.width / 2);
      // Over an interactable, frame the cursor with pixel corner brackets so
      // the hit reads instantly, before the name label registers.
      if ((this.hover || this.hoverExit) && !this.narrator.active && !this.dialogue.active) {
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
      if (y < IconBar.HEIGHT + 2) y = topY + 2;
      ctx.fillStyle = 'rgba(4,10,18,0.85)';
      ctx.fillRect(x - 2, y - 1, w + 4, 9);
      drawPixelText(ctx, text, x, y, color);
    };

    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);
    ctx.lineWidth = 1;

    for (const def of room.def.hotspots) {
      if (!this.state.isHotspotEnabled(room.def.id, def)) continue;
      const color = bright ? '#3fd9ff' : '#2a93b3';
      if (def.polygon && def.polygon.length >= 3) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        def.polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 0.5, p.y + 0.5) : ctx.lineTo(p.x + 0.5, p.y + 0.5)));
        ctx.closePath();
        ctx.stroke();
        const xs = def.polygon.map((p) => p.x);
        const ys = def.polygon.map((p) => p.y);
        chip(def.name, (Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...ys), '#bdeeff');
      } else if (def.rect) {
        const r = def.rect;
        ctx.strokeStyle = color;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        chip(def.name, r.x + r.w / 2, r.y, '#bdeeff');
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
