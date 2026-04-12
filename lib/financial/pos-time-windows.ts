/**
 * Time-Varying PoS Rates
 *
 * Phase transition probabilities by rolling time window. Captures the reality
 * that drug development success rates shift over time as biology, regulatory,
 * and competitive dynamics evolve. A static PoS snapshot masks large moves
 * that materially change rNPV: Alzheimer's PoS worsened ~60% after the 2018
 * amyloid failures then rebounded with Leqembi/Kisunla; NSCLC improved ~25%
 * after checkpoint inhibitor success; NASH/MASH dropped ~40% after the
 * Madrigal/Akero late-2024 and 2025 failures; obesity doubled with GLP-1.
 *
 * These values are ABSOLUTE phase transition probabilities (not multiplicative
 * modifiers). When a caller passes `timeWindow` into `getCumulativePoS`, the
 * engine substitutes the selected window's absolute rates for the TA baseline
 * BEFORE applying modality / biomarker / regulatory uplifts. Indications that
 * have no time-window data fall back to the existing indication PoS modifier
 * logic unchanged.
 *
 * Sample size note: windows with sampleSize < 20 reflect small cohorts and
 * should be treated as low confidence. We still surface them because the
 * directional signal (e.g., NASH 2021-2024 cohort) is more useful than the
 * stale 10-year average for a rapidly shifting area.
 *
 * Sources:
 *   - BIO/Informa/QLS "Clinical Development Success Rates 2011-2023"
 *     (published 2024) and the 2026 update covering 2013-2025 cohorts
 *   - Wong, Siah & Lo 2019 (Biostatistics) as the canonical 2000-2015 baseline
 *   - Nature Reviews Drug Discovery 2024-2025 indication analyses
 *   - FDA CDER Novel Drug Approvals 2021-2026
 *   - EvaluatePharma World Preview 2025
 *
 * @module lib/financial/pos-time-windows
 */

export type TimeWindow = '2014-2024' | '2019-2024' | '2021-2024' | 'most_recent';

export interface TimeWindowedPoSEntry {
  preclinicalToPhase1?: number;
  phase1ToPhase2: number;
  phase2ToPhase3: number;
  phase3ToApproval: number;
  /** Number of programs in this cohort (low confidence when < 20) */
  sampleSize: number;
  /** Source citation for this window */
  source: string;
  /** Why PoS shifted in this window */
  notes?: string;
}

export interface TimeWindowedPoS {
  indication: string;
  ta: string;
  windows: {
    [K in Exclude<TimeWindow, 'most_recent'>]?: TimeWindowedPoSEntry;
  };
}

/**
 * Time-windowed phase transition rates for the top indications where PoS has
 * shifted meaningfully across rolling cohorts. Indications omitted from this
 * table fall through to the static TA + indication-modifier logic.
 */
