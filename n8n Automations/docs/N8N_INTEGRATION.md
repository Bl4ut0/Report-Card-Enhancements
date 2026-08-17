# n8n Integration Contract

This document is the HTTP contract between n8n and the Apps Script adapters. For installation instructions, see [AUTOMATION_SETUP.md](AUTOMATION_SETUP.md). For queue behavior, see [AUTOMATION_ARCHITECTURE.md](AUTOMATION_ARCHITECTURE.md).

## Apps Script Authentication

Every POST from n8n includes the shared `secret` body field. The value is injected by an n8n HTTP Custom Auth credential and compared with the Apps Script `N8N_SECRET` Script Property.

## Set Report ID and Acquire the Sheet Lock

```json
{
  "action": "setReportId",
  "secret": "injected-by-n8n-credential",
  "reportId": "AbCdEf123456GhJk"
}
```

The adapter writes `Instructions!E11` and acquires its project-local lock. Calling it again for the same report refreshes/resumes the lock. A different report receives a busy response until the lock expires or is released.

## Run One CLA Checkpoint

```json
{
  "action": "runGearIssues",
  "secret": "injected-by-n8n-credential",
  "reportId": "AbCdEf123456GhJk",
  "correlationId": "opaque-execution-correlation",
  "callbackUrl": "https://n8n.example.com/webhook/rce/v2/callback/cla-action",
  "options": {
    "suppressCoreDiscord": false
  }
}
```

Valid CLA checkpoint actions are:

```text
runGearIssues
runGearListing
runConsumables
runDrums
runSR
runCLA
```

`runCLA` is the final CLA export and releases the CLA lock on success.

## Run One RPB Checkpoint

```json
{
  "action": "runAllSheet",
  "secret": "injected-by-n8n-credential",
  "reportId": "AbCdEf123456GhJk",
  "correlationId": "opaque-execution-correlation",
  "callbackUrl": "https://n8n.example.com/webhook/rce/v2/callback/rpb-action"
}
```

Valid RPB checkpoint actions are `runAllSheet` and `runExport`. `runExport` releases the RPB lock on success.

## Callback Shape

```json
{
  "project": "CLA",
  "action": "runGearIssues",
  "callbackStage": "CLA_ACTION_COMPLETE",
  "reportId": "AbCdEf123456GhJk",
  "correlationId": "opaque-execution-correlation",
  "status": "complete",
  "duration_ms": 12345
}
```

n8n validates the project, stage marker, action expected for the current ledger stage, report code, and correlation ID. Stale or out-of-order callbacks do not advance the report.

## Manual Intake Shape

```json
{
  "reportId": "AbCdEf123456GhJk",
  "source": "trusted-portal",
  "requestedBy": "authorized-user"
}
```

The request must use the configured `X-RCE-Intake-Key` Header Auth credential. The endpoint returns either a newly queued state or the existing protected/completed state.

## Ownership

- n8n owns discovery, the ledger, ordering, deduplication, checkpoint selection, correlation, leases, and retry decisions.
- CLA/RPB Apps Script owns sheet execution and project-local locks.
- the sheet export path owns final Discord announcements.
- an optional external portal owns user identity and authorization.
