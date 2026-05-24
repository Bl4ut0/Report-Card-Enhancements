/**
 * Warcraft Logs V2 GraphQL helpers.
 *
 * V2 mode must obtain an OAuth access token with client credentials, send
 * GraphQL POST requests, and normalize responses to the V1-style shapes used by
 * existing CLA/RPB code.
 */

var WCL_V2_TOKEN_URL_ = 'https://www.warcraftlogs.com/oauth/token';
var WCL_V2_CLIENT_URL_ = 'https://www.warcraftlogs.com/api/v2/client';

function wclV2FetchFights_(auth, reportCode, options) {
  wclUnsupported_('V2 fights wrapper is scaffolded but not implemented yet.');
}

function wclV2FetchTable_(auth, reportCode, dataType, options) {
  wclUnsupported_('V2 table wrapper is scaffolded but not implemented yet.');
}

function wclV2FetchEvents_(auth, reportCode, dataType, options) {
  wclUnsupported_('V2 events wrapper is scaffolded but not implemented yet.');
}

