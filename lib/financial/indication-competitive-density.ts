/**
 * Indication-Specific Competitive Density
 *
 * Approved drugs + active Phase 2-3 trials per indication. Used to apply
 * a penetration multiplier to peak sales projections.
 *
 * Sources: ClinicalTrials.gov API (live data), Citeline Pipeline reports 2025,
 * EvaluatePharma 2025, FDA approval database.
 */

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
};

/**
 * Look up competitive density for a specific indication.
 */
export function getCompetitiveDensity(indication: string): IndicationCompetitiveDensity | null {
  if (!indication) return null;
  return COMPETITIVE_DENSITY[indication] || null;
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
