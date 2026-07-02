/**
 * Async asset loader with rich placeholder generation.
 *
 * Asset paths are relative to /src/assets, e.g. 'backgrounds/r00_test.png' or
 * 'sprites/carl.png'. Files that exist are discovered at build time via
 * import.meta.glob, so dropping real art into /src/assets later requires zero
 * code changes. Missing files produce legible, spec-driven placeholders.
 */

import type { Mood, PlaceholderSpec, UiGlyph } from '../data/types';

export type LoadedImage = HTMLImageElement | HTMLCanvasElement;

/** Build-time manifest of every real asset file under /src/assets. */
const manifest = import.meta.glob<string>('../assets/**/*.{png,jpg,jpeg,gif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function assetUrl(path: string): string | undefined {
  return manifest[`../assets/${path}`];
}

/** True when a real file exists for this asset path. */
export function hasAsset(path: string): boolean {
  return assetUrl(path) !== undefined;
}

const loggedPlaceholders = new Set<string>();

/** Console-log a placeholder substitution once per path. */
export function logPlaceholder(path: string, detail: string): void {
  if (loggedPlaceholders.has(path)) return;
  loggedPlaceholders.add(path);
  console.info(`[assets] "${path}" not found — generated placeholder (${detail})`);
}

const cache = new Map<string, Promise<LoadedImage>>();

/**
 * Load an image asset. If the file is missing (or fails to load) a legible
 * placeholder is generated instead — the game must run with zero asset files.
 */
export function loadImage(path: string, spec?: PlaceholderSpec): Promise<LoadedImage> {
  const cached = cache.get(path);
  if (cached) return cached;

  const url = assetUrl(path);
  const promise: Promise<LoadedImage> = url
    ? new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(makePlaceholder(path, spec));
        img.src = url;
      })
    : Promise.resolve(makePlaceholder(path, spec));

  cache.set(path, promise);
  return promise;
}

function makePlaceholder(path: string, spec?: PlaceholderSpec): HTMLCanvasElement {
  if (spec?.kind === 'background') {
    logPlaceholder(path, `background "${spec.label}", mood ${spec.mood}`);
    return makeBackgroundPlaceholder(spec);
  }
  if (spec?.kind === 'actor') {
    logPlaceholder(path, `actor sheet "${spec.label}", ${spec.frameW}x${spec.frameH} frames`);
    return makeActorPlaceholder(spec);
  }
  if (spec?.kind === 'cursor') {
    logPlaceholder(path, `cursor glyph "${spec.glyph}"`);
    return makeCursorPlaceholder(spec);
  }
  if (spec?.kind === 'icon') {
    logPlaceholder(path, `icon "${spec.label}" (${spec.glyph})`);
    return makeIconPlaceholder(spec);
  }
  if (spec?.kind === 'portrait') {
    logPlaceholder(path, `portrait "${spec.label}" (${spec.expression})`);
    return makePortraitPlaceholder(spec);
  }
  if (spec?.kind === 'item') {
    logPlaceholder(path, `item icon "${spec.label}"`);
    return makeItemPlaceholder(spec);
  }
  logPlaceholder(path, 'generic fallback');
  return makeGenericPlaceholder(path);
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Lighten (factor > 1) or darken (factor < 1) a hex color. */
function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

// ---------------------------------------------------------------------------
// Tiny 3x5 pixel font — keeps placeholder text crisp at 320x200
// ---------------------------------------------------------------------------

const FONT: Record<string, number[]> = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b001, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  A: [0b010, 0b101, 0b111, 0b101, 0b101],
  B: [0b110, 0b101, 0b110, 0b101, 0b110],
  C: [0b011, 0b100, 0b100, 0b100, 0b011],
  D: [0b110, 0b101, 0b101, 0b101, 0b110],
  E: [0b111, 0b100, 0b110, 0b100, 0b111],
  F: [0b111, 0b100, 0b110, 0b100, 0b100],
  G: [0b011, 0b100, 0b101, 0b101, 0b011],
  H: [0b101, 0b101, 0b111, 0b101, 0b101],
  I: [0b111, 0b010, 0b010, 0b010, 0b111],
  J: [0b001, 0b001, 0b001, 0b101, 0b010],
  K: [0b101, 0b101, 0b110, 0b101, 0b101],
  L: [0b100, 0b100, 0b100, 0b100, 0b111],
  M: [0b101, 0b111, 0b111, 0b101, 0b101],
  N: [0b111, 0b101, 0b101, 0b101, 0b101],
  O: [0b111, 0b101, 0b101, 0b101, 0b111],
  P: [0b111, 0b101, 0b111, 0b100, 0b100],
  Q: [0b111, 0b101, 0b101, 0b111, 0b001],
  R: [0b110, 0b101, 0b110, 0b101, 0b101],
  S: [0b011, 0b100, 0b010, 0b001, 0b110],
  T: [0b111, 0b010, 0b010, 0b010, 0b010],
  U: [0b101, 0b101, 0b101, 0b101, 0b111],
  V: [0b101, 0b101, 0b101, 0b101, 0b010],
  W: [0b101, 0b101, 0b111, 0b111, 0b101],
  X: [0b101, 0b101, 0b010, 0b101, 0b101],
  Y: [0b101, 0b101, 0b010, 0b010, 0b010],
  Z: [0b111, 0b001, 0b010, 0b100, 0b111],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '.': [0b000, 0b000, 0b000, 0b000, 0b010],
  ',': [0b000, 0b000, 0b000, 0b010, 0b100],
  ':': [0b000, 0b010, 0b000, 0b010, 0b000],
  '/': [0b001, 0b001, 0b010, 0b100, 0b100],
  '_': [0b000, 0b000, 0b000, 0b000, 0b111],
  '?': [0b111, 0b001, 0b011, 0b000, 0b010],
  '!': [0b010, 0b010, 0b010, 0b000, 0b010],
  '>': [0b100, 0b010, 0b001, 0b010, 0b100],
  '<': [0b001, 0b010, 0b100, 0b010, 0b001],
  '+': [0b000, 0b010, 0b111, 0b010, 0b000],
};

