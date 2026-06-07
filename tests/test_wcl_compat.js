#!/usr/bin/env node
/**
 * WCL V1 vs V2 Full-Circle Comparison Test Framework
 *
 * Tests three paths:
 *   Path 1: V1 REST Direct     → classic.warcraftlogs.com/v1/
 *   Path 2: V2 GraphQL Direct  → www.warcraftlogs.com/api/v2/client
 *   Path 3: V2 via Proxy       → Cloudflare Worker → WCL V2
 *
 * Usage: node test_wcl_compat.js
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { V1Client } from './lib/v1_client.js';
import { V2Client } from './lib/v2_client.js';
import { ProxyClient } from './lib/proxy_client.js';
import { deepCompare, summarizeDiffs, formatResultMarkdown } from './lib/compare.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ────────────────────────────────────────────────────────

const CONFIG = {
  v1ApiKey: process.env.WCL_V1_API_KEY,
  v2ClientId: process.env.WCL_V2_CLIENT_ID,
  v2ClientSecret: process.env.WCL_V2_CLIENT_SECRET,
  proxyUrl: process.env.WCL_PROXY_URL,
  proxySecret: process.env.WCL_PROXY_SECRET,
  reportCode: process.env.TEST_REPORT_CODE || 'TmNwkjXayJKtcR4W',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logSection(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Save raw response data to disk for manual inspection.
 */
function saveRawResponse(testName, path, data) {
  const rawDir = join(__dirname, 'results', 'raw');
  if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true });

  const filename = `${testName}_${path}.json`;
  writeFileSync(join(rawDir, filename), JSON.stringify(data, null, 2));
}

/**
 * Run a single comparison test across all three paths.
 */
async function runTest(testDef, clients) {
  const { name, fetchV1, fetchV2, fetchProxy, compareOpts } = testDef;
  log(`🔄 Running: ${name}`);

  const results = { name, v1: null, v2: null, proxy: null, comparisons: [] };

  // Fetch from all three paths
  try {
    log(`  → V1 REST direct...`);
    results.v1 = await fetchV1(clients.v1);
    saveRawResponse(name, 'v1', results.v1);
    log(`  ✅ V1 OK`);
  } catch (err) {
    log(`  ⚠️ V1 FAILED: ${err.message}`);
    results.v1Error = err.message;
  }

  try {
    log(`  → V2 GraphQL direct...`);
    await sleep(3000);
    results.v2 = await fetchV2(clients.v2);
    saveRawResponse(name, 'v2', results.v2);
    log(`  ✅ V2 OK`);
  } catch (err) {
    log(`  ⚠️ V2 FAILED: ${err.message}`);
    results.v2Error = err.message;
  }

  try {
    log(`  → V2 via Proxy...`);
    await sleep(3000);
    results.proxy = await fetchProxy(clients.proxy);
    saveRawResponse(name, 'proxy', results.proxy);
    const headers = clients.proxy.getLastProxyHeaders();
    log(`  ✅ Proxy OK (cache: ${headers?.cache || 'n/a'}, attempts: ${headers?.attempts || 'n/a'})`);
  } catch (err) {
    log(`  ⚠️ Proxy FAILED: ${err.message}`);
    results.proxyError = err.message;
  }

  // Compare: V1 ↔ V2
  if (results.v1 && results.v2) {
    const diffs = deepCompare(results.v1, results.v2, '$', [], compareOpts || {});
    const summary = summarizeDiffs(`${name}: V1 ↔ V2 Direct`, diffs);
    results.comparisons.push(summary);
    log(`  📊 V1↔V2: ${summary.passed ? '✅ PASS' : `❌ FAIL (${summary.totalDiffs} diffs)`}`);
  }

  // Compare: V1 ↔ Proxy
  if (results.v1 && results.proxy) {
    const diffs = deepCompare(results.v1, results.proxy, '$', [], compareOpts || {});
    const summary = summarizeDiffs(`${name}: V1 ↔ V2 via Proxy`, diffs);
    results.comparisons.push(summary);
    log(`  📊 V1↔Proxy: ${summary.passed ? '✅ PASS' : `❌ FAIL (${summary.totalDiffs} diffs)`}`);
  }

  // Compare: V2 ↔ Proxy (should be identical)
  if (results.v2 && results.proxy) {
    const diffs = deepCompare(results.v2, results.proxy, '$', [], compareOpts || {});
    const summary = summarizeDiffs(`${name}: V2 Direct ↔ V2 via Proxy`, diffs);
    results.comparisons.push(summary);
    log(`  📊 V2↔Proxy: ${summary.passed ? '✅ PASS' : `❌ FAIL (${summary.totalDiffs} diffs)`}`);
  }

  return results;
}

