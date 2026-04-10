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
};

/**
 * Look up a calibrated indication modifier by slug. Returns null if the
 * indication is not in the top-50 set, in which case the caller should fall
 * back to the TA-level base rate.
 */
export function getIndicationPoSModifier(
  indication: string | undefined | null,
): IndicationPoSModifier | null {
  if (!indication) return null;
  return INDICATION_POS_MODIFIERS[indication] || null;
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
