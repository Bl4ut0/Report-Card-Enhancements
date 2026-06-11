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

// Global pacing variable to track the last request timestamp during script execution
var wclLastFetchTime_ = 0;

// Global memory cache to eliminate repeated PropertiesService database reads
var wclCachedProperties_ = null;
var wclV2CachedTokens_ = {};

/**
 * Global properties getter helper to minimize database roundtrips.
 */
function wclGetProperty_(key) {
  if (wclCachedProperties_ === null) {
    try {
      wclCachedProperties_ = PropertiesService.getScriptProperties().getProperties() || {};
    } catch (e) {
      wclCachedProperties_ = {};
      Logger.log('[WCL Wrapper] Failed to load script properties: ' + e.message);
    }
  }
  return wclCachedProperties_[key] || null;
}

/**
 * Global properties setter helper to update the local and persistent property store.
 */
function wclSetProperty_(key, value) {
  if (wclCachedProperties_ === null) {
    wclCachedProperties_ = {};
  }
  wclCachedProperties_[key] = value;
  try {
    PropertiesService.getScriptProperties().setProperty(key, value);
  } catch (e) {
    Logger.log('[WCL Wrapper] Failed to set script property ' + key + ': ' + e.message);
  }
}

function wclDeleteProperty_(key) {
  if (wclCachedProperties_ !== null) {
    delete wclCachedProperties_[key];
  }
  try {
    PropertiesService.getScriptProperties().deleteProperty(key);
  } catch (e) {
    Logger.log('[WCL Wrapper] Failed to delete script property ' + key + ': ' + e.message);
  }
}

function wclGetHeader_(headers, name) {
  var targetName = name.toLowerCase();
  for (var key in headers) {
    if (headers.hasOwnProperty(key) && key.toLowerCase() === targetName) {
      return headers[key];
    }
  }
  return null;
}

