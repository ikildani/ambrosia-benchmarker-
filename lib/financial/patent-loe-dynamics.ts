/**
 * Patent Term Adjustments & Loss-of-Exclusivity (LOE) Dynamics
 *
 * Models the full patent-lifecycle economics of a pharmaceutical asset from
 * filing through generic/biosimilar erosion. Combines four exclusivity layers:
 *   1. Patent-based: base 20yr term + PTA (USPTO delays) + PTE (Hatch-Waxman)
 *   2. Regulatory-based: orphan (7yr US / 10yr EU), NCE (5yr), biologic (12yr)
 *   3. Pediatric exclusivity: +0.5yr PREA/BPCA incentive
 *   4. Post-LOE erosion: modality-specific generic/biosimilar share curves
 *
 * Sources: 35 U.S.C. ss 154(b) (PTA), 35 U.S.C. ss 156 (PTE/Hatch-Waxman),
 * 42 U.S.C. ss 262(k) (BPCIA), FDA/CDER Orange Book 2020-2025,
 * BIO/Informa "Biosimilar Uptake Trends 2024", IQVIA 2025.
 *
 * @module lib/financial/patent-loe-dynamics
 */

import type { Phase, TherapeuticArea, Modality } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/** Modality-specific generic/biosimilar erosion curve after LOE. */
export interface GenericErosionProfile {
  year1Erosion: number;
  year2Erosion: number;
  year3Erosion: number;
  steadyStateGenericShare: number;
  yearsToSteadyState: number;
  pattern: 'rapid' | 'gradual' | 'moderate' | 'minimal';
  rationale: string;
}

/** Generic entry profile returned as part of patent dynamics output. */
export interface GenericEntryProfile {
  year1erosion: number;
  year2erosion: number;
  year3erosion: number;
  steadyStateGenericShare: number;
}

/** ANDA Paragraph IV challenge risk assessment. */
export interface ParagraphIVRisk {
  probability: number;
  expectedEntryTiming_years: number;
}

/** Regulatory designation flags relevant to exclusivity calculations. */
export interface RegulatoryDesignations {
  breakthrough: boolean;
  fastTrack: boolean;
  orphan: boolean;
  prime: boolean;
}

/** Complete patent dynamics output for a pharmaceutical asset. */
export interface PatentDynamicsResult {
  basePatentLife_years: number;
  ptaAdjustment_years: number;
  pteAdjustment_years: number;
  pediatricExclusivity_years: number;
  orphanExclusivity_years: number;
  nceExclusivity_years: number;
  biologicExclusivity_years: number;
  effectiveLOE_yearsFromApproval: number;
  genericEntryProfile: GenericEntryProfile;
  paragraphIVRisk: ParagraphIVRisk;
  authorizedGenericImpact: boolean;
  narrative: string;
}

// ---------------------------------------------------------------------------
// Generic Erosion Profiles by Modality Category
// ---------------------------------------------------------------------------

/**
 * Canonical erosion profiles. Sources: IQVIA Biosimilar Uptake 2024,
 * FDA/CDER Generic Drug Access 2024, McKinsey C&GT Manufacturing 2025.
 */
