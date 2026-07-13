// Cloudflare Worker: receipt-OCR proxy for SpendShare.
//
// The browser can't call NVIDIA's API directly (no CORS), and we don't want the
// API key in the client bundle. This tiny Worker holds the key as a secret,
// forwards the chat/completions request to NVIDIA, and returns the response with
// CORS headers so the SpendShare PWA can read it.
//
// Deploy: see worker/README.md
//   wrangler secret put NVIDIA_API_KEY        (required)
//   wrangler secret put ALLOWED_ORIGINS       (recommended, comma-separated)

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

function parseAllowed(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowed) {
  // Echo the request origin when it's allowed (or when no allowlist is set).
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = parseAllowed(env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }
    if (allowed.length > 0 && !allowed.includes(origin)) {
      return new Response('Origin not allowed', { status: 403, headers: cors });
    }
    if (!env.NVIDIA_API_KEY) {
      return new Response(JSON.stringify({ error: 'Worker missing NVIDIA_API_KEY secret' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Forward the client's JSON body (model, messages) unchanged.
    const body = await request.text();
    let upstream;
    try {
      upstream = await fetch(NVIDIA_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
