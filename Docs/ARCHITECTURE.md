# Architecture

## System Boundaries

CLA and RPB are separate Google Sheet based Apps Script tools. This repo adds automation, delivery, Warcraft Logs request-control, and Warcraft Logs API compatibility support around them without claiming ownership of upstream core logic.

The automation runtime is organized by expansion. Each expansion lane owns the configured CLA/RPB sheet pair, Web App URLs, queue state, and WarcraftLogs API pacing for that expansion. Manual submissions and automatic WarcraftLogs group monitoring feed the same lane.

The upstream CLA/RPB sheets are community-maintained and vary by game era. This repo owns only the enhancement layer: documentation, Worker proxy support, Warcraft Logs request-control scaffolding, automation patches, and Warcraft Logs API wrapper scaffolding. See `Docs/VERSION_ORGANIZATION.md` for expansion-specific credits and support status.

| Boundary | CLA | RPB |
|---|---|---|
| Google Sheet | Separate CLA sheet | Separate RPB sheet |
| Apps Script project | Separate project | Separate project |
| Web App URL | Separate deployment | Separate deployment |
| Automation patch | `CLA_Patch_n8n.gs` | `RPB_Patch_n8n.gs` |
| Main output | CLA analysis tabs/export | Role report cards/export |

Automation combines those physical boundaries into an expansion lane:

| Lane Item | Purpose |
|---|---|
| Expansion key | Selects the configured sheet pair and WarcraftLogs group monitor. |
| CLA Web App URL | Runs `setReportId`, then `runPasses`. |
| RPB Web App URL | Runs `setReportId`, then `runFull`. |
| Queue lock | Serializes report work for the expansion. |
| WarcraftLogs API lock | Prevents concurrent CLA/RPB calls from burning the single shared API key. |
| Announcement target | Receives sheet-managed completion messages from the configured sheet notification path. |

## Repository Layers

Committed layers:

```text
Combined Proxy/
  Consolidated Cloudflare Worker proxy (Discord webhook relay + WCL proxy with SHA-256 caching and fallback). Source of truth; mirrored to standalone deploy subrepo.

VPS Proxy/
  Containerized, self-hostable proxy (Discord webhook relay + WCL proxy with local in-memory caching and fallback). Configured for easy VPS hosting via Docker Compose and Caddy.

Discord Proxy/
  Legacy standalone Discord webhook relay documentation and worker scaffold.

WCL Proxy/
  Legacy standalone Warcraft Logs proxy documentation and worker scaffold.

n8n Automations/
  Patch-only Apps Script files, setup docs, and patches.

V2 Wrapper/
  Warcraft Logs V1/V2 compatibility wrapper (WCL_Compat.gs) and version-specific replacement sets.

Docs/
  Repo-level overview, architecture, design framework, and cross-cutting troubleshooting.
```

Local ignored layers:

```text
Original Code/
  Historical/reference snapshots.

Current Source/
  Editable/reference source snapshots used for private local comparison.
```

## Apps Script Patch Model

Apps Script uses a flat global namespace inside each project. A patch file uploaded into the same Apps Script project can call top-level functions from the core files by name.

```text
n8n HTTP POST
  -> Apps Script Web App doPost(e)
    -> validate shared secret
    -> dispatch action from action map
    -> call existing top-level CLA/RPB function
    -> optionally POST callback result to n8n
```

Patch files should avoid duplicate function names that could collide with core scripts. Shared helper functions use trailing underscores where practical.

## Expansion Organization

Patches and source-level examples should be organized by expansion, tool, and upstream version when version-specific behavior appears:

```text
<component>/
  examples/
    CLA/
      Vanilla/
        <version>/
      TBC/
        v1.6.0a/
      SOD/
        <version>/
      WOTLK/
        <version>/
      Cata/
        <version>/
      MoP/
        <version>/
    RPB/
      Vanilla/
        <version>/
      TBC/
        v1.6.0a/
      SOD/
        <version>/
      WOTLK/
        <version>/
      MoP/
        <version>/
```

The current committed Worker examples are TBC `v1.6.0a` examples. New Vanilla, TBC, SOD, WOTLK, Cata, and MoP work should use explicit expansion folders so fixes do not get mistaken as universal across all CLA/RPB variants. Do not add Cataclysm RPB folders unless a community RPB version appears.

