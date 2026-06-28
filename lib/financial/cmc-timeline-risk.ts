/**
 * Chemistry, Manufacturing, and Controls (CMC) Timeline & Risk Model
 *
 * Models CMC-driven delay, cost, and risk impact on pharma deal timelines.
 * ~30% of FDA CRLs cite CMC deficiencies (CDER action letters 2018-2024).
 *
 * Sources: FDA CDER/CBER CMC review data 2018-2024, CDMO capacity surveys
 * (Lonza/Samsung Biologics/Catalent 2022-2024), MIT NEWDIGS FoCUS 2020-2024,
 * ARM annual data, Beacon ADC database, SNMMI radiopharmaceutical supply
 * chain papers, BIO/Informa Clinical Development Success Rates 2011-2020.
 *
 * @module lib/financial/cmc-timeline-risk
 */

import type { Phase, TherapeuticArea, Modality } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Exported Types & Interfaces
// ---------------------------------------------------------------------------

export type SupplyChainRisk = 'low' | 'medium' | 'high' | 'critical';
export type RegulatoryComplexity = 'standard' | 'elevated' | 'complex' | 'unprecedented';

/** CMC risk profile returned by computeCMCRisk(). */
export interface CMCRiskResult {
  /** CMC-driven delay beyond standard phase durations (years). */
  additionalTimeline_years: number;
  /** Multiplier on base COGS (1.0x = small molecule baseline). */
  manufacturingCostMultiplier: number;
  /** Supply chain risk: critical = single-source CDMO / isotope / patient-specific. */
  supplyChainRisk: SupplyChainRisk;
  /** CMC-related clinical hold probability (0-1). ADC ~15-20%, gene therapy ~10-15%. */
  clinicalHoldProbability: number;
  /** Scalability 0-100. Small molecule 90+, mAb 75-85, CAR-T 30-50, gene therapy 20-40. */
  scalabilityScore: number;
  /** CMC dossier complexity tier. */
  regulatoryComplexity: RegulatoryComplexity;
  /** Human-readable narrative for deal memos. */
  narrative: string;
}

// ---------------------------------------------------------------------------
// Internal: CMC Profile Data
// ---------------------------------------------------------------------------

interface CMCParams {
  timelineMin: number;
  timelineMax: number;
  costRange: [number, number];
  supply: SupplyChainRisk;
  holdRange: [number, number];
  scaleRange: [number, number];
  complexity: RegulatoryComplexity;
  label: string;
  challenges: string[];
}

type CMCClass =
  | 'smallMol' | 'mab' | 'adc' | 'carT_auto' | 'carT_allo'
  | 'gt_aav' | 'gt_lenti' | 'siRNA' | 'rpt' | 'cell' | 'bispec'
  | 'peptide' | 'vaccine';

