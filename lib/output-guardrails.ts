import type { CalculationResult, CalculationInput, Phase, DealType } from './calculations';

export interface GuardrailWarning {
  severity: 'info' | 'warning' | 'critical';
  field: string;
  message: string;
  suggestedAction?: string;
}

// Phase-appropriate total deal value bounds ($M)
const PHASE_VALUE_BOUNDS: Record<Phase, { min: number; max: number }> = {
  discovery:   { min: 5,    max: 200 },
  preclinical: { min: 15,   max: 800 },
  phase1:      { min: 30,   max: 2000 },
  phase1_2:    { min: 50,   max: 3000 },
  phase2:      { min: 100,  max: 8000 },
  phase2_3:    { min: 200,  max: 12000 },
  phase3:      { min: 500,  max: 25000 },
  nda_filed:   { min: 1000, max: 35000 },
  approved:    { min: 2000, max: 80000 },
};

export function validateCalculationOutput(
  result: CalculationResult,
  input: CalculationInput
): GuardrailWarning[] {
  const warnings: GuardrailWarning[] = [];
  const { terms, tieredRoyalties } = result;
  const dealType = input.dealType ?? 'licensing';

  // ── 1. Phase-Appropriate Value Bounds ──
  checkPhaseBounds(warnings, terms.totalDealValue.median, input.phase);

  // ── 2. Upfront Ratio Sanity ──
  checkUpfrontRatio(warnings, terms, dealType);

  // ── 3. Milestone Sanity ──
  checkMilestones(warnings, terms, dealType);

  // ── 4. Royalty Sanity ──
  checkRoyalties(warnings, tieredRoyalties, dealType);

  // ── 5. Cross-Validation ──
  checkCrossValidation(warnings, result);

  return warnings;
}

// ── Rule 1: Phase-Appropriate Value Bounds ──
function checkPhaseBounds(
  warnings: GuardrailWarning[],
  totalMedian: number,
  phase: Phase
): void {
  const bounds = PHASE_VALUE_BOUNDS[phase];
  if (!bounds) return;

  if (totalMedian < bounds.min) {
    warnings.push({
      severity: 'critical',
      field: 'totalDealValue',
      message: `Total deal value ($${totalMedian.toFixed(0)}M) is below the typical floor of $${bounds.min}M for ${formatPhase(phase)} assets.`,
      suggestedAction: 'Verify inputs — the modality or indication modifiers may be too aggressive.',
    });
  } else if (totalMedian > bounds.max) {
    warnings.push({
      severity: 'critical',
      field: 'totalDealValue',
      message: `Total deal value ($${totalMedian.toFixed(0)}M) exceeds the typical ceiling of $${bounds.max.toLocaleString()}M for ${formatPhase(phase)} assets.`,
      suggestedAction: 'This is rare but possible for transformative assets. Review modifiers for over-stacking.',
    });
  }
}

// ── Rule 2: Upfront Ratio Sanity ──
function checkUpfrontRatio(
  warnings: GuardrailWarning[],
  terms: CalculationResult['terms'],
  dealType: DealType
): void {
  const upfrontMedian = terms.upfront.median;
  const totalMedian = terms.totalDealValue.median;

  if (totalMedian <= 0) return;

  // Upfront should never exceed total
  if (upfrontMedian > totalMedian) {
    warnings.push({
      severity: 'critical',
      field: 'upfront',
      message: 'Upfront payment exceeds total deal value, which is mathematically impossible.',
      suggestedAction: 'This indicates a calculation error. Please try adjusting inputs.',
    });
    return;
  }

  const upfrontPct = (upfrontMedian / totalMedian) * 100;

  // General bounds
  if (upfrontPct < 3) {
    warnings.push({
      severity: 'warning',
      field: 'upfront',
      message: `Upfront is only ${upfrontPct.toFixed(1)}% of total deal value. Deals below 3% upfront are extremely uncommon.`,
      suggestedAction: 'Consider whether the deal type and phase are correctly specified.',
    });
  } else if (upfrontPct > 98) {
    warnings.push({
      severity: 'warning',
      field: 'upfront',
      message: `Upfront is ${upfrontPct.toFixed(1)}% of total deal value, leaving almost no room for milestones.`,
    });
  }

  // Acquisition-specific: upfront should be >50%
  if (dealType === 'acquisition' && upfrontPct < 50) {
    warnings.push({
      severity: 'warning',
      field: 'upfront',
      message: `For acquisitions, upfront is typically >50% of total value. Current: ${upfrontPct.toFixed(0)}%.`,
      suggestedAction: 'Acquisition deals usually have majority cash at close with CVR for remainder.',
    });
  }

  // Collaboration-specific: upfront should be <40%
  if (dealType === 'collaboration' && upfrontPct > 40) {
    warnings.push({
      severity: 'info',
      field: 'upfront',
      message: `For collaborations, upfront above 40% (current: ${upfrontPct.toFixed(0)}%) is unusual — most value is in milestones and royalties.`,
    });
  }
}

