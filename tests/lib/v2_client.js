/**
 * Warcraft Logs V2 GraphQL API Client.
 * Direct port of WCL_Compat.gs V2 functions to Node.js.
 * Makes calls to www.warcraftlogs.com/api/v2/client.
 */

const TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const CLIENT_URL = 'https://www.warcraftlogs.com/api/v2/client';

let lastFetchTime = 0;
const MIN_INTERVAL_MS = 3000;

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Rate-limited fetch with 3-second minimum spacing.
 */
async function rateLimitedFetch(url, options) {
  const now = Date.now();
  if (lastFetchTime > 0) {
    const elapsed = now - lastFetchTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
  }
  lastFetchTime = Date.now();

  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V2 API error ${response.status}: ${text.substring(0, 300)}`);
  }
  return response.json();
}

// ─── Data type mappings (ported from WCL_Compat.gs L420-461) ──────────────

const TABLE_DATA_TYPE_MAP = {
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
  'threat': 'Threat',
};

const EVENT_DATA_TYPE_MAP = {
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
  'threat': 'Threat',
};

function getTableDataType(v1Type) {
  return TABLE_DATA_TYPE_MAP[(v1Type || '').toLowerCase()] || 'Casts';
}

function getEventDataType(v1Type) {
  return EVENT_DATA_TYPE_MAP[(v1Type || '').toLowerCase()] || 'All';
}

// ─── V1 mapping (ported from WCL_Compat.gs L464-553) ─────────────────────

/**
 * Map V2 GraphQL fights response to V1 REST format.
 * Direct port of wclV2MapFightsToV1_.
 */
export function mapFightsToV1(graphqlReport) {
  const v1 = {
    title: graphqlReport.title || '',
    lang: graphqlReport.lang || 'en',
    start: graphqlReport.startTime,
    end: graphqlReport.endTime,
    zone: graphqlReport.zone ? graphqlReport.zone.id : 0,
    fights: [],
    enemies: [],
    friendlies: [],
  };

  if (graphqlReport.fights) {
    for (const f of graphqlReport.fights) {
      const fightZone = f.gameZone || graphqlReport.zone || {};
      const isBoss = f.encounterID && f.encounterID > 0;
      const fightObj = {
        id: f.id,
        start_time: f.startTime,
        end_time: f.endTime,
        boss: f.encounterID || 0,
        name: f.name || '',
        zoneID: fightZone.id || 0,
        zoneName: fightZone.name || '',
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

  const actors = (graphqlReport.masterData && graphqlReport.masterData.actors) || [];

  for (const a of actors) {
    const mappedActor = {
      id: a.id,
      guid: a.gameID,
      name: a.name,
      type: a.subType || a.type,
      fights: [],
    };

    if (graphqlReport.fights) {
      for (const fight of graphqlReport.fights) {
        let participated = false;

        if (a.type === 'Player') {
          if (fight.friendlyPlayers && fight.friendlyPlayers.includes(a.id)) {
            participated = true;
          }
        } else if (a.type === 'NPC' || a.type === 'Boss') {
          if (fight.enemyNPCs) {
            participated = fight.enemyNPCs.some(e => e.id === a.id);
          }
        } else if (a.type === 'Pet') {
          if (fight.friendlyPets) {
            participated = fight.friendlyPets.some(p => p.id === a.id);
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

// ─── Filter expression builder (ported from WCL_Compat.gs L583-648) ──────

/**
 * Build a V2 filterExpression from V1 query parameters.
 * Direct port of wclBuildFilterExpression_.
 */
export function buildFilterExpression(params) {
  const parts = [];

  if (params.filter) {
    parts.push(params.filter);
  }

  if (params.encounter !== undefined) {
    const encounterVal = Number(params.encounter);
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

  if (params.sourceauraspresent || params.sourceAurasPresent) {
    const auras = (params.sourceauraspresent || params.sourceAurasPresent).split(',');
    for (const aura of auras) {
      parts.push('source.buff.' + aura.trim());
    }
  }

  if (params.sourceaurasabsent || params.sourceAurasAbsent) {
    const auras = (params.sourceaurasabsent || params.sourceAurasAbsent).split(',');
    for (const aura of auras) {
      parts.push('not source.buff.' + aura.trim());
    }
  }

  if (params.targetauraspresent || params.targetAurasPresent) {
    const auras = (params.targetauraspresent || params.targetAurasPresent).split(',');
    for (const aura of auras) {
      parts.push('(target.buff.' + aura.trim() + ' or target.debuff.' + aura.trim() + ')');
    }
  }

  if (params.targetaurasabsent || params.targetAurasAbsent) {
    const auras = (params.targetaurasabsent || params.targetAurasAbsent).split(',');
    for (const aura of auras) {
      parts.push('not (target.buff.' + aura.trim() + ' or target.debuff.' + aura.trim() + ')');
    }
  }

  if (params.targetclass || params.targetClass) {
    const cls = (params.targetclass || params.targetClass).toLowerCase();
    if (cls === 'player') {
      parts.push('target.type = "player"');
    } else {
      parts.push('target.class = "' + (params.targetclass || params.targetClass) + '"');
    }
  }



  return parts.length > 0 ? parts.join(' and ') : undefined;
}

// ─── Client class ─────────────────────────────────────────────────────────

export class V2Client {
  constructor(clientId, clientSecret) {
    if (!clientId || !clientSecret) throw new Error('V2 client credentials are required');
    this.clientId = clientId.trim();
    this.clientSecret = clientSecret.trim();
  }

  /**
   * Get OAuth2 access token (cached).
   * Port of wclV2GetAccessToken_.
   */
  async getAccessToken() {
    if (cachedToken && tokenExpiresAt > Date.now() + 60000) {
      return cachedToken;
    }

    const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await rateLimitedFetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response || !response.access_token) {
      throw new Error('Failed to retrieve V2 access token');
    }

    cachedToken = response.access_token;
    tokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000);
    return cachedToken;
  }

  /**
   * Execute a GraphQL query.
   * Port of wclV2GraphQLQuery_.
   */
  async graphqlQuery(query, variables) {
    const token = await this.getAccessToken();

    const payload = { query };
    if (variables) payload.variables = variables;

    return rateLimitedFetch(CLIENT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Fetch fights and map to V1 format.
   * Port of wclV2FetchFights_ (WCL_Compat.gs L292-337).
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
            id
            startTime
            endTime
            encounterID
            kill
            name
            originalEncounterID
            fightPercentage
            bossPercentage
            friendlyPlayers
            enemyNPCs { id gameID }
            friendlyPets { id gameID }
            gameZone { id name }
            difficulty
            size
          }
          masterData {
            actors {
              id
              gameID
              name
              type
              subType
              petOwner
            }
          }
        }
      }
    }`;

    const rawResponse = await this.graphqlQuery(query, { code: reportCode });

    if (!rawResponse?.data?.reportData?.report) {
      throw new Error(`Failed to fetch V2 fights for ${reportCode}: ${JSON.stringify(rawResponse?.errors || {})}`);
    }

    return {
      raw: rawResponse.data.reportData.report,
      mapped: mapFightsToV1(rawResponse.data.reportData.report),
    };
  }

  /**
   * Fetch a raw V2 fights response without V1 mapping (for proxy comparison).
   */
  async fetchFightsRaw(reportCode) {
    const result = await this.fetchFights(reportCode);
    return result.raw;
  }

  /**
   * Fetch table data.
   * Port of wclV2FetchTable_ (WCL_Compat.gs L339-368).
   */
  async fetchTable(reportCode, dataType, params = {}) {
    const query = `query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: TableDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $encounterID: Int, $hostilityType: HostilityType, $filterExpression: String, $viewBy: ViewType, $viewOptions: Int) {
      rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
      reportData {
        report(code: $code) {
          table(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, encounterID: $encounterID, hostilityType: $hostilityType, filterExpression: $filterExpression, viewBy: $viewBy, viewOptions: $viewOptions)
        }
      }
    }`;

    // Build filter expression from V1-style params
    const filterExpression = params.filterExpression || buildFilterExpression(params);

    let viewByVal = undefined;
    if (params.by) {
      const byVal = params.by.toLowerCase();
      if (byVal === 'target') viewByVal = 'Target';
      else if (byVal === 'source') viewByVal = 'Source';
      else if (byVal === 'ability') viewByVal = 'Ability';
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
    };

    // Clean undefined values
    Object.keys(variables).forEach(k => { if (variables[k] === undefined) delete variables[k]; });

    const rawResponse = await this.graphqlQuery(query, variables);

    if (!rawResponse?.data?.reportData?.report?.table) {
      return { entries: [] };
    }

    return rawResponse.data.reportData.report.table.data || rawResponse.data.reportData.report.table;
  }

  /**
   * Fetch event data.
   * Port of wclV2FetchEvents_ (WCL_Compat.gs L370-417).
   */
  async fetchEvents(reportCode, dataType, params = {}) {
    const query = `query ($code: String!, $startTime: Float!, $endTime: Float!, $dataType: EventDataType, $abilityID: Float, $sourceID: Int, $targetID: Int, $hostilityType: HostilityType, $limit: Int, $filterExpression: String) {
      rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }
      reportData {
        report(code: $code) {
          events(startTime: $startTime, endTime: $endTime, dataType: $dataType, abilityID: $abilityID, sourceID: $sourceID, targetID: $targetID, hostilityType: $hostilityType, limit: $limit, filterExpression: $filterExpression) {
            data
            nextPageTimestamp
          }
        }
      }
    }`;

    const filterExpression = params.filterExpression || buildFilterExpression(params);

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
    };

    Object.keys(variables).forEach(k => { if (variables[k] === undefined) delete variables[k]; });

    const rawResponse = await this.graphqlQuery(query, variables);

    if (!rawResponse?.data?.reportData?.report?.events) {
      return { events: [], nextPageTimestamp: null };
    }

    const eventsData = rawResponse.data.reportData.report.events;
    const eventsList = eventsData.data || [];

    // Synthesize ability object if missing (port of WCL_Compat.gs L403-412)
    for (const ev of eventsList) {
      if (ev.abilityGameID !== undefined && ev.ability === undefined) {
        ev.ability = {
          name: '',
          guid: ev.abilityGameID,
          type: 0,
          abilityIcon: '',
        };
      }
    }

    return {
      events: eventsList,
      nextPageTimestamp: eventsData.nextPageTimestamp,
    };
  }
}
