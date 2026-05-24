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
| Mitigation | Add quota checks, retry/backoff, and a global API-key lock in n8n before calling Apps Script actions. |
| Status | Open |

### Existing n8n workflows are split by intake path

| Field | Value |
|---|---|
| Affects | Manual form and WarcraftLogs monitor automation |
| Cause | Manual and automatic workflows can drift even though they mutate the same expansion sheets. |
| Mitigation | Merge both intake paths into one normalized expansion queue that runs CLA, then RPB. |
| Status | Open |

## Resolved Issues

| Issue | Resolution | Date |
|---|---|---|
| CLA final export could fail after Discord/Cloudflare returned 429 or 1015 | Sheet-side notification flow was repaired; `CLA_Patch_n8n.gs` keeps sheet announcements enabled by default and can mute them per request if needed. | 2026-05 |
| Worker URLs pasted directly into sheet webhook fields could fail with `Invalid argument` | Added source-level parser examples and patch-only `Shared_DiscordWebhook.gs` helper. | 2026-05 |
| Core function names were unclear | Action maps document the current expected function names and remain easy to verify before deployment. | 2026-04 |
| Parallel triggers could corrupt output | Lock/TTL system added to both CLA and RPB patches. | 2026-04 |
| New report IDs could overwrite an active run | `setReportId` returns HTTP 409 while a non-stale lock is active. | 2026-04 |
| CLA had no multi-pass orchestration | `runPasses` action added. | 2026-04 |
| CLA and RPB physical boundaries were unclear | Docs now state that they are separate upstream sheets/projects but one expansion-scoped automation lane. | 2026-05 |

## Open Questions

| Question | Current Recommendation |
|---|---|
| Should WarcraftLogs quota checks live in Apps Script or n8n? | n8n, because it owns queueing, retry decisions, and the global API-key lock. |
| Should Discord notifications live in Apps Script or n8n? | Apps Script / sheet-side export flow owns public announcements; n8n owns orchestration and callbacks. |
