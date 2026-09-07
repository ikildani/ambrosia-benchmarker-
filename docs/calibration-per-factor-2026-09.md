# Per-Factor Calibration Study — 2026-09

**Status:** evidence only. No production multiplier was changed by this study.
**Reproduce:** `npm run calibration:per-factor` (raw output: `scripts/calibration/output/per-factor-2026-09.json`).

## Why this exists

The engine (`lib/calculations.ts` → `calculateDealTerms`) prices a deal as

```
total = baselineMedian[TA][phase] × Π multiplier_k ^ exponent_k × dealTypeFactor[dealType][phase]
```

The multipliers in `data/benchmarks.json` (first-in-class 1.25, pivotal-ready 1.15, biomarker-selected 1.15, 1L 1.25, ADC 1.45, US-only 0.55, pancreatic 1.25 …) were expert-set and then constrained by *whole-model* backtest rounds (`docs/calibration-iteration-log.md`). Until now there was no *per-factor* lookback — nothing that said "holding everything else constant, deals with property X closed at Y× the baseline." A customer asked exactly that about the 25% first-in-class premium. This document is the answer, including the honest parts.

## Method

1. **Corpus.** `getAllBacktestCases()` from `lib/financial/backtest/deal-backtest.ts` — the same corpus the whole-model backtest uses: 193 hand-curated deals (`data/comparable-deals-extended.ts`) + 269 production-table deals (`data/comparable-deals-supabase.ts`), de-duplicated, upfront ≥ $20M, fabrication filter applied. **n = 462**, years 2015–2026 (86% from 2020+).
2. **Residual.** For each deal, `r = ln(actual total / engine baseline median)` where the baseline is exactly what the engine would pick for that TA × phase (including the rare-disease gene-therapy / chronic sub-baselines). A second residual uses upfront vs the baseline upfront median.
3. **Model.** Ridge-regularised OLS (λ = 1, intercept unpenalised) of `r` on one-hot dummies for modality, territory, deal type (acquisition split by phase), matched engine indication key, combination-therapy flag, plus **controls**: year fixed effects, TA fixed effects, phase fixed effects, and a `verified` data-quality flag. Reference levels are the engine's 1.0 levels (small molecule, global, licensing, no indication match, 2024, oncology, Phase 2). Because the engine is multiplicative, `exp(β)` is directly comparable to the engine's *applied* value `multiplier ^ exponent`.
4. **Uncertainty.** 95% CI from 200 row-bootstrap resamples (seeded, percentile method). Linear algebra is implemented in the script (no new dependencies).
5. **Verdict rule.** n < 15 → *insufficient n*. Otherwise: engine applied value inside CI → *consistent*; above CI → *engine high*; below CI → *engine low*. Levels with fewer than 5 deals are pooled into a per-family "thin" bucket (engine value = n-weighted geometric mean of members).
6. **Robustness.** The whole model is re-fit on the non-M&A subset (licensing / co-dev / collaboration / option, n = 271), since the licensing baselines were designed around those structures.
7. **Supplementary probe.** `CALIBRATION_DEALS` in `lib/financial/calibration.ts` — 46 hand-labelled deals (reference / no-deal rows excluded) that carry `competitivePosition`, `biomarkerSelected` and `designations`. This is the only source anywhere with first-in-class labels.

Model fit: R² = 0.54 (total), 0.65 (upfront); residual log-RMSE 0.98 (a typical deal still lands within ~×/÷2.7 of the model — deal values are noisy).

## What data was actually available

| Factor input | Backtest corpus | Live `deals` table (1,875 non-synthetic rows, read-only probe) |
|---|---|---|
| Modality, phase, deal type, territory, TA | 100% | 100% |
| Indication (free text) | 100% (342 distinct strings; 69% matched to an engine key) | 87% |
| Combination therapy flag | 3 rows | no column |
| Regulatory designations | 0 | 15 rows (0.8%) |
| Target / mechanism of action | 0 | 19–20% (free text; only 4 corpus rows mention "first-in-class") |
| Biomarker, line of therapy, competitive position, data quality | none | no column |
| Peak-sales consensus | none | 39 corpus rows |

The live table was queried read-only via `scripts/calibration/live-enrichment-coverage.ts` (`npm run calibration:live-coverage`). Its enrichment columns are too sparse to add anything, so the study rests on the static backtest corpus plus the 46-deal labelled set.

## Results

Columns: *implied* = exp(β) on total deal value with 95% CI; *upfront* = exp(β) on upfront; *engine* = configured multiplier; *applied* = multiplier^exponent that the engine actually applies. Verdict is on total deal value.