const P: Record<CMCClass, CMCParams> = {
  smallMol: {
    timelineMin: 0, timelineMax: 0.5, costRange: [1.0, 1.0], supply: 'low',
    holdRange: [0.02, 0.04], scaleRange: [90, 98], complexity: 'standard',
    label: 'small molecule',
    challenges: ['polymorphism characterization', 'process impurity control', 'continuous manufacturing qualification'],
  },
  mab: {
    timelineMin: 0.5, timelineMax: 1.0, costRange: [1.0, 1.5], supply: 'medium',
    holdRange: [0.04, 0.06], scaleRange: [75, 85], complexity: 'elevated',
    label: 'monoclonal antibody',
    challenges: ['cell line development and stability', 'process optimization at commercial scale', 'aggregation and charge variant control'],
  },
  adc: {
    timelineMin: 1.0, timelineMax: 1.5, costRange: [1.5, 2.0], supply: 'high',
    holdRange: [0.15, 0.20], scaleRange: [45, 60], complexity: 'complex',
    label: 'antibody-drug conjugate',
    challenges: ['conjugation chemistry reproducibility', 'linker stability under physiological conditions', 'DAR consistency', 'free payload control', 'potent compound handling'],
  },
  carT_auto: {
    timelineMin: 1.5, timelineMax: 2.5, costRange: [2.5, 4.0], supply: 'critical',
    holdRange: [0.08, 0.12], scaleRange: [30, 45], complexity: 'complex',
    label: 'autologous CAR-T cell therapy',
    challenges: ['vein-to-vein logistics', 'patient-specific manufacturing variability', 'REMS requirements', 'site certification', 'manufacturing failure rate (5-10%)'],
  },
  carT_allo: {
    timelineMin: 1.0, timelineMax: 2.0, costRange: [2.0, 3.0], supply: 'high',
    holdRange: [0.08, 0.12], scaleRange: [40, 55], complexity: 'complex',
    label: 'allogeneic CAR-T cell therapy',
    challenges: ['donor sourcing and qualification', 'gene editing consistency', 'cryopreservation uniformity', 'scale-out manufacturing'],
  },
  gt_aav: {
    timelineMin: 2.0, timelineMax: 3.0, costRange: [3.0, 5.0], supply: 'critical',
    holdRange: [0.10, 0.15], scaleRange: [20, 35], complexity: 'unprecedented',
    label: 'AAV gene therapy',
    challenges: ['vector manufacturing yield at GMP scale', 'full/empty capsid ratio', 'potency assay qualification', 'rcAAV testing', 'limited global CDMO capacity', 'dose-dependent cost ($1-2M/patient)'],
  },
  gt_lenti: {
    timelineMin: 1.5, timelineMax: 2.5, costRange: [2.5, 4.0], supply: 'high',
    holdRange: [0.10, 0.15], scaleRange: [25, 40], complexity: 'complex',
    label: 'lentiviral gene therapy',
    challenges: ['lentiviral vector production scale-up', 'RCL testing', 'transduction efficiency consistency', 'insertional mutagenesis characterization'],
  },
  siRNA: {
    timelineMin: 0.5, timelineMax: 1.0, costRange: [1.2, 1.8], supply: 'medium',
    holdRange: [0.04, 0.07], scaleRange: [65, 78], complexity: 'elevated',
    label: 'siRNA/LNP',
    challenges: ['LNP formulation reproducibility', 'cold chain requirements (-20C/-80C)', 'ionizable lipid sourcing', 'encapsulation efficiency at scale'],
  },
  rpt: {
    timelineMin: 1.5, timelineMax: 2.5, costRange: [2.0, 3.5], supply: 'critical',
    holdRange: [0.05, 0.08], scaleRange: [30, 45], complexity: 'complex',
    label: 'radiopharmaceutical',
    challenges: ['isotope supply chain (Ac-225, Lu-177)', 'short half-life distribution', 'radiolabeling consistency', 'hot cell infrastructure', 'geographic footprint constraints'],
  },
  cell: {
    timelineMin: 1.0, timelineMax: 2.0, costRange: [1.8, 3.0], supply: 'high',
    holdRange: [0.06, 0.10], scaleRange: [35, 55], complexity: 'complex',
    label: 'cell therapy (non-CAR-T)',
    challenges: ['manufacturing consistency', 'potency assay development', 'cryopreservation and thaw recovery', 'passage/senescence control'],
  },
  bispec: {
    timelineMin: 0.5, timelineMax: 1.5, costRange: [1.2, 1.8], supply: 'medium',
    holdRange: [0.05, 0.08], scaleRange: [60, 75], complexity: 'elevated',
    label: 'bispecific antibody',
    challenges: ['heterodimeric assembly optimization', 'mispairing/homodimer removal', 'aggregation control', 'higher-order structure characterization'],
  },
  peptide: {
    timelineMin: 0.0, timelineMax: 0.5, costRange: [1.0, 1.3], supply: 'low',
    holdRange: [0.02, 0.04], scaleRange: [85, 95], complexity: 'standard',
    label: 'peptide',
    challenges: ['solid-phase synthesis scale-up', 'purification yield', 'formulation stability'],
  },
  vaccine: {
    timelineMin: 0.5, timelineMax: 1.0, costRange: [1.0, 1.5], supply: 'medium',
    holdRange: [0.03, 0.06], scaleRange: [70, 85], complexity: 'elevated',
    label: 'vaccine',
    challenges: ['antigen production consistency', 'adjuvant sourcing', 'cold chain for global distribution'],
  },
};

// ---------------------------------------------------------------------------
// Modality -> CMC Class Mapping
// ---------------------------------------------------------------------------

