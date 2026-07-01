/**
 * Hotspot hit-testing: rects and arbitrary polygons in logical coords.
 * Definition order is priority — the first enabled hit wins.
 */

import type { HotspotDef, Point, Rect } from '../data/types';

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function hotspotHit(def: HotspotDef, p: Point): boolean {
  if (def.polygon && def.polygon.length >= 3) return pointInPolygon(p, def.polygon);
  if (def.rect) return pointInRect(p, def.rect);
  return false;
}

/** First enabled hotspot containing the point, or null. */
export function hotspotAt(
  defs: readonly HotspotDef[],
  p: Point,
  isEnabled: (def: HotspotDef) => boolean,
): HotspotDef | null {
  for (const def of defs) {
    if (isEnabled(def) && hotspotHit(def, p)) return def;
  }
  return null;
}
