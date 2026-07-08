/**
 * Indication-Specific PoS Modifiers
 *
 * Multiplicative adjustments to base TA-level phase transition probabilities.
 * A modifier of 1.0 means no adjustment; 0.85 means 15% lower than base;
 * 1.20 means 20% higher than base.
 *
 * These exist because the rNPV engine's TA-level PoS table treats every
 * indication within a TA identically, which is wrong. Alzheimer's Phase 2 to
 * Phase 3 attrition has historically been roughly 3x worse than the neurology
 * average (Wong/Siah/Lo 2019, BIO Industry Analysis 2024-2026 update), and
 * similar gaps exist between NSCLC vs HER2+ breast, NASH vs T2D, etc.
 *
 * Modifiers are applied multiplicatively to the corresponding TA-level
 * transition probability before any modality / biomarker / regulatory uplift.
 * applyIndicationModifier() additionally clamps each transition into
 * [0.01, 0.98] so modifiers cannot push a phase rate to 0 or 1.
 *
 * Sources used (one per indication, listed in `source` field):
 *   - BIO 2024-2026: BIO/PharmaIntelligence/QLS Industry Analysis,
 *     "Clinical Development Success Rates 2011-2023" (published 2024) and the
 *     2026 update covering 2013-2025 cohorts. Indication-level rates pulled
 *     from the Phase 2 to Phase 3 and Phase 3 to NDA tables.
 *   - Wong/Siah/Lo 2019: Wong CH, Siah KW, Lo AW. "Estimation of clinical
 *     trial success rates and related parameters." Biostatistics 2019.
 *     The canonical disease-area transition probability dataset; updated by
 *     several groups through 2024.
 *   - NRDD 2024-2025: Nature Reviews Drug Discovery indication analyses
 *     ("Trends in clinical success rates", "The drug development pipeline",
 *     "How to improve R&D productivity") published in 2024 and 2025.
 *   - FDA CDER 2024-2025: FDA CDER Novel Drug Approvals annual summaries
 *     and CDER Conversation pieces, 2024 and 2025 cohorts.
 *   - EvaluatePharma 2025: EvaluatePharma World Preview 2025 indication
 *     pipeline and historical approval analyses.
 *
 * Indication slugs MUST match the values used in lib/calculations.ts
 * indicationOptions. Where the same indication exists under two different
 * slugs (e.g. dmd / duchenneMD, sma / spinalMuscularAtrophy, huntingtons /
 * huntingtonDisease) both keys are populated with the same modifier so the
 * lookup is robust regardless of which TA pulled the slug.
 */

import { getTier3CalibratedIndication } from './indication-tier3-calibration';

export interface IndicationPoSModifier {
  /** Slug used in calculations.ts indicationOptions */
  indication: string;
  /** Therapeutic area key (matches POS_BY_THERAPEUTIC_AREA) */
  ta: string;
  /** Multiplicative adjustment to TA-level preclinical -> Phase 1 rate */
  preclinicalToPhase1?: number;
  /** Multiplicative adjustment to TA-level Phase 1 -> Phase 2 rate */
  phase1ToPhase2: number;
  /** Multiplicative adjustment to TA-level Phase 2 -> Phase 3 rate (the cliff) */
  phase2ToPhase3: number;
  /** Multiplicative adjustment to TA-level Phase 3 -> Approval rate */
  phase3ToApproval: number;
  /** Source citation (which dataset / publication the numbers came from) */
  source: string;
  /** Year the source data covers (most recent vintage) */
  sourceYear: number;
  /** Why this modifier deviates from 1.0 */
  notes?: string;
}

/**
 * Top 50 calibrated indications. Slugs match calculations.ts.
 *
 * IMPORTANT: phase2ToPhase3 is the most consequential transition (largest
 * absolute attrition step in every TA), so each entry's notes field explains
 * the historical Phase 2 -> Phase 3 evidence specifically.
 */
