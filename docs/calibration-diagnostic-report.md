# Calibration Diagnostic Report — Option B Baseline

**Generated:** 2026-04-13 (Stage 6, all feature flags off)
**Framework:** `lib/financial/backtest/deal-backtest.ts` → `scripts/run-deal-backtest.ts` → `__tests__/backtest/baseline-errors.json`
**Deals scored:** 251 from `data/comparable-deals-extended.ts` (real disclosed licensing / acquisition / co-dev deals 2017-2026 with both upfront and total value published)

## Baseline headline numbers

| Metric | Baseline | Stage 7 target |
|---|---:|---:|
| Hit rate ±25% of actual upfront | **6.0%** | ≥60% |
| Hit rate ±35% of actual upfront | **8.4%** | ≥70% |
| Hit rate ±50% of actual upfront | **15.5%** | ≥80% |
| Mean absolute error (upfront %) | 298.7% | — |
| Median signed error (upfront %) | -92.2% | within ±20% |
| RMSE on upfront ($M) | 6,291.3 | — |

**Interpretation**: the model is currently uncalibrated for deal pricing — it mostly under-predicts (median -92% signed error) with a long tail of massive overshoots on specific segments (mAb, approved assets). This is the gap the Option B iteration process closes.

## Systematic biases — heat map

### By therapeutic area (sorted by sample size)

| TA | n | hit25% | hit35% | mean signed | diagnosis |
|---|---:|---:|---:|---:|---|
| oncology | 74 | 4.1% | 6.8% | -51% | model undervalues oncology deals (peak sales too low?) |
| cardiovascular | 23 | 4.3% | 4.3% | **+87%** | model overvalues CV (TA peak sales anchor too high) |
| immunology | 21 | 4.8% | 9.5% | **+1153%** | massive overshoot — driven by mAb anchor on Humira-class |
| rareDisease | 20 | 5.0% | 5.0% | -72% | orphan pricing not captured |
| hematology | 17 | 0.0% | 5.9% | **+551%** | overshoots (similar mAb effect) |
| infectiousDisease | 16 | 0.0% | 0.0% | +135% | model runs too hot |
| dermatology | 16 | 12.5% | 12.5% | +16% | closest-to-calibrated TA |
| gastroenterology | 14 | 14.3% | 21.4% | -58% | — |
| ophthalmology | 11 | 9.1% | 9.1% | **+358%** | anchor too high |
| womensHealth | 11 | 18.2% | 18.2% | +295% | — |
| neurology | 11 | 9.1% | 9.1% | -72% | Alzheimer's-class deals under-predicted |
| metabolic | 7 | 14.3% | 28.6% | -14% | best-calibrated TA (GLP-1 era) |

### By phase

| Phase | n | hit25% | hit35% | mean signed | diagnosis |
|---|---:|---:|---:|---:|---|
| phase2 | 71 | 9.9% | 12.7% | -61% | model undervalues Phase 2 |
| phase1 | 49 | 2.0% | 2.0% | -97% | worst-calibrated phase — early-stage upfronts are strategic, not NPV-based |
| preclinical | 46 | 0.0% | 0.0% | -110% | model produces negative rNPV; acquirers still pay upfront |
| approved | 46 | 4.3% | 13.0% | **+1034%** | model radically overvalues approved assets |
| phase3 | 39 | 12.8% | 12.8% | +134% | — |

### By modality (top 10)

| Modality | n | hit25% | hit35% | mean signed | diagnosis |
|---|---:|---:|---:|---:|---|
| smallMolecule | 75 | 12.0% | 14.7% | +289% | — |
| geneTherapy | 20 | 0.0% | 0.0% | -107% | one-time pricing model missing |
| mab | 19 | 10.5% | 10.5% | **+1324%** | severe anchor-too-high problem |
| antibody | 17 | 0.0% | 5.9% | -51% | — |
| adc | 16 | 0.0% | 0.0% | 0% | bimodal — median near zero but high variance |
| bispecific | 15 | 6.7% | 20.0% | -77% | — |
| rnai | 11 | 0.0% | 0.0% | -103% | — |
| radiopharmaceutical | 8 | 0.0% | 0.0% | -103% | — |
| protac | 7 | 0.0% | 0.0% | -119% | Phase 1 dominant → same attrition issue as phase1 above |
| peptide | 7 | 0.0% | 0.0% | -18% | — |

