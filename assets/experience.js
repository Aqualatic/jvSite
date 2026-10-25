import { DEMO_SONGS } from './demo/catalog.js';

const STORAGE_KEY = 'jvhub.demo.v1';
const SONG_IDS = new Set(DEMO_SONGS.map(song => song.id));

export function audienceForPath(pathname) {
  return /^\/jvhub\/?$/.test(pathname) ? 'friends' : 'demo';
}

function emptyState() {
  return { ratings: {}, comments: {}, plays: [] };
}

function demoAnalytics(state) {
  const stats = DEMO_SONGS.map(song => ({
    id: song.id,
    title: song.title,
    plays: state.plays.filter(play => play.song_id === song.id).length,
    likes: state.ratings[song.id]?.likes || 0,
    dislikes: state.ratings[song.id]?.dislikes || 0,
  }));
  const timeline = [];
  for (let day = 29; day >= 0; day--) {
    const date = new Date(Date.now() - day * 86400000).toISOString().slice(0, 10);
    timeline.push({ date, count: state.plays.filter(play => play.played_at.slice(0, 10) === date).length });
  }
  return {
    stats,
    timeline,
    totals: {
      songs: stats.length,
      plays: stats.reduce((sum, song) => sum + song.plays, 0),
      likes: stats.reduce((sum, song) => sum + song.likes, 0),
    },
  };
}

// Both URLs use the same UI. Only the friends version calls the live APIs.
export function createExperience(pathname, storage) {
  const audience = audienceForPath(pathname);
  let state = emptyState();

  function readState() {
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.ratings && saved.comments && Array.isArray(saved.plays)) state = saved;
    } catch { /* Storage can be unavailable; keep an in-memory demo. */ }
    return state;
  }

  function saveState(next) {
    if (storage) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
      catch { throw new Error('Demo storage is full. Try posting without an image.'); }
    }
    state = next;
  }

  return {
    audience,
    isDemo: audience === 'demo',
    basePath: audience === 'friends' ? '/jvhub' : '/',
    async request(url, options, remoteFetch) {
      const parsed = new URL(url, 'https://jvhub.local');
      if (audience === 'friends') {
        parsed.searchParams.set('audience', 'friends');
        return remoteFetch(parsed.pathname + parsed.search, options);
      }

      const method = options?.method || 'GET';
      const body = options?.body ? JSON.parse(options.body) : {};
      const songId = parsed.searchParams.get('song_id') || body.song_id;
      const current = readState();

      if (parsed.pathname === '/api/songs' && method === 'GET') return { songs: DEMO_SONGS };
      if (parsed.pathname === '/api/analytics' && method === 'GET') return demoAnalytics(current);
      if (parsed.pathname === '/api/upload' && method === 'POST') {
        if (!/^data:image\/(jpeg|png|gif|webp);base64,[a-z0-9+/=]+$/i.test(body.dataUrl || '')) {
          throw new Error('Choose a JPEG, PNG, GIF, or WebP image.');
        }
        if (body.dataUrl.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 + 64) {
          throw new Error('Image must be under 5 MB.');
        }
        return { ok: true, url: body.dataUrl };
      }
      if (!SONG_IDS.has(songId)) throw new Error('This track is not in the demo library.');

      if (parsed.pathname === '/api/ratings') {
        const rating = current.ratings[songId] || { likes: 0, dislikes: 0 };
        if (method === 'GET') return rating;
        if (method === 'POST') {
          const delta = value => value === 1 || value === -1 ? value : 0;
          const updated = {
            likes: Math.max(0, rating.likes + delta(body.likeDelta)),
            dislikes: Math.max(0, rating.dislikes + delta(body.dislikeDelta)),
          };
          saveState({ ...current, ratings: { ...current.ratings, [songId]: updated } });
          return { ok: true, ...updated };
        }
      }
      if (parsed.pathname === '/api/comments') {
        const comments = current.comments[songId] || [];
        if (method === 'GET') return { comments };
        if (method === 'POST') {
          const comment = {
            author: String(body.author || '').trim().slice(0, 30),
            body: String(body.body || '').trim().slice(0, 500),
            image_url: body.image_url || null,
            timestamp_seconds: body.timestamp_seconds != null && Number.isFinite(Number(body.timestamp_seconds))
              ? Math.max(0, Math.floor(Number(body.timestamp_seconds))) : null,
            created_at: new Date().toISOString(),
          };
          if (!comment.author || !comment.body) throw new Error('Enter your name and a comment.');
          saveState({ ...current, comments: { ...current.comments, [songId]: [comment, ...comments].slice(0, 100) } });
          return { ok: true, comment };
        }
      }
      if (parsed.pathname === '/api/plays' && method === 'POST') {
        saveState({ ...current, plays: [...current.plays, { song_id: songId, played_at: new Date().toISOString() }] });
        return { ok: true };
      }
      throw new Error('Unsupported demo request.');
    },
  };
}
