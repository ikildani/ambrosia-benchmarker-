/**
 * Probability-of-Success (PoS) Reference Tables
 *
 * Comprehensive phase transition rates, modality adjustments, regulatory
 * designation uplifts, phase durations, cost estimates, and revenue model
 * parameters for the rNPV financial modeling engine.
 *
 * Primary sources:
 *   - BIO/Informa "Clinical Development Success Rates and Contributing
 *     Factors 2011-2020" (published 2021)
 *   - Citeline/Norstella Phase Transition Analysis 2014-2023 (published 2024):
 *     Phase I 47%, Phase II 28%, Phase III 55%, NDA/BLA 92%, overall LoA 6.7%
 *   - Nature Communications "Dynamic clinical trial success rates for drugs
 *     in the 21st century" (2025): disease-area and modality stratification
 *   - Tufts NEWDIGS Cell & Gene Therapy Success Rates (2024):
 *     CAR-T/TCR 17% LoA from P1 (3x oncology average), Gene therapy 28% LoA
 *   - FDA CDER Novel Drug Approvals 2021-2026: 55 (2023), 50 (2024), 46 (2025)
 *   - Nature Reviews Drug Discovery annual approval analyses (2021-2026)
 *   - Wong, Siah & Lo, "Estimation of clinical trial success rates and
 *     related parameters", Biostatistics (2019)
 *   - DiMasi et al., "Innovation in the pharmaceutical industry",
 *     J Health Econ (2016) -- cost estimates, inflation-adjusted
 *   - EvaluatePharma World Preview reports (2022-2026)
 *   - ADC PTRS: 53% Phase 3 regulatory success vs 41% oncology average (ZS 2024)
 *
 * Calibration note (April 2026):
 * Tables updated from 2011-2020 baseline to 2014-2023 Citeline data +
 * 2021-2026 FDA approval trends. Key changes vs prior version:
 *   - Oncology P2→P3: 0.29→0.32 (biomarker-selected + ADC programs lifting average)
 *   - Oncology P3→Approval: 0.55→0.58 (precision medicine, accelerated pathways)
 *   - Neurology P3→Approval: 0.50→0.53 (anti-amyloid precedent, orexin agonists)
 *   - Metabolic P2→P3: 0.33→0.40 (GLP-1/incretin near-zero P3 failure rate)
 *   - Metabolic P3→Approval: 0.60→0.68 (resmetirom MASH + GLP-1 approvals)
 *   - Hematology P2→P3: 0.38→0.44 (CAR-T heme 3x oncology average)
 *   - Hematology P3→Approval: 0.62→0.68 (highest TA LoA at 26.1%)
 *   - Rare Disease added as standalone TA (25% overall LoA, orphan advantage)
 *   - Dermatology added (IL-17/IL-23/TYK2 validated pipeline)
 *   - Gastroenterology added (IBD biologics + eosinophilic programs)
 *
 * @module lib/financial/pos-tables
 */

import type { PhaseTransitionRates } from './types';
import { applyIndicationModifier } from './indication-pos-modifiers';
import { getTier3CalibratedIndication } from './indication-tier3-calibration';
import { getTimeWindowedPoS, type TimeWindow } from './pos-time-windows';

// ---------------------------------------------------------------------------
// Base Transition Rates by Therapeutic Area
// ---------------------------------------------------------------------------

/**
 * Phase transition probabilities indexed by therapeutic area.
 *
 * These are base rates before any modality, biomarker, or regulatory
 * adjustments. They represent the historical average for each TA across
 * all modalities and trial designs.
 *
 * Key observations from published data:
 *   - Oncology: Very low Phase 2->3 (0.29) due to high efficacy bar and
 *     heterogeneous tumor biology. Overall LoA ~5%.
 *   - Neurology: Low Phase 2->3 (0.24) driven by CNS target engagement
 *     challenges, BBB penetration, and subjective endpoints (cognitive
 *     scales). Longest timelines. Overall LoA ~6%.
 *   - Infectious Disease: Highest overall PoS (~15%) due to clear
 *     endpoints (viral load, bacterial clearance) and well-understood
 *     pharmacology.
 *   - Cardiovascular: Large outcomes trials inflate cost and time;
 *     moderate PoS but demanding Phase 3 requirements (CVOTs).
 *   - Ophthalmology: Favorable anatomy (local delivery, measurable
 *     endpoints like visual acuity), relatively high Phase 2->3.
 */
export const POS_BY_THERAPEUTIC_AREA: Record<string, PhaseTransitionRates> = {
  /**
   * Oncology -- high attrition in Phase 2 due to heterogeneous tumor
   * biology and evolving standard-of-care. Phase 3 approval rate has
   * improved with biomarker-selected populations and accelerated pathways.
   */
  oncology: {
    discoveryToPreclinical: 0.45,
    preclinicalToPhase1: 0.60,
    phase1ToPhase2: 0.50,  // Citeline 2014-2023: P1 success 47% overall; oncology slightly above due to biomarker selection
    phase1_2ToPhase2: 0.42,
    phase2ToPhase3: 0.32,  // Up from 0.29: ADCs at 42%+, biomarker-selected populations lifting average (ZS 2024, BIO)
    phase2_3ToPhase3: 0.58, // Adaptive designs improving; EV-302, DESTINY-Breast03 precedents
    phase3ToApproval: 0.58, // Up from 0.55: accelerated approvals + precision oncology; FDA approved 16 oncology drugs in 2025 alone
    ndaFiledToApproval: 0.91, // Citeline: 92% overall, oncology slightly below average (post-marketing confirmatory failures)
    approvalToLaunch: 0.95,
  },

  /**
   * Neurology -- the most difficult therapeutic area for drug development.
   * CNS penetration, subjective clinical endpoints (ADAS-Cog, UPDRS),
   * long trial durations, and high placebo response rates all contribute
   * to the lowest Phase 2->3 success rate across major TAs.
   *
   * Recent amyloid antibody approvals (lecanemab, donanemab) have modestly
   * improved Phase 3->Approval for validated targets, but Phase 2->3
   * remains the critical bottleneck.
   */
  neurology: {
    discoveryToPreclinical: 0.40,
    preclinicalToPhase1: 0.55,
    phase1ToPhase2: 0.46,  // Slightly below average — CNS PK/PD challenges persist
    phase1_2ToPhase2: 0.38,
    phase2ToPhase3: 0.26,  // Up from 0.24: anti-amyloid (lecanemab/donanemab) + orexin (Lilly/Centessa) validated new endpoints
    phase2_3ToPhase3: 0.50, // Modest improvement — still lowest TA
    phase3ToApproval: 0.53, // Up from 0.50: Kisunla (donanemab) 2024, multiple psychiatry approvals (KarXT), orexin agonists
    ndaFiledToApproval: 0.89, // Improved slightly — FDA more receptive to surrogate endpoints post-Alzheimer's debate
    approvalToLaunch: 0.93,
  },

  /**
   * Immunology/Inflammation -- benefits from well-validated targets
   * (TNF, IL-17, IL-23, JAK) and objective clinical endpoints (ACR,
   * PASI, Mayo score). Biomarker-rich environment with multiple
   * precedent approvals informing trial design.
   *
   * Phase 2->3 success is moderate-to-good for validated mechanisms
   * but drops for novel targets in diseases like lupus/scleroderma.
   */
  immunology: {
    discoveryToPreclinical: 0.48,
    preclinicalToPhase1: 0.65,
    phase1ToPhase2: 0.55,
    phase1_2ToPhase2: 0.45,
    phase2ToPhase3: 0.37,  // Up from 0.35: TL1A (tulisokibart), CAR-T autoimmune, IL-23/TYK2 validated pipelines
    phase2_3ToPhase3: 0.60, // Strong adaptive design track record in IBD/RA
    phase3ToApproval: 0.64, // Up from 0.62: well-validated targets, multiple 2023-2025 approvals (bimekizumab, deucravacitinib)
    ndaFiledToApproval: 0.92,
    approvalToLaunch: 0.95,
  },

  /**
   * Metabolic -- highly variable across indications. GLP-1/incretin
   * programs have excellent success rates in obesity/T2D, while
   * NASH/MASH programs historically had very high attrition (improving
   * post-resmetirom approval). Rare metabolic diseases benefit from
   * orphan designations and smaller trials.
   *
   * The weighted average reflects the mix of validated (diabetes) and
   * challenging (NASH) indications.
   */
  metabolic: {
    discoveryToPreclinical: 0.46,
    preclinicalToPhase1: 0.62,
    phase1ToPhase2: 0.56,  // Up from 0.54: GLP-1/incretin programs with strong PK/PD translating well
    phase1_2ToPhase2: 0.46,
    phase2ToPhase3: 0.40,  // Up from 0.33: GLP-1 P3 success near 100% (orforglipron, retatrutide, CagriSema all positive); resmetirom MASH approval
    phase2_3ToPhase3: 0.62, // GLP-1 adaptive designs showing strong signal
    phase3ToApproval: 0.68, // Up from 0.60: zero GLP-1 P3 failures 2023-2026; Wegovy oral approved; MASH breakthrough
    ndaFiledToApproval: 0.93, // Improved — FDA priority review for obesity/MASH
    approvalToLaunch: 0.95,
  },

  /**
   * Cardiovascular -- strong preclinical-to-Phase 1 progression but
   * demanding Phase 3 requirements. Large cardiovascular outcomes trials
   * (CVOTs) required by FDA add time, cost, and binary event-driven risk.
   * Heart failure programs have improved recently (SGLT2i, omecamtiv).
   *
   * Phase 2->3 is moderate because proof-of-concept on surrogate endpoints
   * (LDL, BP) is relatively clear, but Phase 3->Approval requires large
   * outcomes data.
   */
  cardiovascular: {
    discoveryToPreclinical: 0.44,
    preclinicalToPhase1: 0.60,
    phase1ToPhase2: 0.50,
    phase1_2ToPhase2: 0.40,
    phase2ToPhase3: 0.32,  // Up from 0.30: SGLT2i class expansion, PCSK9 follow-ons, aficamten (HCM) success
    phase2_3ToPhase3: 0.56,
    phase3ToApproval: 0.60, // Up from 0.58: 5 CV drugs approved in 2025 alone (11% of all approvals)
    ndaFiledToApproval: 0.91,
    approvalToLaunch: 0.94,
  },

  /**
   * Infectious Disease -- the highest overall PoS among major TAs.
   * Clear microbiological endpoints (viral load suppression, bacterial
   * eradication), well-established PK/PD relationships, and shorter
   * trial durations. Antivirals and vaccines benefit from pandemic-era
   * regulatory flexibility.
   *
   * Antibiotics face commercial challenges (limited use = limited revenue)
   * despite reasonable clinical success, reflected in a slightly lower
   * approvalToLaunch rate.
   */
  infectiousDisease: {
    discoveryToPreclinical: 0.50,
    preclinicalToPhase1: 0.68,
    phase1ToPhase2: 0.58,
    phase1_2ToPhase2: 0.48,
    phase2ToPhase3: 0.42,
    phase2_3ToPhase3: 0.62,
    phase3ToApproval: 0.65,
    ndaFiledToApproval: 0.93,
    approvalToLaunch: 0.92,
  },

  /**
   * Ophthalmology -- benefits from local drug delivery (intravitreal,
   * topical), reducing systemic toxicity concerns. Objective endpoints
   * (BCVA, OCT, IOP) enable smaller, faster trials. Anti-VEGF class
   * is well validated.
   *
   * Gene therapy for inherited retinal diseases has boosted Phase 3
   * success rates, though commercial launch can be complex for
   * one-time therapies.
   */
  ophthalmology: {
    discoveryToPreclinical: 0.48,
    preclinicalToPhase1: 0.65,
    phase1ToPhase2: 0.56,
    phase1_2ToPhase2: 0.46,
    phase2ToPhase3: 0.38,
    phase2_3ToPhase3: 0.60,
    phase3ToApproval: 0.63,
    ndaFiledToApproval: 0.92,
    approvalToLaunch: 0.95,
  },

  /**
   * Women's Health -- underserved area with growing pipeline.
   * Endometriosis, uterine fibroids, and PMDD/PPD programs benefit
   * from established endpoints and regulatory precedent. GnRH
   * antagonists and neuroactive steroids have demonstrated strong
   * Phase 3 success.
   *
   * Overall PoS is moderate-to-good, with the main risk being
   * commercial rather than clinical (payer coverage, patient access).
   */
  womensHealth: {
    discoveryToPreclinical: 0.47,
    preclinicalToPhase1: 0.63,
    phase1ToPhase2: 0.55,
    phase1_2ToPhase2: 0.45,
    phase2ToPhase3: 0.36,
    phase2_3ToPhase3: 0.58,
    phase3ToApproval: 0.62,
    ndaFiledToApproval: 0.92,
    approvalToLaunch: 0.94,
  },

  /**
   * Rare Disease -- benefits from orphan drug designation, smaller trial
   * sizes, higher unmet need, and regulatory incentives (breakthrough,
   * accelerated, priority review). Overall LoA ~25% — among the highest
   * across all TAs. Gene therapy for rare diseases shows 28% LoA from P1
   * (Tufts NEWDIGS 2024).
   *
   * Phase 2→3 transition is high because proof-of-concept in a small
   * population is often sufficient for pivotal design. FDA flexibility
   * on endpoints (single-arm, surrogate) further improves P3 success.
   */
  rareDisease: {
    discoveryToPreclinical: 0.50,
    preclinicalToPhase1: 0.68,
    phase1ToPhase2: 0.60,
    phase1_2ToPhase2: 0.50,
    phase2ToPhase3: 0.45,  // High: orphan populations, regulatory flexibility, smaller trials
    phase2_3ToPhase3: 0.65,
    phase3ToApproval: 0.68, // 25% overall LoA (Nature/BIO) implies strong late-stage
    ndaFiledToApproval: 0.94, // Priority review + orphan fast-track
    approvalToLaunch: 0.93, // Slightly lower: reimbursement/access challenges for rare disease drugs
  },

  /**
   * Hematology -- highest overall LoA at 26.1% (Nature Communications 2025).
   * CAR-T for heme malignancies has 17% LoA from P1 — 3x the oncology average
   * (Tufts NEWDIGS 2024). Phase 3→Approval near 100% for CAR-T heme.
   *
   * Well-validated endpoints (OS, PFS, MRD, CR rate), established regulatory
   * precedent from 7+ approved CAR-T products, and strong biomarker selection.
   */
  hematology: {
    discoveryToPreclinical: 0.50,
    preclinicalToPhase1: 0.68,
    phase1ToPhase2: 0.58,
    phase1_2ToPhase2: 0.48,
    phase2ToPhase3: 0.44,  // CAR-T heme lifting average significantly
    phase2_3ToPhase3: 0.65,
    phase3ToApproval: 0.68, // Highest TA: 26.1% overall LoA, strong P3 conversion
    ndaFiledToApproval: 0.94,
    approvalToLaunch: 0.95,
  },

  /**
   * Dermatology -- benefits from visible, objective endpoints (PASI, IGA,
   * EASI) and well-validated targets (IL-17, IL-23, IL-4/13, TYK2, JAK).
   * Strong recent pipeline: bimekizumab, deucravacitinib, ritlecitinib.
   *
   * Phase 2→3 is moderate-to-good because topical delivery enables
   * earlier proof-of-concept, and systemic biologics have precedent.
   */
  dermatology: {
    discoveryToPreclinical: 0.48,
    preclinicalToPhase1: 0.65,
    phase1ToPhase2: 0.55,
    phase1_2ToPhase2: 0.45,
    phase2ToPhase3: 0.38,
    phase2_3ToPhase3: 0.60,
    phase3ToApproval: 0.64,
    ndaFiledToApproval: 0.93,
    approvalToLaunch: 0.95,
  },

  /**
   * Gastroenterology -- IBD biologics (anti-TNF, anti-integrin, IL-23,
   * S1P) have established regulatory pathways. Eosinophilic diseases
   * emerging (dupilumab EoE). MASH/NASH crossover with metabolic TA.
   *
   * Phase 2→3 moderate due to high placebo response in IBD trials
   * and evolving endpoint requirements (endoscopic + clinical).
   */
  gastroenterology: {
    discoveryToPreclinical: 0.46,
    preclinicalToPhase1: 0.62,
    phase1ToPhase2: 0.52,
    phase1_2ToPhase2: 0.42,
    phase2ToPhase3: 0.34,  // IBD placebo response is a challenge; eosinophilic newer
    phase2_3ToPhase3: 0.56,
    phase3ToApproval: 0.62,
    ndaFiledToApproval: 0.92,
    approvalToLaunch: 0.94,
  },
};

