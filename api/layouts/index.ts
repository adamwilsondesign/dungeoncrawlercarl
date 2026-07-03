/**
 * GET /api/layouts - PUBLIC read: which rooms have saved layout overrides,
 * as roomId -> { url } (blob URLs with ?v= cache-busters). The game fetches
 * this once at boot, exactly like /api/manifest; rooms then pull their own
 * layout JSON lazily. Blob unreachable = empty index, zero client errors.
 *
 * Named HTTP-method export = the Vercel Node runtime's web-handler signature.
 */

import { list } from '@vercel/blob';
import { json, LAYOUT_PREFIX } from '../_lib.js';

export async function GET(request: Request): Promise<Response> {
  void request;
  try {
    const layouts: Record<string, { url: string }> = {};
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: LAYOUT_PREFIX, cursor });
      for (const blob of page.blobs) {
        const name = blob.pathname.slice(LAYOUT_PREFIX.length);
        if (!name.endsWith('.json')) continue;
        const roomId = name.slice(0, -'.json'.length);
        layouts[roomId] = { url: `${blob.url}?v=${new Date(blob.uploadedAt).getTime()}` };
      }
      cursor = page.cursor ?? undefined;
    } while (cursor);
    return json({ layouts });
  } catch {
    return json({ layouts: {} });
  }
}
