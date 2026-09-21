// api/_supabase.js
// Server-side Supabase REST helper.
// Required Vercel env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Never expose the service-role key in index.html.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureEnv() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables."
    );
  }
}

async function supabaseRest(path, options = {}) {
  ensureEnv();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }

  if (!response.ok) {
    const detail =
      typeof body === "object"
        ? body?.message || body?.details || JSON.stringify(body)
        : String(body || response.statusText);

    throw new Error(`Supabase error ${response.status}: ${detail}`);
  }

  return body;
}

module.exports = { supabaseRest };
