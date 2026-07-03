/**
 * Shared helpers for the asset-CMS serverless routes (Vercel Node runtime,
 * Web-standard Request/Response). Files starting with "_" are not routed.
 *
 * Storage layout: every override lives in Vercel Blob at
 *   overrides/<asset path>   e.g. overrides/backgrounds/r01_street.png
 * so the blob pathname minus the prefix IS the in-game asset id.
 */

import { list } from '@vercel/blob';

export const OVERRIDE_PREFIX = 'overrides/';
/** Room layout files (P18 admin editor) live under their own prefix. */
export const LAYOUT_PREFIX = 'layouts/';

/** Room ids are simple slugs (r01_street). */
export function isValidRoomId(id: string): boolean {
  return /^[a-z0-9_-]{1,64}$/.test(id);
}

/** The Blob entry for one room's layout file, if it exists. */
export async function findLayoutBlob(
  roomId: string,
): Promise<{ url: string; uploadedAt: string } | null> {
  const page = await list({ prefix: `${LAYOUT_PREFIX}${roomId}.json` });
  const hit = page.blobs.find((b) => b.pathname === `${LAYOUT_PREFIX}${roomId}.json`);
  return hit ? { url: hit.url, uploadedAt: new Date(hit.uploadedAt).toISOString() } : null;
}

/** Asset ids are relative paths like backgrounds/r01_street.png. */
export function isValidAssetId(id: string): boolean {
  return (
    /^[a-z0-9_/-]+\.(png|jpg|jpeg|gif|webp|ogg|mp3|wav)$/i.test(id) &&
    !id.includes('..') &&
    !id.startsWith('/')
  );
}

/** Write routes require the admin token in the x-admin-token header. */
export function checkAdmin(request: Request): Response | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return json({ error: 'ADMIN_TOKEN is not configured on the server' }, 503);
  }
  const got = request.headers.get('x-admin-token') ?? '';
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return json({ error: 'invalid admin token' }, 401);
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export interface OverrideEntry {
  id: string;
  url: string;
  size: number;
  uploadedAt: string;
}

/** All current overrides in Blob storage. Throws if Blob is unreachable. */
export async function listOverrides(): Promise<OverrideEntry[]> {
  const out: OverrideEntry[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: OVERRIDE_PREFIX, cursor });
    for (const blob of page.blobs) {
      out.push({
        id: blob.pathname.slice(OVERRIDE_PREFIX.length),
        url: blob.url,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt).toISOString(),
      });
    }
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return out;
}
