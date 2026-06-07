/**
 * Warcraft Logs V2 via Proxy Client.
 * Routes all V2 GraphQL calls through the Cloudflare Worker proxy.
 * Uses the envelope format defined in Combined Proxy/worker.js.
 */

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const CLIENT_URL = 'https://www.warcraftlogs.com/api/v2/client';

import { mapFightsToV1, buildFilterExpression } from './v2_client.js';

let lastFetchTime = 0;
const MIN_INTERVAL_MS = 3000;

let cachedToken = null;
let tokenExpiresAt = 0;

// ─── Data type mappings (same as v2_client.js) ────────────────────────────

const TABLE_DATA_TYPE_MAP = {
  'summary': 'Summary', 'buffs': 'Buffs', 'casts': 'Casts',
  'damage-done': 'DamageDone', 'damage-taken': 'DamageTaken',
  'deaths': 'Deaths', 'debuffs': 'Debuffs', 'healing': 'Healing',
  'interrupts': 'Interrupts', 'resources': 'Resources',
  'resources-gains': 'Resources',
};

const EVENT_DATA_TYPE_MAP = {
  'summary': 'All', 'buffs': 'Buffs', 'casts': 'Casts',
  'damage-done': 'DamageDone', 'damage-taken': 'DamageTaken',
  'deaths': 'Deaths', 'debuffs': 'Debuffs', 'healing': 'Healing',
  'interrupts': 'Interrupts', 'resources': 'Resources',
};

function getTableDataType(v1Type) {
  return TABLE_DATA_TYPE_MAP[(v1Type || '').toLowerCase()] || 'Casts';
}

function getEventDataType(v1Type) {
  return EVENT_DATA_TYPE_MAP[(v1Type || '').toLowerCase()] || 'All';
}

// ─── Proxy fetch ──────────────────────────────────────────────────────────

/**
 * Send a request through the Cloudflare Worker proxy using the envelope format.
 * @param {string} proxyUrl - The worker URL (e.g. https://falling-forest-3c7a.bl4ut0.workers.dev/wcl)
 * @param {string} proxySecret - The x-wcl-proxy-secret value
 * @param {Object} envelope - { url, method, headers, body }
 * @returns {Object} { data, proxyHeaders }
 */
async function proxyFetch(proxyUrl, proxySecret, envelope) {
  const now = Date.now();
  if (lastFetchTime > 0) {
    const elapsed = now - lastFetchTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
  }
  lastFetchTime = Date.now();

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-wcl-proxy-secret': proxySecret,
    },
    body: JSON.stringify(envelope),
  });

  const proxyHeaders = {
    attempts: response.headers.get('x-wcl-proxy-attempts'),
    cache: response.headers.get('x-wcl-proxy-cache'),
    fallbackReason: response.headers.get('x-wcl-proxy-fallback-reason'),
  };

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proxy error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  return { data, proxyHeaders };
}

// ─── Client class ─────────────────────────────────────────────────────────

export class ProxyClient {
  constructor(proxyUrl, proxySecret, clientId, clientSecret) {
    if (!proxyUrl) throw new Error('Proxy URL is required');
    if (!proxySecret) throw new Error('Proxy secret is required');
    if (!clientId || !clientSecret) throw new Error('V2 client credentials are required');

    this.proxyUrl = proxyUrl.trim();
    this.proxySecret = proxySecret.trim();
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
    this.lastProxyHeaders = null;
  }

