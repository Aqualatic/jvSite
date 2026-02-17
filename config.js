export default function handler(req, res) {
  res.status(200).json({
    supabase_url:  process.env.supabase_url,
    supabase_anon: process.env.supabase_anon
  });
}