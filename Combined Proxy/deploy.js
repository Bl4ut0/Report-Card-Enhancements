#!/usr/bin/env node
/**
 * Combined Proxy — One-Click Deploy Script
 *
 * Usage:
 *   npx wrangler deploy          <-- deploys the worker code only
 *   node deploy.js               <-- deploys the worker AND auto-generates + sets secrets
 *   node deploy.js --dry-run     <-- prints what WOULD happen without actually deploying
 *
 * What this script does:
 *   1. Generates two cryptographically random 64-character hex secrets:
 *      - WCL_PROXY_SECRET
 *      - DISCORD_PROXY_SECRET
 *   2. Deploys the worker via `npx wrangler deploy`
 *   3. Sets both secrets on the deployed worker via `npx wrangler secret:bulk`
 *   4. Prints the generated secrets so you can paste them into your Google Sheets
 *      Script Properties (wrapper.gs)
 *
 * Flags:
 *   --dry-run       Show generated secrets and commands without executing anything
 *   --wcl-secret    Override WCL_PROXY_SECRET instead of generating one
 *   --discord-secret Override DISCORD_PROXY_SECRET instead of generating one
 *   --skip-deploy   Only set secrets, skip `wrangler deploy`
 */

const { execSync } = require('child_process');
const crypto = require('crypto');

// ── Parse CLI flags ──────────────────────────────────────────────────
const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || true;
}

const isDryRun = args.includes('--dry-run');
const skipDeploy = args.includes('--skip-deploy');
const customWclSecret = getFlag('--wcl-secret');
const customDiscordSecret = getFlag('--discord-secret');

// ── Generate secrets ─────────────────────────────────────────────────
function generateSecret(length = 32) {
  // 32 random bytes = 64 hex characters
  return crypto.randomBytes(length).toString('hex');
}

const wclSecret = (typeof customWclSecret === 'string' && customWclSecret) || generateSecret();
const discordSecret = (typeof customDiscordSecret === 'string' && customDiscordSecret) || generateSecret();

// ── Helpers ──────────────────────────────────────────────────────────
function run(cmd, description) {
  console.log(`\n▶ ${description}`);
  console.log(`  $ ${cmd}\n`);
  if (isDryRun) {
    console.log('  (dry-run — skipped)');
    return;
  }
  try {
    execSync(cmd, { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error(`\n✖ Command failed: ${cmd}`);
    console.error(err.message);
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        Combined API Proxy — Deploy & Secret Setup          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

if (isDryRun) {
  console.log('\n⚠  DRY RUN MODE — no changes will be made\n');
}

// Step 1: Deploy worker code
if (!skipDeploy) {
  run('npx wrangler deploy', 'Deploying worker to Cloudflare...');
}

// Step 2: Set secrets via wrangler secret:bulk (reads JSON from stdin)
const secretsJson = JSON.stringify({
  WCL_PROXY_SECRET: wclSecret,
  DISCORD_PROXY_SECRET: discordSecret,
});

// Use echo piped into wrangler secret:bulk
const isWindows = process.platform === 'win32';
const echoCmd = isWindows
  ? `echo ${secretsJson} | npx wrangler secret:bulk`
  : `echo '${secretsJson}' | npx wrangler secret:bulk`;

run(echoCmd, 'Setting worker secrets (WCL_PROXY_SECRET, DISCORD_PROXY_SECRET)...');

// Step 3: Print results
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║                    ✅  DEPLOY COMPLETE                      ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║                                                            ║');
console.log('║  Copy these values into your Google Sheet Script           ║');
console.log('║  Properties (Extensions > Apps Script > Project Settings   ║');
console.log('║  > Script Properties):                                     ║');
console.log('║                                                            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('┌──────────────────────────────────────────────────────────────┐');
console.log('│  Property Name         │  Value                             │');
console.log('├──────────────────────────────────────────────────────────────┤');
console.log(`│  WCL_PROXY_SECRET      │  ${wclSecret}`);
console.log(`│  DISCORD_PROXY_SECRET  │  ${discordSecret}`);
console.log('└──────────────────────────────────────────────────────────────┘');
console.log('');
console.log('┌──────────────────────────────────────────────────────────────┐');
console.log('│  WCL_PROXY_URL         │  (your /wcl URL from above)        │');
console.log('│                        │  e.g. https://combined-api-proxy.  │');
console.log('│                        │       YOUR_SUBDOMAIN.workers.dev   │');
console.log('└──────────────────────────────────────────────────────────────┘');
console.log('');
console.log('These secrets are set on the Cloudflare Worker AND printed');
console.log('here for you to paste into your Google Sheet. They must match.');
console.log('');
if (isDryRun) {
  console.log('⚠  This was a dry run. Run without --dry-run to actually deploy.');
}
