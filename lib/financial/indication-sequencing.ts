/**
 * Indication Sequencing Engine
 *
 * Models sequential indication expansion for pharma franchises. Given a
 * primary indication with peak sales, computes the optimal development
 * sequence, accounting for TA-specific cannibalization, regulatory
 * complexity, enrollment feasibility, and probability of success.
 *
 * Sources: FDA approval histories, EvaluatePharma franchise analyses,
 * IQVIA launch sequencing data 2015-2025, Nature Reviews Drug Discovery.
 *
 * @module lib/financial/indication-sequencing
 */

import type { TherapeuticArea, Modality } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

export interface ExpansionStep {
  indication: string;
  lineOfTherapy: string;
  probability: number;
  lag_years: number;
  incrementalPeakSales_M: number;
  cannibalization_pct: number;
  sequenceOrder: number;
}

export interface IndicationSequenceResult {
  expansionSequence: ExpansionStep[];
  totalFranchiseValue_M: number;
  franchisePremium_pct: number;
  optimalSequencing: string[];
  narrative: string;
}

export interface ExpansionTemplate {
  indication: string;
  lineOfTherapy: string;
  baseProbability: number;
  typicalLag_years: number;
  peakSalesRatio: number;
  cannibalization_pct: number;
  rationale: string;
}

export interface TAExpansionTemplate {
  archetype: string;
  exemplar: string;
  cannibalizationRange: [number, number];
  steps: ExpansionTemplate[];
}

// ---------------------------------------------------------------------------
// Helper: compact step builder (reduces repetition in secondary TAs)
// ---------------------------------------------------------------------------

function step(
  indication: string, lot: string, prob: number,
  lag: number, ratio: number, cannibal: number, rationale: string,
): ExpansionTemplate {
  return { indication, lineOfTherapy: lot, baseProbability: prob,
    typicalLag_years: lag, peakSalesRatio: ratio,
    cannibalization_pct: cannibal, rationale };
}

// ---------------------------------------------------------------------------
// Expansion Templates by Therapeutic Area
// ---------------------------------------------------------------------------

/**
 * Canonical expansion templates encoding typical indication progression
 * patterns per TA. Probabilities and timelines derived from historical
 * franchise build-outs (2010-2025 approvals).
 */
