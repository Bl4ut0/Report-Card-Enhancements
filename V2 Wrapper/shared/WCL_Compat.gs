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
  
  if (!rawResponse || !rawResponse.data || !rawResponse.data.reportData || !rawResponse.data.reportData.report) {
    throw new Error('[WCL V2 Wrapper] Failed to fetch report fights for ' + reportCode);
  }
  
  return wclV2MapFightsToV1_(rawResponse.data.reportData.report);
}

function wclV2FetchTable_(auth, reportCode, dataType, options) {
  var query = 'query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: TableDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $encounterID: Int, $hostilityType: HostilityType, $filterExpression: String) {' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      table(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, encounterID: $encounterID, hostilityType: $hostilityType, filterExpression: $filterExpression)' +
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
    encounterID: options.encounter !== undefined ? Number(options.encounter) : undefined,
    hostilityType: options.hostility !== undefined ? (options.hostility == 1 ? 'Enemies' : 'Friendlies') : undefined,
    filterExpression: options.filterExpression !== undefined ? options.filterExpression : undefined
  };
  
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  
  if (!rawResponse || !rawResponse.data || !rawResponse.data.reportData || !rawResponse.data.reportData.report || !rawResponse.data.reportData.report.table) {
    return { entries: [] };
  }
  
  return rawResponse.data.reportData.report.table.data || rawResponse.data.reportData.report.table;
}

function wclV2FetchEvents_(auth, reportCode, dataType, options) {
  var query = 'query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: EventDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $hostilityType: HostilityType, $limit: Int, $filterExpression: String) {' +
    '  reportData {' +
    '    report(code: $code) {' +
    '      events(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, hostilityType: $hostilityType, limit: $limit, filterExpression: $filterExpression) {' +
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
    filterExpression: options.filterExpression !== undefined ? options.filterExpression : undefined
  };
  
  var rawResponse = wclV2GraphQLQuery_(auth, query, variables);
  
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
      v1.fights.push({
        id: f.id,
        start_time: f.startTime,
        end_time: f.endTime,
        boss: f.encounterID || 0,
        originalBoss: f.originalEncounterID || f.encounterID || 0,
        kill: (f.encounterID && f.encounterID > 0) ? (f.kill || false) : undefined,
        name: f.name || '',
        fightPercentage: f.fightPercentage || 0,
        bossPercentage: f.bossPercentage || 0
      });
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

  if (params.options) {
    var optionsVal = Number(params.options);
    if (!isNaN(optionsVal) && (optionsVal & 4096) === 4096) {
      parts.push('ability.avoidable = true');
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
      if (params.sourceid !== undefined) options.sourceid = Number(params.sourceid);
      if (params.targetid !== undefined) options.targetid = Number(params.targetid);
      if (params.hostility !== undefined) options.hostility = Number(params.hostility);
      if (params.limit !== undefined) options.limit = Number(params.limit);
      if (params.nextpagetimestamp !== undefined) options.nextPageTimestamp = Number(params.nextpagetimestamp);
      
      var filter = wclBuildFilterExpression_(params);
      if (filter !== undefined) options.filterExpression = filter;
      
      return wclV2FetchEvents_(auth, reportCode, dataType, options);
    }
  }

  throw new Error('[WCL Wrapper] Unsupported V1 REST URL path for V2 mapping: ' + parsed.path);
}
