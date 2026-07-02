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

/**
 * A flag test used by dialogue choices (and reusable elsewhere).
 * Without `equals`: truthiness of the flag. With `equals`: strict equality.
 * `not` inverts the result.
 */
export interface FlagCondition {
  flag: string;
  equals?: FlagValue;
  not?: boolean;
}

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
 * ITEM handlers keyed by held item id. The reserved key 'default' runs when
 * no specific entry matches; with no default, an in-voice "doesn't work"
 * line plays.
 */
export type ItemUseHandlers = Record<string, ScriptAction[]>;

export interface HotspotVerbs {
  look?: ScriptAction[];
  hand?: ScriptAction[];
  talk?: ScriptAction[];
  /** Plain array = any held item; map = per-item scripts ('default' reserved). */
  item?: ScriptAction[] | ItemUseHandlers;
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
  verbs: HotspotVerbs;
}

// ---------------------------------------------------------------------------
// Characters, portraits, dialogue
// ---------------------------------------------------------------------------

/** Portrait art set for a character. Files: ui/portrait_<characterId>_<expression>.png */
export interface PortraitDef {
  characterId: string;
  /** Must include 'neutral'; unknown expressions fall back to it. */
  expressions: string[];
}

export interface CharacterDef {
  id: string;
  /** Name-plate text on dialogue boxes. */
  name: string;
  /** Placeholder portrait/tag color. */
  color: string;
  portrait: PortraitDef;
  /** Which side of the dialogue box the portrait sits on. Default 'left'. */
  portraitSide?: 'left' | 'right';
}

export interface DialogueLine {
  speakerId: string;
  text: string;
  /** Portrait expression; defaults to 'neutral'. */
  expression?: string;
}

export interface DialogueChoice {
  /** The player's line/option text. */
  text: string;
  goto: string; // node id or 'end'
  /** Hide the option unless the condition passes. */
  showIf?: FlagCondition;
  /** Hide after being chosen once (tracked via flag dlg:<tree>:<node>:choice<i>). */
  once?: boolean;
}

export interface DialogueNode {
  /** Played in order before choices (or before goto). */
  lines: DialogueLine[];
  /** If present (and any are visible), a choice menu shows after the lines. */
  choices?: DialogueChoice[];
  /** Side effects run through the script runner when the node is entered. */
  onEnter?: ScriptAction[];
  /** Auto-advance target when there are no (visible) choices. Default 'end'. */
  goto?: string;
}

