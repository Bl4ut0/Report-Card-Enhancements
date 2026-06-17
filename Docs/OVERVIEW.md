# Project Overview

This repo is a patch and automation layer for two third-party Google Apps Script tools that are orchestrated together by game expansion:

| Tool | Short Name | Purpose |
|---|---|---|
| Combat Log Analytics | CLA | Parses WarcraftLogs raid data into a Google Sheet. |
| Role Performance Breakdown | RPB | Generates role-specific player report cards in the expansion's RPB Google Sheet. |

CLA and RPB remain physically separate upstream sheets, Apps Script projects, and deployment URLs. In automation, however, the runtime boundary is the expansion lane: one configured CLA/RPB sheet pair, one queue, and one WarcraftLogs API budget for that expansion.

## Upstream Credit

The upstream CLA/RPB sheets are third-party community tools. This project does not claim ownership of those sheets; it adds local documentation, Worker proxy support, Warcraft Logs request-control scaffolding, automation patches, and Warcraft Logs API wrapper scaffolding around them.

Era-specific support, attribution, and release state are tracked in `Docs/VERSION_ORGANIZATION.md`. Community coordination is available at https://discord.gg/nGvt5zH.

## Current Repository Layout

Committed files:

```text
Report Card Enhancements/
  Combined Proxy/          ← Consolidated Cloudflare Worker (Discord + WCL) source files; mirrored to RCE-Proxy subrepo
    README.md
    SYNC_GUIDE.md
    worker.js
    wrangler.toml
    deploy.js
    .github/
      workflows/
        deploy.yml

  Discord Proxy/           ← Legacy standalone Discord webhook relay documentation and scaffold
    README.md
    worker.js
    docs/
      CHANGELOG.md
      DISCORD_PROXY_RELAY.md

  WCL Proxy/               ← Legacy standalone Warcraft Logs proxy documentation and scaffold
    README.md
    worker.js
    wrangler.toml
    docs/
      CHANGELOG.md
      RATE_LIMITING.md

  VPS Proxy/               ← Containerized self-hostable proxy (Discord + WCL) for VPS hosting (Caddy HTTPS)
    README.md
    server.js
    package.json
    Dockerfile
    Caddyfile
    docker-compose.yml

  Local Proxy/             ← Containerized proxy for local docker hosts (NPMPlus + Cloudflare Worker relay)
    README.md
    server.js
    package.json
    Dockerfile
    docker-compose.yml
    .env.example

  n8n Automations/
    README.md
    CLA_Patch_n8n.gs
    RPB_Patch_n8n.gs
    Shared_Config.gs
    Shared_DiscordWebhook.gs
    compose.yml
    compose.example.yml
    docs/
      CHANGELOG.md
      PATCHES.md
      N8N_INTEGRATION.md
      N8N_MCP_SETUP.md

  V2 Wrapper/
    README.md
    shared/
      WCL_Compat.gs
    replacements/
      TBC/
        CLA/
          v1.6.0a/
        RPB/
          v1.6.0a/
    docs/
      CHANGELOG.md
      INSTALLATION.md
      MIGRATION_NOTES.md

  Docs/
    ARCHITECTURE.md
    DESIGN_FRAMEWORK.md
    KNOWN_ISSUES.md
    VERSION_ORGANIZATION.md
    OVERVIEW.md

  RCE Replacements/        ← Generated deployment-ready compiled outputs
    CLA/
      TBC/
        v1.6.0a/
          <patched-files>.gs
          wrapper.gs
    RPB/
      TBC/
        v1.6.0a/
          <patched-files>.gs
          wrapper.gs
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
| `RCE Replacements/` | Yes | Generated deployment-ready outputs (patches, unified wrapper, and worker packages). |
| `Current Source/` snapshots | Local only | Ignored source snapshots used for private/local review. |
| `Original Code/` snapshots | Local only | Ignored upstream/reference snapshots. |
| `Combined Proxy/` | Yes | Consolidated Cloudflare Worker proxy and source-level proxy files. Mirrored to standalone subrepo. |
| `VPS Proxy/` | Yes | Containerized self-hostable Node.js + Caddy proxy service for VPS deployment (Direct DNS/SSL). |
| `Local Proxy/` | Yes | Containerized proxy service for local docker hosts running behind existing proxies like NPMPlus (Cloudflare Worker relay). |
| `Discord Proxy/` (legacy) | Yes | Legacy Worker relay and documentation. |
| `WCL Proxy/` (legacy) | Yes | Legacy WCL API proxy scaffold and documentation. |
| `n8n Automations/` | Yes | Apps Script patch files for automation and orchestration. |
| `V2 Wrapper/` | Yes | Warcraft Logs V1/V2 compatibility wrapper and version-specific replacement sets. |
| `Docs/` | Yes | Project guidance, registry, and troubleshooting. |

## Automation Flow

```text
manual form or WarcraftLogs guild monitor
  -> normalize report request
     expansion, report ID, source, submitted by
  -> expansion queue / WarcraftLogs API lock
  -> CLA Apps Script Web App
     setReportId, then runPasses
  -> wait for CLA callback or poll status
  -> RPB Apps Script Web App
     setReportId, then runFull
  -> wait for RPB callback or poll status
  -> sheet-managed announcement
```

The preferred automation pattern is to let n8n orchestrate intake, queueing, locks, retries, and WarcraftLogs quota pacing. Apps Script patches expose safe Web App actions, report results back to n8n, and leave public announcements to the sheet-side export/notification process.

Manual and automatic runs should not fork into separate operational systems. They should create the same normalized report request and enter the same expansion queue.

## Version Notes

The active committed examples are currently TBC-oriented `v1.6.0a` examples. Version and era support is tracked in `Docs/VERSION_ORGANIZATION.md`. Discord Proxy, WCL Proxy, automation patch, and V2 Wrapper versions are tracked inside their own folders.
