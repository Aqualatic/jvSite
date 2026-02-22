import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { parseJsonBody, getSongId, clampDelta, sendResponse } from './_lib/utils.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const songId = getSongId(req);
      if (!songId) return sendResponse(res, 400, { error: 'Missing or invalid song_id' });

      const rows = await supabaseRestFetch(
        `/ratings?select=likes,dislikes&song_id=eq.${encodeURIComponent(songId)}&limit=1`,
        { method: 'GET' },
      );

      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return sendResponse(res, 200, { likes: row?.likes ?? 0, dislikes: row?.dislikes ?? 0 });
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const songId = body.song_id;
      if (!songId) return sendResponse(res, 400, { error: 'Missing song_id' });

      const likeDelta = clampDelta(body.likeDelta);
      const dislikeDelta = clampDelta(body.dislikeDelta);
      if (likeDelta === 0 && dislikeDelta === 0) {
        return sendResponse(res, 200, { ok: true, likes: null, dislikes: null });
      }

      // Use an atomic increment via SQL function to avoid race conditions.
      // Create it in Supabase (SQL editor) using the snippet in README.md.
      const rpcResult = await supabaseRestFetch(`/rpc/increment_rating`, {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          p_song_id: songId,
          p_like_delta: likeDelta,
          p_dislike_delta: dislikeDelta,
        }),
      });

      const row = Array.isArray(rpcResult) && rpcResult.length > 0 ? rpcResult[0] : null;
      if (!row) return sendResponse(res, 500, { error: 'Failed to update ratings' });

      return sendResponse(res, 200, {
        ok: true,
        likes: row.likes ?? 0,
        dislikes: row.dislikes ?? 0,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return sendResponse(res, status, { error: err?.message || 'Server error' });
  }
}

