# Automations Changelog

Automation patches are pre-1.0. Version numbers describe iteration state, not a stable public API.

## [0.3.0] - 2026-05-09

### CLA_Patch_n8n.gs

### Added

- Final export Discord suppression by default, so Discord/Cloudflare 429 or 1015 responses do not fail an otherwise completed CLA export.
- `options.suppressCoreDiscord` override for requests that intentionally want to keep upstream Discord behavior.

### Documentation

- Moved automation patch docs into `Automations/docs/`.
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
