# Deal Intelligence Brief v3 — specification

Branch `feat/brief-worldclass`. Owner: Issa Kildani. Contract: `lib/brief/types.ts`.

## Why

The v2 Brief is an indication landscape export: 34 auto-generated pages, four uncited comps, four upfront numbers that disagree, no buyer stage evidence, no decision. v3 turns it into a document a CEO argues in a room: one decision page, one reconciled valuation, cited comps, buyers ranked on evidence, a catalyst clock, and a written position.

## Page order (v3)

| # | Page | Renderer | Data |
|---|------|----------|------|
| 1 | Cover | existing `cover.ts` (title → "Deal Intelligence Brief", asset name if present) | `brief.asset` |
| 2 | Table of contents | existing | — |
| 3 | **The Decision** | `decisionPage.ts` | `brief.decision`, `brief.mpOpinion` |
| 4 | Executive dashboard | existing (numbers must equal `bridge.ask`) | — |
| 5 | **Valuation bridge** (football field) | `valuationBridge.ts` | `brief.bridge` |
| 6 | Deal structure | existing | — |
| 7 | Deal terms | existing | — |
| 8 | **Comparable set** (scatter + distribution strips) | `compScatter.ts` | `brief.compSet` |
| 9 | **Regional deal strategy** | `regionalStrategy.ts` | `brief.regional` |
| 10 | **Term-sheet precedent map** | `termSheetPrecedent.ts` | `brief.termSheet` |
| 11 | Sensitivity | existing | — |
| 12 | Financial model (rNPV, MC) | existing | — |
| 13 | **Path to next inflection** (decision tree + financing alternative) | `inflectionPath.ts` | `brief.inflection` |
| 14 | Scenario comparison / waterfall / advanced | existing | — |
| 15 | **Buyer map** (2×2 + capacity + LOE calendar) | `buyerMap.ts` | `brief.buyerMap` |
| 16 | **Buyer stage behaviour** (prior deals, excluded list, process) | `buyerBehaviour.ts` | `brief.buyerMap` |
| 17 | Buyer-specific valuation / synergies | existing | `buyerSpecificValuations` |
| 18 | **Pipeline map** | `pipelineMap.ts` | `brief.landscape.pipeline` |
| 19 | **Catalyst calendar** | `catalystCalendar.ts` | `brief.landscape.catalysts` |
| 20 | **Patient funnel** | `patientFunnel.ts` | `brief.landscape.funnel` |
| 21 | Therapeutic intelligence / market context | existing | — |
| 22 | Strategic analysis (memo) | existing `aiMemo.ts` (label "Strategic analysis", no AI badge) | — |
| 23 | Negotiation playbook | existing | — |
| 24 | **Positioning & objections** | `positioningObjections.ts` | `brief.positioning` |
| 25 | **Diligence readiness** | `diligenceReadiness.ts` | `brief.diligence` |
| 26 | Risk, timeline, regulatory, milestones, CVR, patent, CMC, pricing, sequencing, tax, royalty stacking | existing | — |
| 27 | **Comparable appendix** (full cited table, multi-page) | `compAppendix.ts` | `brief.compSet` |
| 28 | Methodology + **coverage & accuracy block** | existing + `brief.coverage` | — |

## Format rules (non-negotiable)

1. Header: `pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)`. Never "Deal Valuation Report".
2. Section head: `sectionHead(title, question)` where `question` is the one line the page answers.
3. Every chart and table ends with `chartSource({source, n, asOf})`. No exceptions.
4. No data → `emptyState(title, message)` that says what is missing and why. Never placeholder numbers, never "illustrative".
5. Colours from `COLORS` only. Asset / ask marker = `COLORS.teal`. Buyers = `COLORS.navy`. Comps = `COLORS.gray400` / `COLORS.cyan`. Danger = `COLORS.rose`. Highlight background = `COLORS.tealLight`.
6. Type: Inter (embedded). Body 10px, table 9px, micro labels 7px uppercase tracked, KPI 20–32px 800.
7. SVG charts are pure string functions in `lib/report/svg-charts/`, width ≤ 560, unique ids via a `uid` prefix, no external refs, `font-family="Inter, system-ui, sans-serif"` on text.
8. One page = one `<div class="report-page">…</div>`; multi-page renderers return `string[]` and export `countPages(data)` so the TOC is right.
9. Every number that appears on more than one page comes from one place: `brief.bridge.ask/floor/walkAway` and `brief.decision`. Pages read, never recompute.
10. Escape all strings with `escapeHtml`. Company and asset names are untrusted.
11. Labels: "Strategic analysis", "Reviewed by", "Solidus by Ambrosia Ventures". The words "AI", "illustrative", "sample", "calculator.ambrosiaventures.co" never appear in a client page.

