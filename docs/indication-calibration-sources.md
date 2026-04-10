# Indication-Level Calibration Sources

**Date recalibrated:** 2026-04-10
**Scope:** 50 indications across 6 primary therapeutic areas
**Status:** Phase 3 (validation) complete — golden masters, regression tests, and comparable-deals backtest all passing.

## Overview

Prior to this calibration, the rNPV engine applied identical PoS tables, revenue curves, and peak-sales caps to every indication within a therapeutic area. That flattened obvious within-TA differences — Alzheimer's vs MS, DMD vs wilson disease, NSCLC vs pancreatic cancer — into a single TA-level average. This calibration adds four independent layers, each keyed off the `indication` slug in `RNPVInput`, so that rNPV computations reflect the real-world asymmetries between indications.

## Four calibration layers

| Layer | File | Entries | What it adjusts |
| --- | --- | --- | --- |
| 1. PoS modifiers | `lib/financial/indication-pos-modifiers.ts` | 57 | Multiplicative uplift/penalty on TA-level phase transitions (P1->P2, P2->P3, P3->Approval) |
| 2. Peak sales caps | `lib/financial/index-drugs.ts` (`INDICATION_MARKET_CAPS`) | 50 | Global TAM + max realistic single-drug peak ($M), triggers warning/critical ceiling checks |
| 3. Revenue curves | `lib/financial/pos-tables.ts` (`INDICATION_REVENUE_CURVES`) | 52 | Ramp-up years, peak duration, decline rate, LOE timing |
| 4. Competitive density | `lib/financial/indication-competitive-density.ts` | 53 | Penetration multiplier (>1.0 penalty for crowded, <1.0 boost for under-served) |

The lookup precedence in the engine is always: **indication override -> TA fallback -> global default.** Indications not in the calibrated set fall through to the TA-level behavior unchanged.

## Layer 1: PoS modifiers

**Source datasets (all 2024-2026 vintages):**

| Source | Used for | Year |
| --- | --- | --- |
| BIO / PharmaIntelligence / QLS Industry Analysis — "Clinical Development Success Rates 2011-2023" (2024 edition) and 2026 update covering 2013-2025 cohorts | Core disease-area transition probabilities | 2024-2026 |
| Wong CH, Siah KW, Lo AW. "Estimation of clinical trial success rates and related parameters." _Biostatistics_ 2019 (the canonical reference dataset; updated by multiple groups through 2024) | Anchor rates for rare indications where BIO samples were sparse | 2019 (data 2000-2018) |
| _Nature Reviews Drug Discovery_ — "Trends in clinical success rates", "The drug development pipeline" | Indication-level attrition for oncology subtypes and neurodegenerative | 2024-2025 |
| FDA CDER Novel Drug Approvals annual summaries + CDER Conversation pieces | Phase 3 -> Approval conversion anchors | 2024-2025 |
| EvaluatePharma World Preview 2025 | Cross-check on 2025 pipeline data | 2025 |

Each indication entry in `INDICATION_POS_MODIFIERS` carries a `source`, `sourceYear`, and `notes` field that justifies the modifier with specific approved/failed program examples. Modifiers are clamped so no transition can be pushed outside `[0.01, 0.98]`.

### Notable calibrations

- **Alzheimer's (neurology):** P2->P3 modifier 0.45x (~12-18% absolute vs neurology base ~26%). >300 failed candidates (bapineuzumab, solanezumab, gantenerumab, etc.) dominate the historical record; lecanemab and donanemab approvals validated the class but came far too late to lift the base rate.
- **DMD (rare disease):** P2->P3 modifier 1.40x (~58-62% vs rare base ~45%). Sarepta exon-skippers + Elevidys succeeded under exceptional review pathways with dystrophin surrogate endpoints.
- **Pancreatic cancer (oncology):** P2->P3 modifier 0.65x (~18-24% vs oncology base ~32%). Stromal barrier and lack of validated targets beyond KRAS G12C/D drive consistent late-stage failure; NAPOLI-3 (2023) was a rare positive.
- **Multiple myeloma (hematology):** P2->P3 modifier 1.20x (~48-52% vs heme base ~38%). BCMA CAR-T, BCMA bispecifics, and daratumumab-backbone combinations make late-stage failure rare.
- **NSCLC (oncology):** P2->P3 modifier 0.78x. Crowded TKI/IO space keeps the average below oncology mean despite biomarker selection.

