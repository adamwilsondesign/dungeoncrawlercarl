/**
 * Runtime props (P17): scene elements as individual composited assets. A
 * RuntimeProp is a sprite (own art, baseline-anchored, z-sorted against
 * actors), a hotspot (hover/verbs via an absolute hit shape), and a walkmask
 * contribution (optional blocker rect), unified.
 *
 * Legacy HotspotDefs convert to invisible props at room load (empty art,
 * absolute hit shape, same id), so hotspots and props share one runtime
 * store, one interaction path, and one flag namespace
 * (`hotspot:<room>:<id>` - enableHotspot and enableProp are aliases).
 */

import type { HotspotDef, HotspotVerbs, Point, PropDef, Rect } from '../data/types';
import { loadImage, makeCanvas, type LoadedImage } from './assets';
import { pointInPolygon, pointInRect } from './hotspot';

/** Alpha above this counts as "solid" for the auto hit bounding box. */
const AUTO_HIT_ALPHA = 16;

interface PropInit {
  id: string;
  name: string | null;
  verbs: HotspotVerbs;
  decoration: boolean;
  legacy: boolean;
  initialEnabled: boolean;
  image: LoadedImage | null;
  /** Scaled draw rect in room coords (null = nothing to draw). */
  drawRect: Rect | null;
  z: number;
  /** Absolute hit shape in room coords. Polygon wins when both present. */
  hitRect: Rect | null;
  hitPolygon: Point[] | null;
  /** Absolute walk-blocker rect in room coords. */
  blocker: Rect | null;
  /** The (possibly layout-merged) def this was built from; null = legacy. */
  sourceDef: PropDef | null;
}

export class RuntimeProp {
  readonly id: string;
  /** Hover label; null = not interactive (decoration or unnamed). */
  readonly name: string | null;
  readonly verbs: HotspotVerbs;
  readonly decoration: boolean;
  /** Converted from a legacy HotspotDef (invisible, absolute shapes). */
  readonly legacy: boolean;
  /** The def's initial enabled value (flags override at runtime). */
  readonly initialEnabled: boolean;
  readonly blocker: Rect | null;
  readonly z: number;
  /** The def this prop was built from (editor rebuilds placement); null = legacy. */
  readonly sourceDef: PropDef | null;
  /** Live enabled state, synced from GameState flags by the scene. */
  enabled: boolean;

  private readonly image: LoadedImage | null;
  private readonly drawRect: Rect | null;
  private readonly hitRect: Rect | null;
  private readonly hitPolygon: Point[] | null;

  constructor(init: PropInit) {
    this.id = init.id;
    this.name = init.name;
    this.verbs = init.verbs;
    this.decoration = init.decoration;
    this.legacy = init.legacy;
    this.initialEnabled = init.initialEnabled;
    this.enabled = init.initialEnabled;
    this.image = init.image;
    this.drawRect = init.drawRect;
    this.z = init.z;
    this.hitRect = init.hitRect;
    this.hitPolygon = init.hitPolygon;
    this.blocker = init.blocker;
    this.sourceDef = init.sourceDef;
  }

  /** The resolved art image (editor rebuilds placement without a reload). */
  get imageRef(): LoadedImage | null {
    return this.image;
  }

  /** The scaled on-screen art rect (editor selection and handles), if drawn. */
  get artBounds(): Rect | null {
    return this.drawRect;
  }

  /** Interactive props hover, highlight, and take verbs. */
  get interactive(): boolean {
    return !this.decoration && this.name !== null;
  }

  get hasArt(): boolean {
    return this.image !== null && this.drawRect !== null;
  }

