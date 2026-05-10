# Architecture

## System Boundaries

CLA and RPB are separate Google Sheet based Apps Script tools. This repo adds automation and delivery support around them without making the two tools depend on each other.

The upstream TBC CLA/RPB sheets are credited to `shariva`. This repo owns only the enhancement layer: documentation, Worker proxy support, and automation patches.

| Boundary | CLA | RPB |
|---|---|---|
| Google Sheet | Separate CLA sheet | Separate RPB sheet |
| Apps Script project | Separate project | Separate project |
| Web App URL | Separate deployment | Separate deployment |
| Automation patch | `CLA_Patch_n8n.gs` | `RPB_Patch_n8n.gs` |
| Main output | CLA analysis tabs/export | Role report cards/export |

## Repository Layers

```text
Original Code/
  Historical/reference snapshots.

Current Source/
  Current v1.6.0a source snapshots used for prepared changes.

Worker Proxy/
  Cloudflare Worker relay, source-level examples, and Worker-specific docs.

Automations/
  Patch-only Apps Script files, setup docs, and patch changelog.

Docs/
  Repo-level overview, architecture, and cross-cutting troubleshooting.
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

The CLA patch can suppress the sheet-level Discord webhook during final export so Discord or Cloudflare rate limits do not turn a completed export into a failed automation run.

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

## Discord Delivery Options

There are two supported approaches:

| Option | Location | When to Use |
|---|---|---|
| Source-level proxy parser | `Worker Proxy/examples/` | When preparing or applying a small CLA/RPB source change is acceptable. |
| Patch-only wrapper/helper | `Automations/Shared_DiscordWebhook.gs` | When core source should remain untouched and export buttons can call wrapper functions. |

For n8n-driven runs, the preferred approach is to let n8n own Discord notification and retry behavior.

## Constraints

| Constraint | Impact |
|---|---|
| Apps Script execution time limit | Large logs may need split passes rather than one full run. |
| Web App deployment versions | Code edits require a new deployment version before they are live. |
| Flat global namespace | Patch names must avoid collisions with core functions. |
| Web App URL secrecy | Treat deployment URLs like credentials. |
