/**
 * Shared_DiscordWebhook.gs
 * -----------------------------------------------------------------------------
 * Shared Discord webhook delivery helper for CLA/RPB.
 *
 * Purpose:
 *   Adds patch-only export wrappers that temporarily clear the sheet-level
 *   Discord webhook, run the locked CLA/RPB export function, restore the webhook,
 *   then send a completion notice through a Cloudflare Worker using headers.
 *
 *   This avoids putting a Worker URL in the sheet webhook field, avoids editing
 *   locked source files, and keeps Discord notification failures from blocking
 *   report export completion.
 *
 * Setup:
 *   1. Upload this file to the CLA/RPB Apps Script project.
 *   2. Set Script Properties:
 *      DISCORD_PROXY_WORKER_URL = https://your-worker.workers.dev
 *      DISCORD_PROXY_SECRET     = your Worker secret
 *   3. Leave the sheet Instructions Discord webhook field as the normal raw
 *      Discord URL:
 *      https://discord.com/api/webhooks/ID/TOKEN
 *   4. Run/assign the patch wrapper instead of the locked core export function:
 *      CLA: runCLAExportWithDiscordProxy()
 *      RPB: runRPBExportWithDiscordProxy()
 *
 * Version: 0.1.0
 * -----------------------------------------------------------------------------
 */

/**
 * Patch-only CLA export wrapper.
 *
 * Assign the CLA export button/drawing to this function instead of exportSheets(),
 * or run it from the Apps Script editor.
 */
function runCLAExportWithDiscordProxy() {
  runExportWithDiscordProxy_({
    project: 'CLA',
    coreFunctionName: 'exportSheets',
    outputUrlCell: 'B27',
    label: 'Combat Log Analytics',
    color: 10544871,
  });
}

/**
 * Patch-only RPB export wrapper.
 *
 * Assign the RPB export button/drawing to this function instead of
 * generateRoleSheets(), or run it from the Apps Script editor.
 */
function runRPBExportWithDiscordProxy() {
  runExportWithDiscordProxy_({
    project: 'RPB',
    coreFunctionName: 'generateRoleSheets',
    outputUrlCell: 'E4',
    label: 'Role Performance Breakdown',
    color: 10783477,
  });
}

/**
 * Temporarily clears the core sheet webhook, runs the locked export function,
 * restores the webhook, then sends a proxy-backed Discord notification.
 *
 * @param {Object} config
 */
function runExportWithDiscordProxy_(config) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var activeSheet = ss.getActiveSheet();
  var webhookRange = getSheetDiscordWebhookRange_();
  var originalWebhook = webhookRange ? webhookRange.getValue() : '';
  var outputUrl = '';

  if (typeof this[config.coreFunctionName] !== 'function') {
    throw new Error('Core export function not found: ' + config.coreFunctionName);
  }

  try {
    if (webhookRange) {
      webhookRange.setValue('');
      SpreadsheetApp.flush();
    }

    this[config.coreFunctionName]();
  } finally {
    if (webhookRange) {
      webhookRange.setValue(originalWebhook);
      SpreadsheetApp.flush();
    }
  }

  try {
    outputUrl = activeSheet.getRange(config.outputUrlCell).getValue();
  } catch (err) {
    Logger.log('[Shared_DiscordWebhook] Could not read export URL from ' + config.outputUrlCell + ': ' + err.message);
  }

  if (originalWebhook && outputUrl && outputUrl.toString().indexOf('http') === 0) {
    sendProxyExportNotification_(originalWebhook, outputUrl.toString(), config);
  } else {
    Logger.log('[Shared_DiscordWebhook] Export wrapper did not send Discord notification. Webhook or export URL missing.');
  }
}

/**
 * Finds the shared CLA/RPB Discord webhook setting:
 * Instructions tab, marker "5.", four columns to the right.
 *
 * @return {Range|null}
 */
function getSheetDiscordWebhookRange_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var instructionsSheet = ss.getSheetByName('Instructions');
  if (!instructionsSheet) return null;

  var marker = instructionsSheet
    .createTextFinder('^5.$')
    .useRegularExpression(true)
    .findNext();
  if (!marker) return null;

  return marker.offset(0, 4);
}

