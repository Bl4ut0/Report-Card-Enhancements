import path from 'node:path';
import {
  configureTemplate,
  n8nRequest,
  parseArgs,
  readJson,
  resolveFromRoot,
  validateConfig,
  workflowCreateBody,
  writeJson,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const configPath = resolveFromRoot(args.config, 'config.local.json');
const templatePath = resolveFromRoot(args.template, 'workflows/rce-unified.template.json');
const outputPath = resolveFromRoot(args.output, 'dist/rce-unified.json');

const config = validateConfig(readJson(configPath), { requireTableId: true });
const workflow = configureTemplate(readJson(templatePath), config, config.dataTableId);
writeJson(outputPath, workflow);

if (args['dry-run']) {
  console.log(`Dry run complete. Configured workflow written to ${outputPath}`);
  process.exit(0);
}

const updating = Boolean(config.workflowId);
const body = workflowCreateBody(workflow, config, { includeProjectId: !updating });
const imported = updating
  ? await n8nRequest(config, `/workflows/${encodeURIComponent(config.workflowId)}`, { method: 'PUT', body })
  : await n8nRequest(config, '/workflows', { method: 'POST', body });

if (args.activate) {
  await n8nRequest(config, `/workflows/${encodeURIComponent(imported.id)}/activate`, { method: 'POST' });
}

console.log(`${updating ? 'Updated' : 'Created'} workflow ${imported.name}`);
console.log(`Workflow ID: ${imported.id}`);
console.log(`Activation: ${args.activate ? 'requested' : 'inactive; inspect and test before activation'}`);
console.log(`Configured export: ${path.relative(process.cwd(), outputPath)}`);
