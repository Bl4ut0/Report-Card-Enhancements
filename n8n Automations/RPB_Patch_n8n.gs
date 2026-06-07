/**
 * RPB_Patch_n8n.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * n8n Remote Hook Patch for Role Performance Breakdown (RPB)
 *
 * PURPOSE:
 *   Exposes this Apps Script project as a Web App so n8n can remotely trigger
 *   RPB generation runs via HTTP POST. Results are posted back to an n8n webhook
 *   callback URL provided in the request body.
 *
 * REQUIREMENTS:
 *   - Upload Shared_Config.gs to this same Apps Script project first
 *   - Deploy as a Web App (Execute as: Me, Access: Anyone)
 *   - This file must be deployed from WITHIN the container-bound script project
 *     (i.e. added to the same Apps Script project as RPB.gs / Helpers.gs etc.)
 *
 * DOES NOT MODIFY:
 *   Any core RPB files. This file only calls existing global functions.
 *
 * NO CONFIGURATION NEEDED:
 *   Because this patch is deployed as a Web App from a container-bound script,
 *   SpreadsheetApp.getActive() automatically returns the bound spreadsheet.
 *   The same patch file works for any RPB document — no spreadsheet IDs to set.
 *
 * Uploaded to: Role Performance Breakdown V1.6.0 Apps Script project
 * Version: 0.2.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * ── Action Map ───────────────────────────────────────────────────────────────
 *
 * Maps action strings (sent by n8n) to the actual top-level RPB functions.
 *
 * ⚠️  VERIFY THESE FUNCTION NAMES match what exists in the live Apps Script project.
 *
 * RPB has a strict two-phase execution order:
 *   Phase 1 — 'runAllSheet': generates the raw data into the All sheet
 *   Phase 2 — 'runExport':   processes and exports to the individual report document
 *
 * Use 'runFull' to execute both phases automatically in the correct order.
 *
 * ⚠️  RIGHT SIDE VALUES MUST BE VERIFIED against your live Apps Script project.
 */
var RPB_ACTION_MAP_ = {
  // ── Phase 1: Data generation — runs first ─────────────────────────────────
  'runAllSheet':  'generateAllSheet',   // ⚠️ VERIFY — generates the All sheet data

  // ── Phase 2: Export — always runs after runAllSheet ───────────────────────
  'runExport':    'generateRoleSheets', // ⚠️ VERIFY — exports to the report document
};

// Phase sequence for 'runFull' — order is enforced, cannot be changed via options.
var RPB_PHASE_SEQUENCE_ = ['runAllSheet', 'runExport'];

// ── Lock / State Keys (Script Properties) ────────────────────────────────────
// Prevents a new report ID being written to E11 while a run is in progress.
var RPB_LOCK_PROP_    = 'RPB_IS_RUNNING';    // 'true' | 'false'
var RPB_REPORT_PROP_  = 'RPB_CURRENT_REPORT'; // report ID currently loaded
var RPB_LOCK_TIME_    = 'RPB_LOCK_TIME';      // ISO timestamp when lock was acquired
var RPB_LOCK_TTL_MIN_ = 30;                   // minutes before a lock is considered stale
var RPB_INSTR_SHEET_  = 'Instructions';        // sheet name containing E11
var RPB_REPORT_CELL_  = 'E11';                 // cell the scripts read the report ID from
// NOTE: E9 = WarcraftLogs API token, E15 = Discord webhook — both read by scripts, not touched here.


// ── Entry Points ─────────────────────────────────────────────────────────────

