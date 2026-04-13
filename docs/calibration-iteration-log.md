# Calibration Iteration Log — Stage 7

Per-round calibration journey. Each entry captures: what changed, why, and the backtest delta.

The **primary target** is **Core Scope** hit rate: Phase 2/3 licensing + codev deals — the rNPV engine's institutional-valuation sweet spot. Full-scope metrics are reported for transparency but are not the calibration target (see `calibration-diagnostic-report.md` for why early-stage, approved, and acquisition deals are structurally ill-fit).

**Target:** ≥60 / ≥70 / ≥80% at ±25 / ±35 / ±50% on upfront.

Reproduce any round:
```bash
npx tsx scripts/run-deal-backtest.ts
```

---

## Round 0 — Baseline (2026-04-13)

**Change:** None — first measurement after Stage 5 Tier 4 build.
**Flags:** all off.

| Scope | n | ±25% | ±35% | ±50% | mean |err| | median signed | RMSE ($M) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Full | 251 | 6.0% | 8.4% | 15.5% | 298.7% | -92.2% | 6,291 |
| Core (Ph2/3 licensing+codev) | 69 | 13.0% | 14.5% | 30.4% | 156.4% | -51.3% | 613 |

**Core-scope observations:**
- Phase 2 (n=43): median signed -48% — model undershoots licensing deals
- Phase 3 (n=26): median signed +212% — model overshoots (upfront/total ratio too high for late-stage licensing)
- Oncology (n=21): median -2% — remarkably well-calibrated in aggregate; dispersion is the issue
- mAb (n=9): median -25% — closest-to-calibrated modality
- Small molecule (n=19): +140% overshoot
- rnai (n=4): -88%; geneTherapy (n=3): -104% — rare modalities structurally undershoot

**Calibration priorities for subsequent rounds:**
1. Phase-specific upfront/total ratio (Phase 3 ratio is too generous)
2. Peak sales anchors per-indication (replace TA constants)
3. Modality premium for rare platforms (rnai, geneTherapy, mRNA) to correct -100% undershoot
4. Review the `infectiousDisease × dermatology × immunology` overshoot cluster

---

## Round 1 — Core-scope separation (2026-04-13)

**Change:** Split reporting into Core (Phase 2/3 licensing+codev, n=69) and Full (all 251). Added `getCoreScopeBacktestCases()` and separate summaries in `BacktestReport`.

**Why:** Full-scope 60% target is structurally unreachable — early-stage upfronts reflect strategic option value (not NPV), approved-stage deals are royalty-dominant (not upfront-heavy), and acquisitions are bidding-war-priced. Core-scope is where rNPV's intrinsic-value math actually matches how real Phase 2/3 licensing negotiations anchor.

**Flags:** all off.

**Delta:** none to rNPV engine — reporting change only. Core hit rates unchanged (13.0 / 14.5 / 30.4%).

**Files touched:** `lib/financial/backtest/deal-backtest.ts`, `scripts/run-deal-backtest.ts`.

---

## Round 2 — (next round goes here)

Format to follow for each subsequent round:

```
**Change:** <what was tuned — file + specific constant/function>
**Why:** <source-backed justification OR empirical signal from the diagnostic>
**Flags:** <env vars used>
**Source:** <URL / page / date accessed — required by the Option B rigor standard>

**Delta (core scope):**
| metric | before | after | change |
|---|---:|---:|---:|
| ±25% | X% | Y% | ±Z |
| median signed | X% | Y% | ±Z |
| RMSE | $XM | $YM | ±$Z |

**Regressions:** <golden masters, tests, other backtest slices — list any that moved>
```

Rules:
- **Every change cites a source** (FDA CDER, Wong/Siah/Lo, Nature Reviews, index-drugs.ts, live CT.gov, 10-K filing).
- **Re-run the full test suite** before committing: `npm test` must remain at 1333 passing / 5 pre-existing.
- **No silent regressions** — if a core-scope improvement costs a golden master tolerance, call it out and re-baseline the golden master with documentation.
- **Commit each round independently** with the before/after numbers in the commit message so `git log` shows the calibration trajectory.
