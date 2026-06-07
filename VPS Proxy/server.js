require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));

// Configuration (Defaults mirror Cloudflare Workers)
const WCL_PROXY_SECRET = process.env.WCL_PROXY_SECRET || '';
const DISCORD_PROXY_SECRET = process.env.DISCORD_PROXY_SECRET || '';
const WCL_PROXY_MAX_RETRIES = parseInt(process.env.WCL_PROXY_MAX_RETRIES || '2', 10);
const WCL_PROXY_MAX_BACKOFF_MS = parseInt(process.env.WCL_PROXY_MAX_BACKOFF_MS || '15000', 10);
const WCL_PROXY_CACHE_TTL_SECONDS = parseInt(process.env.WCL_PROXY_CACHE_TTL_SECONDS || '0', 10); // Set > 0 to enable
const WCL_PROXY_STALE_TTL_SECONDS = parseInt(process.env.WCL_PROXY_STALE_TTL_SECONDS || '86400', 10); // 24 hours fallback

const ALLOWED_HOSTS = new Set([
  'classic.warcraftlogs.com',
  'www.warcraftlogs.com',
]);
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

// Local in-memory caches
const cacheStore = new Map(); // key -> { body, headers, cachedAt }
let discordLastRequestTime = 0;
const DISCORD_QUEUE_INTERVAL_MS = 500;

// Helper: Sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: SHA-256 Hash
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

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

  // Generate Cache Key
  let cacheKey = null;
  if (WCL_PROXY_CACHE_TTL_SECONDS > 0) {
    const authHeader = envelope.headers ? (envelope.headers['Authorization'] || envelope.headers['authorization'] || '') : '';
    const bodyString = envelope.body ? (typeof envelope.body === 'string' ? envelope.body : JSON.stringify(envelope.body)) : '';
    const uniqueString = `${envelope.url}|${envelope.method}|${authHeader}|${bodyString}`;
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
    method: envelope.method,
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
      response = await fetch(envelope.url, fetchOptions);
      responseText = await response.text();
      lastError = null;

      if (!RETRYABLE_STATUSES.has(response.status)) {
        break; // Non-retryable status code, exit loop
      }
    } catch (error) {
      lastError = error;
      response = null;
    }

    attempt++;
    if (attempt <= WCL_PROXY_MAX_RETRIES) {
      // Backoff sleep (with jitter)
      const sleepTime = Math.min(delay * Math.pow(2, attempt - 1) + Math.random() * 200, WCL_PROXY_MAX_BACKOFF_MS);
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
  console.log(`VPS Proxy Server running on port ${PORT}`);
});
