/**
 * CLA_Patch_n8n.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * n8n Remote Hook Patch for Combat Log Analytics (CLA)
 *
 * PURPOSE:
 *   Exposes this Apps Script project as a Web App so n8n can remotely trigger
 *   CLA analysis passes via HTTP POST. Supports running individual passes OR
 *   a configurable subset (matching the sheet's per-pass enable/disable system).
 *
 * REQUIREMENTS:
 *   - Upload Shared_Config.gs to this same Apps Script project first
 *   - Deploy as a Web App (Execute as: Me, Access: Anyone)
 *   - Must be deployed from within the CLA container-bound script project
 *
 * HOW TO CALL FROM n8n:
 *
 *   Run a single pass:
 *   POST { "action": "runFights", "secret": "...", "callbackUrl": "..." }
 *
 *   Run a selected subset of passes (like clicking START EXPORT in the sheet):
 *   POST {
 *     "action": "runPasses",
 *     "secret": "...",
 *     "callbackUrl": "...",
 *     "options": {
 *       "passes": ["runFights", "runGearIssues", "runGearListing", "runConsumables"],
 *       "stopOnError": false
 *     }
 *   }
 *
 * ⚠️  BEFORE DEPLOYING: Update CLA_ACTION_MAP_ below to match your actual
 *     function names. Use the Apps Script "Select function" dropdown to verify.
 *
 * Uploaded to: Combat Log Analytics Apps Script project
 * Version: 0.3.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ── Action Map ───────────────────────────────────────────────────────────────
 *
 * Maps action strings to the actual CLA function names in the project.
 * These action names match the passes visible in the CLA sheet:
 *   gear issues | gear listing | buff consumables | drums | validate | shadow resi | fights
 *
 * ⚠️  RIGHT SIDE VALUES MUST BE VERIFIED against your live Apps Script project.
 *     Left side (action keys) are fixed — n8n workflows depend on them.
 *     Only update the right side (function name strings) to match your project.
 *
 * To find your function names:
 *   Apps Script editor → "Select function" dropdown → lists all callable functions
 */
var CLA_ACTION_MAP_ = {
  // ── Individual passes (match the sheet's enable/disable checkboxes) ────────
  // These generate the individual tab sheets and must all complete before export.
  'runFights':      'runFightsOnly',      // ⚠️ VERIFY — sheet tab: "fights"
  'runGearIssues':  'runGearIssues',      // ⚠️ VERIFY — sheet tab: "gear issues"
  'runGearListing': 'runGearListing',     // ⚠️ VERIFY — sheet tab: "gear listing"
  'runConsumables': 'runConsumablesPass', // ⚠️ VERIFY — sheet tab: "buff consumables"
  'runDrums':       'runDrumsPass',       // ⚠️ VERIFY — sheet tab: "drums"
  'runSR':          'runSRPass',          // ⚠️ VERIFY — sheet tab: "shadow resi"
  'validate':       'validateSheetState', // ⚠️ VERIFY — sheet tab: "validate"

  // ── Final step — ALWAYS runs last after all individual passes ──────────────
  // This is the compile/export step. It must never appear in options.passes.
  // runPasses automatically appends this after all enabled passes complete.
  'runCLA':         'runFullCLA',         // ⚠️ VERIFY — final export/compile function
};

/**
 * ── Pass Toggles ─────────────────────────────────────────────────────────────
 *
 * Enable or disable individual passes without touching the action map or n8n.
 * Disabled passes return { status: 'skipped' } instantly — no API quota used.
 *
 * Set to false to skip a pass. n8n will continue to the next step normally.
 */
var CLA_PASS_ENABLED_ = {
  'runFights':      false, // sheet tab: "fights"       — set true to enable
  'runGearIssues':  true,  // sheet tab: "gear issues"
  'runGearListing': true,  // sheet tab: "gear listing"
  'runConsumables': true,  // sheet tab: "buff consumables"
  'runDrums':       true,  // sheet tab: "drums"
  'runSR':          false, // sheet tab: "shadow resi"  — set true to enable
  'validate':       false, // sheet tab: "validate"     — set true to enable
};

// The final compile/export action — always runs last, cannot be disabled.
var CLA_FINAL_STEP_ = 'runCLA';

/**
 * ── Active Pass List (auto-derived) ─────────────────────────────────────────
 *
 * Built from CLA_ACTION_MAP_ filtered by CLA_PASS_ENABLED_.
 * Toggle passes on/off in CLA_PASS_ENABLED_ above — no other changes needed.
 */
