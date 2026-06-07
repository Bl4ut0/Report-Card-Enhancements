/**
 * Shared_Config.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared configuration and utilities for all CustomReportCards patch files.
 *
 * USAGE:
 *   var config = getConfig();
 *   Logger.log(config.N8N_SECRET);
 *
 *   // Report an error back to n8n:
 *   reportErrorToN8n_(callbackUrl, buildError_('runFull', err, 429));
 *
 *   // Fetch with 429 retry:
 *   var response = fetchWithRetry_(url, options);
 *
 * SETUP:
 *   Replace the placeholder values below with your actual values before deploying.
 *   Do NOT commit real secrets to version control.
 *
 * Uploaded to: CLA project AND RPB project (both need this file)
 * Version: 0.1.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Returns the shared configuration object.
 * Values can be overridden by Script Properties (recommended for secrets).
 *
 * To set Script Properties:
 *   Apps Script Editor → Project Settings → Script Properties
 *   Add key: N8N_SECRET, value: your-secret-here
 *
 * @return {Object} Configuration object
 */
function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    // ── Security ─────────────────────────────────────────────────────────────
    // Shared secret that n8n must include in every POST request.
    // Set via Script Properties key "N8N_SECRET" (preferred) or hardcode below.
    N8N_SECRET: props.getProperty('N8N_SECRET') || 'REPLACE_ME_WITH_YOUR_SECRET',

    // ── Logging ───────────────────────────────────────────────────────────────
    // Set to true to write verbose execution logs to Apps Script Logger
    VERBOSE_LOGGING: (props.getProperty('VERBOSE_LOGGING') || 'false') === 'true',

    // ── Sheet Config ──────────────────────────────────────────────────────────
    // The ID of the Google Sheet this project is bound to.
    // Usually not needed (use SpreadsheetApp.getActiveSpreadsheet()) but useful
    // if triggering cross-sheet writes from a standalone script.
    SHEET_ID: props.getProperty('SHEET_ID') || null,
  };
}

/**
 * Validates that the incoming n8n request contains the correct shared secret.
 *
 * @param {Object} body - Parsed JSON body from doPost
 * @return {boolean} True if secret is valid
 */
function validateSecret_(body) {
  var config = getConfig();
  if (!body || body.secret !== config.N8N_SECRET) {
    return false;
  }
  return true;
}

/**
 * Logs a message to the Apps Script Logger if VERBOSE_LOGGING is enabled.
 *
 * @param {string} message
 */
function verboseLog_(message) {
  var config = getConfig();
  if (config.VERBOSE_LOGGING) {
    Logger.log('[CustomReportCards Patch] ' + message);
  }
}


// ── Error Reporting ──────────────────────────────────────────────────────────

/**
 * Builds a structured error payload for n8n consumption.
 * Includes error classification so n8n workflows can branch on error type.
 *
 * @param {string} action       - The action that was being executed
 * @param {string} project      - 'CLA' or 'RPB'
 * @param {Error|string} err    - The caught error
 * @param {Object} [meta]       - Optional extra metadata
 * @return {Object} Structured error payload
 */
function buildErrorPayload_(action, project, err, meta) {
  var message = (err && err.message) ? err.message : String(err);
  var errorType = classifyError_(message);

  return {
    status: 'error',
    action: action,
    project: project,
    error: {
      type: errorType,
      message: message,
      is429: errorType === 'RATE_LIMITED',
      isTimeout: errorType === 'TIMEOUT',
      isAuthFailure: errorType === 'AUTH_FAILURE',
      raw: String(err),
    },
    meta: meta || {},
    timestamp: new Date().toISOString(),
  };
}

/**
 * Classifies an error message into a known error type string.
 * Used by n8n to branch workflows on specific failure conditions.
 *
 * @param {string} message
 * @return {string} Error type constant
 */
function classifyError_(message) {
  var msg = (message || '').toLowerCase();
  if (msg.indexOf('429') !== -1 || msg.indexOf('rate limit') !== -1 || msg.indexOf('too many requests') !== -1) {
    return 'RATE_LIMITED';
  }
  if (msg.indexOf('deadline') !== -1 || msg.indexOf('timeout') !== -1 || msg.indexOf('timed out') !== -1) {
    return 'TIMEOUT';
  }
  if (msg.indexOf('401') !== -1 || msg.indexOf('403') !== -1 || msg.indexOf('unauthorized') !== -1 || msg.indexOf('forbidden') !== -1) {
    return 'AUTH_FAILURE';
  }
  if (msg.indexOf('not found') !== -1 || msg.indexOf('404') !== -1) {
    return 'NOT_FOUND';
  }
  if (msg.indexOf('is not a function') !== -1 || msg.indexOf('is not defined') !== -1) {
    return 'FUNCTION_NOT_FOUND';
  }
  return 'UNKNOWN';
}

/**
 * POSTs an error payload to an n8n callback URL.
 * Used to ensure n8n always receives a response — even on failure.
 * This prevents n8n workflows from hanging on missing callbacks.
 *
 * @param {string} callbackUrl  - n8n webhook URL to receive the error
 * @param {Object} errorPayload - Built via buildErrorPayload_()
 */
function reportErrorToN8n_(callbackUrl, errorPayload) {
  if (!callbackUrl) {
    Logger.log('[Patch] No callbackUrl — error not reported to n8n: ' + JSON.stringify(errorPayload));
    return;
  }
  try {
    UrlFetchApp.fetch(callbackUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(errorPayload),
      muteHttpExceptions: true,
    });
    verboseLog_('Error payload sent to n8n: ' + errorPayload.error.type);
  } catch (fetchErr) {
    Logger.log('[Patch] Failed to report error to n8n: ' + fetchErr.message);
  }
}


// ── Rate Limit Safe Fetch ────────────────────────────────────────────────────

/**
 * Wraps UrlFetchApp.fetch() with automatic 429 retry + exponential backoff.
 * Use this for any external API calls within patch files (Discord, Warcraft Logs, etc.)
 *
 * @param {string} url
 * @param {Object} options          - UrlFetchApp options object
 * @param {number} [maxRetries=3]   - Max number of retry attempts on 429
 * @return {HTTPResponse|null}      - The response, or null if all retries exhausted
 */
function fetchWithRetry_(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  var attempt = 0;
  var baseDelayMs = 1000; // 1 second base

  while (attempt <= maxRetries) {
    try {
      var response = UrlFetchApp.fetch(url, options || {});
      var code = response.getResponseCode();

      if (code === 429) {
        // Try to read Retry-After header (Discord sends this)
        var retryAfter = null;
        try {
          var headers = response.getHeaders();
          retryAfter = headers['Retry-After'] || headers['retry-after'] || null;
        } catch (e) { /* headers not accessible */ }

        var waitMs = retryAfter
          ? (parseFloat(retryAfter) * 1000)
          : (baseDelayMs * Math.pow(2, attempt)); // exponential: 1s, 2s, 4s

        Logger.log('[Patch] 429 Rate Limited on attempt ' + (attempt + 1) + '. Waiting ' + waitMs + 'ms...');
        Utilities.sleep(waitMs);
        attempt++;
        continue;
      }

      return response; // success or non-429 error — return as-is

    } catch (err) {
      Logger.log('[Patch] fetchWithRetry_ exception on attempt ' + (attempt + 1) + ': ' + err.message);
      if (attempt >= maxRetries) return null;
      Utilities.sleep(baseDelayMs * Math.pow(2, attempt));
      attempt++;
    }
  }

  Logger.log('[Patch] fetchWithRetry_ exhausted all ' + maxRetries + ' retries for: ' + url);
  return null;
}
