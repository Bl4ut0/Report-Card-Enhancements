# TBC RPB v1.6.0a

Replacement set for TBC Role Performance Breakdown `v1.6.0a`.

Target source snapshot:

```text
Current Source/RPB/v1.6.0a/
```

This replacement set is fully implemented. All occurrences of direct `UrlFetchApp.fetch` queries calling Warcraft Logs V1 REST endpoints in `RPB.gs` and `Helpers.gs` have been migrated to the wrapper facade (`wclV1Fetch_`). Compatibility has been validated end-to-end against live reports under both V1 REST and V2 GraphQL credentials.

