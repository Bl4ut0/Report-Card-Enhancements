const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const CURRENT_SOURCE_DIR = path.join(ROOT_DIR, 'Current Source');
const V2_WRAPPER_DIR = path.join(ROOT_DIR, 'V2 Wrapper');
const AUTOMATIONS_DIR = path.join(ROOT_DIR, 'n8n Automations');
const OUTPUT_DIR = path.join(ROOT_DIR, 'RCE Replacements');

// Helper to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper to copy file
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// Patch RPB Filtering.gs with Discord Webhook Proxy helper call
function patchRpbFiltering(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('fetchDiscordWebhook_')) {
    console.log(`  - [SKIP] Discord Proxy helper call already present in ${path.basename(filePath)}`);
    return content;
  }

  console.log(`  - [PATCH] Integrating Discord Proxy helper call into ${path.basename(filePath)}`);
  
  // Find the UrlFetchApp direct call in postMessageToDiscord
  const targetText = `  if (webHook.indexOf("$$$$$") > -1) {\n    UrlFetchApp.fetch(webHook.split("$$$$$")[0], params);\n    UrlFetchApp.fetch(webHook.split("$$$$$")[1], params);\n  } else\n    UrlFetchApp.fetch(webHook, params);`;
  const replacementText = `  fetchDiscordWebhook_(webHook, params);`;
  
  if (content.includes(targetText)) {
    content = content.replace(targetText, replacementText);
  } else {
    // Regex fallback for whitespace variation
    const regex = /if\s*\(webHook\.indexOf\s*\("\$\$\$\$\$"\)\s*>\s*-1\)\s*\{\s*UrlFetchApp\.fetch\s*\(webHook\.split\s*\("\$\$\$\$\$"\)\[0\],\s*params\);\s*UrlFetchApp\.fetch\s*\(webHook\.split\s*\("\$\$\$\$\$"\)\[1\],\s*params\);\s*\}\s*else\s*UrlFetchApp\.fetch\s*\(webHook,\s*params\);/g;
    content = content.replace(regex, 'fetchDiscordWebhook_(webHook, params);');
  }

  return content;
}

