# n8n Integration Guide

This guide covers deploying the Apps Script patches and connecting them to n8n.

## How It Works

```text
n8n
  -> manual form or WarcraftLogs guild monitor
  -> normalize one report request
  -> expansion queue / WarcraftLogs API lock
  -> POST CLA Web App action
     CLA Apps Script runs
     sheet-managed announcement if configured
     optional callback to n8n
  -> POST RPB Web App action after CLA success
     RPB Apps Script runs
     sheet-managed announcement if configured
     optional callback to n8n
```

The Web App URL plus `N8N_SECRET` is the credential pair. Keep both private.

Manual and automatic triggers should not maintain separate execution paths after intake. They should both create the same request shape and enter the same expansion queue.

## Apps Script Setup

## Local n8n Compose

`../compose.yml` is intentionally ignored by git. Use the example as the starting point:

```text
cp ../compose.example.yml ../compose.yml
```

Then update the copied file for your domain, webhook URL, timezone, proxy settings, and storage path. Commit changes to `../compose.example.yml` only when the safe template itself changes.

### 1. Upload Shared Config

In both the CLA and RPB Apps Script projects:

1. Open the Apps Script project from the Google Sheet: `Extensions -> Apps Script`.
2. Add a new script file named `Shared_Config`.
3. Paste the contents of `../Shared_Config.gs`.
4. Save.

### 2. Set Script Properties

In both Apps Script projects:

1. Open Project Settings.
2. Add Script Property `N8N_SECRET`.
3. Set it to the same strong random value you will use in n8n.

Optional:

```text
VERBOSE_LOGGING=true
```

### 3. Verify Action Maps

Before deploying, confirm the mapped function names exist in the live Apps Script project.

CLA map:

```javascript
var CLA_ACTION_MAP_ = {
  'runFights':      'runFightsOnly',
  'runGearIssues':  'runGearIssues',
  'runGearListing': 'runGearListing',
  'runConsumables': 'runConsumablesPass',
  'runDrums':       'runDrumsPass',
  'runSR':          'runSRPass',
  'validate':       'validateSheetState',
  'runCLA':         'runFullCLA',
};
```

RPB map:

```javascript
var RPB_ACTION_MAP_ = {
  'runAllSheet': 'generateAllSheet',
  'runExport':   'generateRoleSheets',
};
```

The left-side action names are what n8n sends. Only change the right-side function names if the live project uses different names.

### 4. Upload Project Patches

In the CLA Apps Script project:

1. Add script file `CLA_Patch_n8n`.
2. Paste `../CLA_Patch_n8n.gs`.
3. Save.

In the RPB Apps Script project:

1. Add script file `RPB_Patch_n8n`.
2. Paste `../RPB_Patch_n8n.gs`.
3. Save.

### 5. Deploy Web Apps

For each project:

1. Click `Deploy -> New deployment`.
2. Select `Web App`.
3. Set `Execute as: Me`.
4. Set `Who has access: Anyone`.
5. Deploy and copy the Web App URL.

Test each URL in a browser. A healthy response should include `status: "ok"` and a real `spreadsheetId`.

If `spreadsheetId` is `NOT BOUND`, the Web App was deployed from the wrong project. Open Apps Script from the target Google Sheet and deploy again.

### 6. Re-deploy After Edits

Apps Script Web Apps do not automatically update when files are saved. After any patch edit:

```text
Deploy -> Manage deployments -> Edit -> New version -> Deploy
```

The Web App URL stays the same.

## Request Reference

### Normalized n8n Report Request

The merged n8n workflow should normalize manual and monitored reports into one internal item before touching either sheet:

```json
{
  "expansion": "TBC",
  "reportId": "ABC123",
  "source": "manual",
  "requestedBy": "discord-user-or-system",
  "discoveredAt": "2026-05-10T00:00:00.000Z"
}
```

Use `source: "warcraftlogs-monitor"` for reports discovered from the configured WarcraftLogs group. The exact intake fields can vary, but `expansion` and `reportId` should be mandatory.

### Set Report ID

```json
{
  "action": "setReportId",
  "secret": "your-shared-secret",
  "reportId": "ABC123"
}
```

### Run CLA

```json
{
  "action": "runPasses",
  "secret": "your-shared-secret",
  "callbackUrl": "https://your-n8n-host/webhook/cla-callback"
}
```

Optional selected passes:

```json
{
  "action": "runPasses",
  "secret": "your-shared-secret",
  "options": {
    "passes": ["runGearIssues", "runGearListing", "runConsumables", "runDrums"],
    "stopOnError": false
  }
}
```

By default, the CLA final export leaves the sheet-level Discord webhook enabled so the sheet-managed announcement process runs. To mute sheet announcements for a specific fallback/test request:

```json
{
  "action": "runPasses",
  "secret": "your-shared-secret",
  "options": {
    "suppressCoreDiscord": true
  }
}
```

### Run RPB

```json
{
  "action": "runFull",
  "secret": "your-shared-secret",
  "callbackUrl": "https://your-n8n-host/webhook/rpb-callback"
}
```

### Suggested Unified n8n Workflow

```text
Manual form
WarcraftLogs guild monitor
  -> normalize report request
  -> dedupe by expansion + reportId
  -> acquire expansion queue lock
  -> acquire WarcraftLogs API lock
  -> CLA setReportId
  -> CLA runPasses
  -> wait for CLA callback or poll status
  -> if RPB is configured for the expansion:
     RPB setReportId
     RPB runFull
     wait for RPB callback or poll status
  -> release WarcraftLogs API lock
  -> release expansion queue lock
```

The queue lock is expansion-scoped, because the same expansion uses the same configured sheet pair. The WarcraftLogs API lock is global if all expansions share one API key.

The Apps Script `setReportId` locks are still required as a last line of defense. They are not enough by themselves for unified orchestration because CLA and RPB are separate Apps Script projects and cannot share Script Properties.

Public announcements are not an n8n responsibility in this model. They run from the sheet-side export/notification path during the CLA/RPB export steps.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `spreadsheetId: "NOT BOUND"` | Web App deployed from a standalone project | Deploy from the sheet-bound CLA/RPB Apps Script project. |
| `{ "error": "Unauthorized" }` | Wrong or missing secret | Match n8n request secret to Apps Script `N8N_SECRET`. |
| `FUNCTION_NOT_FOUND` | Action map points to a missing function | Verify the right-side function names in the Apps Script dropdown. |
| n8n receives no callback | Callback URL is wrong or inactive | Activate the webhook workflow and confirm the callback URL. |
| Run returns `Busy` / HTTP 409 | Run lock is active | Wait for completion or stale-lock TTL. |
| Manual and monitored runs overlap | Separate workflows are mutating the same expansion sheets | Merge both inputs into one queue and use an expansion lock. |
| WarcraftLogs requests collide across CLA/RPB | n8n lacks a shared API-key lock | Add one global lock around the CLA and RPB section of the workflow. |
| Changes do not appear live | Old deployment version is active | Deploy a new Web App version. |
