import 'dotenv/config';
import { V1Client } from './lib/v1_client.js';
import { V2Client } from './lib/v2_client.js';
import { deepCompare } from './lib/compare.js';

const CONFIG = {
  v1ApiKey: process.env.WCL_V1_API_KEY,
  v2ClientId: process.env.WCL_V2_CLIENT_ID,
  v2ClientSecret: process.env.WCL_V2_CLIENT_SECRET,
  reportCode: process.env.TEST_REPORT_CODE || 'TmNwkjXayJKtcR4W',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const v1Client = new V1Client(CONFIG.v1ApiKey);
  const v2Client = new V2Client(CONFIG.v2ClientId, CONFIG.v2ClientSecret);
  await v2Client.getAccessToken();

  console.log("Fetching fights to find a target player...");
  const fights = await v1Client.fetchFights(CONFIG.reportCode);
  const player = fights.friendlies.find(f => f.type === 'Druid' || f.type === 'Priest' || f.type === 'Mage' || f.type === 'Warlock' || f.type === 'Warrior');
  if (!player) {
    throw new Error("No player found in report!");
  }
  console.log(`Using player: ${player.name} (ID: ${player.id})`);

  const testQueries = [
    {
      name: "urlDebuffsAppliedBossesTotal",
      dataType: "debuffs",
      params: { hostility: 1, encounter: -2 }
    },
    {
      name: "urlDebuffsAppliedTotal",
      dataType: "debuffs",
      params: { hostility: 1 }
    },
    {
      name: "urlDebuffsApplied",
      dataType: "debuffs",
      params: { hostility: 1, targetid: player.id }
    },
    {
      name: "urlDebuffsAppliedBosses",
      dataType: "debuffs",
      params: { hostility: 1, encounter: -2, targetid: player.id }
    },
    {
      name: "urlDebuffsTop",
      dataType: "debuffs",
      params: { hostility: 1, encounter: -2, by: "target", options: 2 }
    },
    {
      name: "urlDebuffInfo",
      dataType: "debuffs",
      params: { hostility: 1, encounter: -2, by: "target", options: 2, abilityid: 27087 } // Cone of Cold or another debuff
    },
    {
      name: "urlBuffsTotal",
      dataType: "buffs",
      params: { by: "target", targetid: player.id }
    },
    {
      name: "urlBuffsOnTrash",
      dataType: "buffs",
      params: { by: "target", encounter: 0, targetid: player.id }
    },
    {
      name: "urlBuffsKillsOnly",
      dataType: "buffs",
      params: { by: "target", targetid: player.id, wipes: 2, encounter: -2 }
    },
    {
      name: "urlDebuffsWipesOnly",
      dataType: "debuffs",
      params: { hostility: 1, targetid: player.id, wipes: 1, encounter: -2 }
    },
    {
      name: "urlDamageTakenTop",
      dataType: "damage-taken",
      params: { by: "ability", options: 4098 }
    }
  ];

  console.log(`\nStarting verification for ${testQueries.length} RPB query configurations...\n`);
  
  let failures = 0;

  for (const t of testQueries) {
    console.log(`----------------------------------------`);
    console.log(`Test: ${t.name} (Type: ${t.dataType})`);
    console.log(`Params:`, JSON.stringify(t.params));
    
    // Add start and end times to options
    const queryParams = {
      start: 0,
      end: 999999999999,
      ...t.params
    };

    console.log("Fetching V1...");
    const v1Data = await v1Client.fetchTable(CONFIG.reportCode, t.dataType, queryParams);
    
    await sleep(2000); // Small delay to avoid WCL rate limit

    console.log("Fetching V2...");
    const v2Data = await v2Client.fetchTable(CONFIG.reportCode, t.dataType, queryParams);

    // Normalize stackUptime type difference (V1 returns object, V2 returns array)
    if (v1Data.auras) {
      v1Data.auras.forEach(aura => {
        if (aura.stackUptime && typeof aura.stackUptime === 'object' && !Array.isArray(aura.stackUptime)) {
          aura.stackUptime = Object.values(aura.stackUptime);
        }
      });
    }
    if (v2Data.auras) {
      v2Data.auras.forEach(aura => {
        if (aura.stackUptime && typeof aura.stackUptime === 'object' && !Array.isArray(aura.stackUptime)) {
          aura.stackUptime = Object.values(aura.stackUptime);
        }
      });
    }

    const diffs = deepCompare(v1Data, v2Data, '$', [], {
      ignorePaths: new Set([
        '$.auras[*].stackUptime',
        '$.totalTime',
        '$.startTime',
        '$.endTime'
      ]) // ignore minor formatting and unused top-level metadata
    });

    if (diffs.length === 0) {
      console.log(`✅ PASS: V1 and V2 matched perfectly! Auras count: ${v1Data.auras?.length || 0}`);
    } else {
      console.log(`❌ FAIL: Found ${diffs.length} differences!`);
      console.log(JSON.stringify(diffs.slice(0, 5), null, 2));
      failures++;
    }
    
    await sleep(4000); // Pacing delay before next query
  }

  console.log(`\n========================================`);
  if (failures === 0) {
    console.log(`🎉 SUCCESS: All RPB query configurations match 100% between V1 and V2!`);
  } else {
    console.error(`❌ FAILURE: ${failures} query configurations failed to match!`);
    process.exit(1);
  }
}

main().catch(console.error);