// ── Rule 3: Milestone Sanity ──
function checkMilestones(
  warnings: GuardrailWarning[],
  terms: CalculationResult['terms'],
  dealType: DealType
): void {
  const dev = terms.devMilestones.median;
  const reg = terms.regMilestones.median;
  const comm = terms.commMilestones.median;

  // No negative milestones
  if (dev < 0 || reg < 0 || comm < 0) {
    warnings.push({
      severity: 'critical',
      field: 'milestones',
      message: 'One or more milestone values are negative, which is invalid.',
      suggestedAction: 'This indicates a calculation error. Please try different inputs.',
    });
  }

  // Dev + Reg + Comm should approximately equal (total - upfront)
  const totalMedian = terms.totalDealValue.median;
  const upfrontMedian = terms.upfront.median;
  if (totalMedian > 0 && upfrontMedian >= 0) {
    const expectedMilestones = totalMedian - upfrontMedian;
    const actualMilestones = dev + reg + comm;
    if (expectedMilestones > 0) {
      const divergence = Math.abs(actualMilestones - expectedMilestones) / expectedMilestones;
      if (divergence > 0.05) {
        warnings.push({
          severity: 'warning',
          field: 'milestones',
          message: `Milestone sum ($${actualMilestones.toFixed(0)}M) diverges from total minus upfront ($${expectedMilestones.toFixed(0)}M) by ${(divergence * 100).toFixed(0)}%.`,
        });
      }
    }
  }

  // Acquisition-specific: commercial milestones (CVRs) should be the largest category
  if (dealType === 'acquisition' && (dev > 0 || reg > 0 || comm > 0)) {
    if (comm < dev || comm < reg) {
      warnings.push({
        severity: 'info',
        field: 'commMilestones',
        message: 'For acquisitions, commercial milestones (CVRs) are typically the largest milestone category.',
      });
    }
  }
}

// ── Rule 4: Royalty Sanity ──
function checkRoyalties(
  warnings: GuardrailWarning[],
  royalties: CalculationResult['tieredRoyalties'],
  dealType: DealType
): void {
  const baseMid = (royalties.base.low + royalties.base.high) / 2;
  const midMid = (royalties.midTier.low + royalties.midTier.high) / 2;
  const highMid = (royalties.highTier.low + royalties.highTier.high) / 2;

  // Acquisitions should have 0% royalties
  if (dealType === 'acquisition') {
    if (baseMid > 0 || midMid > 0 || highMid > 0) {
      warnings.push({
        severity: 'warning',
        field: 'royalties',
        message: 'Acquisitions typically have 0% royalties since the buyer owns the asset outright.',
      });
    }
    return; // Skip remaining royalty checks for acquisitions
  }

  // Non-acquisitions should have >0% royalties
  if (baseMid <= 0 && midMid <= 0 && highMid <= 0) {
    warnings.push({
      severity: 'warning',
      field: 'royalties',
      message: `${dealType} deals typically include royalties. All tiers are showing 0%.`,
    });
  }

  // No tier should exceed 35%
  if (royalties.highTier.high > 35) {
    warnings.push({
      severity: 'warning',
      field: 'royalties',
      message: `High-tier royalty ceiling (${royalties.highTier.high.toFixed(1)}%) exceeds 35%, which is extremely rare in biopharma licensing.`,
    });
  }

  // Tiers should be monotonically increasing
  if (baseMid > midMid || midMid > highMid) {
    warnings.push({
      severity: 'warning',
      field: 'royalties',
      message: 'Royalty tiers are not monotonically increasing (base < mid < high). This is atypical.',
    });
  }
}

// ── Rule 5: Cross-Validation ──
function checkCrossValidation(
  warnings: GuardrailWarning[],
  result: CalculationResult
): void {
  const { terms } = result;

  // Total deal value ordering: low < median < high
  if (terms.totalDealValue.low > terms.totalDealValue.median ||
      terms.totalDealValue.median > terms.totalDealValue.high) {
    warnings.push({
      severity: 'critical',
      field: 'totalDealValue',
      message: 'Total deal value range is not ordered correctly (low < median < high).',
      suggestedAction: 'This indicates a calculation error.',
    });
  }

  // Upfront ordering: low < median < high
  if (terms.upfront.low > terms.upfront.median ||
      terms.upfront.median > terms.upfront.high) {
    warnings.push({
      severity: 'critical',
      field: 'upfront',
      message: 'Upfront payment range is not ordered correctly (low < median < high).',
      suggestedAction: 'This indicates a calculation error.',
    });
  }

  // rNPV divergence check
  if (result.financialModel?.rnpv) {
    const rnpv = result.financialModel.rnpv.riskAdjustedNPV;
    const benchmark = terms.totalDealValue.median;
    if (benchmark > 0 && rnpv > 0) {
      const divergence = Math.abs(rnpv - benchmark) / benchmark;
      if (divergence > 5) {
        warnings.push({
          severity: 'warning',
          field: 'rnpv',
          message: `rNPV ($${rnpv.toFixed(0)}M) diverges from benchmark median ($${benchmark.toFixed(0)}M) by ${(divergence * 100).toFixed(0)}%.`,
          suggestedAction: 'Large divergence may indicate different assumptions between models.',
        });
      }
    }
  }
}

// ── Helpers ──
function formatPhase(phase: Phase): string {
  const map: Record<Phase, string> = {
    discovery: 'Discovery',
    preclinical: 'Preclinical',
    phase1: 'Phase 1',
    phase1_2: 'Phase 1/2',
    phase2: 'Phase 2',
    phase2_3: 'Phase 2/3',
    phase3: 'Phase 3',
    nda_filed: 'NDA Filed',
    approved: 'Approved',
  };
  return map[phase] ?? phase;
}
