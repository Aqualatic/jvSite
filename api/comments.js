import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { parseJsonBody, getSongId, clampText, sendResponse } from './_lib/utils.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const songId = getSongId(req);
      if (!songId) return sendResponse(res, 400, { error: 'Missing or invalid song_id' });

      const rows = await supabaseRestFetch(
        `/comments?select=author,body,image_url,created_at&song_id=eq.${encodeURIComponent(songId)}&order=created_at.desc&limit=100`,
        { method: 'GET' },
      );

      return sendResponse(res, 200, { comments: Array.isArray(rows) ? rows : [] });
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const songId = body.song_id;
      if (!songId) return sendResponse(res, 400, { error: 'Missing song_id' });

      const author = clampText(body.author, 30);
      const text = clampText(body.body, 500);
      const imageUrl = body.image_url ? String(body.image_url).trim().slice(0, 1000) : null;
      if (!author || !text) return sendResponse(res, 400, { error: 'Missing author or body' });

      const inserted = await supabaseRestFetch('/comments', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([{ song_id: songId, author, body: text, image_url: imageUrl }]),
      });

      const row = Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : null;
      return sendResponse(res, 200, { ok: true, comment: row });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return sendResponse(res, status, { error: err?.message || 'Server error' });
  }
}
