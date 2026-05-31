import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { parseJsonBody, validateSongId, sendResponse } from './_lib/utils.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const songId = validateSongId(body.song_id);
      if (!songId) return sendResponse(res, 400, { error: 'Missing or invalid song_id' });

      await supabaseRestFetch('/plays', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{ song_id: songId }]),
      });

      return sendResponse(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'POST');
    return sendResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return sendResponse(res, status, { error: err?.message || 'Server error' });
  }
}