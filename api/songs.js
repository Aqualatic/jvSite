import { supabaseRestFetch } from './_lib/supabaseRest.js';

const DEFAULT_COVER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#111"/>
      <stop offset="1" stop-color="#2a2a2a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="monospace" font-size="56" fill="#777">JVHub</text>
</svg>`)}`.replace(/%0A/g, '');

const BUCKET = 'media'; // your bucket name here

function getPublicUrl(subfolder, filename) {
  if (!filename) return null;
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${subfolder}/${filename}`;
}

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