export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return res.status(200).json({
    ok: true,
    env: {
      SUPABASE_URL: hasUrl,
      SUPABASE_SERVICE_ROLE_KEY: hasServiceKey,
    },
  });
}

