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
| WCL Proxy Worker | Handles bounded retries, `Retry-After`, and SHA-256 caching with fallback-on-error. |
| V2 Wrapper | Routes source-level WCL calls through compatibility helpers with client-side request pacing. |

## Client-Side Pacing Design

Request pacing and serialization is enforced client-side inside `WCL_Compat.gs` (e.g. via `Utilities.sleep` using the configurable `WCL_MIN_FETCH_INTERVAL_MS`). 

Worker-side queuing or Durable Objects are not used because:
1. **Free Tier Compatibility**: Durable Objects require a paid Cloudflare subscription, whereas this project is designed to run entirely within the free tier.
2. **Resource Efficiency**: Sleeping inside Worker threads holds HTTP connections open, wasting active CPU time and exceeding free-tier isolate execution limits. Apps Script is well-suited to handle sequential client-side delays during execution.

