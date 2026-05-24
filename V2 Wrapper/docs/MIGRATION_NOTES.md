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

## First Good Target

Start with a narrow CLA pass such as Drums or Fights before migrating RPB. RPB has many more WCL calls and should be migrated after the wrapper shape is proven against known reports.

