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

function clampText(s, maxLen) {
  return String(s || '').trim().slice(0, maxLen);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const songId = getSongId(req);
      if (!songId) return send(res, 400, { error: 'Missing or invalid song_id' });

      const rows = await supabaseRestFetch(
        `/comments?select=author,body,created_at&song_id=eq.${encodeURIComponent(songId)}&order=created_at.desc&limit=100`,
        { method: 'GET' },
      );

      return send(res, 200, { comments: Array.isArray(rows) ? rows : [] });
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const songId = String(body.song_id || '').trim();
      if (!songId || songId.length > 64 || !/^[a-z0-9_-]+$/i.test(songId)) {
        return send(res, 400, { error: 'Missing or invalid song_id' });
      }

      const author = clampText(body.author, 30);
      const text = clampText(body.body, 500);
      if (!author || !text) return send(res, 400, { error: 'Missing author or body' });

      const inserted = await supabaseRestFetch('/comments', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([{ song_id: songId, author, body: text }]),
      });

      const row = Array.isArray(inserted) && inserted.length > 0 ? inserted[0] : null;
      return send(res, 200, { ok: true, comment: row });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return send(res, status, { error: err?.message || 'Server error' });
  }
}

