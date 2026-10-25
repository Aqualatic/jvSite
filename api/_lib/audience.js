import { sendResponse } from './utils.js';

export function getAudience(req) {
  const audience = req.query?.audience
    ?? new URL(req.url || '/', 'http://localhost').searchParams.get('audience')
    ?? 'demo';
  if (audience !== 'demo' && audience !== 'friends') {
    const error = new Error('Invalid audience');
    error.statusCode = 400;
    throw error;
  }
  return audience;
}

export function requireFriendsAudience(req, res) {
  if (getAudience(req) === 'friends') return true;
  sendResponse(res, 400, { error: 'Demo activity is saved in your browser, not through the live API.' });
  return false;
}