function resolveClass(m: Modality): CMCClass {
  switch (m) {
    case 'smallMolecule': case 'protac': case 'molecularGlue': case 'psychedelic':
    case 'ionChannel': case 'jakInhibitor': case 'jakInhibitorDerm': case 's1pModulator':
    case 'oralIntegrin': case 'sglt2Inhibitor': case 'anticoagulantNovel':
    case 'antiviral': case 'antibioticNovel':
      return 'smallMol';

    case 'mab': case 'fcrnAntagonist': case 'complementInhibitor': case 'dualAntagonist':
    case 'tl1aInhibitor': case 'antiTl1a': case 'il23GI': case 'il17Inhibitor':
    case 'il13Inhibitor': case 'antiVegf': case 'pcsk9Targeting': case 'antiActivin':
    case 'tauTargeting':
      return 'mab';

    case 'adc':
      return 'adc';

    case 'bispecific': case 'tCellEngager': case 'bispecificHeme':
      return 'bispec';

    case 'carT_heme': case 'carT_solid': case 'carT_autoimmune': case 'carTreg':
      return 'carT_auto';

    case 'inVivoCarT':
      return 'carT_allo';

    case 'geneTherapy': case 'geneTherapyRare': case 'geneTherapyOcular':
      return 'gt_aav';

    case 'stemCell':
      return 'gt_lenti';

    case 'rnai': case 'mrna': case 'aso': case 'oligonucleotide':
    case 'rnaCardio': case 'bbbPlatform':
      return 'siRNA';

    case 'radiopharmaceutical':
      return 'rpt';

    case 'cellTherapy': case 'oncolyticVirus': case 'microbiomeBased':
    case 'phageTherapy': case 'enzymeReplacement':
      return 'cell';

    case 'peptide': case 'glp1Agonist': case 'dualIncretin': case 'tripleIncretin':
    case 'amylinAnalog': case 'oralPeptide': case 'gnrhAntagonist': case 'neuroactiveSteroid':
    case 'myosinInhibitor': case 'intravitreal': case 'topicalOphthalmic':
    case 'topicalBiologic': case 'gutSelectiveIntegrin': case 'hormoneTherapy':
    case 'substrateReduction': case 'btki':
      return 'peptide';

    case 'therapeuticVaccine': case 'vaccinePreventive':
      return 'vaccine';

    default: {
      const _: never = m;
      void _;
      return 'smallMol';
    }
  }
}

// ---------------------------------------------------------------------------
// Phase Reduction & TA Modifiers
// ---------------------------------------------------------------------------

/** Fraction of base CMC work remaining at each phase. */
const PHASE_RED: Record<Phase, number> = {
  discovery: 1.0, preclinical: 0.95, phase1: 0.80, phase1_2: 0.70,
  phase2: 0.55, phase2_3: 0.45, phase3: 0.30, nda_filed: 0.15, approved: 0.05,
};

interface TAMod { holdDelta: number; timeMult: number; note: string; }

const TA_MODS: Partial<Record<TherapeuticArea, TAMod>> = {
  oncology: { holdDelta: 0.02, timeMult: 1.05,
    note: 'Oncology CMC faces heightened potent compound handling requirements and narrower impurity specifications for cytotoxic agents.' },
  rareDisease: { holdDelta: 0.01, timeMult: 1.15,
    note: 'Rare disease CMC is complicated by small batch sizes that challenge process validation statistical requirements.' },
  hematology: { holdDelta: 0.02, timeMult: 1.10,
    note: 'Hematology CMC often involves cell therapy or bispecific platforms with complex manufacturing and stringent potency requirements.' },
  ophthalmology: { holdDelta: 0.01, timeMult: 1.08,
    note: 'Ophthalmic formulations require stringent sterility, endotoxin, and particulate specifications for intravitreal or subretinal delivery.' },
  neurology: { holdDelta: 0.01, timeMult: 1.05,
    note: 'CNS-targeted therapies may require specialized formulation for blood-brain barrier penetration.' },
  infectiousDisease: { holdDelta: -0.01, timeMult: 0.90,
    note: 'Infectious disease CMC benefits from established manufacturing platforms and regulatory precedent.' },
};

const PHASE_LABELS: Record<Phase, string> = {
  discovery: 'discovery stage', preclinical: 'preclinical stage',
  phase1: 'Phase 1', phase1_2: 'Phase 1/2', phase2: 'Phase 2',
  phase2_3: 'Phase 2/3', phase3: 'Phase 3', nda_filed: 'NDA/BLA filing',
  approved: 'approved stage',
};

// ---------------------------------------------------------------------------
// Exported: computeCMCRisk
// ---------------------------------------------------------------------------

/**
 * Compute CMC-driven risk and timeline impact for a pharma asset.
 *
 * @param modality        Drug modality (maps to CMC manufacturing class)
 * @param phase           Current development phase (drives residual CMC work)
 * @param therapeuticArea TA (applies TA-specific CMC modifiers)
 *
 * @example
 * const risk = computeCMCRisk('adc', 'phase2', 'oncology');
 * // risk.additionalTimeline_years ~ 0.72
 * // risk.manufacturingCostMultiplier ~ 1.75
 * // risk.supplyChainRisk === 'high'
 * // risk.clinicalHoldProbability ~ 0.195
 */
