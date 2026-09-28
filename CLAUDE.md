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
| rNPV backtest calibration (2/20 within ±35%), red on main | needs owner decision | Thresholds deliberately unchanged |
| Radar sections, migrations 144–145 | `feat/radar-credibility` / PR #69 | Open |
| Older deal-integrity work | `feat/deal-data-integrity` / PR #7 | Open since 2026-09-17; overlaps the rule above, rebase before merging |