### Modality (reference: small molecule = 1.00; exponent 1.0)

| Level | n | Implied (total) | 95% CI | Upfront | Engine | Applied | Verdict |
|---|---:|---:|---|---:|---:|---:|---|
| mAb (naked) | 75 | 1.11 | 0.84–1.51 | 1.31 | 1.03 | 1.03 | consistent |
| Gene therapy / editing | 51 | 1.11 | 0.79–1.59 | 1.09 | 0.98 | 0.98 | consistent (non-M&A subset: 1.45, 1.02–1.93 → engine low) |
| Bispecific | 35 | 1.06 | 0.77–1.42 | 1.47 | 1.35 | 1.35 | consistent |
| Pooled thin modalities | 35 | 1.34 | 0.85–1.92 | 1.48 | 1.21 | 1.21 | consistent |
| Peptide | 18 | 0.83 | 0.57–1.28 | 0.67 | 1.05 | 1.05 | consistent |
| RNAi | 15 | 1.57 | 1.01–2.13 | 2.13 | 1.15 | 1.15 | consistent (engine at lower edge) |
| ADC | 12 | 2.43 | 1.47–3.92 | 2.24 | 1.45 | 1.45 | insufficient n — CI excludes engine, watch |
| CAR-T (heme) | 9 | 1.08 | 0.52–2.35 | 1.38 | 1.20 | 1.20 | insufficient n |
| Cell therapy (non-CAR-T) | 9 | 0.71 | 0.40–1.40 | 0.82 | 1.15 | 1.15 | insufficient n |
| mRNA | 9 | 1.44 | 0.64–2.93 | 2.29 | 1.30 | 1.30 | insufficient n |
| Oligonucleotide | 9 | 1.16 | 0.67–1.86 | 0.92 | 1.18 | 1.18 | insufficient n |
| PROTAC | 6 | 1.13 | 0.70–1.53 | 1.16 | 1.35 | 1.35 | insufficient n |
| Radiopharmaceutical | 5 | 1.08 | 0.59–1.84 | 1.50 | 1.60 | 1.60 | insufficient n |

### Territory (reference: global = 1.00; exponent 1.0)

| Level | n | Implied (total) | 95% CI | Upfront | Engine | Applied | Verdict |
|---|---:|---:|---|---:|---:|---:|---|
| ex-China | 20 | 1.34 | 0.97–1.80 | 0.86 | — | — | no engine value (engine silently applies 1.0 to unknown keys) |
| ex-US | 18 | 0.74 | 0.40–1.21 | 0.89 | 0.45 | 0.45 | consistent (non-M&A subset 1.09, 0.63–1.79 → engine low) |
| Greater China | 11 | 0.72 | 0.37–1.60 | 0.31 | 0.12 | 0.12 | insufficient n — CI excludes engine |
| US only | 9 | 1.02 | 0.60–1.82 | 0.78 | 0.55 | 0.55 | insufficient n |
| Europe | 8 | 0.78 | 0.45–1.38 | 0.68 | 0.25 | 0.25 | insufficient n — CI excludes engine |
| Japan | 7 | 0.39 | 0.23–0.86 | 0.34 | 0.09 | 0.09 | insufficient n — CI excludes engine |
| Pooled thin (N. America, APAC, regional) | 7 | 0.73 | 0.43–1.32 | 0.39 | 0.06 | 0.06 | insufficient n |

Every regional level lands well above its engine discount. This is partly real and partly selection: the corpus keeps only deals with ≥ $20M upfront, so a China-only deal priced at 12% of a global baseline is mostly filtered out before we see it. Treat the *direction* as a signal, not the magnitude.

### Deal type (reference: licensing = 1.00; phase-specific engine factor)

| Level | n | Implied (total) | 95% CI | Upfront* | Engine | Verdict |
|---|---:|---:|---|---:|---:|---|
| Collaboration (all phases) | 80 | 1.08 | 0.82–1.35 | 1.14 | 0.53 (n-weighted) | **engine low** |
| Acquisition @ approved | 58 | 2.47 | 1.55–3.96 | 7.25 | 1.65 | consistent |
| Acquisition @ Phase 2 | 50 | 1.65 | 1.24–2.24 | 7.66 | 0.90 | **engine low** |
| Acquisition @ Phase 3 | 36 | 2.34 | 1.61–3.58 | 9.10 | 1.35 | **engine low** |
| Acquisition @ Phase 1 | 29 | 1.05 | 0.77–1.49 | 5.87 | 0.60 | **engine low** |
| Acquisition @ preclinical | 18 | 1.27 | 0.75–2.08 | 10.18 | 0.60 | **engine low** |
| Option | 17 | 0.93 | 0.63–1.44 | 1.09 | 0.66 | consistent |
| Co-development | 16 | 1.21 | 0.69–1.98 | 1.33 | 0.80 | consistent |
| Reformulation | 1 | — | — | — | 0.55 | insufficient n |

