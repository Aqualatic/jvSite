import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { getPublicUrl, DEFAULT_COVER_SVG, sendResponse } from './_lib/utils.js';
import { getAudience } from './_lib/audience.js';
import { DEMO_SONGS } from '../assets/demo/catalog.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendResponse(res, 405, { error: 'Method not allowed' });
    }
    if (getAudience(req) === 'demo') return sendResponse(res, 200, { songs: DEMO_SONGS });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const isPrivate = url.searchParams.get('private') === 'true';

    let query = '/songs?select=id,title,audio_path,artwork_path&order=created_at.desc';
    
    if (isPrivate) {
      query += '&is_private=eq.true';
    } else {
      query += '&is_private=eq.false';
    }

    const rows = await supabaseRestFetch(query, { method: 'GET' });

    const songs = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      title: row.title,
      audioSrc: getPublicUrl('audio', row.audio_path),
      coverSrc: getPublicUrl('art', row.artwork_path) ?? DEFAULT_COVER_SVG,
    }));

    return sendResponse(res, 200, { songs });
  } catch (error) {
    console.error('Error fetching songs:', error);
    return sendResponse(res, error.statusCode || 500, { error: error.statusCode === 400 ? error.message : 'Failed to fetch songs' });
  }
}
