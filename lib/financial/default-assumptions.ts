import {
  POS_BY_THERAPEUTIC_AREA,
  PHASE_COSTS,
  PHASE_DURATION,
  REVENUE_CURVE,
  REVENUE_CURVE_OVERRIDES,
  INDICATION_REVENUE_CURVES,
  COGS_BY_MODALITY_CATEGORY,
  SGA_BY_LIFECYCLE_STAGE,
} from './pos-tables';
import { getDefaultDiscountRate, getCogsRate, getGenericErosionRate } from './rnpv-engine';

export interface ResolvedDefaults {
  discountRate: number;
  phaseTransitionRates: { key: string; label: string; rate: number }[];
  phaseCosts: { phase: string; costM: number }[];
  revenueCurve: {
    rampUpYears: number;
    peakDurationYears: number;
    declineRate: number;
    genericErosion: number;
    loeYearsAfterApproval: number;
  };
  cogsPercent: number;
  sgaByStage: Record<string, number>;
}

const STANDARD_PATHWAY = ['discovery', 'preclinical', 'phase1', 'phase2', 'phase3', 'nda_filed'] as const;

const TRANSITION_LABELS: Record<string, string> = {
  preclinical_to_p1: 'Preclinical → Phase 1',
  p1_to_p2: 'Phase 1 → Phase 2',
  p2_to_p3: 'Phase 2 → Phase 3',
  p3_to_approval: 'Phase 3 → Approval',
  approval_to_launch: 'Approval → Launch',
};

const TRANSITION_TO_POS_KEY: Record<string, string> = {
  preclinical_to_p1: 'preclinicalToPhase1',
  p1_to_p2: 'phase1ToPhase2',
  p2_to_p3: 'phase2ToPhase3',
  p3_to_approval: 'phase3ToApproval',
  approval_to_launch: 'approvalToLaunch',
};

export function getResolvedDefaults(input: {
  therapeuticArea: string;
  phase: string;
  modality: string;
  indication?: string;
  territory?: string;
  companyType?: string;
  dealType?: string;
}): ResolvedDefaults {
  const { therapeuticArea, phase, modality, indication, territory, companyType, dealType } = input;

  const discountRate = getDefaultDiscountRate(
    therapeuticArea,
    phase,
    territory || 'global',
    companyType,
    dealType || 'licensing',
  );

  const posRates = POS_BY_THERAPEUTIC_AREA[therapeuticArea] ?? POS_BY_THERAPEUTIC_AREA.oncology;
  const currentIdx = STANDARD_PATHWAY.indexOf(phase as typeof STANDARD_PATHWAY[number]);
  const remainingPhases = currentIdx >= 0
    ? STANDARD_PATHWAY.slice(currentIdx)
    : STANDARD_PATHWAY.slice(3);

  const transitionKeys = Object.keys(TRANSITION_LABELS);
  const phaseToTransitionStart: Record<string, string> = {
    discovery: 'preclinical_to_p1',
    preclinical: 'preclinical_to_p1',
    phase1: 'p1_to_p2',
    phase2: 'p2_to_p3',
    phase3: 'p3_to_approval',
    nda_filed: 'approval_to_launch',
  };
  const startTransition = phaseToTransitionStart[phase] || 'p2_to_p3';
  const startIdx = transitionKeys.indexOf(startTransition);
  const relevantTransitions = transitionKeys.slice(Math.max(0, startIdx));

  const phaseTransitionRates = relevantTransitions.map(key => {
    const posKey = TRANSITION_TO_POS_KEY[key];
    const rate = (posRates as unknown as Record<string, number>)[posKey] ?? 0.5;
    return { key, label: TRANSITION_LABELS[key], rate };
  });

  const costs = PHASE_COSTS[therapeuticArea] || PHASE_COSTS.oncology;
  const phaseCosts = remainingPhases.map(p => ({
    phase: p,
    costM: costs[p] || 0,
  }));

  const indicationCurve = indication ? INDICATION_REVENUE_CURVES[indication] : undefined;
  const taOverrides = REVENUE_CURVE_OVERRIDES[therapeuticArea] || {};
  const revenueCurve = {
    rampUpYears: indicationCurve?.rampUpYears ?? taOverrides.rampUpYears ?? REVENUE_CURVE.rampUpYears,
    peakDurationYears: indicationCurve?.peakDurationYears ?? taOverrides.peakDurationYears ?? REVENUE_CURVE.peakDurationYears,
    declineRate: indicationCurve?.declineRate ?? taOverrides.declineRate ?? REVENUE_CURVE.declineRate,
    genericErosion: getGenericErosionRate(modality),
    loeYearsAfterApproval: indicationCurve?.loeYearsAfterApproval ?? taOverrides.loeYearsAfterApproval ?? REVENUE_CURVE.loeYearsAfterApproval,
  };

  const cogsPercent = getCogsRate(modality);

  return {
    discountRate,
    phaseTransitionRates,
    phaseCosts,
    revenueCurve,
    cogsPercent,
    sgaByStage: { ...SGA_BY_LIFECYCLE_STAGE },
  };
}
