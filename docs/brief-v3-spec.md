# Deal Intelligence Brief v3 — specification

Branch `feat/brief-worldclass`. Owner: Issa Kildani. Contract: `lib/brief/types.ts`.

## Why

The v2 Brief is an indication landscape export: 34 auto-generated pages, four uncited comps, four upfront numbers that disagree, no buyer stage evidence, no decision. v3 turns it into a document a CEO argues in a room: one decision page, one reconciled valuation, cited comps, buyers ranked on evidence, a catalyst clock, and a written position.

## Page order (v3) — as assembled by `buildPageSpecs()` in `lib/report/index.ts`

Sections appear only when their data exists; the assembler is two-pass so empty legacy sections are dropped and page numbers stay exact. **Bold = new in v3.**

1. Cover (asset name, prepared-for)
2. Contents (two-column)
3. **The Decision** — recommendation, counterparties, ask / floor / walk-away, levers, what would change the view, timeline, confidence, signed Managing Partner opinion
4. Executive Dashboard
5. **Valuation Bridge** — football field (total basis and upfront basis), reconciliation, method table
6. Deal Structure · 7. Deal Terms
8. **Comparable Set** — scatter (upfront vs total, bubble = royalty, colour = phase), distribution strips by phase, headline drivers, caveat (falls back to the legacy Comparable Deals page when < 3 rows)
9. **Regional Deal Strategy** · 10. **Term-Sheet Precedent Map**
11. M&A Acquisition Benchmarks · 12. Trispecific · 13. Delivery Route · 14. Molecular Target (when data) · 15. Sensitivity
16. Financial Model · 17. **Patient Funnel** · 18. **Path to Next Inflection** (decision tree + financing alternative)
19. Currency & Pricing · 20. Deal Flow & Market Context (when data) · 21. Defensive Analysis · 22. Scenario Comparison · 23. Deal Valuation Waterfall · 24. Advanced Analytics
25. **Buyer Map** (fit × urgency quadrant, capacity table, LOE calendar) · 26. **Buyer Stage Behaviour** (prior deals per buyer, excluded list, process)
27. Partner Matches · 28. Buyer-Specific Valuation
29. **Pipeline Map** · 30. **Catalyst Calendar** (24-month readouts and exclusivity losses, go-to-market window)
31. Therapeutic Intelligence · 32. Strategic Analysis · 33. Negotiation Strategy
34. **Positioning & Objections** · 35. **Diligence Readiness**
36. Risk Analysis · 37. Deal Timeline · 38–47. Regulatory Risk, Milestone Analysis, Earnout & CVR, Patent & LOE, Manufacturing Risk, Pricing & Access, Franchise Expansion, Tax Structure, Royalty Stacking, Buyer Synergies (each when data)
48. **Comparable Appendix** (multi-page, every comp with date, structure, terms, verified flag, source host)
49. Methodology — with the **coverage and accuracy block** (tracked, verified-with-citation, TA, same-indication, comps used, as-of)

## Generating a brief

- Production: `POST /api/benchmark/generate { requestId }` with the admin key. The route resolves the intake (`lib/brief/intake-map.ts`), runs the engine, memo, playbook and partner match, then `buildBrief()` (`lib/brief/build.ts`), renders and uploads. Build notes land in `benchmark_requests.admin_notes`.
- Managing Partner opinion: set `mp_opinion`, `mp_reviewer`, `mp_reviewed_at` on the request before generating; it prints verbatim on page 3. Without it the page prints "Managing Partner review pending" — never a generated signature.
- Local: `npx tsx scripts/generate-brief-v3.ts --out tmp/mine [--skip-ai] [--phase "Phase 2"] [--indication "…"] [--modality mAb]` renders HTML + PDF with local Chrome. `node tmp/measure.cjs tmp/mine/brief-v3.html` lists pages that overflow A4.

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
