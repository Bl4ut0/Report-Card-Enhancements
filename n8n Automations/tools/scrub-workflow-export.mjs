import { parseArgs, readJson, resolveFromRoot, writeJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error('Usage: npm run scrub:export -- --input path/to/export.json [--output workflows/rce-unified.template.json]');

const inputPath = resolveFromRoot(args.input);
const outputPath = resolveFromRoot(args.output, 'workflows/rce-unified.template.json');
const source = readJson(inputPath);

const credentialTokens = {
  httpCustomAuth: { id: '__RCE_APPS_SCRIPT_CREDENTIAL_ID__', name: '__RCE_APPS_SCRIPT_CREDENTIAL_NAME__' },
  oAuth2Api: { id: '__RCE_WCL_CREDENTIAL_ID__', name: '__RCE_WCL_CREDENTIAL_NAME__' },
  httpHeaderAuth: { id: '__RCE_INTAKE_CREDENTIAL_ID__', name: '__RCE_INTAKE_CREDENTIAL_NAME__' },
};

function scrubString(value) {
  return value
    .replace(/https:\/\/[^/\s"']+\/webhook\/rce\/v2/gi, '__RCE_PUBLIC_WEBHOOK_BASE_URL__/webhook/rce/v2')
    .replace(/guildID\s*:\s*\d+/g, 'guildID: __RCE_WCL_GUILD_ID__')
    .replace(/guildId\s*:\s*\d+/g, 'guildId: __RCE_WCL_GUILD_ID__')
    .replace(/guildId\s*=\s*\d+/g, 'guildId = __RCE_WCL_GUILD_ID__')
    .replace(/expansion:\s*['"][^'"]+['"]/g, "expansion: '__RCE_EXPANSION__'")
    .replace(/prior\.expansion\s*\|\|\s*['"][^'"]+['"]/g, "prior.expansion || '__RCE_EXPANSION__'")
    .replace(/source:\s*['"]wolves-portal['"]/gi, "source: String(body.source || 'trusted-portal').slice(0,100)");
}

function scrubValue(value) {
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubValue(item)]));
  }
  return typeof value === 'string' ? scrubString(value) : value;
}

function scrubNode(original) {
  const node = scrubValue(structuredClone(original));
  delete node.webhookId;

  if (node.parameters?.dataTableId?.__rl) {
    node.parameters.dataTableId.value = '__RCE_DATA_TABLE_ID__';
    node.parameters.dataTableId.cachedResultName = 'rce_reports';
  }

  if (node.type === 'n8n-nodes-base.httpRequest') {
    if (/^CLA /.test(node.name) || node.name === 'Run One CLA Checkpoint') {
      node.parameters.url = '__RCE_CLA_WEB_APP_URL__';
    } else if (/^RPB /.test(node.name) || node.name === 'Run One RPB Checkpoint') {
      node.parameters.url = '__RCE_RPB_WEB_APP_URL__';
    }
  }

  if (node.credentials) {
    for (const type of Object.keys(node.credentials)) {
      if (!credentialTokens[type]) throw new Error(`Unknown credential type ${type} on node ${node.name}; add an explicit scrub rule.`);
      node.credentials[type] = { ...credentialTokens[type] };
    }
  }
  return node;
}

const workflow = {
  name: '__RCE_WORKFLOW_NAME__',
  nodes: (source.nodes || []).map(scrubNode),
  connections: source.connections || {},
  settings: {
    executionOrder: source.settings?.executionOrder || 'v1',
    saveExecutionProgress: source.settings?.saveExecutionProgress ?? true,
    saveDataErrorExecution: source.settings?.saveDataErrorExecution || 'all',
    saveDataSuccessExecution: source.settings?.saveDataSuccessExecution || 'all',
    availableInMCP: false,
  },
};

const serialized = JSON.stringify(workflow);
const forbidden = [
  /https:\/\/script\.google\.com\/macros\/s\/(?!REPLACE_)[A-Za-z0-9_-]+\/exec/,
  /https:\/\/[^/"']+\/webhook\/rce\/v2/,
];
for (const pattern of forbidden) {
  if (pattern.test(serialized)) throw new Error(`Scrub failed; public template still matches ${pattern}`);
}

writeJson(outputPath, workflow);
console.log(`Scrubbed ${workflow.nodes.length} nodes into ${outputPath}`);
console.log('Review the generated diff and run npm run validate:public before committing.');
