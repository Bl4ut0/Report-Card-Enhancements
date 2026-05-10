# Automations

Apps Script patch files and local n8n setup for automating CLA and RPB.

The upstream CLA/RPB sheets are community-maintained and vary by game era; these files are only the automation layer around those sheets.

Current status: pre-1.0. The patch API is usable, but it should remain `0.x` until the n8n workflow contract has been proven end to end.

## Files

| File | Purpose |
|---|---|
| `Shared_Config.gs` | Shared auth, logging, error payload, callback, and fetch helpers. Upload to both CLA and RPB projects first. |
| `CLA_Patch_n8n.gs` | CLA Web App patch for n8n actions such as `setReportId`, `runPasses`, and `status`. |
| `RPB_Patch_n8n.gs` | RPB Web App patch for `setReportId`, `runFull`, and `status`. |
| `Shared_DiscordWebhook.gs` | Optional patch-only Discord proxy helper and export wrappers. |
| `compose.example.yml` | Safe example for local/self-hosted n8n compose setup. |
| `patches/` | Version-specific patch folders organized by tool and era. |

## Upload Targets

Upload CLA files into the CLA Apps Script project and RPB files into the RPB Apps Script project. Both projects need their own copy of shared patch files because each Google Sheet has its own Apps Script runtime.

## Required Script Properties

Each Apps Script project needs:

```text
N8N_SECRET=your-shared-secret
```

If using `Shared_DiscordWebhook.gs`, also set:

```text
DISCORD_PROXY_WORKER_URL=https://your-worker.workers.dev
DISCORD_PROXY_SECRET=your-worker-secret
```

## Deployment

Deploy `CLA_Patch_n8n.gs` and `RPB_Patch_n8n.gs` from their sheet-bound Apps Script projects as Web Apps:

```text
Execute as: Me
Who has access: Anyone
```

Keep the generated Web App URLs private. Configure them in n8n rather than committing them to this repo.

## Local n8n Compose

`compose.yml` is ignored by git because it can contain real domains, local volume paths, and deployment-specific settings. Start from the example instead:

```text
cp compose.example.yml compose.yml
```

Then edit `compose.yml` for your host, protocol, webhook URL, timezone, and storage path.

For detailed setup, see `docs/N8N_INTEGRATION.md`.

Patch registry: `docs/PATCHES.md`.

Version history: `docs/CHANGELOG.md`.