export function pixelTextWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * 4 - 1) * scale;
}

/** Draw crisp bitmap text (uppercase 3x5 glyphs, 1px letter spacing). */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
  align: 'left' | 'center' = 'left',
): void {
  const startX = align === 'center' ? Math.round(x - pixelTextWidth(text, scale) / 2) : x;
  ctx.fillStyle = color;
  let cx = startX;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 3; col++) {
          if ((bits >> (2 - col)) & 1) {
            ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
          }
        }
      }
    }
    cx += 4 * scale;
  }
}

// ---------------------------------------------------------------------------
// Background placeholder
// ---------------------------------------------------------------------------

interface MoodPalette {
  wall: string;
  floor: string;
  accent: string;
  text: string;
}

const MOOD_PALETTES: Record<Mood, MoodPalette> = {
  cold: { wall: '#243a52', floor: '#33506e', accent: '#7fd4ff', text: '#d5ecff' },
  dungeon: { wall: '#332c3e', floor: '#4d4258', accent: '#c9a0ff', text: '#eadfff' },
  safe: { wall: '#2c3d2a', floor: '#41573a', accent: '#a8e6a0', text: '#e4f5dc' },
  workshop: { wall: '#3d2f24', floor: '#59452f', accent: '#ffc06e', text: '#ffe9c9' },
  boss: { wall: '#3d1f24', floor: '#5c3038', accent: '#ff6e6e', text: '#ffdada' },
};

const BG_W = 320;
const BG_H = 200;
const BG_HORIZON = 110;

function makeBackgroundPlaceholder(spec: { label: string; mood: Mood }): HTMLCanvasElement {
  const pal = MOOD_PALETTES[spec.mood] ?? MOOD_PALETTES.dungeon;
  const [canvas, ctx] = makeCanvas(BG_W, BG_H);

  // Wall / floor split
  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, BG_W, BG_HORIZON);
  ctx.fillStyle = pal.floor;
  ctx.fillRect(0, BG_HORIZON, BG_W, BG_H - BG_HORIZON);

  // Subtle wall panels
  ctx.fillStyle = shade(pal.wall, 1.18);
  for (let x = 40; x < BG_W; x += 56) {
    ctx.fillRect(x, 24, 2, BG_HORIZON - 24);
  }
  ctx.fillStyle = shade(pal.wall, 0.8);
  ctx.fillRect(0, BG_HORIZON - 4, BG_W, 4);

  // Subtle floor depth bands
  ctx.fillStyle = shade(pal.floor, 0.85);
  for (const y of [BG_HORIZON, 128, 150, 176]) {
    ctx.fillRect(0, y, BG_W, 1);
  }
  ctx.fillStyle = shade(pal.floor, 1.12);
  ctx.fillRect(0, BG_HORIZON + 1, BG_W, 1);

  // P10 fix: no more big baked-in room title — the scene draws a compact
  // room-name chip in the HUD instead. (spec.label still names the log line.)

  // Thin accent border
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, BG_W - 1, BG_H - 1);

  return canvas;
}

