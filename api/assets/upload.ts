/**
 * POST /api/assets/upload (x-admin-token header required)
 * multipart/form-data: { id: string, file: File }
 * Stores to Blob at overrides/<id> with overwrite semantics (stable path, no
 * random suffix) and returns { id, url }.
 *
 * Named HTTP-method export = the Vercel Node runtime's web-handler signature.
 */

import { put } from '@vercel/blob';
import { checkAdmin, isValidAssetId, json, OVERRIDE_PREFIX } from '../_lib.js';

const MAX_BYTES = 4 * 1024 * 1024; // plenty for 320x200-era art

export async function POST(request: Request): Promise<Response> {
  const denied = checkAdmin(request);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'expected multipart/form-data' }, 400);
  }
  const id = String(form.get('id') ?? '');
  const file = form.get('file');
  if (!isValidAssetId(id)) return json({ error: `invalid asset id "${id}"` }, 400);
  if (!(file instanceof File)) return json({ error: 'missing file field' }, 400);
  if (file.size === 0 || file.size > MAX_BYTES) {
    return json({ error: `file size ${file.size} out of range (max ${MAX_BYTES})` }, 400);
  }

  try {
    const blob = await put(`${OVERRIDE_PREFIX}${id}`, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return json({ id, url: `${blob.url}?v=${Date.now()}` });
  } catch (err) {
    return json({ error: `upload failed: ${String(err)}` }, 503);
  }
}