// ---------------------------------------------------------------------------
// Modality Adjustment Factors
// ---------------------------------------------------------------------------

/**
 * Multiplicative adjustment to base PoS by drug modality.
 *
 * A factor of 1.0 means the modality performs at the TA average.
 * Factors > 1.0 indicate a validated mechanism with lower attrition
 * (e.g., GLP-1 agonists at 1.15). Factors < 1.0 indicate novel or
 * technically challenging modalities with higher attrition (e.g.,
 * in vivo CAR-T at 0.40).
 *
 * These factors are applied to all phase transitions except
 * approval->launch (which is primarily administrative/commercial).
 *
 * Source: Cross-referenced from BIO/Informa modality stratification,
 * Nature Reviews Drug Discovery modality analyses, Tufts NEWDIGS
 * cell/gene therapy analysis (2024), ZS ADC PTRS analysis (2024),
 * and internal deal database calibration.
 *
 * Calibration note (April 2026):
 *   - ADC: 0.85→1.20 (53% P3 PTRS vs 41% oncology average, ZS 2024; 15 FDA-approved ADCs)
 *   - CAR-T heme: 0.70→1.30 (17% LoA from P1 = 3x oncology avg, Tufts NEWDIGS; P3→FDA 100%)
 *   - Gene therapy: 0.55→0.90 (28% LoA from P1 = 2-3.5x average, Tufts NEWDIGS)
 *   - GLP-1: 1.15→1.30 (near-zero P3 failure rate 2023-2026)
 */
export const POS_MODALITY_ADJUSTMENT: Record<string, number> = {
  // --- Cross-therapeutic modalities ---
  /** Traditional oral/injectable small molecules -- baseline */
  smallMolecule: 1.00,
  /** Monoclonal antibodies -- validated platform, well-understood PK */
  mab: 1.08,
  /** ADCs -- PTRS 53% vs 41% oncology avg (ZS 2024). 15 FDA-approved. Premium modality. */
  adc: 1.20,
  /** Bispecific antibodies -- 4 new approvals in 2024 (tarlatamab, zanidatamab, zenocutuzumab, odronextamab). Still complex manufacturing but accelerating class. */
  bispecific: 0.95,  // Up from 0.80: 4 new approvals in 2024 validates the platform. Still below mAb baseline due to CMC complexity.
  /** T-cell engagers (BiTE, etc.) -- cytokine release syndrome risk */
  tCellEngager: 0.78,
  /** Peptides -- good oral bioavailability advances, established PK */
  peptide: 0.95,

  // --- Oncology-specific modalities ---
  /** CAR-T heme -- 17% LoA from P1 = 3x oncology avg (Tufts NEWDIGS 2024). 7 FDA-approved. P3→FDA = 100% */
  carT_heme: 1.30,
  /** CAR-T solid tumors -- TME/trafficking challenges persist. afamitresgene (sarcoma) first approval 2024 but overall low response rates */
  carT_solid: 0.55,
  /** Non-CAR-T cell therapies (TIL, NK, allogeneic) -- emerging, lifileucel (TIL) approved 2024 */
  cellTherapy: 0.70,
  /** Gene therapy -- 28% LoA from P1 = 2-3.5x average (Tufts NEWDIGS 2024). P2 65% higher than avg */
  geneTherapy: 0.90,
  /** Radiopharmaceuticals -- growing evidence base (Pluvicto precedent) */
  radiopharmaceutical: 0.80,
  /** mRNA therapeutics (non-vaccine) -- delivery challenges for non-liver targets */
  mrna: 0.70,
  /** RNA interference (siRNA) -- GalNAc-liver validated, other tissues harder */
  rnai: 0.80,
  /** PROTACs / targeted protein degraders -- novel MOA, oral bioavailability */
  protac: 0.70,
  /** Molecular glue degraders -- very novel, limited clinical precedent */
  molecularGlue: 0.65,
  /** Therapeutic cancer vaccines -- historically challenging, mRNA-neoantigen improving */
  therapeuticVaccine: 0.50,
  /** Oncolytic viruses -- manufacturing and efficacy challenges */
  oncolyticVirus: 0.45,

  // --- Neurology-specific modalities ---
  /** Blood-brain barrier platform technologies -- enabling but risky */
  bbbPlatform: 0.55,
  /** Antisense oligonucleotides (nusinersen precedent for SMA) */
  aso: 0.75,
  /** Psychedelic-derived therapies -- regulatory uncertainty, trial design complexity */
  psychedelic: 0.60,
  /** Ion channel modulators -- well-studied class, selectivity challenges */
  ionChannel: 0.85,
  /** Tau-targeting therapies (Alzheimer's) -- no clinical validation yet */
  tauTargeting: 0.45,
  /** Stem cell therapies for neurodegeneration -- very early, complex MOA */
  stemCell: 0.40,
  /** General oligonucleotide therapeutics */
  oligonucleotide: 0.72,

  // --- Immunology-specific modalities ---
  /** Autologous CAR-T for autoimmune diseases -- very novel application */
  carT_autoimmune: 0.50,
  /** In vivo CAR-T (no ex vivo manufacturing) -- preclinical/early clinical */
  inVivoCarT: 0.40,
  /** CAR-Treg (regulatory T cells) -- extremely novel, minimal clinical data */
  carTreg: 0.35,
  /** FcRn antagonists (efgartigimod precedent) -- validated mechanism */
  fcrnAntagonist: 0.90,
  /** Complement pathway inhibitors (eculizumab class) -- validated for PNH/aHUS */
  complementInhibitor: 0.85,
  /** JAK inhibitors -- well-validated class with known safety profile */
  jakInhibitor: 1.10,
  /** S1P receptor modulators (fingolimod class) -- established MOA */
  s1pModulator: 1.05,
  /** Oral integrin antagonists -- emerging with mixed Phase 2 data */
  oralIntegrin: 0.75,
  /** Dual cytokine antagonists -- novel combinations, limited precedent */
  dualAntagonist: 0.70,
  /** TL1A inhibitors -- hot target with strong Phase 2 data (IBD) */
  tl1aInhibitor: 0.80,

  // --- Metabolic-specific modalities ---
  /** GLP-1 receptor agonists -- near-zero P3 failure rate 2023-2026 (orforglipron, retatrutide, CagriSema, oral semaglutide all positive) */
  glp1Agonist: 1.30,
  /** Dual GLP-1/GIP agonists (tirzepatide class) -- strong validation */
  dualIncretin: 0.95,
  /** Triple agonist (GLP-1/GIP/glucagon) -- promising but limited Phase 3 data */
  tripleIncretin: 0.75,
  /** SGLT2 inhibitors -- well-validated class with CV/renal benefits */
  sglt2Inhibitor: 1.10,
  /** Amylin analogs (cagrilintide class) -- growing validation */
  amylinAnalog: 0.85,
  /** Oral peptide formulations -- bioavailability challenges */
  oralPeptide: 0.70,
  /** Anti-activin therapies (bimagrumab class for obesity/muscle) */
  antiActivin: 0.80,
  /** Microbiome-based therapeutics -- high attrition, few precedent approvals */
  microbiomeBased: 0.45,

  // --- Cardiovascular-specific modalities ---
  /** Cardiac myosin inhibitors (mavacamten precedent for HCM) */
  myosinInhibitor: 0.75,
  /** Novel anticoagulants (Factor XI/XIa class) -- de-risked by FXa precedent */
  anticoagulantNovel: 0.85,
  /** RNA therapeutics for CV targets (inclisiran precedent) */
  rnaCardio: 0.70,
  /** PCSK9-targeting therapies -- fully validated class */
  pcsk9Targeting: 1.10,

  // --- Infectious Disease-specific modalities ---
  /** Direct-acting antivirals -- strong PK/PD, clear endpoints */
  antiviral: 0.90,
  /** Novel-class antibiotics -- clinical success OK but commercial risk */
  antibioticNovel: 0.65,
  /** Preventive vaccines -- well-established platform, mRNA accelerating */
  vaccinePreventive: 0.85,
  /** Bacteriophage therapy -- very novel, limited clinical precedent */
  phageTherapy: 0.40,

  // --- Ophthalmology-specific modalities ---
  /** Anti-VEGF therapies (ranibizumab/aflibercept class) -- gold standard */
  antiVegf: 1.15,
  /** Gene therapy for inherited retinal diseases (Luxturna precedent, 28% LoA class avg) */
  geneTherapyOcular: 0.85,
  /** Intravitreal depot/implant formulations -- established delivery route */
  intravitreal: 0.95,
  /** Topical ophthalmic formulations -- bioavailability challenges */
  topicalOphthalmic: 0.80,

  // --- Women's Health-specific modalities ---
  /** GnRH antagonists (elagolix/relugolix class) -- validated MOA */
  gnrhAntagonist: 1.05,
  /** Hormone replacement/modulation therapies -- extensive precedent */
  hormoneTherapy: 1.10,
  /** Neuroactive steroids (brexanolone/zuranolone class) -- emerging */
  neuroactiveSteroid: 0.75,

  // --- Missing modalities added April 2026 ---
  /** Anti-TL1A antibodies (tulisokibart, PRA023) -- emerging IBD/fibrosis target, strong P2 data */
  antiTl1a: 0.85,
  /** Bispecific antibodies for heme (glofitamab, epcoritamab) -- validated class, 2 approved */
  bispecificHeme: 1.10,
  /** BTK inhibitors (ibrutinib, acalabrutinib class) -- well-validated in heme */
  btki: 1.15,
  /** Enzyme replacement therapy (ERT) -- validated platform for LSDs */
  enzymeReplacement: 1.10,
  /** Gene editing (CRISPR, base editing) -- Casgevy approved 2023, emerging platform */
  geneEditing: 0.75,
  /** Gene therapy for rare diseases -- 28% LoA from P1, Tufts NEWDIGS 2024 */
  geneTherapyRare: 0.95,
  /** Gut-selective integrin antagonists (vedolizumab class) -- well-validated IBD target */
  gutSelectiveIntegrin: 1.05,
  /** IL-13 inhibitors (tralokinumab) -- validated in atopic dermatitis */
  il13Inhibitor: 1.05,
  /** IL-17 inhibitors (secukinumab, ixekizumab, bimekizumab) -- best-in-class derm */
  il17Inhibitor: 1.15,
  /** IL-23 for GI (guselkumab, risankizumab in IBD) -- strong P3 data */
  il23GI: 1.05,
  /** JAK inhibitors for dermatology (ritlecitinib, baricitinib) -- validated class */
  jakInhibitorDerm: 1.08,
  /** Substrate reduction therapy (eliglustat class) -- validated for Gaucher/Fabry */
  substrateReduction: 1.05,
  /** Topical biologics (emerging class) -- early platform, delivery challenges */
  topicalBiologic: 0.60,
};

