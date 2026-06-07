# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker proxy support, Warcraft Logs API request-control scaffolding, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

This repo is organized around five committed enhancement projects plus shared documentation:

- `Discord Proxy/` contains the Cloudflare Worker relay for Discord webhook delivery (retained for documentation/sub-system breakdown).
- `WCL Proxy/` contains the Warcraft Logs API proxy scaffold for controlled egress (retained for documentation/sub-system breakdown).
- `Combined Proxy/` contains the merged Cloudflare Worker combining both Discord Webhook Relay and Warcraft Logs API Proxy into a single deployment footprint. Mirrored to the standalone deploy repo at [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) for 1-click Cloudflare deployment.
- `n8n Automations/` contains Apps Script patch files and n8n support files.
- `V2 Wrapper/` contains Warcraft Logs V1/V2 compatibility wrapper scaffolding and version-specific replacement sets.
- `RCE Replacements/` contains the generated, self-contained deployment outputs (patches and unified `wrapper.gs` facade).
- `Docs/` contains repo-level context and cross-cutting notes.

## Folder Guide

| Folder | Purpose |
|---|---|
| `Discord Proxy/` | Cloudflare Worker relay for Discord webhook delivery. Docs only; standalone examples are consolidated in `RCE Replacements/`. |
| `WCL Proxy/` | Warcraft Logs API proxy scaffold for retry, backoff, and allowlisting. Docs only; standalone examples are consolidated in `RCE Replacements/`. |
| `Combined Proxy/` | Consolidated Cloudflare Worker proxy that runs both Discord webhook relaying and Warcraft Logs API proxying. Source of truth; mirrored to [Bl4ut0/RCE-Proxy](https://github.com/Bl4ut0/RCE-Proxy) for user deployment. |
| `n8n Automations/` | Apps Script patch files and n8n compose example/setup docs. |
| `V2 Wrapper/` | Warcraft Logs API compatibility wrapper and expansion/version-specific replacement structure. |
| `RCE Replacements/` | Generated self-contained output files (Google Sheets `.gs` replacements and unified `wrapper.gs`). |
| `tests/` | V1 ↔ V2 API comparison test suite, RPB query verification, and Excel workbook comparison tools. See [Docs/TESTING_GUIDE.md](Docs/TESTING_GUIDE.md). |
| `Docs/` | Project architecture, setup notes, patch registry, and troubleshooting. |

## Local-Only Folders

These folders may exist in a working checkout, but they are ignored by git because they are local/private source snapshots:

| Folder | Purpose |
|---|---|
| `Current Source/` | Local editable CLA/RPB source snapshots. |
| `Original Code/` | Local original/reference CLA/RPB source snapshots. |

## Quick Start

For the combined worker and single wrapper deployment (Recommended), start here:

```text
Docs/COMBINED_SYSTEM.md
Docs/SHEET_CODE.md
```

For Discord webhook proxy support, start here:

```text
Discord Proxy/README.md
Discord Proxy/docs/CHANGELOG.md
```

For Warcraft Logs request-control proxy work, start here:

```text
WCL Proxy/README.md
WCL Proxy/docs/RATE_LIMITING.md
```

For n8n automation patch work, start here:

```text
n8n Automations/README.md
n8n Automations/docs/CHANGELOG.md
```

For Warcraft Logs V1/V2 wrapper work, start here:

```text
V2 Wrapper/README.md
V2 Wrapper/docs/MIGRATION_NOTES.md
```

For the broader system map and developer workflow rules, start here:

```text
Docs/OVERVIEW.md
Docs/DESIGN_FRAMEWORK.md
Docs/VERSION_ORGANIZATION.md
```

## Important Boundaries

CLA and RPB remain separate upstream tools, Google Sheets, and Apps Script projects, but automation should treat each expansion as one runtime lane. An expansion lane owns the configured CLA/RPB sheet pair, Web App URLs, queue, and WarcraftLogs API budget for that expansion.

Manual form submissions and automatic WarcraftLogs group monitoring are input modes for the same lane, not separate systems. Once a report is accepted, the automation order is always CLA first, then RPB.

n8n owns orchestration only: intake, queueing, locks, callbacks, and retry decisions. Public announcements should be executed by the sheet-side export/notification process.

Patch files are designed to be uploaded beside the live Apps Script files. They should extend behavior without editing the upstream core logic. When source-level examples are needed, use the generated source files under `RCE Replacements/`.

WCL Proxy files are for controlled Warcraft Logs API egress. They should pace and retry requests, not bypass Warcraft Logs limits.

V2 Wrapper replacement files are different from generic patches: they are version-specific source replacements or direct source changes needed to route Warcraft Logs calls through the compatibility layer. Users should only install a replacement set that matches their exact expansion, tool, and upstream form/source version.

Do not commit real Web App URLs, Discord webhooks, WarcraftLogs API keys, OAuth client secrets, Cloudflare secrets, or n8n secrets.

## Development Status & Roadmap

> [!WARNING]
> This framework is **currently in active development** (pre-1.0/alpha state) and is not yet production-ready. While the folder structures, proxy configurations, and basic compatibility wrappers are established, several critical integrations are completely unfinished.

### Unfinished & Active Work
1. **WCL Proxy Durable Object Queuing**:
   - The Warcraft Logs Proxy ([WCL Proxy/worker.js](WCL%20Proxy/worker.js)) implements basic retries, routing validation, and caching, but lacks request pacing and serialization.
   - Pacing is needed to queue and serialize requests per credential, report, or expansion lane under heavy load. A Cloudflare Durable Objects system is planned but not implemented.
2. **End-to-End n8n Pipeline Validation**:
   - The Apps Script automation patches (`CLA_Patch_n8n.gs`, `RPB_Patch_n8n.gs`) are scaffolded but the full pipeline sequence (intake → queue → locks → CLA → RPB) has not yet been verified end-to-end under production conditions.

### Development Roadmap
- [x] **Phase 1: Complete V2 GraphQL Adapters**: Implement event and table GraphQL query fetches and write adaptation functions to match the shapes expected by the sheet logic.
- [x] **Phase 2: Combined Proxy Testing**: Validate and test the consolidated [Combined Proxy/worker.js](Combined%20Proxy/worker.js) under simulated rate-limiting scenarios.
- [x] **Phase 3: TBC v1.6.0a End-to-End Proof of Concept**: Apply the replacement sets for TBC CLA and RPB v1.6.0a and verify full compatibility with live WCL V1/V2 endpoints.
- [ ] **Phase 4: WCL Proxy Pacing (Durable Objects)**: Integrate request pacing/queueing inside the Cloudflare Worker to avoid rate limit spikes.
- [ ] **Phase 5: Expand Era Coverage**: Port replacement sets to other game eras (Vanilla, Season of Discovery, WotLK, MoP).

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