\* Upfront ratios for non-licensing structures are set separately in the engine (`dealTypeUpfrontOverrides`: acquisitions 70–95% upfront), so the upfront column is not comparable to the total-value factor for this family; verdicts use total value only.

Acquisitions are priced against the *licensing* biobucks baseline, and the corpus says an acquired Phase 2 asset closes at ~1.65× the licensing baseline, not 0.90×. This matches the whole-model backtest's long-standing note that M&A carries bidding-war premiums the rNPV path cannot see. The collaboration finding has the same caveat as territory: only collaborations large enough to disclose ≥ $20M upfront enter the corpus, so the 0.53 engine factor may be right for the *median* collaboration and wrong for the *disclosed* one.

### Indication (reference: no engine key match = 1.00; exponent 0.80–0.90 by TA)

| Level | n | Implied (total) | 95% CI | Upfront | Engine | Applied | Verdict |
|---|---:|---:|---|---:|---:|---:|---|
| Pooled thin (52 matched keys, < 5 deals each) | 142 | 0.97 | 0.77–1.16 | 1.05 | 1.19 | 1.15 | consistent (upper edge; non-M&A subset 0.86, 0.67–1.13 → engine high) |
| Atopic dermatitis | 14 | 1.05 | 0.69–1.54 | 0.89 | 1.30 | 1.24 | insufficient n |
| Cardiomyopathy | 12 | 1.38 | 0.77–2.36 | 1.67 | 1.22 | 1.18 | insufficient n |
| NASH / MASH | 10 | 1.16 | 0.57–1.90 | 1.22 | 1.30 | 1.25 | insufficient n |
| Sickle cell | 10 | 0.60 | 0.30–1.20 | 0.49 | 1.36 | 1.28 | insufficient n — CI excludes engine |
| Ulcerative colitis | 10 | 1.63 | 0.71–2.94 | 1.96 | 1.25 | 1.20 | insufficient n |
| Alzheimer's | 9 | 1.27 | 0.81–1.86 | 0.87 | 1.30 | 1.27 | insufficient n |
| Psoriasis | 9 | 1.16 | 0.48–2.06 | 1.40 | 1.17 | 1.13 | insufficient n |
| Hemophilia B | 7 | 0.39 | 0.20–0.78 | 0.51 | 1.22 | 1.17 | insufficient n — CI excludes engine |
| IBD (broad) | 7 | 0.83 | 0.48–1.42 | 0.94 | 1.18 | 1.15 | insufficient n |
| Migraine | 7 | 0.87 | 0.26–2.01 | 1.09 | 1.05 | 1.04 | insufficient n |
| Myeloma | 6 | 2.14 | 0.95–5.72 | 2.00 | 1.28 | 1.22 | insufficient n |
| Obesity | 6 | 1.06 | 0.65–1.48 | 0.87 | 1.35 | 1.29 | insufficient n |
| Parkinson's | 6 | 1.08 | 0.70–1.61 | 0.88 | 1.20 | 1.18 | insufficient n |
| SLE / lupus | 6 | 0.85 | 0.54–1.56 | 1.01 | 1.25 | 1.21 | insufficient n |
| COVID | 5 | 1.15 | 0.65–1.97 | 1.16 | 0.90 | 0.91 | insufficient n |
| DLBCL | 5 | 2.10 | 1.00–3.95 | 1.47 | 1.15 | 1.12 | insufficient n |
| Dry AMD / GA | 5 | 1.75 | 0.91–3.17 | 2.23 | 1.30 | 1.27 | insufficient n |
| Endometriosis | 5 | 0.88 | 0.48–1.55 | 0.67 | 1.22 | 1.18 | insufficient n |
| Menopause | 5 | 0.28 | 0.16–0.63 | 0.39 | 1.15 | 1.13 | insufficient n — CI excludes engine |
| Myelofibrosis | 5 | 0.83 | 0.50–1.48 | 0.86 | 1.28 | 1.22 | insufficient n |

No single indication reaches n = 15. The one identifiable statement is about the *class*: across 142 matched indications the average premium is ~0.97× vs an engine average of 1.15×, i.e. the indication layer as a whole is slightly generous (borderline in the full corpus, "engine high" on the non-M&A subset). The pancreatic 1.25 the customer might ask about has 1 deal in the corpus.

### Phase-adjacent flags

