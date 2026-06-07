# Testing & Verification Guide

This guide documents how to verify that the V2 GraphQL compatibility layer produces identical results to the legacy V1 REST API. These tools allow you to confirm that your CLA/RPB report cards generate the same data regardless of which API version is used.

---

## Overview

The V2 Wrapper translates legacy Warcraft Logs V1 REST API calls into V2 GraphQL queries. Because the Google Sheets (CLA/RPB) were originally written for V1, we need to verify that V2 responses are data-identical. Three verification layers exist:

```text
┌─────────────────────────────────────────────────┐
│           Verification Layers                   │
│                                                 │
│  1. API-Level:  V1 REST ↔ V2 GraphQL response   │
│     → tests/test_slow.js                        │
│                                                 │
│  2. Query-Level: RPB table query verification   │
│     → tests/test_rpb_queries.js                 │
│                                                 │
│  3. Output-Level: Excel cell-by-cell comparison │
│     → tests/compare_excel.py                    │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cd tests/
cp .env.example .env
```

Edit `tests/.env` with your values:

```env
# Warcraft Logs V1 API key (from https://classic.warcraftlogs.com/accounts/changeuser)
WCL_V1_API_KEY=your_v1_api_key

# Warcraft Logs V2 OAuth credentials (from https://www.warcraftlogs.com/api/clients/)
WCL_V2_CLIENT_ID=your_client_id
WCL_V2_CLIENT_SECRET=your_client_secret

# (Optional) Proxy endpoint for testing through the Cloudflare Worker
WCL_PROXY_URL=https://your-worker.workers.dev/wcl
WCL_PROXY_SECRET=your_proxy_secret

# Report code to test against (any valid WCL classic report)
TEST_REPORT_CODE=TmNwkjXayJKtcR4W
```

### 2. Install Dependencies

```bash
cd tests/
npm install
```

### 3. Python (for Excel comparison only)

```bash
pip install openpyxl
```

---

## Test 1: API-Level Comparison (`test_slow.js`)

This is the primary verification tool. It fires the same queries against both the V1 REST API and V2 GraphQL API, then deep-compares the responses field by field.

### What It Tests

| Test Suite | V1 Endpoint | V2 Equivalent |
|---|---|---|
| `01_fights` | `/report/fights/{code}` | `reportData.report.fights` |
| `02_damageDone` | `/report/tables/damage-done/{code}` | `report.table(dataType: DamageDone)` |
| `03_healingDone` | `/report/tables/healing/{code}` | `report.table(dataType: Healing)` |
| `04_damageTaken` | `/report/tables/damage-taken/{code}` | `report.table(dataType: DamageTaken)` |
| `05_casts` | `/report/tables/casts/{code}` | `report.table(dataType: Casts)` |
| `06_buffs` | `/report/tables/buffs/{code}` | `report.table(dataType: Buffs)` |
| `07_debuffs` | `/report/tables/debuffs/{code}` | `report.table(dataType: Debuffs)` |
| `08_deaths` | `/report/tables/deaths/{code}` | `report.table(dataType: Deaths)` |
| `09_summary` | `/report/tables/summary/{code}` | `report.table(dataType: Summary)` |
| `10_events_casts` | `/report/events/casts/{code}` | `report.events(dataType: Casts)` |
| `11_events_damage` | `/report/events/damage-done/{code}` | `report.events(dataType: DamageDone)` |

### Running

```bash
# Standard run (direct V2 API calls)
node test_slow.js

# Test through the Cloudflare Worker proxy
node test_slow.js --proxy

# Test a specific report code
node test_slow.js --report ABC123xyz
```

### Reading Results

Results are written to `tests/results/comparison_report.md` with live status updates:

- ✅ **PASS** — V1 and V2 responses are data-identical
- ❌ **FAIL** — Differences found (details listed with JSON paths)
- ⏳ **PENDING** — Test not yet started
- ⚡ **RUNNING** — Currently executing

### Known Ignored Fields

Some V1-only metadata fields are intentionally ignored during comparison because they don't exist in V2:

- `$.friendlyPets`, `$.enemyPets` — Pet metadata arrays (structured differently in V2)
- `$.logVersion`, `$.gameVersion` — Report version metadata
- `$.phases` — Fight phase definitions
- `$.owner`, `$.exportedCharacters` — Report ownership metadata

---

## Test 2: RPB Query Verification (`test_rpb_queries.js`)

This test specifically targets the 9+ distinct table query URL patterns used by the RPB spreadsheet. It validates that the V2 wrapper correctly translates complex parameters like `viewBy`, `viewOptions`, `killType`, and encounter filtering.

### What It Tests