## Ten worst-predicted deals (|upfront error|)

| Year | Licensor → Licensee | TA | Phase | Modality | Actual upfront | Predicted | Error |
|---|---|---|---|---|---:|---:|---:|
| 2023 | Pharming Group → CSPC | immunology | approved | mab | $15M | $3,666M | +24,340% |
| 2023 | Rigel → Kissei | hematology | approved | smallMolecule | $17M | $1,810M | +10,547% |
| 2022 | Tarsus → Samsung | ophthalmology | approved | smallMolecule | $30M | $1,199M | +3,897% |
| 2024 | Agepha → Grünenthal | cardiovascular | approved | smallMolecule | $45M | $1,753M | +3,796% |
| 2024 | Theratechnologies → TaiMed | infectiousDisease | approved | mab | $75M | $1,187M | +1,483% |
| 2020 | ObsEva → XOMA | womensHealth | phase3 | smallMolecule | $15M | $228M | +1,420% |
| 2020 | TherapeuticsMD → AbbVie | womensHealth | approved | smallMolecule | $50M | $726M | +1,352% |
| 2023 | Almirall → AbbVie | immunology | phase3 | smallMolecule | $50M | $614M | +1,128% |
| 2023 | Epizyme → Ipsen | oncology | approved | smallMolecule | $247M | $2,906M | +1,077% |
| 2023 | CSPC → Elevar | oncology | phase3 | adc | $60M | $502M | +737% |

## Systematic limitations (do NOT try to calibrate away)

- **Platform / multi-asset deals**: rNPV models one asset, real deals bundle N assets plus a platform premium.
- **Ex-US / geographic-limited licenses**: upfronts reflect territorial scope (e.g., Japan-only is ~8-15% of global value). The model anchors to global peak sales unless the input specifies territory.
- **Strategic acquisitions**: priced on bidding war, not intrinsic NPV. Carmot (Roche), Inversago (Novo) are 10-30x NPV multiples.
- **Approved-asset licenses with tiny upfronts**: these are usually commercialization handoffs where the bulk of value is royalties, not upfront.

## Calibration priorities for Stage 7

Sequenced by highest-leverage signal:

1. **mAb anchor** — the peak-sales heuristic (`PEAK_SALES_BY_TA_M.immunology = 3000`) is producing $1B+ overshoots on every mAb deal. Either:
   - Tighten the anchor by TA × modality (immunology × mAb ≠ immunology × smallMolecule)
   - Use per-deal peak sales from the source table when available

2. **Approved-asset overshoot** — the model doesn't know that post-approval deals are commercialization-phase where most value accrues via royalties. The 46 approved deals need a distinct pricing model (or the deal_type flow + terms need to differ by stage).

3. **Phase 1 / preclinical undershoot** — these early-stage deals are strategic options; real upfronts are 5-20× intrinsic NPV. The current PoS cascade correctly says "expected value is near zero," but market clearing prices include option value that rNPV doesn't capture.

4. **Geographic territory scaling** — ex-US deals should scale peak sales and deal math by territorial share (reference `lib/financial/geographic-revenue-curves.ts` — already built in Tier 2).

5. **Flag A/B test loop** — after the above fixes, re-run with each TIER2_* / TIER4_* flag individually to measure improvement. The one that tightens hit rate most at ±25% should be promoted first.

## Reproducing this report

```bash
# All flags off — baseline
npx tsx scripts/run-deal-backtest.ts

# Each flag individually (Stage 7 A/B loop)
TIER2_TIME_WINDOWED_POS=on npx tsx scripts/run-deal-backtest.ts
TIER2_COMBO_THERAPY=on npx tsx scripts/run-deal-backtest.ts
TIER4_SUBPOP=on npx tsx scripts/run-deal-backtest.ts
TIER4_PATENT_CLIFFS=on npx tsx scripts/run-deal-backtest.ts

# All flags on
TIER2_TIME_WINDOWED_POS=on TIER2_COMBO_THERAPY=on TIER2_GEO_DECOMP=on \
  TIER4_RISK_DECOMP=on TIER4_MACRO=on TIER4_SUBPOP=on TIER4_PATENT_CLIFFS=on \
  npx tsx scripts/run-deal-backtest.ts
```

Output is a full JSON report at `__tests__/backtest/baseline-errors.json` plus a console summary. The JSON is version-controlled — Stage 7 commits update it round-by-round and the diff shows calibration progress.