// ---------------------------------------------------------------------------
// Actor sprite-sheet placeholder
// ---------------------------------------------------------------------------

const actorLabels = new WeakMap<HTMLCanvasElement, string>();

/**
 * The short label for a generated placeholder actor sheet, if this image is
 * one. Actors render it beneath themselves at draw time so it stays crisp at
 * any depth scale and never mirrors with the sprite.
 */
export function placeholderActorLabel(image: LoadedImage): string | undefined {
  return image instanceof HTMLCanvasElement ? actorLabels.get(image) : undefined;
}

/**
 * Generated sheet layout (real art must follow the same frame indices):
 * 3 columns x 3 rows. Row 0 = down, row 1 = up, row 2 = right.
 * Column 0 = idle pose, columns 1/2 = walk poses.
 * Frame indices: down 0-2, up 3-5, right 6-8. Left is mirrored from right.
 */
function makeActorPlaceholder(spec: {
  label: string;
  color: string;
  frameW: number;
  frameH: number;
}): HTMLCanvasElement {
  const { frameW, frameH } = spec;
  const [canvas, ctx] = makeCanvas(frameW * 3, frameH * 3);
  const dirs: Array<'down' | 'up' | 'right'> = ['down', 'up', 'right'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      drawHumanoidFrame(ctx, col * frameW, row * frameH, dirs[row], col, spec);
    }
  }
  actorLabels.set(canvas, spec.label);
  return canvas;
}

function drawHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: 'down' | 'up' | 'right',
  pose: number,
  spec: { label: string; color: string; frameW: number; frameH: number },
): void {
  const { color, frameW: w, frameH: h } = spec;
  const outline = shade(color, 0.5);
  const cx = ox + Math.floor(w / 2);
  const feetY = oy + h; // feet baseline at the frame bottom, like real art
  const legH = Math.max(3, Math.floor(h * 0.16));
  const legW = Math.max(2, Math.floor(w / 8));
  const torsoW = Math.max(6, Math.floor(w / 2));
  const headR = Math.max(2, Math.floor(w / 6));
  const lift = pose === 2 ? 1 : 0; // slight bob between the two walk poses

  // Legs
  ctx.fillStyle = shade(color, 0.72);
  if (pose === 0) {
    ctx.fillRect(cx - legW - 1, feetY - legH, legW, legH);
    ctx.fillRect(cx + 1, feetY - legH, legW, legH);
  } else {
    const spread = 2;
    const backLift = 1;
    const leadLeft = pose === 1;
    ctx.fillRect(cx - legW - 1 - spread, feetY - legH, legW, legH - (leadLeft ? 0 : backLift));
    ctx.fillRect(cx + 1 + spread, feetY - legH, legW, legH - (leadLeft ? backLift : 0));
  }

  // Torso (rounded) with outline
  const torsoTop = oy + 2 + headR * 2 + 1 - lift;
  const torsoH = feetY - legH - torsoTop + 1;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2 - 1, torsoTop - 1, torsoW + 2, torsoH + 2, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2, torsoTop, torsoW, torsoH, 3);
  ctx.fill();

  // Head with outline
  const headCY = oy + 2 + headR - lift;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 1.2);
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Facing indicator: small arrow on the chest
  const ay = torsoTop + Math.floor(torsoH / 2);
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath();
  if (dir === 'down') {
    ctx.moveTo(cx - 2, ay - 1);
    ctx.lineTo(cx + 3, ay - 1);
    ctx.lineTo(cx, ay + 2);
  } else if (dir === 'up') {
    ctx.moveTo(cx - 2, ay + 1);
    ctx.lineTo(cx + 3, ay + 1);
    ctx.lineTo(cx, ay - 2);
  } else {
    ctx.moveTo(cx - 1, ay - 2);
    ctx.lineTo(cx - 1, ay + 3);
    ctx.lineTo(cx + 2, ay);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Cursor & icon placeholders (verb cursors, icon-bar buttons)
// ---------------------------------------------------------------------------

/** Filled panel with a 1px crisp border (shared UI chrome helper). */
export function outlinedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bg: string,
  border: string,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  outlineRect(ctx, x, y, w, h, border);
}

function outlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/** Paint a crisp 12x12 pixel glyph for a verb/UI concept at (ox, oy). */
export function drawUiGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: UiGlyph,
  ox: number,
  oy: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const r = (x: number, y: number, w: number, h: number): void => {
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  switch (glyph) {
    case 'walk': // boot
      r(5, 1, 3, 6);
      r(5, 7, 6, 3);
      r(4, 10, 7, 1);
      break;
    case 'look': // eye with pupil
      r(4, 3, 4, 1);
      r(2, 4, 2, 1);
      r(8, 4, 2, 1);
      r(1, 5, 2, 2);
      r(9, 5, 2, 2);
      r(5, 5, 2, 2);
      r(2, 7, 2, 1);
      r(8, 7, 2, 1);
      r(4, 8, 4, 1);
      break;
    case 'hand': // palm with fingers and thumb
      r(2, 2, 1, 4);
      r(4, 1, 1, 5);
      r(6, 1, 1, 5);
      r(8, 2, 1, 4);
      r(2, 6, 7, 4);
      r(9, 6, 2, 2);
      break;
    case 'talk': // speech bubble with tail and dots
      outlineRect(ctx, ox + 1, oy + 1, 10, 7, color);
      ctx.fillStyle = color;
      r(3, 8, 2, 1);
      r(2, 9, 2, 1);
      r(3, 4, 1, 1);
      r(5, 4, 1, 1);
      r(7, 4, 1, 1);
      break;
    case 'item': // small lidded box
      outlineRect(ctx, ox + 2, oy + 3, 8, 7, color);
      ctx.fillStyle = color;
      r(2, 5, 8, 1);
      r(5, 7, 2, 1);
      break;
    case 'inventory': // satchel with handle
      outlineRect(ctx, ox + 4, oy + 1, 4, 3, color);
      outlineRect(ctx, ox + 2, oy + 3, 8, 8, color);
      ctx.fillStyle = color;
      r(2, 5, 8, 1);
      break;
    case 'settings': // gear
      r(5, 0, 2, 2);
      r(5, 10, 2, 2);
      r(0, 5, 2, 2);
      r(10, 5, 2, 2);
      outlineRect(ctx, ox + 3, oy + 3, 6, 6, color);
      ctx.fillStyle = color;
      r(5, 5, 2, 2);
      break;
  }
}

function makeCursorPlaceholder(spec: { glyph: UiGlyph }): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(12, 12);
  // Dark drop-shadow first so the cursor reads on any background.
  drawUiGlyph(ctx, spec.glyph, 1, 1, '#000000');
  drawUiGlyph(ctx, spec.glyph, 0, 0, '#ffffff');
  return canvas;
}

function makeIconPlaceholder(spec: {
  glyph: UiGlyph;
  label: string;
  w: number;
  h: number;
}): HTMLCanvasElement {
  const { w, h } = spec;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#1b2432';
  ctx.fillRect(0, 0, w, h);
  outlineRect(ctx, 0, 0, w, h, '#5f7392');
  drawUiGlyph(ctx, spec.glyph, 3, Math.floor((h - 12) / 2), '#cfe0ff');
  const maxChars = Math.max(1, Math.floor((w - 18) / 4));
  drawPixelText(
    ctx,
    spec.label.slice(0, maxChars),
    17,
    Math.floor((h - 5) / 2),
    '#9fb4d8',
  );
  return canvas;
}

// ---------------------------------------------------------------------------
// Portrait placeholder (48x48 head-and-shoulders for dialogue boxes)
// ---------------------------------------------------------------------------