/**
 * Sends a compact export-complete notification through the proxy helper.
 *
 * @param {string} webHook
 * @param {string} outputUrl
 * @param {Object} config
 */
function sendProxyExportNotification_(webHook, outputUrl, config) {
  var payload = JSON.stringify({
    username: config.label,
    embeds: [{
      title: config.label + ' export complete',
      url: outputUrl,
      color: config.color,
      description: outputUrl,
    }],
  });

  fetchDiscordWebhook_(webHook, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    payload: payload,
    muteHttpExceptions: true,
  });
}

/**
 * Sends one or more Discord webhook URLs safely. Supports the upstream "$$$$$"
 * delimiter used by CLA/RPB for posting to two webhooks.
 *
 * @param {string} webHook Raw Discord webhook URL, or two URLs separated by "$$$$$"
 * @param {Object} params  UrlFetchApp params containing the Discord payload
 * @return {Array} HTTP responses or null entries for failed sends
 */
function fetchDiscordWebhook_(webHook, params) {
  if (!webHook || webHook.toString().length === 0) return [];

  var urls = webHook.toString().split('$$$$$');
  var responses = [];

  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    if (!url || url.toString().length === 0) continue;
    responses.push(fetchSingleDiscordWebhook_(url.toString(), params || {}));
  }

  return responses;
}

/**
 * Sends a single Discord webhook. If DISCORD_PROXY_WORKER_URL is configured,
 * the POST goes to the Worker root and the real Discord URL is sent in a
 * header. Otherwise it falls back to direct Discord delivery.
 *
 * This function intentionally does not throw on notification failure. Discord
 * should not be allowed to make a completed spreadsheet export look failed.
 *
 * @param {string} webHookUrl
 * @param {Object} params
 * @return {HTTPResponse|null}
 */
function fetchSingleDiscordWebhook_(webHookUrl, params) {
  var props = PropertiesService.getScriptProperties();
  var workerUrl = (props.getProperty('DISCORD_PROXY_WORKER_URL') || '').replace(/\/$/, '');
  var proxySecret = props.getProperty('DISCORD_PROXY_SECRET') || '';

  try {
    if (workerUrl) {
      return UrlFetchApp.fetch(workerUrl, buildDiscordProxyParams_(webHookUrl, params, proxySecret));
    }

    var directParams = cloneDiscordParams_(params);
    directParams.muteHttpExceptions = true;
    return UrlFetchApp.fetch(webHookUrl, directParams);
  } catch (err) {
    Logger.log('[Shared_DiscordWebhook] Discord notification failed but export will continue: ' + err.message);
    return null;
  }
}

/**
 * Builds UrlFetchApp params for the Worker request.
 *
 * @param {string} webHookUrl
 * @param {Object} params
 * @param {string} proxySecret
 * @return {Object}
 */
function buildDiscordProxyParams_(webHookUrl, params, proxySecret) {
  var proxyParams = cloneDiscordParams_(params);
  var headers = proxyParams.headers || {};

  headers['Content-Type'] = headers['Content-Type'] || headers['content-type'] || 'application/json';
  headers['x-discord-webhook'] = webHookUrl;
  if (proxySecret) headers['x-proxy-secret'] = proxySecret;

  proxyParams.headers = headers;
  proxyParams.method = proxyParams.method || 'POST';
  proxyParams.muteHttpExceptions = true;

  return proxyParams;
}

/**
 * Clones the small UrlFetchApp params object used by CLA/RPB.
 *
 * @param {Object} params
 * @return {Object}
 */
function cloneDiscordParams_(params) {
  var clone = {};
  params = params || {};

  for (var key in params) {
    if (!params.hasOwnProperty(key)) continue;
    if (key === 'headers' && params.headers) {
      clone.headers = {};
      for (var headerName in params.headers) {
        if (params.headers.hasOwnProperty(headerName)) {
          clone.headers[headerName] = params.headers[headerName];
        }
      }
    } else {
      clone[key] = params[key];
    }
  }

  return clone;
}
