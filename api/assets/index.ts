/**
 * Admin asset routes (x-admin-token header required):
 *   GET    /api/assets          -> [{ id, url, size, uploadedAt }]
 *   DELETE /api/assets?id=<id>  -> removes the override
 * The id rides in a query param (not a path segment) because asset ids are
 * paths themselves, e.g. backgrounds/r01_street.png.
 */

import { del } from '@vercel/blob';
import { checkAdmin, isValidAssetId, json, listOverrides } from '../_lib';

export default async function handler(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;

  if (request.method === 'GET') {
    try {
      return json({ assets: await listOverrides() });
    } catch (err) {
      return json({ error: `blob storage unavailable: ${String(err)}` }, 503);
    }
  }

  if (request.method === 'DELETE') {
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

  return json({ error: 'method not allowed' }, 405);
}
