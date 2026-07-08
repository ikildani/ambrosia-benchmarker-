/**
 * Indication-Specific Competitive Density
 *
 * Approved drugs + active Phase 2-3 trials per indication. Used to apply
 * a penetration multiplier to peak sales projections.
 *
 * Sources: ClinicalTrials.gov API (live data), Citeline Pipeline reports 2025,
 * EvaluatePharma 2025, FDA approval database.
 */

import { getTier3CalibratedIndication } from './indication-tier3-calibration';

export interface IndicationCompetitiveDensity {
  indication: string;
  ta: string;
  /** Number of approved drugs in this indication (US/EU) */
  approvedDrugs: number;
  /** Active Phase 2-3 trials (from ClinicalTrials.gov 2025-2026 snapshot) */
  activeTrials: number;
  /** Composite density score (0-1, higher = more crowded) */
  densityScore: number;
  /**
   * Multiplier to apply to peak sales penetration:
   * <0.7 = light competition (boost peak sales)
   * 0.7-1.0 = normal
   * >1.0 = heavy competition (penalty)
   */
  penetrationMultiplier: number;
  /** When this snapshot was captured */
  lastUpdated: string;
  source: string;
  notes?: string;
}

const SNAPSHOT_DATE = '2026-04-10';
const SOURCE = 'ClinicalTrials.gov API + FDA Orange Book + EvaluatePharma 2025 (snapshot 2026-04-10)';

