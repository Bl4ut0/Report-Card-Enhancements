# Combined API Proxy (Warcraft Logs + Discord)

A high-performance Cloudflare Worker proxy that acts as a secure intermediary between Google Sheets (Apps Script), Warcraft Logs APIs (V1 & V2), and Discord Webhooks.

---

## Features

- **Discord Webhook Bypass**: Relays payloads safely to Discord, bypassing Google Apps Script shared IP rate limit blocks.
- **Warcraft Logs Proxy**: Handles GraphQL requests, automatic pacing/retry configurations, and dynamic caching.
- **Stale-on-Error Fallback**: Caches GraphQL responses and serving them if the upstream WCL API goes down or hits a 429 rate limit.

---

## 1-Click Deployment Setup

You can deploy this worker to Cloudflare with one click by hosting this folder on GitHub and adding the **Deploy to Cloudflare Workers** button to your main README:

```markdown
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME)
```

When users click this button, Cloudflare automatically:
1. Clones your repository.
2. Prompts them to log in to Cloudflare.
3. Deploys the worker code under their own Cloudflare account.

---

## Required Configuration

### 1. Secrets (Secure Variables)
Configure the following secrets in the Cloudflare Dashboard (under **Worker Settings -> Variables -> Secrets**) or via wrangler CLI:
- `WCL_PROXY_SECRET`: The password validation secret shared with your Google Sheet `wrapper.gs` for Warcraft Logs.
- `DISCORD_PROXY_SECRET`: The password validation secret shared with your Google Sheet `wrapper.gs` for Discord.

### 2. Environment Variables (`wrangler.toml`)
These configuration values control the behavior of the proxy:
- `WCL_PROXY_MAX_RETRIES`: Number of retries on 429/5xx upstream errors (default: `2`).
- `WCL_PROXY_MAX_BACKOFF_MS`: Bounded backoff delay cap in milliseconds (default: `10000` ms).
- `WCL_PROXY_CACHE_TTL_SECONDS`: Short-term fresh cache duration. Set to `300` (5 minutes) to enable cache. Set to `0` to disable caching.
- `WCL_PROXY_STALE_TTL_SECONDS`: Maximum time stale cached values can be served as a fallback on upstream errors (default: `86400` / 24 hours).
