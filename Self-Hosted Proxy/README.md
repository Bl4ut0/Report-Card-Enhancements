# Self-Hosted Proxy (VPS & Local Home-Server)

This folder contains the configurations and source code needed to deploy the Warcraft Logs (WCL) Proxy and Discord Webhook Relay as a self-hosted container stack. 

Both the public VPS track and the home-hosted local proxy track run using the same unified container image (`bl4ut0/rce-proxy:latest`).

---

## 📦 Deployment Options

Select the deployment model that best fits your environment:

### Option A: Public VPS Deployment (with Caddy & SSL)

This option runs on a Linux VPS with a public IP. It includes a **Caddy** sidecar container that automatically obtains and renews Let's Encrypt SSL certificates for your custom domain.

1. Copy this entire `Self-Hosted Proxy/` folder to your VPS.
2. Rename `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your settings:
   ```bash
   DOMAIN=proxy.yourdomain.com
   WCL_PROXY_SECRET=your_long_wcl_secret_here
   DISCORD_PROXY_SECRET=your_long_discord_secret_here
   ```
4. Start the stack (referencing the VPS compose file):
   ```bash
   docker compose -f docker-compose.vps.yml up -d
   ```
   Caddy will automatically fetch SSL certificates for `proxy.yourdomain.com` and forward traffic to the proxy container on port `4040`.

---

### Option B: Local Home-Server Deployment (behind NPMPlus & CF Worker Relay)

This option runs locally on your home server or NAS behind your own reverse proxy (like **Nginx Proxy Manager Plus / NPMPlus**). A public **Cloudflare Worker** acts as a secure relay, hiding your home network's external IP address.

1. Copy this entire `Self-Hosted Proxy/` folder to your local server.
2. Rename `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and configure your secrets:
   ```bash
   WCL_PROXY_SECRET=your_long_wcl_secret_here
   DISCORD_PROXY_SECRET=your_long_discord_secret_here
   ```
4. Start the container:
   ```bash
   docker compose up -d
   ```
   The container will run on port `4040` of your Docker host.
5. **NPMPlus Configuration**: Point a subdomain (e.g., `wclproxy.yourdomain.com`) to your Docker host IP on port `4040` with **Force SSL** and HTTP/2. Keep it proxied (**Orange Cloud enabled**) in your Cloudflare DNS dashboard to hide your home IP.
6. **Configure Worker Relay**: In your Cloudflare Worker environment variables, add `BACKEND_URL` and set its value to your NPMPlus domain: `https://wclproxy.yourdomain.com`.

---

## ⚙️ Environment Variables Configuration

The following variables can be adjusted in your `.env` configuration file:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4040` | The port the Node.js server listens on inside the container. |
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

## 📝 Google Apps Script Integration

Add the following parameters to your Google Sheet **Script Properties**:

* `WCL_PROXY_URL`: `https://YOUR_DOMAIN_OR_WORKER_URL/wcl`
* `WCL_PROXY_SECRET`: *(The secret you configured in WCL_PROXY_SECRET)*
* `DISCORD_PROXY_URL`: `https://YOUR_DOMAIN_OR_WORKER_URL/discord`
* `DISCORD_PROXY_SECRET`: *(The secret you configured in DISCORD_PROXY_SECRET)*

---

## 🔍 Verification

Test the container's health by making a request to the `/healthz` endpoint:
```bash
curl http://localhost:4040/healthz
```
It should return a `200 OK` JSON detailing active queues and caching statistics:
```json
{"status":"ok","queues":{"v1":{"active":0,"pending":0,"maxConcurrent":1,"launchSpacingMs":300},"v2":{"active":0,"pending":0,"maxConcurrent":4,"launchSpacingMs":0}},"cacheEntries":0}
```