var CLA_DEFAULT_PASSES_ = Object.keys(CLA_ACTION_MAP_).filter(function(k) {
  return k !== CLA_FINAL_STEP_ && CLA_PASS_ENABLED_[k] !== false;
});

// ── Lock / State Keys (Script Properties) ────────────────────────────────────
// Prevents a new report ID being written to E11 while a run is in progress.
var CLA_LOCK_PROP_   = 'CLA_IS_RUNNING';    // 'true' | 'false'
var CLA_REPORT_PROP_ = 'CLA_CURRENT_REPORT'; // report ID currently loaded
var CLA_LOCK_TIME_   = 'CLA_LOCK_TIME';      // ISO timestamp when lock was acquired
var CLA_LOCK_TTL_MIN_ = 30;                  // minutes before a lock is considered stale
var CLA_INSTR_SHEET_ = 'Instructions';        // sheet name containing E11
var CLA_REPORT_CELL_ = 'E11';                 // cell the scripts read the report ID from
var CLA_SUPPRESS_CORE_DISCORD_DEFAULT_ = true; // prevent Discord 429s from failing final export


// ── Entry Points ─────────────────────────────────────────────────────────────

/**
 * Web App POST entry point.
 * Called by n8n via HTTP POST to the deployed web app URL.
 *
 * ── Single pass example ──
 * {
 *   "action": "runFights",
 *   "secret": "your-shared-secret",
 *   "callbackUrl": "https://autom8.yourdomain.com/webhook/cla-callback"
 * }
 *
 * ── Multi-pass (selective) example — mirrors the sheet's checkbox system ──
 * {
 *   "action": "runPasses",
 *   "secret": "your-shared-secret",
 *   "callbackUrl": "https://autom8.yourdomain.com/webhook/cla-callback",
 *   "options": {
 *     "passes": ["runFights", "runGearIssues", "runConsumables"],
 *     "stopOnError": false
 *   }
 * }
 *
 * @param {Object} e - Apps Script event object
 * @return {ContentService.TextOutput} JSON response
 */
function doPost(e) {
  var startTime = new Date();
  var body;

  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'Invalid JSON body', detail: err.message }, 400);
  }

  // ── Auth check ──
  if (!validateSecret_(body)) {
    return jsonResponse_({ error: 'Unauthorized' }, 401);
  }

  var action = body.action;
  var callbackUrl = body.callbackUrl || null;
  var options = body.options || {};

  // ── Status check ──
  if (action === 'status') {
    var ss = SpreadsheetApp.getActive();
    var props = PropertiesService.getScriptProperties();
    return jsonResponse_({
      status: 'ok',
      project: 'CLA',
      spreadsheetId: ss ? ss.getId() : 'NOT BOUND',
      spreadsheetName: ss ? ss.getName() : 'NOT BOUND',
      isRunning: props.getProperty(CLA_LOCK_PROP_) === 'true',
      currentReport: props.getProperty(CLA_REPORT_PROP_) || null,
      timestamp: startTime.toISOString(),
      availableActions: Object.keys(CLA_ACTION_MAP_).concat(['runPasses', 'setReportId', 'status']),
      defaultPassOrder: CLA_DEFAULT_PASSES_,
    });
  }

  // ── Set Report ID — writes to Instructions!E11 and acquires run lock ──
  if (action === 'setReportId') {
    var reportId = body.reportId;
    if (!reportId) {
      return jsonResponse_({ error: 'reportId is required' }, 400);
    }
    var lockProps = PropertiesService.getScriptProperties();
    if (lockProps.getProperty(CLA_LOCK_PROP_) === 'true') {
      var lockTime = lockProps.getProperty(CLA_LOCK_TIME_);
      var lockAgeMin = lockTime ? (new Date() - new Date(lockTime)) / 60000 : 0;
      if (lockAgeMin < CLA_LOCK_TTL_MIN_) {
        return jsonResponse_({
          error: 'Busy',
          message: 'A CLA run is already in progress. Wait for it to complete before queuing a new report.',
          currentReport: lockProps.getProperty(CLA_REPORT_PROP_) || null,
          lockAcquiredAt: lockTime || null,
          lockAgeMinutes: Math.round(lockAgeMin),
        }, 409);
      }
      // Stale lock — auto-release and continue
      verboseLog_('[CLA_Patch] Stale lock detected (' + Math.round(lockAgeMin) + ' min). Auto-releasing.');
      releaseLock_('CLA');
    }
    var ss_ = SpreadsheetApp.getActive();
    if (!ss_) {
      return jsonResponse_({ error: 'Not bound to a spreadsheet' }, 500);
    }
    var instrSheet = ss_.getSheetByName(CLA_INSTR_SHEET_);
    if (!instrSheet) {
      return jsonResponse_({ error: 'Sheet "' + CLA_INSTR_SHEET_ + '" not found in spreadsheet' }, 500);
    }
    instrSheet.getRange(CLA_REPORT_CELL_).setValue(reportId);
    SpreadsheetApp.flush();
    var lockNow = new Date().toISOString();
    lockProps.setProperty(CLA_LOCK_PROP_, 'true');
    lockProps.setProperty(CLA_REPORT_PROP_, reportId);
    lockProps.setProperty(CLA_LOCK_TIME_, lockNow);
    verboseLog_('[CLA_Patch] Report ID set: ' + reportId + ' → ' + CLA_INSTR_SHEET_ + '!' + CLA_REPORT_CELL_);
    return jsonResponse_({
      status: 'ok',
      message: 'Report ID written. Run lock acquired.',
      reportId: reportId,
      cell: CLA_INSTR_SHEET_ + '!' + CLA_REPORT_CELL_,
      lockAcquiredAt: lockNow,
      project: 'CLA',
    });
  }

  // ── Multi-pass mode — runs a selected subset, like the sheet's START EXPORT ──
  if (action === 'runPasses') {
    var acceptedMulti = jsonResponse_({
      status: 'accepted',
      action: 'runPasses',
      project: 'CLA',
      passes: options.passes || CLA_DEFAULT_PASSES_,
      timestamp: startTime.toISOString(),
    });
    var multiResult = executePassList_(options, startTime);
    if (callbackUrl) fireCallback_(callbackUrl, multiResult);
    return acceptedMulti;
  }

  // ── Single pass mode ──
  if (!CLA_ACTION_MAP_.hasOwnProperty(action)) {
    return jsonResponse_({
      error: 'Unknown action',
      received: action,
      available: Object.keys(CLA_ACTION_MAP_).concat(['runPasses', 'status']),
    }, 400);
  }

  var acceptedSingle = jsonResponse_({
    status: 'accepted',
    action: action,
    project: 'CLA',
    timestamp: startTime.toISOString(),
  });

  var result = executeAction_(action, options, startTime);
  if (callbackUrl) fireCallback_(callbackUrl, result);
  return acceptedSingle;
}

