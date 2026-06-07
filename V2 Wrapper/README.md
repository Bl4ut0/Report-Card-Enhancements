# Warcraft Logs V2 Wrapper

Compatibility layer and version-specific replacement sets for moving CLA/RPB from Warcraft Logs V1 REST calls toward Warcraft Logs V2 GraphQL while preserving V1 API-key support.

This project is intentionally organized by expansion, tool, and upstream form/source version. Users should only install files that match their exact game version, CLA/RPB tool, and sheet source version.

## Folder Guide

| Folder | Purpose |
|---|---|
| `shared/` | Version-neutral wrapper scaffolding for auth detection, fetch dispatch, V1 REST support, and V2 GraphQL support. |
| `replacements/` | User-facing replacement file sets by expansion, tool, and source version. |
| `docs/` | Wrapper-specific installation notes, migration notes, and changelog. |

## Credential Slot Compatibility

The wrapper is designed to support both credential styles in the existing Warcraft Logs API key slot:

```text
V1 API key:
abc123

V2 client credentials:
client_id:client_secret
```

If a value contains a colon, the wrapper treats it as V2 client credentials and splits on the first colon. If the value does not contain a colon, the wrapper treats it as a V1 API key.

An explicit prefix format may be added later if needed:

```text
v1:api_key
v2:client_id:client_secret
```

## Standalone Deployment (Direct Mode / No Proxy)

To use the Warcraft Logs V2 Wrapper directly (without setting up a Cloudflare Worker proxy):

1. **Add the Compatibility Wrapper:** Copy [WCL_Compat.gs](shared/WCL_Compat.gs) into your Google Apps Script project.
2. **Apply Replacements:** Copy the modified files for your expansion/version from the `replacements/` directory (e.g., [replacements/TBC/CLA/v1.6.0a/](replacements/TBC/CLA/v1.6.0a/)) into your Apps Script project, overwriting the original files.
3. **Configure Credentials:** In your Google Sheet (on the `Instructions` tab), enter your WCL V2 credentials `client_id:client_secret` into the existing Warcraft Logs API key field.
4. **Leave Properties Empty:** Ensure that the Script Properties `WCL_PROXY_WORKER_URL` and `WCL_PROXY_SECRET` are left empty or deleted. The wrapper will automatically detect this and route V2 GraphQL queries directly to Warcraft Logs.


## Current State

The Warcraft Logs V2 GraphQL compatibility wrapper is fully implemented, verified, and production-ready for TBC v1.6.0a, supporting both the **Combat Log Analytics (CLA)** and **Role Performance Breakdown (RPB)** sheets. 

The wrapper handles fight structures (encounter/boss IDs, fight timings, actor participation), table data (structure-matched automatically by WCL GraphQL), and event lists (reconstructing nested `ability` objects from V2 `abilityGameID` for backward compatibility). The wrapper has been validated end-to-end against live Warcraft Logs reports, demonstrating 100% output parity between the V1 REST and V2 GraphQL endpoints for both sheets.

