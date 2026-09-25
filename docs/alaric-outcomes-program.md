# Alaric outcomes program — from informing to driving

Owner: Issa Kildani. Started 2026-09-25. Branch for the first workstream: `feat/outcome-ledger`.

## The standard

A platform is transformative, not informative, when it passes six tests:

1. **Closes the loop.** Every prediction is scored against what actually happened, and the score is visible in the product.
2. **Sits inside the decision.** Output arrives as an alert, a queue or a brief on a live decision, not a page someone might open.
3. **Measures money.** The product can state what it changed: terms moved, churn avoided, days saved.
4. **Structures the client's own data.** It reads what they own but have never read as data: contracts, histories, pipelines.
5. **Optimises the portfolio.** It prices the whole book, not one item.
6. **Compounds across participants.** Each user's outcomes make the model better for the next.

Every roadmap item on every platform is tagged with the tests it advances. Items that advance none are deferred.

## Where each platform stands (2026-09-25)

| Platform | State | Verdict |
|---|---|---|
| Solidus | live | On the path: decision brief, buyer map with evidence, catalyst calendar, Radar score v3 backtested on deal labels, alerts and digest. Missing: an outcome ledger for calculator and brief predictions, a money-captured measure, portfolio pricing. |
| Terrain | live | Informs. Reference layer (236 indications, 18 TAs) with no decision output, no loop, no workflow. Decision: becomes the **demand layer** consumed by Solidus and Augur through a read API; sold alone only once it carries a signed decision product (indication selection / go-no-go). |
| Augur | spec | Designed right (fair value engine with approval workflow, attribution, event-driven NAV, LP distribution, contributing-data benchmarks). Decision: **build narrow** — fair value, NAV workflow, attribution, LP report — and only add domains once those four have a loop. |
| IP Map | name | Decision: scoped as the **rights layer** (expiries, exclusivities, freedom-to-operate catalysts) feeding Solidus, Augur and the brief; a standalone product only if paid for alone. |
| Alaric | roadmap | Inherits the four. Prerequisites that do not yet exist: a shared entity graph across platforms, and outcome data on every platform. |

## Sequencing

1. **Outcome ledger in Solidus** (this branch). Predictions from the calculator, the brief and Radar are recorded with their inputs; outcomes are resolved automatically from ingested deals and manually from the client (first offer vs signed); accuracy and value captured are rolled up and shown in the product. This is the moat and it takes months to accumulate, so it starts first.
2. **Money metric on every product.** Brief: signed terms vs first offer vs our ask. Calculator: users record the deal they signed. Radar: predicted licensing events vs actual.
3. **Shared entity graph.** Canonical identifiers: `companies.id` for organisations, `drug_master.id` for assets, `deals.id` for transactions. Terrain and Augur reference these through a read API (`/api/entities/resolve`) rather than keeping their own. Decided now; enforced as each platform touches an entity.
4. **Terrain as demand layer.** Expose indication epidemiology, competitive density and regulatory data through an API keyed on the shared identifiers; Solidus's patient funnel and pipeline map consume it.
5. **Augur narrow build.** Four capabilities, each with a loop from day one (NAV marks vs later rounds and exits).
6. **IP Map as rights layer.** Expiry and exclusivity catalysts on the shared asset identifier.
7. **Alaric.** Only cross-platform predictions that need two or more platforms and can be scored against an outcome.

## Workstream 1: outcome ledger (design)

### Tables (migration 122)

**`predictions`** — one row per forecast the platform commits to.
- `id`, `source` (`calculator` | `brief` | `radar` | `share`), `source_id` (calculation id / benchmark_request id / asset id / share token), `user_id`, `created_at`
- entity keys: `company_id` (licensor when known), `asset_id` (drug_master), `licensor_name`, `indication`, `therapeutic_area`, `phase`, `modality`, `deal_type`, `territory`
- predicted terms in $M: `upfront_low/mid/high`, `total_low/mid/high`, `royalty_low/high`
- `predicted_buyers text[]`, `predicted_window_start/end` (from the catalyst calendar), `model_version`, `fingerprint`
- `status` (`open` | `resolved` | `expired` | `withdrawn`), `resolve_after` (predictions younger than 30 days are not matched, to avoid matching the deal that prompted the calculation)

