# CLA/RPB Combined API Proxy

A lightweight Cloudflare Worker that acts as a secure relay between your Google Sheets (CLA/RPB Report Cards) and external APIs — **Warcraft Logs** and **Discord Webhooks**.

## Why Do I Need This?

Google Apps Script runs from shared Google IP addresses. When multiple users (or your own parallel scripts) make requests, the external services see a flood of traffic from the same IP and block it with rate limits. This proxy:

- **Routes your API calls through your own unique Cloudflare Worker URL** — giving you a dedicated IP that isn't shared with other Google Sheets users.
- **Handles Discord webhook delivery** — bypasses Google's shared IP blocks on Discord.
- **Caches Warcraft Logs responses** — identical queries within 5 minutes return instantly without hitting the WCL API again.
- **Retries failed requests automatically** — handles transient 429/5xx errors with exponential backoff.

---

## Quick Start (1-Click Deploy)

### Step 1: Deploy the Worker

Click the button below to deploy this worker to your own free Cloudflare account:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Bl4ut0/RCE-Proxy)

> **Don't have a Cloudflare account?** You'll be prompted to create a free one. The free tier is more than enough for this proxy.

<!-- Screenshot: 1-click deploy landing page -->

### Step 2: Authorize & Wait for Deploy

1. Log in to your Cloudflare account (or create one).
2. Authorize the GitHub integration when prompted.
3. Wait for the deployment to complete (usually under 1 minute).

<!-- Screenshot: Deploy progress / success page -->

### Step 3: Get Your Worker URL

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **"Workers & Pages"** in the left sidebar.
3. Click on **"rce-proxy"** (or whatever name was assigned).
4. Copy the worker URL — it looks like:
   ```
   https://rce-proxy.YOUR_SUBDOMAIN.workers.dev
   ```

<!-- Screenshot: Worker overview page showing the URL -->

### Step 4: Set Up Secrets

Your proxy needs two secret passwords — one for Warcraft Logs requests and one for Discord requests. These must match between your Cloudflare Worker and your Google Sheet.

1. On the worker page, click the **"Settings"** tab.
2. Click **"Variables and Secrets"**.
3. Click **"Add"** under the **Secrets** section.
4. Add the following two secrets (use any strong random password you want — a password generator works great):

| Secret Name | Description |
|---|---|
| `WCL_PROXY_SECRET` | Password for Warcraft Logs API requests |
| `DISCORD_PROXY_SECRET` | Password for Discord webhook requests |

> **Tip:** You can use the same password for both, or different ones. Just make sure they match what you put in your Google Sheet (Step 5).

<!-- Screenshot: Secrets configuration page with both secrets added -->

### Step 5: Configure Your Google Sheet

1. Open your CLA or RPB Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Click the **⚙️ gear icon** (Project Settings) in the left sidebar.
4. Scroll down to **Script Properties**.
5. Add these four properties:

| Property Name | Value |
|---|---|
| `WCL_PROXY_URL` | Your `/wcl` proxy URL from Step 3 (e.g. `https://rce-proxy.xyz.workers.dev/wcl`) |
| `WCL_PROXY_SECRET` | The same password you set in Step 4 |
| `DISCORD_PROXY_URL` | Your `/discord` proxy URL from Step 3 (e.g. `https://rce-proxy.xyz.workers.dev/discord`) |
| `DISCORD_PROXY_SECRET` | The same password you set in Step 4 |

<!-- Screenshot: Google Apps Script project settings with properties filled in -->

### Step 6: Done! ✅

Your Google Sheet will now route all Warcraft Logs and Discord requests through your personal proxy. No more shared IP rate limits.

---

## Configuration Reference

### Secrets (Set in Cloudflare Dashboard)

| Name | Required | Description |
|---|---|---|
| `WCL_PROXY_SECRET` | Yes | Shared secret for authenticating WCL proxy requests |
| `DISCORD_PROXY_SECRET` | Yes | Shared secret for authenticating Discord proxy requests |

### Environment Variables (Pre-configured in `wrangler.toml`)

These are already set to sensible defaults. You only need to change them if you want to tune behavior:

| Name | Default | Description |
|---|---|---|
| `WCL_PROXY_MAX_RETRIES` | `2` | Number of retries on 429/5xx upstream errors |
| `WCL_PROXY_MAX_BACKOFF_MS` | `10000` | Maximum backoff delay cap (ms) |
| `WCL_PROXY_CACHE_TTL_SECONDS` | `300` | Fresh cache duration (seconds). `0` = disabled |
| `WCL_PROXY_STALE_TTL_SECONDS` | `86400` | How long stale cache can serve as fallback (seconds) |
| `WCL_MAX_CONCURRENT` | `1` | Maximum V1 REST requests active in one Worker isolate |
| `WCL_LAUNCH_SPACING_MS` | `300` | Minimum spacing between V1 REST launches in one Worker isolate |
| `WCL_V2_MAX_CONCURRENT` | `4` | Maximum V2 GraphQL requests active in one Worker isolate |
| `WCL_V2_LAUNCH_SPACING_MS` | `0` | Minimum spacing between V2 GraphQL launches in one Worker isolate |

The Worker honors WCL's `Retry-After` header. A `429` without `Retry-After` is
returned immediately instead of retried, avoiding repeated requests while an
upstream IP-level block is active.

---

## Updating to a New Version

When a new version of the proxy is released:

1. Go to your **forked repo** on GitHub (the one created by the 1-click deploy).
2. Click **"Sync fork"** → **"Update branch"** to pull the latest changes.
3. The GitHub Action will automatically redeploy the updated worker to Cloudflare.
4. Your secrets and configuration are preserved — no need to reconfigure anything.

---

## Troubleshooting

### "Unauthorized" (401) errors
Your `WCL_PROXY_SECRET` or `DISCORD_PROXY_SECRET` in the Google Sheet doesn't match what's set in Cloudflare. Double-check both values match exactly.

### "Too many requests" (429) errors
This is coming from the upstream Warcraft Logs API, not the proxy. The proxy will automatically retry with backoff. If it persists, you may be running too many parallel sheets — try running one at a time, or increase `WCL_PROXY_CACHE_TTL_SECONDS`.

### Worker not responding
Check the [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → your worker → Logs to see real-time error output.

---

## How It Works

```
Google Sheet (Apps Script)
    │
    ├── WCL request ──→ POST /wcl ──→ Cloudflare Worker ──→ warcraftlogs.com
    │                                   (cache + retry)
    │
    └── Discord msg ──→ POST /discord ──→ Cloudflare Worker ──→ discord.com/api/webhooks
                                          (rate limit queue)
```

The worker validates the shared secret on every request, forwards it to the appropriate upstream API, and returns the response. For Warcraft Logs, it also caches responses and retries on transient errors.

---

## CLI Deployment (Alternative)

If you prefer deploying via command line instead of 1-click:

```bash
# Clone the repo
git clone https://github.com/Bl4ut0/RCE-Proxy.git
cd RCE-Proxy

# Deploy and auto-generate secrets
node deploy.js

# Or deploy manually
npx wrangler deploy
npx wrangler secret put WCL_PROXY_SECRET
npx wrangler secret put DISCORD_PROXY_SECRET
```

---

## License

MIT — free to use, modify, and distribute.
