# Migration Notes

The existing CLA/RPB source is built around Warcraft Logs V1 REST URLs. The V2 API uses OAuth2 and GraphQL, so the migration needs both wrapper files and direct source edits.

## Migration Shape

```text
Existing source
  -> direct UrlFetchApp.fetch(V1 URL)

Wrapper migration
  -> wclFetchFights_(credentials, reportCode, options)
  -> wclFetchTable_(credentials, reportCode, dataType, options)
  -> wclFetchEvents_(credentials, reportCode, dataType, options)
```

The wrapper should preserve V1 behavior for API-key users and adapt V2 responses into the shapes expected by existing sheet logic.

## Two Types of Source Change

The direct file changes fall into two categories.

### 1. Compatibility Call Replacement

Most upstream changes are mechanical replacements of direct WCL requests:

```text
UrlFetchApp.fetch(V1 fights URL) -> wclFetchFights_(...)
UrlFetchApp.fetch(V1 table URL)  -> wclFetchTable_(...)
UrlFetchApp.fetch(V1 events URL) -> wclFetchEvents_(...)
```

These wrapper functions own:

- V1 API-key versus V2 `client_id:client_secret` detection.
- V1 REST and V2 GraphQL request construction.
- OAuth token handling.
- Proxy or direct routing.
- V1-compatible response normalization.
- Per-request pacing, error diagnostics, and `Retry-After` cooldown handling.

The form's evaluation and sheet-output logic should remain unchanged when only
this type of migration is required.

### 2. High-Volume Call Batching

`Consumables.gs` is a special case. Its original nested boss/player loops make
many synchronous table requests. Replacing each request with
`wclFetchTable_()` preserves compatibility, but it does not reduce the number of
upstream requests and can still trigger Warcraft Logs IP-level `429` responses.

The wrapper cannot automatically combine separate calls made over time because
each synchronous `wclFetchTable_()` invocation must return before the next loop
iteration can continue. The caller must first describe the related requests as
a group:

```javascript
var results = wclFetchTables_(credentials, reportCode, [
  { dataType: "summary", options: firstFightOptions },
  { dataType: "damage-done", options: secondFightOptions }
]);
```

For V2 credentials, `wclFetchTables_()` combines those table fields into
aliased GraphQL operations. For V1 credentials, it executes the same request
list sequentially through the V1 adapter. Returned results remain in request
order.

For TBC CLA `v1.6.0a`, this required a version-specific change to
`Consumables.gs`:

- Boss summary and damage requests are collected before being fetched.
- Each player's neck and per-boss buff requests are collected before being
  fetched.
- Existing consumable evaluation and sheet-writing logic consumes the returned
  data in the same positions as before.

Therefore, installing only `wrapper.gs` provides V1/V2 compatibility, but the
rate-limit fix for the Consumables page requires replacing both `wrapper.gs`
and `Consumables.gs`.

## Known Response Shapes To Preserve

Existing code expects these V1-style structures in many places:

- `allFightsData.title`
- `allFightsData.start`
- `allFightsData.zone`
- `allFightsData.fights`
- `allFightsData.enemies`
- `fight.start_time`
- `fight.end_time`
- `fight.zoneID`
- `fight.zoneName`
- `tableData.entries`
- `eventData.events`
- `eventData.nextPageTimestamp`

The V2 adapter should normalize responses before returning them to CLA/RPB code.

## Developer Integration Options

The upstream form developer can integrate the canonical wrapper calls and the
batched Consumables request orchestration directly. If upstream integration is
not accepted, users can install the matching files from:

```text
RCE Replacements/<Tool>/<Era>/<Version>/
```

Replacement files must match the exact tool, game era, and upstream form
version.
