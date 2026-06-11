# Changelog

## Unreleased

- Added `wclFetchTables_()` batching for high-volume table request groups.
- Updated TBC CLA `v1.6.0a` Consumables request orchestration to batch boss and
  player table reads while preserving its evaluation and sheet-output logic.
- Documented why API compatibility can live in the wrapper but synchronous
  request grouping requires a version-specific caller change.
- Documented that the Consumables rate-limit fix requires both `wrapper.gs` and
  `Consumables.gs`.

## [1.0.0] - 2026-05-29

- Fully implemented Warcraft Logs V2 GraphQL compatibility adapters in `WCL_Compat.gs` supporting both V1 REST API Keys and V2 OAuth Client Credentials.
- Added version-specific replacement sets for both **Combat Log Analytics (CLA)** and **Role Performance Breakdown (RPB)** sheets for **TBC v1.6.0a**.
- Implemented `wclV2FetchFights_` to parse V2 reports and reconstruct V1-compatible fights, friendly actors, and enemy actors.
- Implemented `wclV2FetchTable_` and `wclV2FetchEvents_` to fetch V2 GraphQL tables and events data.
- Added event list adapter mapping V2 `abilityGameID` back to V1-compatible nested `ability: { guid }` structures to avoid crashes in downstream sheets.
- Added V1 REST URL parser `wclParseV1Url_` and translator `wclTranslateV1UrlToV2GraphQL_` to intercept legacy `UrlFetchApp` fetches and transparently run them via V2 GraphQL when V2 credentials are used.
- Fixed `Utilities.base64Encode` UTF-8 charset mapping to avoid script runtime exceptions in Google Apps Script.
- Resolved Consumables formatting discrepancy in CLA by correcting brace scoping in `Consumables.gs`.
- Verified end-to-end compatibility and verified output parity against live reports under both V1 and V2 credentials.
