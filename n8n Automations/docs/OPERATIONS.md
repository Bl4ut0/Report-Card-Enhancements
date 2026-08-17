# Operations and Recovery

## Normal Operation

After activation, the workflow is autonomous: the monitor checks Warcraft Logs every five minutes, the watchdog checks the queue every minute, eligible logs enter `QUEUED`, one report advances through CLA and RPB, callbacks advance checkpoints, and completed report codes remain deduplicated.

Manual intake is optional. It feeds the same ledger and never creates a separate processing lane.

## State Reference

| State | Meaning |
|---|---|
| `DISCOVERED` | Report exists but does not yet have enough combat data. |
| `LIVE` | The report appears to be actively changing. |
| `STABILIZING` | The report has combat data but is waiting for its stability window. |
| `QUEUED` | Eligible and waiting behind any active report. |
| `CLA_RUNNING` | A CLA checkpoint owns the lane. |
| `RPB_RUNNING` | An RPB checkpoint owns the lane. |
| `COMPLETE` | Both exports completed; future discovery/intake is deduplicated. |

## Timeout Recovery

When a stage exceeds its lease, the watchdog selects the active expired row, preserves the report and correlation context, increments the stage attempt counter, and dispatches the same stage again.

Do not manually reset a row while its Apps Script execution is still running. First confirm the Apps Script execution has ended or exceeded its platform limit.

## Safe Manual Recovery

1. Deactivate the unified workflow if multiple executions are unexpectedly dispatching work.
2. Check the Apps Script execution history for CLA and RPB.
3. Inspect `stage`, `correlation_id`, `lease_expires_at`, `last_error`, and `stage_attempt_count` in the ledger.
4. Correct the underlying credential, deployment, action-map, or sheet error.
5. Preserve completed stages; set only the failed report back to the appropriate running stage with an expired lease.
6. Reactivate the unified workflow and allow the watchdog to retry.

## Duplicate Reports

Rows in `QUEUED`, `CLA_RUNNING`, `RPB_RUNNING`, or `COMPLETE` are protected from duplicate manual intake. The monitor also ignores completed report codes.

Do not delete completed rows merely to reduce table size unless an external archive retains the report codes; the completed ledger is the deduplication history.

## Legacy Workflow Cleanup

Only one unified RCE coordinator should be active for a sheet pair. Archive older standalone queue, scanner, or intake workflows after migration. Keeping inactive exports for rollback is safe.

## Recommended Alerts

Add alerts for repeated stage attempts, unexpectedly old leases, Warcraft Logs OAuth failures, Apps Script busy responses, callback validation errors, and a queue that remains non-empty without progress.
