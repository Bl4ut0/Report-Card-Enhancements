# Automations Changelog

Automation patches are pre-1.0. Version numbers describe iteration state, not a stable public API.

## [0.4.1] - 2026-08-17

### Fixed

- Live-observed reports now require both one hour from the Warcraft Logs report start and 15 minutes without an end-timestamp change before automatic queuing.
- A between-dungeon pause can no longer queue a live report before its one-hour minimum.
- Completed uploads that were never observed changing queue once their end timestamp is 15 minutes old and either the report is one hour old or it contains a boss kill.
- A successful boss kill qualifies a short cleanup report even when its total fight duration is under 60 seconds.
- Reports with a fight marked in progress cannot enter the queue.

## [0.4.0] - 2026-08-17

### Added

- Scrubbed 33-node unified n8n workflow template.
- Configuration generator and optional REST import/update helper.
- Committed `rce_reports` Data Table schema.
- Automatic Warcraft Logs monitoring with live/stabilizing classification.
- Authenticated manual intake branch feeding the same ledger.
- Per-action CLA and RPB checkpoints with correlation-validated callbacks.
- Ten-minute checkpoint leases and watchdog recovery of only the failed stage.
- Completed-report and protected-state deduplication.
- Architecture, installation, operations, portal integration, and security documentation.
- Public-package validator and workflow-export scrubber.

### Changed

- CLA action map now calls the verified TBC functions directly and activates the matching sheet tab before execution.
- RPB action map now calls `generateAllSheet` followed by `generateRoleSheets` from the `All` tab.
- Repeated `setReportId` calls resume the same report lock instead of returning busy.
- Apps Script responses and callbacks now include report and correlation identifiers.
- Final successful export releases the project-local Apps Script lock.
- Public Apps Script GET responses no longer disclose spreadsheet identity or available actions.
- Example compose timezone is installation-neutral.

### Privacy

- Removed all live workflow, Data Table, credential, guild, report, domain, and Apps Script deployment identifiers from the committed workflow.
- Kept private portal and hosting/deployment tooling outside the repository.

## [0.3.1] - 2026-08-16

### Documentation

- Reframed automation around expansion-scoped lanes instead of separate manual and automatic systems.
- Documented the required execution order: CLA first, then RPB.
- Clarified that n8n owns the cross-sheet expansion lock and shared WarcraftLogs API-key lock.
- Clarified that sheet-side export logic owns public announcements; n8n owns orchestration and callbacks.

### Changed

- `CLA_Patch_n8n.gs` now keeps sheet-managed announcements enabled by default.
- `options.suppressCoreDiscord=true` can still mute the sheet webhook for a specific fallback/test run.

## [0.3.0] - 2026-05-09

### CLA_Patch_n8n.gs

### Added

- Final export Discord suppression by default, so Discord/Cloudflare 429 or 1015 responses do not fail an otherwise completed CLA export.
- `options.suppressCoreDiscord` override for requests that intentionally want to keep upstream Discord behavior.

### Documentation

- Moved automation patch docs into `n8n Automations/docs/`.
- Clarified upload targets, required Script Properties, and deployment checks.

## [0.2.0] - 2026-04-26

### CLA_Patch_n8n.gs

### Added

- `setReportId` action writes the WarcraftLogs report ID to `Instructions!E11` and acquires a per-document run lock.
- Run lock with 30-minute TTL stored in Script Properties.
- `runPasses` action runs enabled CLA passes sequentially, then appends final `runCLA` export.
- Per-pass enable/disable toggles in `CLA_PASS_ENABLED_`.
- `status` action returns lock and current report state.

### Changed

- Split the earlier `runGear` action into `runGearIssues` and `runGearListing`.
- Treated `runCLA` as the final compile/export step.

## [0.1.0] - 2026-04

### Added

- Initial `Shared_Config.gs`.
- Initial `CLA_Patch_n8n.gs`.
- Initial `RPB_Patch_n8n.gs`.
- RPB `runFull` sequence: `runAllSheet` then `runExport`.
- Lock release on success and failure.
- `status` actions.