export const INDICATION_POS_MODIFIERS: Record<string, IndicationPoSModifier> = {
  // ---------------------------------------------------------------------
  // ONCOLOGY (12)
  // ---------------------------------------------------------------------
  lung_nsclc: {
    indication: 'lung_nsclc',
    ta: 'oncology',
    preclinicalToPhase1: 0.95,
    phase1ToPhase2: 0.92,
    phase2ToPhase3: 0.78,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'NSCLC Phase 2 to Phase 3 ran 22-28% across the 2011-2023 cohort vs an oncology base of ~32-35%. Heterogeneous histology and crowded TKI/IO competition keep average attrition above the oncology mean even after EGFR/ALK/KRAS biomarker selection. The biomarker-selected sub-cohort recovers to ~40%, but most pipeline assets are still chasing unselected populations.',
  },
  breast_her2: {
    indication: 'breast_her2',
    ta: 'oncology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'HER2+ breast is the best-validated solid tumor target in pharma history (T-DM1, T-DXd, tucatinib, margetuximab). Phase 2 to Phase 3 has run ~38-42% vs oncology base ~32-35%. ADC class success (Enhertu, datopotamab) is lifting the rate further in the 2024-2025 cohort.',
  },
  breast_tnbc: {
    indication: 'breast_tnbc',
    ta: 'oncology',
    phase1ToPhase2: 0.92,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Triple-negative breast lacks ER/PR/HER2 targets, so most Phase 2 candidates are chemo-IO or TROP2 ADC combos with weaker biology. Phase 2 to Phase 3 has run ~26-30% vs oncology base 32-35%. Sacituzumab govitecan and pembro+chemo approvals improved tail outcomes but did not lift the average.',
  },
  melanoma: {
    indication: 'melanoma',
    ta: 'oncology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Checkpoint inhibitor success (ipi/nivo, relatlimab) and BRAF/MEK combos pulled melanoma Phase 2 to Phase 3 to ~36-38%, modestly above the oncology mean. TIL therapy (lifileucel) approval in 2024 reinforced the upward trend.',
  },
  colorectal: {
    indication: 'colorectal',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'CRC is solidly mid-pack: Phase 2 to Phase 3 ~30-33% vs oncology base ~32-35%. KRAS G12C and HER2+ CRC subsets are improving, but the bulk of MSS pipeline still struggles to translate Phase 2 signals.',
  },
  prostate: {
    indication: 'prostate',
    ta: 'oncology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'AR pathway and PSMA radioligand programs (Pluvicto, capivasertib, niraparib+abi) lifted prostate Phase 2 to Phase 3 to ~36-40%. Well-validated biology, mature endpoints (rPFS, OS).',
  },
  pancreatic: {
    indication: 'pancreatic',
    ta: 'oncology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.65,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'Pancreatic adeno is the lowest-PoS solid tumor: Phase 2 to Phase 3 historically 18-24% vs oncology base 32-35%. Stromal barrier, late diagnosis, and lack of validated targets beyond KRAS G12C/D drive consistent late-stage failure (NAPOLI-3 was a rare positive in 2023).',
  },
  ovarian: {
    indication: 'ovarian',
    ta: 'oncology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'PARP inhibitor success (olaparib, niraparib, rucaparib) lifted ovarian into the oncology mean, but ARIEL-4 and PSO failures kept it from going meaningfully above. Phase 2 to Phase 3 ~32-35%.',
  },
  headNeck: {
    indication: 'headNeck',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Head and neck SCC Phase 2 to Phase 3 has run ~28-32% vs oncology base 32-35%. Heterogeneous HPV+/HPV- biology, smaller patient pools, and EGFR mAb fatigue limit upside.',
  },
  myeloma: {
    indication: 'myeloma',
    ta: 'hematology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Multiple myeloma is the hematology success story: Phase 2 to Phase 3 ~48-52% vs heme base ~38-44%. BCMA CAR-T (ide-cel, cilta-cel), BCMA bispecifics (teclistamab, elranatamab, talquetamab) and combinations on a daratumumab/lenalidomide backbone make late-stage failure rare.',
  },
  dlbcl: {
    indication: 'dlbcl',
    ta: 'hematology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'CD19 CAR-T (axi-cel, liso-cel, tisa-cel) and CD20xCD3 bispecifics (glofitamab, epcoritamab) made DLBCL one of the highest-PoS oncology indications. Phase 2 to Phase 3 ~46-50% vs heme base ~38-44%.',
  },
  aml: {
    indication: 'aml',
    ta: 'hematology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'AML modestly improved with venetoclax/aza, FLT3 (gilteritinib, quizartinib), IDH (ivosidenib, enasidenib, olutasidenib), and menin (revumenib) approvals through 2024. Sits at the heme average ~38-42% Phase 2 to Phase 3; phase 3 attrition slightly elevated due to small randomized AML trials.',
  },

  // ---------------------------------------------------------------------
  // NEUROLOGY (8)
  // ---------------------------------------------------------------------
  alzheimers: {
    indication: 'alzheimers',
    ta: 'neurology',
    preclinicalToPhase1: 0.85,
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.45,
    phase3ToApproval: 0.70,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019; NRDD 2024',
    sourceYear: 2025,
    notes:
      'AD is the most-failed program area in pharma history. Phase 2 to Phase 3 has run 12-18% vs neurology base ~26%; Phase 3 to Approval ~25-35% vs neurology base ~55%. Lecanemab and donanemab approvals (2023, 2024) validated amyloid clearance but came after >300 failed candidates including bapineuzumab, solanezumab, gantenerumab, semorinemab, crenezumab. Modifier reflects amyloid-era attrition, not the post-lecanemab tail.',
  },
  parkinsons: {
    indication: 'parkinsons',
    ta: 'neurology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'PD is better than AD but worse than the neurology mean. Phase 2 to Phase 3 ~18-22% vs base ~26%. Repeated failures of disease-modifying programs (cinpanemab, prasinezumab, exenatide PD3) keep the average down despite symptomatic-therapy improvements.',
  },
  ms: {
    indication: 'ms',
    ta: 'neurology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'MS has the best PoS in neurology - validated MRI lesion endpoints, well-understood B-cell biology (ocrelizumab, ofatumumab, ublituximab, BTKi pipeline). Phase 2 to Phase 3 ~30-35% vs neuro base ~26%.',
  },
  als: {
    indication: 'als',
    ta: 'neurology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.55,
    phase3ToApproval: 0.65,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'ALS Phase 2 to Phase 3 ~12-16% vs neurology base ~26%. Tofersen (SOD1) provided a rare positive but Relyvrio withdrew in 2024 after failed PHOENIX, and BIIB100, masitinib, NurOwn, ibudilast all missed. Heterogeneous etiology and rapid disease progression limit translatability.',
  },
  epilepsy: {
    indication: 'epilepsy',
    ta: 'neurology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Mature category with reliable seizure-frequency endpoints. Phase 2 to Phase 3 ~26-30%, near the neurology base. Cenobamate, ganaxolone, and STK-001 (Dravet) sustaining the average; rare seizure subtypes lift the tail.',
  },
  depression: {
    indication: 'depression',
    ta: 'neurology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'MDD is dominated by placebo response (often 35-45% on HAM-D/MADRS), making confirmatory trials hard to power. Phase 2 to Phase 3 ~20-24% vs neuro base ~26%. Brexanolone, esketamine, and zuranolone succeeded but classical SSRI-class follow-ons (rapastinel, MIJ821, AXS-05 BUP-DXM) had mixed outcomes.',
  },
  schizophrenia: {
    indication: 'schizophrenia',
    ta: 'neurology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Schizophrenia Phase 2 to Phase 3 ~22-26%. KarXT (xanomeline-trospium, approved Sept 2024) was the first novel mechanism in 50 years; pomaglumetad, bitopertin, encenicline all failed before that. Heterogeneous PANSS placebo response and limited translational models hold the modifier below 1.0.',
  },
  migraine: {
    indication: 'migraine',
    ta: 'neurology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Recent CGRP success (erenumab, fremanezumab, galcanezumab, eptinezumab, ubrogepant, rimegepant, atogepant) made migraine the most reliable neurology indication after MS. Phase 2 to Phase 3 ~30-34% vs neuro base ~26%.',
  },

  // ---------------------------------------------------------------------
  // IMMUNOLOGY (7)
  // ---------------------------------------------------------------------
  rheumatoidArthritis: {
    indication: 'rheumatoidArthritis',
    ta: 'immunology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'RA Phase 2 to Phase 3 ~42-46% vs immunology base ~37%. ACR20/50/70 endpoints are well-validated, multiple successful classes (TNF, IL-6, JAK, T-cell costim) reduce mechanism risk for follow-ons.',
  },
  psoriasis: {
    indication: 'psoriasis',
    ta: 'immunology',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.25,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Psoriasis is the highest-PoS immunology indication. PASI75/90/100 endpoints are objective and rapid (12-16 weeks). IL-17 (secukinumab, ixekizumab, brodalumab, bimekizumab) and IL-23 (guselkumab, risankizumab, tildrakizumab) classes had near-100% Phase 3 success. Phase 2 to Phase 3 ~46-50% vs base ~37%.',
  },
  atopicDermatitis: {
    indication: 'atopicDermatitis',
    ta: 'dermatology',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Type-2 cytokine biology (dupilumab, tralokinumab, lebrikizumab, nemolizumab) and JAK1 (upadacitinib, abrocitinib, ruxolitinib topical) classes drove a strong AD track record. EASI75 endpoints are fast and reliable. Phase 2 to Phase 3 ~44-48%.',
  },
  sle_lupus: {
    indication: 'sle_lupus',
    ta: 'immunology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'Lupus Phase 2 to Phase 3 ~28-32% vs immunology base ~37%. Heterogeneous disease, BICLA/SRI-4 placebo response variability, and decades of failures (epratuzumab, atacicept, rontalizumab, blisibimod) before belimumab and anifrolumab succeeded keep the modifier below 1.0.',
  },
  ulcerativeColitis: {
    indication: 'ulcerativeColitis',
    ta: 'immunology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'UC sits at the immunology mean. Mayo score is well-validated, multiple successful classes (TNF, integrin, IL-23, JAK, S1P). Mirikizumab (2023) and etrasimod (2023) reinforce. Phase 2 to Phase 3 ~36-40%.',
  },
  crohns: {
    indication: 'crohns',
    ta: 'immunology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'CD slightly trails UC. Endoscopic endpoints harder to demonstrate, transmural disease less responsive to single-cytokine blockade. Phase 2 to Phase 3 ~32-36% vs base ~37%. Risankizumab and upadacitinib lifted the recent average.',
  },
  asthma: {
    indication: 'asthma',
    ta: 'immunology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Severe asthma with biomarker stratification (eosinophils, FeNO, IgE) is well-validated. Mepolizumab, reslizumab, benralizumab, dupilumab, tezepelumab all approved. AER endpoint is reliable. Phase 2 to Phase 3 ~40-44%.',
  },

  // ---------------------------------------------------------------------
  // METABOLIC (5)
  // ---------------------------------------------------------------------
  type2Diabetes: {
    indication: 'type2Diabetes',
    ta: 'metabolic',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'T2D Phase 2 to Phase 3 ~46-50% vs metabolic base ~40%. HbA1c is one of the most reliable surrogates in medicine; SGLT2, DPP-4, GLP-1 classes built a long success track. GLP-1/GIP combos (tirzepatide) and oral GLP-1 (orforglipron) extending the trend.',
  },
  obesity: {
    indication: 'obesity',
    ta: 'metabolic',
    phase1ToPhase2: 1.20,
    phase2ToPhase3: 1.30,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026; FDA CDER 2024-2025',
    sourceYear: 2025,
    notes:
      'GLP-1 wave (semaglutide, tirzepatide, retatrutide, orforglipron, CagriSema, survodutide) made obesity the highest-PoS metabolic indication. Body weight is a continuous, hard-to-fail endpoint. Phase 2 to Phase 3 ~50-55% vs base ~40%. Almost every Phase 3 incretin study has hit primary endpoints since 2020.',
  },
  nashMash: {
    indication: 'nashMash',
    ta: 'metabolic',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.65,
    phase3ToApproval: 0.75,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'NASH/MASH Phase 2 to Phase 3 ~22-28% vs metabolic base ~40%. Resmetirom (Rezdiffra, March 2024) was the FIRST approval after a 20-year failure graveyard: obeticholic acid (FDA CRL), selonsertib, cenicriviroc, elafibranor (initial), aramchol, simtuzumab, emricasan all failed. Akero/89bio efruxifermin and Madrigal follow-ons are the next test. Histology endpoint and slow progression remain hard.',
  },
  dyslipidemia: {
    indication: 'dyslipidemia',
    ta: 'metabolic',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'LDL-C is one of the most validated surrogates. PCSK9 mAbs, inclisiran, bempedoic acid, and now Lp(a) programs (olpasiran, pelacarsen, lepodisiran, muvalaplin) succeeding. Phase 2 to Phase 3 ~42-44%.',
  },
  familialHypercholesterolemia: {
    indication: 'familialHypercholesterolemia',
    ta: 'metabolic',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Genetically defined patient population, well-validated LDL-C endpoint, and successful precedents (evolocumab, alirocumab, evinacumab for HoFH, lomitapide). Phase 2 to Phase 3 ~46%.',
  },

  // ---------------------------------------------------------------------
  // RARE DISEASE (8) - both slug variants where they exist
  // ---------------------------------------------------------------------
  dmd: {
    indication: 'dmd',
    ta: 'rareDisease',
    phase1ToPhase2: 1.20,
    phase2ToPhase3: 1.40,
    phase3ToApproval: 1.20,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Single-gene disease with regulatory flexibility on accelerated approval (dystrophin surrogate). Sarepta exon-skippers (eteplirsen, golodirsen, casimersen, viltolarsen) and Elevidys gene therapy succeeded under exceptional review pathways. Phase 2 to Phase 3 effective rate ~58-62% vs rare disease base ~45%.',
  },
  duchenneMD: {
    indication: 'duchenneMD',
    ta: 'rareDisease',
    phase1ToPhase2: 1.20,
    phase2ToPhase3: 1.40,
    phase3ToApproval: 1.20,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Alias for dmd. See dmd notes.',
  },
  cysticFibrosis: {
    indication: 'cysticFibrosis',
    ta: 'rareDisease',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.30,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Vertex CFTR modulator franchise (ivacaftor, lumacaftor, tezacaftor, elexacaftor/Trikafta, vanzacaftor combo) covers ~90% of CF patients. ppFEV1 endpoint is fast and reliable. Phase 2 to Phase 3 ~58% vs rare base ~45%.',
  },
  sma: {
    indication: 'sma',
    ta: 'rareDisease',
    phase1ToPhase2: 1.20,
    phase2ToPhase3: 1.35,
    phase3ToApproval: 1.20,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'SMN1/SMN2 biology drove three approvals (nusinersen, onasemnogene, risdiplam) on motor function endpoints (HINE-2, CHOP-INTEND, HFMSE). Pre-symptomatic newborn screening trials make Phase 2/3 nearly deterministic. Phase 2 to Phase 3 ~60%.',
  },
  spinalMuscularAtrophy: {
    indication: 'spinalMuscularAtrophy',
    ta: 'rareDisease',
    phase1ToPhase2: 1.20,
    phase2ToPhase3: 1.35,
    phase3ToApproval: 1.20,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Alias for sma. See sma notes.',
  },
  heredAngioedema: {
    indication: 'heredAngioedema',
    ta: 'immunology',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.25,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'HAE has highly objective attack-rate endpoints and strong precedent (lanadelumab, berotralstat, garadacimab, donidalorsen, BioCryst orladeyo, Pharvaris deucrictibant). Phase 2 to Phase 3 ~50%.',
  },
  hereditaryAngioedema: {
    indication: 'hereditaryAngioedema',
    ta: 'rareDisease',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.25,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Alias for heredAngioedema (rare-disease slug variant).',
  },
  spinalCordInjury: {
    indication: 'spinalCordInjury',
    ta: 'neurology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.65,
    phase3ToApproval: 0.75,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'SCI has no approved disease-modifying therapy. Riluzole, minocycline, cethrin, granulocyte-CSF, embryonic stem cell, and OPC programs all failed or remain stalled. Heterogeneous injury location/severity and lack of validated functional endpoints hold the modifier well below 1.0.',
  },
  friedreichs: {
    indication: 'friedreichs',
    ta: 'neurology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Skyclarys (omaveloxolone) approval Feb 2023 validated NRF2 pathway and mFARS endpoint after decades without therapy. Single-gene FXN biology and modified-FARS surrogate make late-stage trials more tractable than other ataxias. Phase 2 to Phase 3 effective ~50%.',
  },
  huntingtons: {
    indication: 'huntingtons',
    ta: 'neurology',
    phase1ToPhase2: 0.80,
    phase2ToPhase3: 0.55,
    phase3ToApproval: 0.65,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'HD has a known monogenic cause (HTT CAG repeat) but disease-modifying programs keep failing: tominersen (Roche/Ionis halted Phase 3 in 2021), branaplam (Novartis halted), pridopidine GENERATION-HD2 missed primary in 2024, PTC518 partial. Symptomatic-only (tetrabenazine, deutetrabenazine, valbenazine) keep approvals trickling. Phase 2 to Phase 3 ~14-18% vs neuro base ~26%.',
  },
  huntingtonDisease: {
    indication: 'huntingtonDisease',
    ta: 'rareDisease',
    phase1ToPhase2: 0.80,
    phase2ToPhase3: 0.55,
    phase3ToApproval: 0.65,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Alias for huntingtons (rare-disease slug variant).',
  },
  wilsonDisease: {
    indication: 'wilsonDisease',
    ta: 'rareDisease',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Established copper-chelation paradigm (penicillamine, trientine, zinc, bis-choline tetrathiomolybdate ALXN1840) and objective serum/urine copper biomarkers. ALXN1840 missed primary in 2022 but the pathway and genetic basis keep PoS modestly above the rare-disease mean.',
  },

  // ---------------------------------------------------------------------
  // CARDIOVASCULAR (5)
  // ---------------------------------------------------------------------
  heartFailureHfref: {
    indication: 'heartFailureHfref',
    ta: 'cardiovascular',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'HFrEF sits at the CV mean. Sacubitril/valsartan, SGLT2 (empagliflozin, dapagliflozin), vericiguat, omecamtiv mecarbil (failed on hard MACE) reflect a mixed late-stage record. Phase 2 to Phase 3 ~30-34%.',
  },
  pulmonaryArterialHypertension: {
    indication: 'pulmonaryArterialHypertension',
    ta: 'cardiovascular',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      '6MWD, PVR, and time-to-clinical-worsening endpoints are reliable. ERAs, PDE5i, prostanoids, soluble guanylate cyclase (riociguat), and now sotatercept (Winrevair, March 2024) keep PAH a high-PoS CV niche. Phase 2 to Phase 3 ~36-40%.',
  },
  atrialFibrillation: {
    indication: 'atrialFibrillation',
    ta: 'cardiovascular',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Mature category with DOAC genericization. Factor XI inhibitor late-stage data (asundexian OCEANIC-AF, abelacimab) mixed in 2024. Phase 2 to Phase 3 ~28-32%.',
  },
  atherosclerosis: {
    indication: 'atherosclerosis',
    ta: 'cardiovascular',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'CV outcome trials (CVOTs) require 10,000-15,000 patients and 3-5 year follow-up, raising late-stage failure risk. Lp(a) programs are the next big test. Phase 2 to Phase 3 ~28-32%.',
  },
  dyslipidemia_alias_cv: {
    indication: 'dyslipidemia_alias_cv',
    ta: 'cardiovascular',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Reserved alias to keep CV-context dyslipidemia lookups parity with metabolic. Use the canonical dyslipidemia entry under metabolic.',
  },

  // ---------------------------------------------------------------------
  // INFECTIOUS DISEASE (3)
  // ---------------------------------------------------------------------
  hivAids: {
    indication: 'hivAids',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.15,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'HIV has the most reliable surrogate in ID (HIV RNA <50 copies/mL). Gilead franchise (TAF, bictegravir, lenacapavir) and ViiV (cabotegravir LA) drive consistent late-stage success. Phase 2 to Phase 3 ~50-55% vs ID base ~38%.',
  },
  hepatitisB: {
    indication: 'hepatitisB',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Functional cure (HBsAg loss) endpoint remains hard. siRNA (bepirovirsen, JNJ-3989, RG6346) and capsid assembly modulators show variable Phase 2 results. Phase 2 to Phase 3 ~36-40%.',
  },
  amrBacterial: {
    indication: 'amrBacterial',
    ta: 'infectiousDisease',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; NRDD 2024',
    sourceYear: 2025,
    notes:
      'Antibacterial Phase 2 to Phase 3 ~30-34% vs ID base ~38%. Endpoint complexity (non-inferiority design, FDA-EMA disagreement on populations) and the broken commercial model (Achaogen, Melinta, Tetraphase bankruptcies) suppress the modifier. AMR Action Fund and PASTEUR-style pull incentives have not yet shifted PoS.',
  },

  // ---------------------------------------------------------------------
  // OPHTHALMOLOGY / OTHER (2)
  // ---------------------------------------------------------------------
  wetAmd: {
    indication: 'wetAmd',
    ta: 'ophthalmology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Anti-VEGF franchise (ranibizumab, aflibercept 2mg/8mg, brolucizumab, faricimab) sets one of the best track records in pharma. BCVA endpoint is rapid and reliable, durability extension trials (TENAYA, LUCERNE) consistently positive. Phase 2 to Phase 3 ~46-50%.',
  },
  dryEyeDisease: {
    indication: 'dryEyeDisease',
    ta: 'ophthalmology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'DED Phase 2 to Phase 3 sits at the ophthalmology mean. Sign/symptom dual-endpoint requirement and high placebo response create late-stage variability (cyclosporine, lifitegrast, varenicline nasal spray, perfluorohexyloctane all approved but several misses in between).',
  },

  // ---------------------------------------------------------------------
  // WOMEN'S HEALTH (5) — new Tier 1 entries
  // ---------------------------------------------------------------------
  endometriosis: {
    indication: 'endometriosis',
    ta: 'womensHealth',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; FDA CDER 2024-2025',
    sourceYear: 2025,
    notes:
      'GnRH antagonists (elagolix/Orilissa, relugolix/Myfembree) have improved late-stage success, but Phase 2 → 3 historically hampered by subjective pain endpoints, high placebo response (~30%), and heterogeneous patient populations. BIO data shows 20% below average for WH.',
  },
  uterineFibroids: {
    indication: 'uterineFibroids',
    ta: 'womensHealth',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Myfembree (relugolix-E2/NETA) approval validates GnRH-antagonist path. Phase 2 → 3 challenged by need for dual bleeding + fibroid volume endpoints. Better than endometriosis but below WH average.',
  },
  pcos: {
    indication: 'pcos',
    ta: 'womensHealth',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.70,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'No FDA-approved drug specifically for PCOS despite 6-10% prevalence. Phase 2 → 3 attrition historically severe (~30% lower than WH base) due to heterogeneous diagnostic criteria (Rotterdam), poorly validated endpoints, and long trial durations. Ovasitol, metformin used off-label.',
  },
  postpartumDepression: {
    indication: 'postpartumDepression',
    ta: 'womensHealth',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024-2025; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Brexanolone (Zulresso, 2019) and zuranolone (Zurzuvae, 2023) both approved relatively smoothly. Neurosteroid class has well-validated HAMD-17 endpoints, fast onset, and clear clinical signal. Phase 2 → 3 above WH average due to strong effect sizes.',
  },
  menopause: {
    indication: 'menopause',
    ta: 'womensHealth',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Fezolinetant (Veozah, 2023) NK3R antagonist approval validates non-hormonal VMS path. Phase 2 → 3 near WH baseline — VMS frequency endpoints are objective and validated, but placebo response can dilute effect sizes.',
  },

  // ---------------------------------------------------------------------
  // GASTROENTEROLOGY (5) — new Tier 1 entries
  // (Note: crohns and ulcerativeColitis exist under immunology TA keys)
  // ---------------------------------------------------------------------
  crohnsDisease: {
    indication: 'crohnsDisease',
    ta: 'gastroenterology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'Distinct from the immunology "crohns" entry — GI-TA calibration accounts for endoscopic endpoint requirements (SES-CD). Phase 2 → 3 below GI base due to high placebo remission rates (20-30%) and complex endoscopy + PRO co-primary endpoints mandated post-2020 FDA guidance.',
  },
  eosinophilicEsophagitis: {
    indication: 'eosinophilicEsophagitis',
    ta: 'gastroenterology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'FDA CDER 2024-2025; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Dupixent EoE approval (2022) validated histologic endpoint (peak eos ≤6/HPF). Phase 2 → 3 above GI base because histologic response is objective, effect sizes are large (60% vs 5% placebo), and the EoE patient population is well-defined.',
  },
  nonAlcoholicSteatohepatitis: {
    indication: 'nonAlcoholicSteatohepatitis',
    ta: 'gastroenterology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.60,
    phase3ToApproval: 0.75,
    source: 'BIO 2024-2026; NRDD 2024-2025',
    sourceYear: 2025,
    notes:
      'Resmetirom (Rezdiffra, 2024) broke through, but the NASH/MASH field has seen catastrophic Phase 3 failures (elafibranor, selonsertib, cenicriviroc). Phase 2 → 3 historically 40% below GI base. Liver biopsy endpoint variability, slow fibrosis regression, and GLP-1 class threat persist.',
  },
  ibsD: {
    indication: 'ibsD',
    ta: 'gastroenterology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IBS-D requires composite abdominal pain + stool consistency FDA endpoint. 30-40% placebo response rate makes Phase 2 → 3 difficult. Eluxadoline, rifaximin, alosetron (restricted) approved but each with narrow signals. Phase 2 → 3 ~25% below GI average.',
  },
  primaryBiliaryCholangitis: {
    indication: 'primaryBiliaryCholangitis',
    ta: 'gastroenterology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Seladelpar (Livdelzi, 2024) and elafibranor (Iqirvo, 2024) both approved in same year after clean Phase 3s. Alkaline phosphatase normalization is a validated, objective biochemical endpoint — clear dose-response, low placebo response. Above GI base.',
  },

  // ---------------------------------------------------------------------
  // DERMATOLOGY (5) — new Tier 1 entries (atopicDermatitis already exists)
  // ---------------------------------------------------------------------
  hidradenitisSuppurativa: {
    indication: 'hidradenitisSuppurativa',
    ta: 'dermatology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; FDA CDER 2024-2025',
    sourceYear: 2025,
    notes:
      'Adalimumab was first approved HS drug (2015), secukinumab (Cosentyx) added 2023. HiSCR endpoint is validated but clinical heterogeneity (Hurley stage, tunnel formation) makes trial design complex. Phase 2 → 3 ~20% below derm average.',
  },
  alopeciaAreata: {
    indication: 'alopeciaAreata',
    ta: 'dermatology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Baricitinib (Olumiant, 2022) and ritlecitinib (Litfulo, 2023) JAK approvals validated SALT score endpoint. Strong, objective, visible endpoint drives above-average Phase 2 → 3 success. JAK class showing durable responses.',
  },
  vitiligo: {
    indication: 'vitiligo',
    ta: 'dermatology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Ruxolitinib cream (Opzelura, 2022) first FDA-approved vitiligo treatment. F-VASI endpoint is objective and reproducible. Near-baseline Phase 2 → 3 rates — good endpoint but slow repigmentation requires long trials (24-52 weeks).',
  },
  acne: {
    indication: 'acne',
    ta: 'dermatology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IGA success + inflammatory lesion count co-primary endpoint. Phase 2 → 3 slightly below average due to high placebo response (~15-20% IGA clear/almost clear) and crowded generic topical market. Sarecycline, clascoterone (Winlevi) recent approvals.',
  },
  chronicUrticaria: {
    indication: 'chronicUrticaria',
    ta: 'dermatology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Omalizumab (Xolair) approval validated UAS7 endpoint with robust effect sizes. Remibrutinib Phase 3 success (2024) confirms the CSU pathway. Phase 2 → 3 above derm average — clear immunologic mechanism, objective itch/hive scoring.',
  },

  // ---------------------------------------------------------------------
  // HEMATOLOGY (5) — new Tier 1 entries (aml, dlbcl, myeloma exist)
  // ---------------------------------------------------------------------
  cll: {
    indication: 'cll',
    ta: 'hematology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.20,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'BTK/BCL-2 class era (ibrutinib, venetoclax, acalabrutinib, zanubrutinib) has exceptional Phase 2 → 3 rates. Well-defined iwCLL response criteria, PFS endpoint, and MRD as accelerated endpoint. 20% above hematology base.',
  },
  follicularLymphoma: {
    indication: 'follicularLymphoma',
    ta: 'hematology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Mosunetuzumab, glofitamab, epcoritamab bispecifics all approved via accelerated pathway 2022-2024. Lugano response criteria well-validated. Phase 2 → 3 above heme base — high ORR in relapsed setting with clear unmet need.',
  },
  hodgkinLymphoma: {
    indication: 'hodgkinLymphoma',
    ta: 'hematology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Brentuximab vedotin (Adcetris) + nivolumab + pembrolizumab have reshaped treatment. Young patient population, high cure rates, and PFS/EFS endpoints drive above-average Phase 2 → 3. ECHELON-1 established combination paradigm.',
  },
  myelofibrosis: {
    indication: 'myelofibrosis',
    ta: 'hematology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Ruxolitinib (Jakafi) $2.7B monopoly, but fedratinib, pacritinib, momelotinib provide limited incremental benefit. SVR35 endpoint validated but difficult to beat ruxolitinib in 1L. Phase 2 → 3 slightly below heme average in post-ruxolitinib settings.',
  },
  itp: {
    indication: 'itp',
    ta: 'hematology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Platelet count ≥50×10⁹/L is a clean, objective primary endpoint. Romiplostim, eltrombopag, avatrombopag approved; fostamatinib added SYK path. Phase 2 → 3 near heme baseline with slight positive bias from clear endpoints.',
  },

  // ---------------------------------------------------------------------
  // OPHTHALMOLOGY (5) — new Tier 1 entries (wetAmd, dryEyeDisease exist)
  // ---------------------------------------------------------------------
  dryAmdGA: {
    indication: 'dryAmdGA',
    ta: 'ophthalmology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'FDA CDER 2024-2025; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Pegcetacoplan (Syfovre, 2023) and avacincaptad pegol (Izervay, 2023) approved but with modest efficacy (~25% GA growth reduction). Phase 2 → 3 below ophtho base — GA progression is slow (12-18 month trials), effect sizes are small, and functional vision endpoints remain controversial.',
  },
  diabeticRetinopathy: {
    indication: 'diabeticRetinopathy',
    ta: 'ophthalmology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Anti-VEGF class (Eylea, Lucentis, Vabysmo) validated in DME/DR. DRSS 2-step improvement endpoint established. Phase 2 → 3 slightly below ophtho average due to metabolic comorbidity confounding and long trial durations.',
  },
  diabeticMacularEdema: {
    indication: 'diabeticMacularEdema',
    ta: 'ophthalmology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'BCVA letter gain is a validated, objective endpoint. Vabysmo (faricimab) 2022 approval showed strong durability advantage. Phase 2 → 3 at/slightly above ophtho base — well-defined patient population and clear endpoint.',
  },
  glaucoma: {
    indication: 'glaucoma',
    ta: 'ophthalmology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IOP reduction is a clean, objective, regulatory-accepted endpoint. Latanoprost generic dominance limits commercial upside. Netarsudil (Rhopressa), latanoprostene bunod (Vyzulta) recent additions. Phase 2 → 3 near baseline — validated endpoint but hard to beat prostaglandin efficacy.',
  },
  retinitisPigmentosa: {
    indication: 'retinitisPigmentosa',
    ta: 'ophthalmology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.65,
    phase3ToApproval: 0.80,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Luxturna (voretigene, 2017) approved for RPE65 biallelic only. Broader RP trials face extreme genetic heterogeneity (>60 genes), slow progression endpoints, and small patient pools per genotype. Phase 2 → 3 ~35% below ophtho base.',
  },

  // ---------------------------------------------------------------------
  // CARDIOVASCULAR (5) — new Tier 1 entries (5 existing)
  // ---------------------------------------------------------------------
  heartFailureHfpef: {
    indication: 'heartFailureHfpef',
    ta: 'cardiovascular',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; NRDD 2024-2025',
    sourceYear: 2025,
    notes:
      'HFpEF historically the "graveyard" of heart failure — multiple Phase 3 failures (sacubitril/valsartan missed in PARAGON-HF). EMPEROR-Preserved (empagliflozin, 2021) broke through, but Phase 2 → 3 ~20% below CV average due to heterogeneous EF cutoffs, comorbidities, and lack of validated surrogate.',
  },
  hypertrophicCardiomyopathy: {
    indication: 'hypertrophicCardiomyopathy',
    ta: 'cardiovascular',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Mavacamten (Camzyos, 2022) validated cardiac myosin inhibitor class. LVOT gradient reduction is an objective, hemodynamic endpoint. Phase 2 → 3 above CV average — clear mechanism, defined population, strong Phase 2 effect sizes.',
  },
  coronaryArteryDisease: {
    indication: 'coronaryArteryDisease',
    ta: 'cardiovascular',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'MACE endpoint trials require massive sample sizes (10-15K patients) and long follow-up (3-5 years). Multiple Phase 3 failures in anti-inflammatory approaches (canakinumab signal only, colchicine modest). Below CV average due to high bar for incremental efficacy over statins + antiplatelet SOC.',
  },
  stroke: {
    indication: 'stroke',
    ta: 'cardiovascular',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Acute ischemic stroke neuroprotection has been a Phase 3 graveyard for 30+ years (NXY-059, edaravone mixed). Only tPA/tenecteplase and thrombectomy have succeeded. Phase 2 → 3 ~25% below CV average — time-window constraints, heterogeneous stroke subtypes, and functional endpoints (mRS) with high variability.',
  },
  venousThromboembolism: {
    indication: 'venousThromboembolism',
    ta: 'cardiovascular',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'DOAC class (rivaroxaban, apixaban, edoxaban) validated. Symptomatic VTE recurrence endpoint is objective and event-driven. Phase 2 → 3 slightly above CV average — well-defined patient population, established trial design from ENGAGE/AMPLIFY/EINSTEIN legacy.',
  },

  // ---------------------------------------------------------------------
  // INFECTIOUS DISEASE (5) — new Tier 1 entries (3 existing)
  // ---------------------------------------------------------------------
  rsv: {
    indication: 'rsv',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024-2025; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Arexvy (GSK), Abrysvo (Pfizer), nirsevimab (Beyfortus) all approved 2023-2024. RSV-LRTI endpoint well-validated, large effect sizes (>80% efficacy in trials). Phase 2 → 3 above ID average — viral endpoint is clean and regulatory path well-established after COVID vaccine infrastructure.',
  },
  tuberculosis: {
    indication: 'tuberculosis',
    ta: 'infectiousDisease',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Pretomanid (2019 approval) shortened MDR-TB treatment. But sputum culture conversion endpoint requires 6+ month trials, MDR-TB population is hard to recruit, and drug-drug interactions with multi-drug regimens complicate development. Phase 2 → 3 ~20% below ID average.',
  },
  influenza: {
    indication: 'influenza',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Baloxavir (Xofluza, 2018) recent approval. Seasonal flu trials require precise timing during flu season, modest effect sizes vs placebo (1 day symptom reduction), and rapid resistance selection. Phase 2 → 3 slightly below ID average.',
  },
  hepatitisC: {
    indication: 'hepatitisC',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.15,
    phase2ToPhase3: 1.25,
    phase3ToApproval: 1.20,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'SVR12 is the gold-standard curative endpoint in ID — binary, objective, >95% rates with DAAs. Sofosbuvir/Harvoni/Epclusa/Mavyret class represents the highest Phase 2 → 3 success in all of infectious disease. Post-2014 pipeline is thin but the DAA template is proven.',
  },
  covid: {
    indication: 'covid',
    ta: 'infectiousDisease',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.70,
    phase3ToApproval: 0.80,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Paxlovid (nirmatrelvir/ritonavir) succeeded but dozens of antivirals, mAbs, and repurposed drugs failed Phase 3 (fluvoxamine, ivermectin, hydroxychloroquine). Rapidly evolving viral variants, declining severity, and high placebo recovery rates make post-2023 COVID trials extremely difficult.',
  },

  // ---------------------------------------------------------------------
  // ONCOLOGY (10 more) — filling gaps
  // ---------------------------------------------------------------------
  bladder: {
    indication: 'bladder',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Enfortumab vedotin + pembrolizumab (EV-302) transformed 1L metastatic UC in 2024. ADC + IO combo paradigm validated. Phase 2 → 3 below oncology average due to prior chemotherapy-only era failures, but improving with new classes.',
  },
  renal: {
    indication: 'renal',
    ta: 'oncology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IO + TKI combos (Keytruda + Inlyta, Opdivo + Cabometyx, Bavencio + Inlyta) all succeeded Phase 3 in ccRCC. Well-validated PFS + OS endpoints. Phase 2 → 3 near oncology baseline.',
  },
  liver: {
    indication: 'liver',
    ta: 'oncology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'HCC development complicated by underlying liver disease (cirrhosis Child-Pugh scoring), drug metabolism concerns, and post-sorafenib era failures. Atezolizumab + bevacizumab (IMbrave150) succeeded but many IO monotherapy Phase 3s failed. Phase 2 → 3 ~25% below oncology base.',
  },
  gastric: {
    indication: 'gastric',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Zolbetuximab (Vyloy, 2024) validated CLDN18.2 target. But gastric cancer Phase 3 historically difficult — heterogeneous tumors, regional variation (Japan vs West), and chemotherapy backbone complexity. Phase 2 → 3 ~20% below oncology average.',
  },
  gbm: {
    indication: 'gbm',
    ta: 'oncology',
    phase1ToPhase2: 0.80,
    phase2ToPhase3: 0.55,
    phase3ToApproval: 0.70,
    source: 'BIO 2024-2026; NRDD 2025; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'GBM has the worst Phase 2 → 3 in all of oncology — 45% below base. BBB penetration, immunosuppressive TME, rapid recurrence, and heterogeneous molecular subtypes. Only temozolomide + RT (Stupp 2005) has shown OS benefit in 20+ years. Dozens of Phase 3 failures (bevacizumab, nivolumab, TTFields controversy).',
  },
  breast_hr: {
    indication: 'breast_hr',
    ta: 'oncology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'CDK4/6 class (palbociclib, ribociclib, abemaciclib) transformed HR+ mBC. monarchE adjuvant success established abemaciclib beyond metastatic. Phase 2 → 3 at/slightly above oncology average — well-defined patient population and PFS/iDFS endpoints.',
  },
  lung_sclc: {
    indication: 'lung_sclc',
    ta: 'oncology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.70,
    phase3ToApproval: 0.80,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'SCLC has historically poor Phase 2 → 3 attrition (~30% below oncology base). Only atezolizumab + chemo (IMpower133) and durvalumab + chemo (CASPIAN) added OS benefit beyond etoposide/platinum in 30 years. Rapid progression, chemo sensitivity but rapid resistance, and limited targetable drivers.',
  },
  mds: {
    indication: 'mds',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Luspatercept (Reblozyl) and imetelstat (Rytelo) recently approved. IWG response criteria well-validated. Phase 2 → 3 slightly below oncology average — heterogeneous disease subtypes and HMA backbone.',
  },
  cervical: {
    indication: 'cervical',
    ta: 'oncology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Pembrolizumab (KEYNOTE-826) + tisotumab vedotin (Tivdak) approvals. HPV+ tumor immunogenicity supports IO response. Phase 2 → 3 near oncology baseline — OS/PFS validated endpoints, clear unmet need in advanced disease.',
  },
  endometrial: {
    indication: 'endometrial',
    ta: 'oncology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Pembrolizumab + lenvatinib (KEYNOTE-775) succeeded in MSS population. dMMR/MSI-H subset has exceptional IO responses. Phase 2 → 3 near oncology baseline for combination approaches.',
  },

  // ---------------------------------------------------------------------
  // NEUROLOGY (8 more) — filling gaps
  // ---------------------------------------------------------------------
  narcolepsy: {
    indication: 'narcolepsy',
    ta: 'neurology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Orexin receptor agonists (TAK-994 failed on safety, but suvorexant class validated mechanism) + sodium oxybate (Xywav, Lumryz) show path. MWT/ESS endpoints well-validated and objective. Phase 2 → 3 above neuro average — clear mechanism, defined population, validated biomarkers (CSF hypocretin).',
  },
  bipolar: {
    indication: 'bipolar',
    ta: 'neurology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.80,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'YMRS/MADRS rating scales have high placebo response (35-45%). Phase 2 → 3 ~20% below neuro average. Lithium, valproate, and atypical antipsychotics dominate; cariprazine (Vraylar) is a recent success but most novel mechanisms fail on efficacy vs active comparator.',
  },
  adhd: {
    indication: 'adhd',
    ta: 'neurology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.0,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'ADHD-RS-5 endpoint well-validated, large effect sizes for stimulants. Non-stimulant class (viloxazine/Qelbree, centanafadine) shows moderate success. Phase 2 → 3 at neuro baseline — established endpoints but commercial challenge from generic stimulant dominance.',
  },
  addiction: {
    indication: 'addiction',
    ta: 'neurology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.65,
    phase3ToApproval: 0.75,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Addiction (AUD, OUD, stimulant use disorder) has historically poor Phase 2 → 3 (~35% below neuro base). High dropout rates (30-50%), heterogeneous endpoints (abstinence vs harm reduction), relapse complexity, and lack of validated surrogate markers. Only naltrexone, buprenorphine, acamprosate have endured.',
  },
  myasthenia: {
    indication: 'myasthenia',
    ta: 'neurology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Complement inhibitors (eculizumab/Soliris, ravulizumab/Ultomiris), FcRn antagonists (efgartigimod/Vyvgart, rozanolixizumab/Rystiggo), and CD19 (inebilizumab) have validated multiple mechanisms in gMG. MG-ADL endpoint is well-accepted. Phase 2 → 3 above neuro average.',
  },
  pain: {
    indication: 'pain',
    ta: 'neurology',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.70,
    phase3ToApproval: 0.80,
    source: 'BIO 2024-2026; Wong/Siah/Lo 2019',
    sourceYear: 2025,
    notes:
      'Chronic pain trials face 30-40% placebo response rates, subjective NRS endpoints, and enriched enrollment design debates. Anti-CGRP class (migraine-adjacent) succeeded but chronic neuropathic pain remains extremely challenging. Tanezumab (anti-NGF) failed on joint safety. Phase 2 → 3 ~30% below neuro average.',
  },
  trd: {
    indication: 'trd',
    ta: 'neurology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Esketamine (Spravato, 2019) validated NMDA pathway for TRD. MADRS endpoint, but active comparator designs required (antidepressant switching is the SOC). Phase 2 → 3 slightly below neuro average — better than broad depression but still high placebo response.',
  },
  frontotemporal: {
    indication: 'frontotemporal',
    ta: 'neurology',
    phase1ToPhase2: 0.80,
    phase2ToPhase3: 0.55,
    phase3ToApproval: 0.70,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'FTD has no approved disease-modifying therapy. Heterogeneous pathology (tau, TDP-43, FUS), lack of validated biomarker-to-clinical endpoint translation, and small populations. Phase 2 → 3 ~45% below neuro base — comparable to GBM in difficulty.',
  },

  // ---------------------------------------------------------------------
  // IMMUNOLOGY (7 more) — filling gaps
  // ---------------------------------------------------------------------
  lupusNephritis: {
    indication: 'lupusNephritis',
    ta: 'immunology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Voclosporin (Lupkynis, 2021) and belimumab (LN indication, 2020) validated calcineurin inhibitor and BLyS pathways. Renal response (CRR/PRR) endpoints are objective but heterogeneous lupus flare patterns and variable background therapy complicate Phase 2 → 3. ~15% below immunology average.',
  },
  psoriaticArthritis: {
    indication: 'psoriaticArthritis',
    ta: 'immunology',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IL-17/IL-23/JAK/PDE4 classes all have PsA approvals (secukinumab, guselkumab, tofacitinib, apremilast). ACR20 co-primary + skin clearance. Phase 2 → 3 above immunology average — dual-domain endpoint means dual validation; highly successful class development.',
  },
  ankylosingSpondylitis: {
    indication: 'ankylosingSpondylitis',
    ta: 'immunology',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'IL-17 class (secukinumab, ixekizumab) and JAK (tofacitinib, upadacitinib) validated ASAS20/40 endpoints. Clear unmet need in TNF-IR population. Phase 2 → 3 above immunology average — well-defined criteria and consistent effect sizes.',
  },
  ipf: {
    indication: 'ipf',
    ta: 'immunology',
    phase1ToPhase2: 0.85,
    phase2ToPhase3: 0.70,
    phase3ToApproval: 0.80,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Only pirfenidone and nintedanib approved, both with modest FVC decline reduction. Phase 2 → 3 historically poor (~30% below immunology average) — FVC decline is slow and variable, high placebo arm stability, and multiple mechanism failures (PHTX3, pamrevlumab). Inhaled therapies and combination trials underway.',
  },
  igan: {
    indication: 'igan',
    ta: 'immunology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 1.0,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Sparsentan (Filspari, 2023) and budesonide delayed-release (Tarpeyo, 2021) approvals validated proteinuria reduction endpoint (UPCR/eGFR slope). Phase 2 → 3 near immunology baseline — proteinuria is objective but confounded by variable RAS-inhibitor background.',
  },
  gvhd: {
    indication: 'gvhd',
    ta: 'immunology',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Ruxolitinib (Jakafi) approved acute + chronic GVHD. Belumosudil (Rezurock) added for cGVHD. Overall response rate (ORR) at day 28 is an FDA-accepted endpoint. Phase 2 → 3 slightly below immunology average due to heterogeneous transplant population and steroid-refractory stratification.',
  },
  copd: {
    indication: 'copd',
    ta: 'immunology',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Dupixent (dupilumab) COPD approval (2024) validated type-2 inflammation path for eosinophilic COPD. FEV1 and exacerbation reduction endpoints are validated but heterogeneous COPD population and strong LABA/LAMA/ICS SOC make Phase 2 → 3 ~15% below immunology average.',
  },

  // ---------------------------------------------------------------------
  // METABOLIC (6 more) — filling gaps
  // ---------------------------------------------------------------------
  type1Diabetes: {
    indication: 'type1Diabetes',
    ta: 'metabolic',
    phase1ToPhase2: 0.90,
    phase2ToPhase3: 0.75,
    phase3ToApproval: 0.85,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Teplizumab (Tzield, 2022) first disease-modifying T1D therapy but approved only for delay (not prevention). Phase 2 → 3 ~25% below metabolic average — autoimmune destruction is hard to halt, C-peptide preservation is a validated but noisy endpoint, and islet cell regeneration remains elusive.',
  },
  gout: {
    indication: 'gout',
    ta: 'metabolic',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Serum urate <6 mg/dL is a clean, objective, validated endpoint. Pegloticase (Krystexxa), lesinurad (Zurampic), and febuxostat (Uloric) all approved. Phase 2 → 3 slightly above metabolic average — biochemical endpoint with clear dose-response. URAT1 inhibitor pipeline showing promise.',
  },
  diabeticKidneyDisease: {
    indication: 'diabeticKidneyDisease',
    ta: 'metabolic',
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.85,
    phase3ToApproval: 0.90,
    source: 'BIO 2024-2026; NRDD 2025',
    sourceYear: 2025,
    notes:
      'Finerenone (Kerendia, 2021) validated nonsteroidal MRA path for DKD. SGLT2 class (dapagliflozin, canagliflozin) also CKD-approved. eGFR slope and kidney failure composite endpoints accepted. Phase 2 → 3 slightly below metabolic average — long trials (2-3 years), renal composites require large N.',
  },
  sickleCell: {
    indication: 'sickleCell',
    ta: 'metabolic',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 0.90,
    phase3ToApproval: 0.95,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Voxelotor (Oxbryta, 2019 — withdrawn 2024), crizanlizumab (Adakveo), and gene therapies (Casgevy, Lyfgenia, 2023). VOC crisis frequency endpoint validated but heterogeneous. Phase 2 → 3 slightly below metabolic average due to recruitment challenges and endpoint variability. Gene therapy path validated.',
  },
  hemophiliaA: {
    indication: 'hemophiliaA',
    ta: 'metabolic',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Emicizumab (Hemlibra) validated bispecific antibody path; fitusiran (Alhemo) anti-TFPI. Gene therapy (valoctocogene/Roctavian) approved. ABR (annualized bleed rate) is an objective, validated endpoint. Phase 2 → 3 above metabolic average — clear pharmacodynamic readout and well-defined population.',
  },
  fabry: {
    indication: 'fabry',
    ta: 'metabolic',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Agalsidase alfa/beta (Fabrazyme, Replagal) ERT + migalastat (Galafold) chaperone approved. GL-3 substrate reduction is a validated biomarker. Phase 2 → 3 above metabolic average — well-defined genetic population, objective biochemical endpoint. Next-gen gene therapy in trials.',
  },

  // ---------------------------------------------------------------------
  // RARE DISEASE (5 more) — filling gaps
  // ---------------------------------------------------------------------
  fabryDisease: {
    indication: 'fabryDisease',
    ta: 'rareDisease',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Same biological rationale as metabolic fabry entry. Rare disease TA context: orphan designation + validated GL-3 endpoint + genetic diagnosis certainty = above-average Phase 2 → 3 for rare disease.',
  },
  gaucherDisease: {
    indication: 'gaucherDisease',
    ta: 'rareDisease',
    phase1ToPhase2: 1.10,
    phase2ToPhase3: 1.15,
    phase3ToApproval: 1.10,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Cerezyme, Cerdelga, eliglustat — multiple approved options. GCase activity and chitotriosidase biomarkers well-validated. Phase 2 → 3 above rare disease average — Gaucher is the most well-characterized LSD with objective biochemical and visceral endpoints.',
  },
  pompeDisease: {
    indication: 'pompeDisease',
    ta: 'rareDisease',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'BIO 2024-2026; FDA CDER 2024',
    sourceYear: 2025,
    notes:
      'Lumizyme/Myozyme (alglucosidase alfa) + avalglucosidase alfa (Nexviazyme, 2021) approved. 6MWT and FVC endpoints validated for LOPD. Phase 2 → 3 at/slightly above rare disease average — enzyme replacement proof-of-concept well-established.',
  },
  achondroplasia: {
    indication: 'achondroplasia',
    ta: 'rareDisease',
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.10,
    phase3ToApproval: 1.05,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Vosoritide (Voxzogo, 2021) validated CNP pathway. Annualized growth velocity is an objective, validated endpoint. Phase 2 → 3 above rare disease average — clear mechanism, defined population (FGFR3 mutation), and measurable pharmacodynamic endpoint.',
  },
  dravetSyndrome: {
    indication: 'dravetSyndrome',
    ta: 'rareDisease',
    phase1ToPhase2: 1.0,
    phase2ToPhase3: 1.05,
    phase3ToApproval: 1.0,
    source: 'FDA CDER 2024; BIO 2024-2026',
    sourceYear: 2025,
    notes:
      'Epidiolex (cannabidiol, 2018), fenfluramine (Fintepla, 2020), and stiripentol (Diacomit) approved. Seizure frequency reduction is an objective, validated endpoint. Phase 2 → 3 at/slightly above rare disease average — clear genetic diagnosis (SCN1A) and well-defined endpoint, but small N trials.',
  },
};

