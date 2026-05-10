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
Docs/VERSION_ORGANIZATION.md
```

## Important Boundaries

CLA and RPB are separate tools. They run in separate Google Sheets and separate Apps Script projects.

Patch files are designed to be uploaded beside the live Apps Script files. They should extend behavior without editing the upstream core logic. When source-level examples are needed, use the committed examples under `Worker Proxy/examples/`.

Do not commit real Web App URLs, Discord webhooks, WarcraftLogs tokens, Cloudflare secrets, or n8n secrets.

## Credits

The upstream CLA/RPB sheets are community tools. This repo only contains local enhancement, proxy, and automation work around those sheets.

Default upstream credit is `Shariva` unless a row below names different community maintainers. Release state describes what this repo currently provides, not the upstream sheet status.

| Version / Era | CLA Upstream Credit | RPB Upstream Credit | Repo Release State |
|---|---|---|---|
| Vanilla | Shariva | Shariva where applicable | Scaffold only; no committed version-specific patches/examples yet. |
| TBC | Shariva | Shariva | Worker Proxy examples committed for CLA/RPB `v1.6.0a`; automation patches are still generic pre-1.0. |
| Season of Discovery | Community, mainly Tallia/Pazrea | Community, mainly Tallia/Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
| Wrath of the Lich King | Shariva unless otherwise specified by upstream sheet | Shariva unless otherwise specified by upstream sheet | Scaffold only; no committed version-specific patches/examples yet. |
| Cataclysm | Community CLA managed by BZ, with substantial coding by Salino | No known community RPB version | CLA scaffold only; no RPB path unless a community RPB appears. |
| Mists of Pandaria | Community CLA managed by BZ, with substantial coding by Salino | Community RPB by Tallia/Pazrea | Scaffold only; no committed version-specific patches/examples yet. |

Do not publish upstream sheet links or private deployment links in this repository.
