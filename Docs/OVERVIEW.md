# Project Overview

This repo is a patch and automation layer for two third-party Google Apps Script tools:

| Tool | Short Name | Purpose |
|---|---|---|
| Combat Log Analytics | CLA | Parses WarcraftLogs raid data into a Google Sheet. |
| Role Performance Breakdown | RPB | Generates role-specific player report cards in its own Google Sheet. |

CLA and RPB are independent. They do not share a spreadsheet, Apps Script project, deployment URL, or runtime state.

## Upstream Credit

The original TBC CLA/RPB sheets are third-party tools created and maintained by `shariva` for TBC WarcraftLogs analysis. This project does not claim ownership of those sheets; it adds local documentation, Worker proxy support, and automation patches around them.

Original/updated versions are available from the creator's Discord hub:

```text
https://discord.gg/nGvt5zH
```

## Current Repository Layout

```text
Report Card Enhancements/
  Current Source/
    CLA/
      v1.6.0a/
    RPB/
      v1.6.0a/

  Original Code/
    CLA/
      v1.6.0/
      v1.6.0a/
    RPB/
      v1.6.0/
      v1.6.0a/

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
```

## Owned Layers

| Layer | Owned Here? | Notes |
|---|---:|---|
| CLA/RPB upstream behavior | No | Core tools are third-party and should be treated as upstream source. |
| `Current Source/` snapshots | Yes | Used for local review and prepared source-level changes. |
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

The active working source snapshot is `v1.6.0a`. Worker Proxy and automation patch versions are tracked inside their own folders.
