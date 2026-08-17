import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { automationRoot, configureTemplate, findPlaceholders, readJson, validateConfig } from './lib.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const template = readJson(path.join(automationRoot, 'workflows', 'rce-unified.template.json'));
const schema = readJson(path.join(automationRoot, 'schema', 'rce_reports.json'));

assert(template.name === '__RCE_WORKFLOW_NAME__', 'Workflow name must remain a placeholder.');
assert(template.nodes.length === 33, `Expected 33 workflow nodes, found ${template.nodes.length}.`);
assert(!('id' in template), 'Public workflow template must not contain a live workflow ID.');
assert(template.settings?.availableInMCP === false, 'Public workflow should not expose MCP access by default.');

const nodeNames = new Set(template.nodes.map((node) => node.name));
assert(nodeNames.size === template.nodes.length, 'Workflow node names must be unique.');
for (const [source, connectionTypes] of Object.entries(template.connections)) {
  assert(nodeNames.has(source), `Connection source does not exist: ${source}`);
  for (const outputs of Object.values(connectionTypes)) {
    for (const branch of outputs) {
      for (const connection of branch) assert(nodeNames.has(connection.node), `Connection target does not exist: ${connection.node}`);
    }
  }
}

const expectedTriggers = [
  'Queue and Recovery Watchdog',
  'CLA Action Callback',
  'RPB Action Callback',
  'Monitor Warcraft Logs Every Five Minutes',
  'Portal Report Intake',
];
for (const name of expectedTriggers) assert(nodeNames.has(name), `Missing trigger node: ${name}`);

const classifierNode = template.nodes.find((node) => node.name === 'Classify Live, Complete, and Eligible Reports');
assert(classifierNode?.parameters?.jsCode, 'Missing Warcraft Logs classifier code.');
const reportsNode = template.nodes.find((node) => node.name === 'Fetch Guild Reports from Warcraft Logs');
assert(reportsNode?.parameters?.jsonBody?.includes('encounterID kill inProgress'), 'Warcraft Logs query must request boss-kill and in-progress signals.');

function classifyReports({ nowMs, reports, ledgerRows = [] }) {
  class FixedDate extends Date {
    constructor(value) {
      super(value === undefined ? nowMs : value);
    }

    static now() {
      return nowMs;
    }
  }

  return vm.runInNewContext(`(() => {${classifierNode.parameters.jsCode}})()`, {
    Date: FixedDate,
    $: (name) => {
      assert(name === 'Fetch Guild Reports from Warcraft Logs', `Unexpected classifier node lookup: ${name}`);
      return {
        first: () => ({ json: { body: { data: { reportData: { reports: { data: reports } } } } } }),
      };
    },
    $input: { all: () => ledgerRows.map((json) => ({ json })) },
    $execution: { id: 'classifier-test' },
  });
}

const hour = 60 * 60 * 1000;
const minute = 60 * 1000;
const reportStart = Date.parse('2026-08-17T08:30:00.000Z');
const report = (endTime) => ({
  code: 'TESTREPORTCODE01',
  title: 'Classifier Test',
  startTime: reportStart,
  endTime,
  fights: [{ id: 1, startTime: 0, endTime: 120000, encounterID: 1, kill: false, inProgress: false }],
});
const priorLive = (endTime, lastChange) => ({
  report_code: 'TESTREPORTCODE01',
  state: 'STABILIZING',
  live_observed: true,
  first_seen_at: new Date(reportStart + 5 * minute).toISOString(),
  report_end_at: new Date(endTime).toISOString(),
  last_event_change_at: new Date(lastChange).toISOString(),
});

const shortLive = classifyReports({
  nowMs: reportStart + 0.75 * hour,
  reports: [report(reportStart + 0.5 * hour)],
  ledgerRows: [priorLive(reportStart + 0.5 * hour, reportStart + 0.5 * hour)],
});
assert(shortLive[0].json.state === 'STABILIZING', 'A short live session must not queue before one hour from report start.');

const finishedLive = classifyReports({
  nowMs: reportStart + hour,
  reports: [report(reportStart + 0.5 * hour)],
  ledgerRows: [priorLive(reportStart + 0.5 * hour, reportStart + 0.5 * hour)],
});
assert(finishedLive[0].json.state === 'QUEUED', 'A one-hour-old live session should queue after at least 15 stable minutes.');

const extendedLive = classifyReports({
  nowMs: reportStart + 1.5 * hour,
  reports: [report(reportStart + 1.5 * hour - minute)],
  ledgerRows: [priorLive(reportStart + 1.5 * hour - 6 * minute, reportStart + 1.5 * hour - 6 * minute)],
});
assert(extendedLive[0].json.state === 'LIVE', 'An actively changing report must remain live after one hour.');

