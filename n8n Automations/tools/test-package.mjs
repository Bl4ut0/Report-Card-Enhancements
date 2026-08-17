import fs from 'node:fs';
import path from 'node:path';
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