  /** Hit-shape bounding box (radial walk-approach, reveal chips). */
  get bounds(): Rect {
    if (this.hitPolygon && this.hitPolygon.length >= 3) {
      const xs = this.hitPolygon.map((p) => p.x);
      const ys = this.hitPolygon.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (this.hitRect) return this.hitRect;
    return this.drawRect ?? { x: 0, y: 0, w: 0, h: 0 };
  }

  /** Absolute hit shape for outlines: polygon when authored, else a rect. */
  get outline(): { rect?: Rect; polygon?: Point[] } {
    if (this.hitPolygon && this.hitPolygon.length >= 3) return { polygon: this.hitPolygon };
    if (this.hitRect) return { rect: this.hitRect };
    return {};
  }

  hitTest(p: Point): boolean {
    if (!this.interactive) return false;
    if (this.hitPolygon && this.hitPolygon.length >= 3) return pointInPolygon(p, this.hitPolygon);
    if (this.hitRect) return pointInRect(p, this.hitRect);
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.image || !this.drawRect) return;
    const r = this.drawRect;
    ctx.drawImage(this.image, Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
  }
}

const alphaBoundsCache = new WeakMap<LoadedImage, Rect | null>();

/** Bounding box of pixels with alpha > threshold, in image pixel coords. */
function alphaBounds(image: LoadedImage): Rect | null {
  const hit = alphaBoundsCache.get(image);
  if (hit !== undefined) return hit;
  const bb = computeAlphaBounds(image);
  alphaBoundsCache.set(image, bb);
  return bb;
}

function computeAlphaBounds(image: LoadedImage): Rect | null {
  const w = image.width;
  const h = image.height;
  if (w === 0 || h === 0) return null;
  const [, ctx] = makeCanvas(w, h);
  ctx.drawImage(image, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Tainted canvas (unexpected cross-origin art): fall back to the full art.
    return { x: 0, y: 0, w, h };
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > AUTO_HIT_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** The drop-in asset path for a prop (CMS/bundled override slot). */
export function propAssetPath(def: PropDef): string {
  return def.art.kind === 'image' ? def.art.path : `props/${def.id}.png`;
}

/**
 * Build a RuntimeProp from an authored PropDef. Art resolves like every
 * other asset (override -> bundled -> procedural drawFn -> labeled crate).
 * `depthScale` is the room's scaleAt(def.y); it composes with def.scale.
 */
export async function buildProp(def: PropDef, depthScale: number): Promise<RuntimeProp> {
  const image = await loadImage(propAssetPath(def), {
    kind: 'prop',
    label: def.name ?? def.id,
    drawFn: def.art.kind === 'procedural' ? def.art.drawFn : undefined,
  });
  return buildPropFromImage(def, image, depthScale);
}

/**
 * Synchronous variant used by the editor: rebuild a prop's placement from an
 * already-resolved image (drags recompute every frame; alpha bounds cache).
 */
export function buildPropFromImage(
  def: PropDef,
  image: LoadedImage,
  depthScale: number,
): RuntimeProp {
  const s = (def.scale ?? 1) * depthScale;
  const w = image.width * s;
  const h = image.height * s;
  // Baseline anchor: the art's bottom-center sits on (x, y).
  const drawRect: Rect = { x: def.x - w / 2, y: def.y - h, w, h };

  const shape = def.hitShape ?? { kind: 'auto' as const };
  let hitRect: Rect | null = null;
  let hitPolygon: Point[] | null = null;
  if (shape.kind === 'rect') {
    const r = shape.rect;
    hitRect = { x: drawRect.x + r.x * s, y: drawRect.y + r.y * s, w: r.w * s, h: r.h * s };
  } else if (shape.kind === 'polygon') {
    hitPolygon = shape.polygon.map((p) => ({
      x: drawRect.x + p.x * s,
      y: drawRect.y + p.y * s,
    }));
  } else {
    const bb = alphaBounds(image);
    if (bb) {
      hitRect = {
        x: drawRect.x + bb.x * s,
        y: drawRect.y + bb.y * s,
        w: bb.w * s,
        h: bb.h * s,
      };
    }
  }

  return new RuntimeProp({
    id: def.id,
    name: def.decoration ? null : def.name ?? null,
    verbs: def.decoration ? {} : def.verbs ?? {},
    decoration: def.decoration === true,
    legacy: false,
    initialEnabled: def.enabled !== false,
    image,
    drawRect,
    z: def.zOverride ?? def.y,
    hitRect,
    hitPolygon,
    blocker: def.blocker
      ? { x: def.x + def.blocker.x, y: def.y + def.blocker.y, w: def.blocker.w, h: def.blocker.h }
      : null,
    sourceDef: def,
  });
}

const loggedConversions = new Set<string>();

/**
 * Convert a legacy HotspotDef into an invisible internal prop: same id (so
 * the flag store and existing enableHotspot scripts keep working), empty
 * art, the original rect/polygon as an absolute hit shape.
 */
export function propFromHotspot(roomId: string, def: HotspotDef): RuntimeProp {
  const key = `${roomId}:${def.id}`;
  if (!loggedConversions.has(key)) {
    loggedConversions.add(key);
    console.info(`[props] legacy hotspot "${def.id}" (${roomId}) converted to internal prop`);
  }
  return new RuntimeProp({
    id: def.id,
    name: def.name,
    verbs: def.verbs,
    decoration: false,
    legacy: true,
    initialEnabled: def.enabled !== false,
    image: null,
    drawRect: null,
    // Legacy hotspots never drew; their z never competes with actors.
    z: 0,
    hitRect: def.rect ?? null,
    hitPolygon: def.polygon ?? null,
    blocker: null,
    sourceDef: null,
  });
}
