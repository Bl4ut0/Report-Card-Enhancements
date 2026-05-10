# Known Issues

## Active Issues

### Apps Script execution timeout risk

| Field | Value |
|---|---|
| Affects | Long CLA/RPB runs triggered through n8n |
| Cause | Apps Script has a hard execution time limit. |
| Mitigation | Prefer split CLA passes through `runPasses`; keep RPB in `runFull`; handle queueing in n8n. |
| Status | Known |

### Web App re-deploy required after patch updates

| Field | Value |
|---|---|
| Affects | All Web App patch deployments |
| Cause | Apps Script serves the deployed version, not automatically the latest saved file. |
| Mitigation | Use `Deploy -> Manage deployments -> Edit -> New version -> Deploy` after edits. |
| Status | Known |

### WarcraftLogs quota is not enforced in patches

| Field | Value |
|---|---|
| Affects | n8n-triggered CLA/RPB runs |
| Cause | Patch files do not pre-check WarcraftLogs API token quota. |
| Mitigation | Add quota checks and retry/backoff in the n8n workflow before calling Apps Script actions. |
| Status | Open |

## Resolved Issues

| Issue | Resolution | Date |
|---|---|---|
| CLA final export could fail after Discord/Cloudflare returned 429 or 1015 | `CLA_Patch_n8n.gs` v0.3.0 can suppress the sheet-level Discord webhook during final export; n8n should own completion notification. | 2026-05 |
| Worker URLs pasted directly into sheet webhook fields could fail with `Invalid argument` | Added source-level parser examples and patch-only `Shared_DiscordWebhook.gs` helper. | 2026-05 |
| Core function names were unclear | Action maps document the current expected function names and remain easy to verify before deployment. | 2026-04 |
| Parallel triggers could corrupt output | Lock/TTL system added to both CLA and RPB patches. | 2026-04 |
| New report IDs could overwrite an active run | `setReportId` returns HTTP 409 while a non-stale lock is active. | 2026-04 |
| CLA had no multi-pass orchestration | `runPasses` action added. | 2026-04 |
| CLA and RPB separation was unclear | Docs now state that they are separate sheets and separate Apps Script projects. | 2026-04 |

## Open Questions

| Question | Current Recommendation |
|---|---|
| Should WarcraftLogs quota checks live in Apps Script or n8n? | n8n, because it owns queueing and retry decisions. |
| Should Discord notifications live in Apps Script or n8n? | n8n for automated workflows; patch helper for standalone sheet/manual use. |
