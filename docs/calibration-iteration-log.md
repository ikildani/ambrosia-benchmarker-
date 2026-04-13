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

## Round 2 — Phase 3 upfront ratio tightening (2026-04-13)

**Change:** `getUpfrontPercent()` in `lib/financial/rnpv-engine.ts:1482` — phase3 median 0.30 → 0.22 (plus small adjustments to phase2_3, nda_filed, approved to preserve monotonicity). Phase 1 / phase 1_2 / phase 2 left intact.

**Why:** Core-scope Round 0 showed Phase 3 median signed error +212%. The 30% ratio was calibrated in 2024 from DealForma deal-type research but not reconciled against the 251-deal empirical distribution. Lowering the band moves Phase 3 predictions down, correcting the overshoot.

**Source:** Empirical — 251-deal backtest `__tests__/backtest/baseline-errors.json` + Option B methodology ("iterate until the model accurately predicts real deals"). No new external citation since the change stays within prior-documented DealForma/BioCentury 20-40% range (just recenters the median to 22 from 30).

**Flags:** all off.

**Delta (core scope):**

| metric | Round 1 | Round 2 | change |
|---|---:|---:|---:|
| Total deals scored | 69 | 69 | — |
| ±25% | 13.0% | 13.0% | 0 |
| ±35% | 14.5% | 15.9% | +1.4pp |
| ±50% | 30.4% | 27.5% | -2.9pp |
| Mean \|error\| | 156.4% | 129.3% | -27.1pp |
| Median signed | -51.3% | -64.2% | -12.9pp |
| RMSE ($M) | 612.8 | 608.9 | -3.9 |

**Regressions:** None new. Golden masters all 110 stable. 20-deal comparable-deals-backtest.test.ts has same 2 pre-existing failures (hit rate 0.20/0.35 vs targets 0.35/0.40) — unchanged by this round because it tests total deal value, not upfront.

**Reading:** The ratio cut reduces the right tail of Phase 3 overshoots (pulling mean |error| down 27pp) but also shifts more deals into undershooting territory, pushing the median signed error more negative. ±25% didn't move because the deals on the margin had errors large enough that a 27% ratio reduction didn't pull them under ±25%. ±35% improved marginally. ±50% regressed because some previously-in-band deals fell out via the same mechanism.

**Takeaway for Round 3+:** The upfront ratio lever alone is saturated — further tightening would amplify the undershoot without winning more hits. Next rounds need to attack the magnitude of Phase 2 undershoots (median -48% pre-Round-2, now -64%) and the platform-modality gap (rnai/geneTherapy/mRNA all ~-100%).

---

## Round 3 — (next round goes here)

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