| Level | n | Implied (total) | 95% CI | Engine | Applied | Verdict |
|---|---:|---:|---|---:|---:|---|
| Combination therapy flagged (≈ engine "some combo potential") | 3 | 1.46 | 0.97–2.29 | 1.10 | 1.08 | insufficient n |
| `verified` = true (data-quality control) | 141 | 1.14 | 0.93–1.36 | — | — | control |

### Supplementary: enrichment factors on the 46 hand-labelled deals

Only `CALIBRATION_DEALS` carries competitive-position / biomarker / designation labels. Same model (ridge, bootstrap), with acquisition and phase-bucket controls. Labels were assigned by us, largely on well-known headline deals, so this is a sanity check rather than an independent measurement.

| Factor | Level | n | Implied (total) | 95% CI | Engine | Applied | Verdict |
|---|---|---:|---:|---|---:|---:|---|
| Competitive position | first-in-class | 18 | 1.72 | 1.21–2.41 | 1.25 | 1.17 (^0.7) | engine low (hand-labelled set) |
| Competitive position | best-in-class | 5 | 1.35 | 0.57–2.60 | 1.10 | 1.07 | insufficient n |
| Biomarker | selected | 7 | 2.15 | 1.00–4.03 | 1.15 | 1.13 (^0.9) | insufficient n |
| Designation | breakthrough | 6 | 0.91 | 0.46–1.91 | +12% | 1.12 | insufficient n |
| Designation | fast track | 7 | 0.62 | 0.47–0.99 | +6% | 1.06 | insufficient n — CI excludes engine |
| Designation | orphan | 4 | 1.04 | 0.53–1.85 | +8% | 1.08 | insufficient n |

So the honest answer to "how did you get 25% for first-in-class?" is: it was expert-set; the only labelled lookback we have (18 first-in-class deals) says the premium is *at least* that large (lower CI bound 1.21 on the applied value, vs 1.17 applied today), but the sample is small and biased toward famous deals, so we do not treat it as a measurement of the number.

### Baseline diagnostics (fixed-effect controls)

These are not engine multipliers, but they tell us where the residual actually lives.

| Control | Level | n | Implied scale vs reference | 95% CI |
|---|---|---:|---:|---|
| Phase (ref Phase 2) | preclinical | 98 | 2.85 | 2.19–3.83 |
| | Phase 1 | 89 | 1.81 | 1.35–2.58 |
| | Phase 3 | 74 | 0.54 | 0.39–0.81 |
| | approved | 93 | 0.32 | 0.23–0.47 |
| TA (ref oncology) | infectious disease | 31 | 0.44 | 0.26–0.68 |
| | ophthalmology | 27 | 0.40 | 0.28–0.60 |
| | dermatology | 23 | 0.40 | 0.26–0.65 |
| | gastroenterology | 24 | 0.54 | 0.35–0.91 |
| | hematology | 30 | 0.57 | 0.33–0.90 |
| | women's health | 22 | 0.62 | 0.41–0.97 |
| | cardiovascular / neurology / rare / metabolic / immunology | 22–56 | 0.79–1.09 | all include 1.0 |
| Year (ref 2024) | 2020 | 42 | 1.51 | 1.07–2.08 |
| | 2025 | 37 | 1.49 | 1.05–2.32 |
| | 2021–2023, 2026 | 33–84 | 1.10–1.28 | all include 1.0 |

Two things stand out. First, the phase gradient of the baselines is far steeper than the corpus: relative to Phase 2, disclosed preclinical deals close at ~2.9× their baseline median and approved deals at ~0.3×. The ≥ $20M upfront floor inflates the early-stage side (small preclinical deals never enter), but the approved-stage undershoot is real and matches the whole-model backtest. Second, the infectious-disease, ophthalmology and dermatology baselines are about 2.5× above observed deal values — again consistent with the TA overshoots logged in `calibration-iteration-log.md`. The multiplier layer cannot fix either of these; they are baseline-level questions.

## Why several factors cannot be identified from this corpus (for the BD reader)

A regression can only measure a factor when the corpus records it *and* it varies independently of the other factors. Neither condition holds for most of the engine's enrichment layer:

- **Nobody recorded it.** First-in-class vs racing, biomarker selection, line of therapy, data quality, combination potential, and the TA-specific dials (BBB penetration, disease severity, resistance profile, and so on) are things an analyst knows about an asset but that never appear in an 8-K or press release in structured form. Our live deal table has no columns for them, and its free-text fields mention "first-in-class" in 4 of 221 corpus deals. Regulatory designations exist as a column but are populated on 0.8% of rows. You cannot regress on a variable you do not have.
- **Too few deals per cell.** Even for fields we do have, the corpus splits 462 deals across 13 TAs × 5 phases × 20 modalities × 70+ indications. A single indication rarely has more than 10 deals, and a 95% interval on 10 noisy deals spans roughly 0.5×–2×, which is wider than any premium the engine applies. That is why every indication row reads "insufficient n" and why territory rows do too.
- **Factors travel together.** Gene therapy deals are mostly rare disease; radiopharmaceuticals are all oncology; ADCs are almost all oncology Phase 1–2; approved-stage deals are mostly acquisitions (correlation 0.75 between the two dummies). When two labels always appear together, the model cannot tell which one is doing the work; ridge regularisation splits the credit and shrinks both toward 1.0, which is the conservative thing to do but means "consistent" verdicts on those rows are weak evidence, not strong.
- **The corpus is filtered by size.** Deals enter only with ≥ $20M disclosed upfront. That removes most single-territory, option, collaboration and preclinical deals that closed small, so the survivors look larger than the population. Findings that say "engine low" on those structures are directionally credible but the magnitude is biased upward.

Unidentifiable from any available data (no observations at all): competitive position, data quality, biomarker, line of therapy, combination potential (3 rows), regulatory designations, every TA-specific enrichment dial, and the sub-territory keys (Canada, Australia, South Korea, LatAm, MENA, US+EU, US+Japan). The full list with reasons is in the JSON under `unidentifiable`.

## Recommended changes for the next calibration round

Rule applied: CI excludes the engine value **and** n ≥ 15. Proposed values sit at the conservative end of the CI because of the size-selection bias above. These are proposals for the next whole-model backtest round, not edits made here.

| Factor | Current | Implied (95% CI) | n | Proposed | Note |
|---|---:|---:|---:|---:|---|
| Acquisition factor @ Phase 2 | 0.90 | 1.65 (1.24–2.24) | 50 | 1.25 | lower CI bound |
| Acquisition factor @ Phase 3 | 1.35 | 2.34 (1.61–3.58) | 36 | 1.60 | lower CI bound |
| Acquisition factor @ Phase 1 | 0.60 | 1.05 (0.77–1.49) | 29 | 0.80 | lower CI bound |
| Acquisition factor @ preclinical | 0.60 | 1.27 (0.75–2.08) | 18 | 0.75 | lower CI bound; n just above threshold |
| Collaboration factor (phase table) | 0.30–0.90 (corpus-weighted 0.53) | 1.08 (0.82–1.35) | 80 | scale table ×1.5 (→ corpus-weighted ≈ 0.80) | lower CI bound; verify against small-collab population before adopting |
| Competitive position: first-in-class | 1.25 (applied 1.17) | 1.72 (1.21–2.41) | 18 | hold; at most 1.25 → 1.30 | hand-labelled set only; label 30+ corpus deals first |

Watch list (CI excludes engine but n < 15 — do not act, collect data): ADC 1.45 (implied 2.43, n = 12), Greater China 0.12 (0.72, n = 11), Europe 0.25 (0.78, n = 8), Japan 0.09 (0.39, n = 7), sickle cell 1.28 applied (0.60, n = 10), hemophilia B 1.17 applied (0.39, n = 7), menopause 1.13 applied (0.28, n = 5), fast-track +6% (0.62, n = 7). The three rare-disease indications point the same way as the post-2022 gene-therapy reset already noted in `CALIBRATION_DEALS`.

Baseline-level items surfaced by the controls (route to the baseline owners, not the multiplier layer): phase gradient too steep at both ends; infectious-disease, ophthalmology and dermatology baselines ~2.5× high; `ex_china` and `north_america` territory codes exist in the corpus but not in `benchmarks.territories`, so the engine applies 1.0 to them silently.

## What would make the next round better

1. Label competitive position, biomarker selection and line of therapy on the ~450 corpus deals (one analyst-week). That alone makes the top three customer-facing multipliers measurable.
2. Backfill `regulatory_designations` from FDA/EMA lists for corpus assets (target/INN already present on 20% of rows).
3. Run the regression with the ≥ $20M floor lowered to $5M as a sensitivity, to bound the selection effect on territory and collaboration.

## Files

- `scripts/calibration/per-factor-regression.ts` — the study (`npm run calibration:per-factor`)
- `scripts/calibration/live-enrichment-coverage.ts` — read-only probe of live enrichment coverage (`npm run calibration:live-coverage`)
- `scripts/calibration/output/per-factor-2026-09.json` — raw coefficients, CIs, collinearity partners, robustness fit, supplementary probe
- `lib/config/constants.ts` → `PER_FACTOR_CALIBRATION_STUDY` — pointer for product surfaces that cite the study
