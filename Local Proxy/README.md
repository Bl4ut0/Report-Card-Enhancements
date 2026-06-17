# Local Proxy & Cloudflare Worker Relay

This directory contains the files needed to run the Warcraft Logs and Discord webhook proxy **locally** (e.g., on a home server or NAS) behind an existing reverse proxy like **Nginx Proxy Manager Plus (NPMPlus)**, using your **Cloudflare Worker** as a public relay.

This hybrid approach solves WCL's Cloudflare rate limiting blocks without exposing your home external IP address:
1. **Google Sheets** queries your public **Cloudflare Worker** URL.
2. The **Cloudflare Worker** relays the request securely to your home reverse proxy (**NPMPlus**).
3. **NPMPlus** routes the request to this **Local Proxy** container.
4. The **Local Proxy** container fetches Warcraft Logs using your **home residential IP** (which is dedicated to you, bypassing the shared Cloudflare egress IP pool limits).

---

## 1. Local Deployment (Docker Compose)

### Step 1: Copy Files
Copy this entire `Local Proxy/` folder to a directory on your home server (e.g., `/home/username/wcl-proxy`).

### Step 2: Configure Environment Variables
Rename `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your secrets:
* `WCL_PROXY_SECRET`: A long random secret password. This must match the secret configured in Google Sheets script properties.
* `DISCORD_PROXY_SECRET`: A different long random secret password. This must match the secret configured in Google Sheets script properties.

### Step 3: Run the Container
Launch the container in detached mode:
```bash
docker compose up -d
```
The server will pull the pre-built image from Docker Hub and expose the proxy app on port **`4040`** of your docker host.

---

## 2. Reverse Proxy Configuration (NPMPlus)

To route external traffic securely to your container:

1. Open your **Nginx Proxy Manager Plus (NPMPlus)** dashboard.
2. Add a new **Proxy Host**:
   * **Domain Names**: `wclproxy.yourdomain.com` (pointing to your home server's domain/subdomain).
   * **Scheme**: `http`
   * **Forward Hostname / IP**: The IP address of your Docker host (e.g., `192.168.1.100` or `172.17.0.1`).
   * **Forward Port**: `4040`
   * **Block Common Exploits**: Enabled.
3. Under the **SSL** tab:
   * Select or request a valid Let's Encrypt SSL certificate.
   * **Force SSL**: Enabled.
   * **HTTP/2 Support**: Enabled.
4. Save the configuration.

### Cloudflare DNS Settings (Hiding your Home IP)
* In your Cloudflare DNS dashboard, make sure the subdomain `wclproxy.yourdomain.com` is configured with **Proxy status: Proxied (Orange Cloud)**.
* This ensures that anyone (including Google Sheets) resolving your domain only sees Cloudflare's IP addresses, keeping your home external IP address completely hidden.

---

## 3. Cloudflare Worker Relay Setup

To configure your existing Cloudflare Worker (`falling-forest-3c7a`) to act as a secure relay to your home server:

1. Open your **Cloudflare Dashboard** and navigate to **Workers & Pages**.
2. Select your Worker (`falling-forest-3c7a`).
3. Go to **Settings** -> **Variables**.
4. Under **Environment Variables**, click **Edit variables** and add:
   * **Key**: `BACKEND_URL`
   * **Value**: `https://wclproxy.yourdomain.com` (your NPMPlus domain).
5. Click **Save and deploy**.

### How It Works
* The Cloudflare Worker intercepts incoming requests from Google Sheets.
* If `BACKEND_URL` is set, the worker routes all `/wcl` and `/discord` requests directly to your home server's NPMPlus proxy.
* If you ever need to turn off the relay and fall back to the worker fetching WCL directly, simply delete the `BACKEND_URL` environment variable from your Cloudflare dashboard and redeploy.

---

## 4. Verification

### Test the Local Proxy Health
From your local server, test the container's health endpoint:
```bash
curl http://localhost:4040/healthz
```
It should respond with a `200 OK` JSON detailing active queues and cache status:
```json
{"status":"ok","queues":{"v1":{"active":0,"pending":0,"maxConcurrent":1,"launchSpacingMs":300},"v2":{"active":0,"pending":0,"maxConcurrent":4,"launchSpacingMs":0}},"cacheEntries":0}
```

### Test the Public Relay
Verify that the Cloudflare Worker relays requests to your local container correctly. You can trigger a health check through the worker:
```bash
curl https://falling-forest-3c7a.bl4ut0.workers.dev/healthz
```
If the worker is communicating successfully with your home proxy, it will return the exact same health JSON.
