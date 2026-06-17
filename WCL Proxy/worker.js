/**
 * Warcraft Logs API Proxy Worker for CLA/RPB.
 *
 * Required Worker secret:
 *   WCL_PROXY_SECRET
 *
 * Apps Script sends:
 *   x-wcl-proxy-secret: YOUR_PROXY_SECRET
 *
 * Optional Worker vars:
 *   WCL_PROXY_MAX_RETRIES=2
 *   WCL_PROXY_MAX_BACKOFF_MS=10000
 *   WCL_PROXY_CACHE_TTL_SECONDS=0
 */

const ALLOWED_HOSTS = new Set([
  'classic.warcraftlogs.com',
  'www.warcraftlogs.com',
]);

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // If BACKEND_URL is configured, the worker acts as a secure relay/forwarder to a self-hosted instance.
    // This allows hiding the home IP address / reverse proxy domain from the Google Sheets client.
    if (env.BACKEND_URL) {
      const backendUrl = new URL(env.BACKEND_URL);
      const targetUrl = new URL(url.pathname + url.search, backendUrl);

      const headers = new Headers(request.headers);
      const fetchOpts = {
        method: request.method,
        headers: headers
      };
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
        fetchOpts.body = request.body;
      }

      try {
        return await fetch(targetUrl.toString(), fetchOpts);
      } catch (err) {
        return new Response(`Worker Relay Error: Failed to forward request to backend: ${err.message}`, {
          status: 502,
          headers: {
            'x-wcl-proxy-relayed': 'true',
            'x-wcl-proxy-runtime': 'cloudflare-worker'
          }
        });
      }
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const receivedSecret = request.headers.get('x-wcl-proxy-secret') || '';
    if (env.WCL_PROXY_SECRET && receivedSecret !== env.WCL_PROXY_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    let envelope;
    try {
      envelope = await request.json();
    } catch (err) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const validation = validateEnvelope(envelope);
    if (!validation.ok) {
      return new Response(validation.error, { status: validation.status });
    }

    const maxRetries = parsePositiveInteger(env.WCL_PROXY_MAX_RETRIES, 2);
    const maxBackoffMs = parsePositiveInteger(env.WCL_PROXY_MAX_BACKOFF_MS, 10000);
    const cacheTtlSeconds = parsePositiveInteger(env.WCL_PROXY_CACHE_TTL_SECONDS, 0);
    const staleTtlSeconds = parsePositiveInteger(env.WCL_PROXY_STALE_TTL_SECONDS, 86400);

    const targetRequest = buildTargetRequest(envelope);

    let cacheKey = null;
    let cachedResponse = null;
    let isFresh = false;

    if (cacheTtlSeconds > 0) {
      try {
        cacheKey = await getCacheKey(envelope, targetRequest);
        if (cacheKey && typeof caches !== 'undefined' && caches.default) {
          const matched = await caches.default.match(cacheKey);
          if (matched) {
            cachedResponse = matched;
            const cachedAt = Number.parseInt(matched.headers.get('x-wcl-proxy-cached-at') || '0', 10);
            const ageMs = Date.now() - cachedAt;
            if (ageMs < cacheTtlSeconds * 1000) {
              isFresh = true;
            }
          }
        }
      } catch (err) {
        console.warn('Cache match error:', err);
      }
    }

    if (isFresh && cachedResponse) {
      return withProxyHeaders(cachedResponse, 1, 'hit');
    }

    let response;
    let attempts = 0;
    let fetchError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts = attempt + 1;
      try {
        response = await fetch(targetRequest.clone());

        if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) {
          break;
        }

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          if (retryAfterHeader) {
            const parsedDelayMs = parseRetryAfterHeaderToMs(retryAfterHeader);
            if (parsedDelayMs > maxBackoffMs) {
              // The server wants us to wait longer than our maximum backoff window.
              // Retrying now is guaranteed to be too early and will spam/reinforce the ban.
              break;
            }
          } else {
            // 429 without a retry-after header should not be retried to avoid hammering.
            break;
          }
        }

        const retryAfterMs = getRetryAfterMs(response.headers.get('retry-after'), maxBackoffMs);
        await sleep(retryAfterMs || Math.min(1000 * Math.pow(2, attempt), maxBackoffMs));
      } catch (err) {
        fetchError = err;
        if (attempt === maxRetries) {
          break;
        }
        await sleep(Math.min(1000 * Math.pow(2, attempt), maxBackoffMs));
      }
    }

    const isUpstreamError = !response || !response.ok;
    if (isUpstreamError && cachedResponse) {
      const fallbackResponse = withProxyHeaders(cachedResponse, attempts, 'fallback');
      if (!response && fetchError) {
        fallbackResponse.headers.set('x-wcl-proxy-fallback-reason', fetchError.message || 'fetch_error');
      } else if (response) {
        fallbackResponse.headers.set('x-wcl-proxy-fallback-reason', `status_${response.status}`);
      }
      return fallbackResponse;
    }

    if (!response) {
      return new Response(`Upstream Fetch Error: ${fetchError?.message || 'Unknown error'}`, {
        status: 502,
        headers: {
          'x-wcl-proxy-attempts': attempts.toString(),
          'x-wcl-proxy-cache': 'miss',
        }
      });
    }

    if (cacheTtlSeconds > 0 && cacheKey && response.ok) {
      try {
        if (typeof caches !== 'undefined' && caches.default) {
          const responseText = await response.clone().text();
          const cachedHeaders = new Headers(response.headers);
          cachedHeaders.set('x-wcl-proxy-cached-at', Date.now().toString());
          cachedHeaders.set('cache-control', `public, max-age=${staleTtlSeconds}`);

          const cacheableResponse = new Response(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: cachedHeaders,
          });

          await caches.default.put(cacheKey, cacheableResponse);
        }
      } catch (err) {
        console.warn('Cache write error:', err);
      }
    }

    return withProxyHeaders(response, attempts, 'miss');
  },
};

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, status: 400, error: 'Invalid proxy envelope' };
  }

  if (!envelope.url || typeof envelope.url !== 'string') {
    return { ok: false, status: 400, error: 'Missing url' };
  }

  let targetUrl;
  try {
    targetUrl = new URL(envelope.url);
  } catch (err) {
    return { ok: false, status: 400, error: 'Invalid target URL' };
  }

  if (targetUrl.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'Target must use HTTPS' };
  }

  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return { ok: false, status: 400, error: 'Target host is not allowed' };
  }

  const method = (envelope.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return { ok: false, status: 405, error: 'Target method is not allowed' };
  }

  if (targetUrl.hostname === 'classic.warcraftlogs.com' && !targetUrl.pathname.startsWith('/v1/')) {
    return { ok: false, status: 400, error: 'Classic target path is not allowed' };
  }

  if (targetUrl.hostname === 'www.warcraftlogs.com') {
    const allowedV2Path = targetUrl.pathname === '/api/v2/client';
    const allowedTokenPath = targetUrl.pathname === '/oauth/token';
    if (!allowedV2Path && !allowedTokenPath) {
      return { ok: false, status: 400, error: 'Warcraft Logs target path is not allowed' };
    }
  }

  return { ok: true };
}

