/**
 * Per-room layout routes (P18 admin editor):
 *   GET    /api/layouts/:roomId  -> public: the layout JSON, or { layout: null }
 *   POST   /api/layouts/:roomId  -> admin: write layouts/<roomId>.json to Blob
 *   DELETE /api/layouts/:roomId  -> admin: remove the override file
 *
 * Admin routes take the same x-admin-token header as the CMS upload routes.
 * The room id rides the path (simple slug, validated); the layout body is
 * sanitized field-by-field so junk can never reach the public file.
 *
 * Named HTTP-method exports = the Vercel Node runtime's web-handler signature.
 */

import { del, put } from '@vercel/blob';
import { checkAdmin, findLayoutBlob, isValidRoomId, json, LAYOUT_PREFIX } from '../_lib.js';

function roomIdFrom(request: Request): string {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

interface LayoutOverride {
  x?: number;
  y?: number;
  scale?: number;
  zOverride?: number | null;
  enabled?: boolean;
  removed?: true;
}

interface LayoutAdded {
  id: string;
  artDesign: string;
  x: number;
  y: number;
  scale?: number;
  zOverride?: number;
}

interface Layout {
  version: 1;
  roomId: string;
  updatedAt: number;
  overrides: Record<string, LayoutOverride>;
  added: LayoutAdded[];
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Rebuild the layout from the raw body keeping only known, well-typed fields. */
function sanitize(body: unknown, roomId: string): Layout | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.version !== 1 || b.roomId !== roomId) return null;
  if (typeof b.overrides !== 'object' || b.overrides === null || !Array.isArray(b.added)) return null;

  const overrides: Record<string, LayoutOverride> = {};
  for (const [id, raw] of Object.entries(b.overrides as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(id) || typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const o: LayoutOverride = {};
    if (num(r.x)) o.x = r.x;
    if (num(r.y)) o.y = r.y;
    if (num(r.scale) && r.scale > 0) o.scale = r.scale;
    if (num(r.zOverride) || r.zOverride === null) o.zOverride = r.zOverride as number | null;
    if (typeof r.enabled === 'boolean') o.enabled = r.enabled;
    if (r.removed === true) o.removed = true;
    if (Object.keys(o).length > 0) overrides[id] = o;
  }

  const added: LayoutAdded[] = [];
  for (const raw of b.added as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(r.id)) continue;
    if (typeof r.artDesign !== 'string' || r.artDesign.length === 0 || r.artDesign.length > 120) continue;
    if (!num(r.x) || !num(r.y)) continue;
    const a: LayoutAdded = { id: r.id, artDesign: r.artDesign, x: r.x, y: r.y };
    if (num(r.scale) && r.scale > 0) a.scale = r.scale;
    if (num(r.zOverride)) a.zOverride = r.zOverride;
    added.push(a);
  }

  return { version: 1, roomId, updatedAt: num(b.updatedAt) ? b.updatedAt : Date.now(), overrides, added };
}

export async function GET(request: Request): Promise<Response> {
  const roomId = roomIdFrom(request);
  if (!isValidRoomId(roomId)) return json({ error: `invalid room id "${roomId}"` }, 400);
  try {
    const blob = await findLayoutBlob(roomId);
    if (!blob) return json({ layout: null });
    const res = await fetch(blob.url);
    if (!res.ok) return json({ layout: null });
    return json({ layout: (await res.json()) as unknown });
  } catch {
    return json({ layout: null });
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;
  const roomId = roomIdFrom(request);
  if (!isValidRoomId(roomId)) return json({ error: `invalid room id "${roomId}"` }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'expected a JSON body' }, 400);
  }
  const layout = sanitize(body, roomId);
  if (!layout) {
    return json({ error: 'malformed layout (need version:1, matching roomId, overrides, added)' }, 400);
  }

  try {
    const blob = await put(`${LAYOUT_PREFIX}${roomId}.json`, JSON.stringify(layout), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return json({ ok: true, roomId, url: `${blob.url}?v=${Date.now()}` });
  } catch (err) {
    return json({ error: `save failed: ${String(err)}` }, 503);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;
  const roomId = roomIdFrom(request);
  if (!isValidRoomId(roomId)) return json({ error: `invalid room id "${roomId}"` }, 400);
  try {
    const blob = await findLayoutBlob(roomId);
    if (!blob) return json({ error: `no layout for "${roomId}"` }, 404);
    await del(blob.url);
    return json({ ok: true, roomId });
  } catch (err) {
    return json({ error: `delete failed: ${String(err)}` }, 503);
  }
}
