# Warcraft Logs Proxy

Cloudflare Worker scaffold for controlled Warcraft Logs API egress, retry handling, and future request pacing.

This project is separate from `Discord Proxy/`, which is only for Discord webhook delivery. The WCL Proxy exists to reduce bursty direct calls from CLA/RPB and to centralize Warcraft Logs API handling without changing the purpose of the Discord worker.

## Purpose

The proxy is intended to help with:

- HTTP `429` responses from request bursts.
- Transient `502`, `503`, and `504` responses.
- Shared retry and `Retry-After` handling.
- Optional short-lived caching for safe repeated V1 `GET` requests.
- A future queue/Durable Object design for serializing requests per expansion, report, or credential.

It is not intended to evade Warcraft Logs limits. The correct long-term behavior is to pace requests, reduce duplicate fetches, respect `Retry-After`, and keep one global Warcraft Logs API lock in automation.

## Files

```text
WCL Proxy/
  worker.js
  docs/
    RATE_LIMITING.md
    CHANGELOG.md
```

*(Note: Standalone sheet-side code examples for this proxy have been consolidated into `RCE Replacements/` as part of the primary unified deployment workflow).*

## Worker Secrets

Set this Worker secret:

```text
WCL_PROXY_SECRET
```

The Apps Script helper sends the same value in:

```text
x-wcl-proxy-secret
```

## Basic Request Shape

Apps Script posts a small proxy envelope to the Worker:

```json
{
  "url": "https://classic.warcraftlogs.com:443/v1/report/fights/REPORT?translate=true&api_key=...",
  "method": "GET"
}
```

For V2 GraphQL, use:

```json
{
  "url": "https://www.warcraftlogs.com/api/v2/client",
  "method": "POST",
  "headers": {
    "authorization": "Bearer TOKEN",
    "content-type": "application/json"
  },
  "body": {
    "query": "query { rateLimitData { limitPerHour pointsSpentThisHour } }"
  }
}
```

Only Warcraft Logs hosts are allowed. The Worker rejects arbitrary target hosts.

## Apps Script Integration

To route your sheet's WCL requests through the proxy:

1. Copy [WCL_Compat.gs](file:///c:/Dev%20Projects/Report%20Card%20Enhancements/V2%20Wrapper/shared/WCL_Compat.gs) (or the generated `wrapper.gs` from `RCE Replacements/`) into your Apps Script project.
2. In the Google Apps Script editor, navigate to **Project Settings -> Script Properties** and add:
   - `WCL_PROXY_WORKER_URL`: Set to your deployed Cloudflare Worker endpoint (e.g. `https://YOUR_WORKER.workers.dev/wcl`).
   - `WCL_PROXY_SECRET`: Set to the same secret value configured as the `WCL_PROXY_SECRET` on the Cloudflare Worker.
3. No further modifications are required! The compatibility wrapper will automatically detect these properties and route WCL V1 and V2 requests through the proxy.

## Current State

This is a framework scaffold. It includes target validation, shared-secret validation, bounded retries, `Retry-After` support, and optional GET caching. It does not yet implement a Durable Object queue.


