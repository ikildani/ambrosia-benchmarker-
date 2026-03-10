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
 *   - Nature Reviews Drug Discovery annual approval analyses (2021-2024)
 *   - FDA CDER Novel Drug Approvals annual reports (2021-2024)
 *   - Wong, Siah & Lo, "Estimation of clinical trial success rates and
 *     related parameters", Biostatistics (2019)
 *   - DiMasi et al., "Innovation in the pharmaceutical industry",
 *     J Health Econ (2016) -- cost estimates
 *   - EvaluatePharma World Preview reports (2022-2024)
 *
 * @module lib/financial/pos-tables
 */

import type { PhaseTransitionRates } from './types';

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
    phase1ToPhase2: 0.52,
    phase1_2ToPhase2: 0.42,
    phase2ToPhase3: 0.29,
    phase2_3ToPhase3: 0.55,
    phase3ToApproval: 0.55,
    ndaFiledToApproval: 0.90,
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
    phase1ToPhase2: 0.48,
    phase1_2ToPhase2: 0.38,
    phase2ToPhase3: 0.24,
    phase2_3ToPhase3: 0.48,
    phase3ToApproval: 0.50,
    ndaFiledToApproval: 0.88,
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
    phase2ToPhase3: 0.35,
    phase2_3ToPhase3: 0.58,
    phase3ToApproval: 0.62,
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
    phase1ToPhase2: 0.54,
    phase1_2ToPhase2: 0.44,
    phase2ToPhase3: 0.33,
    phase2_3ToPhase3: 0.56,
    phase3ToApproval: 0.60,
    ndaFiledToApproval: 0.91,
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
    phase2ToPhase3: 0.30,
    phase2_3ToPhase3: 0.54,
    phase3ToApproval: 0.58,
    ndaFiledToApproval: 0.90,
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
 * Nature Reviews Drug Discovery modality analyses, and internal
 * deal database calibration.
 */