export const PORTRAIT_SIZE = 48;

function makePortraitPlaceholder(spec: {
  label: string;
  color: string;
  expression: string;
}): HTMLCanvasElement {
  const s = PORTRAIT_SIZE;
  const { color } = spec;
  const [canvas, ctx] = makeCanvas(s, s);

  ctx.fillStyle = shade(color, 0.22);
  ctx.fillRect(0, 0, s, s);
  outlineRect(ctx, 0, 0, s, s, color);
  outlineRect(ctx, 1, 1, s - 2, s - 2, shade(color, 0.5));

  // Shoulders
  ctx.fillStyle = shade(color, 0.75);
  ctx.beginPath();
  ctx.roundRect(9, 33, 30, 14, 5);
  ctx.fill();

  // Head
  ctx.fillStyle = shade(color, 0.45);
  ctx.beginPath();
  ctx.arc(24, 20, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 1.15);
  ctx.beginPath();
  ctx.arc(24, 20, 10, 0, Math.PI * 2);
  ctx.fill();

  // Simple face; the mouth (and brows) vary by expression
  const dark = shade(color, 0.3);
  ctx.fillStyle = dark;
  ctx.fillRect(20, 17, 2, 2);
  ctx.fillRect(27, 17, 2, 2);
  const e = spec.expression;
  if (e.includes('smug') || e.includes('happy')) {
    ctx.fillRect(20, 24, 2, 1);
    ctx.fillRect(22, 25, 5, 1);
    ctx.fillRect(27, 24, 2, 1);
  } else if (e.includes('worried') || e.includes('sad')) {
    ctx.fillRect(21, 25, 7, 1);
    ctx.fillRect(20, 26, 2, 1);
    ctx.fillRect(27, 26, 2, 1);
  } else if (e.includes('angry') || e.includes('annoyed')) {
    ctx.fillRect(19, 15, 4, 1);
    ctx.fillRect(26, 15, 4, 1);
    ctx.fillRect(21, 25, 7, 1);
  } else {
    ctx.fillRect(21, 25, 7, 1);
  }

  // Expression tag (top-left) and name (bottom center)
  drawPixelText(ctx, spec.expression.slice(0, 9), 3, 3, shade(color, 1.4));
  const maxChars = Math.floor((s - 6) / 4);
  drawPixelText(ctx, spec.label.slice(0, maxChars), s / 2, s - 8, '#ffffff', 1, 'center');

  return canvas;
}

// ---------------------------------------------------------------------------
// Item icon placeholder (24x24 for inventory slots and the held-item cursor)
// ---------------------------------------------------------------------------

export const ITEM_ICON_SIZE = 24;

const ITEM_PALETTE = ['#e2b053', '#7fd4a3', '#7fb2e0', '#d98fd9', '#e08f8f', '#a3e07f', '#e0d47f'];

function makeItemPlaceholder(spec: { label: string }): HTMLCanvasElement {
  const s = ITEM_ICON_SIZE;
  const [canvas, ctx] = makeCanvas(s, s);
  let hash = 0;
  for (const ch of spec.label) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const color = ITEM_PALETTE[Math.abs(hash) % ITEM_PALETTE.length];

  ctx.fillStyle = shade(color, 0.3);
  ctx.beginPath();
  ctx.roundRect(1, 1, s - 2, s - 2, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(1.5, 1.5, s - 3, s - 3, 4);
  ctx.stroke();

  // Big initial letter, centered
  drawPixelText(ctx, spec.label.slice(0, 1), s / 2, 7, shade(color, 1.35), 2, 'center');
  drawPixelText(ctx, spec.label.slice(0, 5), s / 2, 17, shade(color, 1.1), 1, 'center');

  return canvas;
}

// ---------------------------------------------------------------------------
// Generic fallback placeholder
// ---------------------------------------------------------------------------

function makeGenericPlaceholder(path: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64, 64);
  ctx.fillStyle = '#2f3542';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 62, 62);
  const name = path.split('/').pop() ?? path;
  drawPixelText(ctx, name.slice(0, 15), 32, 26, '#ff9bff', 1, 'center');
  drawPixelText(ctx, '?', 32, 34, '#ff9bff', 1, 'center');
  return canvas;
}
