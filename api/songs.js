import fs from 'fs/promises';
import path from 'path';

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
</svg>`)}`
  .replace(/%0A/g, '');

const SONG_OVERRIDES = {
  'alliwant.mp3': {
    id: 'alliwant',
    title: 'All I Want For Christmas Is You - Cover',
    coverSrc: 'media/alliwant.png',
  },
  'diewa.mp3': { 
    id: 'diewa', 
    title: 'Die with a Smile - The Cover', 
    coverSrc: 'media/dwa.png' },
  'trt.mp3': { 
    id: 'trt', 
    title: 'Temu Rose Toy - KLICKAUD', 
    coverSrc: 'media/trt.png' },
  'trtp.mp3': {
    id: 'trtp',
    title: 'Temu Rose Toy - Performative Remix',
    coverSrc: 'media/per.png',
  },
  'Arabian_Nights_Cover_KLICKAUD.mp3': {
    id: 'arabian',
    title: 'Arabian Nights - Cover',
    coverSrc: 'media/arabian.png',
  },
  'Falling_For_Ya_Cover_KLICKAUD.mp3': {
    id: 'falling',
    title: 'Falling For Ya - Cover',
    coverSrc: 'media/fallin.png',
  },
  'How_Far_Ill_Go_Cover_KLICKAUD.mp3': {
    id: 'howfar',
    title: "How Far I'll Go - Cover",
    coverSrc: 'media/howfar.png',
  },
  'Part_Of_Your_World_Cover_KLICKAUD.mp3': {
    id: 'partofworld',
    title: 'Part Of Your World - Cover',
    coverSrc: 'media/part.png',
  },
  'Poor_Unfortunate_Souls_KLICKAUD.mp3': {
    id: 'poor',
    title: 'Poor Unfortunate Souls',
    coverSrc: 'media/poor.png',
  },
  'Queen_of_Mean_Cover_KLICKAUD.mp3': {
    id: 'queen',
    title: 'Queen of Mean - Cover',
    coverSrc: 'media/queen.png',
  },
  'Shes_So_Gone_Cover_KLICKAUD.mp3': {
    id: 'shesogone',
    title: "She's So Gone - Cover",
    coverSrc: 'media/shes.png',
  },
  'Yikes_KLICKAUD.mp3': { id: 'yikes', title: 'Yikes', coverSrc: 'media/yikes.png' },
};

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  try {
    // Get all files from media directory
    const mediaDir = path.join(process.cwd(), 'media');
    const files = await fs.readdir(mediaDir);
    
    // Filter for audio files and their corresponding images
    const audioFiles = files.filter(file => 
      file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a')
    );
    
    const imageFiles = files.filter(file => 
      file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.webp')
    );
    
    const imageMeta = imageFiles.map((img) => {
      const base = img.replace(/\.(png|jpg|jpeg|webp)$/i, '');
      return { img, base, norm: normalizeName(base) };
    });

    const audioEntries = await Promise.all(
      audioFiles.map(async (audioFile) => {
        const stat = await fs.stat(path.join(mediaDir, audioFile));
        return { audioFile, stat };
      }),
    );

    // Sort by modification time (newest first)
    audioEntries.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    // Create song objects (with optional hand-tuned overrides)
    const songs = audioEntries.map(({ audioFile }) => {
      const override = SONG_OVERRIDES[audioFile];
      const baseName = audioFile.replace(/\.(mp3|wav|m4a)$/i, '');

      const audioSrc = `media/${audioFile}`;

      if (override) {
        return {
          id: override.id,
          title: override.title,
          audioSrc,
          coverSrc: override.coverSrc || DEFAULT_COVER_SVG,
          filename: audioFile,
        };
      }

      // Generate title from filename
      let title = baseName.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      title = title.replace(/_Cover_KLICKAUD/i, '').replace(/_KLICKAUD/i, '').replace(/KLICKAUD/i, '').trim();

      const normAudio = normalizeName(baseName);
      const best = imageMeta.find((m) => m.norm && (normAudio.includes(m.norm) || m.norm.includes(normAudio)));
      const coverSrc = best ? `media/${best.img}` : DEFAULT_COVER_SVG;

      return {
        id: baseName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        title: title || audioFile,
        audioSrc,
        coverSrc,
        filename: audioFile,
      };
    });
    
    res.status(200).json({ songs });
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
}