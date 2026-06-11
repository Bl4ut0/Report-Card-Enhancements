import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const wrapperPath = path.join(testDir, '..', 'RCE Replacements', 'RPB', 'TBC', 'v1.6.0a', 'wrapper.gs');
const wrapperSource = fs.readFileSync(wrapperPath, 'utf8');

const args = process.argv.slice(2);
const useProxy = args.includes('--proxy') || process.env.USE_PROXY === 'true';

// Setup Mock Properties Service based on environment
const propertyStore = {
  WCL_V1_API_KEY: process.env.WCL_V1_API_KEY,
  WCL_V2_CLIENT_ID: process.env.WCL_V2_CLIENT_ID,
  WCL_V2_CLIENT_SECRET: process.env.WCL_V2_CLIENT_SECRET,
  WCL_MIN_FETCH_INTERVAL_MS: '150', // Match wrapper-side pacing
};

if (useProxy) {
  propertyStore.WCL_PROXY_URL = process.env.WCL_PROXY_URL || 'https://falling-forest-3c7a.bl4ut0.workers.dev/wcl';
  propertyStore.WCL_PROXY_SECRET = process.env.WCL_PROXY_SECRET || 'UQKJp4jRw9Ts6XLXYSEiR9ZUGCJvBn0fZ9hnE2SLlhBMuy4pMr8lK2YDcMGvEPvJ';
}

let totalHttpRequests = 0;

