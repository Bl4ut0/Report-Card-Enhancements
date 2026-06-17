# Self-Hosted VPS Combined Proxy

A single-package Docker deployment for the Combat Log Analytics (CLA) and Role
Performance Breakdown (RPB) proxy. It provides:

- Warcraft Logs V1/V2 relay at `/wcl`
- Discord webhook relay at `/discord`
- Automatic HTTPS through Caddy
- Process-wide WCL V1 and V2 request queues
- Bounded retries, response caching, and stale-cache fallback
- A health endpoint at `/healthz`

This deployment is intended for a VPS with its own public IP. Unlike an edge
Worker platform, the single Node.js process can enforce one queue across all
incoming sheet requests.

## Requirements

1. A Linux VPS with Docker Engine and Docker Compose v2.
2. TCP ports `80` and `443`, plus UDP port `443`, open to the internet.
3. A domain or subdomain with an `A`/`AAAA` record pointing to the VPS.
4. Only one `app` container replica. Multiple replicas would create separate
   queues and remove the process-wide concurrency guarantee.

## Deploy

Copy the entire `VPS Proxy/` folder to the VPS, then run:

```bash
cp .env.example .env
nano .env
chmod +x deploy.sh
./deploy.sh
```

The script validates the Compose configuration, pulls the pre-built Node.js image from Docker Hub, and starts the proxy and Caddy. Caddy obtains and renews the TLS certificate
automatically after DNS and firewall configuration are correct.

Check the deployment:

```bash
docker compose ps
docker compose logs -f
curl https://proxy.example.com/healthz
```

## Environment

Required:

| Variable | Purpose |
|---|---|
| `DOMAIN` | Public DNS name used by Caddy, without `https://` |
| `WCL_PROXY_SECRET` | Secret required by `/wcl` |
| `DISCORD_PROXY_SECRET` | Secret required by `/discord` |

Warcraft Logs behavior:

| Variable | Default | Purpose |
|---|---:|---|
| `WCL_PROXY_MAX_RETRIES` | `2` | Retry count for retryable upstream failures |
| `WCL_PROXY_MAX_BACKOFF_MS` | `15000` | Maximum exponential backoff |
| `WCL_PROXY_REQUEST_TIMEOUT_MS` | `60000` | Timeout for each WCL upstream attempt |
| `WCL_PROXY_CACHE_TTL_SECONDS` | `300` | Fresh in-memory cache lifetime; `0` disables caching |
| `WCL_PROXY_STALE_TTL_SECONDS` | `86400` | Maximum age for stale fallback responses |
| `WCL_MAX_CONCURRENT` | `1` | Process-wide V1 REST concurrency |
| `WCL_LAUNCH_SPACING_MS` | `300` | Minimum delay between V1 launches |
| `WCL_V2_MAX_CONCURRENT` | `4` | Process-wide V2 GraphQL concurrency |
| `WCL_V2_LAUNCH_SPACING_MS` | `0` | Minimum delay between V2 launches |

Discord behavior:

| Variable | Default | Purpose |
|---|---:|---|
| `DISCORD_QUEUE_INTERVAL_MS` | `500` | Minimum interval between webhook launches |
| `DISCORD_REQUEST_TIMEOUT_MS` | `30000` | Discord upstream request timeout |

The proxy honors `Retry-After` when WCL supplies it. An IP-level `429` without a
`Retry-After` is returned immediately rather than retried, because retrying that
response would increase traffic while the IP is blocked.

## Google Apps Script

Configure these Script Properties:

```text
WCL_PROXY_URL=https://proxy.example.com/wcl
WCL_PROXY_SECRET=<same value as .env>
DISCORD_PROXY_URL=https://proxy.example.com/discord
DISCORD_PROXY_SECRET=<same value as .env>
```

The same canonical proxy properties work for this deployment and any other
provider that implements the portable proxy contract.

## Operations

```bash
# View status
docker compose ps

# Follow logs
docker compose logs -f

# Rebuild after replacing package files with a newer version
./deploy.sh

# Restart without rebuilding
docker compose restart

# Stop the deployment while preserving Caddy certificates
docker compose down
```

Caddy certificates are stored in the `caddy_data` Docker volume. Do not delete
that volume during routine upgrades.
