# Design Framework & Codebase Workflow Rules

This document outlines the architectural rules and workflow guidelines for extending or modifying the Combat Log Analytics (RPB / CLA) Enhancements codebase.

---

## 1. Core Philosophy: Decoupled Sources

To prevent duplicate code, deployment conflicts, and maintainability issues, **never edit files in the `RCE Replacements/` directory directly.**

Instead, all development must occur in the **decoupled design source files**, which are then compiled into the final deployment outputs by the build script.

```text
┌────────────────────────────────┐
│      Decoupled Sources         │
│                                │
│ 1. V2 Wrapper/shared/          │
│    WCL_Compat.gs (WCL Facade)  │
│                                │
│ 2. n8n Automations/            │
│    Shared_DiscordWebhook.gs    │
│                                │
│ 3. V2 Wrapper/replacements/    │
│    <Era>/<Tool>/<Version>/*.gs │
└───────────────┬────────────────┘
                │
                │ runs build runner
                ▼
┌────────────────────────────────┐
│     node build_combined.js     │
└───────────────┬────────────────┘
                │
                │ generates
                ▼
┌────────────────────────────────┐
│      RCE Replacements/         │
│                                │
│  Consolidated deployment-ready │
│  sheet files & wrapper.gs      │
└────────────────────────────────┘
```

---

## 2. Decoupled Source Locations

| Source Component | Path | Description |
|---|---|---|
| **WCL Compatibility Facade** | [V2 Wrapper/shared/WCL_Compat.gs](file:///c:/Dev%20Projects/Report%20Card%20Enhancements/V2%20Wrapper/shared/WCL_Compat.gs) | The translation layer between Warcraft Logs V1 REST calls and WCL V2 GraphQL. Caches properties and tokens, manages rate limit warnings, and paces client-side requests. |
| **Discord Webhook Relay** | [n8n Automations/Shared_DiscordWebhook.gs](file:///c:/Dev%20Projects/Report%20Card%20Enhancements/n8n%20Automations/Shared_DiscordWebhook.gs) | Version-neutral helper function `fetchDiscordWebhook_` that handles payloads and routes them through the Discord proxy if configured. |
| **Version-Specific Replacements** | `V2 Wrapper/replacements/<Era>/<Tool>/<Version>/` | Modded copies of upstream sheets files (e.g. `Consumables.gs`, `Filtering.gs`) containing direct call routes to the WCL facade. |

---

## 3. The Build compilation Step

Whenever you make changes to any decoupled file, you **MUST** run the build compiler script from the project root:

```bash
node build_combined.js
```

### What the Build Runner Does:
1. **Cleans Output:** Deletes the existing [RCE Replacements/](file:///c:/Dev%20Projects/Report%20Card%20Enhancements/RCE%20Replacements) folder to ensure no stale files remain.
2. **Applies Discord Patches:**
   - For **RPB** sheets, it automatically replaces direct `UrlFetchApp.fetch` webhook calls in `Filtering.gs` with a routing call to `fetchDiscordWebhook_`.
   - For **CLA** sheets, it automatically strips local duplicate versions of Discord helper functions from `General.gs` to prevent global function naming collisions.
3. **Assembles `wrapper.gs`:** Concatenates the WCL Compatibility Facade (`WCL_Compat.gs`) and the Discord Relay Wrapper (`Shared_DiscordWebhook.gs`) into a single consolidated file (`wrapper.gs`) under each built output version.
4. **Maintains Separation of Concerns:** Outputs the deployment-ready files into `RCE Replacements/<Tool>/<Era>/<Version>/`.

---

## 4. Worker Deployment Guidelines

The Cloudflare Worker proxy code is consolidated in **exactly one** directory:
- [Combined Proxy/](file:///c:/Dev%20Projects/Report%20Card%20Enhancements/Combined%20Proxy/) (contains `worker.js`, `wrangler.toml`, and `.dev.vars` for local testing).

### Deployment Rules:
- **No Duplicate Worker Folders:** Do not replicate worker files or folders into `RCE Replacements/` or sub-system directories. Users who wish to deploy the worker must do so directly from the `Combined Proxy/` folder using Wrangler.
- **Pacing is Client-Side Only:** No request queuing, sleeping, or delay loops should ever be added back to the Cloudflare Worker code. Sleeping inside Workers holds connections open and exceeds CPU time/duration limits on the free tier. All pacing must remain client-side in `WCL_Compat.gs`.

---

## 5. Security & Credentials

- Never commit client IDs, client secrets, API keys, webhook URLs, proxy URLs, or secret passwords.
- **Google Apps Script:** Configure worker URLs and secrets using **Settings -> Script Properties** inside the Google Sheet Apps Script dashboard.
- **Cloudflare Worker:** Store secrets (`WCL_PROXY_SECRET`, `DISCORD_PROXY_SECRET`) using `npx wrangler secret put`.
- **Local Testing:**
  - Standard environment configurations belong in `.env` inside the `tests/` directory (git-ignored).
  - Local Wrangler development variables and secrets belong in `.dev.vars` inside `Combined Proxy/` (git-ignored).