## Unified n8n Flow

Manual and automatic inputs should merge before any sheet mutation:

```text
Manual form
WarcraftLogs group monitor
  -> Normalize Report Request
     expansion, reportId, source, requester, discoveredAt
  -> Deduplicate by expansion + reportId
  -> Acquire expansion queue lock
  -> Acquire WarcraftLogs API lock
  -> Run CLA
     CLA setReportId
     CLA runPasses
  -> Run RPB only after CLA succeeds, when configured
     RPB setReportId
     RPB runFull
  -> Release locks
  -> Sheet-managed announcement
```

The Apps Script locks are still useful guardrails inside each sheet-bound project, but the canonical cross-sheet lock belongs in n8n because CLA and RPB cannot share Apps Script properties across separate projects.

## CLA Patch Flow

```text
setReportId
  -> write report ID to Instructions!E11
  -> acquire run lock

runPasses
  -> run enabled CLA passes
  -> run final compile/export step
  -> release run lock
  -> callback to n8n
```

The CLA patch keeps the sheet-level Discord webhook enabled by default so the sheet-side announcement process runs during final export. It can still suppress the sheet webhook for a specific request with `options.suppressCoreDiscord=true` if a fallback run needs to mute announcements. In the unified lane, n8n should call CLA before RPB for a report ID.

## RPB Patch Flow

```text
setReportId
  -> write report ID to Instructions!E11
  -> acquire run lock

runFull
  -> runAllSheet
  -> runExport
  -> release run lock
  -> callback to n8n
```

RPB runs in a strict two-phase order. Phase 2 is skipped if Phase 1 fails.

In the unified lane, RPB should not start until CLA has completed successfully for the same expansion and report ID. If an expansion has no known RPB sheet, the lane should complete after CLA and notify accordingly.

## Discord Delivery Options

There are two supported approaches:

| Option | Location | When to Use |
|---|---|---|
| Combined Proxy / Compiled replacements | Compiled automatically by `build_combined.js` | When deploying the sheet with fully integrated proxy routing. |
| Patch-only wrapper/helper | `n8n Automations/Shared_DiscordWebhook.gs` | When core source should remain untouched and export buttons can call wrapper functions. |

For n8n-driven runs, the preferred approach is to let the sheets own public announcements while n8n owns queueing, locks, retries, and callback handling.

## Warcraft Logs API Wrapper

The V2 Wrapper project is for source-level Warcraft Logs call migration. It differs from automation patches because the existing CLA/RPB source builds V1 REST URLs directly.

```text
Existing source
  -> UrlFetchApp.fetch(V1 REST URL with api_key)

Wrapper source
  -> wclFetchFights_ / wclFetchTable_ / wclFetchEvents_
     -> V1 REST when the credential slot contains an API key
     -> V2 GraphQL when the credential slot contains client_id:client_secret
```

Replacement sets must be organized by expansion, tool, and upstream source version. Users should only install a set that exactly matches their sheet version.

## Warcraft Logs Proxy

The Warcraft Logs Proxy (now part of the `Combined Proxy`) is for controlled upstream Warcraft Logs API egress. It should be treated as a reliability and pacing layer, not a limit bypass.

```text
CLA/RPB source or V2 Wrapper
  -> Combined Proxy Worker (/wcl path)
     -> allowlisted Warcraft Logs API URL
     -> bounded retries for 429/502/503/504
     -> Retry-After-aware backoff
     -> SHA-256 query caching with stale-on-error fallback
```

Request serialization and pacing are implemented client-side directly in `WCL_Compat.gs` using script property configurations (e.g. `WCL_MIN_FETCH_INTERVAL_MS`) to avoid exceeding CPU time limits and holding connections open.

## Constraints

| Constraint | Impact |
|---|---|
| Apps Script execution time limit | Large logs may need split passes rather than one full run. |
| Warcraft Logs rate limiting | Centralize pacing in n8n and WCL Proxy; honor upstream `Retry-After` values. |
| Web App deployment versions | Code edits require a new deployment version before they are live. |
| Flat global namespace | Patch names must avoid collisions with core functions. |
| Web App URL secrecy | Treat deployment URLs like credentials. |
