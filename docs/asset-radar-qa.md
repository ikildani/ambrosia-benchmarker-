# Asset Radar — golden-set QA harness

The QA gate answers one question with numbers: *is this data trustworthy enough to show a pharma deal committee?* It runs before every launch and weekly afterwards, and it has two halves:

1. **Automated invariants** over the whole universe (`lib/radar/qa/invariants.ts`, RPCs in migration 124).
2. **A stratified 200-asset golden set** with a model-vs-model agreement check now (`claude-opus-4-6`) and a human review sheet for later (`lib/radar/qa/golden-set.ts`).

Every run writes a `radar_qa_runs` row (`kind` = `invariants` | `golden_agreement` | `golden_human`) and one `radar_qa_findings` row per failed check or disagreement. `GET /api/radar/qa` (admin) and `npx tsx scripts/radar-qa-report.ts` render the latest report.

## Launch gate

The launch is **blocked** unless all of the following hold on the latest runs:

| Gate | Rule |
|---|---|
| Blockers | 0 findings with severity `blocker` |
| Majors | Every `major` finding is listed in the launch notes (no numeric cap; the list is the deliverable) |
| Model agreement | Golden set agreement ≥ 85% on `therapeutic_area`, `modality`, `partnership_status`; ≥ 75% on `target` |
| Human review | Required after launch (weekly cadence); same thresholds as model agreement once a sheet is imported |

`report.passed` in the API = no blockers **and** the latest golden agreement run passed. `phase` is checked as a universe invariant (vocab + share of unknown phase) rather than by model re-derivation, because the model does not see a phase field.

## Severity

| Severity | Meaning |
|---|---|
| `blocker` | Cannot launch. The number a committee would see is wrong, missing at scale, or the gate itself could not be evaluated. |
| `major` | Must be listed in the launch notes with the observed figure. |
| `minor` | Backlog. Reported, never blocks. |

## Invariant checks

All thresholds live in `QA_THRESHOLDS` (`lib/radar/qa/invariants.ts`). Counts come from set-based SQL (`radar_qa_universe_stats`, `radar_qa_vocab_violations`, `radar_qa_thesis_stats`, `radar_qa_score_stats`, `radar_qa_pipeline_stats`, each with a `statement_timeout`). "Industry" means `companies.owner_type = 'industry'`.

