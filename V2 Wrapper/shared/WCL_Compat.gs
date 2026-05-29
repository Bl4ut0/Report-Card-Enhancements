/**
 * Warcraft Logs compatibility facade for CLA/RPB source files.
 *
 * Credential modes:
 *   api_key                 -> V1 REST
 *   client_id:client_secret -> V2 GraphQL client credentials
 */

// Global config variables for V2 GraphQL
var WCL_V2_TOKEN_URL_ = 'https://www.warcraftlogs.com/oauth/token';
var WCL_V2_CLIENT_URL_ = 'https://www.warcraftlogs.com/api/v2/client';

/**
 * Parses raw credentials string to determine mode (v1 or v2).
 */
function wclGetCredentialMode_(rawCredentials) {
  var credentials = (rawCredentials || '').toString().replace(/\s/g, '');
  var firstColon = credentials.indexOf(':');

  if (firstColon > -1) {
    return {
      mode: 'v2',
      clientId: credentials.substring(0, firstColon),
      clientSecret: credentials.substring(firstColon + 1)
    };
  }

  return {
    mode: 'v1',
    apiKey: credentials
  };
}

/**
 * Public facade endpoints.
 */
function wclFetchFights_(rawCredentials, reportCode, options) {
  var auth = wclGetCredentialMode_(rawCredentials);
  if (auth.mode == 'v2')
    return wclV2FetchFights_(auth, reportCode, options || {});

  return wclV1FetchFights_(auth, reportCode, options || {});
}

function wclFetchTable_(rawCredentials, reportCode, dataType, options) {
  var auth = wclGetCredentialMode_(rawCredentials);
  if (auth.mode == 'v2')
    return wclV2FetchTable_(auth, reportCode, dataType, options || {});

  return wclV1FetchTable_(auth, reportCode, dataType, options || {});
}

function wclFetchEvents_(rawCredentials, reportCode, dataType, options) {
  var auth = wclGetCredentialMode_(rawCredentials);
  if (auth.mode == 'v2')
    return wclV2FetchEvents_(auth, reportCode, dataType, options || {});

  return wclV1FetchEvents_(auth, reportCode, dataType, options || {});
}

function wclUnsupported_(message) {
  throw new Error('[WCL Wrapper] ' + message);
}

/**
 * Internal shared fetch dispatcher.
 * Routes through the WCL Proxy if WCL_PROXY_WORKER_URL is configured.
 * Otherwise, falls back to direct UrlFetchApp fetch.
 */
function wclFetchInternal_(url, options, errorPrefix) {
  options = options || {};
  var props = PropertiesService.getScriptProperties();
  var workerUrl = props.getProperty('WCL_PROXY_WORKER_URL');
  var proxySecret = props.getProperty('WCL_PROXY_SECRET');

  var response;
  if (workerUrl) {
    var envelope = {
      url: url,
      method: options.method || 'GET'
    };
    if (options.headers) {
      envelope.headers = options.headers;
    }
    if (options.payload !== undefined) {
      envelope.body = options.payload;
    }

    var fetchOptions = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'x-wcl-proxy-secret': proxySecret || ''
      },
      payload: JSON.stringify(envelope),
      muteHttpExceptions: true
    };
    response = UrlFetchApp.fetch(workerUrl, fetchOptions);
  } else {
    // Direct fetch
    response = UrlFetchApp.fetch(url, options);
  }

  var responseCode = response.getResponseCode();
  var content = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(errorPrefix + ' Fetch failed with status ' + responseCode + ': ' + content);
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(errorPrefix + ' Failed to parse JSON response: ' + e.message + ' | Content: ' + content.substring(0, 100));
  }
}

/**
 * Warcraft Logs V1 REST helpers.
 */
function wclV1Fetch_(url, options) {
  return wclFetchInternal_(url, options, '[WCL V1 Wrapper]');
}

function wclV1BuildUrl_(host, path, apiKey, options) {
  var url = 'https://' + host + ':443/v1/' + path + '?api_key=' + apiKey;
  
  // Default translate to true for legacy sheet compatibility
  var translateVal = (options && options.translate !== undefined) ? options.translate : true;
  if (translateVal) {
    url += '&translate=true';
  }

  if (options) {
    for (var key in options) {
      if (options.hasOwnProperty(key) && key !== 'lang' && key !== 'translate') {
        var val = options[key];
        if (val !== undefined && val !== null) {
          url += '&' + key + '=' + encodeURIComponent(val.toString());
        }
      }
    }
  }
  return url;
}