export const GENERIC_EROSION_PROFILES: Record<string, GenericErosionProfile> = {
  small_molecule: {
    year1Erosion: 0.80,
    year2Erosion: 0.90,
    year3Erosion: 0.92,
    steadyStateGenericShare: 0.93,
    yearsToSteadyState: 2,
    pattern: 'rapid',
    rationale:
      'Rapid generic erosion: Paragraph IV filers capture 80%+ prescriptions within ' +
      '12-18 months. Multiple ANDA filers compress pricing 85-95% below brand WAC.',
  },
  biologic: {
    year1Erosion: 0.20,
    year2Erosion: 0.30,
    year3Erosion: 0.40,
    steadyStateGenericShare: 0.55,
    yearsToSteadyState: 5,
    pattern: 'gradual',
    rationale:
      'Gradual biosimilar erosion: manufacturing complexity and physician switching ' +
      'inertia limit uptake. Humira US biosimilar uptake ~35% at 18 months (2023-2024).',
  },
  complex_generic: {
    year1Erosion: 0.30,
    year2Erosion: 0.50,
    year3Erosion: 0.65,
    steadyStateGenericShare: 0.75,
    yearsToSteadyState: 3,
    pattern: 'moderate',
    rationale:
      'Moderate erosion: NDDS, depot injectables, inhaled products erode faster than ' +
      'biologics but slower than oral solids. Manufacturing barriers limit filers to 2-4.',
  },
  gene_therapy: {
    year1Erosion: 0.05,
    year2Erosion: 0.08,
    year3Erosion: 0.12,
    steadyStateGenericShare: 0.20,
    yearsToSteadyState: 8,
    pattern: 'minimal',
    rationale:
      'Minimal post-LOE erosion: extreme manufacturing complexity (viral vector production), ' +
      'patient-specific dosing, and one-time curative model. No biosimilar pathway as of 2025.',
  },
};

// ---------------------------------------------------------------------------
// Internal Constants
// ---------------------------------------------------------------------------

/** PTA estimates by modality category. Source: USPTO PTMT 2020-2024. */
const PTA_BY_CATEGORY: Record<string, number> = {
  small_molecule: 0.8, antibody: 1.5, adc: 1.8, cell_therapy: 2.2,
  gene_therapy: 2.5, oligonucleotide: 1.8, vaccine: 1.2,
  radiopharmaceutical: 1.5, peptide: 1.0, topical: 0.7, other: 1.0,
};

/** PTE base estimates by phase. Source: 35 U.S.C. ss 156, FDA PTE database. */
const PTE_BY_PHASE: Record<string, number> = {
  discovery: 4.0, preclinical: 3.5, phase1: 3.0, phase1_2: 2.8,
  phase2: 2.5, phase2_3: 2.2, phase3: 2.0, nda_filed: 1.5, approved: 1.8,
};

