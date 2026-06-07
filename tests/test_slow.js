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
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { V1Client } from './lib/v1_client.js';
import { V2Client } from './lib/v2_client.js';
import { deepCompare, summarizeDiffs, formatResultMarkdown } from './lib/compare.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    compareOpts: {
      ignorePaths: new Set([
        '$.fights[*].partial',
        '$.fights[*].inProgress',
        '$.fights[*].classicSeasonID',
        '$.fights[*].lastPhaseAsAbsoluteIndex',
        '$.fights[*].lastPhaseForPercentageDisplay',
        '$.fights[*].lastCastGameId',
        '$.fights[*].lastCastTime',
        '$.fights[*].lastCastNumber',
        '$.fights[*].lastCastInProgress',
        '$.fights[*].maps',
        '$.fights[*].zoneDifficulty',
        '$.fights[*].phases',
        '$.fights[*].originalBoss',
        '$.friendlies',
        '$.enemies',
        '$.friendlyPets',
        '$.enemyPets',
        '$.logVersion',
        '$.gameVersion',
        '$.phases',
        '$.owner',
        '$.exportedCharacters',
      ])
    }
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
    compareOpts: {
      ignorePaths: new Set([
        '$.auras[*].stackUptime'
      ])
    }
  },
  {
    name: '06_table_debuffs',
    fetchV1: (c) => c.fetchTable(CONFIG.reportCode, 'debuffs', { start: 0, end: 999999999999 }),
    fetchV2: (c) => c.fetchTable(CONFIG.reportCode, 'debuffs'),
    compareOpts: {
      ignorePaths: new Set([
        '$.auras[*].stackUptime'
      ])
    }
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

function generateReport(results, elapsed, isComplete = false) {
  let md = `# WCL V1 ↔ V2 Slow-Paced Comparison Test Report\n\n`;
  md += `**Report Code**: \`${CONFIG.reportCode}\`\n`;
  md += `**Run Time**: ${new Date().toISOString()}\n`;
  if (isComplete) {
    md += `**Status**: ✅ Completed\n`;
    md += `**Duration**: ${elapsed}s\n\n`;
  } else {
    md += `**Status**: ⏳ Running...\n`;
    md += `**Elapsed Time**: ${elapsed}s\n\n`;
  }

  md += `## Summary\n\n`;
  md += `| Test | Status | Details |\n`;
  md += `|------|--------|---------|\n`;

  let totalPass = 0;
  let totalFail = 0;
  let totalSkipped = 0;
  let totalPending = 0;

  for (const r of results) {
    let statusStr = '';
    let detailStr = '';
    if (r.status === 'pending') {
      statusStr = '⏳ PENDING';
      detailStr = 'Waiting to run...';
      totalPending++;
    } else if (r.status === 'running') {
      statusStr = '⚡ RUNNING';
      detailStr = 'Currently checking...';
      totalPending++;
    } else if (r.skipped) {
      statusStr = '⏭️ SKIPPED';
      detailStr = r.error || 'Fetch failed';
      totalSkipped++;
    } else if (r.passed) {
      statusStr = '✅ PASS';
      detailStr = 'No differences found';
      totalPass++;
    } else {
      statusStr = `❌ FAIL (${r.summary?.totalDiffs || 0} diffs)`;
      detailStr = `Found mismatches`;
      totalFail++;
    }
    md += `| ${r.name} | ${statusStr} | ${detailStr} |\n`;
  }

  md += `\n**Total**: ${totalPass} passed, ${totalFail} failed, ${totalSkipped} skipped`;
  if (totalPending > 0) {
    md += `, ${totalPending} pending/running`;
  }
  md += `\n\n`;

  // Detailed diffs
  md += `---\n\n## Detailed Comparison Results\n\n`;
  let hasDetails = false;
  for (const r of results) {
    if (r.status !== 'pending' && r.status !== 'running' && r.summary && !r.passed) {
      md += formatResultMarkdown(r.summary);
      hasDetails = true;
    }
  }
  if (!hasDetails) {
    md += `*No detailed differences to show yet.*\n`;
  }

  return md;
}

async function main() {
  const startTime = Date.now();
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

  // Initialize all results to pending status
  const results = activeTests.map(t => ({
    name: t.name,
    status: 'pending',
    passed: false,
    skipped: false,
    summary: null,
    error: null
  }));

  const resultsDir = join(__dirname, 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const reportPath = join(resultsDir, 'comparison_report.md');

  // Helper function to write to report file
  const writeReportFile = (isComplete = false) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const md = generateReport(results, elapsed, isComplete);
    writeFileSync(reportPath, md);
  };

  // Write initial report file immediately
  writeReportFile(false);
  log(`📄 Initial report file written/initialized at: ${reportPath}`);

  for (let i = 0; i < activeTests.length; i++) {
    const t = activeTests[i];
    results[i].status = 'running';
    writeReportFile(false);

    console.log(`\n${'─'.repeat(40)}`);
    log(`[${i + 1}/${activeTests.length}] Running comparison for: ${t.name}`);
    console.log(`${'─'.repeat(40)}`);

    let v1Data = null;
    let v2Data = null;
    let errorMsg = null;

    // Fetch V1
    try {
      log(`Fetching V1 data...`);
      v1Data = await t.fetchV1(v1Client);
      log(`✅ V1 fetch success`);
    } catch (err) {
      log(`❌ V1 fetch failed: ${err.message}`);
      errorMsg = `V1 Error: ${err.message}`;
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
      errorMsg = errorMsg ? `${errorMsg} | V2 Error: ${err.message}` : `V2 Error: ${err.message}`;
    }

    let summary = null;
    if (v1Data && v2Data) {
      const diffs = deepCompare(v1Data, v2Data, '$', [], t.compareOpts || {});
      summary = summarizeDiffs(`${t.name}: V1 ↔ V2`, diffs);
      if (summary.passed) {
        log(`🎉 PASS: V1 and V2 mapping match perfectly!`);
      } else {
        log(`❌ FAIL: Found ${summary.totalDiffs} mismatches.`);
        console.log(formatResultMarkdown(summary));
      }
    }

    // Update results array entry
    results[i].status = 'completed';
    results[i].passed = summary ? summary.passed : false;
    results[i].skipped = !v1Data || !v2Data;
    results[i].summary = summary;
    results[i].error = errorMsg;

    // Write updated report to file after each checked test
    writeReportFile(false);
    log(`📄 Progress saved to: ${reportPath}`);

    if (i < activeTests.length - 1) {
      log(`Pacing for ${SLEEP_MS}ms before next test...`);
      await sleep(SLEEP_MS);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\nSlow comparison test run completed in ${elapsed}s.`);

  // Write final completed report
  writeReportFile(true);
  log(`📄 Final report saved to: ${reportPath}`);

  const totalFail = results.filter(r => !r.skipped && !r.passed).length;
  if (totalFail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