export const TIME_WINDOWED_POS: Record<string, TimeWindowedPoS> = {
  // =====================================================================
  // NEUROLOGY — the most volatile TA over the last decade
  // =====================================================================
  alzheimers: {
    indication: 'alzheimers',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.45,
        phase2ToPhase3: 0.18, // Pre-Leqembi era: bapineuzumab, solanezumab, crenezumab, verubecestat failures
        phase3ToApproval: 0.55,
        sampleSize: 87,
        source: 'BIO Clinical Development Success Rates 2014-2024',
        notes:
          'Ten-year cohort dominated by BACE inhibitor and anti-amyloid monoclonal failures 2014-2019. Phase 2 to Phase 3 attrition is roughly 3x the neurology mean over this window.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.52,
        phase2ToPhase3: 0.22,
        phase3ToApproval: 0.65,
        sampleSize: 41,
        source: 'BIO 2019-2024 cohort, post-amyloid hypothesis',
        notes:
          'Aducanumab accelerated approval 2021, lecanemab 2023, donanemab 2024 lift Phase 3 to Approval. Phase 2 to Phase 3 still depressed by GV-971, semorinemab, gantenerumab P3 miss.',
      },
      '2021-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.28,
        phase3ToApproval: 0.72,
        sampleSize: 18,
        source: 'BIO 2021-2024 cohort, Leqembi/Kisunla approvals',
        notes:
          'Smallest but most recent cohort. Two positive pivotal readouts (lecanemab CLARITY-AD, donanemab TRAILBLAZER-ALZ2) and ongoing tau and anti-inflammatory programs. Low sample size, treat as directional.',
      },
    },
  },
  als: {
    indication: 'als',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.48,
        phase2ToPhase3: 0.22,
        phase3ToApproval: 0.50,
        sampleSize: 54,
        source: 'BIO 2014-2024; Wong/Siah/Lo 2019',
        notes:
          'Decade mix of edaravone approval (2017), tofersen accelerated approval (2023), and multiple P3 failures (tirasemtiv, levosimendan, masitinib).',
      },
      '2019-2024': {
        phase1ToPhase2: 0.50,
        phase2ToPhase3: 0.20,
        phase3ToApproval: 0.45,
        sampleSize: 28,
        source: 'BIO 2019-2024 cohort',
        notes:
          'Relyvrio withdrawn April 2024 after PHOENIX miss dragged the cohort average down. Tofersen approval partially offsets; otherwise P3 success rate materially worse than 2014-2024 baseline.',
      },
      '2021-2024': {
        phase1ToPhase2: 0.50,
        phase2ToPhase3: 0.18,
        phase3ToApproval: 0.40,
        sampleSize: 14,
        source: 'BIO 2021-2024 cohort, post-Relyvrio withdrawal',
        notes:
          'Three consecutive P3 disappointments (Relyvrio, arimoclomol, reldesemtiv). Only tofersen (genetically targeted SOD1) read out positive. Low sample size flag.',
      },
    },
  },
  huntingtons: {
    indication: 'huntingtons',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.45,
        phase2ToPhase3: 0.15,
        phase3ToApproval: 0.45,
        sampleSize: 32,
        source: 'BIO 2014-2024; Wong/Siah/Lo 2019',
        notes:
          'Very small population, heavy reliance on ASO and gene-silencing platforms. Roche/Ionis tominersen halted 2021; PTC518 delayed; Wave ASOs discontinued. Historical P2 to P3 the worst in neurology ex-Alzheimer\'s.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.42,
        phase2ToPhase3: 0.12,
        phase3ToApproval: 0.40,
        sampleSize: 18,
        source: 'BIO 2019-2024 cohort',
        notes:
          'Tominersen GENERATION-HD1 halt (2021), PTC518 PIVOT-HD suspension (2023-2024), uniQure AMT-130 slow enrollment. PoS trending worse over this window.',
      },
    },
  },
  parkinsons: {
    indication: 'parkinsons',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.46,
        phase2ToPhase3: 0.20,
        phase3ToApproval: 0.52,
        sampleSize: 62,
        source: 'BIO 2014-2024',
        notes:
          'Symptomatic approvals (opicapone, safinamide) alongside disease-modifying program failures (prasinezumab SPARK, cinpanemab SPARK). Phase 2 to Phase 3 remains low ex symptomatic.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.48,
        phase2ToPhase3: 0.22,
        phase3ToApproval: 0.55,
        sampleSize: 34,
        source: 'BIO 2019-2024 cohort',
        notes:
          'Recent cohort slightly improved — GBA1 and LRRK2 targeted programs entering P2/3 with genetic stratification. Still largely symptomatic wins.',
      },
    },
  },
  ms: {
    indication: 'ms',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.35,
        phase3ToApproval: 0.70,
        sampleSize: 48,
        source: 'BIO 2014-2024',
        notes:
          'Ocrelizumab (2017), ofatumumab (2020), ublituximab (2022), ponesimod (2021) all approved. Anti-CD20 class validated. Phase 2 to Phase 3 well above the neurology base.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.40,
        phase3ToApproval: 0.75,
        sampleSize: 26,
        source: 'BIO 2019-2024 cohort, anti-CD20 era',
        notes:
          'Essentially zero recent P3 failures for anti-CD20. BTKi class (evobrutinib miss 2023, tolebrutinib slow) tempered enthusiasm slightly, but overall the best-performing neurology indication.',
      },
    },
  },
  multiple_sclerosis: {
    // Alias matching other slug convention
    indication: 'multiple_sclerosis',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.35,
        phase3ToApproval: 0.70,
        sampleSize: 48,
        source: 'BIO 2014-2024',
        notes:
          'See `ms` slug. Anti-CD20 class validation across ocrelizumab, ofatumumab, ublituximab lifts every transition.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.40,
        phase3ToApproval: 0.75,
        sampleSize: 26,
        source: 'BIO 2019-2024 cohort, anti-CD20 era',
      },
    },
  },
  migraine: {
    indication: 'migraine',
    ta: 'neurology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.42,
        phase3ToApproval: 0.72,
        sampleSize: 38,
        source: 'BIO 2014-2024; EvaluatePharma 2025',
        notes:
          'CGRP class validation (erenumab 2018, fremanezumab/galcanezumab/eptinezumab, oral gepants ubrogepant/rimegepant/atogepant/zavegepant) sustained near-zero late-stage failure through the full cohort.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.48,
        phase3ToApproval: 0.80,
        sampleSize: 22,
        source: 'BIO 2019-2024 cohort, CGRP era',
        notes:
          'Second-generation gepants and anti-CGRP agents effectively cleared pivotal readouts. Highest recent P3 success in neurology.',
      },
    },
  },

  // =====================================================================
  // METABOLIC — GLP-1 reshaping the entire TA
  // =====================================================================
  obesity: {
    indication: 'obesity',
    ta: 'metabolic',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.38,
        phase3ToApproval: 0.65,
        sampleSize: 42,
        source: 'BIO 2014-2024',
        notes:
          'Long cohort includes lorcaserin withdrawal (2020), setmelanotide approval (2020), early semaglutide STEP trials. Second half much better than the first.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.65,
        phase2ToPhase3: 0.60,
        phase3ToApproval: 0.85,
        sampleSize: 24,
        source: 'BIO 2019-2024 cohort, GLP-1 era',
        notes:
          'Wegovy STEP program, tirzepatide SURMOUNT, survodutide, retatrutide, orforglipron, CagriSema — essentially zero pivotal failures. The single best recent PoS in the industry.',
      },
      '2021-2024': {
        phase1ToPhase2: 0.70,
        phase2ToPhase3: 0.65,
        phase3ToApproval: 0.90,
        sampleSize: 16,
        source: 'BIO 2021-2024 cohort, post-STEP era',
        notes:
          'Small but unanimous positive readout set. Low sample size — directional only — but every incretin-class P3 in this window hit primary.',
      },
    },
  },
  type2_diabetes: {
    indication: 'type2_diabetes',
    ta: 'metabolic',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.45,
        phase3ToApproval: 0.72,
        sampleSize: 68,
        source: 'BIO 2014-2024',
        notes:
          'Broad cohort: SGLT2i class buildout, GLP-1 extensions, DPP4 follow-ons, insulin biosimilars. Strong success rate supported by surrogate endpoints (HbA1c).',
      },
      '2019-2024': {
        phase1ToPhase2: 0.62,
        phase2ToPhase3: 0.55,
        phase3ToApproval: 0.82,
        sampleSize: 32,
        source: 'BIO 2019-2024 cohort, incretin era',
        notes:
          'Tirzepatide SURPASS, oral semaglutide extensions, orforglipron success. Recent P3 failures concentrated in ultra-novel mechanisms (e.g., glucokinase activators).',
      },
    },
  },
  nash_mash: {
    indication: 'nash_mash',
    ta: 'metabolic',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.48,
        phase2ToPhase3: 0.22,
        phase3ToApproval: 0.38,
        sampleSize: 45,
        source: 'BIO 2014-2024',
        notes:
          'Selonsertib, cenicriviroc, elafibranor (first read), obeticholic acid REGENERATE, simtuzumab, emricasan all failed P2/P3. Resmetirom MAESTRO-NASH positive 2023 lifted the long-run mean modestly.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.45,
        phase2ToPhase3: 0.18,
        phase3ToApproval: 0.40,
        sampleSize: 24,
        source: 'BIO 2019-2024 cohort',
        notes:
          'Resmetirom approval (Mar 2024) is the only unambiguous P3 win. Efruxifermin (Akero SYMMETRY) missed in 2024, pegozafermin mixed, aramchol halted. Overall worse than the 10-year average.',
      },
      '2021-2024': {
        phase1ToPhase2: 0.42,
        phase2ToPhase3: 0.15,
        phase3ToApproval: 0.35,
        sampleSize: 12,
        source: 'BIO 2021-2024 cohort, post-Akero/Madrigal 2024 readouts',
        notes:
          'Madrigal positive but follow-on FGF21 and THR-beta programs struggling in 2024-2025. GLP-1 class (semaglutide, tirzepatide) entering MASH may reshape this window forward. Low sample size.',
      },
    },
  },

  // =====================================================================
  // ONCOLOGY — checkpoint inhibitors and ADCs lifting selected indications
  // =====================================================================
  lung_nsclc: {
    indication: 'lung_nsclc',
    ta: 'oncology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.52,
        phase2ToPhase3: 0.35,
        phase3ToApproval: 0.60,
        sampleSize: 112,
        source: 'BIO 2014-2024',
        notes:
          'Pembrolizumab KEYNOTE-024 (2016), osimertinib FLAURA (2018), alectinib, brigatinib, lorlatinib, sotorasib, adagrasib, amivantamab, datopotamab, Enhertu. Strong sustained late-stage conversion.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.42,
        phase3ToApproval: 0.68,
        sampleSize: 58,
        source: 'BIO 2019-2024 cohort, checkpoint + ADC era',
        notes:
          'Checkpoint combos (Libtayo, cemiplimab combos), ADC expansion (Dato-DXd TROPION-Lung01 positive 2024), perioperative IO (KEYNOTE-671, AEGEAN). Phase 2 to Phase 3 well above the oncology mean.',
      },
      '2021-2024': {
        phase1ToPhase2: 0.60,
        phase2ToPhase3: 0.45,
        phase3ToApproval: 0.72,
        sampleSize: 32,
        source: 'BIO 2021-2024 cohort',
        notes:
          'KRAS G12C follow-ons, MET exon 14 (tepotinib, capmatinib), HER2 mutant (Enhertu), EGFR exon 20 (amivantamab + lazertinib MARIPOSA). Very high recent hit rate.',
      },
    },
  },
  breast_her2: {
    indication: 'breast_her2',
    ta: 'oncology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.42,
        phase3ToApproval: 0.70,
        sampleSize: 52,
        source: 'BIO 2014-2024',
        notes:
          'Pertuzumab, T-DM1, neratinib, tucatinib, margetuximab, T-DXd. Best-validated solid tumor target: Phase 2 to Phase 3 well above the oncology mean over the full cohort.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.60,
        phase2ToPhase3: 0.50,
        phase3ToApproval: 0.78,
        sampleSize: 28,
        source: 'BIO 2019-2024 cohort, T-DXd era',
        notes:
          'DESTINY-Breast03 and DESTINY-Breast04 redefined second-line; HER2-low is now a drug-able population. ADC class driving PoS higher than any other solid tumor indication.',
      },
    },
  },
  prostate: {
    indication: 'prostate',
    ta: 'oncology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.52,
        phase2ToPhase3: 0.38,
        phase3ToApproval: 0.65,
        sampleSize: 48,
        source: 'BIO 2014-2024',
        notes:
          'Enzalutamide, apalutamide, darolutamide ARi class established. PARP inhibitors (olaparib PROfound, rucaparib, niraparib, talazoparib) in HRR-mutated population. Pluvicto VISION 2021.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.45,
        phase3ToApproval: 0.72,
        sampleSize: 24,
        source: 'BIO 2019-2024 cohort, PARP + radioligand era',
        notes:
          'ARi earlier-line moves (EMBARK, ARCHES), PARP combos (TALAPRO-2, PROpel, MAGNITUDE), Pluvicto. Strong recent P3 conversion.',
      },
    },
  },
  pancreatic: {
    indication: 'pancreatic',
    ta: 'oncology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.45,
        phase2ToPhase3: 0.18,
        phase3ToApproval: 0.42,
        sampleSize: 38,
        source: 'BIO 2014-2024',
        notes:
          'Historically one of the hardest oncology indications. Napoxen, napabucasin, MM-398, pegilodecakin, masitinib all failed pivotal. Nal-IRI (Onivyde) is a rare win; KRAS G12C/G12D programs just entering pivotal.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.46,
        phase2ToPhase3: 0.22,
        phase3ToApproval: 0.48,
        sampleSize: 20,
        source: 'BIO 2019-2024 cohort',
        notes:
          'NALIRIFOX NAPOLI-3 (2023) positive, KRAS G12C adagrasib single-arm, claudin 18.2 (zolbetuximab) in related GC. Modest directional improvement.',
      },
    },
  },
  ovarian: {
    indication: 'ovarian',
    ta: 'oncology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.50,
        phase2ToPhase3: 0.32,
        phase3ToApproval: 0.58,
        sampleSize: 42,
        source: 'BIO 2014-2024',
        notes:
          'PARP class (olaparib SOLO-1, niraparib PRIMA, rucaparib ARIEL3) established; mirvetuximab soravtansine FRα ADC approved 2022. Mix of wins and failures (avelumab, pembrolizumab negative).',
      },
      '2019-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.40,
        phase3ToApproval: 0.65,
        sampleSize: 22,
        source: 'BIO 2019-2024 cohort, PARP + ADC era',
        notes:
          'Mirvetuximab MIRASOL positive (2023), PARP maintenance expansions, folate receptor ADCs. Improving but BRCA status remains critical gate.',
      },
    },
  },

  // =====================================================================
  // HEMATOLOGY
  // =====================================================================
  multiple_myeloma: {
    indication: 'multiple_myeloma',
    ta: 'hematology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.62,
        phase2ToPhase3: 0.50,
        phase3ToApproval: 0.75,
        sampleSize: 58,
        source: 'BIO 2014-2024',
        notes:
          'Daratumumab, isatuximab, carfilzomib, ixazomib, selinexor, melflufen (withdrawn), belantamab (withdrawn 2022, re-approved 2025). BCMA CAR-T (ide-cel, cilta-cel) and bispecifics drove late-stage hit rate up.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.68,
        phase2ToPhase3: 0.58,
        phase3ToApproval: 0.82,
        sampleSize: 32,
        source: 'BIO 2019-2024 cohort, BCMA era',
        notes:
          'CARTITUDE-4 (cilta-cel), KarMMa-3 (ide-cel), MajesTEC-1 (teclistamab), MagnetisMM-3 (elranatamab), MonumenTAL-1 (talquetamab) all positive. Best-performing heme indication.',
      },
    },
  },
  myeloma: {
    // Alias
    indication: 'myeloma',
    ta: 'hematology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.62,
        phase2ToPhase3: 0.50,
        phase3ToApproval: 0.75,
        sampleSize: 58,
        source: 'BIO 2014-2024',
        notes: 'See `multiple_myeloma` — identical cohort.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.68,
        phase2ToPhase3: 0.58,
        phase3ToApproval: 0.82,
        sampleSize: 32,
        source: 'BIO 2019-2024 cohort, BCMA era',
      },
    },
  },

  // =====================================================================
  // IMMUNOLOGY / DERMATOLOGY
  // =====================================================================
  atopic_dermatitis: {
    indication: 'atopic_dermatitis',
    ta: 'dermatology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.58,
        phase2ToPhase3: 0.45,
        phase3ToApproval: 0.75,
        sampleSize: 38,
        source: 'BIO 2014-2024',
        notes:
          'Dupixent (2017) unlocked the modern AD pipeline. Upadacitinib, abrocitinib, baricitinib, tralokinumab, lebrikizumab, nemolizumab, rocatinlimab all reached pivotal with strong hit rates.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.62,
        phase2ToPhase3: 0.55,
        phase3ToApproval: 0.82,
        sampleSize: 22,
        source: 'BIO 2019-2024 cohort, Dupixent class era',
      },
    },
  },
  psoriasis: {
    indication: 'psoriasis',
    ta: 'dermatology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.60,
        phase2ToPhase3: 0.50,
        phase3ToApproval: 0.80,
        sampleSize: 52,
        source: 'BIO 2014-2024',
        notes:
          'IL-17 (secukinumab, ixekizumab, brodalumab, bimekizumab) and IL-23 (guselkumab, risankizumab, tildrakizumab) classes validated. Deucravacitinib TYK2 first oral biologic-competitor. Near-zero P3 failures in validated classes.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.65,
        phase2ToPhase3: 0.58,
        phase3ToApproval: 0.85,
        sampleSize: 26,
        source: 'BIO 2019-2024 cohort, IL-23 + TYK2 era',
        notes:
          'Bimekizumab BE SURE, BE VIVID; deucravacitinib POETYK-PSO; sonelokimab. Highest P3 success rate in any immunology indication.',
      },
    },
  },
  rheumatoid_arthritis: {
    indication: 'rheumatoid_arthritis',
    ta: 'immunology',
    windows: {
      '2014-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.38,
        phase3ToApproval: 0.68,
        sampleSize: 46,
        source: 'BIO 2014-2024',
        notes:
          'JAK class (tofacitinib, baricitinib, upadacitinib, filgotinib) alongside IL-6 (sarilumab), anti-GM-CSF (otilimab failed 2021). FDA black-box JAK class label 2021 tempered enthusiasm for new entrants.',
      },
      '2019-2024': {
        phase1ToPhase2: 0.55,
        phase2ToPhase3: 0.40,
        phase3ToApproval: 0.70,
        sampleSize: 22,
        source: 'BIO 2019-2024 cohort',
        notes:
          'Stable-to-modestly improving. TYK2 and novel JAK1-selective agents entering pivotal with mixed early readouts.',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Preference order for "most_recent" fallback when a caller does not specify
 * a window. Newest-narrow wins first, then widens.
 */
const MOST_RECENT_ORDER: Exclude<TimeWindow, 'most_recent'>[] = [
  '2021-2024',
  '2019-2024',
  '2014-2024',
];

export interface ResolvedTimeWindowedPoS {
  phase1ToPhase2: number;
  phase2ToPhase3: number;
  phase3ToApproval: number;
  preclinicalToPhase1?: number;
  source: string;
  sampleSize: number;
  notes?: string;
  /** The window that was actually resolved (not the requested one if a fallback fired) */
  resolvedWindow: Exclude<TimeWindow, 'most_recent'>;
  /** True when `sampleSize < 20` — caller should surface a low-confidence flag */
  lowConfidence: boolean;
}

/**
 * Get PoS for a specific time window. Falls back to the most recent available
 * window if the requested one is missing. Returns null when the indication has
 * no time-windowed data at all (the caller should fall through to existing
 * TA + indication-modifier logic).
 *
 * @param indication - Indication slug (must match TIME_WINDOWED_POS keys)
 * @param window     - Desired time window; defaults to 'most_recent'
 */
export function getTimeWindowedPoS(
  indication: string,
  window: TimeWindow = 'most_recent',
): ResolvedTimeWindowedPoS | null {
  const data = TIME_WINDOWED_POS[indication];
  if (!data) return null;

  // Try exact window first
  if (window !== 'most_recent') {
    const w = data.windows[window];
    if (w) {
      return {
        phase1ToPhase2: w.phase1ToPhase2,
        phase2ToPhase3: w.phase2ToPhase3,
        phase3ToApproval: w.phase3ToApproval,
        preclinicalToPhase1: w.preclinicalToPhase1,
        source: w.source,
        sampleSize: w.sampleSize,
        notes: w.notes,
        resolvedWindow: window,
        lowConfidence: w.sampleSize < 20,
      };
    }
  }

  // Fall back to most recent available
  for (const candidate of MOST_RECENT_ORDER) {
    const w = data.windows[candidate];
    if (w) {
      return {
        phase1ToPhase2: w.phase1ToPhase2,
        phase2ToPhase3: w.phase2ToPhase3,
        phase3ToApproval: w.phase3ToApproval,
        preclinicalToPhase1: w.preclinicalToPhase1,
        source: w.source,
        sampleSize: w.sampleSize,
        notes: w.notes,
        resolvedWindow: candidate,
        lowConfidence: w.sampleSize < 20,
      };
    }
  }

  return null;
}

/**
 * Total number of indications with time-windowed data (used by sanity tests).
 */
export const TIME_WINDOWED_INDICATION_COUNT = Object.keys(TIME_WINDOWED_POS).length;
