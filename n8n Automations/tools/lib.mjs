import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const automationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    if (key === 'activate' || key === 'dry-run') {
      args[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function resolveFromRoot(value, fallback) {
  return path.resolve(automationRoot, value || fallback);
}

function replaceString(value, replacements) {
  if (Object.prototype.hasOwnProperty.call(replacements, value)) return replacements[value];
  let result = value;
  for (const [token, replacement] of Object.entries(replacements)) {
    result = result.split(token).join(String(replacement));
  }
  return result;
}

export function deepReplace(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => deepReplace(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepReplace(item, replacements)]));
  }
  if (typeof value === 'string') return replaceString(value, replacements);
  return value;
}

export function findPlaceholders(value) {
  const matches = new Set();
  const serialized = JSON.stringify(value);
  for (const match of serialized.matchAll(/__RCE_[A-Z0-9_]+__/g)) matches.add(match[0]);
  return [...matches].sort();
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.includes('REPLACE_WITH_')) {
    throw new Error(`${label} must be configured.`);
  }
  return value.trim();
}

function validateUrl(value, label, options = {}) {
  const raw = requiredString(value, label);
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' && !options.allowHttp) throw new Error(`${label} must use HTTPS.`);
  return raw.replace(/\/+$/, '');
}

export function validateConfig(config, options = {}) {
  const allowHttp = config.allowInsecureHttp === true;
  const validated = {
    ...config,
    n8nBaseUrl: validateUrl(config.n8nBaseUrl, 'n8nBaseUrl', { allowHttp }),
    publicWebhookBaseUrl: validateUrl(config.publicWebhookBaseUrl, 'publicWebhookBaseUrl', { allowHttp }),
    claWebAppUrl: validateUrl(config.claWebAppUrl, 'claWebAppUrl'),
    rpbWebAppUrl: validateUrl(config.rpbWebAppUrl, 'rpbWebAppUrl'),
    workflowName: requiredString(config.workflowName, 'workflowName'),
    dataTableName: requiredString(config.dataTableName || 'rce_reports', 'dataTableName'),
    expansion: requiredString(config.expansion, 'expansion'),
  };

  if (!/^\d+$/.test(String(config.warcraftLogsGuildId || ''))) {
    throw new Error('warcraftLogsGuildId must contain only digits.');
  }
  validated.warcraftLogsGuildId = String(config.warcraftLogsGuildId);

  for (const key of ['appsScript', 'warcraftLogs', 'intakeHeader']) {
    const credential = config.credentials?.[key];
    if (!credential) throw new Error(`credentials.${key} is required.`);
    requiredString(credential.id, `credentials.${key}.id`);
    requiredString(credential.name, `credentials.${key}.name`);
  }

  if (options.requireTableId) requiredString(config.dataTableId, 'dataTableId');
  return validated;
}

export function configureTemplate(template, config, dataTableId) {
  const replacements = {
    __RCE_WORKFLOW_NAME__: config.workflowName,
    __RCE_DATA_TABLE_ID__: dataTableId,
    __RCE_PUBLIC_WEBHOOK_BASE_URL__: config.publicWebhookBaseUrl,
    __RCE_CLA_WEB_APP_URL__: config.claWebAppUrl,
    __RCE_RPB_WEB_APP_URL__: config.rpbWebAppUrl,
    __RCE_WCL_GUILD_ID__: config.warcraftLogsGuildId,
    __RCE_EXPANSION__: config.expansion,
    __RCE_APPS_SCRIPT_CREDENTIAL_ID__: config.credentials.appsScript.id,
    __RCE_APPS_SCRIPT_CREDENTIAL_NAME__: config.credentials.appsScript.name,
    __RCE_WCL_CREDENTIAL_ID__: config.credentials.warcraftLogs.id,
    __RCE_WCL_CREDENTIAL_NAME__: config.credentials.warcraftLogs.name,
    __RCE_INTAKE_CREDENTIAL_ID__: config.credentials.intakeHeader.id,
    __RCE_INTAKE_CREDENTIAL_NAME__: config.credentials.intakeHeader.name,
  };
  const configured = deepReplace(template, replacements);
  const unresolved = findPlaceholders(configured);
  if (unresolved.length) throw new Error(`Unresolved workflow placeholders: ${unresolved.join(', ')}`);
  return configured;
}

export async function n8nRequest(config, endpoint, options = {}) {
  const apiKey = process.env.N8N_API_KEY;
  if (!apiKey) throw new Error('Set N8N_API_KEY in the environment before using the REST import script.');
  const response = await fetch(`${config.n8nBaseUrl}/api/v1${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || `${response.status} ${response.statusText}`;
    throw new Error(`n8n API ${options.method || 'GET'} ${endpoint} failed: ${message}`);
  }
  return payload;
}

export function workflowCreateBody(workflow, config, options = {}) {
  const body = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings || { executionOrder: 'v1' },
  };
  if (workflow.staticData) body.staticData = workflow.staticData;
  if (options.includeProjectId !== false && config.projectId) body.projectId = config.projectId;
  return body;
}