/**
 * Look up a calibrated indication modifier by slug. Tier 1 manual entries
 * take precedence; otherwise falls back to Tier 3 automated calibration for
 * any slug in the calculations.ts catalog; otherwise returns null so the
 * caller falls back to the TA-level base rate.
 */
export function getIndicationPoSModifier(
  indication: string | undefined | null,
): IndicationPoSModifier | null {
  if (!indication) return null;
  const tier1 = INDICATION_POS_MODIFIERS[indication];
  if (tier1) return tier1;
  const tier3 = getTier3CalibratedIndication(indication);
  return tier3 ? tier3.posModifier : null;
}

/**
 * Apply an indication-specific multiplicative modifier to a base TA-level PoS
 * rate. Returns the adjusted PoS, clamped into [0.01, 0.98] so a noisy
 * modifier cannot push a phase rate to mathematical certainty or zero.
 *
 * If no calibrated modifier exists for the indication, the base PoS is
 * returned unchanged - existing TA-level fallback behaviour is preserved.
 */
export function applyIndicationModifier(
  basePoS: number,
  indication: string | undefined | null,
  transition:
    | 'preclinicalToPhase1'
    | 'phase1ToPhase2'
    | 'phase2ToPhase3'
    | 'phase3ToApproval',
): number {
  const modifier = getIndicationPoSModifier(indication);
  if (!modifier) return basePoS;
  const adjustment = modifier[transition];
  if (adjustment === undefined) return basePoS;
  const adjusted = basePoS * adjustment;
  return Math.max(0.01, Math.min(0.98, adjusted));
}

/**
 * Number of indications calibrated. Useful for tests and reporting.
 */
export const CALIBRATED_INDICATION_COUNT = Object.keys(INDICATION_POS_MODIFIERS).length;