export function computeCMCRisk(
  modality: Modality,
  phase: Phase,
  therapeuticArea: TherapeuticArea,
): CMCRiskResult {
  const cls = resolveClass(modality);
  const p = P[cls];
  const pf = PHASE_RED[phase];
  const ta = TA_MODS[therapeuticArea];

  // Timeline: midpoint of phase-adjusted range with right-skew bias (1.05x)
  const taMult = ta?.timeMult ?? 1.0;
  const additionalTimeline_years = Number(
    ((p.timelineMin * pf * taMult + p.timelineMax * pf * taMult) / 2 * 1.05).toFixed(2)
  );

  // Cost: midpoint with early-phase inefficiency surcharge
  const phaseIneff = (phase === 'discovery' || phase === 'preclinical') ? 1.15
    : (phase === 'phase1' || phase === 'phase1_2') ? 1.08 : 1.0;
  const manufacturingCostMultiplier = Number(
    (((p.costRange[0] + p.costRange[1]) / 2) * phaseIneff).toFixed(2)
  );

  // Clinical hold probability with TA adjustment
  const baseHold = (p.holdRange[0] + p.holdRange[1]) / 2;
  const clinicalHoldProbability = Number(
    Math.max(0, Math.min(1, baseHold + (ta?.holdDelta ?? 0))).toFixed(3)
  );

  // Scalability with phase bonus
  const phaseBonus = (phase === 'phase3' || phase === 'nda_filed' || phase === 'approved') ? 5
    : (phase === 'phase2' || phase === 'phase2_3') ? 3 : 0;
  const scalabilityScore = Math.min(100, Math.round((p.scaleRange[0] + p.scaleRange[1]) / 2 + phaseBonus));

  // Narrative
  const narrative = buildNarrative(p, phase, additionalTimeline_years, manufacturingCostMultiplier,
    p.supply, clinicalHoldProbability, scalabilityScore, p.complexity, ta);

  return {
    additionalTimeline_years,
    manufacturingCostMultiplier,
    supplyChainRisk: p.supply,
    clinicalHoldProbability,
    scalabilityScore,
    regulatoryComplexity: p.complexity,
    narrative,
  };
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

function buildNarrative(
  p: CMCParams, phase: Phase, timeline: number, costMult: number,
  scRisk: SupplyChainRisk, holdProb: number, scaleScore: number,
  regComp: RegulatoryComplexity, ta: TAMod | undefined,
): string {
  const parts: string[] = [];

  parts.push(`This ${p.label} asset at ${PHASE_LABELS[phase]} faces ${regComp} CMC regulatory complexity.`);

  if (timeline >= 1.5) {
    parts.push(`CMC development is expected to add ~${timeline} years beyond standard clinical timelines, driven by ${p.challenges.slice(0, 2).join(' and ')}.`);
  } else if (timeline >= 0.5) {
    parts.push(`CMC activities are projected to extend the timeline by ~${timeline} years.`);
  } else if (timeline > 0) {
    parts.push(`Minimal CMC-driven extension (${timeline} years) given the well-characterized platform.`);
  }

  if (costMult >= 2.5) {
    parts.push(`Manufacturing costs are ${costMult}x small-molecule baseline, reflecting patient-specific or vector-based production that limits economies of scale.`);
  } else if (costMult >= 1.5) {
    parts.push(`Manufacturing costs run ${costMult}x baseline due to specialized processing and raw material requirements.`);
  }

  if (scRisk === 'critical') {
    parts.push(`Supply chain risk is critical: single-source dependencies, capacity-constrained CDMOs, or non-scalable patient-specific production.`);
  } else if (scRisk === 'high') {
    parts.push(`Supply chain risk is elevated due to limited CDMO capacity and specialized raw materials.`);
  }

  if (holdProb >= 0.10) {
    parts.push(`CMC-related clinical hold probability is ${(holdProb * 100).toFixed(1)}%, materially above the 3-5% industry average. Key risks: ${p.challenges.slice(0, 3).join(', ')}.`);
  }

  if (scaleScore < 50) {
    parts.push(`Scalability is constrained (${scaleScore}/100), which may limit commercial supply capacity.`);
  }

  if (ta) parts.push(ta.note);

  return parts.join(' ');
}
