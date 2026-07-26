# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker and self-hosted VPS proxy support, Warcraft Logs API request-control scaffolding, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

## Folder Guide

| Folder | Purpose |
|---|---|
| `RCE-Proxy/` | Consolidated Cloudflare Worker proxy (Discord + WCL). Source of truth; mirrored to [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) for 1-click user deployment. |
| `Self-Hosted Proxy/` | Unified Docker Compose deployment for both VPS (Caddy auto-HTTPS) and Local Home-Server (behind NPMPlus) setups. |
| `V2 Wrapper/` | Warcraft Logs V1→V2 GraphQL compatibility layer and version-specific replacement sets. |
| `RCE Replacements/` | Generated deployment-ready output files (`.gs` replacements and unified `wrapper.gs`). |
| `n8n Automations/` | Apps Script automation patches and n8n compose setup docs. |
| `tests/` | V1 ↔ V2 API comparison suite, RPB query verification, and Excel comparison tools. See [TESTING_GUIDE.md](Docs/TESTING_GUIDE.md). |
| `Docs/` | Architecture, setup notes, design framework, and troubleshooting. |
| `Discord Proxy/` | Discord webhook relay docs (standalone code consolidated into `RCE-Proxy/`). |
| `WCL Proxy/` | WCL API proxy scaffold docs (standalone code consolidated into `RCE-Proxy/`). |

### Local-Only Folders (git-ignored)

| Folder | Purpose |
|---|---|
| `Current Source/` | Local editable CLA/RPB source snapshots. |
| `Original Code/` | Local original/reference CLA/RPB source snapshots. |

## Quick Start

| Area | Start Here |
|---|---|
| **Combined proxy + wrapper setup** (recommended) | [Docs/COMBINED_SYSTEM.md](Docs/COMBINED_SYSTEM.md), [RCE Replacements/](RCE%20Replacements/) |
| **1-click proxy deployment** | [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) |
| **Self-Hosted Docker deployment** (VPS / Local) | [Self-Hosted Proxy/README.md](Self-Hosted%20Proxy/README.md) |
| **Portable proxy contract** | [Docs/PROXY_CONTRACT.md](Docs/PROXY_CONTRACT.md) |
| **Developer workflow & build rules** | [Docs/DESIGN_FRAMEWORK.md](Docs/DESIGN_FRAMEWORK.md) |
| **Testing & verification** | [Docs/TESTING_GUIDE.md](Docs/TESTING_GUIDE.md) |
| **V2 Wrapper migration** | [V2 Wrapper/README.md](V2%20Wrapper/README.md) |
| **Developer migration handoff** | [V2 Wrapper/docs/MIGRATION_NOTES.md](V2%20Wrapper/docs/MIGRATION_NOTES.md) |
| **n8n automation patches** | [n8n Automations/README.md](n8n%20Automations/README.md) |

## Deployment & Self-Hosting Options

The proxy stack supports two primary deployment pathways depending on your infrastructure preference:

### Option 1: Cloudflare Worker (1-Click Edge Deploy)
For a serverless setup requiring zero server maintenance, deploy directly to Cloudflare's edge network:
- **Repo & Deploy**: [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy)
- **Features**: Handles WCL API requests and Discord webhooks with dynamic caching and stale-on-error fallbacks.
- **Deployment**: 1-click GitHub Actions auto-deploy or CLI deployment via `deploy.js` / `npx wrangler deploy`.

### Option 2: Self-Hosted Docker Container (`bl4ut0/rce-proxy:latest`)
For users who prefer running on dedicated VPS hardware or a local home server/NAS, pre-packaged Docker Compose setups are located in [Self-Hosted Proxy/](Self-Hosted%20Proxy/):

1. **VPS Deployment with Automatic SSL (Caddy)**:
   - Uses [Self-Hosted Proxy/docker-compose.vps.yml](Self-Hosted%20Proxy/docker-compose.vps.yml) to spin up the proxy container alongside Caddy for automatic Let's Encrypt SSL management.
   - **Setup**:
     ```bash
     cd "Self-Hosted Proxy"
     cp .env.example .env
     # Set DOMAIN=proxy.yourdomain.com and secrets in .env
     docker compose -f docker-compose.vps.yml up -d
     ```

