/**
 * Async asset loader with rich placeholder generation.
 *
 * Asset paths are relative to /src/assets, e.g. 'backgrounds/r00_test.png' or
 * 'sprites/carl.png'. Files that exist are discovered at build time via
 * import.meta.glob, so dropping real art into /src/assets later requires zero
 * code changes. Missing files produce legible, spec-driven placeholders.
 */

import {
  portraitDesigns,
  spriteDesigns,
  type PortraitDesign,
  type SpriteDesign,
} from '../data/spriteArt';
import type { Mood, MoodPalette, PlaceholderOutfit, PlaceholderSpec, UiGlyph } from '../data/types';

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
    return makeActorPlaceholder(path, spec);
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
    // The path is the id: ui/portrait_<characterId>_<expression>.png
    const m = /portrait_([a-z0-9_]+)_[a-z]+\.png$/i.exec(path);
    return makePortraitPlaceholder({ ...spec, characterId: m?.[1] });
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

/**
 * Art-direction palettes (per the room briefs):
 * - cold: Seattle night - deep blues, sodium-orange applied per-room.
 * - dungeon: Floor 1 signature - warm brick/stone under GREEN LICHEN glow.
 * - safe: lamplit interior warmth - ambers over wood-brown.
 * - workshop: goblin industry - copper, coal, forge-orange.
 * - boss: lurid red boss-light over dark stone.
 */
const MOOD_PALETTES: Record<Mood, MoodPalette> = {
  cold: { wall: '#1c2c44', floor: '#2c4360', accent: '#7fd4ff', text: '#d5ecff' },
  dungeon: { wall: '#43362a', floor: '#554432', accent: '#7de08a', text: '#dff2d9' },
  safe: { wall: '#4a3a24', floor: '#5e4a2e', accent: '#ffd98a', text: '#ffefd2' },
  workshop: { wall: '#3d2f24', floor: '#59452f', accent: '#ffc06e', text: '#ffe9c9' },
  boss: { wall: '#3d1f24', floor: '#5c3038', accent: '#ff6e6e', text: '#ffdada' },
};

const BG_W = 320;
const BG_H = 200;
const BG_HORIZON = 110;

/** Deterministic pseudo-random stream so generated art is stable per run. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Ambient dressing shared by every room of a mood - the "signature look"
 * layer from the art briefs (green lichen for dungeon, forge haze for
 * workshop, boss vignette, lamp pools for safe rooms).
 */
function drawMoodDressing(ctx: CanvasRenderingContext2D, mood: Mood, pal: MoodPalette): void {
  const rnd = seeded(mood.length * 7919 + 17);
  if (mood === 'dungeon') {
    // Brick courses on the wall
    ctx.fillStyle = shade(pal.wall, 0.88);
    for (let y = 14; y < BG_HORIZON - 6; y += 10) {
      ctx.fillRect(0, y, BG_W, 1);
      for (let x = (y / 10) % 2 === 0 ? 14 : 0; x < BG_W; x += 28) ctx.fillRect(x, y - 9, 1, 9);
    }
    // Glowing green lichen clumps along the ceiling line and wall seams
    for (let i = 0; i < 26; i++) {
      const x = rnd() * BG_W;
      const y = 4 + rnd() * (BG_HORIZON - 30);
      const r = 3 + rnd() * 7;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      glow.addColorStop(0, 'rgba(125,224,138,0.5)');
      glow.addColorStop(1, 'rgba(125,224,138,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      ctx.fillStyle = i % 3 === 0 ? '#8fe89a' : '#5cae6d';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Green light spill on the floor
    const spill = ctx.createLinearGradient(0, BG_HORIZON, 0, BG_H);
    spill.addColorStop(0, 'rgba(125,224,138,0.14)');
    spill.addColorStop(1, 'rgba(125,224,138,0)');
    ctx.fillStyle = spill;
    ctx.fillRect(0, BG_HORIZON, BG_W, BG_H - BG_HORIZON);
  } else if (mood === 'workshop') {
    // Riveted iron panels + coal-smoke haze + ember glow at the seam
    ctx.fillStyle = shade(pal.wall, 0.82);
    for (let x = 0; x < BG_W; x += 46) ctx.fillRect(x, 8, 2, BG_HORIZON - 10);
    ctx.fillStyle = shade(pal.wall, 1.25);
    for (let x = 6; x < BG_W; x += 23) ctx.fillRect(x, 16, 1, 1);
    const ember = ctx.createLinearGradient(0, BG_HORIZON - 26, 0, BG_HORIZON + 8);
    ember.addColorStop(0, 'rgba(255,120,40,0)');
    ember.addColorStop(1, 'rgba(255,120,40,0.28)');
    ctx.fillStyle = ember;
    ctx.fillRect(0, BG_HORIZON - 26, BG_W, 34);
    ctx.fillStyle = 'rgba(30,22,16,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, 6 + i * 9, BG_W, 3 - (i % 2));
  } else if (mood === 'boss') {
    // Lurid red vignette pressing in from the edges
    const v = ctx.createRadialGradient(BG_W / 2, 120, 40, BG_W / 2, 120, 230);
    v.addColorStop(0, 'rgba(255,60,60,0)');
    v.addColorStop(1, 'rgba(120,10,16,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, BG_W, BG_H);
  } else if (mood === 'safe') {
    // Warm lamp pools along the wall
    for (const x of [70, 250]) {
      const g = ctx.createRadialGradient(x, 40, 4, x, 40, 70);
      g.addColorStop(0, 'rgba(255,214,130,0.4)');
      g.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 70, 0, 140, 120);
      ctx.fillStyle = '#ffd982';
      ctx.fillRect(x - 3, 36, 6, 6);
      ctx.fillStyle = shade(pal.wall, 0.7);
      ctx.fillRect(x - 1, 28, 2, 8);
    }
  } else if (mood === 'cold') {
    // Night gradient + faint stars above the skyline line
    const sky = ctx.createLinearGradient(0, 0, 0, BG_HORIZON);
    sky.addColorStop(0, '#0c1526');
    sky.addColorStop(1, 'rgba(12,21,38,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, BG_W, BG_HORIZON);
    ctx.fillStyle = '#cfe4ff';
    for (let i = 0; i < 24; i++) ctx.fillRect(Math.floor(rnd() * BG_W), Math.floor(rnd() * 48), 1, 1);
  }
}

function makeBackgroundPlaceholder(spec: {
  label: string;
  mood: Mood;
  draw?: (ctx: CanvasRenderingContext2D, pal: MoodPalette) => void;
}): HTMLCanvasElement {
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

  // Mood signature layer, then the room's own art brief on top.
  drawMoodDressing(ctx, spec.mood, pal);
  spec.draw?.(ctx, pal);

  // Painterly finish: fine dither grain + a soft corner vignette. Both are
  // baked once here - backgrounds are generated a single time and cached,
  // so this costs nothing per frame.
  const img = ctx.getImageData(0, 0, BG_W, BG_H);
  const px = img.data;
  const rnd = seeded(0x5eed);
  for (let i = 0; i < px.length; i += 4) {
    const n = Math.floor(rnd() * 9) - 4;
    px[i] = Math.max(0, Math.min(255, px[i] + n));
    px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n));
    px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const vig = ctx.createRadialGradient(BG_W / 2, BG_H / 2, BG_H * 0.55, BG_W / 2, BG_H / 2, BG_H * 1.15);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, BG_W, BG_H);

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
type FrameDir = 'down' | 'up' | 'right';

function makeActorPlaceholder(
  path: string,
  spec: {
    label: string;
    color: string;
    frameW: number;
    frameH: number;
    outfit?: PlaceholderOutfit;
  },
): HTMLCanvasElement {
  const { frameW, frameH } = spec;
  const [canvas, ctx] = makeCanvas(frameW * 3, frameH * 3);
  const dirs: FrameDir[] = ['down', 'up', 'right'];
  const design = spriteDesigns[path];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (design) drawDesignFrame(ctx, col * frameW, row * frameH, dirs[row], col, design, frameW, frameH);
      else drawHumanoidFrame(ctx, col * frameW, row * frameH, dirs[row], col, spec);
    }
  }
  actorLabels.set(canvas, spec.label);
  return canvas;
}

