# CLA + RPB Report Card Enhancements

Helper scripts, Cloudflare Worker proxy support, and n8n automation patches for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB).

This repo is organized around three committed areas:

- `Worker Proxy/` contains the Cloudflare Worker relay and source-level examples for Discord webhook delivery.
- `Automations/` contains Apps Script patch files and n8n support files.
- `Docs/` contains repo-level context and cross-cutting notes.

## Folder Guide

| Folder | Purpose |
|---|---|
| `Worker Proxy/` | Cloudflare Worker relay plus CLA/RPB example files with proxy support applied. |
| `Automations/` | Apps Script patch files and n8n compose example/setup docs. |
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

For the broader system map, start here:

```text
Docs/OVERVIEW.md
```

## Important Boundaries

CLA and RPB are separate tools. They run in separate Google Sheets and separate Apps Script projects.

Patch files are designed to be uploaded beside the live Apps Script files. They should extend behavior without editing the upstream core logic. When source-level examples are needed, use the committed examples under `Worker Proxy/examples/`.

Do not commit real Web App URLs, Discord webhooks, WarcraftLogs tokens, Cloudflare secrets, or n8n secrets.

## Credits

The original TBC Combat Log Analytics (CLA) and Role Performance Breakdown (RPB) sheets were created and maintained by `shariva` for TBC WarcraftLogs analysis. This repo only contains local enhancement, proxy, and automation work around those sheets.

Original/updated CLA and RPB versions are distributed through the creator's Discord hub:

```text
https://discord.gg/nGvt5zH
```
