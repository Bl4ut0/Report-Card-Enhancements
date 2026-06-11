# Portable Proxy Contract

The sheet wrappers depend on HTTP contracts, not a specific hosting provider.
Cloudflare Workers, another edge-function platform, or a conventional server can
implement the same endpoints.

## Warcraft Logs Endpoint

Configure the wrapper with:

```text
WCL_PROXY_URL=https://proxy.example.com/wcl
WCL_PROXY_SECRET=<shared secret>
```

The wrapper sends:

```http
POST /wcl
Content-Type: application/json
x-wcl-proxy-secret: <shared secret>
```

```json
{
  "url": "https://www.warcraftlogs.com/api/v2/client",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
  },
  "body": "{\"query\":\"...\",\"variables\":{}}"
}
```

The implementation must:

1. Authenticate `x-wcl-proxy-secret`.
2. Accept only approved Warcraft Logs HTTPS hosts and paths.
3. Forward the method, allowed headers, and body without changing their meaning.
4. Return the upstream status, body, `Content-Type`, and `Retry-After`.
5. Set `x-wcl-proxy-relayed: true`.

Optional diagnostic headers:

```text
x-wcl-proxy-runtime: <provider or runtime name>
x-wcl-proxy-attempts: <number>
x-wcl-proxy-cache: hit|miss|fallback
```

Queueing, caching, and retries are implementation features. They are not required
by the wrapper contract. A `429` without a usable `Retry-After` should not be
repeated automatically.

## Discord Endpoint

Configure:

```text
DISCORD_PROXY_URL=https://proxy.example.com/discord
DISCORD_PROXY_SECRET=<shared secret>
```

The wrapper sends the Discord JSON payload using `POST` and includes:

```text
x-discord-webhook: <real Discord webhook URL>
x-proxy-secret: <shared secret>
```

The proxy validates the secret and webhook host, forwards the payload, and
returns Discord's response.

## Provider Implementations

Provider-specific code belongs in its own deployment folder. It may use native
cache, queue, logging, or secret APIs internally, but those details must not leak
into `WCL_Compat.gs`, version-specific replacement files, or the sheet-facing
configuration contract.
