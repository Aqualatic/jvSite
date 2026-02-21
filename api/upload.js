import { getSupabaseRestConfig } from './_lib/supabaseRest.js';

const BUCKET = 'media';
const SUBFOLDER = 'comment-uploads';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function send(res, status, body) {
  res.status(status).json(body);
}

function parseBase64Body(req) {
  if (!req.body) return null;
  const b = typeof req.body === 'object' ? req.body : (() => { try { return JSON.parse(req.body); } catch { return null; } })();
  if (!b) return null;
  return b;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = parseBase64Body(req);
    if (!body || !body.dataUrl || !body.filename) {
      return send(res, 400, { error: 'Missing dataUrl or filename' });
    }

    // dataUrl format: data:<mime>;base64,<data>
    const match = String(body.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return send(res, 400, { error: 'Invalid dataUrl format' });

    const mimeType = match[1];
    const base64Data = match[2];

    if (!ALLOWED_MIME.includes(mimeType)) {
      return send(res, 400, { error: 'Only JPEG, PNG, GIF, and WEBP images are allowed' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength > MAX_BYTES) {
      return send(res, 400, { error: 'Image must be under 5 MB' });
    }

    // Build a unique filename so uploads never collide
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${SUBFOLDER}/${unique}`;

    const { restBaseUrl, headers } = getSupabaseRestConfig();
    // Storage API uses a different base path
    const storageBase = restBaseUrl.replace('/rest/v1', '');
    const uploadUrl = `${storageBase}/storage/v1/object/${BUCKET}/${storagePath}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      console.error('Supabase storage upload failed:', txt);
      return send(res, 500, { error: 'Failed to upload image' });
    }

    const publicUrl = `${storageBase}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    return send(res, 200, { ok: true, url: publicUrl });
  } catch (err) {
    console.error('Upload handler error:', err);
    return send(res, 500, { error: err?.message || 'Server error' });
  }
}