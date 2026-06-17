require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = parseIntegerEnv('PORT', 3000, 1);

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));

// Configuration
const WCL_PROXY_SECRET = process.env.WCL_PROXY_SECRET || '';
const DISCORD_PROXY_SECRET = process.env.DISCORD_PROXY_SECRET || '';
const WCL_PROXY_MAX_RETRIES = parseIntegerEnv('WCL_PROXY_MAX_RETRIES', 2, 0);
const WCL_PROXY_MAX_BACKOFF_MS = parseIntegerEnv('WCL_PROXY_MAX_BACKOFF_MS', 15000, 0);
const WCL_PROXY_REQUEST_TIMEOUT_MS = parseIntegerEnv('WCL_PROXY_REQUEST_TIMEOUT_MS', 60000, 1000);
const WCL_PROXY_CACHE_TTL_SECONDS = parseIntegerEnv('WCL_PROXY_CACHE_TTL_SECONDS', 300, 0);
const WCL_PROXY_STALE_TTL_SECONDS = parseIntegerEnv('WCL_PROXY_STALE_TTL_SECONDS', 86400, 0);
const WCL_MAX_CONCURRENT = parseIntegerEnv('WCL_MAX_CONCURRENT', 1, 1);
const WCL_LAUNCH_SPACING_MS = parseIntegerEnv('WCL_LAUNCH_SPACING_MS', 300, 0);
const WCL_V2_MAX_CONCURRENT = parseIntegerEnv('WCL_V2_MAX_CONCURRENT', 4, 1);
const WCL_V2_LAUNCH_SPACING_MS = parseIntegerEnv('WCL_V2_LAUNCH_SPACING_MS', 0, 0);
const DISCORD_QUEUE_INTERVAL_MS = parseIntegerEnv('DISCORD_QUEUE_INTERVAL_MS', 500, 0);
const DISCORD_REQUEST_TIMEOUT_MS = parseIntegerEnv('DISCORD_REQUEST_TIMEOUT_MS', 30000, 1000);

const ALLOWED_HOSTS = new Set([
  'classic.warcraftlogs.com',
  'www.warcraftlogs.com',
]);
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Local in-memory caches
const cacheStore = new Map(); // key -> { body, headers, cachedAt }
let discordLastRequestTime = 0;

// Helper: Sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseIntegerEnv(name, fallback, minimum) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsedValue) || parsedValue < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }

  return parsedValue;
}

// Helper: SHA-256 Hash
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

class RequestQueue {
  constructor(name, maxConcurrent, launchSpacingMs) {
    this.name = name;
    this.maxConcurrent = maxConcurrent;
    this.launchSpacingMs = launchSpacingMs;
    this.active = 0;
    this.lastLaunchAt = 0;
    this.pending = [];
    this.launchTimer = null;
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    if (this.launchTimer || this.active >= this.maxConcurrent || this.pending.length === 0) {
      return;
    }

    const waitMs = Math.max(0, this.lastLaunchAt + this.launchSpacingMs - Date.now());
    if (waitMs > 0) {
      this.launchTimer = setTimeout(() => {
        this.launchTimer = null;
        this.drain();
      }, waitMs);
      return;
    }

    const entry = this.pending.shift();
    this.active++;
    this.lastLaunchAt = Date.now();

    Promise.resolve()
      .then(entry.task)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.active--;
        this.drain();
      });

    this.drain();
  }

  stats() {
    return {
      active: this.active,
      pending: this.pending.length,
      maxConcurrent: this.maxConcurrent,
      launchSpacingMs: this.launchSpacingMs,
    };
  }
}

const wclV1Queue = new RequestQueue('wcl-v1', WCL_MAX_CONCURRENT, WCL_LAUNCH_SPACING_MS);
const wclV2Queue = new RequestQueue('wcl-v2', WCL_V2_MAX_CONCURRENT, WCL_V2_LAUNCH_SPACING_MS);

function getWclQueue(parsedUrl) {
  return parsedUrl.pathname.startsWith('/api/v2/') ? wclV2Queue : wclV1Queue;
}