export const EXPANSION_TEMPLATES: Record<string, TAExpansionTemplate> = {
  // ---- Core 4 TAs (fully specified per spec) ----

  oncology: {
    archetype: 'LOT escalation + tumor-type expansion',
    exemplar: 'Keytruda: 2L NSCLC -> 1L NSCLC -> melanoma -> adjuvant -> RCC -> TNBC',
    cannibalizationRange: [0.60, 0.80],
    steps: [
      step('Second-line / third-line same tumor', '2L/3L', 0.72, 0,
        1.0, 0.0, 'Easier enrollment, lower regulatory bar; typically the first approval'),
      step('First-line same tumor', '1L', 0.58, 2.0,
        1.8, 0.65, 'Largest patient pool; requires head-to-head vs SOC; high cannibalization with 2L'),
      step('Adjacent solid tumor', '2L', 0.45, 3.0,
        0.6, 0.30, 'New tumor type broadens franchise; moderate probability due to biology differences'),
      step('Adjuvant setting (primary tumor)', 'adjuvant', 0.52, 4.5,
        1.2, 0.70, 'Large patient pool (earlier stage) but long trials (DFS/OS endpoints)'),
      step('Neoadjuvant setting', 'neoadjuvant', 0.48, 5.5,
        0.7, 0.75, 'Pre-surgical window; accelerated pCR endpoints but commercial overlap significant'),
      step('Combination in new tumor type', '1L combo', 0.38, 4.0,
        0.5, 0.25, 'Combo trials require partner alignment; lower cannibalization (distinct population)'),
    ],
  },

  immunology: {
    archetype: 'Lead indication -> related -> adjacent -> broader autoimmune',
    exemplar: 'Dupixent: atopic dermatitis -> asthma -> CRSwNP -> EoE -> COPD',
    cannibalizationRange: [0.20, 0.40],
    steps: [
      step('Lead autoimmune indication', 'moderate-to-severe', 0.65, 0,
        1.0, 0.0, 'Initial approval in highest-unmet-need population'),
      step('Closely related indication (same pathway)', 'moderate-to-severe', 0.58, 2.0,
        0.7, 0.25, 'Shared biology de-risks; moderate prescriber overlap'),
      step('Adjacent inflammatory condition', 'second-line', 0.45, 3.5,
        0.5, 0.30, 'Different organ system but related immune pathway'),
      step('Broader autoimmune (e.g., lupus)', 'refractory', 0.32, 5.0,
        0.4, 0.35, 'Larger heterogeneous populations; higher failure risk'),
      step('Pediatric extension', 'pediatric', 0.70, 3.0,
        0.25, 0.20, 'Regulatory incentive (pediatric exclusivity); smaller population'),
    ],
  },

  neurology: {
    archetype: 'Primary CNS -> related neurological -> adjacent pain/psych',
    exemplar: 'Lecanemab: Alzheimer (early) -> Alzheimer (mild) -> related dementias',
    cannibalizationRange: [0.10, 0.30],
    steps: [
      step('Primary neurological indication', 'first-line or add-on', 0.52, 0,
        1.0, 0.0, 'Initial CNS indication; highest unmet need or clearest endpoint'),
      step('Related neurological condition', 'second-line', 0.40, 3.0,
        0.6, 0.15, 'Shared mechanism across CNS conditions; distinct populations'),
      step('Adjacent pain or psychiatric', 'adjunctive', 0.30, 4.5,
        0.4, 0.25, 'Different biology; BBB penetration already proven'),
      step('Broader CNS (e.g., movement disorders)', 'monotherapy', 0.25, 6.0,
        0.3, 0.20, 'Platform expansion; higher risk but minimal overlap'),
    ],
  },

  rareDisease: {
    archetype: 'Primary orphan -> ultra-rare expansion -> adjacent rare',
    exemplar: 'Spinraza: SMA Type 1 -> SMA Type 2/3 -> presymptomatic SMA',
    cannibalizationRange: [0.05, 0.15],
    steps: [
      step('Primary orphan indication', 'all-comers', 0.60, 0,
        1.0, 0.0, 'Initial orphan approval; breakthrough/priority review incentives'),
      step('Ultra-rare subtype or expansion', 'all-comers', 0.55, 2.0,
        0.35, 0.10, 'Very small population but near-guaranteed exclusivity; minimal overlap'),
      step('Adjacent rare disease (related pathway)', 'all-comers', 0.40, 3.5,
        0.5, 0.08, 'Shared biology (e.g., lysosomal storage); non-overlapping patients'),
      step('Broader rare or pediatric extension', 'pediatric', 0.50, 4.0,
        0.20, 0.12, 'Pediatric priority review voucher incentive'),
    ],
  },

  // ---- Secondary TAs (compact format) ----

  metabolic: {
    archetype: 'Primary metabolic -> comorbidity expansion -> CV outcomes',
    exemplar: 'Semaglutide: T2D -> obesity -> NASH -> CKD -> heart failure',
    cannibalizationRange: [0.25, 0.45],
    steps: [
      step('Primary metabolic indication', 'second-line', 0.62, 0, 1.0, 0.0, 'Established HbA1c/weight endpoints'),
      step('Obesity / weight management', 'chronic', 0.55, 2.5, 2.5, 0.30, 'Massive market; T2D overlap'),
      step('NASH / metabolic liver disease', 'first-line', 0.35, 4.0, 0.8, 0.35, 'Evolving histological endpoints'),
      step('CV outcomes (MACE reduction)', 'add-on', 0.45, 5.0, 1.5, 0.40, 'Large CVOT required'),
      step('CKD or heart failure', 'add-on', 0.38, 6.0, 0.6, 0.30, 'Cardiorenal expansion'),
    ],
  },

  cardiovascular: {
    archetype: 'Primary CV -> related hemodynamic -> HF subtypes',
    exemplar: 'Entresto: HFrEF -> HFpEF -> post-MI -> pediatric HF',
    cannibalizationRange: [0.30, 0.50],
    steps: [
      step('Primary CV indication', 'second-line', 0.55, 0, 1.0, 0.0, 'Established MACE/CV death endpoints'),
      step('Related CV subtype', 'first-line', 0.42, 3.0, 0.7, 0.35, 'Overlapping prescribers/comorbidities'),
      step('Heart failure subtype expansion', 'add-on', 0.35, 4.5, 0.5, 0.40, 'HFpEF/HFrEF distinction'),
    ],
  },

  hematology: {
    archetype: 'Primary heme malignancy -> related lineage -> supportive care',
    exemplar: 'Revlimid: relapsed myeloma -> newly diagnosed -> maintenance -> MDS',
    cannibalizationRange: [0.25, 0.45],
    steps: [
      step('Primary hematologic malignancy', 'relapsed/refractory', 0.60, 0, 1.0, 0.0, 'Accelerated approval via response rate'),
      step('Earlier line in same malignancy', '1L or maintenance', 0.50, 2.5, 1.4, 0.60, 'Larger pool; LOT overlap'),
      step('Related heme malignancy', 'relapsed/refractory', 0.38, 3.5, 0.5, 0.20, 'Shared lineage biology'),
      step('Supportive care or benign heme', 'chronic', 0.45, 5.0, 0.3, 0.15, 'Non-malignant expansion'),
    ],
  },

  dermatology: {
    archetype: 'Lead skin -> related inflammatory -> systemic',
    exemplar: 'Skyrizi: plaque psoriasis -> PsA -> Crohn disease',
    cannibalizationRange: [0.15, 0.35],
    steps: [
      step('Primary dermatologic condition', 'moderate-to-severe', 0.60, 0, 1.0, 0.0, 'Visible PASI/IGA endpoints'),
      step('Related inflammatory skin', 'moderate-to-severe', 0.50, 2.0, 0.5, 0.20, 'Shared Th2/Th17 biology'),
      step('Systemic inflammatory (PsA, IBD)', 'second-line', 0.42, 3.5, 0.6, 0.30, 'Cross-TA cytokine pathway'),
    ],
  },

  gastroenterology: {
    archetype: 'Lead GI inflammatory -> related bowel -> hepatic',
    exemplar: 'Entyvio: UC -> Crohn -> pouchitis',
    cannibalizationRange: [0.20, 0.40],
    steps: [
      step('Primary GI inflammatory', 'moderate-to-severe', 0.55, 0, 1.0, 0.0, 'Established endoscopic endpoints'),
      step('Related bowel condition', 'second-line', 0.48, 2.5, 0.7, 0.25, 'UC/Crohn crossover; shared channel'),
      step('Adjacent GI (EoE, pouchitis)', 'first-line', 0.38, 4.0, 0.3, 0.15, 'Smaller but high unmet need'),
    ],
  },

  infectiousDisease: {
    archetype: 'Primary pathogen -> resistance variants -> prophylaxis',
    exemplar: 'Paxlovid: COVID treatment -> COVID prophylaxis (attempted)',
    cannibalizationRange: [0.15, 0.30],
    steps: [
      step('Primary infection treatment', 'acute', 0.50, 0, 1.0, 0.0, 'Microbiological endpoints'),
      step('Resistant or variant pathogen', 'salvage', 0.40, 2.0, 0.4, 0.20, 'Narrower population; AMR incentives'),
      step('Prophylaxis or prevention', 'prophylaxis', 0.45, 3.0, 0.8, 0.25, 'Broader population; different standard'),
    ],
  },

  ophthalmology: {
    archetype: 'Primary retinal -> related retinal -> anterior segment',
    exemplar: 'Eylea: wet AMD -> DME -> RVO -> mCNV',
    cannibalizationRange: [0.20, 0.35],
    steps: [
      step('Primary retinal indication', 'first-line', 0.58, 0, 1.0, 0.0, 'Established visual acuity endpoints'),
      step('Related retinal condition', 'first-line', 0.52, 2.0, 0.5, 0.25, 'Same route/mechanism'),
      step('Anterior segment or rare ocular', 'adjunctive', 0.35, 4.0, 0.3, 0.15, 'Different anatomy; smaller populations'),
    ],
  },

  womensHealth: {
    archetype: 'Primary reproductive -> adjacent hormonal -> broader',
    exemplar: 'Elagolix: endometriosis -> uterine fibroids',
    cannibalizationRange: [0.15, 0.30],
    steps: [
      step('Primary reproductive/hormonal', 'second-line', 0.55, 0, 1.0, 0.0, 'Established pain/bleeding endpoints'),
      step('Adjacent hormonal condition', 'first-line', 0.45, 2.5, 0.6, 0.20, 'Shared hormonal pathway'),
      step('Broader reproductive health', 'adjunctive', 0.35, 4.0, 0.3, 0.15, 'Beyond core mechanism'),
    ],
  },
};

