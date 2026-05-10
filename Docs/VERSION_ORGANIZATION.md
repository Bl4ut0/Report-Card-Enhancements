# Version Organization

CLA and RPB are community-maintained Google Apps Script tools with different upstream maintainers across game eras. This repo adds local documentation, Worker proxy support, and automation patches around those tools. It does not claim ownership of the upstream sheets.

## Upstream Credit Matrix

| Era / Version Family | CLA Upstream Credit | RPB Upstream Credit | Current Repo Status |
|---|---|---|---|
| Vanilla | `shariva` | `shariva` where applicable | Supported family; add version-specific patches as needed. |
| TBC | `shariva` | `shariva` | Current committed Worker examples target TBC `v1.6.0a`. |
| Season of Discovery (SOD) | Community members, mainly `Pazrea` | Community members, mainly `Pazrea` where applicable | Being added as a new supported branch/family. |
| Wrath of the Lich King (WOTLK) | TBD; document exact upstream sheet before patching | TBD; document exact upstream sheet before patching | Supported family; upstream credit must be confirmed per sheet/version. |
| Cataclysm | Community version managed by `@BZ`, with substantial coding by `@Salino` | No known community RPB version | CLA-only support expected unless a community RPB appears. |
| Mists of Pandaria (MoP) | Community version managed by `@BZ`, with substantial coding by `@Salino` where applicable | TBD; document exact upstream sheet before patching | Supported family; document exact upstream source before patching. |

## Organization Rules

Use explicit tool, era, and upstream version when adding version-specific files.
Placeholder `.gitkeep` files keep planned era folders visible until the exact upstream version folder is known.

Preferred shape for committed examples:

```text
Worker Proxy/
  examples/
    CLA/
      Vanilla/
        <upstream-version>/
      TBC/
        v1.6.0a/
      SOD/
        <upstream-version>/
      WOTLK/
        <upstream-version>/
      Cata/
        <upstream-version>/
      MoP/
        <upstream-version>/
    RPB/
      Vanilla/
        <upstream-version>/
      TBC/
        v1.6.0a/
      SOD/
        <upstream-version>/
      WOTLK/
        <upstream-version>/
      MoP/
        <upstream-version>/
```

Preferred shape for version-specific automation patches, when the generic root patch files are no longer enough:

```text
Automations/
  patches/
    CLA/
      Vanilla/
        <upstream-version>/
      TBC/
        v1.6.0a/
      SOD/
        <upstream-version>/
      WOTLK/
        <upstream-version>/
      Cata/
        <upstream-version>/
      MoP/
        <upstream-version>/
    RPB/
      Vanilla/
        <upstream-version>/
      TBC/
        v1.6.0a/
      SOD/
        <upstream-version>/
      WOTLK/
        <upstream-version>/
      MoP/
        <upstream-version>/
```

Keep shared helpers at the component root only when they are truly version-neutral.

Do not create `RPB/Cata/` unless a community Cataclysm RPB sheet appears. As of this document, only Cataclysm CLA is known.

## Documentation Rules

When adding a new era or upstream sheet version:

1. Record the upstream creator/maintainer credit in this file.
2. Record whether CLA, RPB, or both exist for that era.
3. Record the upstream version string exactly as shown in the sheet.
4. Document any changed cell locations, function names, sheet names, export behavior, or Discord behavior.
5. Update `Worker Proxy/docs/CHANGELOG.md` or `Automations/docs/CHANGELOG.md` when committed support changes.

## Current Notes

The existing committed Worker Proxy examples are TBC `v1.6.0a` examples:

```text
Worker Proxy/examples/CLA/TBC/v1.6.0a/
Worker Proxy/examples/RPB/TBC/v1.6.0a/
```

New Vanilla, TBC, SOD, WOTLK, Cata, and MoP work should use the explicit era folder shape.
