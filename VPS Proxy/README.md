# Self-Hosted VPS Combined Proxy

A containerized, self-hostable version of the Combat Log Analytics (CLA) and Role Performance Breakdown (RPB) Combined Proxy. 

This enables running the Discord Webhook Relay and Warcraft Logs API Proxy on any Virtual Private Server (VPS) under the **free tier threshold** without relying on Cloudflare Workers.

---

## Architecture Overview

* **Automatic HTTPS**: Managed automatically by the lightweight **Caddy** reverse proxy using free Let's Encrypt certificates.
* **Proxy Server**: Node.js Express service running inside a container, utilizing the local native fetch API.
* **In-Memory Caching**: Caches Warcraft Logs GraphQL queries locally with stale-while-revalidate fallback support if the upstream API experiences 429/502/503/504 errors.
* **Rate Limit Compatibility**: Relies on client-side spacing (`WCL_Compat.gs`) to regulate limits, requiring zero sleeping threads or connection hanging in Node.js.

---

## Prerequisites

1. A VPS (such as a Free Tier Oracle Cloud instance, DigitalOcean, or AWS EC2) with ports `80` and `443` open to the internet.
2. A custom domain or subdomain (e.g., `proxy.yourdomain.com`) pointing to your VPS public IP address.
3. **Docker** and **Docker Compose** installed on the VPS.

---

## Deployment Steps

### 1. Copy Files to VPS
Copy the contents of the `VPS Proxy/` directory onto your VPS:
* `server.js`
* `package.json`
* `Dockerfile`
* `Caddyfile`
* `docker-compose.yml`

### 2. Create the Environment File
In the folder where you placed the files, create a `.env` file containing your configurations:

```env
# The domain or subdomain pointing to this VPS (Caddy uses this for HTTPS)
DOMAIN=proxy.yourdomain.com

# Shared secrets to authenticate your Google Sheets
WCL_PROXY_SECRET=your_wcl_secret_here
DISCORD_PROXY_SECRET=your_discord_secret_here

# Warcraft Logs Cache Configuration
WCL_PROXY_CACHE_TTL_SECONDS=300
WCL_PROXY_STALE_TTL_SECONDS=86400

# Retries config
WCL_PROXY_MAX_RETRIES=2
WCL_PROXY_MAX_BACKOFF_MS=15000
```

### 3. Build and Start the Containers
Run the following command in the terminal on your VPS:

```bash
docker compose up -d --build
```

This will:
- Build the Node.js Express proxy app container.
- Download Caddy and spin up the reverse proxy.
- Auto-request and install Let's Encrypt SSL/TLS certificates for your custom `DOMAIN`.
- Start the server on port `3000` (which is kept secure and only exposed via Caddy).

---

## Google Sheet Configuration

Configure the Script Properties inside your Google Sheet Apps Script settings to point to your new VPS server:

* `WCL_PROXY_WORKER_URL`: `https://proxy.yourdomain.com/wcl`
* `WCL_PROXY_SECRET`: The `WCL_PROXY_SECRET` you set in your `.env`
* `DISCORD_PROXY_WORKER_URL`: `https://proxy.yourdomain.com/discord`
* `DISCORD_PROXY_SECRET`: The `DISCORD_PROXY_SECRET` you set in your `.env`

---

## Commands and Logs

* **Check Logs**: `docker compose logs -f`
* **Restart Service**: `docker compose restart`
* **Shut Down Service**: `docker compose down`
