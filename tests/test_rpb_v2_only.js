import 'dotenv/config';
import { V2Client } from './lib/v2_client.js';

async function main() {
  const reportCode = '1XPTmVrMBQkAbFG2';
  
  const clientCreds = {
    id: process.env.WCL_V2_CLIENT_ID,
    secret: process.env.WCL_V2_CLIENT_SECRET
  };

  if (!clientCreds.id || !clientCreds.secret) {
    throw new Error("Missing V2 credentials in .env file!");
  }

  console.log(`Using credentials: ${clientCreds.id}`);
  const client = new V2Client(clientCreds.id, clientCreds.secret);

  console.log(`Fetching fights for report ${reportCode} via V2 GraphQL...`);
  const fightsResponse = await client.fetchFights(reportCode);
  const mapped = fightsResponse.mapped;
  console.log(`✅ Fights fetched successfully. Found ${mapped.friendlies.length} friendlies.`);

  const player = mapped.friendlies.find(f => ['Druid', 'Priest', 'Mage', 'Warlock', 'Warrior'].includes(f.type));
  if (!player) {
    throw new Error("No target player found!");
  }
  console.log(`Target player: ${player.name} (ID: ${player.id}, Type: ${player.type})`);

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

  console.log(`\nExecuting ${testQueries.length} V2 GraphQL queries direct (no proxy)...`);
  for (const q of testQueries) {
    console.log(`Running query: ${q.name}...`);
    try {
      const start = Date.now();
      const res = await client.fetchEvents(reportCode, q.dataType, q.params);
      const duration = Date.now() - start;
      console.log(`  ✅ SUCCESS: ${q.name} took ${duration}ms | Events count: ${res.events ? res.events.length : 0}`);
    } catch (err) {
      console.error(`  ❌ FAILED: ${q.name} | Error: ${err.message}`);
    }
  }

  console.log("\n============================================");
  console.log("V2 GraphQL Direct Test Completed successfully!");
}

main().catch(console.error);
