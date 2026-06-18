# Syncing Updates to the Deploy Repo

This document describes how to push updates from the main monorepo (`Report Card Enhancements/RCE-Proxy/`) to the standalone deploy repo (`RCE-Proxy`).

---

## Initial Setup (One Time)

Clone the standalone deploy repo alongside your main repo:

```bash
# From your projects directory (e.g. C:\Dev Projects\)
git clone https://github.com/Bl4ut0/RCE-Proxy.git
```

Your folder structure should look like:

```
Dev Projects/
├── Report Card Enhancements/     ← main monorepo (source of truth)
│   └── RCE-Proxy/                ← worker source files live here
│       ├── worker.js
│       ├── wrangler.toml
│       ├── deploy.js
│       └── README.md
│
└── RCE-Proxy/                ← standalone deploy repo (what users clone)
    ├── worker.js
    ├── wrangler.toml
    ├── deploy.js
    ├── README.md
    └── .github/workflows/deploy.yml
```

---

## Pushing an Update

After making changes to `RCE-Proxy/` in the monorepo, run these commands to sync and push:

### Windows (PowerShell)

```powershell
# 1. Copy updated files from monorepo to deploy repo
#    Assumes RCE-Proxy is cloned alongside this monorepo
$source = "."
$dest = "../../RCE-Proxy"

# Copy core files (excludes .dev.vars, .wrangler/, .git/)
Copy-Item "$source\worker.js" "$dest\worker.js" -Force
Copy-Item "$source\wrangler.toml" "$dest\wrangler.toml" -Force
Copy-Item "$source\deploy.js" "$dest\deploy.js" -Force
Copy-Item "$source\README.md" "$dest\README.md" -Force
Copy-Item "$source\.gitignore" "$dest\.gitignore" -Force

# Copy GitHub Actions workflow
if (!(Test-Path "$dest\.github\workflows")) {
    New-Item -ItemType Directory -Path "$dest\.github\workflows" -Force
}
Copy-Item "$source\.github\workflows\deploy.yml" "$dest\.github\workflows\deploy.yml" -Force

# 2. Commit and push to deploy repo
cd $dest
git add -A
git commit -m "Update proxy to latest version"
git push origin main
```

### Quick One-Liner (PowerShell)

```powershell
# Copy, commit, and push in one shot
$s="."; $d="../../RCE-Proxy"; Copy-Item "$s\worker.js","$s\wrangler.toml","$s\deploy.js","$s\README.md","$s\.gitignore" $d -Force; cd $d; git add -A; git commit -m "Sync proxy update $(Get-Date -Format 'yyyy-MM-dd')" ; git push origin main
```

---

## What Happens After You Push

1. The push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`).
2. The workflow runs `wrangler deploy` automatically.
3. **Your deployed worker is updated.**
4. Users who forked via the 1-click deploy button will see a **"Sync fork"** notification on their GitHub repo. They click **"Update branch"** and their worker auto-redeploys too.

---

## Files That Get Synced

| File | Purpose |
|---|---|
| `worker.js` | The actual Cloudflare Worker proxy code |
| `wrangler.toml` | Worker deployment configuration |
| `deploy.js` | CLI deploy helper script |
| `README.md` | User-facing setup guide |
| `.gitignore` | Git ignore rules |
| `.github/workflows/deploy.yml` | GitHub Actions auto-deploy workflow |

### Files That Do NOT Sync (Intentionally)

| File | Reason |
|---|---|
| `.dev.vars` | Contains local development secrets |
| `.wrangler/` | Local wrangler state directory |
| `node_modules/` | Dependencies (installed at build time) |

---

## Checklist Before Pushing an Update

- [ ] Tested changes locally with `npx wrangler dev` in the `RCE-Proxy/` folder
- [ ] Ran test suite (`npm test` in `/tests`) to verify proxy behavior
- [ ] Updated README.md if any configuration options changed
- [ ] Committed changes to the monorepo first (`Report Card Enhancements`)
- [ ] Synced files to `RCE-Proxy` using the commands above
- [ ] Pushed to `RCE-Proxy` main branch