// ---------------------------------------------------------------------------
// Drawn character frames (art pass): a handful of body plans parameterized
// by the SpriteDesign registry. All feet-anchored, 3 poses per direction.
// ---------------------------------------------------------------------------

function drawDesignFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: FrameDir,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
): void {
  switch (d.plan) {
    case 'cat':
      drawCatFrame(ctx, ox, oy, dir, pose, d, w, h);
      break;
    case 'critter':
      drawCritterFrame(ctx, ox, oy, dir, pose, d, w, h);
      break;
    case 'sphere':
      drawSphereFrame(ctx, ox, oy, pose, d, w, h);
      break;
    case 'bulky':
      drawBulkyFrame(ctx, ox, oy, dir, pose, d, w, h);
      break;
    case 'small':
      drawBipedFrame(ctx, ox, oy, dir, pose, d, w, h, true);
      break;
    default:
      drawBipedFrame(ctx, ox, oy, dir, pose, d, w, h, false);
  }
}

/** Humans and small folk: head/hair, torso with arms, legs, shoes. */
function drawBipedFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: FrameDir,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
  small: boolean,
): void {
  const cx = ox + Math.floor(w / 2);
  const feetY = oy + h;
  const lift = pose === 2 ? 1 : 0;
  // Proportions: small folk get a bigger head, shorter legs
  const headR = small ? Math.max(3, Math.round(w * 0.24)) : Math.max(3, Math.round(w * 0.19));
  const legH = small ? Math.max(3, Math.round(h * 0.18)) : Math.max(4, Math.round(h * 0.26));
  const torsoW = Math.max(6, Math.round(w * (small ? 0.62 : 0.5)));
  const legW = Math.max(2, Math.round(torsoW / 3) - 1);
  const headTop = oy + 1 - lift + (small ? 0 : 1);
  const torsoTop = headTop + headR * 2 + 1;
  const torsoH = feetY - legH - torsoTop;
  const swing = pose === 0 ? 0 : pose === 1 ? 2 : -2;

  // Cloak behind everything
  if (d.cloak) {
    ctx.fillStyle = d.cloak;
    ctx.beginPath();
    ctx.moveTo(cx - torsoW / 2 - 2, torsoTop + 1);
    ctx.lineTo(cx + torsoW / 2 + 2, torsoTop + 1);
    ctx.lineTo(cx + torsoW / 2, feetY - 2);
    ctx.lineTo(cx - torsoW / 2, feetY - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Quiver on the back (visible except when facing up, where it dominates)
  if (d.quiver && dir !== 'down') {
    ctx.fillStyle = '#7a5638';
    ctx.fillRect(cx + (dir === 'right' ? -torsoW / 2 - 3 : 2), torsoTop + 1, 5, torsoH + 2);
    ctx.fillStyle = '#d8cdb4';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx + (dir === 'right' ? -torsoW / 2 - 2 : 3) + i, torsoTop - 4, 1, 5);
    }
  }

  // Legs + shoes
  const legColor = d.legs ?? shade(d.torso, 0.7);
  const shoe = d.feet ?? shade(d.torso, 0.4);
  const leg = (x: number, dy: number): void => {
    ctx.fillStyle = legColor;
    ctx.fillRect(x, feetY - legH + dy, legW, legH - dy);
    ctx.fillStyle = shoe;
    ctx.fillRect(x - 1, feetY - 2, legW + 2, 2);
  };
  if (dir === 'right') {
    leg(cx - legW - 1 + swing, swing > 0 ? 1 : 0);
    leg(cx + 1 - swing, swing < 0 ? 1 : 0);
  } else {
    leg(cx - legW - 1 - Math.abs(swing) / 2, swing > 0 ? 1 : 0);
    leg(cx + 1 + Math.abs(swing) / 2, swing < 0 ? 1 : 0);
  }

  // Torso with jacket shading + arms
  ctx.fillStyle = shade(d.torso, 0.55);
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2 - 1, torsoTop - 1, torsoW + 2, torsoH + 2, 3);
  ctx.fill();
  ctx.fillStyle = d.torso;
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2, torsoTop, torsoW, torsoH, 2);
  ctx.fill();
  ctx.fillStyle = shade(d.torso, 1.18);
  ctx.fillRect(cx - torsoW / 2 + 1, torsoTop + 1, 2, torsoH - 2);
  // Scarf pile / patches over the torso
  if (d.patches?.length) {
    d.patches.forEach((p, i) => {
      ctx.fillStyle = p;
      ctx.fillRect(cx - torsoW / 2, torsoTop + 1 + i * 3, torsoW, 2);
    });
  }
  // Arms: skin or sleeve, swinging opposite the legs
  const armColor = d.plan === 'human' && !d.cloak ? shade(d.torso, 0.85) : shade(d.torso, 0.8);
  ctx.fillStyle = armColor;
  if (dir === 'right') {
    ctx.fillRect(cx - 1 - swing, torsoTop + 2, 2, Math.max(3, torsoH - 4));
  } else {
    ctx.fillRect(cx - torsoW / 2 - 1, torsoTop + 2 + (swing > 0 ? 1 : 0), 2, Math.max(3, torsoH - 5));
    ctx.fillRect(cx + torsoW / 2 - 1, torsoTop + 2 + (swing < 0 ? 1 : 0), 2, Math.max(3, torsoH - 5));
  }

  // Weapon at the side (right-facing shows it best; down shows a hint)
  if (d.weapon && dir !== 'up') {
    const wx = dir === 'right' ? cx + torsoW / 2 + 1 : cx + torsoW / 2 + 1;
    if (d.weapon === 'sword') {
      ctx.fillStyle = '#c9ccd4';
      ctx.fillRect(wx, torsoTop - 2, 2, torsoH + 2);
      ctx.fillStyle = '#7a5638';
      ctx.fillRect(wx - 1, torsoTop + torsoH - 3, 4, 2);
    } else if (d.weapon === 'club') {
      ctx.fillStyle = '#7a5638';
      ctx.fillRect(wx, torsoTop + 1, 2, torsoH);
      ctx.fillStyle = '#5c4128';
      ctx.fillRect(wx - 1, torsoTop - 1, 4, 4);
    } else if (d.weapon === 'wrench') {
      ctx.fillStyle = '#8f939c';
      ctx.fillRect(wx, torsoTop + 3, 2, Math.max(4, torsoH - 4));
      ctx.fillRect(wx - 1, torsoTop + 2, 4, 2);
    } else if (d.weapon === 'spear') {
      ctx.fillStyle = '#7a5638';
      ctx.fillRect(wx, headTop, 1, feetY - headTop - 2);
      ctx.fillStyle = '#c9ccd4';
      ctx.fillRect(wx - 1, headTop - 3, 3, 4);
    } else if (d.weapon === 'bow') {
      ctx.strokeStyle = '#7a5638';
      ctx.beginPath();
      ctx.arc(wx + 1, torsoTop + torsoH / 2, Math.max(4, torsoH / 2), -Math.PI / 2.4, Math.PI / 2.4);
      ctx.stroke();
    }
  }

  // Head: skin, face (down/right), hair or hat
  const headCX = cx;
  const headCY = headTop + headR;
  ctx.fillStyle = shade(d.skin, 0.55);
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  if (d.ears === 'rat' || d.ears === 'round') {
    ctx.fillStyle = shade(d.skin, 0.9);
    ctx.beginPath();
    ctx.arc(headCX - headR, headCY - headR + 2, 2, 0, Math.PI * 2);
    ctx.arc(headCX + headR, headCY - headR + 2, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.ears === 'goblin') {
    ctx.fillStyle = d.skin;
    ctx.beginPath();
    ctx.moveTo(headCX - headR, headCY);
    ctx.lineTo(headCX - headR - 3, headCY - 2);
    ctx.lineTo(headCX - headR, headCY - 3);
    ctx.moveTo(headCX + headR, headCY);
    ctx.lineTo(headCX + headR + 3, headCY - 2);
    ctx.lineTo(headCX + headR, headCY - 3);
    ctx.fill();
  }
  // Hair / hat
  if (d.hairStyle === 'trapper' && d.hatColor) {
    ctx.fillStyle = d.hatColor;
    ctx.beginPath();
    ctx.arc(headCX, headCY - 1, headR + 1, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(headCX - headR - 1, headCY - 1, 2, headR);
    ctx.fillRect(headCX + headR - 1, headCY - 1, 2, headR);
  } else if (d.hairStyle === 'skullcap' && d.hatColor) {
    ctx.fillStyle = d.hatColor;
    ctx.beginPath();
    ctx.arc(headCX, headCY - 1, headR, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shade(d.hatColor, 1.3);
    ctx.fillRect(headCX - headR, headCY - 2, headR * 2, 1);
  } else if (d.hair && d.hairStyle !== 'bald') {
    ctx.fillStyle = d.hair;
    if (dir === 'up') {
      ctx.beginPath();
      ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(headCX, headCY - 1, headR, Math.PI, 0);
      ctx.fill();
      if (d.hairStyle === 'messy') {
        ctx.fillRect(headCX - headR, headCY - 2, 2, 2);
        ctx.fillRect(headCX + headR - 2, headCY - 3, 2, 3);
        ctx.fillRect(headCX - 1, headCY - headR - 2, 3, 2);
      }
      if (d.hairStyle === 'ponytail') {
        ctx.fillRect(dir === 'right' ? headCX - headR - 2 : headCX + headR - 1, headCY, 3, headR + 2);
      }
    }
  }
  // Face: eyes + tusks (not on up-facing frames)
  if (dir !== 'up') {
    ctx.fillStyle = '#181414';
    if (dir === 'right') {
      ctx.fillRect(headCX + Math.max(1, headR - 3), headCY - 1, 2, 2);
    } else {
      ctx.fillRect(headCX - Math.max(2, Math.round(headR / 2)) - 1, headCY - 1, 2, 2);
      ctx.fillRect(headCX + Math.max(0, Math.round(headR / 2)) - 1, headCY - 1, 2, 2);
    }
    if (d.tusks) {
      ctx.fillStyle = '#f0ead8';
      ctx.fillRect(headCX - 3, headCY + headR - 2, 2, 3);
      ctx.fillRect(headCX + 2, headCY + headR - 2, 2, 3);
    }
  }
  if (d.crown) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(headCX - 3, headCY - headR - 2, 6, 2);
    ctx.fillRect(headCX - 3, headCY - headR - 4, 1, 2);
    ctx.fillRect(headCX, headCY - headR - 4, 1, 2);
    ctx.fillRect(headCX + 2, headCY - headR - 4, 1, 2);
  }
}

/** The Persian: a fluffy horizontal body, flat face, plume tail, patches. */
function drawCatFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: FrameDir,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
): void {
  const feetY = oy + h;
  const cx = ox + Math.floor(w / 2);
  const bodyH = Math.max(6, Math.round(h * 0.55));
  const bodyW = Math.max(10, Math.round(w * 0.7));
  const bodyY = feetY - 2 - bodyH;
  const bob = pose === 2 ? 1 : 0;
  const outline = shade(d.torso, 0.55);

  // Legs: little stubs, alternating on walk poses
  ctx.fillStyle = shade(d.torso, 0.8);
  const step = pose === 0 ? 0 : pose === 1 ? 1 : -1;
  for (const [lx, dyp] of [
    [cx - bodyW / 2 + 2, step],
    [cx - 2, -step],
    [cx + bodyW / 2 - 4, step],
  ] as const) {
    ctx.fillRect(lx, feetY - 3 + Math.max(0, dyp), 2, 3 - Math.max(0, dyp));
  }
  // Plume tail (behind, opposite the facing)
  ctx.fillStyle = d.torso;
  const tailX = dir === 'right' ? cx - bodyW / 2 - 2 : cx + bodyW / 2 - 1;
  ctx.beginPath();
  ctx.ellipse(tailX, bodyY - bob, 3, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Fluffy body
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY + bodyH / 2 - bob, bodyW / 2 + 1, bodyH / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.torso;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY + bodyH / 2 - bob, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tortoiseshell mottling clipped to the body
  if (d.patches?.length) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + bodyH / 2 - bob, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    const spots: Array<[number, number, number]> = [
      [-bodyW * 0.26, -1, 3.4], [bodyW * 0.18, 2, 3], [0, -3, 2.6], [bodyW * 0.3, -2, 2.2],
    ];
    spots.forEach(([dx, dy, r], i) => {
      ctx.fillStyle = d.patches![i % d.patches!.length];
      ctx.beginPath();
      ctx.ellipse(cx + dx, bodyY + bodyH / 2 + dy - bob, r, r * 0.75, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  // Head: flat-faced, forward of the body (or centered when facing down/up)
  const headR = Math.max(3, Math.round(h * 0.28));
  const headX = dir === 'right' ? cx + bodyW / 2 - 1 : cx;
  const headY = bodyY - bob + 1;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(headX, headY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(d.skin, 1.06);
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = d.torso;
  ctx.beginPath();
  ctx.moveTo(headX - headR + 1, headY - headR + 2);
  ctx.lineTo(headX - headR - 1, headY - headR - 2);
  ctx.lineTo(headX - headR + 4, headY - headR);
  ctx.moveTo(headX + headR - 1, headY - headR + 2);
  ctx.lineTo(headX + headR + 1, headY - headR - 2);
  ctx.lineTo(headX + headR - 4, headY - headR);
  ctx.closePath();
  ctx.fill();
  // Flat face: close-set eyes + tiny frown muzzle (not on up frames)
  if (dir !== 'up') {
    ctx.fillStyle = '#181414';
    if (dir === 'right') {
      ctx.fillRect(headX + 1, headY - 1, 2, 2);
    } else {
      ctx.fillRect(headX - 3, headY - 1, 2, 2);
      ctx.fillRect(headX + 1, headY - 1, 2, 2);
    }
    ctx.fillStyle = shade(d.skin, 0.7);
    ctx.fillRect(headX - 1, headY + 1, 2, 1);
  }
  if (d.crown) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(headX - 3, headY - headR - 1, 6, 2);
    ctx.fillRect(headX - 3, headY - headR - 3, 1, 2);
    ctx.fillRect(headX, headY - headR - 3, 1, 2);
    ctx.fillRect(headX + 2, headY - headR - 3, 1, 2);
  }
}

/** Rats, mites, scuttlers: a low four-legged wedge with a tail. */
function drawCritterFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: FrameDir,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
): void {
  const feetY = oy + h;
  const cx = ox + Math.floor(w / 2);
  const bodyH = Math.max(5, Math.round(h * 0.42));
  const bodyW = Math.max(9, Math.round(w * 0.62));
  const bodyY = feetY - 3 - bodyH + (pose === 2 ? 1 : 0);
  const step = pose === 0 ? 0 : pose === 1 ? 1 : -1;
  // Legs
  ctx.fillStyle = shade(d.torso, 0.7);
  for (const [lx, dyp] of [
    [cx - bodyW / 2 + 1, step], [cx - 2, -step], [cx + bodyW / 2 - 3, step],
  ] as const) {
    ctx.fillRect(lx, feetY - 3 + Math.max(0, dyp), 2, 3 - Math.max(0, dyp));
  }
  // Tail
  ctx.strokeStyle = shade(d.skin, 0.85);
  ctx.beginPath();
  const tailX = dir === 'right' ? cx - bodyW / 2 : cx + bodyW / 2;
  ctx.moveTo(tailX, bodyY + bodyH - 2);
  ctx.quadraticCurveTo(tailX + (dir === 'right' ? -5 : 5), bodyY + bodyH - 5, tailX + (dir === 'right' ? -7 : 7), bodyY + bodyH - 1);
  ctx.stroke();
  // Body wedge with a snout end
  ctx.fillStyle = shade(d.torso, 0.55);
  ctx.beginPath();
  ctx.ellipse(cx, bodyY + bodyH / 2, bodyW / 2 + 1, bodyH / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.torso;
  ctx.beginPath();
  ctx.ellipse(cx, bodyY + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (d.patches?.length) {
    ctx.fillStyle = d.patches[0];
    ctx.beginPath();
    ctx.ellipse(cx - 1, bodyY + bodyH / 2 - 1, bodyW / 4, bodyH / 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head/snout + ear + eye
  const headX = dir === 'right' ? cx + bodyW / 2 : cx;
  const headY = bodyY + 1;
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 4, 3, dir === 'right' ? 0.2 : 0, 0, Math.PI * 2);
  ctx.fill();
  if (d.ears === 'rat') {
    ctx.fillStyle = shade(d.skin, 0.85);
    ctx.beginPath();
    ctx.arc(headX - 2, headY - 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dir !== 'up') {
    ctx.fillStyle = '#181414';
    ctx.fillRect(headX + (dir === 'right' ? 2 : -1), headY - 1, 1, 1);
  }
}

/** Hulks: hunched mass, heavy arms, small low head, grime. */
function drawBulkyFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: FrameDir,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
): void {
  const feetY = oy + h;
  const cx = ox + Math.floor(w / 2);
  const lift = pose === 2 ? 1 : 0;
  const bodyW = Math.max(10, Math.round(w * 0.8));
  const bodyH = Math.max(10, Math.round(h * 0.62));
  const bodyTop = feetY - Math.round(h * 0.16) - bodyH - lift;
  const swing = pose === 0 ? 0 : pose === 1 ? 2 : -2;
  // Legs: stumpy
  ctx.fillStyle = shade(d.torso, 0.6);
  ctx.fillRect(cx - bodyW / 4 - 2 - Math.abs(swing) / 2, feetY - Math.round(h * 0.18), 5, Math.round(h * 0.18));
  ctx.fillRect(cx + bodyW / 4 - 3 + Math.abs(swing) / 2, feetY - Math.round(h * 0.18), 5, Math.round(h * 0.18));
  // Hunched mass
  ctx.fillStyle = shade(d.torso, 0.5);
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop + bodyH / 2, bodyW / 2 + 1, bodyH / 2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.torso;
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Caked-on patches / plating
  if (d.patches?.length) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    d.patches.forEach((p, i) => {
      ctx.fillStyle = p;
      ctx.beginPath();
      ctx.ellipse(
        cx - bodyW / 4 + (i * bodyW) / 3,
        bodyTop + bodyH / 3 + ((i % 2) * bodyH) / 3,
        bodyW / 5,
        bodyH / 6,
        0.4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    ctx.restore();
  }
  if (d.scruff) {
    ctx.fillStyle = d.scruff;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(cx - bodyW / 2 + 2 + ((i * 7) % (bodyW - 4)), bodyTop + 2 + ((i * 5) % (bodyH - 4)), 1, 2);
    }
  }
  // Heavy arms swinging
  ctx.fillStyle = shade(d.skin, 0.9);
  ctx.fillRect(cx - bodyW / 2 - 2, bodyTop + 3 + (swing > 0 ? 2 : 0), 4, bodyH - 2);
  ctx.fillRect(cx + bodyW / 2 - 2, bodyTop + 3 + (swing < 0 ? 2 : 0), 4, bodyH - 2);
  // Club for armed hulks
  if (d.weapon === 'club' && dir !== 'up') {
    ctx.fillStyle = '#5c4128';
    ctx.fillRect(cx + bodyW / 2 + 1, bodyTop - 4, 3, bodyH);
    ctx.fillStyle = '#4a3420';
    ctx.fillRect(cx + bodyW / 2, bodyTop - 7, 5, 5);
  }
  // Low-set head
  const headR = Math.max(3, Math.round(w * 0.16));
  const headY = bodyTop + 1;
  ctx.fillStyle = shade(d.skin, 0.6);
  ctx.beginPath();
  ctx.arc(cx, headY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  if (dir !== 'up') {
    ctx.fillStyle = '#181414';
    if (dir === 'right') ctx.fillRect(cx + 1, headY - 1, 2, 2);
    else {
      ctx.fillRect(cx - 3, headY - 1, 2, 2);
      ctx.fillRect(cx + 1, headY - 1, 2, 2);
    }
    if (d.tusks) {
      ctx.fillStyle = '#f0ead8';
      ctx.fillRect(cx - 4, headY + 1, 2, 4);
      ctx.fillRect(cx + 3, headY + 1, 2, 4);
    }
  }
}

/** The Ball: a rolling mass of pink flesh, steel plate, and faces. */
function drawSphereFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  pose: number,
  d: SpriteDesign,
  w: number,
  h: number,
): void {
  const cx = ox + Math.floor(w / 2);
  const r = Math.min(w, h) / 2 - 2;
  const cy = oy + h - r - 1;
  const roll = pose * 0.7; // the pose frames read as rotation
  ctx.fillStyle = shade(d.skin, 0.5);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Armor plates riveted around the mass, rotating with the pose
  if (d.patches?.length) {
    for (let i = 0; i < 5; i++) {
      const a = roll + (i / 5) * Math.PI * 2;
      const px2 = cx + Math.cos(a) * r * 0.62;
      const py2 = cy + Math.sin(a) * r * 0.62;
      ctx.fillStyle = d.patches[i % d.patches.length];
      ctx.beginPath();
      ctx.ellipse(px2, py2, r * 0.28, r * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Protruding faces: pale ovals with dark eyes, spinning like hubcaps
  for (let i = 0; i < 3; i++) {
    const a = roll * 1.3 + (i / 3) * Math.PI * 2 + 0.5;
    const fx = cx + Math.cos(a) * r * 0.45;
    const fy = cy + Math.sin(a) * r * 0.45;
    ctx.fillStyle = shade(d.skin, 1.2);
    ctx.beginPath();
    ctx.ellipse(fx, fy, r * 0.18, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#181414';
    ctx.fillRect(fx - 2, fy - 1, 1, 1);
    ctx.fillRect(fx + 1, fy - 1, 1, 1);
    if (d.tusks) {
      ctx.fillStyle = '#f0ead8';
      ctx.fillRect(fx - 2, fy + 1, 1, 2);
      ctx.fillRect(fx + 1, fy + 1, 1, 2);
    }
  }
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, oy + h - 1, r * 0.8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: 'down' | 'up' | 'right',
  pose: number,
  spec: { label: string; color: string; frameW: number; frameH: number; outfit?: PlaceholderOutfit },
): void {
  const { color, frameW: w, frameH: h, outfit } = spec;
  const torsoColor = outfit?.torso ?? color;
  const outline = shade(torsoColor, 0.5);
  const cx = ox + Math.floor(w / 2);
  const feetY = oy + h; // feet baseline at the frame bottom, like real art
  const legH = Math.max(3, Math.floor(h * 0.16));
  const legW = Math.max(2, Math.floor(w / 8));
  const torsoW = Math.max(6, Math.floor(w / 2));
  const headR = Math.max(2, Math.floor(w / 6));
  const lift = pose === 2 ? 1 : 0; // slight bob between the two walk poses

  // Legs (and, when dressed, distinct feet - one very specific pair of Crocs)
  const legColor = outfit?.legs ?? shade(color, 0.72);
  const drawLeg = (x: number, hgt: number): void => {
    ctx.fillStyle = legColor;
    ctx.fillRect(x, feetY - hgt, legW, hgt);
    if (outfit?.feet) {
      ctx.fillStyle = outfit.feet;
      ctx.fillRect(x - 1, feetY - 2, legW + 2, 2);
    }
  };
  if (pose === 0) {
    drawLeg(cx - legW - 1, legH);
    drawLeg(cx + 1, legH);
  } else {
    const spread = 2;
    const backLift = 1;
    const leadLeft = pose === 1;
    drawLeg(cx - legW - 1 - spread, legH - (leadLeft ? 0 : backLift));
    drawLeg(cx + 1 + spread, legH - (leadLeft ? backLift : 0));
  }

  // Torso (rounded) with outline
  const torsoTop = oy + 2 + headR * 2 + 1 - lift;
  const torsoH = feetY - legH - torsoTop + 1;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2 - 1, torsoTop - 1, torsoW + 2, torsoH + 2, 4);
  ctx.fill();
  ctx.fillStyle = torsoColor;
  ctx.beginPath();
  ctx.roundRect(cx - torsoW / 2, torsoTop, torsoW, torsoH, 3);
  ctx.fill();

  // Fur mottling (tortoiseshell patches), clipped to the torso
  if (outfit?.patches?.length) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - torsoW / 2, torsoTop, torsoW, torsoH, 3);
    ctx.clip();
    const spots: Array<[number, number, number]> = [
      [-torsoW * 0.3, torsoH * 0.25, torsoW * 0.32],
      [torsoW * 0.28, torsoH * 0.55, torsoW * 0.3],
      [-torsoW * 0.1, torsoH * 0.8, torsoW * 0.26],
      [torsoW * 0.2, torsoH * 0.15, torsoW * 0.22],
    ];
    spots.forEach(([dx, dy, r], i) => {
      ctx.fillStyle = outfit.patches![i % outfit.patches!.length];
      ctx.beginPath();
      ctx.ellipse(cx + dx, torsoTop + dy, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Head with outline
  const headCY = oy + 2 + headR - lift;
  const headColor = outfit?.head ?? shade(torsoColor, 1.2);
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // A tiny crown, for royalty
  if (outfit?.crown) {
    const cy2 = headCY - headR - 1 + (lift ? 1 : 0);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 3, cy2 - 1, 6, 2);
    ctx.fillRect(cx - 3, cy2 - 3, 1, 2);
    ctx.fillRect(cx, cy2 - 3, 1, 2);
    ctx.fillRect(cx + 2, cy2 - 3, 1, 2);
  }

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
  characterId?: string;
}): HTMLCanvasElement {
  const s = PORTRAIT_SIZE;
  const [canvas, ctx] = makeCanvas(s, s);
  const d: PortraitDesign =
    (spec.characterId && portraitDesigns[spec.characterId]) || {
      accent: spec.color,
      skin: shade(spec.color, 1.15),
      hair: shade(spec.color, 0.5),
      hairStyle: 'short',
      collar: shade(spec.color, 0.75),
    };
  const e = spec.expression;

  // Backdrop: soft radial glow in the character's accent, framed
  const bg = ctx.createRadialGradient(s / 2, s * 0.42, 4, s / 2, s * 0.42, s * 0.75);
  bg.addColorStop(0, shade(d.accent, 0.55));
  bg.addColorStop(1, shade(d.accent, 0.2));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  outlineRect(ctx, 0, 0, s, s, d.accent);
  outlineRect(ctx, 1, 1, s - 2, s - 2, shade(d.accent, 0.45));

  const cx = s / 2;
  const headCY = 20;
  const headR = d.catFace ? 12 : 11;

  // Shoulders / collar (scarf pile for one very bundled resident)
  ctx.fillStyle = d.collar ?? shade(d.accent, 0.75);
  ctx.beginPath();
  ctx.roundRect(cx - 16, 33, 32, 15, 5);
  ctx.fill();
  if (d.scarves?.length) {
    d.scarves.forEach((sc, i) => {
      ctx.fillStyle = sc;
      ctx.beginPath();
      ctx.roundRect(cx - 15, 32 + i * 4, 30, 4, 3);
      ctx.fill();
    });
  }

  // Ears behind the head
  if (d.ears === 'cat') {
    ctx.fillStyle = shade(d.skin, 0.9);
    ctx.beginPath();
    ctx.moveTo(cx - headR + 2, headCY - headR + 3);
    ctx.lineTo(cx - headR - 2, headCY - headR - 4);
    ctx.lineTo(cx - headR + 8, headCY - headR + 1);
    ctx.moveTo(cx + headR - 2, headCY - headR + 3);
    ctx.lineTo(cx + headR + 2, headCY - headR - 4);
    ctx.lineTo(cx + headR - 8, headCY - headR + 1);
    ctx.closePath();
    ctx.fill();
  } else if (d.ears === 'rat' || d.ears === 'round') {
    ctx.fillStyle = shade(d.skin, 0.92);
    ctx.beginPath();
    ctx.arc(cx - headR - 1, headCY - headR + 4, 4, 0, Math.PI * 2);
    ctx.arc(cx + headR + 1, headCY - headR + 4, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (d.ears === 'goblin') {
    ctx.fillStyle = d.skin;
    ctx.beginPath();
    ctx.moveTo(cx - headR, headCY);
    ctx.lineTo(cx - headR - 6, headCY - 4);
    ctx.lineTo(cx - headR, headCY - 6);
    ctx.moveTo(cx + headR, headCY);
    ctx.lineTo(cx + headR + 6, headCY - 4);
    ctx.lineTo(cx + headR, headCY - 6);
    ctx.closePath();
    ctx.fill();
  }

  // Head: cat faces are wider and flatter
  ctx.fillStyle = shade(d.skin, 0.55);
  ctx.beginPath();
  if (d.catFace) ctx.ellipse(cx, headCY, headR + 1, headR - 1, 0, 0, Math.PI * 2);
  else ctx.arc(cx, headCY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  if (d.catFace) ctx.ellipse(cx, headCY, headR, headR - 2, 0, 0, Math.PI * 2);
  else ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Tortoiseshell mottling on the fur
  if (d.patches?.length) {
    ctx.save();
    ctx.beginPath();
    if (d.catFace) ctx.ellipse(cx, headCY, headR, headR - 2, 0, 0, Math.PI * 2);
    else ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.clip();
    const spots: Array<[number, number, number]> = [
      [-7, -5, 5], [8, -3, 4], [-4, 6, 3.4], [5, 7, 3],
    ];
    spots.forEach(([dx, dy, r], i) => {
      ctx.fillStyle = d.patches![i % d.patches!.length];
      ctx.beginPath();
      ctx.ellipse(cx + dx, headCY + dy, r, r * 0.8, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Hair / hats
  if (d.trapperHat) {
    ctx.fillStyle = d.trapperHat;
    ctx.beginPath();
    ctx.arc(cx, headCY - 2, headR + 1, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - headR - 2, headCY - 2, 4, headR + 3);
    ctx.fillRect(cx + headR - 2, headCY - 2, 4, headR + 3);
    ctx.fillStyle = shade(d.trapperHat, 1.3);
    ctx.fillRect(cx - headR, headCY - 3, headR * 2, 2);
  } else if (d.skullcap) {
    ctx.fillStyle = d.skullcap;
    ctx.beginPath();
    ctx.arc(cx, headCY - 2, headR, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = shade(d.skullcap, 1.35);
    ctx.fillRect(cx - headR, headCY - 3, headR * 2, 1);
    ctx.fillStyle = shade(d.skullcap, 0.6);
    ctx.fillRect(cx - 1, headCY - headR - 1, 2, 2); // rivet
  } else if (d.hair && d.hairStyle !== 'bald') {
    ctx.fillStyle = d.hair;
    ctx.beginPath();
    ctx.arc(cx, headCY - 2, headR, Math.PI * 0.95, Math.PI * 0.05);
    ctx.fill();
    if (d.hairStyle === 'messy') {
      ctx.fillRect(cx - headR - 1, headCY - 5, 3, 4);
      ctx.fillRect(cx + headR - 2, headCY - 7, 3, 5);
      ctx.fillRect(cx - 2, headCY - headR - 3, 4, 3);
      ctx.fillRect(cx + 4, headCY - headR - 2, 3, 2);
    } else if (d.hairStyle === 'ponytail') {
      ctx.fillRect(cx + headR - 1, headCY - 2, 4, 12);
    }
  }

  // Eyes: whites + pupils; brows vary with expression
  const eyeY = headCY - 1;
  const eyeDX = d.catFace ? 5 : 4;
  ctx.fillStyle = '#f4f0e8';
  ctx.fillRect(cx - eyeDX - 2, eyeY - 1, 4, 4);
  ctx.fillRect(cx + eyeDX - 2, eyeY - 1, 4, 4);
  ctx.fillStyle = d.catFace ? '#3a7a4a' : '#241c14';
  const smug = e.includes('smug') || e.includes('happy') || e.includes('thrilled');
  const angry = e.includes('angry') || e.includes('annoyed');
  const worried = e.includes('worried') || e.includes('sad');
  ctx.fillRect(cx - eyeDX - 1, eyeY + (smug ? 1 : 0), 2, smug ? 2 : 3);
  ctx.fillRect(cx + eyeDX - 1, eyeY + (smug ? 1 : 0), 2, smug ? 2 : 3);
  // Brows
  ctx.fillStyle = shade(d.hair ?? d.skin, 0.5);
  if (angry) {
    ctx.fillRect(cx - eyeDX - 3, eyeY - 4, 5, 2);
    ctx.fillRect(cx + eyeDX - 2, eyeY - 4, 5, 2);
    ctx.fillRect(cx - eyeDX + 1, eyeY - 3, 2, 1);
    ctx.fillRect(cx + eyeDX - 3, eyeY - 3, 2, 1);
  } else if (worried) {
    ctx.fillRect(cx - eyeDX - 2, eyeY - 4, 4, 1);
    ctx.fillRect(cx + eyeDX - 1, eyeY - 4, 4, 1);
    ctx.fillRect(cx - eyeDX - 3, eyeY - 3, 2, 1);
    ctx.fillRect(cx + eyeDX + 2, eyeY - 3, 2, 1);
  } else if (!smug) {
    ctx.fillRect(cx - eyeDX - 2, eyeY - 3, 4, 1);
    ctx.fillRect(cx + eyeDX - 1, eyeY - 3, 4, 1);
  } else {
    ctx.fillRect(cx - eyeDX - 2, eyeY - 3, 4, 1);
  }

  // Muzzle / nose / mouth
  if (d.catFace) {
    ctx.fillStyle = shade(d.skin, 1.15);
    ctx.beginPath();
    ctx.ellipse(cx, headCY + 5, 5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c97a8a';
    ctx.fillRect(cx - 1, headCY + 3, 2, 2);
    ctx.strokeStyle = shade(d.skin, 0.6);
    ctx.beginPath();
    for (const wy of [4, 6]) {
      ctx.moveTo(cx - 5, headCY + wy);
      ctx.lineTo(cx - 12, headCY + wy - 1);
      ctx.moveTo(cx + 5, headCY + wy);
      ctx.lineTo(cx + 12, headCY + wy - 1);
    }
    ctx.stroke();
    ctx.fillStyle = shade(d.skin, 0.5);
    if (smug) ctx.fillRect(cx - 2, headCY + 7, 4, 1);
    else ctx.fillRect(cx - 1, headCY + 7, 2, 1);
  } else {
    if (d.snout) {
      ctx.fillStyle = shade(d.skin, 1.1);
      ctx.beginPath();
      ctx.ellipse(cx, headCY + 4, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2c24';
      ctx.fillRect(cx - 1, headCY + 3, 2, 2);
    } else {
      ctx.fillStyle = shade(d.skin, 0.8);
      ctx.fillRect(cx - 1, headCY + 2, 2, 3);
    }
    const mouthY = headCY + 7;
    ctx.fillStyle = '#241c14';
    if (smug) {
      ctx.fillRect(cx - 3, mouthY - 1, 2, 1);
      ctx.fillRect(cx - 2, mouthY, 6, 1);
    } else if (worried) {
      ctx.fillRect(cx - 3, mouthY, 6, 1);
      ctx.fillRect(cx - 4, mouthY + 1, 2, 1);
      ctx.fillRect(cx + 2, mouthY + 1, 2, 1);
    } else if (angry) {
      ctx.fillRect(cx - 3, mouthY, 7, 1);
    } else {
      ctx.fillRect(cx - 2, mouthY, 5, 1);
    }
    if (d.tusks) {
      ctx.fillStyle = '#f0ead8';
      ctx.fillRect(cx - 5, mouthY - 2, 2, 4);
      ctx.fillRect(cx + 4, mouthY - 2, 2, 4);
    }
    if (d.stubble) {
      ctx.fillStyle = 'rgba(40,30,22,0.5)';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(cx - 6 + ((i * 3) % 12), headCY + 5 + ((i * 2) % 4), 1, 1);
      }
    }
    if (d.beard) {
      ctx.fillStyle = d.beard;
      ctx.beginPath();
      ctx.ellipse(cx, headCY + 8, 6, 4, 0, 0, Math.PI);
      ctx.fill();
    }
  }
  if (d.crown) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 6, headCY - headR - 2, 12, 3);
    for (const dx of [-6, -2, 2, 5]) ctx.fillRect(cx + dx, headCY - headR - 5, 2, 3);
    ctx.fillStyle = '#c94a7a';
    ctx.fillRect(cx - 1, headCY - headR - 1, 2, 1);
  }

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
