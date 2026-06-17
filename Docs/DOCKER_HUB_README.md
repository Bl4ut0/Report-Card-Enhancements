# Warcraft Logs Proxy & Discord Webhook Relay Container (`rce-proxy`)

This unified container provides a self-hostable Warcraft Logs (WCL) API proxy and Discord Webhook relay for the **Report Card Enhancements** project. It intercepts queries from Google Sheets (Google Apps Script), manages request queues, caches query responses, handles retries, and relays Discord webhooks to prevent shared IP rate limit blocks.

Both the public VPS track and the home-hosted local proxy track run using this same Docker image.

---

## Deployment Options

Choose the deployment model that best fits your environment:

### Option A: Public VPS Deployment (with Caddy & SSL)

This option runs on a Linux VPS with a public IP. It includes a **Caddy** sidecar container that automatically obtains and renews Let's Encrypt SSL certificates for your custom domain.

1. **Copy Configuration**: Copy the `VPS Proxy/` folder from the repository to your VPS.
2. **Configure Environment**: Rename `.env.example` to `.env` and configure your credentials:
   ```bash
   DOMAIN=proxy.yourdomain.com
   WCL_PROXY_SECRET=your_wcl_secret_here
   DISCORD_PROXY_SECRET=your_discord_secret_here
   ```
3. **Launch the Stack**:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   Caddy will automatically fetch SSL certificates for `proxy.yourdomain.com` and forward traffic to the proxy container.

---

### Option B: Local Home-Server Deployment (behind NPMPlus & CF Worker Relay)

This option runs locally on a home server or NAS (using your residential IP address to bypass Cloudflare Worker shared IP limits) behind your own reverse proxy (e.g. **Nginx Proxy Manager Plus / NPMPlus**). A public **Cloudflare Worker** acts as a secure relay, hiding your home network's external IP address.

1. **Copy Configuration**: Copy the `Local Proxy/` folder from the repository to your home server.
2. **Configure Environment**: Rename `.env.example` to `.env` and configure your secrets:
   ```bash
   WCL_PROXY_SECRET=your_wcl_secret_here
   DISCORD_PROXY_SECRET=your_discord_secret_here
   ```
3. **Launch the Container**:
   ```bash
   docker compose up -d
   ```
   The container will run on port `3000`.
4. **NPMPlus Configuration**: Point a subdomain (e.g., `wclproxy.yourdomain.com`) to your Docker host IP on port `3000` with **Force SSL** and HTTP/2. Keep it proxied (**Orange Cloud enabled**) in your Cloudflare DNS dashboard to hide your home IP.
5. **Configure Worker Relay**: In your Cloudflare Worker environment variables, add `BACKEND_URL` and set its value to your NPMPlus domain: `https://wclproxy.yourdomain.com`.

---

## Environment Variables Configuration

The following variables can be adjusted in your `.env` configuration file:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | The port the Node.js server listens on inside the container. |
| `NODE_ENV` | `production` | The execution environment. |
| `WCL_PROXY_SECRET` | *(Required)* | Secret key required in request headers to authorize access to `/wcl`. |
| `DISCORD_PROXY_SECRET` | *(Required)* | Secret key required in request headers to authorize access to `/discord`. |
| `WCL_PROXY_MAX_RETRIES` | `2` | Number of retries for retryable WCL API failures (429, 502, 503, 504). |
| `WCL_PROXY_MAX_BACKOFF_MS` | `15000` | Maximum exponential backoff cap between retries. |
| `WCL_PROXY_REQUEST_TIMEOUT_MS` | `60000` | Timeout duration for WCL upstream requests. |
| `WCL_PROXY_CACHE_TTL_SECONDS` | `300` | Duration (in seconds) to cache WCL responses. Set to `0` to disable caching. |
| `WCL_PROXY_STALE_TTL_SECONDS` | `86400` | Maximum age to serve stale cached responses if the upstream API is failing. |
| `WCL_MAX_CONCURRENT` | `1` | Concurrency limit for WCL V1 REST API requests. |
| `WCL_LAUNCH_SPACING_MS` | `300` | Minimum spacing (in milliseconds) between V1 request launches. |
| `WCL_V2_MAX_CONCURRENT` | `4` | Concurrency limit for WCL V2 GraphQL API requests. |
| `WCL_V2_LAUNCH_SPACING_MS` | `0` | Minimum spacing (in milliseconds) between V2 request launches. |
| `DISCORD_QUEUE_INTERVAL_MS` | `500` | Minimum delay between forwarded Discord webhook requests. |
| `DISCORD_REQUEST_TIMEOUT_MS` | `30000` | Timeout duration for Discord webhook relay requests. |

---

## Google Apps Script Integration

Add the following parameters to your Google Sheet **Script Properties**:

* `WCL_PROXY_URL`: `https://YOUR_DOMAIN_OR_WORKER_URL/wcl`
* `WCL_PROXY_SECRET`: *(The secret you configured in WCL_PROXY_SECRET)*
* `DISCORD_PROXY_URL`: `https://YOUR_DOMAIN_OR_WORKER_URL/discord`
* `DISCORD_PROXY_SECRET`: *(The secret you configured in DISCORD_PROXY_SECRET)*

---

## Verification

Test the container's health by making a request to the `/healthz` endpoint:
```bash
curl http://localhost:3000/healthz
```
It should return a `200 OK` JSON detailing active queues and caching statistics:
```json
{"status":"ok","queues":{"v1":{"active":0,"pending":0,"maxConcurrent":1,"launchSpacingMs":300},"v2":{"active":0,"pending":0,"maxConcurrent":4,"launchSpacingMs":0}},"cacheEntries":0}
```
