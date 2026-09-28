# Search & Evaluation: off-Vercel registry worker (China, India, and other challenge-gated registries)

**Status:** proposal, Sep 28 2026. Needs Issa's call on where it runs.

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