function wclV1GetHost_(options) {
  var lang = (options && options.lang) ? options.lang.toString().toUpperCase() : 'EN';
  if (lang !== 'EN') {
    return lang.toLowerCase() + '.classic.warcraftlogs.com';
  }
  return 'classic.warcraftlogs.com';
}

function wclV1FetchFights_(auth, reportCode, options) {
  var host = wclV1GetHost_(options);
  var path = 'report/fights/' + reportCode;
  var url = wclV1BuildUrl_(host, path, auth.apiKey, options);
  
  return wclV1Fetch_(url, { method: 'GET' });
}

function wclV1FetchTable_(auth, reportCode, dataType, options) {
  var host = wclV1GetHost_(options);
  var path = 'report/tables/' + dataType + '/' + reportCode;
  var url = wclV1BuildUrl_(host, path, auth.apiKey, options);
  
  return wclV1Fetch_(url, { method: 'GET' });
}

function wclV1FetchEvents_(auth, reportCode, dataType, options) {
  var host = wclV1GetHost_(options);
  var path = 'report/events/' + dataType + '/' + reportCode;
  var url = wclV1BuildUrl_(host, path, auth.apiKey, options);
  
  return wclV1Fetch_(url, { method: 'GET' });
}

/**
 * Warcraft Logs V2 GraphQL helpers.
 */
function wclV2Fetch_(url, options) {
  return wclFetchInternal_(url, options, '[WCL V2 Wrapper]');
}

function wclV2GetAccessToken_(auth) {
  var props = PropertiesService.getScriptProperties();
  var cacheKey = 'WCL_V2_TOKEN_' + auth.clientId;
  var cachedToken = props.getProperty(cacheKey);
  
  if (cachedToken) {
    try {
      var tokenData = JSON.parse(cachedToken);
      // Ensure token is not expired (using a 60-second buffer)
      if (tokenData.expiresAt > Date.now() + 60000) {
        return tokenData.accessToken;
      }
    } catch (e) {
      // Ignore parse errors and fetch new token
    }
  }

  // Request new token
  var authString = Utilities.base64Encode(auth.clientId + ':' + auth.clientSecret);
  
  var responseData = wclV2Fetch_(WCL_V2_TOKEN_URL_, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + authString,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    payload: 'grant_type=client_credentials'
  });

  if (!responseData || !responseData.access_token) {
    throw new Error('[WCL V2 Wrapper] Failed to retrieve access token from Warcraft Logs.');
  }

  var accessToken = responseData.access_token;
  var expiresIn = responseData.expires_in || 3600;
  
  var expiresAt = Date.now() + (expiresIn * 1000);
  props.setProperty(cacheKey, JSON.stringify({
    accessToken: accessToken,
    expiresAt: expiresAt
  }));

  return accessToken;
}

function wclV2GraphQLQuery_(auth, query, variables) {
  var token = wclV2GetAccessToken_(auth);
  
  var payload = {
    query: query
  };
  if (variables) {
    payload.variables = variables;
  }

  return wclV2Fetch_(WCL_V2_CLIENT_URL_, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  });
}

function wclV2FetchFights_(auth, reportCode, options) {
  var query = 'query ($code: String!) {' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      title' +
    '      startTime' +
    '      zone { id name }' +
    '      fights {' +
    '        id' +
    '        startTime' +
    '        endTime' +
    '        boss' +
    '        kill' +
    '        zoneID' +
    '        zoneName' +
    '      }' +
    '      masterData {' +
    '        actors(type: "NPC") {' +
    '          id' +
    '          gameID' +
    '          name' +
    '        }' +
    '      }' +
    '    }' +
    '  }' +
    '}';
  
  var variables = { code: reportCode };
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  
  return rawResponse;
}

function wclV2FetchTable_(auth, reportCode, dataType, options) {
  wclUnsupported_('V2 table wrapper GraphQL schema selection is not implemented yet.');
}

function wclV2FetchEvents_(auth, reportCode, dataType, options) {
  wclUnsupported_('V2 events wrapper GraphQL schema selection is not implemented yet.');
}