export interface DialogueTree {
  id: string;
  entry: string;
  nodes: Record<string, DialogueNode>;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ItemDef {
  id: string;
  name: string;
  /** In-voice LOOK text shown from the inventory screen. */
  description: string;
  /** Stackable items merge into one slot with a count. */
  stackable?: boolean;
  /** Present = this item is equipment (EQUIP action in the inventory). */
  equip?: EquipDef;
  /** Present = usable in combat via the ITEM action (consumed on use). */
  use?: CombatUseDef;
}

export interface InventoryEntry {
  id: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export type CoreStat = 'str' | 'dex' | 'con' | 'int' | 'spd';

export interface CombatantStats {
  maxHp: number;
  hp: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  spd: number;
  maxMp?: number;
  mp?: number;
}

export type StatusKind = 'buff' | 'debuff' | 'dot' | 'stun' | 'fear' | 'bleed' | 'burn';

/**
 * A status instance template. DOT kinds (burn/bleed/dot) deal `magnitude`
 * damage at the afflicted's turn start; buff/debuff modify the composite
 * `stat` ('attack' adds to outgoing damage base, 'defense' to damage
 * reduction) by ±magnitude; stun skips the turn; fear gives a 50% chance to
 * cower. Durations decrement at the afflicted's turn end.
 */
export interface StatusEffect {
  id: string;
  name: string;
  kind: StatusKind;
  duration: number;
  magnitude: number;
  stat?: 'attack' | 'defense';
}

export type SkillTarget = 'enemy' | 'allEnemies' | 'ally' | 'self' | 'allAllies';

/**
 * Skills always hit. Damage = (power + scaling stat) ± 10% − defense.
 * Ally/self/allAllies targets with power HEAL for power + int/2 instead.
 */
export interface SkillDef {
  id: string;
  name: string;
  mpCost?: number;
  /** Turns between uses (per combatant). */
  cooldown?: number;
  target: SkillTarget;
  power?: number;
  /** Damage scaling stat; default 'int'. */
  scaling?: 'str' | 'int';
  effect?: StatusEffect;
  description: string;
}

export type EquipSlot = 'weapon' | 'armor' | 'trinket';

/** Equipment data nested on an ItemDef (the item id is the equip id). */
export interface EquipDef {
  slot: EquipSlot;
  /** Weapon: added to ATTACK damage base. */
  attack?: number;
  /** Armor: added to damage reduction. */
  defense?: number;
  statMods?: Partial<Record<CoreStat | 'maxHp' | 'maxMp', number>>;
}

/** Consumable combat use (item is consumed from the shared inventory). */
export interface CombatUseDef {
  target: SkillTarget;
  power?: number;
  heal?: boolean;
  effect?: StatusEffect;
}

/** One registry for party members and enemies alike. */
export interface CombatantDef {
  id: string;
  name: string;
  color: string;
  /** Sprite sheet path (standard 24x32, 3x3 placeholder layout). */
  sprite: string;
  /** Base stats at level 1 (party) or fixed (enemies). */
  stats: CombatantStats;
  skills: string[];
  /** Party members: level -> skill ids unlocked on reaching it. */
  learnset?: Record<number, string[]>;
  /** Enemies: XP granted when defeated. */
  xpReward?: number;
  /** Enemy AI: 'basic' attacks (50% skill), 'caster' prefers skills, 'boss' cycles skills then attacks. */
  ai?: 'basic' | 'caster' | 'boss';
}

/**
 * Boss-phase table entry. Phases are evaluated top-down each turn; the first
 * entry whose `when` passes (no `when` = always) is active. `announce` shows
 * once whenever the active phase changes.
 */
export interface EncounterPhaseDef {
  when?: FlagCondition;
  /** Multiplier on all damage ENEMIES take while this phase is active. */
  enemyDamageTakenMult?: number;
  announce?: string;
}

/** Minimal flag access handed to encounter hooks (structurally = GameState). */
export interface CombatFlagAccess {
  getFlag(key: string): FlagValue | undefined;
  setFlag(key: string, value: FlagValue): void;
}

export interface CombatTurnCtx {
  state: CombatFlagAccess;
  round: number;
  /** Index within the current round's turn order. */
  turnIndex: number;
}

export interface EncounterDef {
  id: string;
  /** Combatant def ids; duplicates allowed (labeled A/B/C...). */
  enemies: string[];
  /** Party member ids for this fight; default GameState.party. Max 4. */
  partyOverride?: string[];
  /** Combat backdrop path (backgrounds/ filename convention). */
  backdrop: string;
  backdropLabel?: string;
  backdropMood?: Mood;
  noFlee?: boolean;
  introText?: string;
  victoryScript?: ScriptAction[];
  /** Default when absent: killPlayer with an in-voice defeat reason. */
  defeatScript?: ScriptAction[];
  rewards?: { xp?: number; gold?: number; items?: string[] };
  phases?: EncounterPhaseDef[];
  /** Runs at each turn start; may set flags; returned text becomes a log line. */
  beforeTurn?: (ctx: CombatTurnCtx) => string | void;
}

// ---------------------------------------------------------------------------
// Cutscenes & achievements
// ---------------------------------------------------------------------------

/**
 * A registered, skippable scripted scene. Played via playCutscene(id), which
 * is a no-op once the flag scene:<id>:played is set unless `repeatable`.
 */
export interface CutsceneDef {
  id: string;
  actions: ScriptAction[];
  repeatable?: boolean;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Hidden achievements show as ??? in the panel until earned. */
  hidden?: boolean;
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
  /**
   * Rooms authored wider than 320 can be panned with cameraPan; walkmasks
   * and pathfinding remain 320x200, so wide rooms are cinematic-only for
   * now. Default 320.
   */
  backgroundWidth?: number;
  walkmaskPath: string;
  playerSpawn: SpawnPoint;
  exits: ExitDef[];
  actors: ActorDef[];
  hotspots: HotspotDef[];
  scaleBands: ScaleBand[];
  /**
   * Runs through the script runner every time the room is entered (after
   * the fade-in). Use playCutscene(id) inside it for once-only intros —
   * playCutscene itself is guarded by the scene:<id>:played flag.
   */
  onEnter?: ScriptAction[];
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
  | { kind: 'icon'; glyph: UiGlyph; label: string; w: number; h: number }
  | { kind: 'portrait'; label: string; color: string; expression: string }
  | { kind: 'item'; label: string };
