# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker proxy support, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

This repo is organized around three ideas:

- `Current Source/` contains the current editable/reference CLA and RPB source snapshots.
- `Worker Proxy/` contains the Cloudflare Worker relay and source-level examples for Discord webhook delivery.
- `Automations/` contains Apps Script patch files and n8n support files.

## Folder Guide

| Folder | Purpose |
|---|---|
| `Current Source/` | Current CLA/RPB source snapshots for v1.6.0a work. |
| `Original Code/` | Original/reference CLA/RPB versions kept separate from active work. |
| `Worker Proxy/` | Cloudflare Worker relay plus CLA/RPB example files with proxy support applied. |
| `Automations/` | Apps Script patch files and n8n compose example/setup docs. |
| `Docs/` | Project architecture, setup notes, patch registry, and troubleshooting. |

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

For the broader system map, start here:

```text
Docs/OVERVIEW.md
```

## Important Boundaries

CLA and RPB are separate tools. They run in separate Google Sheets and separate Apps Script projects.

Patch files are designed to be uploaded beside the live Apps Script files. They should extend behavior without editing the upstream core logic unless a change is explicitly being prepared in `Current Source/`.

Do not commit real Web App URLs, Discord webhooks, WarcraftLogs tokens, Cloudflare secrets, or n8n secrets.

## Credits

The original TBC Combat Log Analytics (CLA) and Role Performance Breakdown (RPB) sheets were created and maintained by `shariva` for TBC WarcraftLogs analysis. This repo only contains local enhancement, proxy, and automation work around those sheets.

Original/updated CLA and RPB versions are distributed through the creator's Discord hub:

```text
https://discord.gg/nGvt5zH
```
