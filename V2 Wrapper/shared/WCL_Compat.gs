/**
 * Warcraft Logs compatibility facade for CLA/RPB source files.
 *
 * Credential modes:
 *   api_key                 -> V1 REST
 *   client_id:client_secret -> V2 GraphQL client credentials
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

