/**
 * Molecular Target Taxonomy
 *
 * ~100 molecular targets across 12 TAs with PoS modifiers, peak sales
 * adjustments, and deal premiums grounded in validation status.
 *
 * Validated = at least one approved drug against this target.
 * posModifier: multiplicative on phase transition rates (1.0 = neutral)
 * peakSalesModifier: multiplicative on peak sales estimate
 * dealPremium: additive premium in empirical multiplier composition
 *
 * Sources:
 *   - BIO/Informa Clinical Development Success Rates 2024–2026
 *   - Nature Reviews Drug Discovery target validation analyses
 *   - ZS Associates ADC PTRS Analysis 2024
 *   - FDA approvals database (validation status)
 *   - Ambrosia deal database calibration
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetCategory =
  | 'checkpoint'
  | 'kinase'
  | 'receptor'
  | 'enzyme'
  | 'ion_channel'
  | 'structural_protein'
  | 'signaling'
  | 'transporter'
  | 'epigenetic'
  | 'immune_modulator'
  | 'hormone_receptor'
  | 'cell_surface_antigen'
  | 'protease'
  | 'complement'
  | 'cytokine'
  | 'other';

export interface TargetEntry {
  slug: string;
  displayName: string;
  category: TargetCategory;
  therapeuticAreas: string[];
  validatedTarget: boolean;
  firstApprovedDrug?: string;
  approvalYear?: number;
  posModifier: number;
  peakSalesModifier: number;
  dealPremium: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export const TARGET_TAXONOMY: Record<string, TargetEntry> = {

  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY (30 targets)
  // ═══════════════════════════════════════════════════════════════════════

  pd1: {
    slug: 'pd1', displayName: 'PD-1', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Keytruda (pembrolizumab)', approvalYear: 2014,
    posModifier: 1.25, peakSalesModifier: 1.20, dealPremium: 0.08,
    source: 'FDA 2014; BIO 2024 checkpoint class LoA 25% vs 12% oncology avg',
  },
  pdl1: {
    slug: 'pdl1', displayName: 'PD-L1', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Tecentriq (atezolizumab)', approvalYear: 2016,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.06,
    source: 'FDA 2016; slightly lower premium than PD-1 due to class maturity',
  },
  ctla4: {
    slug: 'ctla4', displayName: 'CTLA-4', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Yervoy (ipilimumab)', approvalYear: 2011,
    posModifier: 1.10, peakSalesModifier: 0.90, dealPremium: 0.04,
    source: 'FDA 2011; mature target, combination-dependent value',
  },
  her2: {
    slug: 'her2', displayName: 'HER2', category: 'receptor',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Herceptin (trastuzumab)', approvalYear: 1998,
    posModifier: 1.30, peakSalesModifier: 1.25, dealPremium: 0.10,
    source: 'FDA 1998; highest-validated oncology target, biomarker-selected, multiple approved drugs',
  },
  egfr: {
    slug: 'egfr', displayName: 'EGFR', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Iressa (gefitinib)', approvalYear: 2003,
    posModifier: 1.25, peakSalesModifier: 1.15, dealPremium: 0.08,
    source: 'FDA 2003; biomarker-selected, multiple generations of inhibitors',
  },
  kras_g12c: {
    slug: 'kras_g12c', displayName: 'KRAS G12C', category: 'enzyme',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Lumakras (sotorasib)', approvalYear: 2021,
    posModifier: 1.15, peakSalesModifier: 1.00, dealPremium: 0.06,
    source: 'FDA 2021; first-ever RAS inhibitor approval after 40yr undruggable',
  },
  kras_g12d: {
    slug: 'kras_g12d', displayName: 'KRAS G12D', category: 'enzyme',
    therapeuticAreas: ['oncology'],
    validatedTarget: false,
    posModifier: 0.75, peakSalesModifier: 1.10, dealPremium: 0.04,
    source: 'No approvals; most common KRAS mutation (36% pancreatic), larger addressable than G12C',
  },
  vegf: {
    slug: 'vegf', displayName: 'VEGF/VEGFR', category: 'receptor',
    therapeuticAreas: ['oncology', 'ophthalmology'],
    validatedTarget: true, firstApprovedDrug: 'Avastin (bevacizumab)', approvalYear: 2004,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.06,
    source: 'FDA 2004; validated across oncology + ophthalmology',
  },
  alk: {
    slug: 'alk', displayName: 'ALK', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Xalkori (crizotinib)', approvalYear: 2011,
    posModifier: 1.25, peakSalesModifier: 0.95, dealPremium: 0.07,
    source: 'FDA 2011; biomarker-selected, 3 generations of inhibitors',
  },
  braf_v600e: {
    slug: 'braf_v600e', displayName: 'BRAF V600E', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Zelboraf (vemurafenib)', approvalYear: 2011,
    posModifier: 1.20, peakSalesModifier: 1.00, dealPremium: 0.06,
    source: 'FDA 2011; biomarker-selected melanoma, expanding to tumor-agnostic',
  },
  cdk4_6: {
    slug: 'cdk4_6', displayName: 'CDK4/6', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Ibrance (palbociclib)', approvalYear: 2015,
    posModifier: 1.20, peakSalesModifier: 1.15, dealPremium: 0.07,
    source: 'FDA 2015; blockbuster class in HR+ breast cancer',
  },
  trop2: {
    slug: 'trop2', displayName: 'TROP2', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Trodelvy (sacituzumab govitecan)', approvalYear: 2020,
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.08,
    source: 'FDA 2020; ADC target with broad solid tumor expression',
  },
  bcma: {
    slug: 'bcma', displayName: 'BCMA', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology', 'hematology'],
    validatedTarget: true, firstApprovedDrug: 'Abecma (idecabtagene vicleucel)', approvalYear: 2021,
    posModifier: 1.20, peakSalesModifier: 1.05, dealPremium: 0.07,
    source: 'FDA 2021; CAR-T + bispecific + ADC all validated against BCMA in myeloma',
  },
  cd19: {
    slug: 'cd19', displayName: 'CD19', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology', 'hematology', 'immunology'],
    validatedTarget: true, firstApprovedDrug: 'Kymriah (tisagenlecleucel)', approvalYear: 2017,
    posModifier: 1.25, peakSalesModifier: 1.00, dealPremium: 0.06,
    source: 'FDA 2017; foundational CAR-T target, expanding to autoimmune',
  },
  cd20: {
    slug: 'cd20', displayName: 'CD20', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology', 'hematology', 'immunology'],
    validatedTarget: true, firstApprovedDrug: 'Rituxan (rituximab)', approvalYear: 1997,
    posModifier: 1.25, peakSalesModifier: 1.00, dealPremium: 0.05,
    source: 'FDA 1997; one of the most validated targets in oncology/immunology',
  },
  fgfr: {
    slug: 'fgfr', displayName: 'FGFR', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Balversa (erdafitinib)', approvalYear: 2019,
    posModifier: 1.10, peakSalesModifier: 0.90, dealPremium: 0.05,
    source: 'FDA 2019; biomarker-selected bladder cancer',
  },
  met: {
    slug: 'met', displayName: 'MET', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Tabrecta (capmatinib)', approvalYear: 2020,
    posModifier: 1.10, peakSalesModifier: 0.95, dealPremium: 0.05,
    source: 'FDA 2020; MET exon 14 skipping in NSCLC',
  },
  ret: {
    slug: 'ret', displayName: 'RET', category: 'kinase',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Retevmo (selpercatinib)', approvalYear: 2020,
    posModifier: 1.15, peakSalesModifier: 0.90, dealPremium: 0.06,
    source: 'FDA 2020; tumor-agnostic potential',
  },
  parp: {
    slug: 'parp', displayName: 'PARP', category: 'enzyme',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Lynparza (olaparib)', approvalYear: 2014,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2014; BRCA-selected, expanding to HRD-positive',
  },
  lag3: {
    slug: 'lag3', displayName: 'LAG-3', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Opdualag (nivolumab + relatlimab)', approvalYear: 2022,
    posModifier: 1.05, peakSalesModifier: 0.85, dealPremium: 0.04,
    source: 'FDA 2022; combo-dependent, next-gen checkpoint',
  },
  tigit: {
    slug: 'tigit', displayName: 'TIGIT', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: false,
    posModifier: 0.65, peakSalesModifier: 0.80, dealPremium: 0.02,
    source: 'Multiple Phase 3 failures (tiragolumab); high-risk target class',
  },
  claudin18_2: {
    slug: 'claudin18_2', displayName: 'Claudin 18.2', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Vyloy (zolbetuximab)', approvalYear: 2024,
    posModifier: 1.10, peakSalesModifier: 1.05, dealPremium: 0.06,
    source: 'FDA 2024; gastric cancer, ADC + bispecific pipeline building',
  },
  dll3: {
    slug: 'dll3', displayName: 'DLL3', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology'],
    validatedTarget: false,
    posModifier: 0.80, peakSalesModifier: 0.90, dealPremium: 0.04,
    source: 'No approvals; tarlatamab (bispecific) Phase 2 promising in SCLC',
  },
  folr_alpha: {
    slug: 'folr_alpha', displayName: 'FRα (Folate Receptor α)', category: 'receptor',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Elahere (mirvetuximab soravtansine)', approvalYear: 2022,
    posModifier: 1.10, peakSalesModifier: 0.95, dealPremium: 0.06,
    source: 'FDA 2022; FRα-high ovarian cancer ADC',
  },
  nectin4: {
    slug: 'nectin4', displayName: 'Nectin-4', category: 'cell_surface_antigen',
    therapeuticAreas: ['oncology'],
    validatedTarget: true, firstApprovedDrug: 'Padcev (enfortumab vedotin)', approvalYear: 2019,
    posModifier: 1.15, peakSalesModifier: 1.05, dealPremium: 0.07,
    source: 'FDA 2019; blockbuster ADC in urothelial, expanding to other solid tumors',
  },
  b7h3: {
    slug: 'b7h3', displayName: 'B7-H3', category: 'checkpoint',
    therapeuticAreas: ['oncology'],
    validatedTarget: false,
    posModifier: 0.70, peakSalesModifier: 0.90, dealPremium: 0.03,
    source: 'No approvals; multiple ADC and CAR-T programs in Phase 1-2',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NEUROLOGY (16 targets)
  // ═══════════════════════════════════════════════════════════════════════

  amyloid_beta: {
    slug: 'amyloid_beta', displayName: 'Amyloid-β (Aβ)', category: 'structural_protein',
    therapeuticAreas: ['neurology'],
    validatedTarget: true, firstApprovedDrug: 'Leqembi (lecanemab)', approvalYear: 2023,
    posModifier: 1.10, peakSalesModifier: 1.20, dealPremium: 0.08,
    source: 'FDA 2023; first disease-modifying AD therapy, surrogate endpoint accepted',
  },
  tau: {
    slug: 'tau', displayName: 'Tau', category: 'structural_protein',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.60, peakSalesModifier: 1.15, dealPremium: 0.05,
    source: 'No approvals; multiple Phase 2 failures (semorinemab, gosuranemab). AC Immune/Takeda $2.2B deal validates commercial interest',
  },
  alpha_synuclein: {
    slug: 'alpha_synuclein', displayName: 'α-Synuclein', category: 'structural_protein',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.55, peakSalesModifier: 1.10, dealPremium: 0.04,
    source: 'No approvals; prasinezumab Phase 2b mixed results. Central PD target.',
  },
  lrrk2: {
    slug: 'lrrk2', displayName: 'LRRK2', category: 'kinase',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.65, peakSalesModifier: 0.90, dealPremium: 0.04,
    source: 'No approvals; genetic PD target (~2% of PD), smaller addressable but higher PoS in biomarker-selected',
  },
  gba1: {
    slug: 'gba1', displayName: 'GBA1 (Glucocerebrosidase)', category: 'enzyme',
    therapeuticAreas: ['neurology', 'rareDisease'],
    validatedTarget: false,
    posModifier: 0.65, peakSalesModifier: 0.85, dealPremium: 0.04,
    source: 'No approvals for neuro; GBA mutations in ~10% PD. Sanofi/Prevail gene therapy approach.',
  },
  tfr: {
    slug: 'tfr', displayName: 'TfR (Transferrin Receptor)', category: 'transporter',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.80, peakSalesModifier: 1.15, dealPremium: 0.06,
    source: 'No approvals; BBB-crossing platform target. AbbVie/Aliada $1.4B acquisition validates delivery premium',
  },
  cgrp: {
    slug: 'cgrp', displayName: 'CGRP', category: 'signaling',
    therapeuticAreas: ['neurology'],
    validatedTarget: true, firstApprovedDrug: 'Aimovig (erenumab)', approvalYear: 2018,
    posModifier: 1.25, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2018; migraine prevention, 4 approved drugs in class',
  },
  nav1_7: {
    slug: 'nav1_7', displayName: 'Nav1.7', category: 'ion_channel',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.50, peakSalesModifier: 1.20, dealPremium: 0.03,
    source: 'No approvals; genetic validation (CIP) but clinical translation failures (Vertex, Lilly). High-value if solved.',
  },
  trem2: {
    slug: 'trem2', displayName: 'TREM2', category: 'receptor',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.60, peakSalesModifier: 1.00, dealPremium: 0.04,
    source: 'No approvals; neuroinflammation/microglial target. Vigil/Alector approaches in Phase 1.',
  },
  sv2a: {
    slug: 'sv2a', displayName: 'SV2A', category: 'receptor',
    therapeuticAreas: ['neurology'],
    validatedTarget: true, firstApprovedDrug: 'Keppra (levetiracetam)', approvalYear: 1999,
    posModifier: 1.15, peakSalesModifier: 0.80, dealPremium: 0.03,
    source: 'FDA 1999; epilepsy, mature target with generic competition',
  },
  sod1: {
    slug: 'sod1', displayName: 'SOD1', category: 'enzyme',
    therapeuticAreas: ['neurology', 'rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Qalsody (tofersen)', approvalYear: 2023,
    posModifier: 1.10, peakSalesModifier: 0.75, dealPremium: 0.05,
    source: 'FDA 2023 (accelerated); SOD1-ALS, small patient population (~2% ALS)',
  },
  htt: {
    slug: 'htt', displayName: 'Huntingtin (HTT)', category: 'structural_protein',
    therapeuticAreas: ['neurology', 'rareDisease'],
    validatedTarget: false,
    posModifier: 0.50, peakSalesModifier: 0.90, dealPremium: 0.03,
    source: 'No approvals; Roche/Ionis tominersen Phase 3 failure. Genetic validation but clinical translation challenge.',
  },
  nmda: {
    slug: 'nmda', displayName: 'NMDA Receptor', category: 'receptor',
    therapeuticAreas: ['neurology', 'psychiatry'],
    validatedTarget: true, firstApprovedDrug: 'Namenda (memantine)', approvalYear: 2003,
    posModifier: 1.05, peakSalesModifier: 0.85, dealPremium: 0.03,
    source: 'FDA 2003; Alzheimer cognitive benefit, moderate class',
  },
  app: {
    slug: 'app', displayName: 'APP (Amyloid Precursor Protein)', category: 'enzyme',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.45, peakSalesModifier: 1.10, dealPremium: 0.03,
    source: 'No approvals; BACE inhibitor class failed (verubecestat, atabecestat). High-risk after class-wide failures.',
  },
  glymphatic: {
    slug: 'glymphatic', displayName: 'Glymphatic/CSF Clearance', category: 'other',
    therapeuticAreas: ['neurology'],
    validatedTarget: false,
    posModifier: 0.50, peakSalesModifier: 1.20, dealPremium: 0.05,
    source: 'No approvals; novel mechanism (brain waste clearance). DeepsonBio Neuclare is lead device program.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // IMMUNOLOGY (14 targets)
  // ═══════════════════════════════════════════════════════════════════════

  tnf_alpha: {
    slug: 'tnf_alpha', displayName: 'TNF-α', category: 'cytokine',
    therapeuticAreas: ['immunology', 'gastroenterology', 'dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Remicade (infliximab)', approvalYear: 1998,
    posModifier: 1.25, peakSalesModifier: 0.80, dealPremium: 0.04,
    source: 'FDA 1998; most validated autoimmune target, now heavily genericized/biosimilar',
  },
  il17: {
    slug: 'il17', displayName: 'IL-17A', category: 'cytokine',
    therapeuticAreas: ['immunology', 'dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Cosentyx (secukinumab)', approvalYear: 2015,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2015; psoriasis/PsA/AS blockbuster class',
  },
  il23: {
    slug: 'il23', displayName: 'IL-23 (p19)', category: 'cytokine',
    therapeuticAreas: ['immunology', 'dermatology', 'gastroenterology'],
    validatedTarget: true, firstApprovedDrug: 'Skyrizi (risankizumab)', approvalYear: 2019,
    posModifier: 1.25, peakSalesModifier: 1.20, dealPremium: 0.09,
    source: 'FDA 2019; fastest-growing autoimmune class, expanding to IBD',
  },
  il13: {
    slug: 'il13', displayName: 'IL-13', category: 'cytokine',
    therapeuticAreas: ['immunology', 'dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Dupixent (dupilumab, IL-4Rα/IL-13)', approvalYear: 2017,
    posModifier: 1.25, peakSalesModifier: 1.25, dealPremium: 0.10,
    source: 'FDA 2017; Dupixent $13B+ peak sales, type 2 inflammation platform',
  },
  il4r_alpha: {
    slug: 'il4r_alpha', displayName: 'IL-4Rα', category: 'receptor',
    therapeuticAreas: ['immunology', 'dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Dupixent (dupilumab)', approvalYear: 2017,
    posModifier: 1.25, peakSalesModifier: 1.25, dealPremium: 0.10,
    source: 'FDA 2017; same as IL-13 (Dupixent is dual IL-4Rα/IL-13)',
  },
  fcrn: {
    slug: 'fcrn', displayName: 'FcRn', category: 'receptor',
    therapeuticAreas: ['immunology', 'neurology'],
    validatedTarget: true, firstApprovedDrug: 'Vyvgart (efgartigimod)', approvalYear: 2021,
    posModifier: 1.15, peakSalesModifier: 1.05, dealPremium: 0.07,
    source: 'FDA 2021; IgG autoantibody reduction platform, expanding indications',
  },
  tl1a: {
    slug: 'tl1a', displayName: 'TL1A', category: 'cytokine',
    therapeuticAreas: ['immunology', 'gastroenterology'],
    validatedTarget: false,
    posModifier: 0.80, peakSalesModifier: 1.15, dealPremium: 0.06,
    source: 'No approvals; Prometheus-Merck $10.8B acquisition validates target. Phase 2 data strong in UC/CD.',
  },
  c5: {
    slug: 'c5', displayName: 'C5 (Complement)', category: 'complement',
    therapeuticAreas: ['immunology', 'hematology', 'rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Soliris (eculizumab)', approvalYear: 2007,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2007; PNH/aHUS, Ultomiris successor, Iptacopan oral competitor emerging',
  },
  integrin_a4b7: {
    slug: 'integrin_a4b7', displayName: 'α4β7 Integrin', category: 'receptor',
    therapeuticAreas: ['immunology', 'gastroenterology'],
    validatedTarget: true, firstApprovedDrug: 'Entyvio (vedolizumab)', approvalYear: 2014,
    posModifier: 1.15, peakSalesModifier: 1.05, dealPremium: 0.06,
    source: 'FDA 2014; gut-selective IBD therapy',
  },
  jak1: {
    slug: 'jak1', displayName: 'JAK1', category: 'kinase',
    therapeuticAreas: ['immunology', 'dermatology', 'hematology'],
    validatedTarget: true, firstApprovedDrug: 'Rinvoq (upadacitinib)', approvalYear: 2019,
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.06,
    source: 'FDA 2019; oral JAK1 selective, safety boxed warning limits premium',
  },
  baff: {
    slug: 'baff', displayName: 'BAFF/BLyS', category: 'cytokine',
    therapeuticAreas: ['immunology'],
    validatedTarget: true, firstApprovedDrug: 'Benlysta (belimumab)', approvalYear: 2011,
    posModifier: 1.05, peakSalesModifier: 0.90, dealPremium: 0.04,
    source: 'FDA 2011; first lupus drug in 50 years, modest efficacy limits premium',
  },
  tslp: {
    slug: 'tslp', displayName: 'TSLP', category: 'cytokine',
    therapeuticAreas: ['immunology'],
    validatedTarget: true, firstApprovedDrug: 'Tezspire (tezepelumab)', approvalYear: 2021,
    posModifier: 1.10, peakSalesModifier: 1.05, dealPremium: 0.06,
    source: 'FDA 2021; upstream asthma target, broad patient population (no biomarker required)',
  },
  s1p1: {
    slug: 's1p1', displayName: 'S1P1', category: 'receptor',
    therapeuticAreas: ['immunology', 'neurology'],
    validatedTarget: true, firstApprovedDrug: 'Gilenya (fingolimod)', approvalYear: 2010,
    posModifier: 1.15, peakSalesModifier: 1.00, dealPremium: 0.05,
    source: 'FDA 2010; MS and UC, oral modality advantage',
  },
  icos: {
    slug: 'icos', displayName: 'ICOS', category: 'checkpoint',
    therapeuticAreas: ['immunology', 'oncology'],
    validatedTarget: false,
    posModifier: 0.70, peakSalesModifier: 0.85, dealPremium: 0.03,
    source: 'No approvals; co-stimulatory checkpoint, Phase 1-2 programs',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // METABOLIC + CARDIOVASCULAR (12 targets)
  // ═══════════════════════════════════════════════════════════════════════

  glp1r: {
    slug: 'glp1r', displayName: 'GLP-1 Receptor', category: 'receptor',
    therapeuticAreas: ['metabolic'],
    validatedTarget: true, firstApprovedDrug: 'Byetta (exenatide)', approvalYear: 2005,
    posModifier: 1.30, peakSalesModifier: 1.30, dealPremium: 0.12,
    source: 'FDA 2005; GLP-1 class >$50B market (Ozempic, Mounjaro, Wegovy). Highest-premium metabolic target.',
  },
  gipr: {
    slug: 'gipr', displayName: 'GIP Receptor', category: 'receptor',
    therapeuticAreas: ['metabolic'],
    validatedTarget: true, firstApprovedDrug: 'Mounjaro (tirzepatide, GLP-1/GIP dual)', approvalYear: 2022,
    posModifier: 1.25, peakSalesModifier: 1.25, dealPremium: 0.10,
    source: 'FDA 2022; dual incretin validated, tirzepatide >$10B revenue trajectory',
  },
  gcgr: {
    slug: 'gcgr', displayName: 'Glucagon Receptor (GCGR)', category: 'receptor',
    therapeuticAreas: ['metabolic'],
    validatedTarget: false,
    posModifier: 0.80, peakSalesModifier: 1.15, dealPremium: 0.06,
    source: 'No approvals as mono; triple incretin (GLP-1/GIP/GCG) in Phase 2 (retatrutide). High commercial interest.',
  },
  sglt2: {
    slug: 'sglt2', displayName: 'SGLT2', category: 'transporter',
    therapeuticAreas: ['metabolic', 'cardiovascular'],
    validatedTarget: true, firstApprovedDrug: 'Invokana (canagliflozin)', approvalYear: 2013,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.06,
    source: 'FDA 2013; diabetes + HF + CKD, expanding indication profile',
  },
  pcsk9: {
    slug: 'pcsk9', displayName: 'PCSK9', category: 'enzyme',
    therapeuticAreas: ['cardiovascular', 'metabolic'],
    validatedTarget: true, firstApprovedDrug: 'Repatha (evolocumab)', approvalYear: 2015,
    posModifier: 1.20, peakSalesModifier: 1.05, dealPremium: 0.06,
    source: 'FDA 2015; LDL lowering, siRNA (inclisiran) expanding access',
  },
  lpa: {
    slug: 'lpa', displayName: 'Lp(a) / Lipoprotein(a)', category: 'signaling',
    therapeuticAreas: ['cardiovascular'],
    validatedTarget: false,
    posModifier: 0.75, peakSalesModifier: 1.20, dealPremium: 0.06,
    source: 'No approvals; genetic validation strong, Novartis pelacarsen + Amgen olpasiran in Phase 3. $15B+ projected TAM.',
  },
  angiotensinogen: {
    slug: 'angiotensinogen', displayName: 'Angiotensinogen (AGT)', category: 'signaling',
    therapeuticAreas: ['cardiovascular'],
    validatedTarget: false,
    posModifier: 0.75, peakSalesModifier: 1.15, dealPremium: 0.05,
    source: 'No approvals; Alnylam zilebesiran (siRNA) Phase 2 positive in resistant HTN. Novel upstream RAAS target.',
  },
  myosin: {
    slug: 'myosin', displayName: 'Cardiac Myosin', category: 'structural_protein',
    therapeuticAreas: ['cardiovascular'],
    validatedTarget: true, firstApprovedDrug: 'Camzyos (mavacamten)', approvalYear: 2022,
    posModifier: 1.15, peakSalesModifier: 1.00, dealPremium: 0.07,
    source: 'FDA 2022; HCM, BMS acquired MyoKardia for $13B',
  },
  factor_xi: {
    slug: 'factor_xi', displayName: 'Factor XI', category: 'protease',
    therapeuticAreas: ['cardiovascular', 'hematology'],
    validatedTarget: false,
    posModifier: 0.80, peakSalesModifier: 1.10, dealPremium: 0.05,
    source: 'No approvals; genetic rationale (FXI deficiency = low bleeding + preserved hemostasis). Multiple Phase 2-3 programs.',
  },
  amylin: {
    slug: 'amylin', displayName: 'Amylin Receptor', category: 'receptor',
    therapeuticAreas: ['metabolic'],
    validatedTarget: true, firstApprovedDrug: 'Symlin (pramlintide)', approvalYear: 2005,
    posModifier: 1.05, peakSalesModifier: 1.10, dealPremium: 0.05,
    source: 'FDA 2005; next-gen long-acting amylin analogs (cagrilintide) in Phase 3 with semaglutide',
  },
  apoc3: {
    slug: 'apoc3', displayName: 'APOC3', category: 'signaling',
    therapeuticAreas: ['cardiovascular', 'metabolic'],
    validatedTarget: true, firstApprovedDrug: 'Waylivra (volanesorsen)', approvalYear: 2019,
    posModifier: 1.05, peakSalesModifier: 0.85, dealPremium: 0.04,
    source: 'EMA 2019 (conditional); hypertriglyceridemia, limited uptake',
  },
  fxr: {
    slug: 'fxr', displayName: 'FXR (Farnesoid X Receptor)', category: 'receptor',
    therapeuticAreas: ['metabolic', 'gastroenterology'],
    validatedTarget: false,
    posModifier: 0.60, peakSalesModifier: 1.00, dealPremium: 0.03,
    source: 'No approvals; Intercept OCA Phase 3 CRL. NASH/MASH target class impaired by safety signals.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RARE DISEASE (6 targets)
  // ═══════════════════════════════════════════════════════════════════════

  smn2: {
    slug: 'smn2', displayName: 'SMN2 (Survival Motor Neuron)', category: 'signaling',
    therapeuticAreas: ['rareDisease', 'neurology'],
    validatedTarget: true, firstApprovedDrug: 'Spinraza (nusinersen)', approvalYear: 2016,
    posModifier: 1.20, peakSalesModifier: 0.90, dealPremium: 0.07,
    source: 'FDA 2016; SMA, 3 approved therapies (ASO, gene therapy, oral). Gold standard rare disease target.',
  },
  dystrophin: {
    slug: 'dystrophin', displayName: 'Dystrophin (DMD)', category: 'structural_protein',
    therapeuticAreas: ['rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Exondys 51 (eteplirsen)', approvalYear: 2016,
    posModifier: 1.05, peakSalesModifier: 0.85, dealPremium: 0.05,
    source: 'FDA 2016 (accelerated); exon-skipping platform, controversial efficacy data',
  },
  gaa: {
    slug: 'gaa', displayName: 'GAA (Acid α-Glucosidase)', category: 'enzyme',
    therapeuticAreas: ['rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Myozyme (alglucosidase alfa)', approvalYear: 2006,
    posModifier: 1.15, peakSalesModifier: 0.80, dealPremium: 0.05,
    source: 'FDA 2006; Pompe disease ERT, next-gen cipaglucosidase alfa (Nexviazyme)',
  },
  gla: {
    slug: 'gla', displayName: 'α-Galactosidase A (GLA)', category: 'enzyme',
    therapeuticAreas: ['rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Fabrazyme (agalsidase beta)', approvalYear: 2003,
    posModifier: 1.15, peakSalesModifier: 0.80, dealPremium: 0.05,
    source: 'FDA 2003; Fabry disease ERT, gene therapy approaches competing',
  },
  cftr: {
    slug: 'cftr', displayName: 'CFTR', category: 'ion_channel',
    therapeuticAreas: ['rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Trikafta (elexacaftor/tezacaftor/ivacaftor)', approvalYear: 2019,
    posModifier: 1.30, peakSalesModifier: 1.15, dealPremium: 0.10,
    source: 'FDA 2019; CF triple combo, $9B peak sales, gold standard small molecule rare disease',
  },
  aagt: {
    slug: 'aagt', displayName: 'AAT (α1-Antitrypsin)', category: 'protease',
    therapeuticAreas: ['rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Prolastin (alpha-1 proteinase inhibitor)', approvalYear: 1987,
    posModifier: 1.10, peakSalesModifier: 0.85, dealPremium: 0.04,
    source: 'FDA 1987; AATD augmentation, next-gen siRNA (Arrowhead, Vertex) in development',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // OPHTHALMOLOGY (4 targets)
  // ═══════════════════════════════════════════════════════════════════════

  vegf_ophtho: {
    slug: 'vegf_ophtho', displayName: 'VEGF (Ophthalmic)', category: 'receptor',
    therapeuticAreas: ['ophthalmology'],
    validatedTarget: true, firstApprovedDrug: 'Lucentis (ranibizumab)', approvalYear: 2006,
    posModifier: 1.25, peakSalesModifier: 1.15, dealPremium: 0.08,
    source: 'FDA 2006; wet AMD/DME, blockbuster class (Eylea $10B+)',
  },
  ang2: {
    slug: 'ang2', displayName: 'Ang-2', category: 'signaling',
    therapeuticAreas: ['ophthalmology'],
    validatedTarget: true, firstApprovedDrug: 'Vabysmo (faricimab, VEGF/Ang-2 bispecific)', approvalYear: 2022,
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2022; extended durability vs VEGF-only, Roche blockbuster',
  },
  rpe65: {
    slug: 'rpe65', displayName: 'RPE65', category: 'enzyme',
    therapeuticAreas: ['ophthalmology', 'rareDisease'],
    validatedTarget: true, firstApprovedDrug: 'Luxturna (voretigene neparvovec)', approvalYear: 2017,
    posModifier: 1.10, peakSalesModifier: 0.70, dealPremium: 0.06,
    source: 'FDA 2017; first ocular gene therapy, small population (IRD/LCA2)',
  },
  c3_ophtho: {
    slug: 'c3_ophtho', displayName: 'C3 (Complement, Ophthalmic)', category: 'complement',
    therapeuticAreas: ['ophthalmology'],
    validatedTarget: true, firstApprovedDrug: 'Syfovre (pegcetacoplan)', approvalYear: 2023,
    posModifier: 1.10, peakSalesModifier: 1.00, dealPremium: 0.06,
    source: 'FDA 2023; geographic atrophy (dry AMD), first approved therapy for GA',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // INFECTIOUS DISEASE (4 targets)
  // ═══════════════════════════════════════════════════════════════════════

  hiv_integrase: {
    slug: 'hiv_integrase', displayName: 'HIV Integrase', category: 'enzyme',
    therapeuticAreas: ['infectiousDisease'],
    validatedTarget: true, firstApprovedDrug: 'Isentress (raltegravir)', approvalYear: 2007,
    posModifier: 1.20, peakSalesModifier: 1.00, dealPremium: 0.05,
    source: 'FDA 2007; backbone of modern ART regimens (dolutegravir, cabotegravir)',
  },
  hbv_surface_antigen: {
    slug: 'hbv_surface_antigen', displayName: 'HBsAg (HBV Surface Antigen)', category: 'structural_protein',
    therapeuticAreas: ['infectiousDisease'],
    validatedTarget: false,
    posModifier: 0.65, peakSalesModifier: 1.15, dealPremium: 0.05,
    source: 'No functional cure approved; siRNA + capsid inhibitor combos in Phase 2. $20B+ HBV cure market.',
  },
  rsv_f_protein: {
    slug: 'rsv_f_protein', displayName: 'RSV F Protein', category: 'structural_protein',
    therapeuticAreas: ['infectiousDisease'],
    validatedTarget: true, firstApprovedDrug: 'Arexvy (RSVPreF3)', approvalYear: 2023,
    posModifier: 1.15, peakSalesModifier: 1.10, dealPremium: 0.06,
    source: 'FDA 2023; RSV vaccine + nirsevimab (preventive mAb). Large addressable.',
  },
  neuraminidase: {
    slug: 'neuraminidase', displayName: 'Neuraminidase (Influenza)', category: 'enzyme',
    therapeuticAreas: ['infectiousDisease'],
    validatedTarget: true, firstApprovedDrug: 'Tamiflu (oseltamivir)', approvalYear: 1999,
    posModifier: 1.15, peakSalesModifier: 0.90, dealPremium: 0.04,
    source: 'FDA 1999; mature target, generic competition, pandemic stockpile value',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY (4 targets)
  // ═══════════════════════════════════════════════════════════════════════

  btk: {
    slug: 'btk', displayName: 'BTK (Bruton Tyrosine Kinase)', category: 'kinase',
    therapeuticAreas: ['hematology', 'immunology'],
    validatedTarget: true, firstApprovedDrug: 'Imbruvica (ibrutinib)', approvalYear: 2013,
    posModifier: 1.25, peakSalesModifier: 1.15, dealPremium: 0.08,
    source: 'FDA 2013; CLL/MCL blockbuster, next-gen covalent + non-covalent inhibitors',
  },
  bcl2: {
    slug: 'bcl2', displayName: 'BCL-2', category: 'signaling',
    therapeuticAreas: ['hematology'],
    validatedTarget: true, firstApprovedDrug: 'Venclexta (venetoclax)', approvalYear: 2016,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2016; AML/CLL, $2.5B+ sales, expanding to solid tumors',
  },
  cd38: {
    slug: 'cd38', displayName: 'CD38', category: 'cell_surface_antigen',
    therapeuticAreas: ['hematology'],
    validatedTarget: true, firstApprovedDrug: 'Darzalex (daratumumab)', approvalYear: 2015,
    posModifier: 1.20, peakSalesModifier: 1.10, dealPremium: 0.07,
    source: 'FDA 2015; myeloma backbone, $10B+ peak trajectory',
  },
  flt3: {
    slug: 'flt3', displayName: 'FLT3', category: 'kinase',
    therapeuticAreas: ['hematology'],
    validatedTarget: true, firstApprovedDrug: 'Rydapt (midostaurin)', approvalYear: 2017,
    posModifier: 1.10, peakSalesModifier: 0.90, dealPremium: 0.05,
    source: 'FDA 2017; FLT3-mutated AML, gilteritinib successor compounds in development',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DERMATOLOGY (3 targets)
  // ═══════════════════════════════════════════════════════════════════════

  il31: {
    slug: 'il31', displayName: 'IL-31', category: 'cytokine',
    therapeuticAreas: ['dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Nemluvio (nemolizumab)', approvalYear: 2024,
    posModifier: 1.10, peakSalesModifier: 1.00, dealPremium: 0.06,
    source: 'FDA 2024; prurigo nodularis/AD pruritus, anti-itch mechanism',
  },
  il36: {
    slug: 'il36', displayName: 'IL-36R', category: 'receptor',
    therapeuticAreas: ['dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Spevigo (spesolimab)', approvalYear: 2022,
    posModifier: 1.10, peakSalesModifier: 0.85, dealPremium: 0.05,
    source: 'FDA 2022; generalized pustular psoriasis (rare derm)',
  },
  osx: {
    slug: 'osx', displayName: 'OX40', category: 'checkpoint',
    therapeuticAreas: ['dermatology', 'immunology'],
    validatedTarget: false,
    posModifier: 0.70, peakSalesModifier: 0.90, dealPremium: 0.03,
    source: 'No approvals; amlitelimab (anti-OX40L) Phase 2b positive in AD. Next-gen immune modulator.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // GASTROENTEROLOGY (3 targets — IL-23, TL1A, α4β7 covered above)
  // ═══════════════════════════════════════════════════════════════════════

  tnf_gi: {
    slug: 'tnf_gi', displayName: 'TNF-α (GI)', category: 'cytokine',
    therapeuticAreas: ['gastroenterology'],
    validatedTarget: true, firstApprovedDrug: 'Remicade (infliximab)', approvalYear: 1998,
    posModifier: 1.20, peakSalesModifier: 0.75, dealPremium: 0.03,
    source: 'FDA 1998; IBD backbone but heavily biosimilar-eroded',
  },
  il12_23: {
    slug: 'il12_23', displayName: 'IL-12/23 (p40)', category: 'cytokine',
    therapeuticAreas: ['gastroenterology', 'dermatology'],
    validatedTarget: true, firstApprovedDrug: 'Stelara (ustekinumab)', approvalYear: 2009,
    posModifier: 1.15, peakSalesModifier: 1.00, dealPremium: 0.05,
    source: 'FDA 2009; Crohn/UC + psoriasis, biosimilar entry 2025',
  },
  madcam1: {
    slug: 'madcam1', displayName: 'MAdCAM-1', category: 'receptor',
    therapeuticAreas: ['gastroenterology'],
    validatedTarget: false,
    posModifier: 0.65, peakSalesModifier: 0.90, dealPremium: 0.03,
    source: 'No approvals; ontamalimab Phase 2 mixed results in UC. Gut-selective adhesion molecule.',
  },
};

// ---------------------------------------------------------------------------
// Per-TA Option Arrays (for UI dropdowns)
// ---------------------------------------------------------------------------

function targetsForTA(ta: string): { value: string; label: string }[] {
  return Object.values(TARGET_TAXONOMY)
    .filter(t => t.therapeuticAreas.includes(ta))
    .sort((a, b) => {
      if (a.validatedTarget !== b.validatedTarget) return a.validatedTarget ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    })
    .map(t => ({ value: t.slug, label: `${t.displayName}${t.validatedTarget ? '' : ' (novel)'}` }));
}

export const oncologyTargetOptions = targetsForTA('oncology');
export const neurologyTargetOptions = targetsForTA('neurology');
export const immunologyTargetOptions = targetsForTA('immunology');
export const metabolicTargetOptions = targetsForTA('metabolic');
export const cardiovascularTargetOptions = targetsForTA('cardiovascular');
export const infectiousDiseaseTargetOptions = targetsForTA('infectiousDisease');
export const ophthalmologyTargetOptions = targetsForTA('ophthalmology');
export const rareDiseasetargetOptions = targetsForTA('rareDisease');
export const hematologyTargetOptions = targetsForTA('hematology');
export const dermatologyTargetOptions = targetsForTA('dermatology');
export const gastroenterologyTargetOptions = targetsForTA('gastroenterology');

export const targetOptionsByTA: Record<string, { value: string; label: string }[]> = {
  oncology: oncologyTargetOptions,
  neurology: neurologyTargetOptions,
  immunology: immunologyTargetOptions,
  metabolic: metabolicTargetOptions,
  cardiovascular: cardiovascularTargetOptions,
  infectiousDisease: infectiousDiseaseTargetOptions,
  ophthalmology: ophthalmologyTargetOptions,
  rareDisease: rareDiseasetargetOptions,
  hematology: hematologyTargetOptions,
  dermatology: dermatologyTargetOptions,
  gastroenterology: gastroenterologyTargetOptions,
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getTargetEntry(slug: string): TargetEntry | undefined {
  return TARGET_TAXONOMY[slug];
}

export function getTargetPosModifier(slug: string): number {
  return TARGET_TAXONOMY[slug]?.posModifier ?? 1.0;
}

export function getTargetPeakSalesModifier(slug: string): number {
  return TARGET_TAXONOMY[slug]?.peakSalesModifier ?? 1.0;
}

export function getTargetDealPremium(slug: string): number {
  return TARGET_TAXONOMY[slug]?.dealPremium ?? 0;
}

/**
 * Compute composite PoS modifier for multiple targets.
 * Uses geometric mean of individual modifiers to avoid
 * over-penalizing multi-target assets.
 */
