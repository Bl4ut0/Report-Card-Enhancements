/**
 * Combined Cloudflare Worker Proxy for CLA/RPB.
 * Combines both Discord Webhook Relay and Warcraft Logs API Proxy.
 *
 * Routing logic:
 *   - /discord (or x-discord-webhook header) -> Discord Webhook Relay
 *   - /wcl (or x-wcl-proxy-secret header)      -> Warcraft Logs Proxy
 */

const ALLOWED_HOSTS = new Set([
  'classic.warcraftlogs.com',
  'www.warcraftlogs.com',
]);

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Global in-memory queue states for the worker isolate
let wclActiveRequests = 0;
let wclLastLaunchTime = 0;
let discordLastRequestTime = 0;

// Configurable queue intervals
const DEFAULT_WCL_MAX_CONCURRENT = 5;
const DEFAULT_WCL_LAUNCH_SPACING_MS = 300;
const DEFAULT_WCL_V2_MAX_CONCURRENT = 15;
const DEFAULT_WCL_V2_LAUNCH_SPACING_MS = 0;
const DISCORD_QUEUE_INTERVAL_MS = 500;

/**
 * Helper to wait for a slot in the WCL queue while enforcing launch spacing
 */
async function acquireWclQueueSlot(maxConcurrent, spacingMs) {
  while (true) {
    const now = Date.now();
    
    // Check if we are under the concurrency limit
    if (wclActiveRequests < maxConcurrent) {
      // Check if we need to wait to satisfy the spacing interval
      const timeSinceLastLaunch = now - wclLastLaunchTime;
      if (timeSinceLastLaunch >= spacingMs) {
        // We can launch!
        wclActiveRequests++;
        wclLastLaunchTime = now;
        return;
      } else {
        // Need to wait out the remainder of the spacing interval
        const delay = spacingMs - timeSinceLastLaunch;
        await sleep(delay);
      }
    } else {
      // Concurrency limit reached, wait and check again
      await sleep(100);
    }
  }
}


/**
 * Helper to calculate and apply synchronous queue delay
 */
function getQueueDelay(lastRequestTimeRef, intervalMs) {
  const now = Date.now();
  let delay = 0;
  if (lastRequestTimeRef > 0 && (now - lastRequestTimeRef) < intervalMs) {
    delay = intervalMs - (now - lastRequestTimeRef);
  }
  const newLastRequestTime = (delay > 0 ? lastRequestTimeRef + intervalMs : now);
  return { delay, newLastRequestTime };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(request.url);

    // Route based on path or headers
    const isDiscord = url.pathname.startsWith('/discord') || request.headers.has('x-discord-webhook');
    const isWcl = url.pathname.startsWith('/wcl') || request.headers.has('x-wcl-proxy-secret');

    if (isDiscord) {
      return handleDiscordProxy(request, env);
    } else if (isWcl) {
      return handleWclProxy(request, env);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  },
};

/**
 * Discord Webhook Proxy logic
 */
async function handleDiscordProxy(request, env) {
  const targetUrl = request.headers.get('x-discord-webhook') || '';
  if (!targetUrl.startsWith('https://discord.com/api/webhooks/')) {
    return new Response('Invalid Target', { status: 400 });
  }

  const receivedSecret = request.headers.get('x-proxy-secret') || '';
  if (env.DISCORD_PROXY_SECRET && receivedSecret !== env.DISCORD_PROXY_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Apply Discord rate limit queue
  const queueState = getQueueDelay(discordLastRequestTime, DISCORD_QUEUE_INTERVAL_MS);
  discordLastRequestTime = queueState.newLastRequestTime;
  if (queueState.delay > 0) {
    await sleep(queueState.delay);
  }

  const discordResponse = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
    },
    body: request.body,
  });

  if (discordResponse.status === 204) {
    return new Response(null, { status: 204 });
  }

  return new Response(await discordResponse.text(), {
    status: discordResponse.status,
    headers: {
      'content-type': discordResponse.headers.get('content-type') || 'text/plain',
    },
  });
}

/**
 * Warcraft Logs API Proxy logic
 */
async function handleWclProxy(request, env) {
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

  const targetUrl = new URL(envelope.url);
  const isV2 = targetUrl.pathname === '/api/v2/client';

  const maxRetries = parsePositiveInteger(env.WCL_PROXY_MAX_RETRIES, 2);
  const maxBackoffMs = parsePositiveInteger(env.WCL_PROXY_MAX_BACKOFF_MS, 15000);
  const cacheTtlSeconds = parsePositiveInteger(env.WCL_PROXY_CACHE_TTL_SECONDS, 0);
  const staleTtlSeconds = parsePositiveInteger(env.WCL_PROXY_STALE_TTL_SECONDS, 86400);

  const defaultMaxConcurrent = isV2 ? DEFAULT_WCL_V2_MAX_CONCURRENT : DEFAULT_WCL_MAX_CONCURRENT;
  const defaultSpacingMs = isV2 ? DEFAULT_WCL_V2_LAUNCH_SPACING_MS : DEFAULT_WCL_LAUNCH_SPACING_MS;

  const maxConcurrent = parsePositiveInteger(isV2 ? env.WCL_V2_MAX_CONCURRENT : env.WCL_MAX_CONCURRENT, defaultMaxConcurrent);
  const spacingMs = parsePositiveInteger(isV2 ? env.WCL_V2_LAUNCH_SPACING_MS : env.WCL_LAUNCH_SPACING_MS, defaultSpacingMs);

  // Acquire queue slot
  await acquireWclQueueSlot(maxConcurrent, spacingMs);

  try {
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

        const retryAfterMs = getRetryAfterMs(response.headers.get('retry-after'), maxBackoffMs);
        await sleep(retryAfterMs || Math.min(3000 * Math.pow(2, attempt), maxBackoffMs));
      } catch (err) {
        fetchError = err;
        if (attempt === maxRetries) {
          break;
        }
        await sleep(Math.min(3000 * Math.pow(2, attempt), maxBackoffMs));
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
  } finally {
    wclActiveRequests--;
  }
}

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
