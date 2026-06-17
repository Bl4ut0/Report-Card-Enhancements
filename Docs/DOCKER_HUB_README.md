# Warcraft Logs Proxy & Discord Webhook Relay Container (`rce-proxy`)

This unified container provides a self-hostable Warcraft Logs (WCL) API proxy and Discord Webhook relay for the **Report Card Enhancements** project. It intercepts queries from Google Sheets (Google Apps Script), manages request queues, caches query responses, handles retries, and relays Discord webhooks to prevent shared IP rate limit blocks.

Both the public VPS track and the home-hosted local proxy track run using this same Docker image.

---

## ⚡ Quick CLI Start (Single-Command Deploy)

For a quick setup without a reverse proxy, you can run the container directly using `docker run`:

```bash
docker run -d \
  --name rce-proxy \
  --restart unless-stopped \
  -p 4040:4040 \
  -e WCL_PROXY_SECRET="your_long_wcl_secret_here" \
  -e DISCORD_PROXY_SECRET="your_long_discord_secret_here" \
  bl4ut0/rce-proxy:latest
```

The health check will be available locally at `http://localhost:4040/healthz`.

---

## 📦 Deployment Options

Select the deployment model that best fits your environment:

### Option A: Public VPS Deployment (with Caddy & SSL)

This option runs on a Linux VPS with a public IP. It includes a **Caddy** sidecar container that automatically obtains and renews Let's Encrypt SSL certificates for your custom domain.

1. Create a directory for your proxy deployment (e.g., `/home/username/wcl-proxy`).
2. Save the following **`docker-compose.yml`** to that directory:
   ```yaml
   services:
     app:
       image: bl4ut0/rce-proxy:latest
       restart: unless-stopped
       init: true
       environment:
         PORT: "4040"
         PROXY_RUNTIME: "vps"
         WCL_PROXY_SECRET: ${WCL_PROXY_SECRET:?Set WCL_PROXY_SECRET in .env}
         DISCORD_PROXY_SECRET: ${DISCORD_PROXY_SECRET:?Set DISCORD_PROXY_SECRET in .env}
         WCL_PROXY_MAX_RETRIES: ${WCL_PROXY_MAX_RETRIES:-2}
         WCL_PROXY_MAX_BACKOFF_MS: ${WCL_PROXY_MAX_BACKOFF_MS:-15000}
         WCL_PROXY_REQUEST_TIMEOUT_MS: ${WCL_PROXY_REQUEST_TIMEOUT_MS:-60000}
         WCL_PROXY_CACHE_TTL_SECONDS: ${WCL_PROXY_CACHE_TTL_SECONDS:-300}
         WCL_PROXY_STALE_TTL_SECONDS: ${WCL_PROXY_STALE_TTL_SECONDS:-86400}
         WCL_MAX_CONCURRENT: ${WCL_MAX_CONCURRENT:-1}
         WCL_LAUNCH_SPACING_MS: ${WCL_LAUNCH_SPACING_MS:-300}
         WCL_V2_MAX_CONCURRENT: ${WCL_V2_MAX_CONCURRENT:-4}
         WCL_V2_LAUNCH_SPACING_MS: ${WCL_V2_LAUNCH_SPACING_MS:-0}
         DISCORD_QUEUE_INTERVAL_MS: ${DISCORD_QUEUE_INTERVAL_MS:-500}
         DISCORD_REQUEST_TIMEOUT_MS: ${DISCORD_REQUEST_TIMEOUT_MS:-30000}
       expose:
         - "4040"
       healthcheck:
         test:
           - CMD
           - node
           - -e
           - fetch('http://127.0.0.1:4040/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 10s
       read_only: true
       tmpfs:
         - /tmp
       security_opt:
         - no-new-privileges:true
       cap_drop:
         - ALL
       logging:
         options:
           max-size: 10m
           max-file: "3"
       networks:
         - proxy-net

     caddy:
       image: caddy:2-alpine
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
         - "443:443/udp"
       environment:
         DOMAIN: ${DOMAIN:?Set DOMAIN in .env}
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         app:
           condition: service_healthy
       security_opt:
         - no-new-privileges:true
       logging:
         options:
           max-size: 10m
           max-file: "3"
       networks:
         - proxy-net

   volumes:
     caddy_data:
     caddy_config:

   networks:
     proxy-net:
       driver: bridge
   ```
