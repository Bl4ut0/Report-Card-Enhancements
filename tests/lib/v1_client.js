/**
 * Warcraft Logs V1 REST API Client.
 * Makes direct calls to classic.warcraftlogs.com/v1/.
 */

const V1_BASE = 'https://classic.warcraftlogs.com:443/v1';

let lastFetchTime = 0;
const MIN_INTERVAL_MS = 3000;

/**
 * Rate-limited fetch with 3-second minimum spacing.
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  if (lastFetchTime > 0) {
    const elapsed = now - lastFetchTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
  }
  lastFetchTime = Date.now();

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`V1 API error ${response.status}: ${text.substring(0, 200)}`);
  }
  return response.json();
}

/**
 * Build a V1 REST URL with query parameters.
 */
function buildUrl(path, apiKey, params = {}) {
  let url = `${V1_BASE}/${path}?api_key=${encodeURIComponent(apiKey)}&translate=true`;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && key !== 'lang') {
      url += `&${key}=${encodeURIComponent(String(value))}`;
    }
  }
  return url;
}

export class V1Client {
  constructor(apiKey) {
    if (!apiKey) throw new Error('V1 API key is required');
    this.apiKey = apiKey.trim();
  }

  /**
   * GET report/fights/{code}
   * @returns {Object} Full fights response including fights[], enemies[], friendlies[], title, start, end, zone, completeRaids
   */
  async fetchFights(reportCode, params = {}) {
    const url = buildUrl(`report/fights/${reportCode}`, this.apiKey, params);
    return rateLimitedFetch(url);
  }

  /**
   * GET report/tables/{dataType}/{code}
   * @param {string} dataType - e.g. 'casts', 'damage-done', 'buffs', 'summary', etc.
   * @param {Object} params - start, end, sourceid, targetid, abilityid, encounter, hostility, filter, options, by, wipes, etc.
   */
  async fetchTable(reportCode, dataType, params = {}) {
    const url = buildUrl(`report/tables/${dataType}/${reportCode}`, this.apiKey, params);
    return rateLimitedFetch(url);
  }

  /**
   * GET report/events/{dataType}/{code}
   * @param {string} dataType - e.g. 'summary', 'deaths', 'buffs', 'casts', etc.
   */
  async fetchEvents(reportCode, dataType, params = {}) {
    const url = buildUrl(`report/events/${dataType}/${reportCode}`, this.apiKey, params);
    return rateLimitedFetch(url);
  }
}