// ---------------------------------------------------------------------------
// Modality Adjustments
// ---------------------------------------------------------------------------

/**
 * Modality-specific probability multipliers for indication expansion.
 * Platform modalities (cell/gene therapy) face steeper drop-off due to
 * manufacturing and safety complexity. Broad-mechanism small molecules
 * expand more easily.
 */
const MODALITY_EXPANSION_FACTORS: Record<string, number> = {
  smallMolecule: 1.10, mab: 1.05, bispecific: 0.90, trispecificAntibody: 0.80, adc: 0.85,
  carT_heme: 0.70, carT_solid: 0.60, cellTherapy: 0.65,
  geneTherapy: 0.55, geneTherapyRare: 0.55, geneTherapyOcular: 0.60,
  radiopharmaceutical: 0.75, mrna: 0.90, rnai: 0.85, protac: 0.80,
  peptide: 1.00, glp1Agonist: 1.15, dualIncretin: 1.10, tripleIncretin: 1.00,
  antiVegf: 1.05, enzymeReplacement: 0.70, substrateReduction: 0.75,
  jakInhibitor: 1.05, il17Inhibitor: 1.00, il13Inhibitor: 1.00,
  vaccinePreventive: 0.95, therapeuticVaccine: 0.70,
};

const DEFAULT_MODALITY_FACTOR = 1.0;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function getModalityFactor(modality: string): number {
  return MODALITY_EXPANSION_FACTORS[modality] ?? DEFAULT_MODALITY_FACTOR;
}