export const POS_MODALITY_ADJUSTMENT: Record<string, number> = {
  // --- Cross-therapeutic modalities ---
  /** Traditional oral/injectable small molecules -- baseline */
  smallMolecule: 1.00,
  /** Monoclonal antibodies -- slight uplift from validated platform */
  mab: 1.05,
  /** Antibody-drug conjugates -- higher CMC complexity, emerging safety signals */
  adc: 0.85,
  /** Bispecific antibodies -- complex manufacturing, novel mechanisms */
  bispecific: 0.80,
  /** T-cell engagers (BiTE, etc.) -- cytokine release syndrome risk */
  tCellEngager: 0.78,
  /** Peptides -- good oral bioavailability advances, established PK */
  peptide: 0.95,

  // --- Oncology-specific modalities ---
  /** Autologous CAR-T for hematologic malignancies -- validated platform */
  carT_heme: 0.75,
  /** CAR-T for solid tumors -- major TME/trafficking challenges */
  carT_solid: 0.55,
  /** Non-CAR-T cell therapies (TIL, NK, etc.) -- earlier-stage platform */
  cellTherapy: 0.60,
  /** Ex vivo gene therapy -- CMC and durability challenges */
  geneTherapy: 0.65,
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
  /** GLP-1 receptor agonists -- the most validated mechanism in metabolic disease */
  glp1Agonist: 1.15,
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
  /** Gene therapy for inherited retinal diseases (Luxturna precedent) */
  geneTherapyOcular: 0.60,
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
 * Source: FDA CDER annual reports; Darrow et al., NEJM 2020; EMA PRIME
 * outcomes reports.
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
  /** FDA Accelerated Approval pathway eligibility */
  acceleratedApproval: 1.25,
  /** EMA PRIME (Priority Medicines) -- EU equivalent of breakthrough */
  prime: 1.10,
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
 * Source: Tufts CSDD Phase duration analysis; FDA review timelines;
 * BIO/Informa dataset 2011-2020.
 */
export const PHASE_DURATION: Record<string, Record<string, number>> = {
  oncology: {
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
  neurology: {
    discovery: 3.5,
    preclinical: 2.5,
    phase1: 1.5,
    phase1_2: 3.0,
    phase2: 3.0,
    phase2_3: 4.0,
    phase3: 3.5,
    nda_filed: 1.5,
    regulatory: 1.5,
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
    phase3: 3.5,
    nda_filed: 1.0,
    regulatory: 1.0,
  },
  cardiovascular: {
    discovery: 3.0,
    preclinical: 2.0,
    phase1: 1.5,
    phase1_2: 3.0,
    phase2: 3.0,
    phase2_3: 4.5,
    phase3: 4.0,
    nda_filed: 1.5,
    regulatory: 1.5,
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
    regulatory: 1.0,
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
 * Source: DiMasi et al., J Health Econ (2016), inflation-adjusted;
 * Tufts CSDD cost surveys; Deloitte biopharma R&D benchmarking.
 */
export const PHASE_COSTS: Record<string, Record<string, number>> = {
  oncology: {
    discovery: 8,
    preclinical: 15,
    phase1: 25,
    phase1_2: 45,
    phase2: 50,
    phase2_3: 120,
    phase3: 150,
    nda_filed: 5,
    regulatory: 5,
  },
  neurology: {
    discovery: 10,
    preclinical: 20,
    phase1: 30,
    phase1_2: 55,
    phase2: 60,
    phase2_3: 150,
    phase3: 200,
    nda_filed: 5,
    regulatory: 5,
  },
  immunology: {
    discovery: 8,
    preclinical: 15,
    phase1: 25,
    phase1_2: 40,
    phase2: 45,
    phase2_3: 100,
    phase3: 120,
    nda_filed: 5,
    regulatory: 5,
  },
  metabolic: {
    discovery: 8,
    preclinical: 15,
    phase1: 25,
    phase1_2: 45,
    phase2: 50,
    phase2_3: 140,
    phase3: 180,
    nda_filed: 5,
    regulatory: 5,
  },
  cardiovascular: {
    discovery: 10,
    preclinical: 20,
    phase1: 30,
    phase1_2: 55,
    phase2: 60,
    phase2_3: 180,
    phase3: 250,
    nda_filed: 5,
    regulatory: 5,
  },
  infectiousDisease: {
    discovery: 5,
    preclinical: 10,
    phase1: 20,
    phase1_2: 30,
    phase2: 35,
    phase2_3: 80,
    phase3: 100,
    nda_filed: 5,
    regulatory: 5,
  },
  ophthalmology: {
    discovery: 6,
    preclinical: 12,
    phase1: 20,
    phase1_2: 35,
    phase2: 40,
    phase2_3: 70,
    phase3: 80,
    nda_filed: 5,
    regulatory: 5,
  },
  womensHealth: {
    discovery: 5,
    preclinical: 10,
    phase1: 20,
    phase1_2: 30,
    phase2: 35,
    phase2_3: 75,
    phase3: 90,
    nda_filed: 5,
    regulatory: 5,
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
 *   { breakthrough: true, fastTrack: false, orphan: true, prime: false }
 * );
 * // cumulativePoS ~ 0.12-0.18 depending on exact adjustments
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
): {
  cumulativePoS: number;
  transitions: { phase: string; probability: number; cumulativeProb: number }[];
} {
  // Resolve base rates -- fall back to oncology if TA not found
  const baseRates =
    POS_BY_THERAPEUTIC_AREA[therapeuticArea] ?? POS_BY_THERAPEUTIC_AREA.oncology;

  // Resolve modality adjustment -- default to 1.0 (no adjustment)
  const modalityAdj = POS_MODALITY_ADJUSTMENT[modality] ?? 1.0;

  // Resolve biomarker uplift
  const biomarkerAdj =
    BIOMARKER_POS_UPLIFT[biomarkerStatus as keyof typeof BIOMARKER_POS_UPLIFT] ?? 1.0;

  // Calculate cumulative regulatory uplift, capped at MAX_REGULATORY_UPLIFT
  let regAdj = 1.0;
  if (regulatoryDesignations.breakthrough) regAdj *= REGULATORY_POS_UPLIFT.breakthrough;
  if (regulatoryDesignations.fastTrack) regAdj *= REGULATORY_POS_UPLIFT.fastTrack;
  if (regulatoryDesignations.orphan) regAdj *= REGULATORY_POS_UPLIFT.orphan;
  if (regulatoryDesignations.prime) regAdj *= REGULATORY_POS_UPLIFT.prime;
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
