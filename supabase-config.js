// Supabase Configuration
// This file loads environment variables and exports Supabase configuration
// Uses lowercase environment variable names for Vercel compatibility

const getEnvVar = (name) => {
  // For client-side, check window object first (Vercel injects these)
  if (typeof window !== 'undefined') {
    return window.env && window.env[name] || process.env[name];
  }
  // For server-side or Node.js environments
  return process.env[name];
};

export const supabaseConfig = {
  supabaseUrl: getEnvVar('supabase_url'),
  supabaseAnonKey: getEnvVar('supabase_anon')
};

// Validate configuration
if (!supabaseConfig.supabaseUrl || !supabaseConfig.supabaseAnonKey) {
  console.warn('Supabase configuration not found. Please set supabase_url and supabase_anon environment variables.');
}

export default supabaseConfig;