/**
 * Utility functions shared across API endpoints
 */

/**
 * Safely parse JSON body from request
 * @param {Object} req - Express request object
 * @returns {Object} Parsed body object
 */
export function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

/**
 * Validate and sanitize song ID
 * @param {string} songId - Song ID to validate
 * @returns {string|null} Validated song ID or null if invalid
 */
export function validateSongId(songId) {
  const id = String(songId || '').trim();
  if (!id) return null;
  if (id.length > 64) return null;
  if (!/^[a-z0-9_-]+$/i.test(id)) return null;
  return id;
}

/**
 * Get song ID from request query parameters
 * @param {Object} req - Express request object
 * @returns {string|null} Validated song ID or null if invalid
 */
export function getSongId(req) {
  return validateSongId(req.query?.song_id);
}

/**
 * Clamp text to maximum length
 * @param {string} text - Text to clamp
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Clamped text
 */
export function clampText(text, maxLength) {
  return String(text || '').trim().slice(0, maxLength);
}

/**
 * Clamp numeric delta to valid values (-1, 0, 1)
 * @param {number} delta - Delta value to clamp
 * @returns {number} Clamped delta (-1, 0, or 1)
 */
export function clampDelta(delta) {
  const n = Number(delta);
  if (n === 1) return 1;
  if (n === -1) return -1;
  return 0;
}

/**
 * Standardized response sender
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {Object} body - Response body
 */
export function sendResponse(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/**
 * Get public URL for Supabase storage objects
 * @param {string} subfolder - Storage subfolder
 * @param {string} filename - File name
 * @returns {string|null} Public URL or null if filename is empty
 */
export function getPublicUrl(subfolder, filename) {
  if (!filename) return null;
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/media/${subfolder}/${filename}`;
}

/**
 * Default SVG cover art for songs without artwork
 */
export const DEFAULT_COVER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
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