// ─── Test Definitions ─────────────────────────────────────────────────────

function defineTests(reportCode) {
  return [
    // ── 1. Fights ───────────────────────────────────────────────────────
    {
      name: '01_fights',
      fetchV1: (c) => c.fetchFights(reportCode),
      fetchV2: async (c) => (await c.fetchFights(reportCode)).mapped,
      fetchProxy: async (c) => (await c.fetchFights(reportCode)).mapped,
    },

    // ── 2-11. Tables ────────────────────────────────────────────────────
    {
      name: '02_table_casts',
      fetchV1: (c) => c.fetchTable(reportCode, 'casts', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'casts'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'casts'),
    },
    {
      name: '03_table_damage_done',
      fetchV1: (c) => c.fetchTable(reportCode, 'damage-done', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'damage-done'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'damage-done'),
    },
    {
      name: '04_table_damage_taken',
      fetchV1: (c) => c.fetchTable(reportCode, 'damage-taken', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'damage-taken'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'damage-taken'),
    },
    {
      name: '05_table_buffs',
      fetchV1: (c) => c.fetchTable(reportCode, 'buffs', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'buffs'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'buffs'),
    },
    {
      name: '06_table_debuffs',
      fetchV1: (c) => c.fetchTable(reportCode, 'debuffs', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'debuffs'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'debuffs'),
    },
    {
      name: '07_table_deaths',
      fetchV1: (c) => c.fetchTable(reportCode, 'deaths', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'deaths'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'deaths'),
    },
    {
      name: '08_table_healing',
      fetchV1: (c) => c.fetchTable(reportCode, 'healing', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'healing'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'healing'),
    },
    {
      name: '09_table_interrupts',
      fetchV1: (c) => c.fetchTable(reportCode, 'interrupts', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'interrupts'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'interrupts'),
    },
    {
      name: '10_table_resources_gains',
      fetchV1: (c) => c.fetchTable(reportCode, 'resources-gains', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'resources-gains'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'resources-gains'),
    },
    {
      name: '11_table_summary',
      fetchV1: (c) => c.fetchTable(reportCode, 'summary', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'summary'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'summary'),
    },

    // ── 12-15. Events ───────────────────────────────────────────────────
    {
      name: '12_events_summary',
      fetchV1: (c) => c.fetchEvents(reportCode, 'summary', { start: 0, end: 999999999999, hostility: 1 }),
      fetchV2: (c) => c.fetchEvents(reportCode, 'summary', { hostility: 1 }),
      fetchProxy: (c) => c.fetchEvents(reportCode, 'summary', { hostility: 1 }),
    },
    {
      name: '13_events_deaths',
      fetchV1: (c) => c.fetchEvents(reportCode, 'deaths', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchEvents(reportCode, 'deaths'),
      fetchProxy: (c) => c.fetchEvents(reportCode, 'deaths'),
    },
    {
      name: '14_events_buffs',
      fetchV1: (c) => c.fetchEvents(reportCode, 'buffs', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchEvents(reportCode, 'buffs'),
      fetchProxy: (c) => c.fetchEvents(reportCode, 'buffs'),
    },
    {
      name: '15_events_casts',
      fetchV1: (c) => c.fetchEvents(reportCode, 'casts', { start: 0, end: 999999999999 }),
      fetchV2: (c) => c.fetchEvents(reportCode, 'casts'),
      fetchProxy: (c) => c.fetchEvents(reportCode, 'casts'),
    },

    // ── 16-20. Parameter-Specific (audit gap tests) ─────────────────────
    {
      name: '16_table_casts_by_ability',
      fetchV1: (c) => c.fetchTable(reportCode, 'casts', { start: 0, end: 999999999999, by: 'ability' }),
      fetchV2: (c) => c.fetchTable(reportCode, 'casts'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'casts'),
      compareOpts: { maxDiffs: 50 },
    },
    {
      name: '17_table_damage_done_by_source',
      fetchV1: (c) => c.fetchTable(reportCode, 'damage-done', { start: 0, end: 999999999999, by: 'source' }),
      fetchV2: (c) => c.fetchTable(reportCode, 'damage-done'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'damage-done'),
      compareOpts: { maxDiffs: 50 },
    },
    {
      name: '18_table_damage_taken_options_4098',
      fetchV1: (c) => c.fetchTable(reportCode, 'damage-taken', { start: 0, end: 999999999999, options: 4098 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'damage-taken', { options: 4098 }),
      fetchProxy: (c) => c.fetchTable(reportCode, 'damage-taken', { options: 4098 }),
      compareOpts: { maxDiffs: 50 },
    },
    {
      name: '19_table_buffs_by_target',
      fetchV1: (c) => c.fetchTable(reportCode, 'buffs', { start: 0, end: 999999999999, by: 'target' }),
      fetchV2: (c) => c.fetchTable(reportCode, 'buffs'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'buffs'),
      compareOpts: { maxDiffs: 50 },
    },
    {
      name: '20_table_damage_taken_wipes',
      fetchV1: (c) => c.fetchTable(reportCode, 'damage-taken', { start: 0, end: 999999999999, wipes: 2 }),
      fetchV2: (c) => c.fetchTable(reportCode, 'damage-taken'),
      fetchProxy: (c) => c.fetchTable(reportCode, 'damage-taken'),
      compareOpts: { maxDiffs: 50 },
    },
  ];
}

// ─── Proxy-Specific Tests ─────────────────────────────────────────────────

async function runProxyTests(proxyClient) {
  logSection('PROXY-SPECIFIC TESTS');
  const results = [];

  // P1: Valid auth
  log('🔄 P1: Proxy auth (valid secret)...');
  try {
    const token = await proxyClient.getAccessToken();
    const passed = !!token;
    results.push({ name: 'P1: Proxy Auth (Valid)', passed, detail: passed ? 'Token obtained' : 'No token' });
    log(`  ${passed ? '✅' : '❌'} ${passed ? 'PASS' : 'FAIL'}`);
  } catch (err) {
    results.push({ name: 'P1: Proxy Auth (Valid)', passed: false, detail: err.message });
    log(`  ❌ FAIL: ${err.message}`);
  }

  // P2: Invalid auth
  log('🔄 P2: Proxy auth (invalid secret)...');
  const authResult = await proxyClient.testInvalidAuth();
  results.push({ name: 'P2: Proxy Auth (Invalid)', ...authResult });
  log(`  ${authResult.passed ? '✅' : '❌'} ${authResult.passed ? 'PASS' : 'FAIL'}: ${authResult.reason}`);

  // P3: Cache headers
  log('🔄 P3: Proxy cache headers...');
  try {
    const code = CONFIG.reportCode;
    await proxyClient.fetchTable(code, 'casts', { start: 0, end: 999999999999 });
    const headers1 = proxyClient.getLastProxyHeaders();

    // Second identical call should hit cache
    await proxyClient.fetchTable(code, 'casts', { start: 0, end: 999999999999 });
    const headers2 = proxyClient.getLastProxyHeaders();

    const hasCacheHeader = !!headers1?.cache;
    results.push({
      name: 'P3: Proxy Cache Headers',
      passed: hasCacheHeader,
      detail: `First: ${headers1?.cache || 'none'}, Second: ${headers2?.cache || 'none'}`,
    });
    log(`  ${hasCacheHeader ? '✅' : '⚠️'} Cache: first=${headers1?.cache}, second=${headers2?.cache}`);
  } catch (err) {
    results.push({ name: 'P3: Proxy Cache Headers', passed: false, detail: err.message });
    log(`  ❌ FAIL: ${err.message}`);
  }

  // P4: Proxy attempt headers
  log('🔄 P4: Proxy retry headers...');
  const headers = proxyClient.getLastProxyHeaders();
  const hasAttempts = !!headers?.attempts;
  results.push({
    name: 'P4: Proxy Retry Headers',
    passed: hasAttempts,
    detail: `x-wcl-proxy-attempts: ${headers?.attempts || 'missing'}`,
  });
  log(`  ${hasAttempts ? '✅' : '❌'} Attempts header: ${headers?.attempts || 'missing'}`);

  return results;
}

// ─── Report Generation ───────────────────────────────────────────────────

function generateReport(allResults, proxyResults, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  let md = `# WCL V1 ↔ V2 Comparison Test Report\n\n`;
  md += `**Report Code**: \`${CONFIG.reportCode}\`\n`;
  md += `**Run Time**: ${new Date().toISOString()}\n`;
  md += `**Duration**: ${elapsed}s\n\n`;

  // Summary table
  md += `## Summary\n\n`;
  md += `| Test | V1↔V2 | V1↔Proxy | V2↔Proxy |\n`;
  md += `|------|-------|----------|----------|\n`;

  let totalPass = 0;
  let totalFail = 0;

  for (const result of allResults) {
    const cols = [result.name];
    for (const comp of result.comparisons) {
      if (comp.passed) {
        cols.push('✅ PASS');
        totalPass++;
      } else {
        cols.push(`❌ ${comp.totalDiffs} diffs`);
        totalFail++;
      }
    }
    // Pad missing columns
    while (cols.length < 4) cols.push('⏭️ Skipped');
    md += `| ${cols.join(' | ')} |\n`;
  }

  md += `\n**Total**: ${totalPass} passed, ${totalFail} failed\n\n`;

  // Proxy tests
  md += `## Proxy Tests\n\n`;
  md += `| Test | Status | Detail |\n`;
  md += `|------|--------|--------|\n`;
  for (const r of proxyResults) {
    md += `| ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.detail || r.reason || ''} |\n`;
  }
  md += '\n';

  // Errors
  const errors = allResults.filter(r => r.v1Error || r.v2Error || r.proxyError);
  if (errors.length > 0) {
    md += `## Errors\n\n`;
    for (const r of errors) {
      if (r.v1Error) md += `- **${r.name}** V1: ${r.v1Error}\n`;
      if (r.v2Error) md += `- **${r.name}** V2: ${r.v2Error}\n`;
      if (r.proxyError) md += `- **${r.name}** Proxy: ${r.proxyError}\n`;
    }
    md += '\n';
  }

  // Detailed diffs
  md += `---\n\n## Detailed Comparison Results\n\n`;
  for (const result of allResults) {
    for (const comp of result.comparisons) {
      md += formatResultMarkdown(comp);
    }
  }

  return md;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  logSection('WCL V1 ↔ V2 COMPARISON TEST FRAMEWORK');
  log(`Report Code: ${CONFIG.reportCode}`);

  // Validate config
  const missing = [];
  if (!CONFIG.v1ApiKey) missing.push('WCL_V1_API_KEY');
  if (!CONFIG.v2ClientId) missing.push('WCL_V2_CLIENT_ID');
  if (!CONFIG.v2ClientSecret) missing.push('WCL_V2_CLIENT_SECRET');
  if (!CONFIG.proxyUrl) missing.push('WCL_PROXY_URL');
  if (!CONFIG.proxySecret) missing.push('WCL_PROXY_SECRET');

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('   Make sure tests/.env is configured correctly.');
    process.exit(1);
  }

  // Initialize clients
  log('Initializing clients...');
  const clients = {
    v1: new V1Client(CONFIG.v1ApiKey),
    v2: new V2Client(CONFIG.v2ClientId, CONFIG.v2ClientSecret),
    proxy: new ProxyClient(CONFIG.proxyUrl, CONFIG.proxySecret, CONFIG.v2ClientId, CONFIG.v2ClientSecret),
  };

  // Test V2 auth first
  log('Testing V2 authentication...');
  try {
    const token = await clients.v2.getAccessToken();
    log(`✅ V2 auth OK (token: ${token.substring(0, 8)}...)`);
  } catch (err) {
    console.error(`❌ V2 auth failed: ${err.message}`);
    process.exit(1);
  }

  // Run proxy-specific tests
  const proxyResults = await runProxyTests(clients.proxy);

  // Define and run comparison tests
  const tests = defineTests(CONFIG.reportCode);
  const allResults = [];

  logSection('COMPARISON TESTS');

  for (let i = 0; i < tests.length; i++) {
    log(`\n[${i + 1}/${tests.length}]`);
    try {
      const result = await runTest(tests[i], clients);
      allResults.push(result);
    } catch (err) {
      log(`💥 CRASH in test ${tests[i].name}: ${err.message}`);
      allResults.push({
        name: tests[i].name,
        comparisons: [],
        crashError: err.message,
      });
    }
  }

  // Generate and save report
  logSection('GENERATING REPORT');

  const report = generateReport(allResults, proxyResults, startTime);
  const resultsDir = join(__dirname, 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  const reportPath = join(resultsDir, 'comparison_report.md');
  writeFileSync(reportPath, report);
  log(`📄 Report saved to: ${reportPath}`);

  // Final summary
  const totalComps = allResults.flatMap(r => r.comparisons);
  const passed = totalComps.filter(c => c.passed).length;
  const failed = totalComps.filter(c => !c.passed).length;
  const proxyPassed = proxyResults.filter(r => r.passed).length;
  const proxyFailed = proxyResults.filter(r => !r.passed).length;

  logSection('FINAL RESULTS');
  log(`Comparison tests: ${passed} passed, ${failed} failed`);
  log(`Proxy tests:      ${proxyPassed} passed, ${proxyFailed} failed`);

  if (failed > 0 || proxyFailed > 0) {
    log('\n⚠️ Some tests failed — review the comparison report for details.');
    process.exit(1);
  } else {
    log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`\n💥 Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
