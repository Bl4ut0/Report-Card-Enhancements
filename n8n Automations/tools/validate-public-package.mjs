import fs from 'node:fs';
import path from 'node:path';
import { automationRoot, findPlaceholders, readJson } from './lib.mjs';

const excludedDirectories = new Set(['dist', 'node_modules']);
const excludedFiles = new Set(['config.local.json']);
const textExtensions = new Set(['.gs', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.toml']);

function collectFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    if (entry.isFile() && excludedFiles.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    else if (textExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const findings = [];
const patterns = [
  { label: 'live Apps Script deployment URL', regex: /https:\/\/script\.google\.com\/macros\/s\/(?!REPLACE_WITH_)[A-Za-z0-9_-]{20,}\/exec/g },
  { label: 'live RCE webhook domain', regex: /https:\/\/(?!n8n\.example\.com)[^\s"']+\/webhook\/rce\/v\d+/gi },
  { label: 'Discord snowflake', regex: /\b\d{17,20}\b/g },
  { label: 'private deployment branding', regex: /\bwolves(?:-portal)?\b/gi },
  { label: 'private portal artifact', regex: /rce-portal-private|wolves-private|\.server\.env/gi },
  { label: 'FTP deployment material', regex: /\bFTP_(?:HOST|USER|PASS|PORT|SECURE)\b|basic-ftp|uploadFrom\(/g },
];

const extraTerms = (process.env.PUBLIC_SCRUB_TERMS || '').split(',').map((value) => value.trim()).filter(Boolean);
const ruleSources = new Set([
  path.join('n8n Automations', 'tools', 'validate-public-package.mjs'),
  path.join('n8n Automations', 'tools', 'scrub-workflow-export.mjs'),
]);

const scanRoots = [
  { label: 'n8n Automations', root: automationRoot },
  { label: 'Portal Template', root: path.resolve(automationRoot, '..', 'Portal Template') },
].filter(({ root }) => fs.existsSync(root));

for (const { label: rootLabel, root } of scanRoots) {
  for (const filePath of collectFiles(root)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relative = path.join(rootLabel, path.relative(root, filePath));
    if (!ruleSources.has(relative)) {
      for (const { label, regex } of patterns) {
        for (const match of content.matchAll(regex)) findings.push(`${relative}: ${label} (${match[0]})`);
      }
    }
    for (const term of extraTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) findings.push(`${relative}: configured scrub term (${term})`);
    }
  }
}

const templatePath = path.join(automationRoot, 'workflows', 'rce-unified.template.json');
if (!fs.existsSync(templatePath)) findings.push('workflows/rce-unified.template.json: missing generated workflow template');
else {
  const placeholders = new Set(findPlaceholders(readJson(templatePath)));
  const required = [
    '__RCE_WORKFLOW_NAME__',
    '__RCE_DATA_TABLE_ID__',
    '__RCE_PUBLIC_WEBHOOK_BASE_URL__',
    '__RCE_CLA_WEB_APP_URL__',
    '__RCE_RPB_WEB_APP_URL__',
    '__RCE_WCL_GUILD_ID__',
    '__RCE_EXPANSION__',
    '__RCE_APPS_SCRIPT_CREDENTIAL_ID__',
    '__RCE_WCL_CREDENTIAL_ID__',
    '__RCE_INTAKE_CREDENTIAL_ID__',
  ];
  for (const token of required) if (!placeholders.has(token)) findings.push(`workflow template: missing placeholder ${token}`);
}

if (findings.length) {
  console.error('Public package validation failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Public package validation passed.');
console.log('No live deployment URLs, Discord snowflakes, private portal artifacts, or FTP deployment material were found in the automation or portal templates.');
