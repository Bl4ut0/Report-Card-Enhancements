# TBC CLA v1.6.0a Replacement Set

Implemented replacement sources for TBC Combat Log Analytics `v1.6.0a`.

Target source snapshot:

```text
Current Source/CLA/v1.6.0a/
```

The build runner copies these sources into:

```text
RCE Replacements/CLA/TBC/v1.6.0a/
```

For the Consumables page, deploy both:

- `wrapper.gs`, which provides V1/V2 authentication, translation, routing,
  response normalization, pacing, and cooldown handling.
- `Consumables.gs`, which changes the high-volume boss/player table loops to
  submit grouped requests through `wclFetchTables_()`.

The batching change does not replace the consumable calculations or sheet
output. It changes how the same required WCL table data is requested. Using the
wrapper with the previous one-request-at-a-time Consumables implementation
remains API-compatible, but does not provide the request-count reduction needed
to address the observed IP-level `429` failures.

See [Migration Notes](../../../docs/MIGRATION_NOTES.md) for the developer-facing
integration explanation.
