import { supabaseRestFetch } from './_lib/supabaseRest.js';

function send(res, status, body) {
  res.status(status).json(body);
}

function getSongId(req) {
  const songId = String(req.query?.song_id || '').trim();
  if (!songId) return null;
  if (songId.length > 64) return null;
  if (!/^[a-z0-9_-]+$/i.test(songId)) return null;
  return songId;
}

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function clampDelta(n) {
  if (n === 1) return 1;
  if (n === -1) return -1;
  return 0;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const songId = getSongId(req);
      if (!songId) return send(res, 400, { error: 'Missing or invalid song_id' });

      const rows = await supabaseRestFetch(
        `/ratings?select=likes,dislikes&song_id=eq.${encodeURIComponent(songId)}&limit=1`,
        { method: 'GET' },
      );

      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return send(res, 200, { likes: row?.likes ?? 0, dislikes: row?.dislikes ?? 0 });
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const songId = String(body.song_id || '').trim();
      if (!songId || songId.length > 64 || !/^[a-z0-9_-]+$/i.test(songId)) {
        return send(res, 400, { error: 'Missing or invalid song_id' });
      }

      const likeDelta = clampDelta(Number(body.likeDelta));
      const dislikeDelta = clampDelta(Number(body.dislikeDelta));
      if (likeDelta === 0 && dislikeDelta === 0) {
        return send(res, 200, { ok: true, likes: null, dislikes: null });
      }

      const existingRows = await supabaseRestFetch(
        `/ratings?select=likes,dislikes&song_id=eq.${encodeURIComponent(songId)}&limit=1`,
        { method: 'GET' },
      );
      const existing =
        Array.isArray(existingRows) && existingRows.length > 0
          ? existingRows[0]
          : { likes: 0, dislikes: 0 };

      const nextLikes = Math.max(0, Number(existing.likes || 0) + likeDelta);
      const nextDislikes = Math.max(0, Number(existing.dislikes || 0) + dislikeDelta);

      const upserted = await supabaseRestFetch(`/ratings?on_conflict=song_id`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify([{ song_id: songId, likes: nextLikes, dislikes: nextDislikes }]),
      });

      const row = Array.isArray(upserted) && upserted.length > 0 ? upserted[0] : null;
      return send(res, 200, { ok: true, likes: row?.likes ?? nextLikes, dislikes: row?.dislikes ?? nextDislikes });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return send(res, status, { error: err?.message || 'Server error' });
  }
}