/**
 * Web App GET entry point — health/status check.
 * Visit this URL in a browser after deployment to verify the patch is live
 * and confirm which spreadsheet it is bound to.
 *
 * @param {Object} e - Apps Script event object
 * @return {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActive();
  return jsonResponse_({
    status: 'ok',
    project: 'CLA',
    version: '0.3.0',
    spreadsheetId: ss ? ss.getId() : 'NOT BOUND',
    spreadsheetName: ss ? ss.getName() : 'NOT BOUND',
    message: 'CLA n8n patch is deployed. POST to trigger passes.',
    availableActions: Object.keys(CLA_ACTION_MAP_).concat(['runPasses', 'status']),
    defaultPassOrder: CLA_DEFAULT_PASSES_,
    suppressCoreDiscordDefault: CLA_SUPPRESS_CORE_DISCORD_DEFAULT_,
    timestamp: new Date().toISOString(),
  });
}


// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Executes a list of passes sequentially — mirrors the CLA sheet's
 * enable/disable checkbox + START EXPORT button behaviour.
 *
 * Passes in options.passes must be valid action keys from CLA_ACTION_MAP_.
 * If options.passes is not provided, CLA_DEFAULT_PASSES_ is used.
 * If options.stopOnError is true, execution halts on the first failed pass.
 *
 * @param {Object} options    - options.passes (array), options.stopOnError (bool)
 * @param {Date}   startTime  - When the request was received
 * @return {Object} Aggregated result payload
 */
