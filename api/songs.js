import { supabaseRestFetch } from './_lib/supabaseRest.js';
import { getPublicUrl, DEFAULT_COVER_SVG } from './_lib/utils.js';

export default async function handler(req, res) {
  try {
    const rows = await supabaseRestFetch(
      '/songs?select=id,title,audio_path,artwork_path&order=created_at.desc',
      { method: 'GET' },
    );

    const songs = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      title: row.title,
      audioSrc: getPublicUrl('audio', row.audio_path),
      coverSrc: getPublicUrl('art', row.artwork_path) ?? DEFAULT_COVER_SVG,
    }));

    res.status(200).json({ songs });
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
}
