# Worker Proxy

Cloudflare Worker proxy support for CLA and RPB Discord webhook delivery.

Opening version: `1.0.0`.

The upstream TBC CLA/RPB sheets are credited to `shariva`; this Worker is only a Discord delivery enhancement around those sheets.

This is for cases where Google Apps Script requests to Discord are rate-limited or blocked with Discord/Cloudflare errors such as `429` or `1015`.

## Files

```text
Worker Proxy/
  worker.js
  examples/
    CLA/
      v1.6.0a/
        General.gs
    RPB/
      v1.6.0a/
        Filtering.gs
```

The example files show the v1.6.0a source-level implementation already applied.

## Cloudflare Worker

Deploy `worker.js` as a Cloudflare Worker.

Add this Worker secret:

```text
DISCORD_PROXY_SECRET
```

Set it to a long random value. Do not hardcode the Discord webhook URL or the secret into `worker.js`.

## CLA v1.6.0a Change

Target source file in a local ignored source snapshot, if you keep one:

```text
Current Source/CLA/v1.6.0a/General.gs
```

Committed reference implementation:

```text
Worker Proxy/examples/CLA/v1.6.0a/General.gs
```

Target function:

```javascript
postMessageToDiscord(url, webHook, date, zone, title, langKeys, langTrans)
```

Replace the old direct Discord send block:

```javascript
if (webHook.indexOf("$$$$$") > -1) {
  UrlFetchApp.fetch(webHook.split("$$$$$")[0], params);
  UrlFetchApp.fetch(webHook.split("$$$$$")[1], params);
} else
  UrlFetchApp.fetch(webHook, params);
```

with:

```javascript
fetchDiscordWebhook_(webHook, params);
```

Then add `fetchDiscordWebhook_(...)` and `getDiscordWebhookRequest_(...)` after `postMessageToDiscord(...)`.

See the complete implemented example:

```text
Worker Proxy/examples/CLA/v1.6.0a/General.gs
```

## RPB v1.6.0a Change

Target source file in a local ignored source snapshot, if you keep one:

```text
Current Source/RPB/v1.6.0a/Filtering.gs
```

Committed reference implementation:

```text
Worker Proxy/examples/RPB/v1.6.0a/Filtering.gs
```

Target function:

```javascript
postMessageToDiscord(url, webHook, date, zone, title, type, langKeys, langTrans)
```

Replace the same old direct Discord send block with:

```javascript
fetchDiscordWebhook_(webHook, params);
```

Then add the same helper functions after `postMessageToDiscord(...)`.

See the complete implemented example:

```text
Worker Proxy/examples/RPB/v1.6.0a/Filtering.gs
```

## Helper Functions

```javascript
function fetchDiscordWebhook_(webHook, params) {
  var hooks = webHook.toString().split("$$$$$");

  for (var i = 0; i < hooks.length; i++) {
    var hook = hooks[i].replace(/^\s+|\s+$/g, "");
    if (hook.length == 0)
      continue;

    try {
      var request = getDiscordWebhookRequest_(hook, params);
      UrlFetchApp.fetch(request.url, request.params);
    } catch (e) {
      Logger.log("Discord webhook failed, export will continue: " + e.message);
    }
  }
}

function getDiscordWebhookRequest_(webHook, params) {
  var requestParams = { headers: {}, method: params.method, payload: params.payload, muteHttpExceptions: true };
  for (var header in params.headers)
    requestParams.headers[header] = params.headers[header];

  var queryStart = webHook.indexOf("?");
  var baseUrl = queryStart > -1 ? webHook.substring(0, queryStart) : webHook;
  var discordStart = baseUrl.indexOf("https://discord.com/api/webhooks/");
  if (discordStart <= 0)
    return { url: webHook, params: requestParams };

  requestParams.headers["x-discord-webhook"] = baseUrl.substring(discordStart);
  var queryString = queryStart > -1 ? webHook.substring(queryStart + 1) : "";
  var proxyMatch = queryString.match(/(?:^|&)proxy(?:_secret)?=([^&]*)/);
  if (proxyMatch)
    requestParams.headers["x-proxy-secret"] = decodeURIComponent(proxyMatch[1].replace(/\+/g, " "));

  return { url: baseUrl.substring(0, discordStart).replace(/\/$/, ""), params: requestParams };
}
```

## Webhook Formats

Direct Discord mode still works:

```text
https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

Proxy mode:

```text
https://YOUR_WORKER.workers.dev/https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN?proxy_secret=YOUR_PROXY_SECRET
```

The Apps Script helper sends the actual request to the Worker and passes the real Discord webhook in:

```text
x-discord-webhook
```

The secret is passed in:

```text
x-proxy-secret
```

More detail: `docs/DISCORD_PROXY_RELAY.md`.

Version history: `docs/CHANGELOG.md`.
