# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker and self-hosted VPS proxy support, Warcraft Logs API request-control scaffolding, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

## Folder Guide

| Folder | Purpose |
|---|---|
| `Combined Proxy/` | Consolidated Cloudflare Worker proxy (Discord + WCL). Source of truth; mirrored to [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) for 1-click user deployment. |
| `VPS Proxy/` | Docker Compose deployment with a Node.js proxy, process-wide WCL queues, and automatic HTTPS through Caddy. |
| `V2 Wrapper/` | Warcraft Logs V1→V2 GraphQL compatibility layer and version-specific replacement sets. |
| `RCE Replacements/` | Generated deployment-ready output files (`.gs` replacements and unified `wrapper.gs`). |
| `n8n Automations/` | Apps Script automation patches and n8n compose setup docs. |
| `tests/` | V1 ↔ V2 API comparison suite, RPB query verification, and Excel comparison tools. See [TESTING_GUIDE.md](Docs/TESTING_GUIDE.md). |
| `Docs/` | Architecture, setup notes, design framework, and troubleshooting. |
| `Discord Proxy/` | Discord webhook relay docs (standalone code consolidated into `Combined Proxy/`). |
| `WCL Proxy/` | WCL API proxy scaffold docs (standalone code consolidated into `Combined Proxy/`). |

### Local-Only Folders (git-ignored)

| Folder | Purpose |
|---|---|
| `Current Source/` | Local editable CLA/RPB source snapshots. |
| `Original Code/` | Local original/reference CLA/RPB source snapshots. |

## Quick Start

| Area | Start Here |
|---|---|
| **Combined proxy + wrapper setup** (recommended) | [Docs/COMBINED_SYSTEM.md](Docs/COMBINED_SYSTEM.md), [Docs/SHEET_CODE.md](Docs/SHEET_CODE.md) |
| **1-click proxy deployment** | [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) |
| **Dedicated-IP VPS deployment** | [VPS Proxy/README.md](VPS%20Proxy/README.md) |
| **Portable proxy contract** | [Docs/PROXY_CONTRACT.md](Docs/PROXY_CONTRACT.md) |
| **Developer workflow & build rules** | [Docs/DESIGN_FRAMEWORK.md](Docs/DESIGN_FRAMEWORK.md) |
| **Testing & verification** | [Docs/TESTING_GUIDE.md](Docs/TESTING_GUIDE.md) |
| **V2 Wrapper migration** | [V2 Wrapper/README.md](V2%20Wrapper/README.md) |
| **Developer migration handoff** | [V2 Wrapper/docs/MIGRATION_NOTES.md](V2%20Wrapper/docs/MIGRATION_NOTES.md) |
| **n8n automation patches** | [n8n Automations/README.md](n8n%20Automations/README.md) |

## Important Boundaries

- **Upstream Separation**: CLA and RPB remain separate upstream tools, Google Sheets, and Apps Script projects. Automation combines them into a single runtime "expansion lane" containing the CLA/RPB sheet pair, Web App URLs, queue, and WarcraftLogs API budget.
- **Input Pipelining**: Manual submissions and automatic monitors feed the same lane. Once a report is accepted, the sequence is always CLA first, then RPB.
- **n8n vs. Apps Script**: n8n owns orchestration only (intake, queue, locks, callbacks, retry decisions). Public announcements should be executed by the sheet-side export/notification process.
- **Security**: Do not commit real Web App URLs, Discord webhooks, WarcraftLogs API keys, OAuth client secrets, Cloudflare secrets, or n8n secrets.

## Development Status & Roadmap

> [!NOTE]
> The core integration layers—including the V2 GraphQL compatibility wrapper, client-side rate-limit pacing, and the consolidated Cloudflare Worker proxy—are fully implemented, verified, and complete for TBC `v1.6.0a`.

### Active Work
1. **End-to-End n8n Pipeline Validation**:
   - The Apps Script automation patches (`CLA_Patch_n8n.gs`, `RPB_Patch_n8n.gs`) are scaffolded but the full pipeline sequence (intake → queue → locks → CLA → RPB) has not yet been verified end-to-end under real production conditions.

### Development Roadmap
- [x] **Phase 1: Complete V2 GraphQL Adapters**: Implement event and table GraphQL query fetches and write adaptation functions to match the shapes expected by the sheet logic.
- [x] **Phase 2: Combined Proxy Testing & Mirroring**: Validate, test, and consolidate the Discord + WCL proxy ([Combined Proxy/worker.js](Combined%20Proxy/worker.js)) and mirror it to the standalone deploy repo [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) for 1-click deployment.
- [x] **Phase 3: TBC v1.6.0a End-to-End Proof of Concept**: Apply the replacement sets for TBC CLA and RPB v1.6.0a and verify full compatibility and output parity with live Warcraft Logs V1/V2 endpoints.
- [x] **Phase 4: Client-Side Request Pacing**: Implement rate-limit pacing directly in `WCL_Compat.gs` to enforce safe fetch intervals, avoiding Worker-side queuing to prevent CPU duration limits.
- [ ] **Phase 5: Expand Era Coverage**: Port replacement sets to other game eras (Vanilla, Season of Discovery, WotLK, MoP).
- [ ] **Phase 6: n8n Production Validation**: Run end-to-end verification of the full automation pipeline under real production load.

## Credits

The upstream CLA/RPB sheets are community tools. This repo only contains local enhancement, proxy, and automation work around those sheets.

Credits are listed directly by era. Release state describes what this repo currently provides, not the upstream sheet status.

Community Discord: https://discord.gg/nGvt5zH

| Version / Era | CLA Upstream Credit | RPB Upstream Credit | Repo Release State |
|---|---|---|---|
| Vanilla | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| TBC | @Shariva | @Shariva | Unified wrapper and RCE Replacements generated for CLA/RPB `v1.6.0a`; V2 Wrapper fully implemented/verified for both CLA and RPB `v1.6.0a` using V2 credentials; WCL Proxy scaffolds exist; automation patches are still generic pre-1.0. |
| Season of Discovery | Community, mainly @Tallia / @Pazrea | Community, mainly @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
| Wrath of the Lich King | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| Cataclysm | Community CLA managed by @BZ, with substantial coding by @Salino | No known community RPB version | CLA scaffold only; no RPB path unless a community RPB appears. |
| Mists of Pandaria | Community CLA managed by @BZ, with substantial coding by @Salino | Community RPB by @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
