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

    const targetRequest = buildTargetRequest(envelope);
    const cacheKey = new Request(targetRequest.url, { method: 'GET' });

    if (targetRequest.method === 'GET' && cacheTtlSeconds > 0) {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        return withProxyHeaders(cached, 1, true);
      }
    }

    let response;
    let attempts = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts = attempt + 1;
      response = await fetch(targetRequest.clone());

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) {
        break;
      }

      const retryAfterMs = getRetryAfterMs(response.headers.get('retry-after'), maxBackoffMs);
      await sleep(retryAfterMs || Math.min(1000 * Math.pow(2, attempt), maxBackoffMs));
    }

    if (targetRequest.method === 'GET' && cacheTtlSeconds > 0 && response.ok) {
      const cacheable = new Response(response.body, response);
      cacheable.headers.set('cache-control', 'public, max-age=' + cacheTtlSeconds);
      await caches.default.put(cacheKey, cacheable.clone());
      return withProxyHeaders(cacheable, attempts, false);
    }

    return withProxyHeaders(response, attempts, false);
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
  const value = inputHeaders[name] || inputHeaders[name.toLowerCase()] || inputHeaders[name.toUpperCase()];
  if (value) {
    headers.set(name, value);
  }
}

function withProxyHeaders(response, attempts, cacheHit) {
  const headers = new Headers(response.headers);
  headers.set('x-wcl-proxy-attempts', attempts.toString());
  headers.set('x-wcl-proxy-cache', cacheHit ? 'hit' : 'miss');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
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