3. Save the following **`Caddyfile`** to the same directory:
   ```caddy
   {$DOMAIN} {
       encode zstd gzip
       reverse_proxy app:4040

       log {
           output stdout
           format console
       }
   }
   ```
4. Create a **`.env`** file to supply your settings:
   ```bash
   DOMAIN=proxy.yourdomain.com
   WCL_PROXY_SECRET=your_long_wcl_secret_here
   DISCORD_PROXY_SECRET=your_long_discord_secret_here
   ```
5. Deploy:
   ```bash
   docker compose up -d
   ```

---

### Option B: Local Home-Server Deployment (behind NPMPlus & CF Worker Relay)

This option runs locally on your home server or NAS behind your own reverse proxy (like **Nginx Proxy Manager Plus / NPMPlus**). A public **Cloudflare Worker** acts as a secure relay, hiding your home network's external IP address.

1. Create a directory on your local server (e.g., `/home/username/wcl-proxy`).
2. Save the following **`docker-compose.yml`** to that directory:
   ```yaml
   services:
     app:
       image: bl4ut0/rce-proxy:latest
       restart: unless-stopped
       init: true
       environment:
         PORT: "4040"
         PROXY_RUNTIME: "local-proxy"
         WCL_PROXY_SECRET: ${WCL_PROXY_SECRET:?Set WCL_PROXY_SECRET in .env}
         DISCORD_PROXY_SECRET: ${DISCORD_PROXY_SECRET:?Set DISCORD_PROXY_SECRET in .env}
         WCL_PROXY_MAX_RETRIES: ${WCL_PROXY_MAX_RETRIES:-2}
         WCL_PROXY_MAX_BACKOFF_MS: ${WCL_PROXY_MAX_BACKOFF_MS:-15000}
         WCL_PROXY_REQUEST_TIMEOUT_MS: ${WCL_PROXY_REQUEST_TIMEOUT_MS:-60000}
         WCL_PROXY_CACHE_TTL_SECONDS: ${WCL_PROXY_CACHE_TTL_SECONDS:-300}
         WCL_PROXY_STALE_TTL_SECONDS: ${WCL_PROXY_STALE_TTL_SECONDS:-86400}
         WCL_MAX_CONCURRENT: ${WCL_MAX_CONCURRENT:-1}
         WCL_LAUNCH_SPACING_MS: ${WCL_LAUNCH_SPACING_MS:-300}
         WCL_V2_MAX_CONCURRENT: ${WCL_V2_MAX_CONCURRENT:-4}
         WCL_V2_LAUNCH_SPACING_MS: ${WCL_V2_LAUNCH_SPACING_MS:-0}
         DISCORD_QUEUE_INTERVAL_MS: ${DISCORD_QUEUE_INTERVAL_MS:-500}
         DISCORD_REQUEST_TIMEOUT_MS: ${DISCORD_REQUEST_TIMEOUT_MS:-30000}
       ports:
         - "4040:4040"
       healthcheck:
         test:
           - CMD
           - node
           - -e
           - fetch('http://127.0.0.1:4040/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))
         interval: 30s
         timeout: 5s
         retries: 3
         start_period: 10s
       read_only: true
       tmpfs:
         - /tmp
       security_opt:
         - no-new-privileges:true
       cap_drop:
         - ALL
       logging:
         options:
           max-size: 10m
           max-file: "3"
   ```
3. Create a **`.env`** file to configure your secrets:
   ```bash
   WCL_PROXY_SECRET=your_long_wcl_secret_here
   DISCORD_PROXY_SECRET=your_long_discord_secret_here
   ```
4. Start the container:
   ```bash
   docker compose up -d
   ```
5. **NPMPlus Configuration**: Point a subdomain (e.g., `wclproxy.yourdomain.com`) to your Docker host IP on port `4040` with **Force SSL** and HTTP/2. Keep it proxied (**Orange Cloud enabled**) in your Cloudflare DNS dashboard to hide your home IP.
6. **Configure Worker Relay**: In your Cloudflare Worker environment variables, add `BACKEND_URL` and set its value to your NPMPlus domain: `https://wclproxy.yourdomain.com`.

---

## ⚙️ Environment Variables Configuration

The following variables can be adjusted in your `.env` configuration file:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4040` | The port the Node.js server listens on inside the container. |
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
