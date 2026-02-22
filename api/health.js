import { sendResponse } from './_lib/utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendResponse(res, 405, { error: 'Method not allowed' });
  }

  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return sendResponse(res, 200, {
    ok: true,
    env: {
      SUPABASE_URL: hasUrl,
      SUPABASE_SERVICE_ROLE_KEY: hasServiceKey,
    },
  });
}

