# Version Organization

CLA and RPB are community-maintained Google Apps Script tools with different upstream maintainers across game eras. This repo adds local documentation, Worker proxy support, Warcraft Logs request-control scaffolding, automation patches, and Warcraft Logs API wrapper scaffolding around those tools. It does not claim ownership of the upstream sheets.

For automation, the expansion is the organizing unit. Each expansion lane points at its configured CLA/RPB sheet pair, Web App URLs, WarcraftLogs group monitor, and notification target.

Credits are listed directly by era. Release state describes what this repo currently provides, not the upstream sheet status.

Community Discord: https://discord.gg/nGvt5zH

## Support Matrix

| Era / Version Family | CLA Upstream Credit | RPB Upstream Credit | Repo Release State |
|---|---|---|---|
| Vanilla | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| TBC | @Shariva | @Shariva | Worker Proxy examples and V2 Wrapper scaffolds exist for CLA/RPB `v1.6.0a`; WCL Proxy scaffold exists as a shared project; automation patches are still generic pre-1.0. |
| Season of Discovery (SOD) | Community, mainly @Tallia / @Pazrea | Community, mainly @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |
| Wrath of the Lich King (WOTLK) | @Shariva | @Shariva | Scaffold only; no committed version-specific patches/examples yet. |
| Cataclysm | Community CLA managed by @BZ, with substantial coding by @Salino | No known community RPB version | CLA scaffold only; no RPB path unless a community RPB appears. |
| Mists of Pandaria (MoP) | Community CLA managed by @BZ, with substantial coding by @Salino | Community RPB by @Tallia / @Pazrea | Scaffold only; no committed version-specific patches/examples yet. |

## Organization Rules

Use explicit expansion, tool, and upstream version when adding version-specific files.
Placeholder `.gitkeep` files keep planned expansion folders visible until the exact upstream version folder is known.

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
    Vanilla/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    TBC/
      CLA/
        v1.6.0a/
      RPB/
        v1.6.0a/
    SOD/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    WOTLK/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    Cata/
      CLA/
        <upstream-version>/
    MoP/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
```

Preferred shape for Warcraft Logs API wrapper replacement sets:

```text
V2 Wrapper/
  replacements/
    Vanilla/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    TBC/
      CLA/
        v1.6.0a/
      RPB/
        v1.6.0a/
    SOD/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    WOTLK/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
    Cata/
      CLA/
        <upstream-version>/
    MoP/
      CLA/
        <upstream-version>/
      RPB/
        <upstream-version>/
```

Keep shared helpers at the component root only when they are truly version-neutral.

Do not create `RPB/Cata/` unless a community Cataclysm RPB sheet appears. As of this document, only Cataclysm CLA is known.

## Documentation Rules

When adding a new era or upstream sheet version:

1. Record the upstream creator/maintainer credit in this file.
2. Record whether CLA, RPB, or both exist for that expansion.
3. Record the upstream version string exactly as shown in the sheet.
4. Document any changed cell locations, function names, sheet names, export behavior, or Discord behavior.
5. Update the matching component changelog when committed support changes: `Worker Proxy/docs/CHANGELOG.md`, `WCL Proxy/docs/CHANGELOG.md`, `Automations/docs/CHANGELOG.md`, or `V2 Wrapper/docs/CHANGELOG.md`.

## Current Notes

The existing committed Worker Proxy examples are TBC `v1.6.0a` examples:

```text
Worker Proxy/examples/CLA/TBC/v1.6.0a/
Worker Proxy/examples/RPB/TBC/v1.6.0a/
```

The existing V2 Wrapper replacement scaffold starts with TBC `v1.6.0a` placeholders:

```text
V2 Wrapper/replacements/TBC/CLA/v1.6.0a/
V2 Wrapper/replacements/TBC/RPB/v1.6.0a/
```

The generated single-file deployment outputs from `build_combined.js` are organized by Tool first to mirror the Worker Proxy example layout:

```text
Combined Source/
  CLA/
    TBC/
      v1.6.0a/
        <replacement-files>.gs
        wrapper.gs
        worker/
          worker.js
          wrangler.toml
          README.md
  RPB/
    TBC/
      v1.6.0a/
        <replacement-files>.gs
        wrapper.gs
        worker/
          worker.js
          wrangler.toml
          README.md
```

