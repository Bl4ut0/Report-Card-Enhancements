# Workflow Template

`rce-unified.template.json` is a scrubbed n8n export containing placeholders. Do not activate the raw template.

Recommended use:

1. Copy `../config.example.json` to `../config.local.json`.
2. Supply your own n8n object IDs, Web App URLs, Warcraft Logs guild ID, expansion, and credential references.
3. Run `npm run configure -- --config config.local.json` from `n8n Automations/`.
4. Import `../dist/rce-unified.json` through the n8n UI.

The optional REST path is `npm run import -- --config config.local.json`. It creates or updates only the workflow and leaves it inactive unless `--activate` is explicitly passed.
