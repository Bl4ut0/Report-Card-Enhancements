# Patch Registry

Patch files live one level up in `../` and are uploaded into the target Google Apps Script project. They extend the live CLA/RPB projects without requiring direct edits to upstream core files.

## Patch Rules

- Keep secrets in Apps Script Script Properties or n8n credentials, not in source files.
- Upload shared files before project-specific patches.
- Verify action map function names against the live Apps Script function dropdown before deploying.
- Re-deploy the Web App as a new version after each patch update.
- Treat these patches as pre-1.0 until the n8n workflow contract is stable.
- Track version-specific behavior by era and upstream sheet version. Do not assume a TBC function name, cell location, or export behavior applies to SOD/Cata/MoP.

## Active Files

### `../Shared_Config.gs`

| Field | Value |
|---|---|
| Target | CLA and RPB |
| Version | 0.1.0 |
| Purpose | Shared secret validation, verbose logging, error payloads, callback error reporting, and retry-safe fetch helper. |
| Required properties | `N8N_SECRET` |
| Optional properties | `VERBOSE_LOGGING`, `SHEET_ID` |

### `../Shared_DiscordWebhook.gs`

| Field | Value |
|---|---|
| Target | CLA and RPB |
| Version | 0.1.0 |
| Purpose | Patch-only Discord proxy export wrappers that route completion notices through a Cloudflare Worker. |
| Required properties | `DISCORD_PROXY_WORKER_URL`, `DISCORD_PROXY_SECRET` |
| Exposes | `runCLAExportWithDiscordProxy()`, `runRPBExportWithDiscordProxy()`, `fetchDiscordWebhook_()` |

### `../CLA_Patch_n8n.gs`

| Field | Value |
|---|---|
| Target | CLA Apps Script project |
| Version | 0.3.0 |
| Purpose | Exposes CLA actions as an n8n-callable Web App. |
| Required files | `Shared_Config.gs` |
| Required properties | `N8N_SECRET` |
| Report ID cell | `Instructions!E11` |
| Lock TTL | 30 minutes |

Available actions:

| Action | Maps To | Purpose |
|---|---|---|
| `setReportId` | built in | Writes the WarcraftLogs report ID and acquires the run lock. |
| `status` | built in | Returns spreadsheet binding and lock state. |
| `runPasses` | built in | Runs enabled passes, then the final export step. |
| `runFights` | `runFightsOnly` | Fight metadata pass. Disabled by default in the current patch toggles. |
| `runGearIssues` | `runGearIssues` | Gear issue pass. |
| `runGearListing` | `runGearListing` | Gear listing pass. |
| `runConsumables` | `runConsumablesPass` | Consumables pass. |
| `runDrums` | `runDrumsPass` | Drums pass. |
| `runSR` | `runSRPass` | Shadow resistance pass. Disabled by default in the current patch toggles. |
| `validate` | `validateSheetState` | Validation pass. Disabled by default in the current patch toggles. |
| `runCLA` | `runFullCLA` | Final compile/export step. Auto-appended by `runPasses`. |

### `../RPB_Patch_n8n.gs`

| Field | Value |
|---|---|
| Target | RPB Apps Script project |
| Version | 0.2.0 |
| Purpose | Exposes RPB actions as an n8n-callable Web App. |
| Required files | `Shared_Config.gs` |
| Required properties | `N8N_SECRET` |
| Report ID cell | `Instructions!E11` |
| Lock TTL | 30 minutes |

Available actions:

| Action | Maps To | Purpose |
|---|---|---|
| `setReportId` | built in | Writes the WarcraftLogs report ID and acquires the run lock. |
| `status` | built in | Returns spreadsheet binding and lock state. |
| `runFull` | built in | Runs `runAllSheet`, then `runExport`. |
| `runRPB` | alias | Alias handled as `runFull`. |
| `runAllSheet` | `generateAllSheet` | Phase 1 data generation. |
| `runExport` | `generateRoleSheets` | Phase 2 export/report generation. |

## Upload Order

1. `Shared_Config.gs`
2. `Shared_DiscordWebhook.gs` if using patch-only Discord proxy wrappers
3. `CLA_Patch_n8n.gs` in the CLA project
4. `RPB_Patch_n8n.gs` in the RPB project

## Deployment Check

After deploying a Web App, visit the deployment URL with a browser. A healthy GET response should include:

```json
{
  "status": "ok",
  "spreadsheetId": "1abc123...",
  "availableActions": ["..."]
}
```

If `spreadsheetId` is `NOT BOUND`, the deployment came from a standalone Apps Script project instead of the sheet-bound CLA/RPB project.
