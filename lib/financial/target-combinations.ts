/**
 * Target Combination Profiles
 *
 * Models how multi-target approaches (bispecifics, conjugates, combination
 * mechanisms) affect PoS, peak sales, deal premiums, and CMC complexity.
 *
 * Each combination has:
 *   posModifier: compound PoS effect (>1 = synergy validated, <1 = complexity risk)
 *   peakSalesModifier: multi-target capture more market
 *   dealPremium: strategic premium for multi-target approach (additive)
 *   complexityPenalty: CMC/regulatory cost (multiplicative, <1 = harder)
 *
 * netEffect = posModifier * peakSalesModifier * complexityPenalty
 * dealPremium is applied separately in empirical-multiplier additive composition
 *
 * Sources:
 *   - FDA approval data for validated combinations
 *   - BIO/Informa combination therapy success rates 2024
 *   - Deal database: multi-target deals vs mono-target deal premiums
 */

export interface TargetCombination {
  key: string;
  targets: string[];
  indication?: string;
  posModifier: number;
  peakSalesModifier: number;
  dealPremium: number;
  complexityPenalty: number;
  netEffect: number;
  precedentDrug?: string;
  rationale: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Combination Database
// ---------------------------------------------------------------------------

export const TARGET_COMBINATIONS: Record<string, TargetCombination> = {

  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY
  // ═══════════════════════════════════════════════════════════════════════

  'pd1+ctla4': {
    key: 'pd1+ctla4', targets: ['pd1', 'ctla4'],
    posModifier: 1.15, peakSalesModifier: 1.25, dealPremium: 0.10, complexityPenalty: 0.92,
    netEffect: 1.15 * 1.25 * 0.92,
    precedentDrug: 'Opdualag (nivolumab + relatlimab)',
    rationale: 'Dual checkpoint validated in melanoma. Complementary immune mechanisms. Higher toxicity managed with dosing.',
    source: 'FDA 2022 Opdualag; Yervoy+Opdivo combination data across 10+ tumor types',
  },
  'pd1+vegf': {
    key: 'pd1+vegf', targets: ['pd1', 'vegf'],
    posModifier: 1.10, peakSalesModifier: 1.20, dealPremium: 0.08, complexityPenalty: 0.95,
    netEffect: 1.10 * 1.20 * 0.95,
    precedentDrug: 'Keytruda + Avastin; ivonescimab (PD-1/VEGF bispecific)',
    rationale: 'Anti-angiogenic + immunotherapy synergy validated across RCC, HCC, endometrial. Bispecific format emerging.',
    source: 'Keynote-426/581; Akeso ivonescimab Phase 3 positive NSCLC 2024',
  },
  'her2+her3': {
    key: 'her2+her3', targets: ['her2', 'egfr'],
    posModifier: 1.05, peakSalesModifier: 1.15, dealPremium: 0.07, complexityPenalty: 0.90,
    netEffect: 1.05 * 1.15 * 0.90,
    precedentDrug: 'Zenocutuzumab (HER2/HER3 bispecific)',
    rationale: 'Dual HER family blockade addresses resistance. NRG1 fusion tumors + broader HER2-low potential.',
    source: 'FDA 2024 zenocutuzumab accelerated approval; Merus Phase 2 data',
  },
  'egfr+met': {
    key: 'egfr+met', targets: ['egfr', 'met'],
    posModifier: 1.10, peakSalesModifier: 1.15, dealPremium: 0.08, complexityPenalty: 0.92,
    netEffect: 1.10 * 1.15 * 0.92,
    precedentDrug: 'Amivantamab (EGFR/MET bispecific)',
    rationale: 'Addresses EGFR resistance via MET bypass. Amivantamab $5B+ peak potential.',
    source: 'FDA 2021 amivantamab; MARIPOSA Phase 3 positive 2024',
  },
  'pd1+lag3': {
    key: 'pd1+lag3', targets: ['pd1', 'lag3'],
    posModifier: 1.05, peakSalesModifier: 1.10, dealPremium: 0.06, complexityPenalty: 0.95,
    netEffect: 1.05 * 1.10 * 0.95,
    precedentDrug: 'Opdualag (nivolumab + relatlimab)',
    rationale: 'Next-gen dual checkpoint. LAG-3 adds incremental benefit over PD-1 alone in melanoma.',
    source: 'RELATIVITY-047 Phase 2/3; FDA 2022 Opdualag',
  },
  'pd1+tigit': {
    key: 'pd1+tigit', targets: ['pd1', 'tigit'],
    posModifier: 0.75, peakSalesModifier: 0.90, dealPremium: 0.03, complexityPenalty: 0.95,
    netEffect: 0.75 * 0.90 * 0.95,
    rationale: 'High-risk combination after tiragolumab Phase 3 failures. Signal exists but inconsistent across trials.',
    source: 'SKYSCRAPER-01/02 Phase 3 failures; Merck vibostolimab Phase 2 mixed',
  },
  'bcma+cd3': {
    key: 'bcma+cd3', targets: ['bcma', 'cd19'],
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.07, complexityPenalty: 0.90,
    netEffect: 1.15 * 1.10 * 0.90,
    precedentDrug: 'Tecvayli (teclistamab, BCMAxCD3)',
    rationale: 'T-cell redirection to myeloma cells. BCMA engagement validated across CAR-T, bispecific, ADC.',
    source: 'FDA 2022 teclistamab; FDA 2023 elranatamab',
  },
  'trop2+topoi': {
    key: 'trop2+topoi', targets: ['trop2'],
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.08, complexityPenalty: 0.92,
    netEffect: 1.15 * 1.10 * 0.92,
    precedentDrug: 'Trodelvy (sacituzumab govitecan)',
    rationale: 'TROP2 ADC with topoisomerase I payload. Target + payload synergy in TNBC and urothelial.',
    source: 'FDA 2020/2021 Trodelvy; ASCENT/TROPiCS-02 Phase 3',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NEUROLOGY
  // ═══════════════════════════════════════════════════════════════════════

  'amyloid_beta+tau': {
    key: 'amyloid_beta+tau', targets: ['amyloid_beta', 'tau'],
    posModifier: 0.70, peakSalesModifier: 1.30, dealPremium: 0.10, complexityPenalty: 0.85,
    netEffect: 0.70 * 1.30 * 0.85,
    rationale: 'Dual-pathway AD approach addressing both pathological hallmarks. No precedent drug yet. High complexity but massive commercial upside if validated.',
    source: 'AC Immune pipeline (dual Aβ + tau); consensus that mono-amyloid insufficient for disease modification',
  },
  'amyloid_beta+tfr': {
    key: 'amyloid_beta+tfr', targets: ['amyloid_beta', 'tfr'],
    posModifier: 0.85, peakSalesModifier: 1.25, dealPremium: 0.09, complexityPenalty: 0.90,
    netEffect: 0.85 * 1.25 * 0.90,
    precedentDrug: 'Roche trontinemab (brain-shuttle anti-Aβ)',
    rationale: 'BBB-crossing antibody platform. TfR enables CNS delivery of anti-amyloid. AbbVie/Aliada $1.4B validates.',
    source: 'AbbVie/Aliada 2024 $1.4B acquisition; Roche brain shuttle platform',
  },
  'alpha_synuclein+gba1': {
    key: 'alpha_synuclein+gba1', targets: ['alpha_synuclein', 'gba1'],
    posModifier: 0.55, peakSalesModifier: 1.10, dealPremium: 0.06, complexityPenalty: 0.88,
    netEffect: 0.55 * 1.10 * 0.88,
    rationale: 'GBA mutation in ~10% PD patients amplifies synuclein aggregation. Dual approach for genetically defined PD subpopulation.',
    source: 'Prevail/Lilly gene therapy for GBA-PD; Roche prasinezumab Phase 2',
  },
  'tau+tfr': {
    key: 'tau+tfr', targets: ['tau', 'tfr'],
    posModifier: 0.65, peakSalesModifier: 1.20, dealPremium: 0.07, complexityPenalty: 0.88,
    netEffect: 0.65 * 1.20 * 0.88,
    rationale: 'BBB-crossing anti-tau antibody. Solves the CNS delivery challenge for tau immunotherapy.',
    source: 'Roche brain-shuttle anti-tau; JNJ/AC Immune tau antibody program',
  },
  'amyloid_beta+glymphatic': {
    key: 'amyloid_beta+glymphatic', targets: ['amyloid_beta', 'glymphatic'],
    posModifier: 0.50, peakSalesModifier: 1.25, dealPremium: 0.07, complexityPenalty: 0.85,
    netEffect: 0.50 * 1.25 * 0.85,
    rationale: 'Drug + device combination: anti-amyloid antibody + glymphatic clearance enhancement. Complementary MoA — antibody clears Aβ, device promotes CSF drainage.',
    source: 'Theoretical combination based on DeepsonBio Neuclare + lecanemab/donanemab class',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // IMMUNOLOGY
  // ═══════════════════════════════════════════════════════════════════════

  'il4r_alpha+il13': {
    key: 'il4r_alpha+il13', targets: ['il4r_alpha', 'il13'],
    posModifier: 1.25, peakSalesModifier: 1.30, dealPremium: 0.12, complexityPenalty: 0.95,
    netEffect: 1.25 * 1.30 * 0.95,
    precedentDrug: 'Dupixent (dupilumab)',
    rationale: 'Dual type 2 blockade. Dupixent is the most commercially successful biologic in history ($13B+).',
    source: 'FDA 2017 Dupixent; $13B+ peak sales trajectory',
  },
  'il17+il23': {
    key: 'il17+il23', targets: ['il17', 'il23'],
    posModifier: 1.05, peakSalesModifier: 1.20, dealPremium: 0.08, complexityPenalty: 0.88,
    netEffect: 1.05 * 1.20 * 0.88,
    precedentDrug: 'Bimekizumab (IL-17A/F); combo rationale with IL-23',
    rationale: 'Dual cytokine blockade for psoriasis/PsA. IL-23 sustains Th17 cells that produce IL-17.',
    source: 'UCB bimekizumab; AbbVie lutikizumab (IL-17A/F) Phase 3',
  },
  'tnf_alpha+il23': {
    key: 'tnf_alpha+il23', targets: ['tnf_alpha', 'il23'],
    posModifier: 0.90, peakSalesModifier: 1.15, dealPremium: 0.06, complexityPenalty: 0.88,
    netEffect: 0.90 * 1.15 * 0.88,
    rationale: 'Dual pathway for IBD. TNF backbone + IL-23 for refractory patients. Separate drugs, not bispecific yet.',
    source: 'Clinical practice combination; no approved bispecific',
  },
  'cd19+cd20': {
    key: 'cd19+cd20', targets: ['cd19', 'cd20'],
    posModifier: 1.10, peakSalesModifier: 1.05, dealPremium: 0.06, complexityPenalty: 0.90,
    netEffect: 1.10 * 1.05 * 0.90,
    rationale: 'Dual B-cell depletion for autoimmune reset. CAR-T and bispecific approaches targeting both antigens.',
    source: 'Cabaletta Bio DSG3-CAART; various bispecific programs',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // METABOLIC
  // ═══════════════════════════════════════════════════════════════════════

  'glp1r+gipr': {
    key: 'glp1r+gipr', targets: ['glp1r', 'gipr'],
    posModifier: 1.30, peakSalesModifier: 1.35, dealPremium: 0.14, complexityPenalty: 0.95,
    netEffect: 1.30 * 1.35 * 0.95,
    precedentDrug: 'Mounjaro/Zepbound (tirzepatide)',
    rationale: 'Dual incretin agonism. Tirzepatide >22% weight loss. Most validated metabolic combination.',
    source: 'FDA 2022/2023 tirzepatide; SURMOUNT Phase 3 ~22.5% weight loss',
  },
  'glp1r+gipr+gcgr': {
    key: 'glp1r+gipr+gcgr', targets: ['glp1r', 'gipr', 'gcgr'],
    posModifier: 1.10, peakSalesModifier: 1.40, dealPremium: 0.12, complexityPenalty: 0.88,
    netEffect: 1.10 * 1.40 * 0.88,
    precedentDrug: 'Retatrutide (Lilly triple incretin)',
    rationale: 'Triple incretin agonism. Retatrutide Phase 2 showed ~24% weight loss. Higher efficacy but GCG component adds hepatic/safety complexity.',
    source: 'Lilly retatrutide Phase 2; Nature Medicine 2023',
  },
  'glp1r+amylin': {
    key: 'glp1r+amylin', targets: ['glp1r', 'amylin'],
    posModifier: 1.15, peakSalesModifier: 1.25, dealPremium: 0.10, complexityPenalty: 0.95,
    netEffect: 1.15 * 1.25 * 0.95,
    precedentDrug: 'CagriSema (cagrilintide + semaglutide)',
    rationale: 'GLP-1 + amylin dual mechanism for obesity/T2D. Novo Nordisk CagriSema Phase 3.',
    source: 'Novo Nordisk REDEFINE Phase 3 program; ~25% weight loss target',
  },
  'sglt2+glp1r': {
    key: 'sglt2+glp1r', targets: ['sglt2', 'glp1r'],
    posModifier: 1.20, peakSalesModifier: 1.20, dealPremium: 0.08, complexityPenalty: 0.92,
    netEffect: 1.20 * 1.20 * 0.92,
    rationale: 'Complementary mechanisms: renal glucose excretion + incretin-mediated insulin. Cardiorenal + weight benefits.',
    source: 'Clinical practice combination; AZ/Lilly exploring oral combination pills',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OPHTHALMOLOGY
  // ═══════════════════════════════════════════════════════════════════════

  'vegf_ophtho+ang2': {
    key: 'vegf_ophtho+ang2', targets: ['vegf_ophtho', 'ang2'],
    posModifier: 1.20, peakSalesModifier: 1.25, dealPremium: 0.09, complexityPenalty: 0.95,
    netEffect: 1.20 * 1.25 * 0.95,
    precedentDrug: 'Vabysmo (faricimab)',
    rationale: 'Dual pathway: VEGF + Ang-2 blockade extends dosing interval from 4-8 weeks to 16 weeks.',
    source: 'FDA 2022 faricimab; TENAYA/LUCERNE Phase 3',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY
  // ═══════════════════════════════════════════════════════════════════════

  'btk+bcl2': {
    key: 'btk+bcl2', targets: ['btk', 'bcl2'],
    posModifier: 1.20, peakSalesModifier: 1.20, dealPremium: 0.09, complexityPenalty: 0.92,
    netEffect: 1.20 * 1.20 * 0.92,
    precedentDrug: 'Ibrutinib + Venetoclax (fixed-duration CLL)',
    rationale: 'BTKi + BCL-2i fixed-duration regimen. MRD-negative rates >70%. Replacing chemoimmunotherapy in CLL.',
    source: 'GLOW Phase 3; CLL14 Phase 3 (venetoclax + obinutuzumab)',
  },
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

function normalizeKey(targets: string[]): string {
  return [...targets].sort().join('+');
}

export function getTargetCombination(
  targets: string[],
  indication?: string,
): TargetCombination | undefined {
  if (targets.length < 2) return undefined;
  const key = normalizeKey(targets);

  const exactMatch = TARGET_COMBINATIONS[key];
  if (exactMatch) {
    if (!indication || !exactMatch.indication || exactMatch.indication === indication) {
      return exactMatch;
    }
  }

  for (const combo of Object.values(TARGET_COMBINATIONS)) {
    const comboKey = normalizeKey(combo.targets);
    if (comboKey === key) {
      if (!indication || !combo.indication || combo.indication === indication) {
        return combo;
      }
    }
  }

  return undefined;
}

/**
 * When no pre-defined combination exists, compute a default
 * interaction effect based on the number of targets.
 * Multi-target = moderate PoS complexity + moderate peak sales boost.
 */
export function getDefaultCombinationEffect(targetCount: number): {
  posModifier: number;
  peakSalesModifier: number;
  dealPremium: number;
  complexityPenalty: number;
} {
  if (targetCount <= 1) return { posModifier: 1.0, peakSalesModifier: 1.0, dealPremium: 0, complexityPenalty: 1.0 };
  if (targetCount === 2) return { posModifier: 0.90, peakSalesModifier: 1.10, dealPremium: 0.04, complexityPenalty: 0.92 };
  if (targetCount === 3) return { posModifier: 0.80, peakSalesModifier: 1.15, dealPremium: 0.06, complexityPenalty: 0.88 };
  return { posModifier: 0.70, peakSalesModifier: 1.20, dealPremium: 0.08, complexityPenalty: 0.85 };
}
