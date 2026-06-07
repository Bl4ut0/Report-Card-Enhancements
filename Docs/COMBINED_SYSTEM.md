# Unified System Architecture & Deployment Guide

This document describes the simplified architecture for the Warcraft Logs (WCL) API Proxy, Discord Webhook Relay, and Google Sheets Apps Script integration.

---

## 1. Architecture Overview

```mermaid
graph TD
    subgraph Google Sheets / Apps Script Runtime
        GAS[Google Apps Script]
        Wrapper[wrapper.gs Facade & Relay]
    end

    subgraph Cloudflare Workers
        CF[Combined Proxy Worker]
        WclPath[/wcl - Warcraft Logs Proxy]
        DiscordPath[/discord - Discord Proxy]
    end

    subgraph External APIs
        WclAPI[Warcraft Logs API V1/V2]
        DiscordAPI[Discord Webhook API]
    end

    GAS --> Wrapper
    Wrapper -->|POST Envelope| WclPath
    Wrapper -->|POST Webhook| DiscordPath
    
    WclPath -->|REST/GraphQL| WclAPI
    DiscordPath -->|Relay Webhook| DiscordAPI

    classDef gas fill:#f9f,stroke:#333,stroke-width:2px;
    classDef cf fill:#fcf,stroke:#333,stroke-width:2px;
    classDef ext fill:#ffc,stroke:#333,stroke-width:2px;
    class GAS,Wrapper gas;
    class CF,WclPath,DiscordPath cf;
    class WclAPI,DiscordAPI ext;
```

---

## 2. Combined Discord Proxy

The **Combined Proxy Worker** ([Combined Proxy/worker.js](../Combined%20Proxy/worker.js)) routes traffic dynamically based on paths and headers:

- **Discord Webhook Relay** (`/discord` path or `x-discord-webhook` header): Relays payloads safely to Discord, bypassing Google Apps Script shared IP rate limit blocks.
- **Warcraft Logs API Proxy** (`/wcl` path or `x-wcl-proxy-secret` header): Handles request retries, pacing, dynamic GraphQL caching, and stale-on-error fallbacks.

### Warcraft Logs Caching & Fallback Design

1. **GraphQL (POST) Request Caching**:
   - Cloudflare’s `caches.default` only supports caching `GET` requests.
   - The worker dynamically generates a unique `GET` request key derived from the SHA-256 hash of the `POST` body (GraphQL query + variables) and a SHA-256 hash of the `Authorization` header value. This maintains cache isolation between different credentials.
2. **Stale-While-Revalidate / Fallback-on-Error**:
   - Fresh responses are cached with a long underlying TTL (e.g. 24 hours) with a custom `x-wcl-proxy-cached-at` header.
   - If a request is made after its configured freshness TTL (`WCL_PROXY_CACHE_TTL_SECONDS`), the worker fetches from the upstream WCL API.
   - If the upstream API returns an error (such as `429 Rate Limit`, `502`, `503`, or `504` Gateway/Server errors) or throws a network error, the worker intercepts the failure and returns the stale cached response as a successful `200 OK` with header `x-wcl-proxy-cache: fallback`. This prevents the Google Sheet from crashing.

### Deployment Instructions

Deploy using Wrangler:
```bash
cd "Combined Proxy"
npx wrangler deploy
```

#### Required Secrets
Configure these secrets in your Cloudflare dashboard or via CLI:
```bash
npx wrangler secret put WCL_PROXY_SECRET
npx wrangler secret put DISCORD_PROXY_SECRET
```

#### Environment Variables (`wrangler.toml`)
Configure these in [Combined Proxy/wrangler.toml](../Combined%20Proxy/wrangler.toml):
- `WCL_PROXY_MAX_RETRIES`: Number of retries on 429/5xx (default: `2`).
- `WCL_PROXY_MAX_BACKOFF_MS`: Bounded backoff delay cap (default: `10000` ms).
- `WCL_PROXY_CACHE_TTL_SECONDS`: Short-term fresh cache duration. Set to > 0 (e.g., `300` for 5 minutes) to enable caching.
- `WCL_PROXY_STALE_TTL_SECONDS`: Storage time for stale cache fallback (default: `86400` / 24 hours).

---

## 3. Google Apps Script Integration

All auxiliary script logic is consolidated into a single file named `wrapper.gs` inside each built era/tool directory under `RCE Replacements/`.

### Build Runner Setup
Because the WCL V2 Wrapper and the Discord Proxy modify the same sheet files, you must run the build script to generate the combined codebase:

```bash
node build_combined.js
```

This script:
1. Cleans the `RCE Replacements/` output folder.
2. Scans `V2 Wrapper/replacements/` to identify all expansions and versions.
3. Automatically patches `Filtering.gs` (for RPB) and copies `General.gs` (for CLA) containing merged WCL and Discord proxy codes. It automatically strips local definitions of `fetchDiscordWebhook_` and `getDiscordWebhookRequest_` to prevent duplicate global function errors.
4. Generates a single `wrapper.gs` file in the tool directories:
    - `RCE Replacements/CLA/<Expansion>/<Version>/wrapper.gs`
    - `RCE Replacements/RPB/<Expansion>/<Version>/wrapper.gs`

### Sheet-Side Script Properties
Add these script properties to your Google Apps Script projects:
* `WCL_PROXY_WORKER_URL`: `https://YOUR_WORKER.workers.dev/wcl`
* `WCL_PROXY_SECRET`: The secret configured on your worker.
* `DISCORD_PROXY_WORKER_URL`: `https://YOUR_WORKER.workers.dev/discord`
* `DISCORD_PROXY_SECRET`: The secret configured on your worker.

*(Note: If these properties are left blank, the sheet automatically falls back to direct WCL and Discord calls, allowing fully normal operation without workers.)*