// Synchronous fetch dispatcher using child process
function syncFetch(url, options = {}) {
  const payloadFile = path.join(os.tmpdir(), `wcl_fetch_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
  fs.writeFileSync(payloadFile, JSON.stringify({ url, options }));
  
  totalHttpRequests++;
  
  try {
    const helperPath = path.join(testDir, 'lib', 'sync_fetch_helper.js');
    const output = execSync(`node "${helperPath}" "${payloadFile}"`);
    const result = JSON.parse(output.toString());
    
    // Cleanup payload file
    try { fs.unlinkSync(payloadFile); } catch {}
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return {
      getContentText() { return result.text; },
      getResponseCode() { return result.status; },
      getHeaders() { return result.headers; }
    };
  } catch (err) {
    try { fs.unlinkSync(payloadFile); } catch {}
    throw err;
  }
}

// Set up the VM Context mimicking Google Apps Script
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Logger: {
    log(msg) { console.log(`[GAS Logger] ${msg}`); }
  },
  Utilities: {
    sleep(ms) {
      const start = Date.now();
      while (Date.now() - start < ms) {} // Sync sleep
    },
    base64Encode(str) {
      return Buffer.from(str).toString('base64');
    },
    Charset: {
      UTF_8: 'UTF-8'
    }
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperties: () => ({ ...propertyStore }),
        setProperty: (key, value) => { propertyStore[key] = value; },
        deleteProperty: (key) => { delete propertyStore[key]; },
      };
    },
  },
  UrlFetchApp: {
    fetch: syncFetch
  }
};

vm.createContext(context);
vm.runInContext(wrapperSource, context, { filename: wrapperPath });

// Retrieve the exposed global wrapper functions
const { wclV1Fetch_, wclBatchFetchV1Urls_ } = context;

async function main() {
  const reportCode = process.env.TEST_REPORT_CODE || '1XPTmVrMBQkAbFG2';
  let api_key = process.env.WCL_V1_API_KEY;
  const v2ClientId = process.env.WCL_V2_CLIENT_ID;
  const v2ClientSecret = process.env.WCL_V2_CLIENT_SECRET;
  
  if (v2ClientId && v2ClientSecret) {
    api_key = `${v2ClientId}:${v2ClientSecret}`;
  }
  
  if (!api_key) {
    throw new Error("Missing WCL_V1_API_KEY or WCL_V2 credentials in environment!");
  }
  
  console.log(`\n==================================================`);
  console.log(`RPB Full Run Simulation`);
  console.log(`Report Code: ${reportCode}`);
  console.log(`Using Proxy: ${useProxy ? 'YES' : 'NO'}`);
  console.log(`Mode: ${api_key.includes(':') ? 'V2 GraphQL (Batched)' : 'V1 REST (Sequential)'}`);
  console.log(`==================================================\n`);
  
  const startTime = Date.now();
  
  // 1. Fetch all fights (V1 mapping)
  console.log(`Step 1: Fetching fights...`);
  const baseUrl = "https://classic.warcraftlogs.com:443/v1/";
  const apiKeyString = `?translate=true&api_key=${api_key}`;
  const urlAllFights = `${baseUrl}report/fights/${reportCode}${apiKeyString}`;
  
  const allFightsData = wclV1Fetch_(urlAllFights);
  console.log(`✅ Fights retrieved. Title: "${allFightsData.title}", Friendlies: ${allFightsData.friendlies.length}`);
  
  // 2. Identify active players in RPB tracked classes
  const trackedClasses = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
  const activePlayers = allFightsData.friendlies.filter(p => trackedClasses.includes(p.type));
  console.log(`\nStep 2: Tracked players in report: ${activePlayers.length}`);
  
  // 3. Fetch global tables
  console.log(`\nStep 3: Fetching global tables...`);
  const startEndString = "&start=0&end=999999999999&filter=encounterid%20%21%3D%20724";
  const startEndStringNoFilter = "&start=0&end=999999999999";
  
  const urlDamageTakenTop = baseUrl + "report/tables/damage-taken/" + reportCode + apiKeyString + startEndString + "&options=4098&by=ability";
  const urlDebuffsTop = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndString + "&options=2&hostility=1&by=target";
  const urlPeopleTracked = baseUrl + "report/tables/casts/" + reportCode + apiKeyString + startEndString;
  const urlDeathsOnTrash = baseUrl + "report/tables/deaths/" + reportCode + apiKeyString + startEndString + "&encounter=0";
  const urlDeaths = baseUrl + "report/tables/deaths/" + reportCode + apiKeyString + startEndString;
  const urlHostilePlayers = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndString + "&targetclass=player&by=source";
  const urlDamageReflected = baseUrl + "report/tables/damage-taken/" + reportCode + apiKeyString + startEndStringNoFilter + "&filter=target.name%3Dsource.name%20AND%20ability.id!%3D%27348191%27%20AND%20ability.id!%3D%2716666%27&by=target";
  
  console.log("Fetching urlDamageTakenTop...");
  const damageTakenTop = wclV1Fetch_(urlDamageTakenTop);
  
  console.log("Fetching urlDebuffsTop...");
  const debuffsTakenTop = wclV1Fetch_(urlDebuffsTop);
  
  console.log("Fetching urlPeopleTracked...");
  const allPlayersCasting = wclV1Fetch_(urlPeopleTracked);
  
  console.log("Fetching urlDeathsOnTrash...");
  const deathsDataTrash = wclV1Fetch_(urlDeathsOnTrash);
  
  console.log("Fetching urlDeaths...");
  const deathsData = wclV1Fetch_(urlDeaths);
  
  console.log("Fetching urlHostilePlayers...");
  const hostilePlayersData = wclV1Fetch_(urlHostilePlayers);
  
  console.log("Fetching urlDamageReflected...");
  const damageReflectedData = wclV1Fetch_(urlDamageReflected);
  
  // 4. Batch fetch debuffs info
  console.log(`\nStep 4: Batch fetching debuffs info...`);
  const debuffsToTrack = [
    "Sunder Armor [25225]",
    "Faerie Fire [26980]",
    "Curse of Recklessness [27226]",
    "Curse of Elements [27228]",
    "Scorpid Sting [30165]"
  ];
  
  const urlDebuffInfo = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndString + "&options=2&hostility=1&by=target&abilityid=";
  
  const spellIdsToFetch = [];
  debuffsToTrack.forEach(function (ability) {
    if (ability.indexOf("[") > -1) {
      const spellId = ability.split("[")[1].split("]")[0];
      debuffsTakenTop.auras.forEach(function (abilityFromLogs) {
        if (abilityFromLogs.guid != null && abilityFromLogs.guid.toString() === spellId) {
          if (spellIdsToFetch.indexOf(spellId) === -1) {
            spellIdsToFetch.push(spellId);
          }
        }
      });
    }
  });
  
  console.log(`Active debuffs found to fetch: ${spellIdsToFetch.join(', ')}`);
  const debuffUrls = spellIdsToFetch.map(id => urlDebuffInfo + id);
  const debuffInfoResults = wclBatchFetchV1Urls_(api_key, reportCode, debuffUrls);
  console.log(`✅ Batched debuff fetch complete. Retrieved ${debuffInfoResults.length} tables.`);
  
  // 5. Batch fetch boss-specific tables
  console.log(`\nStep 5: Batch fetching boss tables...`);
  const urlSummary = baseUrl + "report/tables/summary/" + reportCode + apiKeyString + startEndString;
  const urlDamageDone = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndString + "&options=2&sourceid=";
  
  const bossUrls = [];
  allFightsData.fights.forEach(function (fight) {
    if (fight.start_time != fight.end_time && fight.boss > 0) {
      const summaryUrl = urlSummary.replace(startEndString, `&start=${fight.start_time}&end=${fight.end_time}`).replace("&encounter=0", "");
      const damageUrl = urlDamageDone.replace("&sourceid=", "").replace(startEndString, `&start=${fight.start_time}&end=${fight.end_time}`) + "&abilityid=27187";
      bossUrls.push(summaryUrl, damageUrl);
    }
  });
  
  console.log(`Executing batch fetch for ${bossUrls.length} boss fight tables...`);
  const bossResults = wclBatchFetchV1Urls_(api_key, reportCode, bossUrls);
  console.log(`✅ Boss batch fetch complete. Retrieved ${bossResults.length} tables.`);
  
  // 6. Simulate Player Loop (batching player queries)
  console.log(`\nStep 6: Simulating player loops (fetching player metrics)...`);
  
  const urlPlayersOnTrash = baseUrl + "report/tables/casts/" + reportCode + apiKeyString + startEndString + "&encounter=0&sourceid=";
  const urlPlayers = baseUrl + "report/tables/casts/" + reportCode + apiKeyString + startEndString + "&sourceid=";
  const urlBuffsOnTrash = baseUrl + "report/tables/buffs/" + reportCode + apiKeyString + startEndString + "&by=target&encounter=0&targetid=";
  const urlBuffsTotal = baseUrl + "report/tables/buffs/" + reportCode + apiKeyString + startEndString + "&by=target&targetid=";
  const urlDamageTakenTotal = baseUrl + "report/tables/damage-taken/" + reportCode + apiKeyString + startEndString + "&options=4134&sourceid=";
  const urlDebuffs = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndString + "&options=2&hostility=1&by=target&targetid=";
  const urlDebuffsApplied = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndString + "&hostility=1&targetid=";
  const urlDebuffsAppliedBosses = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndString + "&encounter=-2&hostility=1&targetid=";
  const urlDebuffsAppliedBossesJudgement = baseUrl + "report/tables/debuffs/" + reportCode + apiKeyString + startEndStringNoFilter + "&encounter=-2&hostility=1&filter=ability.id%20IN%20%2827164%2C27162%2C31898%2C41461%2C32220%2C27172%2C27171%2C356112%2C31896%2C27162%2C27163%2C27164%2C27165%2C31804%2C27159%2C27157%2C348702%29%20AND%20encounterid%20%21%3D%20724&targetid=";
  const urlHealing = baseUrl + "report/tables/healing/" + reportCode + apiKeyString + startEndString + "&sourceid=";
  const urlHealingTarget = baseUrl + "report/tables/healing/" + reportCode + apiKeyString + startEndString + "&targetid=";
  const urlFriendlyFireBase = baseUrl + "report/tables/damage-taken/" + reportCode + apiKeyString + startEndStringNoFilter + "&filter=NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2229546%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2229546%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2245717%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2245717%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2237122%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2237122%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2237135%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2237135%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2241345%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2241345%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20NOT%20IN%20RANGE%20FROM%20type%20%3D%20%22applydebuff%22%20AND%20ability.id%20%3D%20%2243361%22%20AND%20target.name%3D%22Qlap%22%20TO%20type%20%3D%20%22removedebuff%22%20and%20ability.id%3D%2243361%22%20AND%20target.name%3D%22Qlap%22%20END%20AND%20encounterid%20%21%3D%20724%20AND%20ability.id%20%21%3D%2046768%20&options=4135&by=target&targetid=";
  
  const urlVTManaGain = baseUrl + "report/tables/resources-gains/" + reportCode + apiKeyString + startEndStringNoFilter + "&filter=ability.id%20%3D%2034919%20AND%20encounterid%20%21%3D%20724&abilityid=100&sourceid=";
  const urlShadowDamageDone = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndStringNoFilter + "&filter=ability.id%20IN%20%288129%2C8131%2C10874%2C10875%2C10876%2C25379%2C25380%2C8092%2C8102%2C8104%2C8105%2C8106%2C10945%2C10946%2C10947%2C25372%2C25375%2C25387%2C18807%2C17314%2C17313%2C17312%2C17311%2C15407%2C32379%2C32996%2C25368%2C25367%2C10894%2C10893%2C10892%2C2767%2C992%2C970%2C594%2C589%2C34914%2C34916%2C34917%2C25467%2C45055%29%20AND%20encounterid%20%21%3D%20724&by=source&sourceid=";
  const urlTwistsDoneOnBosses = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndStringNoFilter + "&abilityid=1&by=source&options=2&sourceAurasPresent=20375,31892&encounter=-2&sourceid=";
  const urlWindfuryAttacksOnTwistsDoneOnBosses = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndStringNoFilter + "&abilityid=1&by=source&options=2&sourceAurasPresent=20375,31892,25584&encounter=-2&sourceid=";
  const urlWindfuryAttacksOnBosses = baseUrl + "report/tables/buffs/" + reportCode + apiKeyString + startEndString + "&abilityid=25584&by=source&options=2&encounter=-2&sourceid=";
  const urlDamageDoneOnBosses = baseUrl + "report/tables/damage-done/" + reportCode + apiKeyString + startEndString + "&options=2&abilityid=1&by=source&options=2&encounter=-2&sourceid=";

  for (let i = 0; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    console.log(`Processing player [${i + 1}/${activePlayers.length}]: ${player.name} (${player.type})...`);
    
    const urlFriendlyFireReplaced = urlFriendlyFireBase.replace(/Qlap/g, player.name) + player.id;
    const playerUrls = [];
    
    playerUrls.push(urlPlayers + player.id);
    playerUrls.push(urlPlayersOnTrash + player.id);
    playerUrls.push(urlDamageDone + player.id);
    playerUrls.push(urlBuffsOnTrash + player.id);
    playerUrls.push(urlBuffsTotal + player.id);
    playerUrls.push(urlDamageTakenTotal + player.id);
    playerUrls.push(urlDebuffsApplied + player.id);
    playerUrls.push(urlDebuffsAppliedBosses + player.id);
    
    if (player.type == "Paladin") {
      playerUrls.push(urlDebuffsAppliedBossesJudgement + player.id);
    }
    
    playerUrls.push(urlDebuffs + player.id);
    playerUrls.push(urlHealing + player.id);
    playerUrls.push(urlHealingTarget + player.id + "&by=ability");
    playerUrls.push(urlFriendlyFireReplaced);
    
    if (player.type == "Priest") {
      playerUrls.push(urlVTManaGain + player.id);
      playerUrls.push(urlShadowDamageDone + player.id);
    } else if (player.type == "Paladin") {
      playerUrls.push(urlTwistsDoneOnBosses + player.id);
      playerUrls.push(urlWindfuryAttacksOnTwistsDoneOnBosses + player.id);
      playerUrls.push(urlWindfuryAttacksOnTwistsDoneOnBosses.replace("25584", "8516") + player.id);
      playerUrls.push(urlWindfuryAttacksOnBosses + player.id);
      playerUrls.push(urlWindfuryAttacksOnBosses.replace("25584", "8516") + player.id);
      playerUrls.push(urlDamageDoneOnBosses + player.id);
    }
    
    const results = wclBatchFetchV1Urls_(api_key, reportCode, playerUrls);
    console.log(`  -> Fetched ${playerUrls.length} tables in batch. Active network fetches: ${totalHttpRequests}`);
    
    // Add small pacing delay between players (e.g. 500ms to be safe)
    await new Promise(r => setTimeout(r, 500));
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n==================================================`);
  console.log(`Simulation Summary:`);
  console.log(`  - Total active players processed: ${activePlayers.length}`);
  console.log(`  - Total HTTP request operations executed: ${totalHttpRequests}`);
  console.log(`  - Total Time Elapsed: ${elapsed}s`);
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error(`\n❌ Simulation Failed:`, err.message);
  process.exit(1);
});