// ---------------------------------------------------------------------------
// Biomarker Selection Impact
// ---------------------------------------------------------------------------

/**
 * Impact of biomarker-driven patient selection on PoS.
 *
 * Trials using validated predictive biomarkers for patient enrichment
 * demonstrate ~30% higher probability of success across phases, driven
 * by better signal-to-noise ratios and more homogeneous patient populations.
 *
 * Source: BIO/Informa 2021 -- "Selection biomarkers increased overall
 * LOA from 7.9% to 15.9% (2x), with the strongest effect in Phase 2."
 *
 * We use a conservative 1.30x multiplier (vs. the observed 2x) because
 * the published figure includes selection bias from well-studied targets.
 */
export const BIOMARKER_POS_UPLIFT = {
  /** Trial uses a validated predictive/selection biomarker */
  selected: 1.30,
  /** No biomarker selection or biomarker is prognostic only */
  unselected: 1.00,
} as const;

// ---------------------------------------------------------------------------
// Regulatory Designation Impact
// ---------------------------------------------------------------------------

/**
 * Multiplicative uplift to approval probability from regulatory designations.
 *
 * These designations provide increased FDA/EMA interaction, rolling review,
 * and priority review timelines. Empirical data shows they correlate with
 * higher approval rates, though causality is debated (selection effect:
 * better drugs tend to get designations).
 *
 * Source: FDA CDER annual reports 2021-2026; Darrow et al., NEJM 2020;
 * EMA PRIME outcomes reports; FDA accelerated approval withdrawal
 * analysis 2023-2024.
 *
 * Calibration note (April 2026):
 * - Accelerated approval reduced from 1.25→1.15 due to multiple FDA
 *   withdrawals in 2023-2024 (Aduhelm, Makena, danicopan) and stricter
 *   confirmatory trial requirements under FDORA.
 * - Breakthrough maintained at 1.20 — still the strongest signal.
 * - RMAT (Regenerative Medicine Advanced Therapy) added for cell/gene.
 *
 * When multiple designations are present, effects are multiplicative but
 * capped at 1.5x total to avoid unrealistic PoS inflation.
 */
export const REGULATORY_POS_UPLIFT = {
  /** FDA Breakthrough Therapy -- strongest signal of regulatory support */
  breakthrough: 1.20,
  /** FDA Fast Track -- modest uplift, more common designation */
  fastTrack: 1.10,
  /** Orphan Drug -- smaller populations, lower regulatory bar, higher PoS */
  orphan: 1.15,
  /** FDA Accelerated Approval -- reduced from 1.25 post-2023 FDA withdrawal wave (FDORA) */
  acceleratedApproval: 1.15,
  /** EMA PRIME (Priority Medicines) -- EU equivalent of breakthrough */
  prime: 1.10,
  /** FDA RMAT (Regenerative Medicine Advanced Therapy) -- for cell/gene therapies */
  rmat: 1.15,
} as const;

/**
 * Maximum combined regulatory uplift multiplier.
 * Prevents stacking of multiple designations from producing unrealistic
 * probabilities. Example: breakthrough + orphan + fastTrack uncapped
 * would be 1.20 * 1.15 * 1.10 = 1.518; we cap at 1.50.
 */
export const MAX_REGULATORY_UPLIFT = 1.50;

// ---------------------------------------------------------------------------
// Phase Duration (Years)
// ---------------------------------------------------------------------------

/**
 * Expected duration in years to complete each development phase,
 * stratified by therapeutic area.
 *
 * These are median durations; actual timelines can vary significantly
 * based on trial design, enrollment speed, and regulatory interactions.
 *
 * 'regulatory' includes NDA/BLA filing, FDA review (standard or priority),
 * advisory committee, and approval -- typically 1.0-1.5 years.
 *
 * Source: Tufts CSDD Phase duration analysis; IntuitionLabs/ICON 2025
 * survey (P1: 33.1mo, P2: 37.9mo, P3: 45.1mo mean across all TAs);
 * FDA review timelines 2024; BIO/Informa dataset.
 *
 * Calibration note (April 2026):
 * Updated using 2025 mean phase durations as baseline, then adjusted
 * per TA. Values represent median durations for successful programs
 * (shorter than mean since failed programs drag on longer).
 * Key changes: neurology P3 extended (slow endpoints, large trials),
 * metabolic P3 extended (large outcomes trials for GLP-1/MASH),
 * rare disease shortened (smaller populations, regulatory flexibility).
 */
export const PHASE_DURATION: Record<string, Record<string, number>> = {
  // 2025 baseline (IntuitionLabs/ICON/Tufts): P1 mean 2.8yr, P2 3.2yr, P3 3.8yr
  // Values below are median for successful programs (~20% shorter than mean)
  oncology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.8,   // Up: expansion cohorts + dose-optimization extending P1
    phase1_2: 2.8,
    phase2: 2.5,   // Biomarker-selected populations keep P2 efficient
    phase2_3: 3.5,
    phase3: 3.2,   // Up from 3.0: more comparator arms, combination trials
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  neurology: {
    discovery: 3.5,
    preclinical: 2.5,
    phase1: 1.8,
    phase1_2: 3.0,
    phase2: 3.2,   // Up: slow cognitive endpoints, high placebo response
    phase2_3: 4.0,
    phase3: 4.0,   // Up from 3.5: large trials, 18-24mo endpoints (ADAS-Cog, CDR-SB)
    nda_filed: 1.5,
    regulatory: 1.2, // Down from 1.5: FDA more engaged post-Alzheimer's accelerated approvals
  },
  immunology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.5,
    phase2: 2.5,
    phase2_3: 3.5,
    phase3: 3.0,
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  metabolic: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.5,
    phase2: 2.5,
    phase2_3: 4.0,
    phase3: 4.0,   // Up from 3.5: large CV outcomes trials required for GLP-1/obesity
    nda_filed: 1.0,
    regulatory: 0.8, // Priority review for obesity drugs (6-month PDUFA)
  },
  cardiovascular: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 3.0,
    phase2: 3.0,
    phase2_3: 4.5,
    phase3: 4.5,   // Up from 4.0: large CVOTs (10K+ patients, event-driven endpoints)
    nda_filed: 1.5,
    regulatory: 1.2, // Down from 1.5: priority review for some CV drugs
  },
  infectiousDisease: {
    discovery: 2.0,
    preclinical: 1.5,
    phase1: 1.0,
    phase1_2: 2.0,
    phase2: 2.0,
    phase2_3: 3.0,
    phase3: 2.5,
    nda_filed: 1.0,
    regulatory: 0.8, // Faster regulatory for AMR/pandemic priority
  },
  ophthalmology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.0,
    phase2: 2.0,
    phase2_3: 3.0,
    phase3: 2.5,
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  womensHealth: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.5,
    phase2: 2.5,
    phase2_3: 3.5,
    phase3: 3.0,
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  rareDisease: {
    discovery: 3.0,
    preclinical: 2.5,
    phase1: 1.5,
    phase1_2: 2.0,
    phase2: 2.0,
    phase2_3: 2.5,
    phase3: 2.5,   // Smaller trials, faster enrollment in rare populations
    nda_filed: 1.0,
    regulatory: 0.8, // Priority review + orphan expedited pathways
  },
  hematology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.5,
    phase2: 2.5,
    phase2_3: 3.0,
    phase3: 3.0,
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  dermatology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.0,
    phase2: 2.0,
    phase2_3: 3.0,
    phase3: 2.5,   // Visible endpoints, faster readouts
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  gastroenterology: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 2.5,
    phase2: 2.5,
    phase2_3: 3.5,
    phase3: 3.0,   // IBD trials require endoscopic + clinical endpoints
    nda_filed: 1.0,
    regulatory: 1.0,
  },
};