/** Diminishing probability for later sequence steps: prob *= 0.95^(stepIndex). */
function applySequenceDecay(baseProbability: number, stepIndex: number): number {
  return Math.min(baseProbability * Math.pow(0.95, stepIndex), 0.95);
}

/** Net incremental value ($M) after probability weighting and cannibalization. */
function computeNetValue(
  primaryPeakSales_M: number, peakSalesRatio: number,
  probability: number, cannibalization_pct: number,
): number {
  return primaryPeakSales_M * peakSalesRatio * (1 - cannibalization_pct) * probability;
}

function buildNarrative(
  therapeuticArea: string, indication: string, primaryPeakSales_M: number,
  steps: ExpansionStep[], totalFranchiseValue_M: number,
  franchisePremium_pct: number, template: TAExpansionTemplate,
): string {
  const totalTimeline = steps.length > 0 ? Math.max(...steps.map(s => s.lag_years)) : 0;
  const topExpansion = steps.length > 0
    ? steps.reduce((a, b) =>
        (b.incrementalPeakSales_M * (1 - b.cannibalization_pct) * b.probability) >
        (a.incrementalPeakSales_M * (1 - a.cannibalization_pct) * a.probability) ? b : a)
    : null;

  let n = `Franchise expansion for ${indication} in ${therapeuticArea} `;
  n += `follows the "${template.archetype}" pattern (cf. ${template.exemplar}). `;
  n += `Starting from $${primaryPeakSales_M.toLocaleString()}M primary peak sales, `;
  n += `the model identifies ${steps.length} expansion indication${steps.length !== 1 ? 's' : ''} `;
  n += `over a ${totalTimeline.toFixed(1)}-year horizon. `;
  n += `Probability-weighted franchise value reaches $${Math.round(totalFranchiseValue_M).toLocaleString()}M, `;
  n += `a ${franchisePremium_pct.toFixed(1)}% premium over single-indication base. `;

  if (topExpansion) {
    n += `Highest-value expansion: "${topExpansion.indication}" `;
    n += `(${topExpansion.lineOfTherapy}, ${(topExpansion.probability * 100).toFixed(0)}% prob, `;
    n += `${topExpansion.lag_years.toFixed(1)}-yr lag). `;
  }

  const avgCannibal = steps.length > 0
    ? steps.reduce((s, x) => s + x.cannibalization_pct, 0) / steps.length : 0;
  n += `Average cannibalization: ${(avgCannibal * 100).toFixed(0)}% `;
  n += `(TA range: ${(template.cannibalizationRange[0] * 100).toFixed(0)}-`;
  n += `${(template.cannibalizationRange[1] * 100).toFixed(0)}%).`;
  return n;
}

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

