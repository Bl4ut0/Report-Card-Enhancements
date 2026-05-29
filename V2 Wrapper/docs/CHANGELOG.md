# Changelog

## [1.0.0] - 2026-05-29

- Fully implemented Warcraft Logs V2 GraphQL compatibility adapters in `WCL_Compat.gs`.
- Implemented `wclV2FetchFights_` to parse V2 reports and reconstruct V1-compatible fights, friendly actors, and enemy actors.
- Implemented `wclV2FetchTable_` and `wclV2FetchEvents_` to fetch V2 GraphQL tables and events data.
- Added event list adapter mapping V2 `abilityGameID` back to V1-compatible nested `ability: { guid }` structures to avoid crashes in downstream sheets.
- Added V1 REST URL parser `wclParseV1Url_` and translator `wclTranslateV1UrlToV2GraphQL_` to intercept legacy `UrlFetchApp` fetches and transparently run them via V2 GraphQL when V2 credentials are used.
- Verified end-to-end compatibility against live reports with direct V1 vs V2 payload parity.