// ---------------------------------------------------------------------------
// Phase-Specific R&D Cost Estimates ($M)
// ---------------------------------------------------------------------------

/**
 * Estimated cost to complete each development phase, in millions USD.
 *
 * These are median out-of-pocket costs (not capitalized/risk-adjusted).
 * Actual costs vary widely based on trial size, number of sites,
 * comparator arm requirements, and geographic distribution.
 *
 * Oncology Phase 3 costs are moderate ($150M) because many oncology
 * trials are single-arm or use smaller populations with biomarker
 * enrichment. Cardiovascular Phase 3 costs are highest ($250M) due to
 * mandatory large CVOTs with thousands of patients and years of follow-up.
 *
 * Source: DiMasi et al., J Health Econ (2016), inflation-adjusted to 2025 USD
 * (~35% uplift from 2016 baseline); Tufts CSDD cost surveys; Deloitte
 * "Measuring the return from pharmaceutical innovation" 2025 ($2.23B/asset);
 * IQVIA Global Trends in R&D 2024; per-patient costs $113K-$137K (2025 data).
 * Oncology premium: 30-40% above TA average (IQVIA 2025).
 *
 * Calibration note (April 2026):
 * Costs updated with ~35% inflation adjustment from 2016 baselines.
 * Oncology P3 costs remain moderate (biomarker enrichment enables smaller trials).
 * Cardiovascular P3 costs highest (large CVOTs with outcomes endpoints).
 * Cell/gene therapy costs added (high manufacturing + logistics).
 */
export const PHASE_COSTS: Record<string, Record<string, number>> = {
  oncology: {
    discovery: 10,
    preclinical: 20,
    phase1: 35,
    phase1_2: 60,
    phase2: 70,
    phase2_3: 160,
    phase3: 200,
    nda_filed: 7,
    regulatory: 7,
  },
  neurology: {
    discovery: 12,
    preclinical: 25,
    phase1: 40,
    phase1_2: 75,
    phase2: 80,
    phase2_3: 200,
    phase3: 270,
    nda_filed: 7,
    regulatory: 7,
  },
  immunology: {
    discovery: 10,
    preclinical: 20,
    phase1: 35,
    phase1_2: 55,
    phase2: 60,
    phase2_3: 135,
    phase3: 160,
    nda_filed: 7,
    regulatory: 7,
  },
  metabolic: {
    discovery: 10,
    preclinical: 20,
    phase1: 35,
    phase1_2: 60,
    phase2: 70,
    phase2_3: 190,
    phase3: 240,
    nda_filed: 7,
    regulatory: 7,
  },
  cardiovascular: {
    discovery: 12,
    preclinical: 25,
    phase1: 40,
    phase1_2: 75,
    phase2: 80,
    phase2_3: 240,
    phase3: 340,
    nda_filed: 7,
    regulatory: 7,
  },
  infectiousDisease: {
    discovery: 7,
    preclinical: 14,
    phase1: 27,
    phase1_2: 40,
    phase2: 48,
    phase2_3: 110,
    phase3: 135,
    nda_filed: 7,
    regulatory: 7,
  },
  ophthalmology: {
    discovery: 8,
    preclinical: 16,
    phase1: 27,
    phase1_2: 48,
    phase2: 55,
    phase2_3: 95,
    phase3: 110,
    nda_filed: 7,
    regulatory: 7,
  },
  womensHealth: {
    discovery: 7,
    preclinical: 14,
    phase1: 27,
    phase1_2: 40,
    phase2: 48,
    phase2_3: 100,
    phase3: 120,
    nda_filed: 7,
    regulatory: 7,
  },
  rareDisease: {
    discovery: 8,
    preclinical: 18,
    phase1: 30,
    phase1_2: 50,
    phase2: 55,
    phase2_3: 90,
    phase3: 110,  // Smaller trials but higher per-patient costs (rare populations)
    nda_filed: 7,
    regulatory: 7,
  },
  hematology: {
    discovery: 10,
    preclinical: 22,
    phase1: 40,
    phase1_2: 70,
    phase2: 75,
    phase2_3: 150,
    phase3: 190,  // CAR-T manufacturing + logistics add significant cost
    nda_filed: 7,
    regulatory: 7,
  },
  dermatology: {
    discovery: 7,
    preclinical: 14,
    phase1: 25,
    phase1_2: 40,
    phase2: 45,
    phase2_3: 90,
    phase3: 110,
    nda_filed: 7,
    regulatory: 7,
  },
  gastroenterology: {
    discovery: 8,
    preclinical: 16,
    phase1: 28,
    phase1_2: 45,
    phase2: 55,
    phase2_3: 110,
    phase3: 140,
    nda_filed: 7,
    regulatory: 7,
  },
};

// ---------------------------------------------------------------------------
// Revenue Curve Parameters
// ---------------------------------------------------------------------------

/**
 * Standard pharma revenue curve assumptions.
 *
 * Models the typical lifecycle of a branded pharmaceutical product:
 *   1. Ramp-up: 4 years from launch to peak sales (S-curve adoption)
 *   2. Peak plateau: 6 years at or near peak revenue
 *   3. Decline: 15% annual erosion from emerging competition
 *   4. LOE cliff: 80% revenue loss upon loss of exclusivity (generic entry)
 *
 * The ramp-up shape follows an S-curve: Year 1 = 20% of peak,
 * Year 2 = 50%, Year 3 = 80%, Year 4 = 100%.
 *
 * Source: EvaluatePharma product lifecycle analysis; IMS Health
 * launch excellence benchmarks.
 */
export const REVENUE_CURVE = {
  /** Years from first commercial sale to peak revenue */
  rampUpYears: 4,
  /** Years at or near peak revenue before competitive erosion */
  peakDurationYears: 6,
  /** Annual revenue decline rate from competition after peak plateau */
  declineRate: 0.15,
  /** Fraction of revenue lost upon loss of exclusivity (generic entry) */
  genericErosion: 0.80,
  /** Years from FDA approval to anticipated loss of exclusivity */
  loeYearsAfterApproval: 12,
} as const;

/**
 * TA-specific overrides to REVENUE_CURVE defaults.
 *
 * Rare disease: orphan exclusivity extends LOE to 14 years (7yr orphan + patent),
 * slower ramp (specialist prescribers), longer peak (captive market), less decline.
 *
 * Oncology: faster ramp (SOC urgency), shorter peak (competition), higher decline.
 *
 * Source: EvaluatePharma lifecycle analysis by TA; FDA orphan exclusivity data.
 */
export const REVENUE_CURVE_OVERRIDES: Record<string, Partial<{ rampUpYears: number; peakDurationYears: number; declineRate: number; genericErosion: number; loeYearsAfterApproval: number }>> = {
  rareDisease: {
    rampUpYears: 3,             // Faster: small patient population, specialist prescribers, high urgency
    peakDurationYears: 8,       // Longer: captive market, fewer competitors
    declineRate: 0.08,          // Slower: less competitive erosion in rare disease
    loeYearsAfterApproval: 14,  // 7yr orphan exclusivity + patent = ~14yr effective exclusivity
  },
  hematology: {
    peakDurationYears: 7,       // Longer than oncology average (fewer competitors)
    loeYearsAfterApproval: 13,  // CAR-T/cell therapy exclusivity slightly longer
  },
  oncology: {
    declineRate: 0.18,          // Faster decline: high competition, new SOC
  },
  metabolic: {
    rampUpYears: 3,             // GLP-1 class: explosive uptake
    peakDurationYears: 8,       // Long patent life, massive TAM
    loeYearsAfterApproval: 13,  // Extended by device delivery + formulation patents
  },
};

/**
 * Indication-Specific Revenue Curves
 *
 * Per-indication revenue projection parameters. Override TA-level curves
 * when more specific data is available. Sources include actual launch
 * trajectories from 2024-2026 launches (Leqembi, Wegovy, Mounjaro, Trikafta,
 * Skyclarys, Rezdiffra, Dupixent, Ozempic, etc.).
 *
 * rampUpYears: Years from launch to peak
 * peakDurationYears: Years at peak before decline
 * declineRate: Annual decline post-peak (before LOE)
 * loeYearsAfterApproval: Years until loss of exclusivity
 *
 * Lookup precedence (in rnpv-engine projectCashFlows):
 *   1. INDICATION_REVENUE_CURVES[input.indication]
 *   2. REVENUE_CURVE_OVERRIDES[input.therapeuticArea]
 *   3. REVENUE_CURVE (default)
 */
export interface IndicationRevenueCurve {
  indication: string;
  ta: string;
  rampUpYears: number;
  peakDurationYears: number;
  declineRate: number;
  loeYearsAfterApproval: number;
  source: string;
  notes?: string;
}

