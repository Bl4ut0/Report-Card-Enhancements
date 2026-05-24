# Installation

Install only the replacement set that matches the target sheet exactly.

## Steps

1. Open the target Google Sheet.
2. Open Apps Script from that sheet.
3. Confirm the tool and source version in the sheet or source files.
4. Find the matching folder under `V2 Wrapper/replacements/`.
5. Add the shared wrapper files included in that replacement set.
6. Replace only the source files listed in the replacement set README.
7. Deploy a new Apps Script version if the sheet uses a deployed Web App.

## Credential Format

Use the existing Warcraft Logs API key slot:

```text
abc123
```

for V1 API-key mode, or:

```text
client_id:client_secret
```

for V2 OAuth client-credentials mode.

Do not commit real API keys, client IDs, client secrets, report URLs with private access context, Web App URLs, or Discord webhooks.

## Version Safety

Replacement files are not universal. Do not install files from one expansion or form version into another unless the replacement README explicitly says it is supported.

