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
| Older deal-integrity work | `feat/deal-data-integrity` / PR #7 | Open since 2026-09-17; overlaps the rule above, rebase before merging |