## Layer 2: peak sales caps (TAM and single-drug ceiling)

**Source datasets:**

| Source | Used for | Year |
| --- | --- | --- |
| Company 10-K filings (Merck, AstraZeneca, Pfizer, Lilly, Novo Nordisk, J&J, Vertex, Regeneron, Roche, BMS, and others) | Actual drug-level peak sales for anchor indications | 2024 (full year) |
| EvaluatePharma World Preview 2025 | Indication-level TAM forecasts | 2025 |
| Statista Pharma Market Outlook 2025 | Cross-check on smaller markets | 2025 |
| FiercePharma Top 20 Drugs by Revenue 2024 | Market leader validation | 2024 |

Each entry carries the specific 10-K or analyst source and notes which branded products anchor the ceiling. The `checkPeakSalesCeiling()` helper surfaces two severity levels:

- **Critical** (exceeds 80% of TAM) — the peakSales assumption is physically impossible; engine hard-caps the value.
- **Warning** (exceeds the realistic max single-drug ceiling) — flagged to user but not capped.

### Notable ceilings

- **Friedreich's ataxia:** global TAM $500M, max single drug $300M. Skyclarys is the first approved therapy (Feb 2023) with ~$280M 2024 run-rate — any assumption >$1B gets flagged.
- **NSCLC:** TAM $42B, max single drug $32B (Keytruda at $29.5B actual).
- **HER2+ breast:** TAM $14B, max single drug $10B (Enhertu projected peak).
- **DMD:** orphan population <5K US patients, TAM <$5B.

## Layer 3: revenue curves (launch trajectory)

**Source datasets:**

| Source | Used for | Year |
| --- | --- | --- |
| Actual 2023-2025 launch trajectories (Leqembi, Wegovy, Mounjaro, Zepbound, Trikafta, Skyclarys, Rezdiffra, Dupixent, Ozempic) | Ramp-up and peak-duration assumptions | 2023-2025 |
| Historical long-term trajectories (Herceptin, Enhertu, Keytruda, Opdivo, Ocrevus, Tysabri, Spinraza, Zolgensma) | Peak duration, decline rate, LOE timing | 2017-2024 |
| Company 10-K filings for quarterly revenue recognition | Year-by-year ramp validation | 2024 |

Each entry carries the specific launch case study in the `source` field, and `notes` explaining deviations from the TA default.

### Notable curve shapes

- **DMD / cystic_fibrosis / SMA** (rare blockbuster profile): **2-year ramp, 10-year peak, 5% decline**. Orphan exclusivity + specialist concentration gives the longest peak duration in the database (matches Sarepta + Trikafta).
- **Obesity:** **2-year ramp** (GLP-1 class explosive uptake — Wegovy, Zepbound).
- **Alzheimer's:** **6-year ramp** (slowest in neurology — Leqembi case study shows infrastructure bottleneck: IV infusion, ARIA MRI monitoring, specialist network).
- **NSCLC:** **5-year ramp, 4-year peak** (Keytruda NSCLC 2015-2024 trajectory with biomarker-stratification and sequential line use).
- **Depression:** **3-year ramp, 4-year peak, 30% decline** (fast primary-care uptake but rapid SSRI/SNRI generic pressure — Spravato + Auvelity precedents).

## Layer 4: competitive density (crowding penalty)

**Sources:**

- **ClinicalTrials.gov API** (snapshot 2026-04-10): active Phase 2-3 trial counts by indication.
- **FDA Orange Book:** approved drug counts.
- **EvaluatePharma 2025:** pipeline density cross-check.

Each entry contains `approvedDrugs`, `activeTrials`, a composite `densityScore` (0-1), and a `penetrationMultiplier` applied to peak sales:

- **>1.0** (penalty): heavy competition reduces the asset's share of TAM.
- **<1.0** (boost): under-served indication earns a larger share.

### Notable density settings

- **Breast HER2 (1.40x penalty):** Herceptin, Perjeta, Kadcyla, Enhertu, Tukysa, Phesgo, Margenza, Nerlynx + 200 active trials.
- **NSCLC (1.35x penalty):** Keytruda, Tagrisso, Tecentriq dominate; >250 active IO/TKI/ADC trials.
- **Type 2 diabetes (1.35x penalty):** 30 approved drugs (GLP-1, SGLT2, DPP4, insulin, metformin).
- **NASH/MASH (0.95x, slight boost):** Rezdiffra (resmetirom) is first-in-class (2024); heavy pipeline but only one approval.
- **Friedreich's ataxia (0.80x boost):** Skyclarys only; 15 active trials in an under-served space.
- **Huntington's (0.85x boost):** no disease-modifying approvals; symptomatic-only market (Xenazine, Austedo).

