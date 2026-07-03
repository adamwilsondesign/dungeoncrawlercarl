/**
 * Admin asset routes (x-admin-token header required):
 *   GET    /api/assets          -> [{ id, url, size, uploadedAt }]
 *   DELETE /api/assets?id=<id>  -> removes the override
 * The id rides in a query param (not a path segment) because asset ids are
 * paths themselves, e.g. backgrounds/r01_street.png.
 *
 * Named HTTP-method exports = the Vercel Node runtime's web-handler
 * signature; unsupported methods get an automatic 405.
 */

import { del } from '@vercel/blob';
import { checkAdmin, isValidAssetId, json, listOverrides } from '../_lib.js';

export async function GET(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;
  try {
    return json({ assets: await listOverrides() });
  } catch (err) {
    return json({ error: `blob storage unavailable: ${String(err)}` }, 503);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!isValidAssetId(id)) return json({ error: `invalid asset id "${id}"` }, 400);
  try {
    const entries = await listOverrides();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return json({ error: `no override for "${id}"` }, 404);
    await del(entry.url);
    return json({ ok: true, id });
  } catch (err) {
    return json({ error: `delete failed: ${String(err)}` }, 503);
  }
}
