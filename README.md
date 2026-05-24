# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker proxy support, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

This repo is organized around three committed enhancement projects plus shared documentation:

- `Worker Proxy/` contains the Cloudflare Worker relay and source-level examples for Discord webhook delivery.
- `Automations/` contains Apps Script patch files and n8n support files.
- `V2 Wrapper/` contains Warcraft Logs V1/V2 compatibility wrapper scaffolding and version-specific replacement sets.
- `Docs/` contains repo-level context and cross-cutting notes.

## Folder Guide

| Folder | Purpose |
|---|---|
| `Worker Proxy/` | Cloudflare Worker relay plus CLA/RPB example files with proxy support applied. |
| `Automations/` | Apps Script patch files and n8n compose example/setup docs. |
| `V2 Wrapper/` | Warcraft Logs API compatibility wrapper and expansion/version-specific replacement structure. |
| `Docs/` | Project architecture, setup notes, patch registry, and troubleshooting. |

## Local-Only Folders

These folders may exist in a working checkout, but they are ignored by git because they are local/private source snapshots:

| Folder | Purpose |
|---|---|
| `Current Source/` | Local editable CLA/RPB source snapshots. |
| `Original Code/` | Local original/reference CLA/RPB source snapshots. |

## Quick Start

For Discord webhook proxy support, start here:

```text
Worker Proxy/README.md
Worker Proxy/docs/CHANGELOG.md
```

For n8n automation patch work, start here:

```text
Automations/README.md
Automations/docs/CHANGELOG.md
```

For Warcraft Logs V1/V2 wrapper work, start here:

```text
V2 Wrapper/README.md
V2 Wrapper/docs/MIGRATION_NOTES.md
```

For the broader system map, start here:

```text
Docs/OVERVIEW.md
Docs/VERSION_ORGANIZATION.md
```

## Important Boundaries

CLA and RPB remain separate upstream tools, Google Sheets, and Apps Script projects, but automation should treat each expansion as one runtime lane. An expansion lane owns the configured CLA/RPB sheet pair, Web App URLs, queue, and WarcraftLogs API budget for that expansion.

Manual form submissions and automatic WarcraftLogs group monitoring are input modes for the same lane, not separate systems. Once a report is accepted, the automation order is always CLA first, then RPB.

n8n owns orchestration only: intake, queueing, locks, callbacks, and retry decisions. Public announcements should be executed by the sheet-side export/notification process.

Patch files are designed to be uploaded beside the live Apps Script files. They should extend behavior without editing the upstream core logic. When source-level examples are needed, use the committed examples under `Worker Proxy/examples/`.

V2 Wrapper replacement files are different from generic patches: they are version-specific source replacements or direct source changes needed to route Warcraft Logs calls through the compatibility layer. Users should only install a replacement set that matches their exact expansion, tool, and upstream form/source version.

Do not commit real Web App URLs, Discord webhooks, WarcraftLogs API keys, OAuth client secrets, Cloudflare secrets, or n8n secrets.

## Credits

The upstream CLA/RPB sheets are community tools. This repo only contains local enhancement, proxy, and automation work around those sheets.

Credits are listed directly by era. Release state describes what this repo currently provides, not the upstream sheet status.

Community Discord: https://discord.gg/nGvt5zH

| Version / Era | CLA Upstream Credit | RPB Upstream Credit | Repo Release State |
|---|---|---|---|
| Vanilla | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| TBC | @Shariva | @Shariva | Worker Proxy examples committed for CLA/RPB `v1.6.0a`; V2 Wrapper scaffolds exist for CLA/RPB `v1.6.0a`; automation patches are still generic pre-1.0. |
| Season of Discovery | Community, mainly @Tallia / @Pazrea | Community, mainly @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
| Wrath of the Lich King | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| Cataclysm | Community CLA managed by @BZ, with substantial coding by @Salino | No known community RPB version | CLA scaffold only; no RPB path unless a community RPB appears. |
| Mists of Pandaria | Community CLA managed by @BZ, with substantial coding by @Salino | Community RPB by @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