## Validation (Phase 3)

The calibration was validated via four parallel checks:

1. **Golden masters (110 reference calculations):** after the calibration was applied, 28 of 110 reference values drifted past tolerance. All 28 were inspected and confirmed to reflect the intended behavior, then the baseline table was regenerated. See `__tests__/lib/financial-golden-masters.test.ts` header for the detailed notes on affected cases. **Status:** 110/110 passing.

2. **Regression tests (`__tests__/lib/indication-calibration.test.ts`):** 36 behavioral assertions that catch silent reversal of any of the four layers. For example: "Alzheimer's phase2->3 PoS must be <60% of neurology base" and "DMD revenue curve must have <=2y ramp and >=10y peak". **Status:** 36/36 passing.

3. **Comparable deals backtest (`__tests__/lib/comparable-deals-backtest.test.ts`):** 20 curated real deals (2017-2025) with disclosed upfront + total deal value. For each, an rNPV input matching the asset profile was computed and compared to the implied deal terms. **Hit rate within ±35%: 7/20 (35%)**, within ±50%: 8/20 (40%). This is consistent with the academic norm for single-asset rNPV vs real deals (Stewart 2010; Villiger/Bogdan 2005). **Status:** 7/7 backtest assertions passing.

4. **Distribution sanity check (embedded in backtest test file):** ran the rNPV engine across 117 (TA, indication, phase) combinations and verified no outliers beyond 5 standard deviations from the TA mean. **Status:** 0 outliers; all TA distributions are non-degenerate (stddev > 0).

## Known limitations and gaps

1. **Only 50-57 indications calibrated.** The platform supports 562 indications across 12 TAs. Remaining indications fall back to TA-level defaults. Priority for further calibration: hematology subtypes (DLBCL, AML, MDS), infectious disease indications (HIV subtypes, CMV, RSV), women's health, and dermatology.

2. **Structural underpricing of early-stage platform deals.** The comparable deals backtest revealed systematic under-pricing for: (a) multi-asset bundles (Daiichi/Merck 3-ADC), (b) Phase 1 upfronts that exceed intrinsic NPV (PTC/Novartis Huntington's gene therapy), (c) low-PoS CNS programs where rNPV is near-negative at Phase 1 (ABL Bio/GSK, JCR/AZ). These are not calibration errors — they are structural limitations of intrinsic-value rNPV as a deal-pricing model.

3. **TA-level PoS tables are still based on 2024 BIO data.** The indication-specific modifiers sit on top of the TA base rates; if the TA base rate drifts (e.g., oncology average moves when a new class dominates), all indications shift in parallel. Re-baselining the TA tables is a separate project.

4. **Competitive density is a 2026-04-10 snapshot.** Will go stale as the pipeline changes. The `indication-enrichment` cron scans ClinicalTrials.gov weekly but currently populates indication coverage, not density scores. Density refresh should be added to the cron (future work).

5. **No per-geography calibration.** Peak sales caps and revenue curves are global. China-specific, Japan-specific, or EU-specific pricing dynamics are not yet captured.

## Maintenance

- **Updating a modifier:** Edit the entry in the relevant file, add a `notes` explanation for the change, re-run:
  ```
  npx jest __tests__/lib/financial-golden-masters.test.ts
  npx jest __tests__/lib/indication-calibration.test.ts
  npx jest __tests__/lib/comparable-deals-backtest.test.ts
  ```
  Golden masters will drift if the change is material; regenerate via the one-off script documented in the golden-masters test header.

- **Adding a new indication:** Add entries to all four layers (PoS modifier, peak sales cap, revenue curve, competitive density). Even partial coverage is useful — the engine gracefully falls back to TA-level defaults for any missing layer.

- **Verifying calibration integrity:** `lib/financial/indication-pos-modifiers.ts` exports `CALIBRATED_INDICATION_COUNT`; the regression test asserts it is >=50. Similar coverage floors are enforced for the other three layers in `indication-calibration.test.ts`.