function wclGetRetryAfterMs_(retryAfterValue) {
  if (retryAfterValue === null || retryAfterValue === undefined || retryAfterValue === '') {
    return 0;
  }

  var seconds = Number(retryAfterValue);
  if (!isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  var retryAt = Date.parse(String(retryAfterValue));
  return isNaN(retryAt) ? 0 : Math.max(0, retryAt - Date.now());
}

function wclCheckV2Cooldown_() {
  var cooldownUntil = Number(wclGetProperty_('WCL_V2_COOLDOWN_UNTIL_MS') || 0);
  if (cooldownUntil <= 0) {
    return;
  }

  var remainingMs = cooldownUntil - Date.now();
  if (remainingMs <= 0) {
    wclDeleteProperty_('WCL_V2_COOLDOWN_UNTIL_MS');
    return;
  }

  throw new Error(
    '[WCL V2 Wrapper] Warcraft Logs cooldown is active. Retry in approximately ' +
    Math.ceil(remainingMs / 1000) +
    ' seconds.'
  );
}

/**
 * Logger helper to print rate limit metrics and warn when low on points.
 */
function wclLogRateLimit_(response) {
  if (response && response.data && response.data.rateLimitData) {
    var r = response.data.rateLimitData;
    var remaining = r.limitPerHour - r.pointsSpentThisHour;
    Logger.log('[WCL Wrapper] Rate Limit: ' + r.pointsSpentThisHour + '/' + r.limitPerHour + ' points spent. Reset in ' + r.pointsResetIn + 's.');
    if (remaining < 200 || (r.pointsSpentThisHour / r.limitPerHour) > 0.9) {
      Logger.log('[WCL Wrapper] WARNING: Warcraft Logs V2 API rate limit is almost reached! Remaining: ' + remaining + ' points.');
    }
  }
}

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

function wclFetchTables_(rawCredentials, reportCode, requests) {
  var auth = wclGetCredentialMode_(rawCredentials);
  var tableRequests = requests || [];
  if (auth.mode == 'v2')
    return wclV2FetchTables_(auth, reportCode, tableRequests);

  var results = [];
  for (var i = 0; i < tableRequests.length; i++) {
    var request = tableRequests[i] || {};
    results.push(wclV1FetchTable_(auth, reportCode, request.dataType, request.options || {}));
  }
  return results;
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
 * Routes through the configured WCL proxy endpoint when present.
 * Otherwise, falls back to direct UrlFetchApp fetch.
 */
function wclFetchInternal_(url, options, errorPrefix) {
  options = options || {};
  
  // Extract credentials from URL if it's a Warcraft Logs URL
  var isWclUrl = url.indexOf('warcraftlogs.com') > -1;
  if (isWclUrl) {
    var apiKeyMatch = url.match(/(?:\?|&)api_key=([^&]+)/);
    if (apiKeyMatch) {
      var auth = wclGetCredentialMode_(decodeURIComponent(apiKeyMatch[1]));
      if (auth.mode == 'v2') {
        return wclTranslateV1UrlToV2GraphQL_(url, auth);
      }
    }
  }

  var proxyEnabledProp = wclGetProperty_('WCL_PROXY_ENABLED');
  var proxyEnabled = proxyEnabledProp === null || proxyEnabledProp === 'true' || proxyEnabledProp === true || proxyEnabledProp === 'TRUE';

  var proxyUrl = null;
  var proxySecret = null;
  if (proxyEnabled) {
    proxyUrl = (typeof WCL_PROXY_URL_CONFIG !== 'undefined' && WCL_PROXY_URL_CONFIG) || wclGetProperty_('WCL_PROXY_URL');
    proxySecret = (typeof WCL_PROXY_SECRET_CONFIG !== 'undefined' && WCL_PROXY_SECRET_CONFIG) || wclGetProperty_('WCL_PROXY_SECRET');
  }

  // Determine if this is V2 (GraphQL) or V1 (REST)
  var isV2 = (errorPrefix && errorPrefix.indexOf('V2') > -1) || url.indexOf('/api/v2/') > -1 || url.indexOf('/oauth/') > -1;
  if (isV2) {
    wclCheckV2Cooldown_();
  }

  // Automatic rate-limit pacing to prevent request overflows (1000ms for V2 GraphQL, 1000ms for V1 REST)
  var minInterval = isV2 ? 1000 : 1000;
  var intervalProp = wclGetProperty_('WCL_MIN_FETCH_INTERVAL_MS');
  if (intervalProp) {
    var parsedInterval = parseInt(intervalProp, 10);
    if (!isNaN(parsedInterval) && parsedInterval >= 0) {
      minInterval = parsedInterval;
    }
  }

  if (minInterval > 0) {
    var now = new Date().getTime();
    if (typeof wclLastFetchTime_ !== 'undefined' && wclLastFetchTime_ > 0) {
      var elapsed = now - wclLastFetchTime_;
      if (elapsed < minInterval) {
        Utilities.sleep(minInterval - elapsed);
      }
    }
    wclLastFetchTime_ = new Date().getTime();
  }

  var response;
  if (proxyUrl) {
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
    response = UrlFetchApp.fetch(proxyUrl, fetchOptions);
  } else {
    // Direct fetch
    response = UrlFetchApp.fetch(url, options);
  }

  var responseCode = response.getResponseCode();
  var content = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    var headers = response.getHeaders() || {};
    var isProxied = proxyUrl ? true : false;
    
    // Check for relayed header case-insensitively
    var isRelayed = false;
    var proxyRuntime = "";
    for (var k in headers) {
      if (headers.hasOwnProperty(k)) {
        var lowerHeaderName = k.toLowerCase();
        if (lowerHeaderName === 'x-wcl-proxy-relayed') {
          if (headers[k] === 'true' || headers[k] === true) {
            isRelayed = true;
          }
        } else if (lowerHeaderName === 'x-wcl-proxy-runtime') {
          proxyRuntime = String(headers[k] || '').toLowerCase();
        }
      }
    }
    
    var diagnosticMessage = "";
    if (responseCode === 429) {
      var retryAfterMs = wclGetRetryAfterMs_(wclGetHeader_(headers, 'retry-after'));
      if (isV2 && retryAfterMs > 0) {
        wclSetProperty_('WCL_V2_COOLDOWN_UNTIL_MS', String(Date.now() + retryAfterMs));
        diagnosticMessage += " [Retry after: " + Math.ceil(retryAfterMs / 1000) + " seconds]";
      }

      if (isProxied) {
        if (isRelayed) {
          if (proxyRuntime === 'vps') {
            diagnosticMessage += " [Origin: Warcraft Logs API (relayed via VPS Proxy)]";
          } else if (proxyRuntime === 'cloudflare-worker') {
            diagnosticMessage += " [Origin: Warcraft Logs API (relayed via Cloudflare Worker)]";
          } else {
            diagnosticMessage += " [Origin: Warcraft Logs API (relayed via configured proxy)]";
          }
        } else {
          diagnosticMessage += " [Origin: Cloudflare Edge (Worker Endpoint blocked/rate-limited)]";
        }
      } else {
        diagnosticMessage += " [Origin: Warcraft Logs API (Direct Request from Google Apps Script IP)]";
      }
    }
    
    throw new Error(errorPrefix + ' Fetch failed with status ' + responseCode + diagnosticMessage + ': ' + content);
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
  var cacheKey = 'WCL_V2_TOKEN_' + auth.clientId;
  
  // 1. Check global in-memory cache first
  if (wclV2CachedTokens_[cacheKey]) {
    var cached = wclV2CachedTokens_[cacheKey];
    if (cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }
  }

  // 2. Check script properties cache
  var cachedToken = wclGetProperty_(cacheKey);
  if (cachedToken) {
    try {
      var tokenData = JSON.parse(cachedToken);
      if (tokenData.expiresAt > Date.now() + 60000) {
        wclV2CachedTokens_[cacheKey] = tokenData;
        return tokenData.accessToken;
      }
    } catch (e) {
      // Ignore parse errors and fetch new token
    }
  }

  // 3. Request new token from WCL
  var authString = Utilities.base64Encode(auth.clientId + ':' + auth.clientSecret, Utilities.Charset.UTF_8);
  
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

  var tokenData = {
    accessToken: accessToken,
    expiresAt: expiresAt
  };

  // Cache in-memory and update script properties
  wclV2CachedTokens_[cacheKey] = tokenData;
  wclSetProperty_(cacheKey, JSON.stringify(tokenData));

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
    '  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      title' +
    '      startTime' +
    '      endTime' +
    '      zone { id name }' +
    '      fights {' +
    '        id' +
    '        startTime' +
    '        endTime' +
    '        encounterID' +
    '        kill' +
    '        name' +
    '        originalEncounterID' +
    '        fightPercentage' +
    '        bossPercentage' +
    '        friendlyPlayers' +
    '        enemyNPCs { id gameID }' +
    '        friendlyPets { id gameID }' +
    '        gameZone { id name }' +
    '        difficulty' +
    '        size' +
    '      }' +
    '      masterData {' +
    '        actors {' +
    '          id' +
    '          gameID' +
    '          name' +
    '          type' +
    '          subType' +
    '          petOwner' +
    '        }' +
    '      }' +
    '    }' +
    '  }' +
    '}';
  
  var variables = { code: reportCode };
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  wclLogRateLimit_(rawResponse);
  
  if (!rawResponse || !rawResponse.data || !rawResponse.data.reportData || !rawResponse.data.reportData.report) {
    throw new Error('[WCL V2 Wrapper] Failed to fetch report fights for ' + reportCode);
  }
  
  return wclV2MapFightsToV1_(rawResponse.data.reportData.report);
}

function wclV2FetchTable_(auth, reportCode, dataType, options) {
  var query = 'query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: TableDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $encounterID: Int, $hostilityType: HostilityType, $filterExpression: String, $viewBy: ViewType, $viewOptions: Int, $killType: KillType) {' +
    '  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      table(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, encounterID: $encounterID, hostilityType: $hostilityType, filterExpression: $filterExpression, viewBy: $viewBy, viewOptions: $viewOptions, killType: $killType)' +
    '    }' +
    '  }' +
    '}';
    
  var variables = {
    code: reportCode,
    startTime: options.start !== undefined ? Number(options.start) : 0,
    endTime: options.end !== undefined ? Number(options.end) : 999999999999,
    dataType: wclV2GetTableDataType_(dataType),
    abilityID: options.abilityid !== undefined ? Number(options.abilityid) : undefined,
    sourceID: options.sourceid !== undefined ? Number(options.sourceid) : undefined,
    targetID: options.targetid !== undefined ? Number(options.targetid) : undefined,
    encounterID: (options.encounter !== undefined && Number(options.encounter) > 0) ? Number(options.encounter) : undefined,
    hostilityType: options.hostility !== undefined ? (options.hostility == 1 ? 'Enemies' : 'Friendlies') : undefined,
    filterExpression: options.filterExpression !== undefined ? options.filterExpression : undefined,
    viewBy: options.viewBy !== undefined ? options.viewBy : undefined,
    viewOptions: options.viewOptions !== undefined ? Number(options.viewOptions) : undefined,
    killType: options.killType !== undefined ? options.killType : undefined
  };
  
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  wclLogRateLimit_(rawResponse);
  
  if (!rawResponse || !rawResponse.data || !rawResponse.data.reportData || !rawResponse.data.reportData.report || !rawResponse.data.reportData.report.table) {
    return { entries: [] };
  }
  
  return rawResponse.data.reportData.report.table.data || rawResponse.data.reportData.report.table;
}

function wclV2FetchTables_(auth, reportCode, requests) {
  if (!requests || requests.length === 0) {
    return [];
  }

  var configuredBatchSize = parseInt(wclGetProperty_('WCL_V2_TABLE_BATCH_SIZE') || '12', 10);
  var batchSize = (!isNaN(configuredBatchSize) && configuredBatchSize > 0) ? configuredBatchSize : 12;
  var results = [];

  for (var offset = 0; offset < requests.length; offset += batchSize) {
    var batch = requests.slice(offset, offset + batchSize);
    var variableDefinitions = ['$code: String!'];
    var tableFields = [];
    var variables = { code: reportCode };

    for (var i = 0; i < batch.length; i++) {
      var suffix = i.toString();
      var request = batch[i] || {};
      var options = request.options || {};

      variableDefinitions.push(
        '$startTime' + suffix + ': Float!',
        '$endTime' + suffix + ': Float!',
        '$dataType' + suffix + ': TableDataType',
        '$abilityID' + suffix + ': Float',
        '$sourceID' + suffix + ': Int',
        '$targetID' + suffix + ': Int',
        '$encounterID' + suffix + ': Int',
        '$hostilityType' + suffix + ': HostilityType',
        '$filterExpression' + suffix + ': String',
        '$viewBy' + suffix + ': ViewType',
        '$viewOptions' + suffix + ': Int',
        '$killType' + suffix + ': KillType'
      );

      tableFields.push(
        'table' + suffix + ': table(' +
        'startTime: $startTime' + suffix + ', ' +
        'endTime: $endTime' + suffix + ', ' +
        'dataType: $dataType' + suffix + ', ' +
        'abilityID: $abilityID' + suffix + ', ' +
        'sourceID: $sourceID' + suffix + ', ' +
        'targetID: $targetID' + suffix + ', ' +
        'encounterID: $encounterID' + suffix + ', ' +
        'hostilityType: $hostilityType' + suffix + ', ' +
        'filterExpression: $filterExpression' + suffix + ', ' +
        'viewBy: $viewBy' + suffix + ', ' +
        'viewOptions: $viewOptions' + suffix + ', ' +
        'killType: $killType' + suffix +
        ')'
      );

      variables['startTime' + suffix] = options.start !== undefined ? Number(options.start) : 0;
      variables['endTime' + suffix] = options.end !== undefined ? Number(options.end) : 999999999999;
      variables['dataType' + suffix] = wclV2GetTableDataType_(request.dataType);
      if (options.abilityid !== undefined) variables['abilityID' + suffix] = Number(options.abilityid);
      if (options.sourceid !== undefined) variables['sourceID' + suffix] = Number(options.sourceid);
      if (options.targetid !== undefined) variables['targetID' + suffix] = Number(options.targetid);
      if (options.encounter !== undefined && Number(options.encounter) > 0) variables['encounterID' + suffix] = Number(options.encounter);
      if (options.hostility !== undefined) variables['hostilityType' + suffix] = options.hostility == 1 ? 'Enemies' : 'Friendlies';
      if (options.filterExpression !== undefined) variables['filterExpression' + suffix] = options.filterExpression;
      if (options.viewBy !== undefined) variables['viewBy' + suffix] = options.viewBy;
      if (options.viewOptions !== undefined) variables['viewOptions' + suffix] = Number(options.viewOptions);
      if (options.killType !== undefined) variables['killType' + suffix] = options.killType;
    }

    var query = 'query (' + variableDefinitions.join(', ') + ') {' +
      ' rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }' +
      ' reportData {' +
      '  report(code: $code) {' + tableFields.join(' ') + '}' +
      ' }' +
      '}';

    var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
    wclLogRateLimit_(rawResponse);
    var report = rawResponse && rawResponse.data && rawResponse.data.reportData
      ? rawResponse.data.reportData.report
      : null;

    for (var resultIndex = 0; resultIndex < batch.length; resultIndex++) {
      var table = report ? report['table' + resultIndex] : null;
      results.push(table ? (table.data || table) : { entries: [] });
    }
  }

  return results;
}

function wclV2FetchEvents_(auth, reportCode, dataType, options) {
  var query = 'query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: EventDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $hostilityType: HostilityType, $limit: Int, $filterExpression: String, $killType: KillType) {' +
    '  rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      events(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, hostilityType: $hostilityType, limit: $limit, filterExpression: $filterExpression, killType: $killType) {' +
    '        data' +
    '        nextPageTimestamp' +
    '      }' +
    '    }' +
    '  }' +
    '}';
    
  var variables = {
    code: reportCode,
    startTime: options.start !== undefined ? Number(options.start) : 0,
    endTime: options.end !== undefined ? Number(options.end) : 999999999999,
    dataType: wclV2GetEventDataType_(dataType),
    abilityID: options.abilityid !== undefined ? Number(options.abilityid) : undefined,
    sourceID: options.sourceid !== undefined ? Number(options.sourceid) : undefined,
    targetID: options.targetid !== undefined ? Number(options.targetid) : undefined,
    hostilityType: options.hostility !== undefined ? (options.hostility == 1 ? 'Enemies' : 'Friendlies') : undefined,
    limit: options.limit !== undefined ? Number(options.limit) : 10000,
    filterExpression: options.filterExpression !== undefined ? options.filterExpression : undefined,
    killType: options.killType !== undefined ? options.killType : undefined
  };
  
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  wclLogRateLimit_(rawResponse);
  
  if (!rawResponse || !rawResponse.data || !rawResponse.data.reportData || !rawResponse.data.reportData.report || !rawResponse.data.reportData.report.events) {
    return { events: [], nextPageTimestamp: null };
  }
  
  var eventsData = rawResponse.data.reportData.report.events;
  var eventsList = eventsData.data || [];
  for (var i = 0; i < eventsList.length; i++) {
    var ev = eventsList[i];
    if (ev.abilityGameID !== undefined && ev.ability === undefined) {
      ev.ability = {
        name: '',
        guid: ev.abilityGameID,
        type: 0,
        abilityIcon: ''
      };
    }
  }
  return {
    events: eventsList,
    nextPageTimestamp: eventsData.nextPageTimestamp
  };
}

function wclV2GetTableDataType_(v1DataType) {
  var mapping = {
    'summary': 'Summary',
    'buffs': 'Buffs',
    'casts': 'Casts',
    'damage-done': 'DamageDone',
    'damage-taken': 'DamageTaken',
    'deaths': 'Deaths',
    'debuffs': 'Debuffs',
    'dispels': 'Dispels',
    'healing': 'Healing',
    'interrupts': 'Interrupts',
    'resources': 'Resources',
    'resources-gains': 'Resources',
    'resources-losses': 'Resources',
    'summons': 'Summons',
    'survivability': 'Survivability',
    'threat': 'Threat'
  };
  var lower = (v1DataType || '').toString().toLowerCase();
  return mapping[lower] || 'Casts';
}

function wclV2GetEventDataType_(v1DataType) {
  var mapping = {
    'summary': 'All',
    'buffs': 'Buffs',
    'casts': 'Casts',
    'combatantinfo': 'CombatantInfo',
    'damage-done': 'DamageDone',
    'damage-taken': 'DamageTaken',
    'deaths': 'Deaths',
    'debuffs': 'Debuffs',
    'dispels': 'Dispels',
    'healing': 'Healing',
    'interrupts': 'Interrupts',
    'resources': 'Resources',
    'summons': 'Summons',
    'threat': 'Threat'
  };
  var lower = (v1DataType || '').toString().toLowerCase();
  return mapping[lower] || 'All';
}

function wclV2MapFightsToV1_(graphqlReport) {
  var v1 = {
    title: graphqlReport.title || '',
    lang: graphqlReport.lang || 'en',
    start: graphqlReport.startTime,
    end: graphqlReport.endTime,
    zone: graphqlReport.zone ? graphqlReport.zone.id : 0,
    fights: [],
    enemies: [],
    friendlies: []
  };

  if (graphqlReport.fights) {
    for (var i = 0; i < graphqlReport.fights.length; i++) {
      var f = graphqlReport.fights[i];
      var fightZone = f.gameZone || graphqlReport.zone || {};
      var isBoss = f.encounterID && f.encounterID > 0;
      var fightObj = {
        id: f.id,
        start_time: f.startTime,
        end_time: f.endTime,
        boss: f.encounterID || 0,
        name: f.name || '',
        zoneID: fightZone.id || 0,
        zoneName: fightZone.name || ''
      };
      if (isBoss) {
        fightObj.originalBoss = f.originalEncounterID || f.encounterID || 0;
        fightObj.kill = f.kill || false;
        if (f.fightPercentage !== undefined && f.fightPercentage !== null) {
          fightObj.fightPercentage = Math.round(f.fightPercentage * 100);
        }
        if (f.bossPercentage !== undefined && f.bossPercentage !== null) {
          fightObj.bossPercentage = Math.round(f.bossPercentage * 100);
        }
        if (f.difficulty !== undefined && f.difficulty !== null) {
          fightObj.difficulty = f.difficulty;
        }
        if (f.size !== undefined && f.size !== null) {
          fightObj.size = f.size;
        }
      }
      v1.fights.push(fightObj);
    }
  }

  var actors = [];
  if (graphqlReport.masterData && graphqlReport.masterData.actors) {
    actors = graphqlReport.masterData.actors;
  }

  for (var j = 0; j < actors.length; j++) {
    var a = actors[j];
    var mappedActor = {
      id: a.id,
      guid: a.gameID,
      name: a.name,
      type: a.subType || a.type,
      fights: []
    };

    if (graphqlReport.fights) {
      for (var k = 0; k < graphqlReport.fights.length; k++) {
        var fight = graphqlReport.fights[k];
        var participated = false;

        if (a.type === 'Player') {
          if (fight.friendlyPlayers && fight.friendlyPlayers.indexOf(a.id) > -1) {
            participated = true;
          }
        } else if (a.type === 'NPC' || a.type === 'Boss') {
          if (fight.enemyNPCs) {
            for (var m = 0; m < fight.enemyNPCs.length; m++) {
              if (fight.enemyNPCs[m].id === a.id) {
                participated = true;
                break;
              }
            }
          }
        } else if (a.type === 'Pet') {
          if (fight.friendlyPets) {
            for (var m = 0; m < fight.friendlyPets.length; m++) {
              if (fight.friendlyPets[m].id === a.id) {
                participated = true;
                break;
              }
            }
          }
        }

        if (participated) {
          mappedActor.fights.push({ id: fight.id });
        }
      }
    }

    if (a.type === 'Player' || a.type === 'Pet') {
      v1.friendlies.push(mappedActor);
    } else {
      v1.enemies.push(mappedActor);
    }
  }

  return v1;
}

function wclParseV1Url_(url) {
  var v1Index = url.indexOf('/v1/');
  if (v1Index === -1) return null;
  
  var rest = url.substring(v1Index + 4);
  var queryIndex = rest.indexOf('?');
  var path = queryIndex > -1 ? rest.substring(0, queryIndex) : rest;
  var queryString = queryIndex > -1 ? rest.substring(queryIndex + 1) : '';
  
  var params = {};
  if (queryString) {
    var pairs = queryString.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split('=');
      var key = decodeURIComponent(pair[0]).toLowerCase();
      var value = pair.length > 1 ? decodeURIComponent(pair[1]) : '';
      params[key] = value;
    }
  }
  
  var parts = path.split('/');
  return {
    path: path,
    parts: parts,
    params: params
  };
}

function wclBuildFilterExpression_(params) {
  var parts = [];
  
  if (params.filter) {
    parts.push(params.filter);
  }
  
  if (params.encounter !== undefined) {
    var encounterVal = Number(params.encounter);
    if (!isNaN(encounterVal)) {
      if (encounterVal === 0) {
        parts.push('encounterID = 0');
      } else if (encounterVal === -2) {
        parts.push('encounterID != 0');
      } else if (encounterVal > 0) {
        parts.push('encounterID = ' + encounterVal);
      }
    }
  }
  
  if (params.sourceauraspresent) {
    var auras = params.sourceauraspresent.split(',');
    for (var i = 0; i < auras.length; i++) {
      parts.push('source.buff.' + auras[i].trim());
    }
  }
  
  if (params.sourceaurasabsent) {
    var auras = params.sourceaurasabsent.split(',');
    for (var i = 0; i < auras.length; i++) {
      parts.push('not source.buff.' + auras[i].trim());
    }
  }
  
  if (params.targetauraspresent) {
    var auras = params.targetauraspresent.split(',');
    for (var i = 0; i < auras.length; i++) {
      parts.push('(target.buff.' + auras[i].trim() + ' or target.debuff.' + auras[i].trim() + ')');
    }
  }
  
  if (params.targetaurasabsent) {
    var auras = params.targetaurasabsent.split(',');
    for (var i = 0; i < auras.length; i++) {
      parts.push('not (target.buff.' + auras[i].trim() + ' or target.debuff.' + auras[i].trim() + ')');
    }
  }
  
  if (params.targetclass) {
    var cls = params.targetclass.toLowerCase();
    if (cls === 'player') {
      parts.push('target.type = "player"');
    } else {
      parts.push('target.class = "' + params.targetclass + '"');
    }
  }


  
  return parts.length > 0 ? parts.join(' and ') : undefined;
}

function wclTranslateV1UrlToV2GraphQL_(url, auth) {
  var parsed = wclParseV1Url_(url);
  if (!parsed) {
    throw new Error('[WCL Wrapper] Could not parse V1 URL: ' + url);
  }

  var parts = parsed.parts;
  var params = parsed.params;

  if (parts[0] === 'report') {
    if (parts[1] === 'fights') {
      var reportCode = parts[2];
      return wclV2FetchFights_(auth, reportCode, params);
    }
    
    if (parts[1] === 'tables') {
      var dataType = parts[2];
      var reportCode = parts[3];
      
      var options = {};
      if (params.start !== undefined) options.start = Number(params.start);
      if (params.end !== undefined) options.end = Number(params.end);
      if (params.abilityid !== undefined) options.abilityid = Number(params.abilityid);
      if (params.sourceid !== undefined) options.sourceid = Number(params.sourceid);
      if (params.targetid !== undefined) options.targetid = Number(params.targetid);
      if (params.encounter !== undefined) options.encounter = Number(params.encounter);
      if (params.hostility !== undefined) options.hostility = Number(params.hostility);
      if (params.translate !== undefined) options.translate = (params.translate === 'true' || params.translate === true);
      
      if (params.by !== undefined) {
        var byVal = params.by.toLowerCase();
        if (byVal === 'target') options.viewBy = 'Target';
        else if (byVal === 'source') options.viewBy = 'Source';
        else if (byVal === 'ability') options.viewBy = 'Ability';
      }
      if (params.options !== undefined) {
        options.viewOptions = Number(params.options);
      }
      if (params.wipes !== undefined && params.encounter !== undefined && Number(params.encounter) !== 0) {
        var wipesVal = Number(params.wipes);
        if (wipesVal === 1) options.killType = 'Wipes';
        else if (wipesVal === 2) options.killType = 'Kills';
        else if (wipesVal === 0) options.killType = 'All';
      }
      
      var filter = wclBuildFilterExpression_(params);
      if (filter !== undefined) options.filterExpression = filter;
      
      return wclV2FetchTable_(auth, reportCode, dataType, options);
    }
    
    if (parts[1] === 'events') {
      var dataType = parts[2];
      var reportCode = parts[3];
      
      var options = {};
      if (params.start !== undefined) options.start = Number(params.start);
      if (params.end !== undefined) options.end = Number(params.end);
      if (params.abilityid !== undefined) options.abilityid = Number(params.abilityid);
      
      // Warcraft Logs V2 GraphQL API swaps target/source semantics for aura events:
      // - dataType: Buffs/Debuffs expects sourceID for the recipient of the aura, and targetID for the caster.
      // - Other events expect sourceID for the caster/source, and targetID for the target.
      var lowerDataType = (dataType || '').toString().toLowerCase();
      var isAura = (lowerDataType === 'buffs' || lowerDataType === 'debuffs');
      var isBySource = (params.by !== undefined && params.by.toLowerCase() === 'source');
      
      var sourceIDVal = params.sourceid !== undefined ? Number(params.sourceid) : undefined;
      var targetIDVal = params.targetid !== undefined ? Number(params.targetid) : undefined;
      
      if (isAura) {
        if (isBySource) {
          if (params.targetid !== undefined) targetIDVal = Number(params.targetid);
          if (params.sourceid !== undefined) targetIDVal = Number(params.sourceid);
          sourceIDVal = undefined;
        } else {
          if (params.targetid !== undefined) sourceIDVal = Number(params.targetid);
          if (params.sourceid !== undefined) sourceIDVal = Number(params.sourceid);
          targetIDVal = undefined;
        }
      } else {
        if (isBySource) {
          if (params.targetid !== undefined) {
            sourceIDVal = Number(params.targetid);
            targetIDVal = undefined;
          }
        }
      }
      
      if (sourceIDVal !== undefined) options.sourceid = sourceIDVal;
      if (targetIDVal !== undefined) options.targetid = targetIDVal;
      
      if (params.encounter !== undefined) options.encounter = Number(params.encounter);
      if (params.hostility !== undefined) options.hostility = Number(params.hostility);
      if (params.limit !== undefined) options.limit = Number(params.limit);
      if (params.nextpagetimestamp !== undefined) options.nextPageTimestamp = Number(params.nextpagetimestamp);
      if (params.wipes !== undefined && params.encounter !== undefined && Number(params.encounter) !== 0) {
        var wipesVal = Number(params.wipes);
        if (wipesVal === 1) options.killType = 'Wipes';
        else if (wipesVal === 2) options.killType = 'Kills';
        else if (wipesVal === 0) options.killType = 'All';
      }
      
      var filter = wclBuildFilterExpression_(params);
      if (filter !== undefined) options.filterExpression = filter;
      
      return wclV2FetchEvents_(auth, reportCode, dataType, options);
    }
  }

  throw new Error('[WCL Wrapper] Unsupported V1 REST URL path for V2 mapping: ' + parsed.path);
}