  /**
   * Get OAuth2 access token via proxy (cached).
   */
  async getAccessToken() {
    if (cachedToken && tokenExpiresAt > Date.now() + 60000) {
      return cachedToken;
    }

    const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const { data } = await proxyFetch(this.proxyUrl, this.proxySecret, {
      url: TOKEN_URL,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!data || !data.access_token) {
      throw new Error('Failed to retrieve V2 access token via proxy');
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
    return cachedToken;
  }

  /**
   * Execute a GraphQL query via proxy.
   */
  async graphqlQuery(query, variables) {
    const token = await this.getAccessToken();

    const payload = { query };
    if (variables) payload.variables = variables;

    const { data, proxyHeaders } = await proxyFetch(this.proxyUrl, this.proxySecret, {
      url: CLIENT_URL,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    this.lastProxyHeaders = proxyHeaders;
    return data;
  }

  /**
   * Get the proxy headers from the last request.
   */
  getLastProxyHeaders() {
    return this.lastProxyHeaders;
  }

  /**
   * Fetch fights and map to V1 format (via proxy).
   */
  async fetchFights(reportCode) {
    const query = `query ($code: String!) {
      rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
      reportData {
        report(code: $code) {
          title
          startTime
          endTime
          zone { id name }
          fights {
            id startTime endTime encounterID kill name
            originalEncounterID fightPercentage bossPercentage
            friendlyPlayers
            enemyNPCs { id gameID }
            friendlyPets { id gameID }
            gameZone { id name }
            difficulty
            size
          }
          masterData {
            actors { id gameID name type subType petOwner }
          }
        }
      }
    }`;

    const rawResponse = await this.graphqlQuery(query, { code: reportCode });

    if (!rawResponse?.data?.reportData?.report) {
      throw new Error(`Failed to fetch fights via proxy for ${reportCode}: ${JSON.stringify(rawResponse?.errors || {})}`);
    }

    return {
      raw: rawResponse.data.reportData.report,
      mapped: mapFightsToV1(rawResponse.data.reportData.report),
    };
  }

  /**
   * Fetch table data via proxy.
   */
  async fetchTable(reportCode, dataType, params = {}) {
    const query = `query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: TableDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $encounterID: Int, $hostilityType: HostilityType, $filterExpression: String, $viewBy: ViewType, $viewOptions: Int, $killType: KillType) {
      rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
      reportData {
        report(code: $code) {
          table(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, encounterID: $encounterID, hostilityType: $hostilityType, filterExpression: $filterExpression, viewBy: $viewBy, viewOptions: $viewOptions, killType: $killType)
        }
      }
    }`;

    const filterExpression = params.filterExpression || buildFilterExpression(params);

    let viewByVal = undefined;
    if (params.by) {
      const byVal = params.by.toLowerCase();
      if (byVal === 'target') viewByVal = 'Target';
      else if (byVal === 'source') viewByVal = 'Source';
      else if (byVal === 'ability') viewByVal = 'Ability';
    }

    let killTypeVal = undefined;
    if (params.wipes !== undefined && params.encounter !== undefined && Number(params.encounter) !== 0) {
      const wipesVal = Number(params.wipes);
      if (wipesVal === 1) killTypeVal = 'Wipes';
      else if (wipesVal === 2) killTypeVal = 'Kills';
      else if (wipesVal === 0) killTypeVal = 'All';
    }

    const variables = {
      code: reportCode,
      startTime: params.start !== undefined ? Number(params.start) : 0,
      endTime: params.end !== undefined ? Number(params.end) : 999999999999,
      dataType: getTableDataType(dataType),
      abilityID: params.abilityid !== undefined ? Number(params.abilityid) : undefined,
      sourceID: params.sourceid !== undefined ? Number(params.sourceid) : undefined,
      targetID: params.targetid !== undefined ? Number(params.targetid) : undefined,
      encounterID: (params.encounter !== undefined && Number(params.encounter) > 0) ? Number(params.encounter) : undefined,
      hostilityType: params.hostility !== undefined ? (params.hostility == 1 ? 'Enemies' : 'Friendlies') : undefined,
      filterExpression: filterExpression || undefined,
      viewBy: viewByVal,
      viewOptions: params.options !== undefined ? Number(params.options) : undefined,
      killType: killTypeVal,
    };

    Object.keys(variables).forEach(k => { if (variables[k] === undefined) delete variables[k]; });

    const rawResponse = await this.graphqlQuery(query, variables);

    if (!rawResponse?.data?.reportData?.report?.table) {
      return { entries: [] };
    }

    return rawResponse.data.reportData.report.table.data || rawResponse.data.reportData.report.table;
  }

  /**
   * Fetch event data via proxy.
   */
  async fetchEvents(reportCode, dataType, params = {}) {
    const query = `query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: EventDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $hostilityType: HostilityType, $limit: Int, $filterExpression: String, $killType: KillType) {
      rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
      reportData {
        report(code: $code) {
          events(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, hostilityType: $hostilityType, limit: $limit, filterExpression: $filterExpression, killType: $killType) {
            data
            nextPageTimestamp
          }
        }
      }
    }`;

    const filterExpression = params.filterExpression || buildFilterExpression(params);

    let killTypeVal = undefined;
    if (params.wipes !== undefined && params.encounter !== undefined && Number(params.encounter) !== 0) {
      const wipesVal = Number(params.wipes);
      if (wipesVal === 1) killTypeVal = 'Wipes';
      else if (wipesVal === 2) killTypeVal = 'Kills';
      else if (wipesVal === 0) killTypeVal = 'All';
    }

    const variables = {
      code: reportCode,
      startTime: params.start !== undefined ? Number(params.start) : 0,
      endTime: params.end !== undefined ? Number(params.end) : 999999999999,
      dataType: getEventDataType(dataType),
      abilityID: params.abilityid !== undefined ? Number(params.abilityid) : undefined,
      sourceID: params.sourceid !== undefined ? Number(params.sourceid) : undefined,
      targetID: params.targetid !== undefined ? Number(params.targetid) : undefined,
      hostilityType: params.hostility !== undefined ? (params.hostility == 1 ? 'Enemies' : 'Friendlies') : undefined,
      limit: params.limit !== undefined ? Number(params.limit) : 10000,
      filterExpression: filterExpression || undefined,
      killType: killTypeVal,
    };

    Object.keys(variables).forEach(k => { if (variables[k] === undefined) delete variables[k]; });

    const rawResponse = await this.graphqlQuery(query, variables);

    if (!rawResponse?.data?.reportData?.report?.events) {
      return { events: [], nextPageTimestamp: null };
    }

    const eventsData = rawResponse.data.reportData.report.events;
    const eventsList = eventsData.data || [];

    for (const ev of eventsList) {
      if (ev.abilityGameID !== undefined && ev.ability === undefined) {
        ev.ability = { name: '', guid: ev.abilityGameID, type: 0, abilityIcon: '' };
      }
    }

    return {
      events: eventsList,
      nextPageTimestamp: eventsData.nextPageTimestamp,
    };
  }

  /**
   * Test proxy authentication with invalid secret (expects 401).
   */
  async testInvalidAuth() {
    try {
      await proxyFetch(this.proxyUrl, 'INVALID_SECRET_12345', {
        url: TOKEN_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
      return { passed: false, reason: 'Expected 401 but got success' };
    } catch (err) {
      if (err.message.includes('401')) {
        return { passed: true, reason: 'Correctly rejected invalid secret' };
      }
      return { passed: false, reason: `Unexpected error: ${err.message}` };
    }
  }
}
