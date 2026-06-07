#!/usr/bin/env node
/**
 * Slow-Paced V1 ↔ V2 Comparison Runner to prevent Cloudflare/WCL IP Rate Limiting.
 *
 * Usage:
 *   node test_slow.js                 # Runs all tests with 8-second delay
 *   node test_slow.js 01_fights        # Runs only the fights test
 *   node test_slow.js 02_table_casts  # Runs only the casts table test
 */

import 'dotenv/config';
import { V1Client } from './lib/v1_client.js';
import { V2Client } from './lib/v2_client.js';
import { deepCompare, summarizeDiffs, formatResultMarkdown } from './lib/compare.js';

const CONFIG = {
  v1ApiKey: process.env.WCL_V1_API_KEY,
  v2ClientId: process.env.WCL_V2_CLIENT_ID,
  v2ClientSecret: process.env.WCL_V2_CLIENT_SECRET,
  reportCode: process.env.TEST_REPORT_CODE || 'TmNwkjXayJKtcR4W',
};

const SLEEP_MS = 8000; // 8 seconds delay between requests to be safe

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

const tests = [
  {
    name: '01_fights',
    fetchV1: (c) => c.fetchFights(CONFIG.reportCode),
    fetchV2: async (c) => (await c.fetchFights(CONFIG.reportCode)).mapped,
  },
  {
    name: '02_table_casts',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'casts', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'casts'),
  },
  {
    name: '03_table_damage_done',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'damage-done', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'damage-done'),
  },
  {
    name: '04_table_damage_taken',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'damage-taken', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'damage-taken'),
  },
  {
    name: '05_table_buffs',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'buffs', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'buffs'),
  },
  {
    name: '06_table_debuffs',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'debuffs', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'debuffs'),
  },
  {
    name: '07_table_deaths',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'deaths', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'deaths'),
  },
  {
    name: '08_table_healing',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'healing', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'healing'),
  },
  {
    name: '09_table_interrupts',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'interrupts', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'interrupts'),
  },
  {
    name: '10_table_resources_gains',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'resources-gains', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'resources-gains'),
  },
  {
    name: '11_table_summary',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'summary', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'summary'),
  }
];

async function main() {
  const filter = process.argv[2];
  const activeTests = filter 
    ? tests.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    : tests;

  if (activeTests.length === 0) {
    console.error(`❌ No tests found matching: ${filter}`);
    process.exit(1);
  }

  log(`Starting slow comparison test (running ${activeTests.length} tests)...`);
  log(`Using Report Code: ${CONFIG.reportCode}`);
  log(`Spacing delay: ${SLEEP_MS}ms`);

  const v1Client = new V1Client(CONFIG.v1ApiKey);
  const v2Client = new V2Client(CONFIG.v2ClientId, CONFIG.v2ClientSecret);

  // Test V2 Auth first
  try {
    await v2Client.getAccessToken();
    log(`✅ V2 OAuth authenticated successfully.`);
  } catch (err) {
    console.error(`❌ V2 OAuth Failed: ${err.message}`);
    process.exit(1);
  }

  for (let i = 0; i < activeTests.length; i++) {
    const t = activeTests[i];
    console.log(`\n${'─'.repeat(40)}`);
    log(`[${i + 1}/${activeTests.length}] Running comparison for: ${t.name}`);
    console.log(`${'─'.repeat(40)}`);

    let v1Data = null;
    let v2Data = null;

    // Fetch V1
    try {
      log(`Fetching V1 data...`);
      v1Data = await t.fetchV1(v1Client);
      log(`✅ V1 fetch success`);
    } catch (err) {
      log(`❌ V1 fetch failed: ${err.message}`);
    }

    // Wait to pace
    log(`Pacing for ${SLEEP_MS}ms...`);
    await sleep(SLEEP_MS);

    // Fetch V2
    try {
      log(`Fetching V2 data...`);
      v2Data = await t.fetchV2(v2Client);
      log(`✅ V2 fetch success`);
    } catch (err) {
      log(`❌ V2 fetch failed: ${err.message}`);
    }

    if (v1Data && v2Data) {
      const diffs = deepCompare(v1Data, v2Data, '$', [], t.compareOpts || {});
      const summary = summarizeDiffs(`${t.name}: V1 ↔ V2`, diffs);
      if (summary.passed) {
        log(`🎉 PASS: V1 and V2 mapping match perfectly!`);
      } else {
        log(`❌ FAIL: Found ${summary.totalDiffs} mismatches.`);
        console.log(formatResultMarkdown(summary));
      }
    }

    if (i < activeTests.length - 1) {
      log(`Pacing for ${SLEEP_MS}ms before next test...`);
      await sleep(SLEEP_MS);
    }
  }

  log(`\nSlow comparison test run completed.`);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
