# Automation Setup

## Prerequisites

- n8n with Data Tables; API access is needed only for the optional REST import
- Node.js 20 or newer only if using the optional configuration/import scripts
- a CLA Google Sheet and its container-bound Apps Script project
- an RPB Google Sheet and its container-bound Apps Script project
- Warcraft Logs API v2 client credentials
- permission to deploy both Apps Script projects as Web Apps

## 1. Install the Apps Script Adapters

In the CLA Apps Script project, add `Shared_Config.gs` and `CLA_Patch_n8n.gs`. In the RPB project, add `Shared_Config.gs` and `RPB_Patch_n8n.gs`.

The current action maps use the TBC `v1.6.0a` function names. Verify every mapped function exists in the target project before deployment. If an upstream sheet version uses different names, update only the action map and tab-name patterns.

Set these Script Properties in both projects:

| Property | Required | Purpose |
|---|---|---|
| `N8N_SECRET` | Yes | Authenticates calls from n8n to Apps Script. Use a long random value. |
| `VERBOSE_LOGGING` | No | Set `true` while troubleshooting. |
| `SHEET_ID` | No | Only needed if the container-bound active spreadsheet is unavailable. |

Deploy each project as a Web App that executes as the sheet owner and is reachable by n8n. The Web App URL is public, but POST actions require `N8N_SECRET`. Re-deploy a new Apps Script version after every patch change.

## 2. Create n8n Credentials

Create three credentials in the destination n8n instance.

### Apps Script body authentication

Create an **HTTP Custom Auth** credential that adds this JSON body field:

```json
{
  "secret": "YOUR_N8N_SECRET"
}
```

Use the same secret stored in both Apps Script projects.

### Warcraft Logs OAuth2

Create an **OAuth2 API** credential using the Warcraft Logs client-credentials flow and official token endpoint. Store the client ID and secret only inside the n8n credential.

### Manual intake header

Create a **Header Auth** credential:

```text
Header: X-RCE-Intake-Key
Value: a separate long random value
```

Only a trusted server-side portal or integration should possess this value. Never place it in browser JavaScript.

## 3. Create the Ledger

Create an n8n Data Table named `rce_reports` using every column in [`schema/rce_reports.json`](../schema/rce_reports.json). Preserve the names and types exactly, then copy the Data Table ID from n8n.

## 4. Configure the Workflow Export

Copy the safe example:

```powershell
Copy-Item config.example.json config.local.json
```

Fill in your n8n URL, optional project ID, Data Table ID, CLA/RPB Web App URLs, Warcraft Logs guild ID, expansion label, and the three n8n credential IDs and names.

`config.local.json` is ignored by Git. It contains installation-specific identifiers and URLs, but it should still be treated as local configuration.

Generate an ordinary n8n JSON file:

```powershell
npm run configure -- --config config.local.json
```

Import `dist/rce-unified.json` through **n8n -> Workflows -> Import from File**.

### Optional REST import

Set the n8n API key in the environment; do not add it to the JSON file:

```powershell
$env:N8N_API_KEY = 'your-local-api-key'
npm run import -- --config config.local.json --dry-run
npm run import -- --config config.local.json
```

The REST import creates the workflow inactive. Add `--activate` only after completing the verification checklist. To update an existing workflow, place its ID in `workflowId` inside `config.local.json`.

This helper imports a workflow only. It does not install n8n, deploy a website, configure DNS, or upload files to a server.

## 5. Verify Before Activation

- The workflow contains 33 nodes.
- Every Data Table node points to the intended `rce_reports` table.
- CLA and RPB nodes use their matching Web Apps and Apps Script credential.
- The Warcraft Logs node uses the correct guild and OAuth credential.
- The intake webhook uses Header Auth.
- Callback URLs use the public n8n webhook base URL.
- No older RCE queue, monitor, or intake workflows are active.
- A test report completes CLA before RPB.
- A repeated report returns its existing state without executing again.

Activate the unified workflow only after the test succeeds.