function main() {
  console.log('Starting Combined Codebase Build Runner...');
  
  // Clean RCE Replacements output folder
  if (fs.existsSync(OUTPUT_DIR)) {
    console.log('Cleaning existing RCE Replacements directory...');
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  ensureDir(OUTPUT_DIR);

  // Scan V2 Wrapper replacements to identify eras and versions
  const replacementsBase = path.join(V2_WRAPPER_DIR, 'replacements');
  if (!fs.existsSync(replacementsBase)) {
    console.error(`Error: replacements directory not found at ${replacementsBase}`);
    process.exit(1);
  }

  const eras = fs.readdirSync(replacementsBase).filter(f => fs.statSync(path.join(replacementsBase, f)).isDirectory());
  
  for (const era of eras) {
    const eraPath = path.join(replacementsBase, era);
    console.log(`Processing era: ${era}`);

    const tools = ['CLA', 'RPB'];
    for (const tool of tools) {
      const toolReplacementsPath = path.join(eraPath, tool);
      if (!fs.existsSync(toolReplacementsPath)) continue;

      const versions = fs.readdirSync(toolReplacementsPath).filter(f => fs.statSync(path.join(toolReplacementsPath, f)).isDirectory());
      
      for (const version of versions) {
        const versionReplacementsPath = path.join(toolReplacementsPath, version);
        console.log(`  Building ${tool} - ${era} - ${version}...`);

        const outputToolPath = path.join(OUTPUT_DIR, tool, era, version);
        ensureDir(outputToolPath);

        // 1. Copy and patch all replacements files (WCL V2 compatibility changes)
        const files = fs.readdirSync(versionReplacementsPath).filter(f => fs.statSync(path.join(versionReplacementsPath, f)).isFile() && f.endsWith('.gs'));
        for (const file of files) {
          const srcFile = path.join(versionReplacementsPath, file);
          const destFile = path.join(outputToolPath, file);

          if (tool === 'CLA' && file === 'General.gs') {
            // Strip duplicate/local fetchDiscordWebhook_ & getDiscordWebhookRequest_
            let content = fs.readFileSync(srcFile, 'utf8');
            const duplicateStart = content.indexOf('function fetchDiscordWebhook_(');
            if (duplicateStart > -1) {
              console.log(`  - [PATCH] Stripping duplicate Discord webhook helper functions from General.gs`);
              const nextFuncIndex = content.indexOf('function getStringForTimeStamp(');
              if (nextFuncIndex > -1) {
                content = content.substring(0, duplicateStart) + content.substring(nextFuncIndex);
              } else {
                content = content.substring(0, duplicateStart);
              }
            }
            fs.writeFileSync(destFile, content, 'utf8');
          } else if (tool === 'RPB' && file === 'Filtering.gs') {
            // Apply Discord Proxy patch to RPB Filtering.gs (without appending duplicate helpers)
            const patchedContent = patchRpbFiltering(srcFile);
            fs.writeFileSync(destFile, patchedContent, 'utf8');
          } else {
            // Copy directly
            copyFile(srcFile, destFile);
          }
        }

        // 2. Generate consolidated wrapper.gs (WCL_Compat + Shared_DiscordWebhook)
        const srcWclCompat = path.join(V2_WRAPPER_DIR, 'shared', 'WCL_Compat.gs');
        const srcSharedDiscord = path.join(AUTOMATIONS_DIR, 'Shared_DiscordWebhook.gs');
        
        let wclCompatContent = '';
        let sharedDiscordContent = '';

        if (fs.existsSync(srcWclCompat)) {
          wclCompatContent = fs.readFileSync(srcWclCompat, 'utf8');
        } else {
          console.error(`Warning: WCL_Compat.gs not found at ${srcWclCompat}`);
        }

        if (fs.existsSync(srcSharedDiscord)) {
          sharedDiscordContent = fs.readFileSync(srcSharedDiscord, 'utf8');
        } else {
          console.error(`Warning: Shared_DiscordWebhook.gs not found at ${srcSharedDiscord}`);
        }

        const wrapperHeader = `/**
 * wrapper.gs
 * ─────────────────────────────────────────────────────────────────────────────
 * Warcraft Logs Compatibility Facade & Discord Webhook Relay Wrapper
 *
 * This combined file allows Google Sheets to fetch Warcraft Logs data (V1 and V2)
 * and send Discord Webhook messages optionally through Cloudflare Worker proxies.
 *
 * CONFIGURATION:
 *   You can configure your Cloudflare Worker details EITHER by entering them in
 *   the global variables below, OR by adding them to Settings -> Script Properties:
 *     - WCL_PROXY_WORKER_URL    : URL to your Cloudflare Warcraft Logs proxy worker
 *     - WCL_PROXY_SECRET        : Secret password for the WCL proxy
 *     - DISCORD_PROXY_WORKER_URL: URL to your Cloudflare Discord webhook proxy worker
 *     - DISCORD_PROXY_SECRET    : Secret password for the Discord proxy
 *
 *   If these values are left empty/null, the sheet automatically falls back to direct,
 *   unproxied requests (direct Warcraft Logs API and direct Discord webhook deliveries).
 *
 * BUTTON ASSIGNMENTS:
 *   - CLA Sheet: Assign the START EXPORT button/drawing to: runCLAExportWithDiscordProxy
 *   - RPB Sheet: Assign the START EXPORT button/drawing to: runRPBExportWithDiscordProxy
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Optional Hardcoded Worker Configurations ─────────────────────────────────
// Fill these in to hardcode worker options. If left null, Script Properties will be checked.
var WCL_PROXY_WORKER_URL_CONFIG     = null; // e.g. 'https://your-worker.workers.dev/wcl'
var WCL_PROXY_SECRET_CONFIG         = null; // e.g. 'your-wcl-proxy-secret'
var DISCORD_PROXY_WORKER_URL_CONFIG = null; // e.g. 'https://your-worker.workers.dev/discord'
var DISCORD_PROXY_SECRET_CONFIG     = null; // e.g. 'your-discord-proxy-secret'

`;

        const combinedContent = wrapperHeader + wclCompatContent + '\n\n' + sharedDiscordContent;
        fs.writeFileSync(path.join(outputToolPath, 'wrapper.gs'), combinedContent, 'utf8');
        console.log(`  - [GENERATE] wrapper.gs (WCL Facade + Discord Relay)`);
      }
    }
  }

  console.log('\nCombined Codebase Build Runner Finished Successfully!');
  console.log(`Output folder: ${OUTPUT_DIR}`);
}

main();