2. **Local Home-Server / NAS Deployment (NPMPlus & Worker Relay)**:
   - Uses [Self-Hosted Proxy/docker-compose.yml](Self-Hosted%20Proxy/docker-compose.yml) to run the proxy container locally on port `4040`.
   - Easily pairs with local reverse proxies (Nginx Proxy Manager, NPMPlus, Traefik) or a Cloudflare Worker relay (`BACKEND_URL`) to mask your home external IP address.
   - **Setup**:
     ```bash
     cd "Self-Hosted Proxy"
     cp .env.example .env
     # Set WCL_PROXY_SECRET and DISCORD_PROXY_SECRET in .env
     docker compose up -d
     ```

3. **Container Health & Stats Verification**:
   - Query container health and active request queue metrics anytime:
     ```bash
     curl http://localhost:4040/healthz
     ```

## Important Boundaries

- **Upstream Separation**: CLA and RPB remain separate upstream tools, Google Sheets, and Apps Script projects. Automation combines them into a single runtime "expansion lane" containing the CLA/RPB sheet pair, Web App URLs, queue, and WarcraftLogs API budget.
- **Input Pipelining**: Manual submissions and automatic monitors feed the same lane. Once a report is accepted, the sequence is always CLA first, then RPB.
- **n8n vs. Apps Script**: n8n owns orchestration only (intake, queue, locks, callbacks, retry decisions). Public announcements should be executed by the sheet-side export/notification process.
- **Security**: Do not commit real Web App URLs, Discord webhooks, WarcraftLogs API keys, OAuth client secrets, Cloudflare secrets, or n8n secrets.

## Development Status & Roadmap

> [!NOTE]
> Core infrastructure development is complete! The V2 GraphQL Proxy, Discord Webhook Relay, WCL Worker Relays, Cloudflare Worker deployment script, and Self-Hosted Docker system are all fully operational and available.

### Active Focus & Next Steps
1. **n8n Automations**: Full pipeline validation and refinement for Apps Script & n8n orchestration (intake → queue → locks → CLA → RPB).
2. **Game Era Expansion**: Updating and testing replacement sets for additional Warcraft game versions (Vanilla, Season of Discovery, WotLK, MoP).

### Development Roadmap
- [x] **Phase 1: Complete V2 GraphQL Adapters**: Implement event and table GraphQL query fetches and write adaptation functions to match the shapes expected by the sheet logic.
- [x] **Phase 2: Consolidated Proxy & Relays**: Build, test, and consolidate the V2 WCL API proxy and Discord webhook relay ([RCE-Proxy/worker.js](RCE-Proxy/worker.js)) with automated deployment script (`deploy.js`) and 1-click GitHub mirror ([Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy)).
- [x] **Phase 3: Self-Hosted Docker System**: Deliver production-ready Docker Compose setups ([Self-Hosted Proxy/](Self-Hosted%20Proxy/)) for VPS (Caddy auto-HTTPS) and local home servers.
- [x] **Phase 4: TBC v1.6.0a End-to-End & Request Pacing**: Apply replacement sets for TBC CLA and RPB v1.6.0a with client-side rate-limit pacing (`WCL_Compat.gs`) to ensure safe fetch intervals and output parity.
- [ ] **Phase 5: n8n Automations & Pipeline Validation**: Run end-to-end verification and refinement of the full n8n automation pipeline under production load.
- [ ] **Phase 6: Expand Game Version Support**: Update and verify replacement sets across other game eras (Vanilla, Season of Discovery, WotLK, MoP, Cataclysm).

## Credits

The upstream CLA/RPB sheets are community tools. This repo only contains local enhancement, proxy, and automation work around those sheets.

Credits are listed directly by era. Release state describes what this repo currently provides, not the upstream sheet status.

Community Discord: https://discord.gg/nGvt5zH

| Version / Era | CLA Upstream Credit | RPB Upstream Credit | Repo Release State |
|---|---|---|---|
| Vanilla | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| TBC | @Shariva | @Shariva | Completed V2 Wrapper release. Consolidated `wrapper.gs` and RCE replacements generated for both CLA and RPB `v1.6.0a`; fully optimized for rate-limiting via player/debuff query batching. Verified direct and proxy modes. |
| Season of Discovery | Community, mainly @Tallia / @Pazrea | Community, mainly @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
| Wrath of the Lich King | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| Cataclysm | Community CLA managed by @BZ, with substantial coding by @Salino | No known community RPB version | CLA scaffold only; no RPB path unless a community RPB appears. |
| Mists of Pandaria | Community CLA managed by @BZ, with substantial coding by @Salino | Community RPB by @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
