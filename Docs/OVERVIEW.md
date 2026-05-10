# Project Overview

This repo is a patch and automation layer for two third-party Google Apps Script tools:

| Tool | Short Name | Purpose |
|---|---|---|
| Combat Log Analytics | CLA | Parses WarcraftLogs raid data into a Google Sheet. |
| Role Performance Breakdown | RPB | Generates role-specific player report cards in its own Google Sheet. |

CLA and RPB are independent. They do not share a spreadsheet, Apps Script project, deployment URL, or runtime state.

## Upstream Credit

The upstream CLA/RPB sheets are third-party community tools. This project does not claim ownership of those sheets; it adds local documentation, Worker proxy support, and automation patches around them.

Era-specific support, attribution, and release state are tracked in `Docs/VERSION_ORGANIZATION.md`. Community coordination is available at https://discord.gg/nGvt5zH.

## Current Repository Layout

Committed files:

```text
Report Card Enhancements/
  Worker Proxy/
    README.md
    docs/
      CHANGELOG.md
      DISCORD_PROXY_RELAY.md
    worker.js
    examples/

  Automations/
    README.md
    docs/
      CHANGELOG.md
      PATCHES.md
      N8N_INTEGRATION.md
      N8N_MCP_SETUP.md
    compose.example.yml
    CLA_Patch_n8n.gs
    RPB_Patch_n8n.gs
    Shared_Config.gs
    Shared_DiscordWebhook.gs

  Docs/
    ARCHITECTURE.md
    KNOWN_ISSUES.md
    VERSION_ORGANIZATION.md
```

Local-only ignored folders may exist in a working checkout:

```text
Current Source/
  CLA/
  RPB/

Original Code/
  CLA/
  RPB/
```

## Owned Layers

| Layer | Owned Here? | Notes |
|---|---:|---|
| CLA/RPB upstream behavior | No | Core tools are third-party and should be treated as upstream source. |
| `Current Source/` snapshots | Local only | Ignored source snapshots used for private/local review. |
| `Original Code/` snapshots | Local only | Ignored upstream/reference snapshots. |
| `Worker Proxy/` | Yes | Cloudflare Worker relay and source-level proxy examples. |
| `Automations/` | Yes | Apps Script patch files for automation and orchestration. |
| `Docs/` | Yes | Project guidance, registry, and troubleshooting. |

## Automation Flow

```text
n8n workflow
  -> CLA Apps Script Web App
    -> CLA sheet run
    -> callback to n8n
  -> RPB Apps Script Web App
    -> RPB sheet run
    -> callback to n8n
  -> Discord notification
```

The preferred automation pattern is to let n8n orchestrate queueing, retries, and Discord notifications. Apps Script patches expose safe Web App actions and report results back to n8n.

## Version Notes

The active committed examples are currently TBC-oriented `v1.6.0a` examples. Version and era support is tracked in `Docs/VERSION_ORGANIZATION.md`. Worker Proxy and automation patch versions are tracked inside their own folders.
