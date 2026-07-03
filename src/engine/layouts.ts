/**
 * Room layout overrides (P18): the client side of the admin editor's save
 * format. Layout JSON files live in Vercel Blob at layouts/<roomId>.json;
 * the boot fetch grabs the public index (like the CMS asset manifest), room
 * loads pull + cache their layout lazily, and the editor writes back through
 * the admin POST route. Everything degrades to "no overrides" silently when
 * the API is unreachable (plain `npm run dev`, offline).
 */

import { propDesigns } from '../data/propArt';
import type {
  EditorAddedProp,
  PropDef,
  PropPlacementOverride,
  RoomLayout,
} from '../data/types';

// --- Admin mode (per-browser, never in GameState) ---------------------------

const ADMIN_KEY = 'dcc_admin_mode';
/** Same token the CMS stores; the layout POST/DELETE routes check it. */
export const ADMIN_TOKEN_KEY = 'dcc_admin_token';

export function isAdminMode(): boolean {
  return localStorage.getItem(ADMIN_KEY) === '1';
}

export function setAdminMode(on: boolean): void {
  if (on) localStorage.setItem(ADMIN_KEY, '1');
  else localStorage.removeItem(ADMIN_KEY);
}

// --- Layout fetch / cache ----------------------------------------------------

const layoutUrls = new Map<string, string>();
const layoutCache = new Map<string, RoomLayout | null>();

/** Fetch the public layout index once at boot. Never throws. */
export async function initLayouts(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('/api/layouts', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const body = (await res.json()) as { layouts?: Record<string, { url?: string }> };
    for (const [roomId, entry] of Object.entries(body.layouts ?? {})) {
      if (typeof entry?.url === 'string') layoutUrls.set(roomId, entry.url);
    }
    if (layoutUrls.size > 0) {
      console.info(`[layouts] ${layoutUrls.size} room layout override(s) active`);
    }
  } catch {
    // API unreachable: authored placements only.
  }
}

function isRoomLayout(v: unknown): v is RoomLayout {
  if (typeof v !== 'object' || v === null) return false;
  const l = v as Partial<RoomLayout>;
  return (
    l.version === 1 &&
    typeof l.roomId === 'string' &&
    typeof l.overrides === 'object' &&
    l.overrides !== null &&
    Array.isArray(l.added)
  );
}

/** The saved layout for a room, cached for the session. Never throws. */
export async function getRoomLayout(roomId: string): Promise<RoomLayout | null> {
  const cached = layoutCache.get(roomId);
  if (cached !== undefined) return cached;
  const url = layoutUrls.get(roomId);
  if (!url) {
    layoutCache.set(roomId, null);
    return null;
  }
  try {
    const body: unknown = await (await fetch(url)).json();
    const layout = isRoomLayout(body) ? body : null;
    if (!layout) console.warn(`[layouts] ${roomId}: malformed layout file ignored`);
    layoutCache.set(roomId, layout);
    return layout;
  } catch {
    layoutCache.set(roomId, null);
    return null;
  }
}

/** Editor optimistic update: make a saved layout live for this session. */
export function setCachedLayout(roomId: string, layout: RoomLayout | null): void {
  layoutCache.set(roomId, layout);
}

/** POST a layout to the admin route. Returns ok or the failure reason. */
export async function saveRoomLayout(
  layout: RoomLayout,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/layouts/${encodeURIComponent(layout.roomId)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': localStorage.getItem(ADMIN_TOKEN_KEY) ?? '',
      },
      body: JSON.stringify(layout),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    setCachedLayout(layout.roomId, layout);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Editor connectivity probe: mirrors the CMS banner states. */
export async function probeLayoutsApi(): Promise<'ok' | 'offline'> {
  try {
    const res = await fetch('/api/layouts');
    return res.ok ? 'ok' : 'offline';
  } catch {
    return 'offline';
  }
}

// --- Applying a layout to authored props --------------------------------------

/** Base def + placement override -> the def the room actually builds. */
export function mergePropDef(base: PropDef, o?: PropPlacementOverride): PropDef {
  if (!o) return base;
  return {
    ...base,
    x: o.x ?? base.x,
    y: o.y ?? base.y,
    scale: o.scale ?? base.scale,
    zOverride: o.zOverride === null ? undefined : o.zOverride ?? base.zOverride,
    enabled: o.enabled ?? base.enabled,
  };
}

/**
 * An editor-added prop as a buildable PropDef. A registered propArt design
 * name renders procedurally; anything else is treated as a drop-in asset id
 * (props/<name>.png unless a full path was given). Decoration by default -
 * interactivity is a code-authoring decision.
 */
export function addedPropToDef(a: EditorAddedProp): PropDef {
  const art: PropDef['art'] = propDesigns[a.artDesign]
    ? { kind: 'procedural', drawFn: a.artDesign }
    : { kind: 'image', path: a.artDesign.includes('/') ? a.artDesign : `props/${a.artDesign}.png` };
  return {
    id: a.id,
    art,
    x: a.x,
    y: a.y,
    scale: a.scale,
    zOverride: a.zOverride,
    decoration: true,
  };
}

/**
 * The effective prop list for a room: authored defs with overrides merged
 * (removed ones dropped), then editor-added props appended. Overrides whose
 * prop id no longer exists in the RoomDef are inert (logged, ignored) - a
 * stale layout can never break a room.
 */
export function effectivePropDefs(
  roomId: string,
  authored: readonly PropDef[],
  layout: RoomLayout | null,
): PropDef[] {
  if (!layout) return [...authored];
  const out: PropDef[] = [];
  const seen = new Set<string>();
  for (const base of authored) {
    seen.add(base.id);
    const o = layout.overrides[base.id];
    if (o?.removed) continue;
    out.push(mergePropDef(base, o));
  }
  for (const id of Object.keys(layout.overrides)) {
    if (!seen.has(id)) {
      console.info(`[layouts] ${roomId}: override for unknown prop "${id}" ignored`);
    }
  }
  for (const a of layout.added) {
    if (seen.has(a.id) || out.some((p) => p.id === a.id)) {
      console.warn(`[layouts] ${roomId}: added prop "${a.id}" collides with an authored id; skipped`);
      continue;
    }
    out.push(addedPropToDef(a));
  }
  return out;
}