/** Map every Modality string to a broad category for lookup. */
const MODALITY_TO_CATEGORY: Record<string, string> = {
  // Small molecule
  smallMolecule: 'small_molecule', protac: 'small_molecule', molecularGlue: 'small_molecule',
  covalent_inhibitor: 'small_molecule', allosteric_inhibitor: 'small_molecule',
  ionChannel: 'small_molecule', psychedelic: 'small_molecule', jakInhibitor: 'small_molecule',
  s1pModulator: 'small_molecule', sglt2Inhibitor: 'small_molecule',
  anticoagulantNovel: 'small_molecule', antiviral: 'small_molecule', antibioticNovel: 'small_molecule',
  // Antibody / biologic
  mab: 'antibody', antibody: 'antibody', bispecific: 'antibody', bispecificAntibody: 'antibody',
  tCellEngager: 'antibody', bispecificHeme: 'antibody', fcrnAntagonist: 'antibody',
  complementInhibitor: 'antibody', antiVegf: 'antibody', il17Inhibitor: 'antibody',
  il13Inhibitor: 'antibody', tl1aInhibitor: 'antibody', antiTl1a: 'antibody',
  il23GI: 'antibody', oralIntegrin: 'antibody', dualAntagonist: 'antibody', antiActivin: 'antibody',
  // ADC
  adc: 'adc', adc_her2: 'adc', adc_trop2: 'adc',
  adc_claudin18_2: 'adc', adc_nectin4: 'adc', adc_folr1: 'adc',
  // Cell therapy
  cellTherapy: 'cell_therapy', carT_heme: 'cell_therapy', carT_solid: 'cell_therapy',
  carT_autoimmune: 'cell_therapy', carT_allogeneic: 'cell_therapy', carT_armored: 'cell_therapy',
  carTreg: 'cell_therapy', inVivoCarT: 'cell_therapy', stemCell: 'cell_therapy', til_therapy: 'cell_therapy',
  // Gene therapy
  geneTherapy: 'gene_therapy', geneTherapyRare: 'gene_therapy', geneTherapyOcular: 'gene_therapy',
  geneEditing: 'gene_therapy', crispr_base_editing: 'gene_therapy', crispr_prime_editing: 'gene_therapy',
  // Oligonucleotide
  rnai: 'oligonucleotide', mrna: 'oligonucleotide', aso: 'oligonucleotide',
  oligonucleotide: 'oligonucleotide', microRNA: 'oligonucleotide',
  saRNA: 'oligonucleotide', circRNA: 'oligonucleotide', rnaCardio: 'oligonucleotide',
  pcsk9Targeting: 'oligonucleotide',
  // Vaccine
  vaccinePreventive: 'vaccine', therapeuticVaccine: 'vaccine', oncolyticVirus: 'vaccine',
  // Radiopharmaceutical
  radiopharmaceutical: 'radiopharmaceutical',
  // Peptide
  peptide: 'peptide', glp1Agonist: 'peptide', dualIncretin: 'peptide', tripleIncretin: 'peptide',
  amylinAnalog: 'peptide', oralPeptide: 'peptide', gnrhAntagonist: 'peptide',
  hormoneTherapy: 'peptide', neuroactiveSteroid: 'peptide', myosinInhibitor: 'peptide',
  // Topical
  jakInhibitorDerm: 'topical', topicalOphthalmic: 'topical', topicalBiologic: 'topical',
  intravitreal: 'topical', gutSelectiveIntegrin: 'topical',
  // Other
  bbbPlatform: 'other', tauTargeting: 'other', enzymeReplacement: 'other',
  substrateReduction: 'other', microbiomeBased: 'other', phageTherapy: 'other', btki: 'other',
};

const BIOLOGIC_CATEGORIES = new Set([
  'antibody', 'adc', 'cell_therapy', 'gene_therapy', 'oligonucleotide', 'vaccine',
]);

const SMALL_MOLECULE_CATEGORIES = new Set(['small_molecule', 'topical']);

const PEDIATRIC_ELIGIBLE_TAS = new Set<string>([
  'oncology', 'neurology', 'immunology', 'rareDisease', 'hematology',
  'infectiousDisease', 'gastroenterology', 'dermatology', 'ophthalmology',
]);

/** Paragraph IV challenge probability by category. Source: FDA ANDA data 2020-2024. */
const PARA_IV_PROB: Record<string, number> = {
  small_molecule: 0.85, topical: 0.60, peptide: 0.50, antibody: 0.15,
  adc: 0.10, cell_therapy: 0.05, gene_therapy: 0.03, oligonucleotide: 0.20,
  vaccine: 0.15, radiopharmaceutical: 0.10, other: 0.30,
};

