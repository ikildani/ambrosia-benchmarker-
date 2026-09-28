# Solidus (ambrosia-benchmarker-): notes for every Claude session

Read this before touching deals, companies, counts or migrations. Update the
"In flight" table when you start or finish work that another session could collide with.

## Deal data quality: the standing rule

No synthetic, duplicate, rejected or flagged deal may reach a user-facing count, list,
alert, email or report.

- **Read product surfaces from the `deals_verified` view** (migration 147), not `deals`.
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

To retire a duplicate for good, set `verification_status = 'rejected'` with
`duplicate_of = <keeper>` and a note. `deals_verified` excludes it whatever the recompute does.
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
| Deal quality: competitor alert, Market Pulse, company pages, headline count, `deals_verified` view, company stats | PR #70 | Merged 2026-09-28; migrations 146 and 147 in production |
| Surfaces still reading `deals` with an inline filter: lib/brief/buyer-map.ts, lib/brief/comp-set.ts, lib/outcomes/resolver.ts, lib/ingestion/deal-status.ts, callers of `applyDealQualityFilter` | unowned | Filter is correct; move to `deals_verified` when next touched |
| Flag-and-fix cron + daily report | PR #70 | Merged 2026-09-28. 25-deal manual pilot applied: 19 fixed from primary sources, 40 duplicates rejected (backup `deals_backup_pilot_20260928`). ~790 flagged rows left for the cron |
| rNPV backtest calibration | `claude/lsx-email-deliverability-g58r36` (follow-up PR) | Engine exposes `impliedDealValue.headlineTotal`; the 20-deal test compares it with disclosed headlines and scores single-asset deals (6/13 within ±35%). Engine multipliers untouched |
| Backtest corpus (data/comparable-deals-supabase.ts) | follow-up PR | Regenerated 2026-09-28 from `deals_verified` (verified + cited): 841 deals. Honest accuracy dropped: core ±50% 32.2% -> 27.8%, median signed error -17% -> +46% (engine now over-predicts upfronts). Recalibration is the next job |
| Radar sections, migrations 144–145 | `feat/radar-credibility` / PR #69 | Open |
| Older deal-integrity work | `feat/deal-data-integrity` / PR #7 | Open since 2026-09-17; overlaps the rule above, rebase before merging |