| Check | Expected | Fail severity | Why |
|---|---|---|---|
| `vocab_clinical_assets_therapeutic_area` / `_modality` / `_phase` / `_partnership_status` / `_originator_region`, `vocab_companies_owner_type` | Every non-null value ∈ `lib/radar/vocab.ts` (phase additionally allows `not_applicable`, `unknown`) | major; blocker if > 1% of the universe | The UI filters and the mandate matcher only match vocab values; an off-vocab row is invisible to buyers. Sample values are reported so the writer can be found. |
| `asset_has_company` | 0 assets with NULL `company_id` **and** blank `company_name` | blocker | An asset without an owner cannot be presented. |
| `industry_phase_known` | ≤ 10% of industry assets with NULL / `not_applicable` / `unknown` phase | major; blocker > 25% | Phase drives comps, eligibility and the mandate match. |
| `classification_coverage` | `classified` + `skipped` ≥ 95% of industry assets | major; blocker < 80% | TA / modality / target come from the classifier; below 80% the feed is mostly unclassified rows. |
| `target_coverage_phase2plus` | target present on ≥ 60% of classified industry Phase 2+ assets | major | Committee briefs lead with target and mechanism. |
| `drug_resolution_coverage` | `drug_resolution_status = resolved` on ≥ 55% of industry assets | major | Unresolved names cannot be de-duplicated across sponsors. |
| `partnership_checked_coverage` | `partnership_checked_at` set on ≥ 99% of assets | major; blocker < 90% | "Unpartnered" must mean checked-and-unpartnered, not never-checked. |
| `partnered_has_hard_evidence` | Every `partnered` asset has a `deal` or `press_release` entry in `partnership_evidence` | major; blocker > 25 | A trial-collaborator string alone cannot justify "partnered". |
| `territory_vocab` | `territory_rights_available` ⊆ {global, us, eu, japan, china, row} | major | Territory algebra in `lib/radar/partnership.ts` only knows these. |
| `thesis_coverage` | ≥ 99% of `radar_thesis_eligible_assets` have a `radar_deal_theses` row | major; blocker < 90% | The eligibility view is the contract; gaps mean the queue is stuck. |
| `thesis_insufficient_has_no_terms` | `predicted_*` NULL whenever `insufficient_comps` | blocker | Honesty contract: no numbers below the 5-comp floor. |
| `thesis_comp_count_ge_verified` | `comp_count ≥ verified_comp_count` | blocker | Otherwise the "n verified of N" line is impossible. |
| `thesis_terms_basis_consistent` | `terms_basis` = `termsBasisFor(comp_relaxation, insufficient_comps)` | major | The relaxation rung shown must match the pool actually used. Pre-116 rows with NULL basis are counted separately. |
| `thesis_calculator_vs_comps` | median of |`calculator_upfront_mid` − `predicted_upfront_mid`| / `predicted_upfront_mid` ≤ 1.0 on `phase_matched` theses (median and p90 reported) | major | The model headline and the comps median must live in the same universe; a median ratio above 1 means one of them is systematically off. |
| `score_factor_entries` | Latest snapshot (14 d) per scored industry asset has `factor_scores` as an array with ≥ 9 entries | major > 1%; blocker > 10% | The asset page draws the waterfall from these rows. |
| `score_decomposition_sums` | v2 rows: |Σ points − score| ≤ 0.5; v3 rows: an `intercept` row exists and Σ points is a finite logit (|Σ| ≤ 20) | major > 1%; blocker > 10% | v2 points sum to the composite by construction. v3 points sum to the pre-calibration logit, and the snapshot does not store that logit, so the check is structural; see follow-ups. |
| `score_confidence_present` | `score_confidence` non-null on every scored industry asset | major | Confidence is shown next to every score. |
| `score_model_version_present` | `model_version` on snapshots and `score_model_version` on assets when a `radar_score_models` row is active | major | Provenance of the number. Skipped when no v3 model is active. |
| `score_discriminates` | ≥ 1 scored industry asset with score ≥ 30; share ≥ 50 reported | blocker | The Sep 9 audit found a max of 14: a score that cannot leave the floor ranks nothing. |
| `active_trial_freshness` | `last_update_date` within 400 days for ≥ 80% of assets with an active trial status | major | CT.gov requires annual updates; older rows are probably stale statuses. |
| `drug_master_cross_company_duplicates` | 0 groups from `radar_drug_duplicates` | minor; major > 500 | Same drug under two sponsors is one asset with two owners, not two assets. |
| `company_trials_orphans` | 0 `company_trials` rows whose company no longer exists | minor; major > 1,000 | Orphans inflate trial counts and break sponsor resolution. |
| `press_releases_company_resolution` | ≤ 50% of press items (90 d) with empty `companies_mentioned` | minor | Unresolved press is invisible to the partnership detector. |
| `radar_stages_ran_48h` | Every (source, `parameters.stage`) pair in `EXPECTED_RADAR_STAGES` has a completed/partial `data_ingestion_log` row in 48 h | blocker when a critical stage is missing (universe indexer, CT.gov sweep, partnership refresh, classify, scoring, deal thesis); major otherwise | Silent cron death was root cause #9 in the gap register. |
| `radar_cron_failures_7d` | 0 `failed` Radar runs in 7 days | minor; major when one stage failed ≥ 5 times | |
| `qa_stats_collection` | Every `radar_qa_*` RPC returned | blocker | If the gate cannot be computed, it fails closed. |

## Running it

Schedule: **weekly** (proposed `vercel.json` entry `{"path": "/api/cron/radar-qa", "schedule": "0 6 * * 1"}`, Monday 06:00 UTC after the overnight Radar crons) plus **on demand** before every launch. Blockers post to Slack (`SLACK_WEBHOOK_URL`).