/**
 * Compute the optimal indication expansion sequence for a pharma franchise.
 *
 * 1. Looks up TA-specific expansion template
 * 2. Adjusts probabilities for modality and sequence decay
 * 3. Computes net incremental value per expansion step
 * 4. Ranks by risk-adjusted value velocity ($/year) for optimal sequencing
 * 5. Aggregates total franchise value and premium
 */
export function computeIndicationSequence(
  therapeuticArea: TherapeuticArea | string,
  indication: string,
  modality: Modality | string,
  primaryPeakSales_M: number,
): IndicationSequenceResult {
  const template = EXPANSION_TEMPLATES[therapeuticArea] ?? EXPANSION_TEMPLATES.oncology;
  const modalityFactor = getModalityFactor(modality);

  // Skip step[0] (primary indication — already captured in primaryPeakSales_M)
  const expansionTemplateSteps = template.steps.slice(1);

  const expansionSequence: ExpansionStep[] = expansionTemplateSteps.map((s, idx) => {
    const adjusted = applySequenceDecay(s.baseProbability * modalityFactor, idx + 1);
    const clamped = Math.max(0.05, Math.min(adjusted, 0.95));
    return {
      indication: s.indication,
      lineOfTherapy: s.lineOfTherapy,
      probability: Math.round(clamped * 1000) / 1000,
      lag_years: s.typicalLag_years,
      incrementalPeakSales_M: Math.round(primaryPeakSales_M * s.peakSalesRatio * 10) / 10,
      cannibalization_pct: s.cannibalization_pct,
      sequenceOrder: idx + 1,
    };
  });

  // Probability-weighted net values
  const stepValues = expansionSequence.map(s => ({
    step: s,
    netValue: computeNetValue(
      primaryPeakSales_M, s.incrementalPeakSales_M / primaryPeakSales_M,
      s.probability, s.cannibalization_pct,
    ),
  }));

  const expansionValue = stepValues.reduce((sum, sv) => sum + sv.netValue, 0);
  const totalFranchiseValue_M = Math.round((primaryPeakSales_M + expansionValue) * 10) / 10;
  const franchisePremium_pct = primaryPeakSales_M > 0
    ? Math.round(((totalFranchiseValue_M / primaryPeakSales_M) - 1) * 1000) / 10
    : 0;

  // Rank by value velocity (risk-adjusted value per year of lag)
  const rankedSteps = [...stepValues]
    .filter(sv => sv.netValue > 0)
    .sort((a, b) => {
      const vA = a.step.lag_years > 0 ? a.netValue / a.step.lag_years : a.netValue * 10;
      const vB = b.step.lag_years > 0 ? b.netValue / b.step.lag_years : b.netValue * 10;
      return vB - vA;
    });

  const optimalSequencing = [
    `1. ${indication} (primary)`,
    ...rankedSteps.map((sv, idx) =>
      `${idx + 2}. ${sv.step.indication} (${sv.step.lineOfTherapy}, ` +
      `~${sv.step.lag_years}yr lag, $${Math.round(sv.netValue)}M risk-adj. value)`
    ),
  ];

  // Reassign sequenceOrder to reflect optimal ranking
  rankedSteps.forEach((sv, idx) => { sv.step.sequenceOrder = idx + 1; });

  const narrative = buildNarrative(
    therapeuticArea, indication, primaryPeakSales_M,
    expansionSequence, totalFranchiseValue_M, franchisePremium_pct, template,
  );

  return { expansionSequence, totalFranchiseValue_M, franchisePremium_pct, optimalSequencing, narrative };
}
