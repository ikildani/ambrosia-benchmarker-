# Solidus (ambrosia-benchmarker-): notes for every Claude session

Read this before touching deals, companies, counts or migrations. Update the
"In flight" table when you start or finish work that another session could collide with.

## Deal data quality: the standing rule

No synthetic, duplicate, rejected or flagged deal may reach a user-facing count, list,
alert, email or report.

- **Read product surfaces from the `deals_verified` view** (migrations 147, 150, 156), not `deals`.
  Since 156 it shows `verification_status = 'verified'` rows only (no pending, skipped, flagged or rejected),
  and never rows with `duplicate_of` set. `deal_quality_invariants()` (157) must return all zeros; the daily
  deal-data email prints it.
  It applies `is_synthetic = false AND is_canonical IS NOT FALSE AND
  coalesce(verification_status,'') NOT IN ('rejected','flagged')` in the database, with
  `security_invoker` so RLS still applies.
- Write, ingest, dedupe and admin paths use `deals` (the view is read-only).
- Where a query must stay on `deals`, use `applyDealQualityFilter` (lib/entities/resolve.ts)
  or the same three filters inline (the generic helper can hit TS2589 on typed queries).
- The view's `SELECT *` binds columns at creation: after adding a column to `deals`,
  re-run migration 147's `CREATE OR REPLACE VIEW`.
- Dedupe convention: the loser gets `is_canonical = false`, `duplicate_of`, the shared
  `dedupe_group_id`, and a dated note appended to `verification_notes`
  (`[YYYY-MM-DD manual review: ...]`). Never delete deal rows.
- Headline count (lib/deal-stats.ts) = primary-sourced rows in `deals_verified`
  (1,447 on 2026-09-28). `LIVE_DEAL_COUNT` in lib/config/constants.ts is only the fallback.
- Company stats (`companies.deals_last_12mo` etc.) come from `update_company_deal_stats`,
  which applies the same filter, rolls merged entities up to the survivor, and is kept
  current by the `deal_changed_company_stats` trigger (migration 146). Do not recompute
  them in app code.

## Ingestion: flag it, fix it, report it

**Owner rule (Issa, 2026-09-29): a flag is never a request for review.** Every flagged deal is
resolved automatically, and Slack only shows "flagged because X → what was done". The verification
cron hands the deals it flags to the flag-fixer in the same run; the fixer corrects and cites,
retires as a duplicate, or holds the row out of counts and retries, rejecting it after
`MAX_FIX_ATTEMPTS` (3) attempts with no primary document. Report builder:
lib/ingestion/flag-resolution-report.ts. Never post "for review" / "needs review" about deals.

A flagged deal is not parked for a human. It is fixed, and the owner gets a report of
what was flagged and how it was fixed.

- The flag-fixer (lib/ingestion/flag-fixer.ts) runs hourly inside the `deal-verification` cron's :40 pass
  (on demand: `/api/cron/flag-fixer`). It takes flagged deals and
  finds the primary document: SEC or exchange filing, newswire, or the company's own site.
  It extracts the terms, which must be quoted verbatim from the fetched text, and then either:
  - corrects the row from that document, cites it and sets `verified`; or
  - rejects the row as a duplicate of the verified, cited row that already holds the deal; or
  - leaves it flagged as unresolved when no primary document exists.
- The daily report rides on `api-credit-check` at 12:20 UTC (on demand: `/api/cron/deal-fix-report`,
  `?dry=1` for HTML). It emails `ADMIN_NOTIFICATION_EMAIL` the
  fixes (field before -> after, with the source link), duplicates removed, rejections
  and unresolved deals. The source of truth is `remediation_log` with `cron_source = 'flag_fixer'`.
- Never correct a deal from web-search prose or the verifier's notes alone. The
  correction must come from a primary document the code (or you) actually fetched.
- Doing it by hand: same rules. Back up the rows first, append a dated
  `[YYYY-MM-DD flag-and-fix: ...]` note with before -> after, and log to `remediation_log`.

## Duplicates: `is_canonical` is recomputed, so reject the loser

`recompute_deal_dedupe()` runs after every verification pass. It rebuilds `is_canonical`
for every row from party names plus an upfront/total bucket. A duplicate with wrong
money lands in its own group and becomes canonical again, and a manual
`is_canonical = false` does not survive. `duplicate_of` has been set in both directions
in the past, so it cannot be trusted as "this row is the loser".

To retire a duplicate for good, set `duplicate_of = <keeper>` and a note. Since migration 150
(2026-09-28) `deals_verified` excludes any row with `duplicate_of` set and `recompute_deal_dedupe()`
keeps it in the keeper's group and never canonical; `rejected` is no longer required for that.
Unique indexes to watch when correcting a row:
- `idx_deals_dedup` on (licensor, licensee, total) for non-synthetic rows. Rejected rows
  count too, so correct whichever row of the pair will not collide.
- `unique_deal` on (licensor, licensee, asset, date).

## vercel.json is at Vercel's 100-cron cap

