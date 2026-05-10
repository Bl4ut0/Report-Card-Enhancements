# Discord Webhook Proxy Relay

Google Apps Script sends `UrlFetchApp` traffic from shared Google infrastructure. Discord and Cloudflare can rate-limit that traffic, producing errors such as:

```text
Request failed for https://discord.com returned code 429
Truncated server response: error code: 1015
```

This folder contains the Cloudflare Worker relay and source-level examples.

## Files

| Item | Path |
|---|---|
| Worker source | `../worker.js` |
| Source-level TBC CLA example | `../examples/CLA/v1.6.0a/General.gs` |
| Source-level TBC RPB example | `../examples/RPB/v1.6.0a/Filtering.gs` |

## Source-Level Proxy Parser

The sheet webhook field can contain either a normal Discord URL:

```text
https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

or a proxy URL:

```text
https://YOUR_WORKER.workers.dev/https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN?proxy_secret=YOUR_PROXY_SECRET
```

The Apps Script helper converts that into:

```text
UrlFetchApp destination:
  https://YOUR_WORKER.workers.dev

Headers:
  x-discord-webhook: https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
  x-proxy-secret: YOUR_PROXY_SECRET
```

See `../README.md` for the exact CLA/RPB source-level edits.

## Cloudflare Worker Setup

1. Create a Cloudflare Worker.
2. Paste `../worker.js`.
3. Add Worker secret `DISCORD_PROXY_SECRET`.
4. Deploy.
5. Copy the Worker root URL.

Do not hardcode Discord webhook URLs or secrets in `worker.js`.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Apps Script says `Invalid argument` with a Worker URL | Source-level parser is not installed | Apply the source-level helper change shown in `README.md`. |
| Cloudflare returns `401` | Secret mismatch | Match the proxy secret in the sheet URL to the Worker secret. |
| Cloudflare returns `Invalid Target` | Missing or invalid `x-discord-webhook` header | Confirm the Apps Script helper is sending to the Worker. |
| Discord returns `401` or `404` | Discord webhook is wrong or deleted | Create a new Discord webhook. |

## Patch-Only Alternative

If core source files should stay untouched, use the patch-only helper in:

```text
../../Automations/Shared_DiscordWebhook.gs
```

That path is documented in:

```text
../../Automations/docs/PATCHES.md
```