/** Expected generic entry timing vs patent expiry (years). Negative = before expiry. */
const PARA_IV_TIMING: Record<string, number> = {
  small_molecule: -1.5, topical: -0.5, peptide: 0.0, antibody: 1.0,
  adc: 2.0, cell_therapy: 5.0, gene_therapy: 7.0, oligonucleotide: 1.5,
  vaccine: 1.5, radiopharmaceutical: 2.0, other: 0.5,
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function getModalityCategory(modality: Modality | string): string {
  return MODALITY_TO_CATEGORY[modality] ?? 'other';
}

function isBiologic(modality: Modality | string): boolean {
  return BIOLOGIC_CATEGORIES.has(getModalityCategory(modality));
}

function isSmallMolecule(modality: Modality | string): boolean {
  return SMALL_MOLECULE_CATEGORIES.has(getModalityCategory(modality));
}

/** Estimate years from patent filing to regulatory approval, by current phase. */
function estimateFilingToApproval(phase: string): number {
  const map: Record<string, number> = {
    discovery: 14, preclinical: 12, phase1: 10, phase1_2: 9,
    phase2: 8, phase2_3: 7, phase3: 5, nda_filed: 3, approved: 10,
  };
  return map[phase] ?? 10;
}

/**
 * Retrieve the generic erosion profile for a modality. Maps modality to its
 * broad category, then selects the corresponding GENERIC_EROSION_PROFILES entry.
 */
export function getErosionProfile(modality: Modality | string): GenericErosionProfile {
  const cat = getModalityCategory(modality);
  if (cat === 'small_molecule' || cat === 'topical') return GENERIC_EROSION_PROFILES.small_molecule;
  if (cat === 'gene_therapy' || cat === 'cell_therapy') return GENERIC_EROSION_PROFILES.gene_therapy;
  if (cat === 'adc' || cat === 'radiopharmaceutical' || cat === 'peptide') {
    return GENERIC_EROSION_PROFILES.complex_generic;
  }
  return GENERIC_EROSION_PROFILES.biologic;
}

// ---------------------------------------------------------------------------
// Main Computation
// ---------------------------------------------------------------------------

/**
 * Compute the full patent dynamics profile for a pharmaceutical asset.
 *
 * Models patent term (base + PTA + PTE), all regulatory exclusivity layers,
 * pediatric and orphan bonuses, generic erosion trajectory, Paragraph IV risk,
 * and authorized generic likelihood.
 */
export function computePatentDynamics(
  phase: Phase | string,
  modality: Modality | string,
  therapeuticArea: TherapeuticArea | string,
  indication: string,
  regulatoryDesignations: RegulatoryDesignations,
  approvalYear: number,
): PatentDynamicsResult {
  const category = getModalityCategory(modality);
  const biologicFlag = isBiologic(modality);
  const smallMoleculeFlag = isSmallMolecule(modality);

  // 1. Base patent term — 20 years from filing (TRIPS / 35 U.S.C. ss 154)
  const basePatentLife_years = 20;

  // 2. PTA — USPTO examination delays (35 U.S.C. ss 154(b))
  const ptaAdjustment_years = PTA_BY_CATEGORY[category] ?? 1.0;

  // 3. PTE — Hatch-Waxman ss 156, capped at 5yr and 14yr post-approval
  const rawPTE = PTE_BY_PHASE[phase] ?? 2.0;
  const pteCapped = Math.min(rawPTE, 5.0);
  const filingToApproval = estimateFilingToApproval(phase);
  const remainingPatentAtApproval = basePatentLife_years - filingToApproval;
  const pteAdjustment_years = Math.min(pteCapped, Math.max(0, 14 - remainingPatentAtApproval));

  // 4. Pediatric exclusivity — 0.5yr under PREA/BPCA
  const pediatricEligible =
    PEDIATRIC_ELIGIBLE_TAS.has(therapeuticArea) || regulatoryDesignations.orphan;
  const pediatricExclusivity_years = pediatricEligible ? 0.5 : 0;

  // 5. Orphan Drug Exclusivity — 7yr US (21 U.S.C. ss 360bb)
  const orphanExclusivity_years = regulatoryDesignations.orphan ? 7.0 : 0;

  // 6. NCE exclusivity — 5yr for small molecules under 505(b)(1)
  const nceExclusivity_years = smallMoleculeFlag ? 5.0 : 0;

  // 7. Biologic exclusivity — 12yr under BPCIA (42 U.S.C. ss 262(k))
  const biologicExclusivity_years = biologicFlag ? 12.0 : 0;

  // 8. Effective LOE = max(patent-based, regulatory-based)
  const patentBasedLOE =
    remainingPatentAtApproval + pteAdjustment_years + pediatricExclusivity_years;
  const regulatoryBasedLOE =
    Math.max(orphanExclusivity_years, nceExclusivity_years, biologicExclusivity_years) +
    pediatricExclusivity_years;
  const effectiveLOE_yearsFromApproval = Math.max(patentBasedLOE, regulatoryBasedLOE);

  // 9. Generic entry profile
  const erosionProfile = getErosionProfile(modality);
  const genericEntryProfile: GenericEntryProfile = {
    year1erosion: erosionProfile.year1Erosion,
    year2erosion: erosionProfile.year2Erosion,
    year3erosion: erosionProfile.year3Erosion,
    steadyStateGenericShare: erosionProfile.steadyStateGenericShare,
  };

  // 10. Paragraph IV risk
  let paragraphIVProb = PARA_IV_PROB[category] ?? 0.30;
  if (regulatoryDesignations.orphan && smallMoleculeFlag) {
    paragraphIVProb *= 0.6; // smaller market deters generic filers
  }
  const paragraphIVRisk: ParagraphIVRisk = {
    probability: Math.round(paragraphIVProb * 100) / 100,
    expectedEntryTiming_years: PARA_IV_TIMING[category] ?? 0.5,
  };

  // 11. Authorized generic impact — common for SM blockbusters, not biologics
  const authorizedGenericImpact = smallMoleculeFlag && !regulatoryDesignations.orphan;

  // 12. Narrative
  const loeYear = approvalYear + effectiveLOE_yearsFromApproval;
  const patentDriven = patentBasedLOE >= regulatoryBasedLOE;
  const parts: string[] = [];

  parts.push(
    `Patent dynamics for ${indication || therapeuticArea} (${modality}, ${phase}): ` +
    `base 20yr patent with ${ptaAdjustment_years.toFixed(1)}yr PTA ` +
    `and ${pteAdjustment_years.toFixed(1)}yr PTE (Hatch-Waxman).`,
  );

  if (biologicFlag) {
    parts.push('Biologic exclusivity: 12yr under BPCIA (biosimilar filing gate at 4yr, approval at 12yr).');
  }
  if (smallMoleculeFlag) {
    parts.push('NCE exclusivity: 5yr from NDA approval.');
  }
  if (regulatoryDesignations.orphan) {
    parts.push('Orphan Drug exclusivity: 7yr (US) / 10yr (EU) from approval.');
  }
  if (pediatricExclusivity_years > 0) {
    parts.push('Pediatric exclusivity: +6 months (PREA/BPCA).');
  }

  parts.push(
    `Effective LOE: ${effectiveLOE_yearsFromApproval.toFixed(1)}yr from approval (~${loeYear}), ` +
    `driven by ${patentDriven ? 'patent term' : 'regulatory exclusivity'}. ` +
    `Post-LOE: ${erosionProfile.pattern} erosion ` +
    `(${(erosionProfile.year1Erosion * 100).toFixed(0)}% yr1, ` +
    `${(erosionProfile.steadyStateGenericShare * 100).toFixed(0)}% steady-state at ` +
    `${erosionProfile.yearsToSteadyState}yr).`,
  );

  if (authorizedGenericImpact) {
    parts.push('Authorized generic launch expected at LOE to capture generic-tier revenue.');
  }
  if (paragraphIVRisk.probability > 0.5) {
    const timing = paragraphIVRisk.expectedEntryTiming_years;
    parts.push(
      `High Para IV risk (${(paragraphIVRisk.probability * 100).toFixed(0)}%): ` +
      `generic entry ~${Math.abs(timing).toFixed(1)}yr ${timing < 0 ? 'before' : 'after'} patent expiry.`,
    );
  }

  return {
    basePatentLife_years,
    ptaAdjustment_years,
    pteAdjustment_years,
    pediatricExclusivity_years,
    orphanExclusivity_years,
    nceExclusivity_years,
    biologicExclusivity_years,
    effectiveLOE_yearsFromApproval,
    genericEntryProfile,
    paragraphIVRisk,
    authorizedGenericImpact,
    narrative: parts.join(' '),
  };
}