/**
 * Web App POST entry point.
 * Called by n8n via HTTP POST to the deployed web app URL.
 *
 * Expected body (JSON):
 * {
 *   "action": "runAllSheet",
 *   "secret": "your-shared-secret",
 *   "callbackUrl": "https://your-n8n.com/webhook/...",   // optional
 *   "options": {}                                         // optional
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
      project: 'RPB',
      spreadsheetId: ss ? ss.getId() : 'NOT BOUND',
      spreadsheetName: ss ? ss.getName() : 'NOT BOUND',
      isRunning: props.getProperty(RPB_LOCK_PROP_) === 'true',
      currentReport: props.getProperty(RPB_REPORT_PROP_) || null,
      timestamp: startTime.toISOString(),
      availableActions: Object.keys(RPB_ACTION_MAP_).concat(['runFull', 'setReportId', 'status']),
      phaseSequence: RPB_PHASE_SEQUENCE_,
    });
  }

  // ── Set Report ID — writes to Instructions!E11 and acquires run lock ──
  if (action === 'setReportId') {
    var reportId = body.reportId;
    if (!reportId) {
      return jsonResponse_({ error: 'reportId is required' }, 400);
    }
    var lockProps = PropertiesService.getScriptProperties();
    if (lockProps.getProperty(RPB_LOCK_PROP_) === 'true') {
      var lockTime = lockProps.getProperty(RPB_LOCK_TIME_);
      var lockAgeMin = lockTime ? (new Date() - new Date(lockTime)) / 60000 : 0;
      if (lockAgeMin < RPB_LOCK_TTL_MIN_) {
        return jsonResponse_({
          error: 'Busy',
          message: 'An RPB run is already in progress. Wait for it to complete before queuing a new report.',
          currentReport: lockProps.getProperty(RPB_REPORT_PROP_) || null,
          lockAcquiredAt: lockTime || null,
          lockAgeMinutes: Math.round(lockAgeMin),
        }, 409);
      }
      // Stale lock — auto-release and continue
      verboseLog_('[RPB_Patch] Stale lock detected (' + Math.round(lockAgeMin) + ' min). Auto-releasing.');
      releaseLock_();
    }
    var ss_ = SpreadsheetApp.getActive();
    if (!ss_) {
      return jsonResponse_({ error: 'Not bound to a spreadsheet' }, 500);
    }
    var instrSheet = ss_.getSheetByName(RPB_INSTR_SHEET_);
    if (!instrSheet) {
      return jsonResponse_({ error: 'Sheet "' + RPB_INSTR_SHEET_ + '" not found in spreadsheet' }, 500);
    }
    instrSheet.getRange(RPB_REPORT_CELL_).setValue(reportId);
    SpreadsheetApp.flush();
    var lockNow = new Date().toISOString();
    lockProps.setProperty(RPB_LOCK_PROP_, 'true');
    lockProps.setProperty(RPB_REPORT_PROP_, reportId);
    lockProps.setProperty(RPB_LOCK_TIME_, lockNow);
    verboseLog_('[RPB_Patch] Report ID set: ' + reportId + ' → ' + RPB_INSTR_SHEET_ + '!' + RPB_REPORT_CELL_);
    return jsonResponse_({
      status: 'ok',
      message: 'Report ID written. Run lock acquired.',
      reportId: reportId,
      cell: RPB_INSTR_SHEET_ + '!' + RPB_REPORT_CELL_,
      lockAcquiredAt: lockNow,
      project: 'RPB',
    });
  }

  // ── Full two-phase run (generate data → export) ──
  if (action === 'runFull' || action === 'runRPB') {
    var acceptedFull = jsonResponse_({
      status: 'accepted',
      action: 'runFull',
      project: 'RPB',
      phases: RPB_PHASE_SEQUENCE_,
      timestamp: startTime.toISOString(),
    });
    var fullResult = executePhasedRun_(startTime);
    if (callbackUrl) fireCallback_(callbackUrl, fullResult);
    return acceptedFull;
  }

  // ── Validate single action ──
  if (!RPB_ACTION_MAP_.hasOwnProperty(action)) {
    return jsonResponse_({
      error: 'Unknown action',
      received: action,
      available: Object.keys(RPB_ACTION_MAP_).concat(['runFull', 'status']),
    }, 400);
  }

  // ── Respond immediately ──
  var acceptedResponse = jsonResponse_({
    status: 'accepted',
    action: action,
    project: 'RPB',
    timestamp: startTime.toISOString(),
  });

  // ── Execute the action ──
  var result = executeAction_(action, options, startTime);

  // ── Fire callback ──
  if (callbackUrl) {
    fireCallback_(callbackUrl, result);
  }

  return acceptedResponse;
}

/**
 * Web App GET entry point — health/status check.
 * Also reports which spreadsheet this Web App is bound to.
 *
 * @param {Object} e - Apps Script event object
 * @return {ContentService.TextOutput} JSON response
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActive();
  return jsonResponse_({
    status: 'ok',
    project: 'RPB',
    version: '0.2.0',
    spreadsheetId: ss ? ss.getId() : 'NOT BOUND',
    spreadsheetName: ss ? ss.getName() : 'NOT BOUND',
    message: 'RPB n8n patch is deployed. POST to trigger actions.',
    availableActions: Object.keys(RPB_ACTION_MAP_).concat(['runFull', 'status']),
    phaseSequence: RPB_PHASE_SEQUENCE_,
    note: 'Use runFull to run both phases in order: generate data then export.',
    timestamp: new Date().toISOString(),
  });
}


// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Executes the full RPB two-phase run in the correct order:
 *   Phase 1: runAllSheet — generates raw data into the All sheet
 *   Phase 2: runExport   — processes and exports to the report document
 *
 * Phase 2 only runs if Phase 1 succeeds.
 *
 * @param {Date} startTime
 * @return {Object} Aggregated result payload
 */
