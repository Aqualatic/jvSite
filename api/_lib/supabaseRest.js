function requiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing environment variable: ${name}`);
    err.statusCode = 500;
    throw err;
  }
  return v;
}

export function getSupabaseRestConfig() {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return {
    restBaseUrl: `${supabaseUrl}/rest/v1`,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function supabaseRestFetch(path, init = {}) {
  const { restBaseUrl, headers } = getSupabaseRestConfig();

  const res = await fetch(`${restBaseUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const err = new Error(
      (data && (data.message || data.error)) || text || `Supabase REST error (${res.status})`,
    );
    err.statusCode = 500;
    err.details = data;
    throw err;
  }

  return data;
}