**`outcomes`** — what actually happened.
- `prediction_id`, `deal_id` (nullable for client-reported), `matched_by` (`auto` | `manual` | `client`), `match_confidence` 0–1, `match_evidence jsonb`
- actuals: `upfront_m`, `total_m`, `royalty_low/high`, `licensee_name`, `licensee_id`, `signed_date`, `deal_type`
- client-reported: `first_offer_upfront_m`, `first_offer_total_m`, `our_ask_upfront_m`, `our_ask_total_m`
- derived: `abs_pct_error_upfront`, `abs_pct_error_total`, `within_band_upfront` (actual inside predicted low–high), `within_band_total`, `buyer_hit` (licensee ∈ predicted_buyers), `window_hit`, `value_captured_m` (signed − first offer, when both reported)
- `resolved_at`, `reviewed_by`, `notes`

**`accuracy_rollups`** — materialised nightly: by `source`, `therapeutic_area`, `phase`, `model_version`, `window` (90d/365d/all): `n`, `median_ape_upfront`, `median_ape_total`, `within_band_rate_upfront/total`, `buyer_hit_rate`, `window_hit_rate`, `value_captured_total_m`, `computed_at`.

### Writers
- Calculator: on every saved calculation with a user, insert a `prediction` (dedupe on fingerprint per user per 24 h).
- Brief: on generation, insert one `prediction` from `brief.bridge.ask` / floor and `brief.buyerMap.process.lead + tension` and the catalyst window.
- Radar: nightly, top-decile assets by score get a `prediction` with `predicted_window` = next 12 months (this joins the existing `radar_score_label_events` loop to the ledger rather than replacing it).

### Resolver (cron `outcome-resolve`, hourly)
- Cursor on `deals.created_at`. For each new quality-filtered deal: candidate open predictions where `licensor_name` matches (name + `name_variations`) or `company_id`/`asset_id` matches, indication or TA matches, phase within one step, announced after `resolve_after`. Score the match; ≥ 0.8 auto-resolves, 0.5–0.8 goes to a review queue (`outcomes` row with `matched_by = 'auto'`, `status` pending), below is ignored.
- Predictions past `predicted_window_end + 180 d` with no match → `expired` (counts against window hit rate, not against term accuracy).

### Client reporting
- `POST /api/outcomes/report` (authenticated owner of the prediction, or admin): first offer, our ask, signed terms, licensee, date. Writes an `outcomes` row with `matched_by = 'client'` and links a deal if one exists.
- Brief follow-up email (day 45 and day 120 after delivery) asks for the outcome with a one-click link into that form.

### Surfaces
- `/methodology`: accuracy by source and window from `accuracy_rollups` (replaces the hard-coded cohort).
- Brief coverage block: the same numbers for the brief's TA.
- Calculator results: "This profile: median error ±X% on N resolved deals" line under the headline when N ≥ 10.
- Admin: `/admin/outcomes` review queue for 0.5–0.8 matches; value-captured ledger for briefs.

### Tests
- Matching: name variants, phase tolerance, `resolve_after` guard, expiry.
- Rollups: medians, within-band, buyer hit, window hit, value captured.
- Writers: dedupe, brief prediction from a v3 `BriefIntelligence` fixture.

## Workstream 2: money metric and accuracy surfaces (built 2026-09-25)

- **Statements** (`lib/outcomes/statements.ts`): `accuracyStatementFromRollups` fills `DataCoverage.accuracy` for the brief's TA (brief cell, then all-source cell; n ≥ 10 or null); `calculatorAccuracyLine` is the results-view sentence; `getAccuracySummary` returns accuracy by source × window for the public methodology page (wire it in once that branch merges — this branch does not add the page).
- **Brief coverage block**: `lib/brief/build.ts` step 11 loads the statement after coverage; the methodology page prints it or keeps its "omitted rather than estimated" line.
- **Calculator line**: `components/OutcomeAccuracyLine.tsx` under the headline cards in `Results.tsx`; fetches `GET /api/outcomes/accuracy` for (calculator | all) × TA × phase × all-time; renders nothing under n = 10.
- **Client follow-up**: signed, expiring link tokens (`lib/outcomes/report-token.ts`, `OUTCOME_TOKEN_SECRET` with `CRON_SECRET` fallback, 180-day life); `POST /api/outcomes/report` accepts `?token=` / `body.token` as owner auth; the form lives at `/outcomes/report/<token>`. Day-45 and day-120 emails (`lib/outcomes/followups.ts`, plain, from Issa) go out from the 02:00 UTC outcome phase of `deal-verification`, idempotent through `outcome_followups` (migration 123); briefs with a client-reported outcome are skipped; briefs delivered more than 200 days ago are never contacted.

## Definition of done for workstream 1
A brief delivered today produces a prediction row; a deal ingested next quarter for that licensor resolves it without human action; the methodology page shows the resolved accuracy; the admin can record first offer vs signed and see value captured.