function executePhasedRun_(startTime) {
  var results = [];
  var overallStatus = 'complete';
  var totalErrors = [];

  for (var i = 0; i < RPB_PHASE_SEQUENCE_.length; i++) {
    var phase = RPB_PHASE_SEQUENCE_[i];
    verboseLog_('[RPB_Patch] Running phase ' + (i + 1) + ': ' + phase);

    var phaseStart = new Date();
    var phaseResult = executeAction_(phase, {}, phaseStart);
    phaseResult.phase = i + 1;
    results.push(phaseResult);

    if (phaseResult.status === 'error') {
      overallStatus = 'error';
      totalErrors = totalErrors.concat(phaseResult.errors || []);
      // Stop — don't run export if data generation failed
      verboseLog_('[RPB_Patch] Phase ' + (i + 1) + ' failed — halting.');
      // Mark remaining phases as skipped
      for (var j = i + 1; j < RPB_PHASE_SEQUENCE_.length; j++) {
        results.push({
          action: RPB_PHASE_SEQUENCE_[j],
          phase: j + 1,
          status: 'skipped',
          reason: 'Previous phase failed',
          duration_ms: 0,
        });
      }
      break;
    }
  }

  // Release lock regardless of outcome — failure shouldn't permanently block the queue
  releaseLock_();

  return {
    action: 'runFull',
    project: 'RPB',
    phases: RPB_PHASE_SEQUENCE_,
    phaseResults: results,
    status: overallStatus,
    errors: totalErrors,
    duration_ms: new Date() - startTime,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Releases the RPB run lock.
 * Called after both phases complete (success or failure).
 */
function releaseLock_() {
  try {
    PropertiesService.getScriptProperties().deleteProperty(RPB_LOCK_PROP_);
    verboseLog_('[RPB_Patch] Run lock released.');
  } catch (err) {
    Logger.log('[RPB_Patch_n8n] Failed to release lock: ' + err.message);
  }
}

/**
 * Executes a mapped RPB action.
 *
 * Container-bound Web Apps automatically have SpreadsheetApp.getActive() context
 * set to the bound spreadsheet — no manual openById() required.
 *
 * @param {string} action - Action name from RPB_ACTION_MAP_
 * @param {Object} options - Options from the request body
 * @param {Date} startTime - When the request was received
 * @return {Object} Result payload for callback
 */
function executeAction_(action, options, startTime) {
  var fnName = RPB_ACTION_MAP_[action];
  var result = {
    action: action,
    project: 'RPB',
    functionCalled: fnName,
    status: 'unknown',
    errors: [],
    duration_ms: 0,
    timestamp: new Date().toISOString(),
  };

  verboseLog_('[RPB_Patch] Executing: ' + action + ' → ' + fnName);

  try {
    if (typeof this[fnName] === 'function') {
      this[fnName](options);
      result.status = 'complete';
    } else {
      var notFoundErr = 'Function "' + fnName + '" not found in global scope. '
        + 'Verify the function name in RPB_ACTION_MAP_ matches the core script.';
      result.status = 'error';
      result.errors.push(notFoundErr);
      result.errorPayload = buildErrorPayload_(action, 'RPB', new Error(notFoundErr));
      verboseLog_(notFoundErr);
    }
  } catch (err) {
    result.status = 'error';
    result.errors.push(err.message || String(err));
    result.errorPayload = buildErrorPayload_(action, 'RPB', err);
    verboseLog_('[RPB_Patch] Error during ' + action + ': ' + err.message);
  }

  result.duration_ms = new Date() - startTime;
  verboseLog_('[RPB_Patch] Done: ' + action + ' in ' + result.duration_ms + 'ms | ' + result.status);
  return result;
}

/**
 * POSTs the result back to the n8n callback webhook URL.
 *
 * @param {string} callbackUrl
 * @param {Object} result
 */
function fireCallback_(callbackUrl, result) {
  if (result.status === 'error' && result.errorPayload) {
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
      verboseLog_('[RPB_Patch] Callback fired to: ' + callbackUrl);
    } catch (err) {
      Logger.log('[RPB_Patch_n8n] Callback failed: ' + err.message);
      reportErrorToN8n_(callbackUrl, buildErrorPayload_(result.action, 'RPB', err));
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