function buildTargetRequest(envelope) {
  const method = (envelope.method || 'GET').toUpperCase();
  const headers = new Headers();
  const inputHeaders = envelope.headers || {};

  copyAllowedHeader(headers, inputHeaders, 'accept');
  copyAllowedHeader(headers, inputHeaders, 'authorization');
  copyAllowedHeader(headers, inputHeaders, 'content-type');

  headers.set('user-agent', 'CLA-RPB-WCL-Proxy/1.0');

  const init = {
    method,
    headers,
  };

  if (method === 'POST' && envelope.body !== undefined) {
    init.body = typeof envelope.body === 'string' ? envelope.body : JSON.stringify(envelope.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new Request(envelope.url, init);
}

function copyAllowedHeader(headers, inputHeaders, name) {
  const targetLower = name.toLowerCase();
  for (const key of Object.keys(inputHeaders)) {
    if (key.toLowerCase() === targetLower) {
      headers.set(name, inputHeaders[key]);
      return;
    }
  }
}

function withProxyHeaders(response, attempts, cacheStatus) {
  const headers = new Headers(response.headers);
  headers.set('x-wcl-proxy-attempts', attempts.toString());
  headers.set('x-wcl-proxy-cache', cacheStatus);

  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function getCacheKey(envelope, targetRequest) {
  const method = targetRequest.method;
  if (method !== 'GET' && method !== 'POST') {
    return null;
  }

  const targetUrl = new URL(targetRequest.url);
  if (targetUrl.pathname === '/oauth/token') {
    return null;
  }

  let cacheUrlStr = targetRequest.url;
  if (method === 'POST') {
    const bodyStr = envelope.body ? (typeof envelope.body === 'string' ? envelope.body : JSON.stringify(envelope.body)) : '';
    const bodyHash = await sha256(bodyStr);
    
    const authHeader = targetRequest.headers.get('authorization') || '';
    const authHash = authHeader ? await sha256(authHeader) : 'none';

    cacheUrlStr = `${targetRequest.url}?body_hash=${bodyHash}&auth_hash=${authHash}`;
  }

  return new Request(cacheUrlStr, { method: 'GET' });
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseRetryAfterHeaderToMs(retryAfter) {
  if (!retryAfter) {
    return 0;
  }

  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) {
    return Math.max(retryAt - Date.now(), 0);
  }

  return 0;
}

function getRetryAfterMs(retryAfter, maxBackoffMs) {
  if (!retryAfter) {
    return 0;
  }

  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.min(seconds * 1000, maxBackoffMs);
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) {
    return Math.min(Math.max(retryAt - Date.now(), 0), maxBackoffMs);
  }

  return 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