export const INDICATION_REVENUE_CURVES: Record<string, IndicationRevenueCurve> = {
  // --------------------------------------------------------------------------
  // Oncology (12)
  // --------------------------------------------------------------------------
  lung_nsclc: {
    indication: 'lung_nsclc',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 4,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Keytruda NSCLC launch trajectory 2015-2024 (peak $32B, 6y ramp)',
    notes: 'Slow adoption due to biomarker stratification (PD-L1) and sequential line use',
  },
  breast_her2: {
    indication: 'breast_her2',
    ta: 'oncology',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 13,
    source: 'Herceptin → Enhertu trajectory (DESTINY-Breast 2024 label expansions)',
  },
  breast_tnbc: {
    indication: 'breast_tnbc',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 4,
    declineRate: 0.25,
    loeYearsAfterApproval: 12,
    source: 'Trodelvy TNBC launch 2020-2025 (slower than HER2+ subset)',
  },
  melanoma: {
    indication: 'melanoma',
    ta: 'oncology',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Keytruda + Opdivo competitive dynamics 2014-2024',
  },
  colorectal: {
    indication: 'colorectal',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 4,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Avastin/Erbitux historical; slow due to FOLFOX/FOLFIRI SOC entrenchment',
  },
  prostate: {
    indication: 'prostate',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Xtandi/Zytiga 2012-2024 long ramp; androgen pathway durability',
  },
  pancreatic: {
    indication: 'pancreatic',
    ta: 'oncology',
    rampUpYears: 6,
    peakDurationYears: 3,
    declineRate: 0.30,
    loeYearsAfterApproval: 11,
    source: 'Folfirinox/Abraxane SOC entrenchment; historical slow uptake',
    notes: 'Short peak due to poor outcomes, rapid trial-of-new-SOC churn',
  },
  ovarian: {
    indication: 'ovarian',
    ta: 'oncology',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'PARP class (Lynparza, Zejula) fast adoption 2017-2024 in BRCA+ setting',
  },
  head_neck: {
    indication: 'head_neck',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 4,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Keytruda HNSCC (KEYNOTE-048) 2019-2024 typical oncology curve',
  },
  multiple_myeloma: {
    indication: 'multiple_myeloma',
    ta: 'oncology',
    rampUpYears: 4,
    peakDurationYears: 7,
    declineRate: 0.15,
    loeYearsAfterApproval: 13,
    source: 'Revlimid/Darzalex combination durability (Rd, DRd, DKd); long multi-line use',
    notes: 'Extended peak from combination backbones across lines 1-5+',
  },
  dlbcl: {
    indication: 'dlbcl',
    ta: 'oncology',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Rituxan legacy + Polivy/Epkinly new entrants 2019-2024',
  },
  aml: {
    indication: 'aml',
    ta: 'oncology',
    rampUpYears: 5,
    peakDurationYears: 4,
    declineRate: 0.25,
    loeYearsAfterApproval: 12,
    source: 'Venclexta AML (2018) + FLT3 inhibitors; fragmented mutation-stratified market',
  },

  // --------------------------------------------------------------------------
  // Neurology (8)
  // --------------------------------------------------------------------------
  alzheimers: {
    indication: 'alzheimers',
    ta: 'neurology',
    rampUpYears: 6,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 12,
    source: 'Leqembi launch 2023-2026 case study (infrastructure, PET/MRI screening bottleneck)',
    notes: 'Slowest neurology ramp — requires IV infusion, ARIA monitoring, specialist network',
  },
  parkinsons: {
    indication: 'parkinsons',
    ta: 'neurology',
    rampUpYears: 5,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Movement disorder specialist adoption pattern; Nourianz/Gocovri 2019-2024',
  },
  multiple_sclerosis: {
    indication: 'multiple_sclerosis',
    ta: 'neurology',
    rampUpYears: 4,
    peakDurationYears: 7,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Ocrevus 2017-2024 (4y to peak $6B); Tysabri historical analog',
  },
  als: {
    indication: 'als',
    ta: 'neurology',
    rampUpYears: 2,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 14,
    source: 'Radicava/Relyvrio launch 2017-2024; orphan designation',
    notes: 'Small market saturates fast; 14y LOE from orphan exclusivity',
  },
  epilepsy: {
    indication: 'epilepsy',
    ta: 'neurology',
    rampUpYears: 5,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Xcopri (cenobamate) 2020-2024; slow due to AED generic pressure',
  },
  depression: {
    indication: 'depression',
    ta: 'neurology',
    rampUpYears: 3,
    peakDurationYears: 4,
    declineRate: 0.30,
    loeYearsAfterApproval: 11,
    source: 'Spravato 2019-2024; Auvelity 2022-2024 fast primary-care uptake',
    notes: 'Fast adoption followed by rapid SSRI/SNRI generic pressure',
  },
  schizophrenia: {
    indication: 'schizophrenia',
    ta: 'neurology',
    rampUpYears: 5,
    peakDurationYears: 5,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Long-acting injectables (Invega Sustenna/Hafyera, Cobenfy 2024) slow formulary path',
  },
  migraine: {
    indication: 'migraine',
    ta: 'neurology',
    rampUpYears: 3,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'CGRP class (Aimovig, Emgality, Ajovy, Nurtec) 2018-2024 rapid class adoption',
  },

  // --------------------------------------------------------------------------
  // Immunology (7)
  // --------------------------------------------------------------------------
  rheumatoid_arthritis: {
    indication: 'rheumatoid_arthritis',
    ta: 'immunology',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Humira RA launch 2003 + JAK class (Rinvoq, Xeljanz) 2018-2024',
  },
  psoriasis: {
    indication: 'psoriasis',
    ta: 'immunology',
    rampUpYears: 3,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 12,
    source: 'Skyrizi/Otezla/Tremfya 2019-2024 — fast IL-23 class adoption',
  },
  atopic_dermatitis: {
    indication: 'atopic_dermatitis',
    ta: 'immunology',
    rampUpYears: 3,
    peakDurationYears: 7,
    declineRate: 0.15,
    loeYearsAfterApproval: 13,
    source: 'Dupixent 2017-2024 — extreme ramp, $12B by year 6, multi-indication expansion',
    notes: 'Highest-velocity immunology launch on record',
  },
  lupus: {
    indication: 'lupus',
    ta: 'immunology',
    rampUpYears: 5,
    peakDurationYears: 5,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Saphnelo 2021-2024; Benlysta historical slow ramp',
  },
  ibd_uc: {
    indication: 'ibd_uc',
    ta: 'immunology',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Stelara/Entyvio UC 2014-2024; Rinvoq UC 2022',
  },
  ibd_cd: {
    indication: 'ibd_cd',
    ta: 'immunology',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Stelara Crohn\'s 2016-2024; Skyrizi CD 2022-2024',
  },
  asthma: {
    indication: 'asthma',
    ta: 'immunology',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Dupixent asthma (2018), Nucala, Tezspire 2021-2024; split inhaler/biologic market',
  },

  // --------------------------------------------------------------------------
  // Metabolic (5)
  // --------------------------------------------------------------------------
  type2_diabetes: {
    indication: 'type2_diabetes',
    ta: 'metabolic',
    rampUpYears: 3,
    peakDurationYears: 7,
    declineRate: 0.15,
    loeYearsAfterApproval: 13,
    source: 'Ozempic/Mounjaro GLP-1 class 2018-2025 explosive ramp',
  },
  obesity: {
    indication: 'obesity',
    ta: 'metabolic',
    rampUpYears: 2,
    peakDurationYears: 8,
    declineRate: 0.12,
    loeYearsAfterApproval: 13,
    source: 'Wegovy 2021-2024 (2y to peak demand); Zepbound 2023-2025',
    notes: 'Fastest ramp in industry history — demand >> supply',
  },
  nash_mash: {
    indication: 'nash_mash',
    ta: 'metabolic',
    rampUpYears: 5,
    peakDurationYears: 5,
    declineRate: 0.18,
    loeYearsAfterApproval: 12,
    source: 'Rezdiffra (Madrigal) 2024 launch — slow uptake due to biopsy screening requirement',
  },
  dyslipidemia: {
    indication: 'dyslipidemia',
    ta: 'metabolic',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.25,
    loeYearsAfterApproval: 11,
    source: 'PCSK9 class (Repatha/Praluent) 2015-2024; heavy statin generic competition',
  },
  cardiometabolic: {
    indication: 'cardiometabolic',
    ta: 'metabolic',
    rampUpYears: 4,
    peakDurationYears: 5,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Blended cardiometabolic curve; mid-range metabolic assumptions',
  },

  // --------------------------------------------------------------------------
  // Rare Disease (8)
  // --------------------------------------------------------------------------
  dmd: {
    indication: 'dmd',
    ta: 'rareDisease',
    rampUpYears: 2,
    peakDurationYears: 10,
    declineRate: 0.05,
    loeYearsAfterApproval: 14,
    source: 'Sarepta Exondys/Vyondys/Amondys + Elevidys 2023-2025; specialist channel',
    notes: 'Orphan exclusivity + specialist concentration = longest peak in rare disease',
  },
  cystic_fibrosis: {
    indication: 'cystic_fibrosis',
    ta: 'rareDisease',
    rampUpYears: 2,
    peakDurationYears: 10,
    declineRate: 0.05,
    loeYearsAfterApproval: 14,
    source: 'Trikafta/Kaftrio 2019-2025 (2y to peak, $9B+ plateau)',
    notes: 'Near-monopoly Vertex franchise; captures 90%+ eligible population',
  },
  sma: {
    indication: 'sma',
    ta: 'rareDisease',
    rampUpYears: 2,
    peakDurationYears: 9,
    declineRate: 0.08,
    loeYearsAfterApproval: 14,
    source: 'Spinraza 2016-2024; Zolgensma 2019-2024; Evrysdi 2020-2024',
  },
  hae: {
    indication: 'hae',
    ta: 'rareDisease',
    rampUpYears: 2,
    peakDurationYears: 8,
    declineRate: 0.10,
    loeYearsAfterApproval: 13,
    source: 'Takhzyro 2018-2024; Orladeyo 2020-2024 specialist HAE channel',
  },
  spinal_cord_injury: {
    indication: 'spinal_cord_injury',
    ta: 'rareDisease',
    rampUpYears: 3,
    peakDurationYears: 7,
    declineRate: 0.10,
    loeYearsAfterApproval: 14,
    source: 'Tiny rehab market; slow academic center adoption',
  },
  friedreichs_ataxia: {
    indication: 'friedreichs_ataxia',
    ta: 'rareDisease',
    rampUpYears: 3,
    peakDurationYears: 8,
    declineRate: 0.08,
    loeYearsAfterApproval: 14,
    source: 'Skyclarys (Reata/Biogen) 2023-2025 — first approved therapy, orphan exclusivity',
  },
  huntingtons: {
    indication: 'huntingtons',
    ta: 'rareDisease',
    rampUpYears: 3,
    peakDurationYears: 8,
    declineRate: 0.10,
    loeYearsAfterApproval: 14,
    source: 'Austedo HD 2017-2024; specialist neurology centers',
  },
  wilson_disease: {
    indication: 'wilson_disease',
    ta: 'rareDisease',
    rampUpYears: 2,
    peakDurationYears: 9,
    declineRate: 0.05,
    loeYearsAfterApproval: 14,
    source: 'Syprine/Cuprimine historical; tiny chronic population, stable franchise',
  },

  // --------------------------------------------------------------------------
  // Cardiovascular (5)
  // --------------------------------------------------------------------------
  heart_failure: {
    indication: 'heart_failure',
    ta: 'cardiovascular',
    rampUpYears: 5,
    peakDurationYears: 6,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Entresto 2015-2024 slow ramp despite clear guideline inclusion',
  },
  pah: {
    indication: 'pah',
    ta: 'cardiovascular',
    rampUpYears: 3,
    peakDurationYears: 7,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Winrevair (Merck/Acceleron) 2024 launch; Uptravi historical',
    notes: 'Specialist PAH channel accelerates uptake',
  },
  hypercholesterolemia: {
    indication: 'hypercholesterolemia',
    ta: 'cardiovascular',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.22,
    loeYearsAfterApproval: 12,
    source: 'Leqvio 2021-2024; Repatha 2015-2024 (statin overhang)',
  },
  atrial_fibrillation: {
    indication: 'atrial_fibrillation',
    ta: 'cardiovascular',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 12,
    source: 'DOAC class (Eliquis, Xarelto) 2011-2024 rapid class conversion from warfarin',
  },
  atherosclerosis: {
    indication: 'atherosclerosis',
    ta: 'cardiovascular',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Mid-range CV blend; lipid-modifying + anti-inflammatory context',
  },

  // --------------------------------------------------------------------------
  // Infectious Disease (3)
  // --------------------------------------------------------------------------
  hiv: {
    indication: 'hiv',
    ta: 'infectiousDisease',
    rampUpYears: 4,
    peakDurationYears: 8,
    declineRate: 0.15,
    loeYearsAfterApproval: 12,
    source: 'Gilead Biktarvy 2018-2024 ($11B peak); long durability from treatment adherence',
  },
  hepatitis_b: {
    indication: 'hepatitis_b',
    ta: 'infectiousDisease',
    rampUpYears: 5,
    peakDurationYears: 6,
    declineRate: 0.18,
    loeYearsAfterApproval: 12,
    source: 'Vemlidy 2016-2024; slow guideline-driven adoption',
  },
  bacterial_infection: {
    indication: 'bacterial_infection',
    ta: 'infectiousDisease',
    rampUpYears: 3,
    peakDurationYears: 4,
    declineRate: 0.30,
    loeYearsAfterApproval: 10,
    source: 'Recarbrio/Zerbaxa/Xenleta 2019-2024; intense generic + stewardship pressure',
    notes: 'Shortest LOE due to hospital formulary economics + generic competition',
  },

  // --------------------------------------------------------------------------
  // Other (2)
  // --------------------------------------------------------------------------
  amd: {
    indication: 'amd',
    ta: 'ophthalmology',
    rampUpYears: 4,
    peakDurationYears: 7,
    declineRate: 0.18,
    loeYearsAfterApproval: 13,
    source: 'Eylea/Lucentis 2012-2024 long peak; Vabysmo 2022-2024',
  },
  dry_eye: {
    indication: 'dry_eye',
    ta: 'ophthalmology',
    rampUpYears: 4,
    peakDurationYears: 6,
    declineRate: 0.20,
    loeYearsAfterApproval: 12,
    source: 'Xiidra/Restasis 2016-2024; Tyrvaya 2021-2024 chronic disease ramp',
  },

  // --------------------------------------------------------------------------
  // Women's Health (5)
  // --------------------------------------------------------------------------
  endometriosis: { indication: 'endometriosis', ta: 'womensHealth', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Orilissa 2018-2024; Myfembree 2021-2024 ramp' },
  uterineFibroids: { indication: 'uterineFibroids', ta: 'womensHealth', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Myfembree 2021-2024; Oriahnn limited launch' },
  pcos: { indication: 'pcos', ta: 'womensHealth', rampUpYears: 5, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'No approved drug precedent; modeled on chronic endocrine therapy curves' },
  postpartumDepression: { indication: 'postpartumDepression', ta: 'womensHealth', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'Zurzuvae 2023-2024 rapid launch; acute/episodic use pattern' },
  menopause: { indication: 'menopause', ta: 'womensHealth', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Veozah 2023-2024 launch; chronic daily use supports long peak' },

  // --------------------------------------------------------------------------
  // Gastroenterology (5)
  // --------------------------------------------------------------------------
  crohnsDisease: { indication: 'crohnsDisease', ta: 'gastroenterology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Skyrizi CD 2022-2024 rapid adoption; Humira→Skyrizi biosimilar-driven switch' },
  eosinophilicEsophagitis: { indication: 'eosinophilicEsophagitis', ta: 'gastroenterology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Dupixent EoE 2022-2024; chronic biologic use pattern' },
  nonAlcoholicSteatohepatitis: { indication: 'nonAlcoholicSteatohepatitis', ta: 'gastroenterology', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Rezdiffra 2024 launch; GLP-1 competition may shorten peak window' },
  ibsD: { indication: 'ibsD', ta: 'gastroenterology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 11, source: 'Viberzi/Xifaxan 2015-2024; moderate ramp, generic competition' },
  primaryBiliaryCholangitis: { indication: 'primaryBiliaryCholangitis', ta: 'gastroenterology', rampUpYears: 3, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Ocaliva 2016-2024; Livdelzi/Iqirvo 2024 rapid uptake in UDCA-IR' },

  // --------------------------------------------------------------------------
  // Dermatology (5)
  // --------------------------------------------------------------------------
  hidradenitisSuppurativa: { indication: 'hidradenitisSuppurativa', ta: 'dermatology', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Humira HS 2015-2024; slow diagnosis-to-treatment, Cosentyx 2023 launch' },
  alopeciaAreata: { indication: 'alopeciaAreata', ta: 'dermatology', rampUpYears: 3, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Olumiant/Litfulo 2022-2024 rapid market formation' },
  vitiligo: { indication: 'vitiligo', ta: 'dermatology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Opzelura 2022-2024; chronic topical use, slow repigmentation, long patient journey' },
  acne: { indication: 'acne', ta: 'dermatology', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 10, source: 'Winlevi/Aklief 2020-2024; short branded lifecycle due to generic topical competition' },
  chronicUrticaria: { indication: 'chronicUrticaria', ta: 'dermatology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Xolair CSU 2014-2024; chronic biologic use, long peak due to limited alternatives' },

  // --------------------------------------------------------------------------
  // Hematology (5)
  // --------------------------------------------------------------------------
  cll: { indication: 'cll', ta: 'hematology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Ibrutinib 2013-2024 long ramp then zanubrutinib transition; venetoclax time-limited dosing' },
  follicularLymphoma: { indication: 'follicularLymphoma', ta: 'hematology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Rituxan → bispecific transition 2022-2024; relapsed setting first then earlier lines' },
  hodgkinLymphoma: { indication: 'hodgkinLymphoma', ta: 'hematology', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Adcetris 2011-2024; shorter peak due to high cure rate (smaller ongoing market)' },
  myelofibrosis: { indication: 'myelofibrosis', ta: 'hematology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 14, source: 'Jakafi 2011-2024 long peak, chronic daily use, limited competition' },
  itp: { indication: 'itp', ta: 'hematology', rampUpYears: 3, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Nplate/Promacta 2008-2024; chronic TPO-RA use, established class' },

  // --------------------------------------------------------------------------
  // Ophthalmology (5)
  // --------------------------------------------------------------------------
  dryAmdGA: { indication: 'dryAmdGA', ta: 'ophthalmology', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Syfovre/Izervay 2023-2024; slow adoption due to modest efficacy and injection burden' },
  diabeticRetinopathy: { indication: 'diabeticRetinopathy', ta: 'ophthalmology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Eylea DR 2015-2024; Vabysmo durability-driven switch 2022-2024' },
  diabeticMacularEdema: { indication: 'diabeticMacularEdema', ta: 'ophthalmology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Eylea DME 2014-2024 long peak; Vabysmo bispecific 2022 adding durability share' },
  glaucoma: { indication: 'glaucoma', ta: 'ophthalmology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 11, source: 'Rhopressa/Rocklatan 2018-2024; latanoprost generic dominance shortens branded lifecycle' },
  retinitisPigmentosa: { indication: 'retinitisPigmentosa', ta: 'ophthalmology', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 14, source: 'Luxturna 2017-2024; gene therapy one-time dosing, slow genotype-by-genotype expansion' },

  // --------------------------------------------------------------------------
  // Cardiovascular (5)
  // --------------------------------------------------------------------------
  heartFailureHfpef: { indication: 'heartFailureHfpef', ta: 'cardiovascular', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Jardiance HFpEF 2023-2024; SGLT2i class chronic daily use' },
  hypertrophicCardiomyopathy: { indication: 'hypertrophicCardiomyopathy', ta: 'cardiovascular', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Camzyos 2022-2024 rapid launch; first-in-class chronic therapy' },
  coronaryArteryDisease: { indication: 'coronaryArteryDisease', ta: 'cardiovascular', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Repatha/Leqvio 2015-2024; PCSK9 slow initial uptake, now growing' },
  stroke: { indication: 'stroke', ta: 'cardiovascular', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'tPA/TNKase acute setting; short commercial lifecycle for acute therapies' },
  venousThromboembolism: { indication: 'venousThromboembolism', ta: 'cardiovascular', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Eliquis/Xarelto 2012-2024 long peak; chronic use, high adherence' },

  // --------------------------------------------------------------------------
  // Infectious Disease (5)
  // --------------------------------------------------------------------------
  rsv: { indication: 'rsv', ta: 'infectiousDisease', rampUpYears: 3, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Arexvy/Abrysvo/Beyfortus 2023-2024 very rapid market formation' },
  tuberculosis: { indication: 'tuberculosis', ta: 'infectiousDisease', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Pretomanid 2019-2024; slow global rollout, NGO-driven access programs' },
  influenza: { indication: 'influenza', ta: 'infectiousDisease', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'Xofluza 2018-2024; seasonal demand, rapid generic competition' },
  hepatitisC: { indication: 'hepatitisC', ta: 'infectiousDisease', rampUpYears: 2, peakDurationYears: 3, declineRate: 0.30, loeYearsAfterApproval: 10, source: 'Harvoni/Epclusa 2014-2018 peak; curative drugs shrink their own market rapidly' },
  covid: { indication: 'covid', ta: 'infectiousDisease', rampUpYears: 1, peakDurationYears: 2, declineRate: 0.40, loeYearsAfterApproval: 8, source: 'Paxlovid 2022-2023 spike then rapid decline; pandemic to endemic transition' },

  // --------------------------------------------------------------------------
  // Oncology (10 more)
  // --------------------------------------------------------------------------
  bladder: { indication: 'bladder', ta: 'oncology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Padcev 2019-2024 rapid ramp; EV-302 1L accelerating' },
  renal: { indication: 'renal', ta: 'oncology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'IO+TKI combos 2019-2024; KEYNOTE-426, CheckMate-9ER, JAVELIN Renal 101' },
  liver: { indication: 'liver', ta: 'oncology', rampUpYears: 5, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'IMbrave150 (atezo+bev) 2020-2024; liver dysfunction complicates tolerability → slower ramp' },
  gastric: { indication: 'gastric', ta: 'oncology', rampUpYears: 5, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'Vyloy 2024 launch; regional variation slows global adoption' },
  gbm: { indication: 'gbm', ta: 'oncology', rampUpYears: 3, peakDurationYears: 3, declineRate: 0.30, loeYearsAfterApproval: 10, source: 'Temodar 2005-2015 historical; Voranigo 2024 IDH-mutant niche. Short peak due to poor outcomes' },
  breast_hr: { indication: 'breast_hr', ta: 'oncology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'CDK4/6 class 2015-2024; Ibrance→Verzenio shift, monarchE adjuvant extending lifecycle' },
  lung_sclc: { indication: 'lung_sclc', ta: 'oncology', rampUpYears: 4, peakDurationYears: 3, declineRate: 0.28, loeYearsAfterApproval: 11, source: 'IMpower133 (atezo+chemo) 2019-2024; limited differentiation, short peak' },
  mds: { indication: 'mds', ta: 'oncology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Reblozyl/Rytelo 2019-2024; anemia-driven prescribing' },
  cervical: { indication: 'cervical', ta: 'oncology', rampUpYears: 4, peakDurationYears: 4, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Keytruda cervical 2021-2024; Tivdak 2L ADC 2021-2024' },
  endometrial: { indication: 'endometrial', ta: 'oncology', rampUpYears: 4, peakDurationYears: 4, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Keytruda+Lenvima 2021-2024; dostarlimab dMMR niche 2022-2024' },

  // --------------------------------------------------------------------------
  // Neurology (8 more)
  // --------------------------------------------------------------------------
  narcolepsy: { indication: 'narcolepsy', ta: 'neurology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Xyrem→Xywav 2002-2024; chronic nightly use, Lumryz extended-release 2023' },
  bipolar: { indication: 'bipolar', ta: 'neurology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Vraylar 2017-2024 ramp; generic mood stabilizer SOC limits branded peak' },
  adhd: { indication: 'adhd', ta: 'neurology', rampUpYears: 3, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 11, source: 'Vyvanse 2007-2023 → generic; Qelbree 2021-2024 non-stimulant ramp' },
  addiction: { indication: 'addiction', ta: 'neurology', rampUpYears: 5, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'Sublocade 2018-2024 slow uptake; stigma/access barriers prolong ramp' },
  myasthenia: { indication: 'myasthenia', ta: 'neurology', rampUpYears: 3, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Vyvgart 2022-2024 very rapid launch; FcRn class chronic biologic use' },
  pain: { indication: 'pain', ta: 'neurology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Lyrica 2004-2019 long peak then generic cliff; non-opioid class forming' },
  trd: { indication: 'trd', ta: 'neurology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Spravato 2019-2024 growing; REMS requirement slows but does not limit adoption' },
  frontotemporal: { indication: 'frontotemporal', ta: 'neurology', rampUpYears: 5, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 12, source: 'No approved therapy precedent; modeled on neurodegenerative rare disease curves (comparable to ALS)' },

  // --------------------------------------------------------------------------
  // Immunology (7 more)
  // --------------------------------------------------------------------------
  lupusNephritis: { indication: 'lupusNephritis', ta: 'immunology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Lupkynis 2021-2024 ramp; belimumab LN 2020-2024' },
  psoriaticArthritis: { indication: 'psoriaticArthritis', ta: 'immunology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Cosentyx PsA 2016-2024; chronic biologic use, multi-class competition' },
  ankylosingSpondylitis: { indication: 'ankylosingSpondylitis', ta: 'immunology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Cosentyx axSpA 2016-2024; Rinvoq AS 2023-2024' },
  ipf: { indication: 'ipf', ta: 'immunology', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Ofev/Esbriet 2014-2024; slow ramp due to progressive nature and specialist prescribing' },
  igan: { indication: 'igan', ta: 'immunology', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Tarpeyo 2021 / Filspari 2023 ramp; proteinuria-based treatment' },
  gvhd: { indication: 'gvhd', ta: 'immunology', rampUpYears: 3, peakDurationYears: 4, declineRate: 0.25, loeYearsAfterApproval: 11, source: 'Jakafi GVHD 2019-2024; steroid-refractory acute + chronic' },
  copd: { indication: 'copd', ta: 'immunology', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Trelegy 2017-2024; chronic daily inhalation, Dupixent COPD 2024 biologic entrant' },

  // --------------------------------------------------------------------------
  // Metabolic (6 more)
  // --------------------------------------------------------------------------
  type1Diabetes: { indication: 'type1Diabetes', ta: 'metabolic', rampUpYears: 5, peakDurationYears: 5, declineRate: 0.20, loeYearsAfterApproval: 12, source: 'Tzield 2022-2024; slow adoption due to at-risk screening requirement' },
  gout: { indication: 'gout', ta: 'metabolic', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Krystexxa 2010-2024; IV infusion for uncontrolled gout, growing post-immunomodulation' },
  diabeticKidneyDisease: { indication: 'diabeticKidneyDisease', ta: 'metabolic', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Kerendia 2021-2024 growing; chronic daily oral, large treatable population' },
  sickleCell: { indication: 'sickleCell', ta: 'metabolic', rampUpYears: 4, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Casgevy/Lyfgenia 2023-2024 gene therapy launch; one-time dosing but slow site ramp' },
  hemophiliaA: { indication: 'hemophiliaA', ta: 'metabolic', rampUpYears: 3, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Hemlibra 2018-2024 rapid adoption; chronic biweekly/monthly SubQ, long lifecycle' },
  fabry: { indication: 'fabry', ta: 'metabolic', rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, loeYearsAfterApproval: 14, source: 'Fabrazyme 2003-2024 long peak; chronic ERT for life, very slow competitive erosion' },

  // --------------------------------------------------------------------------
  // Rare Disease (5 more)
  // --------------------------------------------------------------------------
  fabryDisease: { indication: 'fabryDisease', ta: 'rareDisease', rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, loeYearsAfterApproval: 14, source: 'Same as metabolic fabry; rare disease TA context' },
  gaucherDisease: { indication: 'gaucherDisease', ta: 'rareDisease', rampUpYears: 4, peakDurationYears: 8, declineRate: 0.12, loeYearsAfterApproval: 15, source: 'Cerezyme 1994-2024 extremely long peak; lifetime ERT with minimal competition' },
  pompeDisease: { indication: 'pompeDisease', ta: 'rareDisease', rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, loeYearsAfterApproval: 14, source: 'Myozyme/Lumizyme → Nexviazyme 2006-2024; ERT lifecycle with next-gen replacement' },
  achondroplasia: { indication: 'achondroplasia', ta: 'rareDisease', rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 13, source: 'Voxzogo 2021-2024 rapid launch; chronic daily injection until growth plate closure' },
  dravetSyndrome: { indication: 'dravetSyndrome', ta: 'rareDisease', rampUpYears: 3, peakDurationYears: 5, declineRate: 0.22, loeYearsAfterApproval: 12, source: 'Epidiolex 2018-2024; Fintepla 2020-2024; anti-seizure class established' },
};

/**
 * Lookup helper for indication-specific revenue curve.
 * Tier 1 manual entries take precedence; otherwise falls back to Tier 3
 * automated calibration for any slug in the catalog; otherwise null (caller
 * falls back to REVENUE_CURVE_OVERRIDES[therapeuticArea] then REVENUE_CURVE).
 */
export function getIndicationRevenueCurve(indication: string): IndicationRevenueCurve | null {
  const tier1 = INDICATION_REVENUE_CURVES[indication];
  if (tier1) return tier1;
  const tier3 = getTier3CalibratedIndication(indication);
  return tier3 ? tier3.revenueCurve : null;
}

/**
 * Revenue ramp-up schedule as fraction of peak sales.
 * Index 0 = launch year, index 3 = peak year.
 */
export const REVENUE_RAMP_SCHEDULE = [0.20, 0.50, 0.80, 1.00] as const;

// ---------------------------------------------------------------------------
// Competitive Position Impact
// ---------------------------------------------------------------------------

/**
 * Market share multiplier based on competitive positioning.
 *
 * Applied to peak sales estimates to reflect the asset's expected
 * ability to capture market share relative to competitors.
 *
 * 'firstInClass' assets with a novel MOA in an underserved indication
 * can capture 1.4x the base market share assumption. 'crowded' assets
 * entering a market with 5+ approved competitors face ~45% share erosion.
 *
 * Source: McKinsey pharma launch excellence database;
 * L.E.K. competitive impact analysis frameworks.
 */
export const COMPETITIVE_SHARE_ADJUSTMENT: Record<string, number> = {
  /** First drug with this mechanism of action -- maximum share capture */
  firstInClass: 1.40,
  /** First to reach pivotal trials -- timing advantage */
  firstToPivotal: 1.25,
  /** Superior efficacy/safety profile vs. existing therapies */
  bestInClass: 1.15,
  /** Multiple competitors at similar development stages -- base case */
  racing: 1.00,
  /** Behind 1-2 competitors who will reach market first */
  behind: 0.75,
  /** 5+ competitors approved or in late-stage -- significant share pressure */
  crowded: 0.55,
};

/**
 * TA-specific competitive share multipliers.
 * Applied ON TOP of the global COMPETITIVE_SHARE_ADJUSTMENT.
 *
 * Rare disease first-in-class captures 60-80% of market (vs. 25-50% oncology)
 * because orphan markets have fewer competitors and higher patient loyalty.
 * Even "crowded" rare disease markets have 2-3 drugs, not 10+.
 *
 * Source: EvaluatePharma orphan drug market share analysis; IQVIA rare disease
 * commercial benchmarks.
 */
export const COMPETITIVE_SHARE_TA_MULTIPLIER: Record<string, number> = {
  rareDisease: 1.35,        // Orphan markets: fewer competitors, higher loyalty, captive market
  hematology: 1.15,         // Strong biomarker selection → more predictable market capture
  dermatology: 1.10,        // Visible endpoints → clearer differentiation, slightly higher share
  oncology: 0.95,           // Most competitive TA → slight downward pressure
  gastroenterology: 1.05,   // Moderate competition in IBD
  // All other TAs: 1.00 (no adjustment)
};

// ---------------------------------------------------------------------------
// Data Quality Impact on Confidence
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to the confidence interval width based on
 * the quality/maturity of available data.
 *
 * Better data narrows the confidence interval; preliminary data
 * widens it. This does not change the point estimate but affects
 * the low/high range in Monte Carlo simulations.
 */
export const DATA_QUALITY_CONFIDENCE_MULTIPLIER: Record<string, number> = {
  /** Phase 3 readout or robust Phase 2 with clear dose-response */
  robust: 0.75,
  /** Solid Phase 2 data, adequate sample size */
  moderate: 1.00,
  /** Early Phase 2 or Phase 1b signal, limited sample size */
  preliminary: 1.30,
  /** Preclinical data only -- widest confidence interval */
  preclinical_only: 1.60,
};

/**
 * Data quality impact on phase duration.
 * Better data enables faster, smaller trials → shorter development timelines.
 * Worse data requires larger confirmatory trials → extended timelines.
 *
 * Applied as a multiplier to Phase 3 duration.
 * Source: Tufts CSDD analysis of trial size vs data quality at Phase 2 entry.
 */
export const DATA_QUALITY_TIMELINE_MULTIPLIER: Record<string, number> = {
  /** Pivotal-ready data: smaller Phase 3, potentially single-arm → 20% shorter */
  pivotalReady: 0.80,
  /** Strong Phase 2: standard Phase 3 design */
  strongPhase2: 0.90,
  /** Promising: standard timelines */
  promising: 1.00,
  /** Mixed: larger Phase 3 needed for statistical power → 20% longer */
  mixed: 1.20,
  /** Limited: may require additional Phase 2 work before Phase 3 → 30% longer */
  limited: 1.30,
};

// ---------------------------------------------------------------------------
// Discount Rate Defaults
// ---------------------------------------------------------------------------

/**
 * Default WACC (weighted average cost of capital) by development phase.
 *
 * Earlier-stage assets command a higher discount rate reflecting greater
 * uncertainty. These can be overridden via RNPVInput.discountRate.
 *
 * Source: Damodaran pharma/biotech WACC analysis; EY biopharma
 * valuation benchmarks.
 */
export const DEFAULT_DISCOUNT_RATE: Record<string, number> = {
  preclinical: 0.15,
  phase1: 0.13,
  phase2: 0.11,
  phase3: 0.10,
  approved: 0.09,
};

// ---------------------------------------------------------------------------
// COGS and SG&A Assumptions
// ---------------------------------------------------------------------------

/**
 * Cost of goods sold as a fraction of revenue, by modality category.
 *
 * Biologics (mAbs, cell therapies) have higher COGS than small molecules
 * due to complex manufacturing. Gene therapies have the highest COGS
 * per dose due to viral vector production.
 */
export const COGS_BY_MODALITY_CATEGORY: Record<string, number> = {
  smallMolecule: 0.10,
  biologic: 0.18,
  cellTherapy: 0.30,
  geneTherapy: 0.35,
  vaccine: 0.20,
  radiopharmaceutical: 0.25,
};

/**
 * SG&A costs as a fraction of revenue during different lifecycle stages.
 * Launch year has the highest SG&A due to salesforce build-out and
 * disease awareness campaigns.
 */
export const SGA_BY_LIFECYCLE_STAGE: Record<string, number> = {
  launch: 0.35,
  growth: 0.28,
  peak: 0.22,
  decline: 0.18,
  postLOE: 0.10,
};

// ---------------------------------------------------------------------------
// Helper: Cumulative PoS Calculation
// ---------------------------------------------------------------------------

/**
 * Index mapping from phase name to the starting position in the
 * transition chain. Used by getCumulativePoS to skip completed phases.
 */
const PHASE_START_INDEX: Record<string, number> = {
  discovery: 0,
  preclinical: 1,
  phase1: 2,
  phase1_2: 3,
  phase2: 3,
  phase2_3: 4,
  phase3: 4,
  nda_filed: 5,
  approved: 6,
};

/**
 * Calculate cumulative probability of success from the current phase
 * through commercial launch.
 *
 * Applies base TA rates, modality adjustments, biomarker uplift, and
 * regulatory designation effects. Individual phase probabilities are
 * capped at 0.95 to prevent unrealistic certainty.
 *
 * @param currentPhase - Current development phase of the asset
 * @param therapeuticArea - Therapeutic area key (must match POS_BY_THERAPEUTIC_AREA)
 * @param modality - Drug modality key (must match POS_MODALITY_ADJUSTMENT)
 * @param biomarkerStatus - 'selected' if validated biomarker is used, 'unselected' otherwise
 * @param regulatoryDesignations - Active regulatory designations
 * @param indication - Optional indication slug. If provided and present in
 *   INDICATION_POS_MODIFIERS, each base transition rate is multiplied by the
 *   indication-specific modifier before any modality/biomarker/regulatory
 *   uplift is applied. Non-calibrated indications fall back to TA base rates.
 * @param timeWindow - Optional rolling time window for PoS calibration. When
 *   provided AND the indication has time-windowed data in
 *   TIME_WINDOWED_POS, the engine substitutes that cohort's absolute phase
 *   transition rates for the TA baseline BEFORE applying any modality,
 *   biomarker, or regulatory uplift — and bypasses the multiplicative
 *   indication modifier layer (which would double-count). Indications
 *   without time-windowed data fall back to the existing modifier logic.
 *
 * @returns Object containing cumulative PoS and per-transition breakdown
 *
 * @example
 * ```ts
 * const { cumulativePoS, transitions } = getCumulativePoS(
 *   'phase2',
 *   'oncology',
 *   'adc',
 *   'selected',
 *   { breakthrough: true, fastTrack: false, orphan: true, prime: false },
 *   'lung_nsclc',
 * );
 * // cumulativePoS reflects NSCLC-specific attrition vs oncology mean
 * ```
 */
export function getCumulativePoS(
  currentPhase: string,
  therapeuticArea: string,
  modality: string,
  biomarkerStatus: string,
  regulatoryDesignations: {
    breakthrough: boolean;
    fastTrack: boolean;
    orphan: boolean;
    prime: boolean;
  },
  indication?: string,
  timeWindow?: TimeWindow,
): {
  cumulativePoS: number;
  transitions: { phase: string; probability: number; cumulativeProb: number }[];
} {
  // Resolve base rates -- fall back to oncology if TA not found
  const baseRatesRaw =
    POS_BY_THERAPEUTIC_AREA[therapeuticArea] ?? POS_BY_THERAPEUTIC_AREA.oncology;

  // Time-windowed override: opt-in only. Caller must explicitly pass a
  // timeWindow (via RNPVInput.timeWindow or the TIER2_TIME_WINDOWED_POS
  // flag in rnpv-engine.ts) to activate time-windowed cohort data. If the
  // caller passes undefined, fall through to the existing multiplicative
  // indication-modifier logic — preserves backward compatibility and golden
  // master stability until the 100-deal backtest validates this change.
  const windowed = indication && timeWindow
    ? getTimeWindowedPoS(indication, timeWindow)
    : null;

  let baseRates: PhaseTransitionRates;

  if (windowed) {
    baseRates = {
      ...baseRatesRaw,
      preclinicalToPhase1: windowed.preclinicalToPhase1 ?? baseRatesRaw.preclinicalToPhase1,
      phase1ToPhase2: windowed.phase1ToPhase2,
      phase2ToPhase3: windowed.phase2ToPhase3,
      phase3ToApproval: windowed.phase3ToApproval,
    };
  } else {
    // Apply indication-specific modifier (no-op if indication is missing or
    // not calibrated). applyIndicationModifier clamps each transition into
    // [0.01, 0.98]. This deliberately runs BEFORE modality / biomarker /
    // regulatory uplifts so those still compose against indication-adjusted
    // baselines, preserving existing TA-level fallback for non-calibrated
    // indications.
    baseRates = {
      ...baseRatesRaw,
      preclinicalToPhase1: applyIndicationModifier(
        baseRatesRaw.preclinicalToPhase1,
        indication,
        'preclinicalToPhase1',
      ),
      phase1ToPhase2: applyIndicationModifier(
        baseRatesRaw.phase1ToPhase2,
        indication,
        'phase1ToPhase2',
      ),
      phase2ToPhase3: applyIndicationModifier(
        baseRatesRaw.phase2ToPhase3,
        indication,
        'phase2ToPhase3',
      ),
      phase3ToApproval: applyIndicationModifier(
        baseRatesRaw.phase3ToApproval,
        indication,
        'phase3ToApproval',
      ),
    };
  }

  // Resolve modality adjustment -- default to 1.0 (no adjustment)
  const modalityAdj = POS_MODALITY_ADJUSTMENT[modality] ?? 1.0;

  // Resolve biomarker uplift
  const biomarkerAdj =
    BIOMARKER_POS_UPLIFT[biomarkerStatus as keyof typeof BIOMARKER_POS_UPLIFT] ?? 1.0;

  // Calculate cumulative regulatory uplift, capped at MAX_REGULATORY_UPLIFT
  let regAdj = 1.0;
  if (regulatoryDesignations?.breakthrough) regAdj *= REGULATORY_POS_UPLIFT.breakthrough;
  if (regulatoryDesignations?.fastTrack) regAdj *= REGULATORY_POS_UPLIFT.fastTrack;
  if (regulatoryDesignations?.orphan) regAdj *= REGULATORY_POS_UPLIFT.orphan;
  if (regulatoryDesignations?.prime) regAdj *= REGULATORY_POS_UPLIFT.prime;
  regAdj = Math.min(regAdj, MAX_REGULATORY_UPLIFT);

  // Build phase-specific transition chain based on current phase.
  // Phase 1/2 and Phase 2/3 are adaptive/combined trials that use different
  // transition rates than the standard sequential pathway. NDA Filed also
  // has its own entry point.
  let phases: { phase: string; rate: number }[];

  if (currentPhase === 'phase1_2') {
    phases = [
      { phase: 'Phase 1/2 \u2192 Phase 2', rate: baseRates.phase1_2ToPhase2 ?? 0.42 },
      { phase: 'Phase 2 \u2192 Phase 3', rate: baseRates.phase2ToPhase3 },
      { phase: 'Phase 3 \u2192 Approval', rate: baseRates.phase3ToApproval },
      { phase: 'Approval \u2192 Launch', rate: baseRates.approvalToLaunch },
    ];
  } else if (currentPhase === 'phase2_3') {
    phases = [
      { phase: 'Phase 2/3 \u2192 Phase 3', rate: baseRates.phase2_3ToPhase3 ?? 0.55 },
      { phase: 'Phase 3 \u2192 Approval', rate: baseRates.phase3ToApproval },
      { phase: 'Approval \u2192 Launch', rate: baseRates.approvalToLaunch },
    ];
  } else if (currentPhase === 'nda_filed') {
    phases = [
      { phase: 'NDA Filed \u2192 Approval', rate: baseRates.ndaFiledToApproval ?? 0.90 },
      { phase: 'Approval \u2192 Launch', rate: baseRates.approvalToLaunch },
    ];
  } else {
    const allPhases = [
      { phase: 'Discovery \u2192 Preclinical', rate: baseRates.discoveryToPreclinical ?? 0.45 },
      { phase: 'Preclinical \u2192 Phase 1', rate: baseRates.preclinicalToPhase1 },
      { phase: 'Phase 1 \u2192 Phase 2', rate: baseRates.phase1ToPhase2 },
      { phase: 'Phase 2 \u2192 Phase 3', rate: baseRates.phase2ToPhase3 },
      { phase: 'Phase 3 \u2192 Approval', rate: baseRates.phase3ToApproval },
      { phase: 'Approval \u2192 Launch', rate: baseRates.approvalToLaunch },
    ];
    const standardStartIdx: Record<string, number> = {
      discovery: 0, preclinical: 1, phase1: 2, phase2: 3, phase3: 4, approved: 5,
    };
    const startIdx = standardStartIdx[currentPhase] ?? 0;
    phases = allPhases.slice(startIdx);
  }

  let cumulative = 1.0;
  const transitions: { phase: string; probability: number; cumulativeProb: number }[] = [];

  for (let i = 0; i < phases.length; i++) {
    const phaseName = phases[i].phase;
    let adjustedRate = phases[i].rate;

    // Apply modality and biomarker adjustments to clinical transitions only
    // (not approval->launch, which is primarily an administrative/commercial step)
    const isApprovalToLaunch = phaseName.includes('Launch');
    if (!isApprovalToLaunch) {
      adjustedRate *= modalityAdj * biomarkerAdj;

      // Regulatory uplift: strongest at approval transitions, partial at Phase 2→3
      const isApprovalTransition = phaseName.includes('Approval') && !phaseName.includes('Launch');
      const isPhase2To3 = phaseName.includes('Phase 2') && phaseName.includes('Phase 3');
      if (isApprovalTransition) {
        adjustedRate *= regAdj;
      } else if (isPhase2To3) {
        adjustedRate *= Math.sqrt(regAdj);
      }
    }

    // Cap individual phase probability at 0.95 to prevent mathematical certainty
    adjustedRate = Math.min(adjustedRate, 0.95);

    cumulative *= adjustedRate;

    transitions.push({
      phase: phases[i].phase,
      probability: Math.round(adjustedRate * 1000) / 1000,
      cumulativeProb: Math.round(cumulative * 10000) / 10000,
    });
  }

  return {
    cumulativePoS: Math.round(cumulative * 10000) / 10000,
    transitions,
  };
}

/**
 * Look up the expected phase duration for a given therapeutic area and phase.
 *
 * @param therapeuticArea - TA key
 * @param phase - Development phase key (preclinical, phase1, phase2, phase3, regulatory)
 * @returns Duration in years, or 2.0 as a fallback default
 */
export function getPhaseDuration(therapeuticArea: string, phase: string): number {
  return PHASE_DURATION[therapeuticArea]?.[phase] ?? 2.0;
}

/**
 * Look up the expected phase cost for a given therapeutic area and phase.
 *
 * @param therapeuticArea - TA key
 * @param phase - Development phase key
 * @returns Cost in $M, or 50 as a fallback default
 */
export function getPhaseCost(therapeuticArea: string, phase: string): number {
  return PHASE_COSTS[therapeuticArea]?.[phase] ?? 50;
}

/**
 * Calculate the total remaining development cost from the current phase
 * through regulatory approval.
 *
 * @param currentPhase - Current phase of the asset
 * @param therapeuticArea - TA key
 * @returns Total remaining cost in $M
 */
export function getRemainingDevelopmentCost(
  currentPhase: string,
  therapeuticArea: string,
): number {
  const phaseOrder = ['preclinical', 'phase1', 'phase2', 'phase3', 'regulatory'];
  const startIdx = phaseOrder.indexOf(currentPhase);
  if (startIdx === -1) return 0;

  const costs = PHASE_COSTS[therapeuticArea] ?? PHASE_COSTS.oncology;
  let total = 0;
  for (let i = startIdx; i < phaseOrder.length; i++) {
    total += costs[phaseOrder[i]] ?? 0;
  }
  return total;
}

/**
 * Calculate the total remaining time to market from the current phase,
 * in years.
 *
 * @param currentPhase - Current phase of the asset
 * @param therapeuticArea - TA key
 * @returns Total remaining time in years
 */
export function getRemainingTimeToMarket(
  currentPhase: string,
  therapeuticArea: string,
): number {
  const phaseOrder = ['preclinical', 'phase1', 'phase2', 'phase3', 'regulatory'];
  const startIdx = phaseOrder.indexOf(currentPhase);
  if (startIdx === -1) return 0;

  const durations = PHASE_DURATION[therapeuticArea] ?? PHASE_DURATION.oncology;
  let total = 0;
  for (let i = startIdx; i < phaseOrder.length; i++) {
    total += durations[phaseOrder[i]] ?? 0;
  }
  return total;
}

/**
 * Calculate the overall Likelihood of Approval (LOA) from a given phase
 * to market, using unadjusted base rates (no modality/biomarker/regulatory
 * adjustments).
 *
 * Useful for displaying baseline TA-level statistics.
 *
 * @param currentPhase - Starting phase
 * @param therapeuticArea - TA key
 * @returns LOA as a decimal (e.g., 0.05 = 5%)
 */
export function getBaselineLOA(currentPhase: string, therapeuticArea: string): number {
  const baseRates =
    POS_BY_THERAPEUTIC_AREA[therapeuticArea] ?? POS_BY_THERAPEUTIC_AREA.oncology;

  const transitions = [
    baseRates.discoveryToPreclinical ?? 0.45,
    baseRates.preclinicalToPhase1,
    baseRates.phase1ToPhase2,
    baseRates.phase2ToPhase3,
    baseRates.phase3ToApproval,
    baseRates.ndaFiledToApproval ?? 0.90,
    baseRates.approvalToLaunch,
  ];

  const startIdx = PHASE_START_INDEX[currentPhase] ?? 0;
  let loa = 1.0;
  for (let i = startIdx; i < transitions.length; i++) {
    loa *= transitions[i];
  }
  return Math.round(loa * 10000) / 10000;
}