function getRetryAfterMs(response) {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function isIpRateLimit(response, responseText) {
  return response.status === 429 && /too many requests from this ip address/i.test(responseText);
}

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    queues: {
      v1: wclV1Queue.stats(),
      v2: wclV2Queue.stats(),
    },
    cacheEntries: cacheStore.size,
  });
});

/**
 * Discord Webhook Relay Endpoint
 */
app.post('/discord', async (req, res) => {
  const targetUrl = req.headers['x-discord-webhook'] || '';
  if (!targetUrl.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).send('Invalid Target Webhook URL');
  }

  const receivedSecret = req.headers['x-proxy-secret'] || '';
  if (DISCORD_PROXY_SECRET && receivedSecret !== DISCORD_PROXY_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  // Enforce rate limit delay between requests to Discord
  const now = Date.now();
  let delay = 0;
  if (discordLastRequestTime > 0 && (now - discordLastRequestTime) < DISCORD_QUEUE_INTERVAL_MS) {
    delay = DISCORD_QUEUE_INTERVAL_MS - (now - discordLastRequestTime);
  }
  discordLastRequestTime = (delay > 0 ? discordLastRequestTime + DISCORD_QUEUE_INTERVAL_MS : now);

  if (delay > 0) {
    await sleep(delay);
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
    });

    const responseBody = await response.text();
    res.status(response.status).set('Content-Type', response.headers.get('content-type') || 'text/plain').send(responseBody);
  } catch (error) {
    res.status(500).send(`Discord Webhook Relay Error: ${error.message}`);
  }
});

/**
 * Warcraft Logs API Proxy Endpoint
 */