function executePassList_(options, startTime) {
  // Build the pass list — filter out runCLA if someone accidentally included it
  var requestedPasses = (options && Array.isArray(options.passes) && options.passes.length > 0)
    ? options.passes.filter(function(p) { return p !== CLA_FINAL_STEP_; })
    : CLA_DEFAULT_PASSES_;
  var stopOnError = options && options.stopOnError === true;

  var results = [];
  var overallStatus = 'complete';
  var totalErrors = [];
  var haltedEarly = false;

  verboseLog_('[CLA_Patch] Running pass list: ' + requestedPasses.join(', '));

  // ── Run all enabled individual passes first ──
  for (var i = 0; i < requestedPasses.length; i++) {
    var pass = requestedPasses[i];

    if (!CLA_ACTION_MAP_.hasOwnProperty(pass)) {
      results.push({
        action: pass,
        status: 'skipped',
        reason: 'Unknown action — not in CLA_ACTION_MAP_',
        duration_ms: 0,
      });
      verboseLog_('[CLA_Patch] Skipped unknown pass: ' + pass);
      continue;
    }

    var passStart = new Date();
    var passResult = executeAction_(pass, options, passStart);
    results.push(passResult);

    if (passResult.status === 'error') {
      overallStatus = 'error';
      totalErrors = totalErrors.concat(passResult.errors || []);
      verboseLog_('[CLA_Patch] Pass failed: ' + pass);
      if (stopOnError) {
        verboseLog_('[CLA_Patch] stopOnError=true — halting before final step.');
        haltedEarly = true;
        break;
      }
    }
  }

  // ── Always run the final compile/export step last ──────────────────────────
  // Mirrors the sheet: individual tab generation completes, THEN export runs.
  // Skipped only if stopOnError=true and a pass already failed.
  if (!haltedEarly) {
    verboseLog_('[CLA_Patch] Running final step: ' + CLA_FINAL_STEP_);
    var finalStart = new Date();
    var finalResult = executeAction_(CLA_FINAL_STEP_, options, finalStart);
    finalResult.isFinalStep = true;
    results.push(finalResult);

    if (finalResult.status === 'error') {
      overallStatus = 'error';
      totalErrors = totalErrors.concat(finalResult.errors || []);
    } else {
      // Export succeeded — release the run lock so the next report can be queued
      releaseLock_('CLA');
    }
  } else {
    results.push({
      action: CLA_FINAL_STEP_,
      status: 'skipped',
      reason: 'Earlier pass failed with stopOnError=true',
      isFinalStep: true,
      duration_ms: 0,
    });
    // Halted early — release lock so the failure doesn't permanently block the queue
    releaseLock_('CLA');
  }

  return {
    action: 'runPasses',
    project: 'CLA',
    passes: requestedPasses,
    finalStep: CLA_FINAL_STEP_,
    passResults: results,
    status: overallStatus,
    errors: totalErrors,
    duration_ms: new Date() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Executes a single mapped CLA action.
 *
 * @param {string} action   - Action name from CLA_ACTION_MAP_
 * @param {Object} options  - Options from the request body
 * @param {Date} startTime  - When this pass started
 * @return {Object} Result payload
 */
function executeAction_(action, options, startTime) {
  var fnName = CLA_ACTION_MAP_[action];
  var result = {
    action: action,
    project: 'CLA',
    functionCalled: fnName,
    status: 'unknown',
    errors: [],
    duration_ms: 0,
    timestamp: new Date().toISOString(),
  };

  // ── Toggle check — skip instantly if disabled in CLA_PASS_ENABLED_ ──────────
  if (CLA_PASS_ENABLED_.hasOwnProperty(action) && CLA_PASS_ENABLED_[action] === false) {
    result.status = 'skipped';
    result.duration_ms = new Date() - startTime;
    verboseLog_('[CLA_Patch] Skipped (disabled): ' + action);
    return result;
  }

  verboseLog_('[CLA_Patch] Executing: ' + action + ' → ' + fnName);

  try {
    if (typeof this[fnName] === 'function') {
      if (shouldSuppressCoreDiscord_(action, options)) {
        runWithCoreDiscordMuted_(function() {
          this[fnName](options);
        }.bind(this));
        result.coreDiscordSuppressed = true;
      } else {
        this[fnName](options);
      }
      result.status = 'complete';
    } else {
      var notFoundErr = 'Function "' + fnName + '" not found in global scope. '
        + 'Update CLA_ACTION_MAP_ in CLA_Patch_n8n.gs to match your project\'s function names. '
        + 'Use the Apps Script editor "Select function" dropdown to see available functions.';
      result.status = 'error';
      result.errors.push(notFoundErr);
      result.errorPayload = buildErrorPayload_(action, 'CLA', new Error(notFoundErr));
      verboseLog_(notFoundErr);
    }
  } catch (err) {
    result.status = 'error';
    result.errors.push(err.message || String(err));
    result.errorPayload = buildErrorPayload_(action, 'CLA', err);
    verboseLog_('[CLA_Patch] Error in ' + action + ' [' + result.errorPayload.error.type + ']: ' + err.message);
  }

  result.duration_ms = new Date() - startTime;
  verboseLog_('[CLA_Patch] Done: ' + action + ' in ' + result.duration_ms + 'ms | ' + result.status);
  return result;
}

/**
 * Returns true when the final CLA export should run with the sheet-level
 * Discord webhook temporarily cleared. This keeps Discord/Cloudflare 429s from
 * causing a successful spreadsheet export to be reported as failed.
 *
 * Default: true for runCLA. Set options.suppressCoreDiscord=false to use the
 * upstream CLA Discord behavior.
 *
 * @param {string} action
 * @param {Object} options
 * @return {boolean}
 */
function shouldSuppressCoreDiscord_(action, options) {
  if (action !== CLA_FINAL_STEP_) return false;
  if (options && options.suppressCoreDiscord === false) return false;
  return CLA_SUPPRESS_CORE_DISCORD_DEFAULT_ === true;
}

/**
 * Runs a function while temporarily clearing the Discord webhook configured in
 * the CLA Instructions sheet, then restores the value. The core CLA exporter
 * reads this cell near the start of exportSheets(); when blank, it skips its
 * direct Discord POST but still creates and publishes the export spreadsheet.
 *
 * @param {Function} fn
 */
function runWithCoreDiscordMuted_(fn) {
  var webhookRange = getCoreDiscordWebhookRange_();
  var originalValue = null;
  var hadWebhookRange = webhookRange !== null;

  try {
    if (hadWebhookRange) {
      originalValue = webhookRange.getValue();
      if (originalValue !== null && originalValue.toString().length > 0) {
        webhookRange.setValue('');
        SpreadsheetApp.flush();
        verboseLog_('[CLA_Patch] Core Discord webhook muted for final export.');
      }
    }
    fn();
  } finally {
    if (hadWebhookRange) {
      webhookRange.setValue(originalValue);
      SpreadsheetApp.flush();
      verboseLog_('[CLA_Patch] Core Discord webhook restored after final export.');
    }
  }
}

/**
 * Finds the CLA Instructions cell that stores the Discord webhook. In the core
 * sheet this is the value four columns right of the "5." instruction marker.
 *
 * @return {Range|null}
 */
function getCoreDiscordWebhookRange_() {
  try {
    var ss = SpreadsheetApp.getActive();
    var instructionsSheet = ss ? ss.getSheetByName(CLA_INSTR_SHEET_) : null;
    if (!instructionsSheet) return null;

    var marker = instructionsSheet
      .createTextFinder('^5.$')
      .useRegularExpression(true)
      .findNext();
    if (!marker) return null;

    return shiftRangeByColumns(instructionsSheet, marker, 4);
  } catch (err) {
    Logger.log('[CLA_Patch_n8n] Could not locate core Discord webhook cell: ' + err.message);
    return null;
  }
}

/**
 * POSTs the result payload back to the n8n callback webhook URL.
 *
 * @param {string} callbackUrl
 * @param {Object} result
 */
function fireCallback_(callbackUrl, result) {
  // For multi-pass runs use the aggregate status, not per-pass errorPayload
  var hasStructuredError = result.status === 'error'
    && result.errorPayload
    && !result.passResults; // only for single-pass errors

  if (hasStructuredError) {
    result.errorPayload.duration_ms = result.duration_ms;
    reportErrorToN8n_(callbackUrl, result.errorPayload);
  } else {
    try {
      UrlFetchApp.fetch(callbackUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(result),
        muteHttpExceptions: true,
      });
      verboseLog_('[CLA_Patch] Callback fired to: ' + callbackUrl);
    } catch (err) {
      Logger.log('[CLA_Patch_n8n] Callback failed: ' + err.message);
      reportErrorToN8n_(callbackUrl, buildErrorPayload_(result.action, 'CLA', err));
    }
  }
}

/**
 * Creates a JSON ContentService response.
 *
 * @param {Object} data
 * @param {number} [statusHint]
 * @return {ContentService.TextOutput}
 */
function jsonResponse_(data, statusHint) {
  if (statusHint && statusHint !== 200) {
    verboseLog_('Returning error response [' + statusHint + ']: ' + JSON.stringify(data));
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Lock Helpers ─────────────────────────────────────────────────────────────

/**
 * Releases the CLA run lock so the next report can be queued.
 * Called after a successful final export, or after a halted-early failure.
 *
 * @param {string} context - Label for log messages (e.g. 'CLA')
 */
function releaseLock_(context) {
  try {
    PropertiesService.getScriptProperties().deleteProperty(CLA_LOCK_PROP_);
    verboseLog_('[' + (context || 'CLA_Patch') + '] Run lock released.');
  } catch (err) {
    Logger.log('[CLA_Patch_n8n] Failed to release lock: ' + err.message);
  }
}