```
# 1. Apply migration 124, then the invariants (writes a run + findings; Slack on blockers)
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/radar-qa?mode=invariants"
npx tsx scripts/radar-qa-report.ts --invariants          # same from a terminal, --dry to skip writes

# 2. Select the golden set (deterministic; re-running with the same seed reproduces it)
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/radar-qa?mode=golden_select&seed=radar-launch-2026&size=200"
npx tsx scripts/radar-qa-report.ts --select --seed radar-launch-2026

# 3. Model agreement on the golden set (claude-opus-4-6, cost-capped)
curl -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/cron/radar-qa?mode=golden_agreement&maxCost=15"
npx tsx scripts/radar-qa-report.ts --agreement

# 4. Read the report
curl -H "Authorization: Bearer $ADMIN_API_KEY" "$HOST/api/radar/qa"            # JSON + markdown
curl -H "Authorization: Bearer $ADMIN_API_KEY" "$HOST/api/radar/qa?format=md"  # markdown only
npx tsx scripts/radar-qa-report.ts            # tables
npx tsx scripts/radar-qa-report.ts --md       # markdown for the launch notes
```

### Golden set design

`radar_qa_golden_candidates(seed)` returns, per stratum, the assets with the lowest `md5(id || seed)`; `selectGoldenSample` applies quotas with the same hash, so the set is a pure function of (seed, universe). Strata: owner group (industry 70% / academic+hospital 30%) × phase bucket (P1 = early_phase_1 + phase_1; P2 = phase_1_2 + phase_2; P3 = phase_2_3 + phase_3) × region (north_america / europe / china+japan+south_korea / other, weighted 40/30/20/10). Only assets with ≥ 1 trial qualify. A thin stratum's shortfall is redistributed within its owner group first, then across.

Each golden row freezes the asset row, its thesis, the top 9 factor contributions, the drug_master node and the partnership evidence at selection time, so drift after a re-run is visible.

### Model agreement

Classification fields go through the classifier's own request path (`gatherClassificationInputs` → `classifyBatchWithModel` with the cached system prompt, JSON schema, temperature 0, ≤ 20 assets per call). Compared fields: `therapeutic_area`, `modality`, `target` (normalised key), `indication_specific` and `moa_short` (token Jaccard ≥ 0.5 or containment), plus `indication_category` and `target_class`. Cohen's kappa is reported for the categorical fields.

The partnership audit is independent of `derivePartnership`: the model receives the asset's trials (sponsor class, collaborators), the owner's deals and licensing press items — never the stored status — and answers unpartnered / partially_partnered / partnered with the partner name and the evidence ids it relied on (≤ 10 assets per call). Agreement, kappa and a confusion matrix are reported; nothing is written back to assets.

Cost of one run on Opus 4.6 (200 assets): ~10 classification calls at ~15k input / 3k output tokens and ~20 partnership calls at ~10k input / 1.5k output tokens ≈ 350k input + 60k output ≈ **$3–4** (input $5/M, output $25/M, system prompt cached). The route stops issuing requests at `maxCost` (default $15) or `maxRequests`.

### Human review sheet

```
npx tsx scripts/radar-qa-report.ts --sheet radar-golden-review.xlsx   # or GET /api/radar/qa?sheet=1
```

The `Review` sheet has one row per asset × field (`therapeutic_area`, `modality`, `phase`, `target`, `indication_specific`, `moa_short`, `partnership_status`, `partner_company_name`) with the model value, a human-readable label, the asset URL (`/radar/<id>`) and evidence links (CT.gov studies, deal / press URLs). The analyst fills `human_value` (same vocabulary as `model_value`) and/or `agrees` (yes / no) and an optional `comment`; untouched rows are ignored on import.

```
npx tsx scripts/radar-qa-report.ts --import radar-golden-review.xlsx --reviewer "J. Smith"
```

Import writes `radar_qa_human_reviews` and a `golden_human` run with per-field agreement and kappa; it passes when every gated field meets the model-agreement thresholds.

## Follow-ups

- `vercel.json` needs the weekly cron entry (file owned by the orchestrator).
- v3 snapshots do not persist the pre-calibration logit, so `score_decomposition_sums` is structural for v3 rows; persisting `logit` / `raw_probability` next to `factor_scores` in `lib/radar/signal-detection.ts` would make it exact.
- The press-release ingester logs under its own source, so it is not in `EXPECTED_RADAR_STAGES`; add it once its `logRadarRun` source is confirmed.