app.post('/wcl', async (req, res) => {
  res.set('x-wcl-proxy-relayed', 'true');
  res.set('x-wcl-proxy-runtime', 'local-proxy');
  
  const receivedSecret = req.headers['x-wcl-proxy-secret'] || '';
  if (WCL_PROXY_SECRET && receivedSecret !== WCL_PROXY_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  const envelope = req.body;
  if (!envelope || !envelope.url || !envelope.method) {
    return res.status(400).send('Invalid Envelope Structure');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(envelope.url);
  } catch (e) {
    return res.status(400).send('Invalid Target URL');
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return res.status(403).send(`Forbidden Target Hostname: ${parsedUrl.hostname}`);
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.port) {
    return res.status(403).send('Warcraft Logs targets must use standard HTTPS');
  }

  const requestMethod = String(envelope.method).toUpperCase();
  if (requestMethod !== 'GET' && requestMethod !== 'POST') {
    return res.status(400).send(`Unsupported Target Method: ${requestMethod}`);
  }

  const wclQueue = getWclQueue(parsedUrl);
  res.set('x-wcl-proxy-api-version', wclQueue === wclV2Queue ? 'v2' : 'v1');

  // Generate Cache Key
  let cacheKey = null;
  if (WCL_PROXY_CACHE_TTL_SECONDS > 0) {
    const authHeader = envelope.headers ? (envelope.headers['Authorization'] || envelope.headers['authorization'] || '') : '';
    const bodyString = envelope.body ? (typeof envelope.body === 'string' ? envelope.body : JSON.stringify(envelope.body)) : '';
    const uniqueString = `${envelope.url}|${requestMethod}|${authHeader}|${bodyString}`;
    cacheKey = sha256(uniqueString);
  }

  // Cache Lookup
  if (cacheKey) {
    const cached = cacheStore.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.cachedAt;
      if (ageMs < WCL_PROXY_CACHE_TTL_SECONDS * 1000) {
        // Return fresh cache hit
        return res
          .status(200)
          .set(cached.headers)
          .set('x-wcl-proxy-cache', 'hit')
          .set('x-wcl-proxy-cached-at', cached.cachedAt.toString())
          .send(cached.body);
      }
    }
  }

  // Upstream Fetch Request Preparation
  const fetchHeaders = {};
  if (envelope.headers) {
    for (const [key, val] of Object.entries(envelope.headers)) {
      // Avoid forwarding Host/Connection issues
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
        fetchHeaders[key] = val;
      }
    }
  }

  const fetchOptions = {
    method: requestMethod,
    headers: fetchHeaders,
  };
  if (envelope.body) {
    fetchOptions.body = typeof envelope.body === 'string' ? envelope.body : JSON.stringify(envelope.body);
  }

  let attempt = 0;
  let delay = 1000;
  let response = null;
  let responseText = '';
  let lastError = null;

  while (attempt <= WCL_PROXY_MAX_RETRIES) {
    try {
      const upstreamResult = await wclQueue.run(async () => {
        const queuedResponse = await fetch(envelope.url, {
          ...fetchOptions,
          signal: AbortSignal.timeout(WCL_PROXY_REQUEST_TIMEOUT_MS),
        });
        const queuedResponseText = await queuedResponse.text();
        return { response: queuedResponse, responseText: queuedResponseText };
      });

      response = upstreamResult.response;
      responseText = upstreamResult.responseText;
      lastError = null;

      if (!RETRYABLE_STATUSES.has(response.status)) {
        break; // Non-retryable status code, exit loop
      }

      // Retrying an IP-level block without a server-provided wait only adds load.
      if (isIpRateLimit(response, responseText) && getRetryAfterMs(response) === null) {
        break;
      }
    } catch (error) {
      lastError = error;
      response = null;
    }

    attempt++;
    if (attempt <= WCL_PROXY_MAX_RETRIES) {
      const retryAfterMs = response ? getRetryAfterMs(response) : null;
      const exponentialBackoffMs = delay * Math.pow(2, attempt - 1) + Math.random() * 200;
      const sleepTime = retryAfterMs === null
        ? Math.min(exponentialBackoffMs, WCL_PROXY_MAX_BACKOFF_MS)
        : retryAfterMs;
      await sleep(sleepTime);
    }
  }

  // Handle Response/Failure
  if (response && response.status >= 200 && response.status < 300) {
    const responseHeaders = {
      'content-type': response.headers.get('content-type') || 'application/json',
    };

    // Store in cache if enabled
    if (cacheKey) {
      cacheStore.set(cacheKey, {
        body: responseText,
        headers: responseHeaders,
        cachedAt: Date.now(),
      });
    }

    return res
      .status(response.status)
      .set(responseHeaders)
      .set('x-wcl-proxy-cache', 'miss')
      .send(responseText);
  }

  // Fallback to Stale Cache on Failure (429/5xx or Network Error)
  if (cacheKey) {
    const cached = cacheStore.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.cachedAt;
      if (ageMs < WCL_PROXY_STALE_TTL_SECONDS * 1000) {
        return res
          .status(200)
          .set(cached.headers)
          .set('x-wcl-proxy-cache', 'fallback')
          .set('x-wcl-proxy-cached-at', cached.cachedAt.toString())
          .send(cached.body);
      }
    }
  }

  // If no fallback is available, return the error
  if (response) {
    return res
      .status(response.status)
      .set('Content-Type', response.headers.get('content-type') || 'text/plain')
      .send(responseText);
  }

  res.status(502).send(`Bad Gateway: ${lastError ? lastError.message : 'Upstream Request Failed'}`);
});

// Start Server
app.listen(PORT, () => {
  if (!WCL_PROXY_SECRET || !DISCORD_PROXY_SECRET) {
    console.warn('Warning: one or more proxy secrets are empty. Configure both secrets before exposing this service.');
  }

  console.log(`Local Proxy Server running on port ${PORT}`);
  console.log(`WCL V1 queue: concurrency=${WCL_MAX_CONCURRENT}, spacing=${WCL_LAUNCH_SPACING_MS}ms`);
  console.log(`WCL V2 queue: concurrency=${WCL_V2_MAX_CONCURRENT}, spacing=${WCL_V2_LAUNCH_SPACING_MS}ms`);
});