const completedUpload = classifyReports({
  nowMs: reportStart + 5 * hour,
  reports: [report(reportStart + 2 * hour)],
});
assert(completedUpload[0].json.state === 'QUEUED', 'A completed upload that was never observed live should queue immediately.');

const cleanupReport = report(reportStart + 20 * minute);
cleanupReport.fights = [{ id: 1, startTime: 0, endTime: 30000, encounterID: 1, kill: true, inProgress: false }];
const completedCleanup = classifyReports({
  nowMs: reportStart + 45 * minute,
  reports: [cleanupReport],
});
assert(completedCleanup[0].json.state === 'QUEUED', 'A completed cleanup report with a boss kill should queue even under one hour and 60 combat seconds.');

const shortNoKill = report(reportStart + 20 * minute);
shortNoKill.fights = [{ id: 1, startTime: 0, endTime: 120000, encounterID: 1, kill: false, inProgress: false }];
const incompleteShortUpload = classifyReports({
  nowMs: reportStart + 45 * minute,
  reports: [shortNoKill],
});
assert(incompleteShortUpload[0].json.state === 'STABILIZING', 'A sub-hour report without a boss kill must not auto-queue.');

const recentUnchangedUpload = classifyReports({
  nowMs: reportStart + 70 * minute,
  reports: [report(reportStart + 65 * minute)],
});
assert(recentUnchangedUpload[0].json.state === 'LIVE', 'A newly discovered report with a recent end timestamp must wait for stability.');

const activeFightReport = report(reportStart + 0.5 * hour);
activeFightReport.fights[0].inProgress = true;
const activeFight = classifyReports({
  nowMs: reportStart + 2 * hour,
  reports: [activeFightReport],
  ledgerRows: [priorLive(reportStart + 0.5 * hour, reportStart + 0.5 * hour)],
});
assert(activeFight[0].json.state !== 'QUEUED', 'A report with a fight in progress must not queue.');

assert(schema.columns.length === 26, `Expected 26 ledger columns, found ${schema.columns.length}.`);
assert(new Set(schema.columns.map((column) => column.name)).size === schema.columns.length, 'Ledger column names must be unique.');

const config = validateConfig({
  n8nBaseUrl: 'https://n8n.example.com',
  projectId: '',
  workflowId: '',
  workflowName: 'RCE Test Workflow',
  dataTableId: 'example_table_id',
  dataTableName: 'rce_reports',
  publicWebhookBaseUrl: 'https://n8n.example.com',
  claWebAppUrl: 'https://example.com/cla-web-app',
  rpbWebAppUrl: 'https://example.com/rpb-web-app',
  warcraftLogsGuildId: '123456',
  expansion: 'TBC',
  credentials: {
    appsScript: { id: 'example_apps_script_credential', name: 'RCE Apps Script Body Auth' },
    warcraftLogs: { id: 'example_wcl_credential', name: 'Warcraft Logs OAuth2' },
    intakeHeader: { id: 'example_intake_credential', name: 'RCE Intake Header Auth' },
  },
}, { requireTableId: true });

const configured = configureTemplate(template, config, config.dataTableId);
assert(findPlaceholders(configured).length === 0, 'Configured workflow contains unresolved placeholders.');
assert(configured.name === 'RCE Test Workflow', 'Workflow name was not configured.');
assert(JSON.stringify(configured).includes('guildID: 123456'), 'Warcraft Logs guild ID was not configured.');
assert(JSON.stringify(configured).includes('example_table_id'), 'Data Table ID was not configured.');

for (const file of ['Shared_Config.gs', 'CLA_Patch_n8n.gs', 'RPB_Patch_n8n.gs', 'Shared_DiscordWebhook.gs']) {
  const source = fs.readFileSync(path.join(automationRoot, file), 'utf8');
  new Function(source);
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(fullPath));
    else if (entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files;
}

for (const markdownPath of markdownFiles(automationRoot)) {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
    const resolved = path.resolve(path.dirname(markdownPath), decodeURIComponent(target));
    assert(fs.existsSync(resolved), `Broken Markdown link in ${path.relative(automationRoot, markdownPath)}: ${match[1]}`);
  }
}

console.log('Automation package tests passed.');
console.log(`Validated ${template.nodes.length} nodes, ${Object.keys(template.connections).length} connection roots, and ${schema.columns.length} ledger columns.`);
