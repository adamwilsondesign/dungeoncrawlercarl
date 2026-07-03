/**
 * GET /api/manifest - PUBLIC read: the id -> url map of active overrides.
 * The game fetches this once at boot; each url carries a ?v= cache-buster
 * derived from the upload time, because overwritten blobs keep the same URL
 * and are otherwise served with long-lived cache headers.
 *
 * Named HTTP-method export = the Vercel Node runtime's web-handler
 * signature (a default export would be invoked with Node's (req, res)).
 */

import { json, listOverrides } from './_lib.js';

export async function GET(request: Request): Promise<Response> {
  void request;
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
