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

## Intended User Flow

1. Identify the game version or expansion.
2. Identify the tool: CLA or RPB.
3. Identify the upstream form/source version.
4. Copy only the matching files from `replacements/`.
5. Enter either a V1 API key or V2 `client_id:client_secret` in the existing API key slot.

## Current State

This folder is a framework scaffold. The shared wrapper APIs and replacement folder layout exist, but the V2 GraphQL response adapters still need to be implemented and validated against known reports.

