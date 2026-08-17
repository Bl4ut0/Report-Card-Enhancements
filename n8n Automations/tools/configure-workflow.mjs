import { configureTemplate, parseArgs, readJson, resolveFromRoot, validateConfig, writeJson } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const configPath = resolveFromRoot(args.config, 'config.local.json');
const templatePath = resolveFromRoot(args.template, 'workflows/rce-unified.template.json');
const outputPath = resolveFromRoot(args.output, 'dist/rce-unified.json');

const config = validateConfig(readJson(configPath), { requireTableId: true });
const workflow = configureTemplate(readJson(templatePath), config, config.dataTableId);
writeJson(outputPath, workflow);

console.log(`Configured workflow written to ${outputPath}`);
console.log(`Nodes: ${workflow.nodes.length}`);
console.log('No credentials or secret values were written by this tool.');
