# Rate Limiting Model

The WCL Proxy is a pacing and retry layer, not a limit bypass.

## Problems This Helps With

- Bursty Apps Script requests that trigger Warcraft Logs `429` responses.
- Transient upstream `502`, `503`, or `504` responses.
- Duplicate reads during a single report run.
- Missing `Retry-After` handling in source-level CLA/RPB calls.

## Problems This Does Not Magically Solve

- A true Warcraft Logs quota exhaustion.
- A blocked or heavily rate-limited shared egress IP.
- Too many concurrent report runs from automation.
- V1 source code that still performs direct `UrlFetchApp.fetch()` calls.

## Recommended Control Layers

Use all of these together:

| Layer | Responsibility |
|---|---|
| n8n expansion queue | Prevents multiple reports from mutating the same expansion lane at once. |
| n8n Warcraft Logs API lock | Prevents CLA/RPB and monitor jobs from burning the same credential concurrently. |
| WCL Proxy Worker | Handles bounded retries, `Retry-After`, optional safe caching, and future request queueing. |
| V2 Wrapper | Routes source-level WCL calls through compatibility helpers instead of direct URLs. |

## Future Queue Design

If retries and caching are not enough, add a Durable Object queue keyed by one of:

- `credentialHash`
- `expansion`
- `reportCode`
- `expansion + reportCode`

That queue should serialize requests, enforce a minimum delay between upstream fetches, and surface clear `429`/backoff state to Apps Script or n8n.

