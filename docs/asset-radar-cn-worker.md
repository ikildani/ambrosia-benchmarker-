# Search & Evaluation: off-Vercel registry worker (China, India, and other challenge-gated registries)

**Status:** built Sep 28 2026 (Issa chose GitHub Actions). CDE live; ChiCTR and CTRI deferred, see "Findings".

## Why

Three registries the module wants cannot be read from Vercel:

| Registry | What it holds | Why plain fetch fails (probed Sep 27 2026) |
|---|---|---|
| CDE (chinadrugtrials.org.cn) | every IND-approved drug trial in China, ~24,000 registrations, >90% industry | HTTP 202 with a 25 KB JavaScript challenge; listing and detail need the challenge cookie |
| ChiCTR (chictr.org.cn) | ~90,000 records, ~4,000 industry drug trials | HTTP 200 with a 5.8 KB JavaScript shell; no API |
| CTRI (ctri.nic.in) | ~65,000 Indian registrations | listing renders, detail pages are viewstate POSTs with per-session tokens |

The adapters already exist (`lib/ingestion/registries/{cde,chictr,ctri}.ts`) with verified field mappings; they are marked `scrape_required` and skipped by the Vercel sweep. China matters most: Chinese originators are 559 assets in the feed today (all via ClinicalTrials.gov), against an expected 8,000 to 15,000 once CDE is read, and China-forward buyers are a stated mandate template.

## Shape

A small worker that runs a real browser, walks each registry's listing newest-first, fetches detail pages, maps them with the existing adapters, and upserts through the same `company_trials` path the Vercel sweep uses (`runRegistrySweep` with a Playwright-backed `fetchPage`).

- **Runtime:** Playwright (Chromium) in a scheduled job. Two options:
  1. **GitHub Actions cron** in this repo: zero new infrastructure, free minutes, 6-hour cadence, secrets already managed in GitHub. Egress is US-based; CDE has answered US requests so far, ChiCTR too. First choice.
  2. **Fly.io machine** (shared-cpu, ~$5/month) if the registries start blocking GitHub's IP ranges; can be placed in a Hong Kong or Tokyo region.
- **Auth to the database:** `SUPABASE_SERVICE_ROLE_KEY` as a repository secret, the same client the crons use.
- **Budget and pacing:** one registry per run, 45 minutes per run, 1.5 s between page loads, cursor persisted in `radar_sync_cursors` like every other adapter, so a run resumes where the last stopped.
- **Logging:** `logRadarRun` with source `asset_universe`, stage `registry_sweep`, registry name in parameters, so the QA gate and the health monitor see it without changes.
- **Licence handling:** store the mapped fields and `source_url` only, never raw pages (CDE publishes no reuse licence; ChiCTR forbids bulk redistribution).

## Work

1. `scripts/registry-worker.ts`: Playwright session per registry, challenge wait, listing walk, detail fetch, `adapter.mapRecord`, `runRegistrySweep` with an injected fetcher. About a day.
2. `.github/workflows/registry-worker.yml`: cron every 6 h, matrix over `cde`, `chictr`, `ctri`, secrets. An hour.
3. Adapter `fetchPage` implementations for the three (today they throw `NotImplementedError`); the mappers are done. About a day, mostly for CDE's paging form.
4. Sponsor bridging: Chinese company names arrive in Chinese on CDE; `sponsor_aliases` already carries CJK keys from the CT.gov sweep, and unmatched sponsors create companies with `owner_type` from `deriveOwnerType`. Expect a cleanup pass after the first week.

## What it changes

Roughly 8,000 to 15,000 additional industry assets from Chinese originators within two weeks of the first run, most of them unpartnered outside China. This is the single largest remaining universe lever after preclinical.

## Decision needed

Which runtime (GitHub Actions first is the recommendation), and whether to add CTRI in the first pass or after China lands.

## Findings from the build (Sep 28 2026)

- **CDE works** from a stealth headless Chromium (full `chromium` channel, `--disable-blink-features=AutomationControlled`, `navigator.webdriver` hidden, zh-CN locale): the home page passes the WAF challenge, the search form submit yields the listing, and POSTs made *inside the page* (`page.evaluate(fetch(...))`) succeed indefinitely at ~0.4 s each. POSTs through the browser context's request API get a 202 challenge after two requests, so the worker uses in-page fetch. Listing: 20 rows/page, `rule=CTR&sort=desc` (newest registration first), detail via `id` + `ckm_index`. Parsers: `lib/ingestion/registries/browser/cde-pages.ts`; fetcher: `cde-fetch.ts`; worker: `scripts/registry-worker.ts`; workflow: `.github/workflows/registry-worker.yml` (every 3 h, 40 min, ~1,500 records per run at 1.5 s pacing → the ~24,000 registrations in about a week, then incremental by 首次公示信息日期).
- **ChiCTR is blocked** even in the browser: Alibaba's anti-bot layer (`antidom.js`) returns a 405 "request blocked" page for `searchproj.html` in an automated session while the home page renders. Deferred; would need a residential-proxy browser or a data vendor.
- **CTRI** needs a CAPTCHA to search. Deferred.
- **jRCT** rate-limits bursts: a local backfill at 0.6 s pacing was answered with HTTP 403 on both listing and detail after ~60 records (Sep 28 00:56 UTC, still 403 an hour later). The adapter now stops the run on 403/429 and the pace is 1.5 s; the Vercel sweep (different egress) resumes from the cursor.
- **MFDS (Korea), Sep 28:** data.go.kr no longer offers a foreigner sign-up (member types are Korean nationals with phone identity verification, Korean children, and Korean-registered businesses), so the API key route is closed to us. The public portal nedrug.mfds.go.kr has no anti-bot layer, but its approvals search (`/searchClinic`, ~10,000 approvals since 2011) only answers its own jQuery form (3-year approval-date windows, `searchYn=Y`, `approvalStart`/`approvalEnd` as YYYYMMDD) and query-string GETs return zero rows; `/pbp/CCBCE01/getList` is a 97-row status subset. Next step: add `mfds` to the browser worker (drive the form, read the listing rows: 의뢰자, 제품명, 임상시험 제목, 임상시험 단계, 승인일). Korea meanwhile has 1,711 feed assets via ClinicalTrials.gov and CRIS.