A new cron entry fails the deploy. New scheduled work rides on an existing cron: see
`deal-verification` (outcomes, flag-fixer) and `api-credit-check` (inflow check, flag-fix report).

## Migrations

- Check open PRs for the next free number before adding one; two PRs claiming the same
  prefix collide. On 2026-09-28, 144 and 145 were taken by PR #69 (radar); 146 and 147
  by PR #70.
- A migration applied to production ahead of its PR merging must say so in the PR body.

## In flight

| Area | Owner (branch / PR) | Status (2026-09-28) |
|---|---|---|
| Deal quality: competitor alert, Market Pulse, company pages, headline count, `deals_verified` view, company stats | `claude/lsx-email-deliverability-g58r36` / PR #70 | Migrations 146 and 147 applied to production; code awaiting merge |
| Surfaces still reading `deals` with an inline filter: lib/brief/buyer-map.ts, lib/brief/comp-set.ts, lib/outcomes/resolver.ts, lib/ingestion/deal-status.ts, callers of `applyDealQualityFilter` | unowned | Filter is correct; move to `deals_verified` when next touched |
| Flag-and-fix cron + daily report | PR #70 | Code in review; 25-deal manual pilot researched, awaiting owner go-ahead to write |
| rNPV backtest calibration (2/20 within ±35%), red on main | needs owner decision | Thresholds deliberately unchanged. The comparison is risk-adjusted model value vs unrisked headline "up to" totals; see PR #70 notes |
| Backtest corpus (data/comparable-deals-supabase.ts, generated 2026-04-17) | unowned | Only 78 of its 541 DB rows pass today's quality filter; regenerate from `deals_verified` before trusting /accuracy |
| Radar sections, migrations 144–145 | `feat/radar-credibility` / PR #69 | Open |
| Coverage program 2024→2011: newswire archive walker (lib/ingestion/wire-archive.ts), data-quality worker script, `persistExtractedPressDeal()` refactor; migrations 148 (coverage panel on `deals_verified`), 149 (value-less rows join valued twin's group), 150 (`duplicate_of` rows excluded from `deals_verified`, never canonical) | `feat/coverage-2024-2026` / PR #75 | Migrations 148–150 applied to production 2026-09-28; worker is dispatched by hand (commands in PR #75); three reviewed passes logged in `remediation_log` under `dedupe_review_2026_09_28`, `note_audit_2026_09_28`, `flag_review_2026_09_28` |
| Search & Evaluation UI: mandate composer (typed brief → criteria), grouped facet rail, landscape strip, table type scale, rights filter, peer-rank filter; migrations 154 (rights_available, mandates rights/owner_types, industry default) and 155 (probability sort, percentiles by probability, phase-less rows hidden) | `feat/radar-ui-worldclass` | Migrations 154–155 applied to production 2026-09-29; code awaiting merge. Note: `146_pipeline_pages.sql` / `147_asset_designations.sql` (PR #74) share prefixes with PR #70's 146/147; both applied under distinct ledger names, next free is 156 |
| Daily AI spend guard: every Anthropic call goes through `withSpendGuard`/`guardedFetch` (lib/ai/spend-guard.ts). Lanes per UTC day: interactive (Solidus product, $5 reserved), search (S&E user requests, $1), core + bulk ($6, bulk ≤ $2), plus a one-off backlog allowance ($90 from 2026-10-29, $15/day max: asset-classify $40, preclinical-pipeline $12, pipeline-pages $35). Ledger `ai_spend_daily` (migrations 168–170). Lean throttles: EDGAR backfill drain only, deal-verification :20 slot skipped, classifier 10 req/run (40 + whole industry queue on backlog), preclinical every 6 h (every run on backlog), management intent every 8 h | PRs #90, #91 merged; backlog on `feat/radar-worldclass-backlog` | Migrations 168–170 applied to production. New Anthropic clients must use `withSpendGuard('<source>', opts)` |
| Radar predicted terms: licensing-terms comp pool (`findEnrichedComparableDeals(..., { licensingTermsOnly: true })`: `deals_verified`, no M&A, no partial-territory licenses, phase-anchored strict rung), snake_case TA → deals TA mapping, one headline upfront (lib/radar/terms-headline.ts), QA migration 172 | PR #95 merged 2026-10-29 | Migration 172 applied; all theses marked due 2026-10-29 and rebuilt by the 2-hourly deal-thesis cron |
| Radar drug identity: trusted-key gate on drug links (lib/radar/drug-identity.ts), NCIt lookups (lib/radar/ncit.ts), drug-resolve stops alias snowballing, `marketed_shared` ownership rule, duplicate QA counts unexplained groups only; repair script scripts/radar-drug-identity-fix.ts (dry run by default, `--stage` uploads a plan, applied by `radar_drug_identity_apply(run, limit)`, reverted by `radar_drug_identity_revert(run)`) | PR #96 merged 2026-10-30 | Migration 173 (ledger 173a–e) applied 2026-10-28/29; repair run `drugid_202610291947` applied 2026-10-29 (revert: `radar_drug_identity_revert('drugid_202610291947')`) |
| Company SEC IDs: PHARMA_CIKS regenerated from SEC company_tickers.json (53 corrected, 35 dropped), filer-name check (lib/ingestion/sec-name-match.ts) before sec-xbrl writes revenue or a CIK and before company-financials stores cash/burn; production data fixed under runs `cik_fix_20261030` and `merck_fix_20261030` (log: `company_id_fix_log`, migration 174) | `fix/sec-cik-verify` | Data fix and migration 174 applied to production 2026-10-30; code awaiting merge |
| Program buckets: `isPlaceholderProgramName` (lib/ingestion/preclinical-pipeline.ts) keeps chart groups, pipelines, bare platforms and year-led plans ("Other CNS Discovery Programs", "2026 ADHD program") out of `clinical_assets`; `persistPrograms` records them as skipped disclosures. One-off 2026-11-02: 80 such assets deleted, full rows in `radar_trust_fix_log` (step `placeholder_program_removed_20261102`) | `fix/pipeline-placeholder-programs` | Data fix applied 2026-11-02; code awaiting merge |
| Radar thesis retirement: theses of assets that left `radar_thesis_eligible_assets` are moved to `radar_deal_theses_retired` and deleted by `radar_retire_ineligible_theses()`, called by the `deal-thesis` cron every run (migration 176). One-off 2026-11-02: 10,265 retired (5,735 still priced off acquisition comps) | `fix/radar-thesis-retire` | Migration 176 applied and run on production 2026-11-02; code awaiting merge |
| CT.gov re-check: open trials quiet on CT.gov for a year are re-asked by id about monthly (lib/ingestion/ctgov-recheck.ts) at the end of the `ctgov-sweep` cron once the sweep has caught up; `company_trials.status_checked_at` (migration 175). One-off refresh 2026-10-30: 2,276 trials and 12,771 asset trial-status rows corrected, logged in `company_id_fix_log` (runs `trial_refresh_20261030`, `asset_trial_recalc_20261030`) | `fix/ctgov-recheck` | Migration 175 applied to production 2026-10-30; code awaiting merge |
| Company duplicates: exact-name merge (`scripts/merge-duplicate-companies.ts`, 394 groups / 426 rows) and same-company merge (`scripts/merge-same-company-rows.ts --exclude scripts/data/same-company-exclude-20261102.txt`, 592 plans / 666 rows incl. national affiliates); referencing-column list now includes asset_designations / asset_disclosures | `fix/company-duplicates` | Applied 2026-11-02: runs `merge-exact-20261102` (430 rows) and `merge-same-20261102` (306 rows). Review groups hand-checked 2026-11-03 into `scripts/data/same-company-extra-20261103.txt` (140 plans / 160 rows; run `merge-extra-20261103`, owner applies) |
| SEC revenue: `runXBRLRevenueUpdate` pages companies (was capped at 1,000 rows, so 2 of 180 filers matched), picks the latest full-year fact across revenue tags by period end (`latestAnnualRevenue`), logs instead of skipping >10x jumps; 33 more wrong PHARMA_CIKS dropped, 17 replaced from SEC's ticker list. Data run `cik_fix_20261102` in `company_id_fix_log` (32 companies, their wrong-filer financials and cursor keys) | `fix/sec-revenue-paging` | Data fix and revenue refresh (85 companies) applied 2026-11-02; code awaiting merge |
| Company stats age-out: `refresh_aged_company_deal_stats(p_days)` recomputes companies whose verified deal left the 12-month window (plus any count that no longer matches `deals_verified`); pg_cron job `company-stats-age-out` daily 04:10 UTC (migration 177). First run 2026-11-03 refreshed 63 companies; invariants all zero | `fix/company-stats-age-out` | Migration 177 applied to production 2026-11-03; PR awaiting merge |
| HKEX pipeline reader: latest English annual report of 77 hand-mapped Hong Kong biotechs (`scripts/data/hkex-biotech-map-20261103.json`) through the SEC reader's extraction and persistence (`lib/ingestion/hkex-pipeline.ts`); assets tagged `data_sources = ['hkex_filing']`, form `hkex_annual_report`; manual workflow `hkex-pipeline.yml`; backlog share 'hkex-pipeline' $15 (total $105, owner-approved Nov 3 2026). China CDE is not scraped past its WAF and WHO ICTRP bars commercial reuse | `feat/hkex-pipeline` | Code awaiting merge; first run after merge |
| Pipeline crawler by region: `--regions` / `PIPELINE_CRAWL_REGIONS` limits discovery and crawl to companies whose assets come from those regions (`pipeline_region_targets`, migration 178); scheduled runs target Asia, Middle East, Israel and Latin America with web-search discovery while the pipeline-pages backlog lasts; a fruitless paid search stamps `website_source = 'web_search_none'` | `feat/pipeline-crawl-regions` | Migration 178 applied 2026-11-03; code awaiting merge |
| Older deal-integrity work | `feat/deal-data-integrity` / PR #7 | Open since 2026-09-17; overlaps the rule above, rebase before merging |
