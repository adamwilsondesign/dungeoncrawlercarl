/**
 * GET /api/manifest - PUBLIC read: the id -> url map of active overrides.
 * The game fetches this once at boot; each url carries a ?v= cache-buster
 * derived from the upload time, because overwritten blobs keep the same URL
 * and are otherwise served with long-lived cache headers.
 */

import { json, listOverrides } from './_lib';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  try {
    const entries = await listOverrides();
    const overrides: Record<string, string> = {};
    for (const e of entries) {
      overrides[e.id] = `${e.url}?v=${Date.parse(e.uploadedAt)}`;
    }
    return json({ overrides });
  } catch {
    // Blob not provisioned / unreachable: an empty manifest keeps the game
    // on bundled + procedural art with zero client errors.
    return json({ overrides: {} });
  }
}