export const COMPETITIVE_DENSITY: Record<string, IndicationCompetitiveDensity> = {
  // ---------------------------------------------------------------------------
  // Oncology (12) — generally crowded
  // ---------------------------------------------------------------------------
  lung_nsclc: {
    indication: 'lung_nsclc',
    ta: 'oncology',
    approvedDrugs: 12,
    activeTrials: 250,
    densityScore: 0.95,
    penetrationMultiplier: 1.35,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Keytruda, Tagrisso, Tecentriq dominate; >250 active trials in IO/TKI/ADC space',
  },
  breast_her2: {
    indication: 'breast_her2',
    ta: 'oncology',
    approvedDrugs: 8,
    activeTrials: 200,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Herceptin, Perjeta, Kadcyla, Enhertu, Tukysa, Phesgo, Margenza, Nerlynx',
  },
  breast_tnbc: {
    indication: 'breast_tnbc',
    ta: 'oncology',
    approvedDrugs: 4,
    activeTrials: 150,
    densityScore: 0.65,
    penetrationMultiplier: 1.20,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Trodelvy, Keytruda combo, Talzenna, Lynparza',
  },
  melanoma: {
    indication: 'melanoma',
    ta: 'oncology',
    approvedDrugs: 6,
    activeTrials: 120,
    densityScore: 0.66,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Checkpoint inhibitors + BRAF/MEK targeted combos',
  },
  colorectal: {
    indication: 'colorectal',
    ta: 'oncology',
    approvedDrugs: 8,
    activeTrials: 150,
    densityScore: 0.85,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
  },
  prostate: {
    indication: 'prostate',
    ta: 'oncology',
    approvedDrugs: 7,
    activeTrials: 120,
    densityScore: 0.71,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Xtandi, Zytiga, Erleada, Nubeqa, Pluvicto, Xofigo, Provenge',
  },
  pancreatic: {
    indication: 'pancreatic',
    ta: 'oncology',
    approvedDrugs: 4,
    activeTrials: 80,
    densityScore: 0.44,
    penetrationMultiplier: 1.05,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'High failure rate; Folfirinox, Gemzar, Erbitux, Onivyde',
  },
  ovarian: {
    indication: 'ovarian',
    ta: 'oncology',
    approvedDrugs: 5,
    activeTrials: 100,
    densityScore: 0.55,
    penetrationMultiplier: 1.20,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Lynparza, Zejula, Rubraca, Avastin, bevacizumab biosimilars',
  },
  head_neck: {
    indication: 'head_neck',
    ta: 'oncology',
    approvedDrugs: 3,
    activeTrials: 80,
    densityScore: 0.39,
    penetrationMultiplier: 1.10,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Keytruda, Erbitux, Opdivo',
  },
  multiple_myeloma: {
    indication: 'multiple_myeloma',
    ta: 'oncology',
    approvedDrugs: 12,
    activeTrials: 180,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Revlimid, Darzalex, Pomalyst, Velcade, Tecvayli, Carvykti, Abecma, etc.',
  },
  dlbcl: {
    indication: 'dlbcl',
    ta: 'oncology',
    approvedDrugs: 6,
    activeTrials: 120,
    densityScore: 0.66,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Rituxan, Polivy, Yescarta, Breyanzi, Kymriah, Lunsumio',
  },
  aml: {
    indication: 'aml',
    ta: 'oncology',
    approvedDrugs: 8,
    activeTrials: 100,
    densityScore: 0.70,
    penetrationMultiplier: 1.20,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Venclexta, Tibsovo, Idhifa, Rydapt, Mylotarg, Vyxeos, Daurismo, Xospata',
  },

  // ---------------------------------------------------------------------------
  // Neurology (8)
  // ---------------------------------------------------------------------------
  alzheimers: {
    indication: 'alzheimers',
    ta: 'neurology',
    approvedDrugs: 4,
    activeTrials: 80,
    densityScore: 0.44,
    penetrationMultiplier: 0.95,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Leqembi, Kisunla, Aduhelm, Aricept legacy. High failure rate keeps multiplier neutral',
  },
  parkinsons: {
    indication: 'parkinsons',
    ta: 'neurology',
    approvedDrugs: 8,
    activeTrials: 60,
    densityScore: 0.58,
    penetrationMultiplier: 1.15,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Sinemet, Stalevo, Mirapex, Requip, Azilect, Nourianz, Gocovri, Onapgo',
  },
  multiple_sclerosis: {
    indication: 'multiple_sclerosis',
    ta: 'neurology',
    approvedDrugs: 18,
    activeTrials: 80,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Tysabri, Ocrevus, Tecfidera, Aubagio, Gilenya, Mavenclad, Kesimpta, Briumvi, etc.',
  },
  als: {
    indication: 'als',
    ta: 'neurology',
    approvedDrugs: 5,
    activeTrials: 30,
    densityScore: 0.34,
    penetrationMultiplier: 0.85,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Riluzole, Radicava, Nuedexta, Qalsody; Relyvrio withdrawn',
  },
  epilepsy: {
    indication: 'epilepsy',
    ta: 'neurology',
    approvedDrugs: 25,
    activeTrials: 60,
    densityScore: 0.95,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: '25+ AEDs approved, most generic',
  },
  depression: {
    indication: 'depression',
    ta: 'neurology',
    approvedDrugs: 30,
    activeTrials: 100,
    densityScore: 0.95,
    penetrationMultiplier: 1.45,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'SSRIs/SNRIs/atypicals + Spravato, Auvelity',
  },
  schizophrenia: {
    indication: 'schizophrenia',
    ta: 'neurology',
    approvedDrugs: 20,
    activeTrials: 60,
    densityScore: 0.95,
    penetrationMultiplier: 1.35,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Atypicals + LAIs + Cobenfy (KarXT) 2024',
  },
  migraine: {
    indication: 'migraine',
    ta: 'neurology',
    approvedDrugs: 8,
    activeTrials: 50,
    densityScore: 0.55,
    penetrationMultiplier: 1.20,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'CGRP class: Aimovig, Emgality, Ajovy, Vyepti, Nurtec, Ubrelvy, Qulipta, Reyvow',
  },

  // ---------------------------------------------------------------------------
  // Immunology (7)
  // ---------------------------------------------------------------------------
  rheumatoid_arthritis: {
    indication: 'rheumatoid_arthritis',
    ta: 'immunology',
    approvedDrugs: 15,
    activeTrials: 100,
    densityScore: 0.95,
    penetrationMultiplier: 1.45,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Humira, Enbrel, Remicade, Actemra, Orencia, Olumiant, Rinvoq, Xeljanz, Cimzia',
  },
  psoriasis: {
    indication: 'psoriasis',
    ta: 'immunology',
    approvedDrugs: 10,
    activeTrials: 80,
    densityScore: 0.74,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Skyrizi, Otezla, Tremfya, Cosentyx, Taltz, Stelara, Sotyktu, Bimzelx',
  },
  atopic_dermatitis: {
    indication: 'atopic_dermatitis',
    ta: 'immunology',
    approvedDrugs: 6,
    activeTrials: 80,
    densityScore: 0.54,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Dupixent dominates; Adbry, Cibinqo, Rinvoq, Eucrisa, Opzelura',
  },
  lupus: {
    indication: 'lupus',
    ta: 'immunology',
    approvedDrugs: 4,
    activeTrials: 40,
    densityScore: 0.32,
    penetrationMultiplier: 1.05,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Benlysta, Saphnelo, Lupkynis, hydroxychloroquine',
  },
  ibd_uc: {
    indication: 'ibd_uc',
    ta: 'immunology',
    approvedDrugs: 8,
    activeTrials: 70,
    densityScore: 0.61,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Stelara, Humira, Remicade, Entyvio, Xeljanz, Zeposia, Skyrizi, Tremfya',
  },
  ibd_cd: {
    indication: 'ibd_cd',
    ta: 'immunology',
    approvedDrugs: 8,
    activeTrials: 70,
    densityScore: 0.61,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Same TNF/IL-23/integrin classes as UC',
  },
  asthma: {
    indication: 'asthma',
    ta: 'immunology',
    approvedDrugs: 8,
    activeTrials: 60,
    densityScore: 0.58,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Dupixent, Tezspire, Nucala, Fasenra, Cinqair, Xolair (severe biologics)',
  },

  // ---------------------------------------------------------------------------
  // Metabolic (5)
  // ---------------------------------------------------------------------------
  type2_diabetes: {
    indication: 'type2_diabetes',
    ta: 'metabolic',
    approvedDrugs: 30,
    activeTrials: 100,
    densityScore: 0.95,
    penetrationMultiplier: 1.35,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'GLP-1 (Ozempic, Mounjaro, Trulicity, Victoza) + SGLT2 + DPP4 + insulin',
  },
  obesity: {
    indication: 'obesity',
    ta: 'metabolic',
    approvedDrugs: 6,
    activeTrials: 80,
    densityScore: 0.54,
    penetrationMultiplier: 1.10,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Wegovy, Zepbound, Saxenda, Contrave, Qsymia, Xenical',
  },
  nash_mash: {
    indication: 'nash_mash',
    ta: 'metabolic',
    approvedDrugs: 1,
    activeTrials: 60,
    densityScore: 0.23,
    penetrationMultiplier: 0.95,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Rezdiffra (resmetirom) approved 2024 — first-in-class',
  },
  dyslipidemia: {
    indication: 'dyslipidemia',
    ta: 'metabolic',
    approvedDrugs: 25,
    activeTrials: 60,
    densityScore: 0.95,
    penetrationMultiplier: 1.35,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Statins generic + PCSK9 (Repatha, Praluent) + Nexletol + Leqvio',
  },
  cardiometabolic: {
    indication: 'cardiometabolic',
    ta: 'metabolic',
    approvedDrugs: 10,
    activeTrials: 50,
    densityScore: 0.65,
    penetrationMultiplier: 1.15,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Mixed indications spanning T2D + CV outcomes',
  },

  // ---------------------------------------------------------------------------
  // Rare Disease (8)
  // ---------------------------------------------------------------------------
  dmd: {
    indication: 'dmd',
    ta: 'rareDisease',
    approvedDrugs: 4,
    activeTrials: 30,
    densityScore: 0.29,
    penetrationMultiplier: 0.85,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Eteplirsen, Vyondys 53, Amondys 45, Elevidys (gene therapy)',
  },
  cystic_fibrosis: {
    indication: 'cystic_fibrosis',
    ta: 'rareDisease',
    approvedDrugs: 5,
    activeTrials: 30,
    densityScore: 0.34,
    penetrationMultiplier: 1.05,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Trikafta dominates; Symdeko, Orkambi, Kalydeco, Pulmozyme',
  },
  sma: {
    indication: 'sma',
    ta: 'rareDisease',
    approvedDrugs: 3,
    activeTrials: 25,
    densityScore: 0.23,
    penetrationMultiplier: 0.85,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Spinraza, Zolgensma, Evrysdi',
  },
  hae: {
    indication: 'hae',
    ta: 'rareDisease',
    approvedDrugs: 6,
    activeTrials: 30,
    densityScore: 0.39,
    penetrationMultiplier: 1.05,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Takhzyro, Cinryze, Berinert, Firazyr, Ruconest, Haegarda',
  },
  spinal_cord_injury: {
    indication: 'spinal_cord_injury',
    ta: 'rareDisease',
    approvedDrugs: 0,
    activeTrials: 20,
    densityScore: 0.06,
    penetrationMultiplier: 0.75,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'No approved disease-modifying therapies — under-served',
  },
  friedreichs_ataxia: {
    indication: 'friedreichs_ataxia',
    ta: 'rareDisease',
    approvedDrugs: 1,
    activeTrials: 15,
    densityScore: 0.10,
    penetrationMultiplier: 0.80,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Skyclarys (omaveloxolone) approved 2023 — first-in-class',
  },
  huntingtons: {
    indication: 'huntingtons',
    ta: 'rareDisease',
    approvedDrugs: 0,
    activeTrials: 25,
    densityScore: 0.08,
    penetrationMultiplier: 0.85,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'No disease-modifying drugs; Xenazine/Austedo for chorea symptoms only',
  },
  wilson_disease: {
    indication: 'wilson_disease',
    ta: 'rareDisease',
    approvedDrugs: 3,
    activeTrials: 10,
    densityScore: 0.18,
    penetrationMultiplier: 0.95,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Trientine, Cuprimine, Syprine',
  },

  // ---------------------------------------------------------------------------
  // Cardiovascular (5)
  // ---------------------------------------------------------------------------
  heart_failure: {
    indication: 'heart_failure',
    ta: 'cardiovascular',
    approvedDrugs: 8,
    activeTrials: 80,
    densityScore: 0.64,
    penetrationMultiplier: 1.25,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Entresto, Farxiga, Jardiance (HF), Corlanor, Verquvo',
  },
  pah: {
    indication: 'pah',
    ta: 'cardiovascular',
    approvedDrugs: 14,
    activeTrials: 40,
    densityScore: 0.82,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Tracleer, Letairis, Opsumit, Adempas, Uptravi, Tyvaso, Ventavis, Winrevair',
  },
  hypercholesterolemia: {
    indication: 'hypercholesterolemia',
    ta: 'cardiovascular',
    approvedDrugs: 25,
    activeTrials: 50,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Statins, PCSK9, ezetimibe, Nexletol, Leqvio',
  },
  atrial_fibrillation: {
    indication: 'atrial_fibrillation',
    ta: 'cardiovascular',
    approvedDrugs: 8,
    activeTrials: 60,
    densityScore: 0.58,
    penetrationMultiplier: 1.30,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'DOACs: Eliquis, Xarelto, Pradaxa, Savaysa + warfarin generic',
  },
  atherosclerosis: {
    indication: 'atherosclerosis',
    ta: 'cardiovascular',
    approvedDrugs: 30,
    activeTrials: 60,
    densityScore: 0.95,
    penetrationMultiplier: 1.35,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Statins + PCSK9 + lifestyle modifiers',
  },

  // ---------------------------------------------------------------------------
  // Infectious Disease (3)
  // ---------------------------------------------------------------------------
  hiv: {
    indication: 'hiv',
    ta: 'infectiousDisease',
    approvedDrugs: 30,
    activeTrials: 60,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Gilead/ViiV franchise — Biktarvy, Triumeq, Cabenuva, etc.',
  },
  hepatitis_b: {
    indication: 'hepatitis_b',
    ta: 'infectiousDisease',
    approvedDrugs: 8,
    activeTrials: 30,
    densityScore: 0.49,
    penetrationMultiplier: 1.10,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'NUC analogs (TDF, TAF, entecavir) + interferons',
  },
  bacterial_infection: {
    indication: 'bacterial_infection',
    ta: 'infectiousDisease',
    approvedDrugs: 50,
    activeTrials: 80,
    densityScore: 0.95,
    penetrationMultiplier: 1.40,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: '50+ antibiotics, mostly generic; resistance market',
  },

  // ---------------------------------------------------------------------------
  // Other (2)
  // ---------------------------------------------------------------------------
  amd: {
    indication: 'amd',
    ta: 'ophthalmology',
    approvedDrugs: 5,
    activeTrials: 50,
    densityScore: 0.40,
    penetrationMultiplier: 1.20,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Eylea, Lucentis, Vabysmo, Beovu, Avastin off-label',
  },
  dry_eye: {
    indication: 'dry_eye',
    ta: 'ophthalmology',
    approvedDrugs: 5,
    activeTrials: 40,
    densityScore: 0.37,
    penetrationMultiplier: 1.10,
    lastUpdated: SNAPSHOT_DATE,
    source: SOURCE,
    notes: 'Restasis, Xiidra, Cequa, Tyrvaya, Eysuvis',
  },

  // ---------------------------------------------------------------------------
  // Women's Health (5)
  // ---------------------------------------------------------------------------
  endometriosis: {
    indication: 'endometriosis', ta: 'womensHealth', approvedDrugs: 4, activeTrials: 45,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Orilissa, Myfembree, Lupron, depo-provera off-label; moderate pipeline',
  },
  uterineFibroids: {
    indication: 'uterineFibroids', ta: 'womensHealth', approvedDrugs: 3, activeTrials: 25,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Myfembree, Oriahnn, Lupron; underserved relative to prevalence',
  },
  pcos: {
    indication: 'pcos', ta: 'womensHealth', approvedDrugs: 0, activeTrials: 20,
    densityScore: 0.10, penetrationMultiplier: 0.60, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'No FDA-approved PCOS drug; metformin/OCP off-label. Wide-open opportunity',
  },
  postpartumDepression: {
    indication: 'postpartumDepression', ta: 'womensHealth', approvedDrugs: 2, activeTrials: 15,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Zulresso (IV), Zurzuvae (oral); early market, high unmet need',
  },
  menopause: {
    indication: 'menopause', ta: 'womensHealth', approvedDrugs: 3, activeTrials: 20,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Veozah (non-hormonal), HRT generics, Bijuva; non-hormonal VMS underserved',
  },

  // ---------------------------------------------------------------------------
  // Gastroenterology (5)
  // ---------------------------------------------------------------------------
  crohnsDisease: {
    indication: 'crohnsDisease', ta: 'gastroenterology', approvedDrugs: 10, activeTrials: 120,
    densityScore: 0.75, penetrationMultiplier: 1.25, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Skyrizi, Stelara, Humira biosimilars, vedolizumab, ustekinumab, risankizumab; crowded',
  },
  eosinophilicEsophagitis: {
    indication: 'eosinophilicEsophagitis', ta: 'gastroenterology', approvedDrugs: 1, activeTrials: 25,
    densityScore: 0.15, penetrationMultiplier: 0.70, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only Dupixent approved for EoE; wide-open for competition',
  },
  nonAlcoholicSteatohepatitis: {
    indication: 'nonAlcoholicSteatohepatitis', ta: 'gastroenterology', approvedDrugs: 1, activeTrials: 100,
    densityScore: 0.65, penetrationMultiplier: 1.15, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Rezdiffra only approved MASH drug; massive pipeline (100+ trials) but high failure rate',
  },
  ibsD: {
    indication: 'ibsD', ta: 'gastroenterology', approvedDrugs: 3, activeTrials: 30,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Eluxadoline, rifaximin, alosetron (restricted); moderate competition',
  },
  primaryBiliaryCholangitis: {
    indication: 'primaryBiliaryCholangitis', ta: 'gastroenterology', approvedDrugs: 3, activeTrials: 15,
    densityScore: 0.22, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'UDCA, Ocaliva, Livdelzi, Iqirvo recent additions; still underserved',
  },

  // ---------------------------------------------------------------------------
  // Dermatology (5)
  // ---------------------------------------------------------------------------
  hidradenitisSuppurativa: {
    indication: 'hidradenitisSuppurativa', ta: 'dermatology', approvedDrugs: 2, activeTrials: 35,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Humira, Cosentyx; high unmet need, growing pipeline',
  },
  alopeciaAreata: {
    indication: 'alopeciaAreata', ta: 'dermatology', approvedDrugs: 2, activeTrials: 20,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Olumiant, Litfulo; early market formation',
  },
  vitiligo: {
    indication: 'vitiligo', ta: 'dermatology', approvedDrugs: 1, activeTrials: 15,
    densityScore: 0.12, penetrationMultiplier: 0.65, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only Opzelura approved; wide-open market',
  },
  acne: {
    indication: 'acne', ta: 'dermatology', approvedDrugs: 15, activeTrials: 30,
    densityScore: 0.85, penetrationMultiplier: 1.30, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Massive generic market (tretinoin, benzoyl peroxide, doxycycline); branded: Winlevi, Aklief, Amzeeq',
  },
  chronicUrticaria: {
    indication: 'chronicUrticaria', ta: 'dermatology', approvedDrugs: 2, activeTrials: 20,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Xolair, antihistamine SOC; remibrutinib filing expected 2025',
  },

  // ---------------------------------------------------------------------------
  // Hematology (5)
  // ---------------------------------------------------------------------------
  cll: {
    indication: 'cll', ta: 'hematology', approvedDrugs: 7, activeTrials: 80,
    densityScore: 0.70, penetrationMultiplier: 1.20, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Ibrutinib, venetoclax, acalabrutinib, zanubrutinib, obinutuzumab; competitive',
  },
  follicularLymphoma: {
    indication: 'follicularLymphoma', ta: 'hematology', approvedDrugs: 6, activeTrials: 60,
    densityScore: 0.55, penetrationMultiplier: 1.15, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Rituxan, Gazyva, bispecifics (mosunetuzumab, glofitamab); moderate density',
  },
  hodgkinLymphoma: {
    indication: 'hodgkinLymphoma', ta: 'hematology', approvedDrugs: 4, activeTrials: 40,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Adcetris, Keytruda, Opdivo; high cure rate limits commercial ceiling',
  },
  myelofibrosis: {
    indication: 'myelofibrosis', ta: 'hematology', approvedDrugs: 4, activeTrials: 35,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Jakafi dominant, fedratinib/pacritinib/momelotinib niche additions',
  },
  itp: {
    indication: 'itp', ta: 'hematology', approvedDrugs: 5, activeTrials: 25,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Nplate, Promacta, Doptelet, Tavalisse; established but modest pipeline',
  },

  // ---------------------------------------------------------------------------
  // Ophthalmology (5)
  // ---------------------------------------------------------------------------
  dryAmdGA: {
    indication: 'dryAmdGA', ta: 'ophthalmology', approvedDrugs: 2, activeTrials: 25,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Syfovre, Izervay; nascent market, high unmet need',
  },
  diabeticRetinopathy: {
    indication: 'diabeticRetinopathy', ta: 'ophthalmology', approvedDrugs: 4, activeTrials: 40,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Eylea, Lucentis, Vabysmo, Beovu; anti-VEGF class established',
  },
  diabeticMacularEdema: {
    indication: 'diabeticMacularEdema', ta: 'ophthalmology', approvedDrugs: 5, activeTrials: 35,
    densityScore: 0.40, penetrationMultiplier: 1.00, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Eylea, Lucentis, Vabysmo, Ozurdex, Iluvien; mature market',
  },
  glaucoma: {
    indication: 'glaucoma', ta: 'ophthalmology', approvedDrugs: 12, activeTrials: 45,
    densityScore: 0.80, penetrationMultiplier: 1.30, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Generic latanoprost dominant; Rhopressa, Vyzulta, Rocklatan; very crowded',
  },
  retinitisPigmentosa: {
    indication: 'retinitisPigmentosa', ta: 'ophthalmology', approvedDrugs: 1, activeTrials: 15,
    densityScore: 0.08, penetrationMultiplier: 0.55, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only Luxturna (RPE65 subtype); massive unmet need across 60+ genotypes',
  },

  // ---------------------------------------------------------------------------
  // Cardiovascular (5)
  // ---------------------------------------------------------------------------
  heartFailureHfpef: {
    indication: 'heartFailureHfpef', ta: 'cardiovascular', approvedDrugs: 2, activeTrials: 40,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Empagliflozin, dapagliflozin (SGLT2); high unmet need for dedicated HFpEF therapies',
  },
  hypertrophicCardiomyopathy: {
    indication: 'hypertrophicCardiomyopathy', ta: 'cardiovascular', approvedDrugs: 1, activeTrials: 15,
    densityScore: 0.10, penetrationMultiplier: 0.60, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only Camzyos (mavacamten); aficamten Phase 3 pending. Wide-open',
  },
  coronaryArteryDisease: {
    indication: 'coronaryArteryDisease', ta: 'cardiovascular', approvedDrugs: 20, activeTrials: 60,
    densityScore: 0.90, penetrationMultiplier: 1.35, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Statins, antiplatelets, ACE-I/ARB all generic; extremely crowded SOC',
  },
  stroke: {
    indication: 'stroke', ta: 'cardiovascular', approvedDrugs: 3, activeTrials: 40,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'tPA/TNKase, mechanical thrombectomy devices; neuroprotection pipeline wide-open',
  },
  venousThromboembolism: {
    indication: 'venousThromboembolism', ta: 'cardiovascular', approvedDrugs: 5, activeTrials: 25,
    densityScore: 0.45, penetrationMultiplier: 1.05, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'DOACs (rivaroxaban, apixaban, edoxaban) dominate; moderate density',
  },

  // ---------------------------------------------------------------------------
  // Infectious Disease (5)
  // ---------------------------------------------------------------------------
  rsv: {
    indication: 'rsv', ta: 'infectiousDisease', approvedDrugs: 3, activeTrials: 20,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Arexvy, Abrysvo, Beyfortus; early market formation post-2023 approvals',
  },
  tuberculosis: {
    indication: 'tuberculosis', ta: 'infectiousDisease', approvedDrugs: 8, activeTrials: 40,
    densityScore: 0.50, penetrationMultiplier: 1.05, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Multi-drug regimens, mostly generic; pretomanid added 2019. MDR-TB pipeline active',
  },
  influenza: {
    indication: 'influenza', ta: 'infectiousDisease', approvedDrugs: 4, activeTrials: 20,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Tamiflu (generic), Xofluza, Relenza; modest pipeline for pan-flu',
  },
  hepatitisC: {
    indication: 'hepatitisC', ta: 'infectiousDisease', approvedDrugs: 8, activeTrials: 10,
    densityScore: 0.85, penetrationMultiplier: 1.35, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'DAA class (Epclusa, Mavyret, Harvoni) achieves >95% SVR12; limited new pipeline',
  },
  covid: {
    indication: 'covid', ta: 'infectiousDisease', approvedDrugs: 3, activeTrials: 50,
    densityScore: 0.40, penetrationMultiplier: 0.95, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Paxlovid, Lagevrio, remdesivir; declining severity reduces commercial incentive',
  },

  // ---------------------------------------------------------------------------
  // Oncology (10 more)
  // ---------------------------------------------------------------------------
  bladder: {
    indication: 'bladder', ta: 'oncology', approvedDrugs: 6, activeTrials: 80,
    densityScore: 0.60, penetrationMultiplier: 1.15, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Padcev+Keytruda, Tecentriq, Bavencio, erdafitinib; rapidly evolving',
  },
  renal: {
    indication: 'renal', ta: 'oncology', approvedDrugs: 10, activeTrials: 100,
    densityScore: 0.80, penetrationMultiplier: 1.30, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'IO+TKI combos dominate (Keytruda+Inlyta, Opdivo+Cabo, Bavencio+Inlyta); crowded',
  },
  liver: {
    indication: 'liver', ta: 'oncology', approvedDrugs: 5, activeTrials: 60,
    densityScore: 0.45, penetrationMultiplier: 1.05, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Tecentriq+Avastin, sorafenib, lenvatinib, cabozantinib, Keytruda',
  },
  gastric: {
    indication: 'gastric', ta: 'oncology', approvedDrugs: 6, activeTrials: 70,
    densityScore: 0.50, penetrationMultiplier: 1.10, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Vyloy (zolbetuximab), Keytruda, Opdivo, trastuzumab, T-DXd (HER2+ subset)',
  },
  gbm: {
    indication: 'gbm', ta: 'oncology', approvedDrugs: 2, activeTrials: 60,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only temozolomide + Avastin (limited benefit); massive unmet need',
  },
  breast_hr: {
    indication: 'breast_hr', ta: 'oncology', approvedDrugs: 8, activeTrials: 120,
    densityScore: 0.85, penetrationMultiplier: 1.35, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'CDK4/6 class (Ibrance, Kisqali, Verzenio), fulvestrant, AIs; very competitive',
  },
  lung_sclc: {
    indication: 'lung_sclc', ta: 'oncology', approvedDrugs: 4, activeTrials: 40,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Etoposide/platinum + IO (Tecentriq, Imfinzi); limited options, high unmet need',
  },
  mds: {
    indication: 'mds', ta: 'oncology', approvedDrugs: 5, activeTrials: 45,
    densityScore: 0.40, penetrationMultiplier: 0.95, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Vidaza, Reblozyl, Rytelo, lenalidomide; moderate density, HMA backbone',
  },
  cervical: {
    indication: 'cervical', ta: 'oncology', approvedDrugs: 4, activeTrials: 35,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Keytruda, Tivdak, bevacizumab; moderate unmet need in advanced',
  },
  endometrial: {
    indication: 'endometrial', ta: 'oncology', approvedDrugs: 3, activeTrials: 40,
    densityScore: 0.28, penetrationMultiplier: 0.82, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Keytruda+Lenvima, dostarlimab; dMMR subset well-served, MSS still needs options',
  },

  // ---------------------------------------------------------------------------
  // Neurology (8 more)
  // ---------------------------------------------------------------------------
  narcolepsy: {
    indication: 'narcolepsy', ta: 'neurology', approvedDrugs: 5, activeTrials: 15,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Xyrem, Xywav, Lumryz, Sunosi, Wakix; moderate density, unmet in NT2',
  },
  bipolar: {
    indication: 'bipolar', ta: 'neurology', approvedDrugs: 12, activeTrials: 35,
    densityScore: 0.75, penetrationMultiplier: 1.25, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Lithium, valproate, lamotrigine, quetiapine, Vraylar; mostly generic SOC',
  },
  adhd: {
    indication: 'adhd', ta: 'neurology', approvedDrugs: 10, activeTrials: 25,
    densityScore: 0.70, penetrationMultiplier: 1.20, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Generic stimulants dominant; Qelbree, Azstarys recent branded additions',
  },
  addiction: {
    indication: 'addiction', ta: 'neurology', approvedDrugs: 5, activeTrials: 30,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Naltrexone, buprenorphine, acamprosate mostly generic; stimulant use disorder unserved',
  },
  myasthenia: {
    indication: 'myasthenia', ta: 'neurology', approvedDrugs: 5, activeTrials: 25,
    densityScore: 0.35, penetrationMultiplier: 0.90, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Vyvgart, Soliris, Ultomiris, Rystiggo, pyridostigmine; growing but addressable',
  },
  pain: {
    indication: 'pain', ta: 'neurology', approvedDrugs: 20, activeTrials: 50,
    densityScore: 0.85, penetrationMultiplier: 1.35, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'NSAIDs, opioids, gabapentinoids, duloxetine all generic; crowded, low-price SOC',
  },
  trd: {
    indication: 'trd', ta: 'neurology', approvedDrugs: 2, activeTrials: 25,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Spravato (esketamine), psilocybin pipeline; high unmet need in TRD specifically',
  },
  frontotemporal: {
    indication: 'frontotemporal', ta: 'neurology', approvedDrugs: 0, activeTrials: 15,
    densityScore: 0.05, penetrationMultiplier: 0.50, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'No approved therapies; extremely wide-open but very difficult indication',
  },

  // ---------------------------------------------------------------------------
  // Immunology (7 more)
  // ---------------------------------------------------------------------------
  lupusNephritis: {
    indication: 'lupusNephritis', ta: 'immunology', approvedDrugs: 2, activeTrials: 30,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Lupkynis, belimumab (LN indication); CNI + MMF backbone',
  },
  psoriaticArthritis: {
    indication: 'psoriaticArthritis', ta: 'immunology', approvedDrugs: 8, activeTrials: 40,
    densityScore: 0.65, penetrationMultiplier: 1.20, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'TNF, IL-17, IL-23, JAK, PDE4 classes all approved; competitive',
  },
  ankylosingSpondylitis: {
    indication: 'ankylosingSpondylitis', ta: 'immunology', approvedDrugs: 6, activeTrials: 25,
    densityScore: 0.50, penetrationMultiplier: 1.10, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'IL-17 (secukinumab, ixekizumab), JAK (tofacitinib, upadacitinib), TNF class',
  },
  ipf: {
    indication: 'ipf', ta: 'immunology', approvedDrugs: 2, activeTrials: 30,
    densityScore: 0.20, penetrationMultiplier: 0.75, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only pirfenidone + nintedanib; high unmet need, active pipeline',
  },
  igan: {
    indication: 'igan', ta: 'immunology', approvedDrugs: 2, activeTrials: 15,
    densityScore: 0.15, penetrationMultiplier: 0.70, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Filspari, Tarpeyo; early market, complement/BAFF pipeline growing',
  },
  gvhd: {
    indication: 'gvhd', ta: 'immunology', approvedDrugs: 3, activeTrials: 20,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Jakafi, Rezurock, Imbruvica; niche but growing',
  },
  copd: {
    indication: 'copd', ta: 'immunology', approvedDrugs: 15, activeTrials: 60,
    densityScore: 0.85, penetrationMultiplier: 1.35, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'LABA/LAMA/ICS combos dominant (Trelegy, Breztri); Dupixent new entrant for eosinophilic',
  },

  // ---------------------------------------------------------------------------
  // Metabolic (6 more)
  // ---------------------------------------------------------------------------
  type1Diabetes: {
    indication: 'type1Diabetes', ta: 'metabolic', approvedDrugs: 2, activeTrials: 25,
    densityScore: 0.15, penetrationMultiplier: 0.70, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Tzield (teplizumab) only disease-modifier; insulin remains SOC. Wide open for beta-cell preservation',
  },
  gout: {
    indication: 'gout', ta: 'metabolic', approvedDrugs: 5, activeTrials: 15,
    densityScore: 0.40, penetrationMultiplier: 0.95, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Allopurinol/febuxostat generic, Krystexxa (uncontrolled), colchicine generic',
  },
  diabeticKidneyDisease: {
    indication: 'diabeticKidneyDisease', ta: 'metabolic', approvedDrugs: 3, activeTrials: 25,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Kerendia, SGLT2i, RAS blockade; moderate pipeline, high prevalence',
  },
  sickleCell: {
    indication: 'sickleCell', ta: 'metabolic', approvedDrugs: 5, activeTrials: 30,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Hydroxyurea (generic), voxelotor (withdrawn), Adakveo, Casgevy, Lyfgenia gene therapies',
  },
  hemophiliaA: {
    indication: 'hemophiliaA', ta: 'metabolic', approvedDrugs: 8, activeTrials: 20,
    densityScore: 0.55, penetrationMultiplier: 1.10, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Hemlibra, factor VIII products, Roctavian gene therapy, Alhemo; moderate density',
  },
  fabry: {
    indication: 'fabry', ta: 'metabolic', approvedDrugs: 3, activeTrials: 10,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Fabrazyme, Replagal, Galafold; small patient pool limits density',
  },

  // ---------------------------------------------------------------------------
  // Rare Disease (5 more)
  // ---------------------------------------------------------------------------
  fabryDisease: {
    indication: 'fabryDisease', ta: 'rareDisease', approvedDrugs: 3, activeTrials: 10,
    densityScore: 0.25, penetrationMultiplier: 0.80, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Same as metabolic fabry; rare disease TA context',
  },
  gaucherDisease: {
    indication: 'gaucherDisease', ta: 'rareDisease', approvedDrugs: 4, activeTrials: 5,
    densityScore: 0.30, penetrationMultiplier: 0.85, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Cerezyme, Cerdelga, VPRIV, eliglustat; well-established ERT class',
  },
  pompeDisease: {
    indication: 'pompeDisease', ta: 'rareDisease', approvedDrugs: 2, activeTrials: 8,
    densityScore: 0.15, penetrationMultiplier: 0.70, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Myozyme/Lumizyme, Nexviazyme; limited competition, gene therapy pipeline',
  },
  achondroplasia: {
    indication: 'achondroplasia', ta: 'rareDisease', approvedDrugs: 1, activeTrials: 5,
    densityScore: 0.08, penetrationMultiplier: 0.55, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Only Voxzogo; very early market, wide open',
  },
  dravetSyndrome: {
    indication: 'dravetSyndrome', ta: 'rareDisease', approvedDrugs: 3, activeTrials: 10,
    densityScore: 0.22, penetrationMultiplier: 0.78, lastUpdated: SNAPSHOT_DATE, source: SOURCE,
    notes: 'Epidiolex, Fintepla, Diacomit; niche but growing gene therapy pipeline',
  },
};

/**
 * Look up competitive density for a specific indication.
 * Tier 1 manual entries take precedence; otherwise falls back to Tier 3
 * automated calibration for any slug in the catalog; otherwise null.
 */
export function getCompetitiveDensity(indication: string): IndicationCompetitiveDensity | null {
  if (!indication) return null;
  const tier1 = COMPETITIVE_DENSITY[indication];
  if (tier1) return tier1;
  const tier3 = getTier3CalibratedIndication(indication);
  return tier3 ? tier3.competitiveDensity : null;
}

/**
 * Apply competitive density multiplier to peak sales penetration.
 *
 * Heavy competition divides peak sales (penalty); light competition with
 * multiplier <1 effectively boosts peak sales (under-served indications).
 */
export function applyCompetitiveDensityToPeakSales(
  basePeakSales: number,
  indication: string,
): number {
  const density = getCompetitiveDensity(indication);
  if (!density) return basePeakSales;
  return basePeakSales / density.penetrationMultiplier;
}