| Query | Key Parameters | Verifies |
|---|---|---|
| `urlBuffsDefault` | `buffs, by=target` | Buff uptimes grouped by target |
| `urlDebuffsDefault` | `debuffs, by=target` | Debuff uptimes grouped by target |
| `urlBuffsAbility` | `buffs, by=target, abilityid=X` | Single-ability buff tracking |
| `urlBuffsFiltered` | `buffs, sourceauraspresent=X` | Source aura filtering |
| `urlDamageDone` | `damage-done` | Standard damage tables |
| `urlDamageDoneBySource` | `damage-done, by=source` | Damage grouped by source |
| `urlDamageTakenTop` | `damage-taken, hostility=1` | Hostile damage taken |
| `urlDebuffsOptions` | `debuffs, by=target, options=2` | Bitmask option filtering |
| `urlSummary` | `summary` | Summary table data |
| `urlBuffsKillsOnly` | `buffs, encounter=-2, wipes=2` | Boss kills only filter |
| `urlDebuffsWipesOnly` | `debuffs, encounter=-2, wipes=1` | Boss wipes only filter |

### Running

```bash
node test_rpb_queries.js
```

### Expected Output

```
[RPB Query Test] Starting 11 query comparisons...
[TEST 01] urlBuffsDefault .................. ✅ PASS (0 differences)
[TEST 02] urlDebuffsDefault ................ ✅ PASS (0 differences)
...
[RPB Query Test] Results: 11/11 PASSED
```

---

## Test 3: Excel Workbook Comparison (`compare_excel.py`)

This is the highest-level verification. It compares two exported Excel workbooks cell by cell — one generated using V1 API credentials and one using V2 credentials — to confirm the final spreadsheet output is identical.

### How It Works

1. Run your CLA or RPB sheet with **V1 API credentials** and export the result as `.xlsx`
2. Run the **same sheet with the same report** using **V2 credentials** and export again
3. Place both `.xlsx` files in the project root directory
4. Run the comparison script

### File Naming Convention

The script expects files in the project root with these naming patterns:

| Type | V1 Export (Original) | V2 Export (Complete) |
|---|---|---|
| **CLA** | `CLA for ... in Tempest Keep.xlsx` | `Complete - CLA for ... in The Eye.xlsx` |
| **RPB** | `RPB for ... in Tempest Keep.xlsx` | `Complete RPB for ... in The Eye.xlsx` |

> **Note:** The zone name difference ("Tempest Keep" vs "The Eye") is expected — V1 and V2 return different zone name strings for the same zone. This is a metadata difference, not a data error.

### Running

```bash
# From the project root
python tests/compare_excel.py
```

### Reading Results

```
==========================================
Comparing CLA Workbooks:
  File A (Original): CLA for 06.03.2026 TK ... in Tempest Keep.xlsx
  File B (Complete): Complete - CLA for 06.03.2026 TK ... in The Eye.xlsx
==========================================
[PASS] Sheet 'Consumables': Perfect Match
[PASS] Sheet 'Drums': Perfect Match
[PASS] Sheet 'Summary': Perfect Match
[FAIL] Sheet 'Gear': 3 differences found
   Cell A1: Original = 'Tempest Keep', Complete = 'The Eye'
   ...
```

- **`[PASS]`** — Every cell matches between V1 and V2 exports
- **`[FAIL]`** — Differences found (first 10 shown with cell coordinates)
- **`[WARN]`** — Sheets exist in one workbook but not the other

### Known Acceptable Differences

| Difference | Reason |
|---|---|
| Zone name ("Tempest Keep" vs "The Eye") | V1 and V2 APIs return different names for zone ID 1008 |
| Timestamps in URLs | V2 URLs use GraphQL format vs V1 REST format |
| Report URL format | V2 links to `/reports/` path vs V1 `/report/` path |

---

## Customizing for Your Reports

### Using Your Own Report Code

All test scripts accept a report code. To test with your own log:

1. Go to [Warcraft Logs](https://classic.warcraftlogs.com) and find a report
2. Copy the report code from the URL (e.g. `https://classic.warcraftlogs.com/reports/ABC123xyz` → `ABC123xyz`)
3. Set it in your `.env`:
   ```env
   TEST_REPORT_CODE=ABC123xyz
   ```

### Running Excel Comparison on Different Reports

Edit the file paths in `tests/compare_excel.py` to point to your exported files:

```python
cla_original = os.path.join(root_dir, "YOUR_V1_CLA_EXPORT.xlsx")
cla_complete = os.path.join(root_dir, "YOUR_V2_CLA_EXPORT.xlsx")
```

---

## Quick Reference

| Command | What It Does |
|---|---|
| `node tests/test_slow.js` | Full V1 ↔ V2 API comparison |
| `node tests/test_slow.js --proxy` | Same, routed through Cloudflare Worker |
| `node tests/test_rpb_queries.js` | RPB-specific query verification |
| `python tests/compare_excel.py` | Cell-by-cell Excel comparison |
| `node tests/inspect_tables.js` | Quick single-query debug tool |
