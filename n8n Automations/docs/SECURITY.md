# Security Boundaries

## Secrets

Store secrets only in service-managed secret stores:

- Warcraft Logs credentials in an n8n OAuth2 credential;
- `N8N_SECRET` in Apps Script Script Properties and an n8n HTTP Custom Auth credential;
- the manual intake key in an n8n Header Auth credential and the trusted server-side caller;
- Discord or proxy secrets in their respective service secret stores.

Never commit configured workflow exports, `config.local.json`, API keys, OAuth client secrets, Discord webhooks, Apps Script deployment details, or copied server configuration.

## Public Endpoints

Web-based automation necessarily exposes endpoints:

- the manual intake webhook is protected by Header Auth;
- CLA and RPB Web App POST actions are protected by `N8N_SECRET`;
- CLA and RPB callbacks validate report code, project, action, stage, and correlation ID;
- n8n administrative REST operations require an n8n API key.

The current callback webhooks do not have an additional header signature. Correlation and stage validation prevent blind state advancement, but production deployments should rate-limit those routes. Signed or Header Auth callbacks are planned hardening.

## Portal Boundary

Discord OAuth and role verification belong in a trusted server-side portal, not in n8n and not in browser-only JavaScript. The portal should call the n8n intake webhook from its backend after authorization.

The repository includes a deployment-neutral portal template, but no private portal, domain, hosting, FTP, OAuth, guild, or role configuration. The n8n automation itself depends only on the authenticated intake contract.

## Before Publishing a Workflow Export

Run:

```powershell
npm run validate:public
```

Maintainers can also supply comma-separated installation terms that must not appear:

```powershell
$env:PUBLIC_SCRUB_TERMS = 'private-domain.example,private-workflow-id'
npm run validate:public
```

The validator checks for live Apps Script deployment URLs, non-example RCE webhook domains, Discord snowflakes, private portal artifacts, and FTP deployment material.

## Operational Hardening Backlog

- authenticate or sign callback payloads;
- validate manual report IDs against Warcraft Logs before queue insertion;
- add persistent per-user/IP rate limits at the public portal or edge;
- add an atomic dispatcher lock where overlapping scheduler executions are possible;
- minimize unauthenticated Apps Script health output;
- use HTTPS/HSTS and encrypted administrative/deployment transport.