export function getCompositeTargetPosModifier(slugs: string[]): number {
  if (!slugs.length) return 1.0;
  const modifiers = slugs.map(s => getTargetPosModifier(s));
  const product = modifiers.reduce((acc, m) => acc * m, 1.0);
  return Math.pow(product, 1 / modifiers.length);
}

/**
 * Set of modality slugs that already encode a specific target.
 * When one of these modalities is selected AND the matching target
 * is also selected, the target posModifier defaults to 1.0 to
 * avoid double-counting.
 */
export const MODALITY_TARGET_OVERLAP: Record<string, string> = {
  tauTargeting: 'tau',
  antiVegf: 'vegf',
  fcrnAntagonist: 'fcrn',
  complementInhibitor: 'c5',
  jakInhibitor: 'jak1',
  s1pModulator: 's1p1',
  il17Inhibitor: 'il17',
  il13Inhibitor: 'il13',
  btki: 'btk',
  pcsk9Targeting: 'pcsk9',
  glp1Agonist: 'glp1r',
  dualIncretin: 'gipr',
  tripleIncretin: 'gcgr',
  sglt2Inhibitor: 'sglt2',
  antiTl1a: 'tl1a',
  il23GI: 'il23',
  gutSelectiveIntegrin: 'integrin_a4b7',
};
