import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { sendResponse } from './_lib/utils.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendResponse(res, 405, { error: 'Method not allowed' });
    }

    // Fetch songs, play counts, and ratings in parallel
    const [songs, plays, ratings] = await Promise.all([
      supabaseRestFetch('/songs?select=id,title&order=created_at.desc', { method: 'GET' }),
      supabaseRestFetch('/plays?select=song_id,played_at', { method: 'GET' }),
      supabaseRestFetch('/ratings?select=song_id,likes,dislikes', { method: 'GET' }),
    ]);

    const songList = Array.isArray(songs) ? songs : [];
    const playList = Array.isArray(plays) ? plays : [];
    const ratingList = Array.isArray(ratings) ? ratings : [];

    // Play counts per song
    const playCounts = {};
    for (const p of playList) {
      playCounts[p.song_id] = (playCounts[p.song_id] || 0) + 1;
    }

    // Ratings per song
    const ratingMap = {};
    for (const r of ratingList) {
      ratingMap[r.song_id] = { likes: r.likes || 0, dislikes: r.dislikes || 0 };
    }

    // Plays over time — bucket by day (last 30 days)
    const now = Date.now();
    const DAY = 86400000;
    const dayBuckets = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = d.toISOString().slice(0, 10);
      dayBuckets[key] = 0;
    }
    for (const p of playList) {
      const key = new Date(p.played_at).toISOString().slice(0, 10);
      if (key in dayBuckets) dayBuckets[key]++;
    }

    // Build per-song stats
    const stats = songList.map((song) => ({
      id: song.id,
      title: song.title || 'Untitled',
      plays: playCounts[song.id] || 0,
      likes: ratingMap[song.id]?.likes || 0,
      dislikes: ratingMap[song.id]?.dislikes || 0,
    }));

    return sendResponse(res, 200, {
      stats,
      timeline: Object.entries(dayBuckets).map(([date, count]) => ({ date, count })),
      totals: {
        plays: playList.length,
        likes: ratingList.reduce((s, r) => s + (r.likes || 0), 0),
        songs: songList.length,
      },
    });
  } catch (err) {
    const status = err?.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    return sendResponse(res, status, { error: err?.message || 'Server error' });
  }
}