## Data rules

- Deals quality filter (all builders): `is_synthetic = false`, `is_canonical is not false`, `verification_status not in ('rejected','flagged')`. Prefer `verified = true`; report the verified share in the source note.
- Phase keys in `deals.phase_at_signing`: `discovery|preclinical|phase_1|phase_2|phase_3|approved|unknown`. Structures in `deals.deal_type`: `license|option|acquisition|collaboration|co_development|co_promotion|other`.
- Indication matching: `deals.indication_category`/`indication_specific` ilike; `company_trials.conditions` array ilike + `indication_specific`. `clinical_assets.indication_category` is coarse (`cns`, `solid_tumor`…) — do not rely on it for indication-level maps.
- Buyers: `companies` (phase_preference_min/max, deals_last_12mo/24mo, last_deal_date, revenue_at_risk_2025..2027, patent_cliffs jsonb, hiring_bd_roles, acquisition_appetite, company_type, hq_region, total_annual_revenue), prior deals from `deals` where `licensee_name` matches (case-insensitive, name_variations), `counterparty_premiums`.
- Catalysts: `company_trials` with `primary_completion_date` in the next 24 months and phase in (`phase_2`,`phase_2_3`,`phase_3`); LOE from `companies.patent_cliffs` and `indication_patent_cliffs`.
- Financial: `RNPVResult.phaseTransitions[]` (probability, yearsToComplete, costEstimate) drives the inflection model; `MarketSizeEstimate.patientFunnel` drives the funnel; `MonteCarloResult.percentiles`, `scenarioResults`, `buyerSpecificValuations`, `CompSet.stats` drive the bridge.
- Known data gaps (say so on the page, do not fake): `deal_status` is unpopulated (no termination history yet); `option_exercise_fee` is unpopulated; regional comps are thin (n < 15 per region).

## Honesty block (methodology page)

Prints tracked deals, verified-with-citation deals, TA deals, same-indication deals, comps used, as-of date, and an accuracy line only when a backtest object is present.

## Intake (v3 fields on `benchmark_requests`)

`modality` (required), `asset_name`, `mechanism`, `target`, `target_deal_type`, `differentiation_notes`, `data_package_stage`, `mp_opinion`, `mp_reviewed_at`, `mp_reviewer`. Migration `119_benchmark_requests_v3.sql`. Note: migration 075 (table creation) is not applied in production yet.

## Build ownership

- Agent A (comps): `lib/brief/comp-set.ts`, `lib/brief/regional.ts`, `lib/brief/term-sheet.ts`, pages `compScatter.ts`, `compAppendix.ts`, `regionalStrategy.ts`, `termSheetPrecedent.ts`, charts `scatter.ts`, `distributionStrip.ts`, `groupedBars.ts`, tests `__tests__/brief/comps.test.ts`.
- Agent B (buyers): `lib/brief/buyer-map.ts`, `lib/brief/buyer-valuations.ts`, pages `buyerMap.ts`, `buyerBehaviour.ts`, charts `quadrant.ts`, `loeCalendar.ts`, tests `__tests__/brief/buyers.test.ts`.
- Agent C (landscape): `lib/brief/landscape.ts`, pages `pipelineMap.ts`, `catalystCalendar.ts`, `patientFunnel.ts`, charts `pipelineGrid.ts`, `catalystTimeline.ts`, `funnel.ts`, tests `__tests__/brief/landscape.test.ts`.
- Agent D (decision layer): `lib/brief/valuation-bridge.ts`, `lib/brief/inflection.ts`, `lib/brief/decision.ts`, `lib/brief/diligence-checklist.ts`, `lib/ai/objection-generator.ts`, pages `decisionPage.ts`, `valuationBridge.ts`, `inflectionPath.ts`, `positioningObjections.ts`, `diligenceReadiness.ts`, charts `footballField.ts`, `decisionTree.ts`, tests `__tests__/brief/decision.test.ts`.
- Integrator: `lib/report/index.ts`, `lib/report/types.ts`, `lib/report/helpers.ts`, existing page label fixes, `app/api/benchmark/generate/route.ts`, `app/api/benchmark/intake/route.ts`, `app/benchmark/page.tsx`, migration 119, `lib/brief/build.ts` (orchestrates all builders), `scripts/generate-brief-v3.ts`, example render.
