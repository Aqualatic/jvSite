import { getSupabaseRestConfig } from './_lib/supabaseRest.js';
import { parseJsonBody, sendResponse } from './_lib/utils.js';

const BUCKET = 'media';
const SUBFOLDER = 'comment-uploads';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Parse and validate base64 data URL from request body
 * @param {Object} req - Express request object
 * @returns {Object|null} Parsed body with dataUrl and filename, or null if invalid
 */
function parseBase64Body(req) {
  const body = parseJsonBody(req);
  if (!body || !body.dataUrl || !body.filename) {
    return null;
  }
  return body;
}

/**
 * Generate unique filename for storage
 * @param {string} mimeType - MIME type of the image
 * @returns {string} Unique filename with extension
 */
function generateUniqueFilename(mimeType) {
  const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return unique;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendResponse(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = parseBase64Body(req);
    if (!body) {
      return sendResponse(res, 400, { error: 'Missing dataUrl or filename' });
    }

    // dataUrl format: data:<mime>;base64,<data>
    const match = String(body.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return sendResponse(res, 400, { error: 'Invalid dataUrl format' });

    const mimeType = match[1];
    const base64Data = match[2];

    if (!ALLOWED_MIME.includes(mimeType)) {
      return sendResponse(res, 400, { error: 'Only JPEG, PNG, GIF, and WEBP images are allowed' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.byteLength > MAX_BYTES) {
      return sendResponse(res, 400, { error: 'Image must be under 5 MB' });
    }

    // Build a unique filename so uploads never collide
    const uniqueFilename = generateUniqueFilename(mimeType);
    const storagePath = `${SUBFOLDER}/${uniqueFilename}`;

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
      return sendResponse(res, 500, { error: 'Failed to upload image' });
    }

    const publicUrl = `${storageBase}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    return sendResponse(res, 200, { ok: true, url: publicUrl });
  } catch (err) {
    console.error('Upload handler error:', err);
    return sendResponse(res, 500, { error: err?.message || 'Server error' });
  }
}
