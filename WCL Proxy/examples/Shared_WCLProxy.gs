/**
 * Shared Apps Script helper for routing Warcraft Logs requests through the
 * WCL Proxy Cloudflare Worker.
 *
 * Script Properties:
 *   WCL_PROXY_WORKER_URL
 *   WCL_PROXY_SECRET
 */

function fetchWarcraftLogsViaProxy_(url, options) {
  options = options || {};

  var props = PropertiesService.getScriptProperties();
  var workerUrl = props.getProperty('WCL_PROXY_WORKER_URL');
  var proxySecret = props.getProperty('WCL_PROXY_SECRET');

  if (!workerUrl)
    throw new Error('WCL_PROXY_WORKER_URL Script Property is required.');

  var envelope = {
    url: url,
    method: options.method || 'GET'
  };

  if (options.headers)
    envelope.headers = options.headers;

  if (options.payload !== undefined)
    envelope.body = options.payload;

  return UrlFetchApp.fetch(workerUrl, {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-wcl-proxy-secret': proxySecret || ''
    },
    payload: JSON.stringify(envelope),
    muteHttpExceptions: true
  });
}

