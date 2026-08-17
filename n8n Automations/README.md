# RCE n8n Automation

This directory contains the reusable automation layer for Combat Log Analytics (CLA) and Role Performance Breakdown (RPB). It monitors a Warcraft Logs guild, queues eligible reports, and processes one report at a time through CLA and then RPB.

The committed package contains no production URLs, guild identifiers, spreadsheet identifiers, n8n object IDs, credentials, OAuth secrets, private portal code, or hosting/deployment scripts. Every installation supplies its own configuration.

## What Is Included

| Path | Purpose |
|---|---|
| `workflows/rce-unified.template.json` | Scrubbed 33-node n8n workflow import template. |
| `schema/rce_reports.json` | Required n8n Data Table schema. |
| `config.example.json` | Non-secret configuration template used to replace workflow placeholders. |
| `tools/configure-workflow.mjs` | Produces a configured JSON file for import through the n8n UI. |
| `tools/import-workflow.mjs` | Optional REST import/update helper. It does not deploy n8n or any website. |
| `tools/scrub-workflow-export.mjs` | Maintainer utility for converting an n8n export into a public template. |
| `tools/validate-public-package.mjs` | Checks the public automation package for common personal or deployment-specific values. |
| `Shared_Config.gs` | Shared Apps Script authentication and callback helpers. |
| `CLA_Patch_n8n.gs` | Checkpoint-capable CLA Web App adapter. |
| `RPB_Patch_n8n.gs` | Checkpoint-capable RPB Web App adapter. |
| `Shared_DiscordWebhook.gs` | Optional sheet-side Discord proxy helper. |

## What Is Not Included

- OAuth client secrets or bot credentials
- Warcraft Logs API credentials
- Google Sheet copies or IDs
- Apps Script deployment URLs
- Discord guild, role, channel, or webhook IDs
- n8n API keys, credential IDs, project IDs, workflow IDs, or Data Table IDs
- A private portal implementation
- FTP, hosting, server, or domain deployment scripts

A deployment-neutral OAuth portal example is available in [`../Portal Template/`](../Portal%20Template/). It contains no installation-specific configuration or deployment tooling.

## Processing Contract

Every input enters the same ledger and dispatcher. The execution order is fixed:

1. CLA gear issues
2. CLA gear listing/breakdown
3. CLA consumables
4. CLA drums
5. CLA shadow resistance
6. CLA export
7. RPB report data
8. RPB role export

Only the sheet-side export routines post the final Discord messages. n8n owns discovery, deduplication, ordering, retries, and recovery.

## Start Here

1. Read [Automation setup](docs/AUTOMATION_SETUP.md).
2. Review [Architecture](docs/AUTOMATION_ARCHITECTURE.md).
3. Create the ledger using [the committed schema](schema/rce_reports.json).
4. Configure the Apps Script adapters using [Patch reference](docs/PATCHES.md).
5. Import and test the workflow while it is inactive.
6. Read [Operations and recovery](docs/OPERATIONS.md) before activation.
7. Review [Security boundaries](docs/SECURITY.md) before exposing webhooks publicly.

The current action maps target the TBC `v1.6.0a` report-card functions. Other sheet releases may require different function mappings or tab-name patterns.
