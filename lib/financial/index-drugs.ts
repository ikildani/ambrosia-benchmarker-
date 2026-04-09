/**
 * Index Drug Database — Actual Peak Sales for Marketed Drugs
 *
 * Used for:
 * 1. Peak sales sanity check (flag when model exceeds market leader)
 * 2. Index drug sensitivity panel (rNPV at 10-100% of index drug)
 * 3. Epidemiology data sufficiency indicator (model vs actual market)
 *
 * Data sourced from:
 * - EvaluatePharma World Preview 2024-2025
 * - IQVIA Channel Dynamics 2024
 * - Company 10-K/annual reports (actual revenue)
 * - FDA labels for indication scope
 *
 * Peak sales = highest annual global revenue achieved or consensus forecast.
 * All values in $M USD.
 *
 * @module lib/financial/index-drugs
 */

export interface IndexDrug {
  name: string;
  company: string;
  modality: string;
  peakSalesM: number;        // Actual or consensus peak annual revenue ($M)
  peakSalesYear: number;     // Year of peak (actual) or projected
  currentSalesM: number;     // Most recent annual revenue ($M)
  indication: string;        // Primary indication
  therapeuticArea: string;
  genericCompetition: boolean; // Are there generics/biosimilars competing?
  genericPriceDiscount: number; // 0-1, e.g., 0.90 = generics are 90% cheaper
  marketSizeM: number;       // Total addressable market for this indication ($M)
}

// ---------------------------------------------------------------------------
// Oncology
// ---------------------------------------------------------------------------

const ONCOLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Keytruda (pembrolizumab)',
    company: 'Merck',
    modality: 'mab',
    peakSalesM: 32000,
    peakSalesYear: 2025,
    currentSalesM: 32000,
    indication: 'lung_nsclc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 45000,
  },
  {
    name: 'Opdivo (nivolumab)',
    company: 'BMS',
    modality: 'mab',
    peakSalesM: 9500,
    peakSalesYear: 2023,
    currentSalesM: 8700,
    indication: 'lung_nsclc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 45000,
  },
  {
    name: 'Enhertu (trastuzumab deruxtecan)',
    company: 'Daiichi Sankyo / AstraZeneca',
    modality: 'adc',
    peakSalesM: 12000,
    peakSalesYear: 2028,
    currentSalesM: 4500,
    indication: 'breast_her2',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Padcev (enfortumab vedotin)',
    company: 'Pfizer / Astellas',
    modality: 'adc',
    peakSalesM: 8000,
    peakSalesYear: 2028,
    currentSalesM: 2800,
    indication: 'bladder',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Imbruvica (ibrutinib)',
    company: 'AbbVie / J&J',
    modality: 'smallMolecule',
    peakSalesM: 9800,
    peakSalesYear: 2022,
    currentSalesM: 5200,
    indication: 'cll',
    therapeuticArea: 'oncology',
    genericCompetition: true,
    genericPriceDiscount: 0.70,
    marketSizeM: 12000,
  },
  {
    name: 'Tagrisso (osimertinib)',
    company: 'AstraZeneca',
    modality: 'smallMolecule',
    peakSalesM: 6500,
    peakSalesYear: 2025,
    currentSalesM: 5800,
    indication: 'lung_nsclc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Darzalex (daratumumab)',
    company: 'J&J',
    modality: 'mab',
    peakSalesM: 10500,
    peakSalesYear: 2026,
    currentSalesM: 9800,
    indication: 'multiple_myeloma',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 25000,
  },
  {
    name: 'Revlimid (lenalidomide)',
    company: 'BMS',
    modality: 'smallMolecule',
    peakSalesM: 12800,
    peakSalesYear: 2021,
    currentSalesM: 3200,
    indication: 'multiple_myeloma',
    therapeuticArea: 'oncology',
    genericCompetition: true,
    genericPriceDiscount: 0.85,
    marketSizeM: 25000,
  },
  {
    name: 'Lynparza (olaparib)',
    company: 'AstraZeneca',
    modality: 'smallMolecule',
    peakSalesM: 3700,
    peakSalesYear: 2024,
    currentSalesM: 3670,
    indication: 'ovarian',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Ibrance (palbociclib)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 5400,
    peakSalesYear: 2022,
    currentSalesM: 4370,
    indication: 'breast_hr',
    therapeuticArea: 'oncology',
    genericCompetition: true,
    genericPriceDiscount: 0.65,
    marketSizeM: 14000,
  },
  {
    name: 'Xtandi (enzalutamide)',
    company: 'Astellas / Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 6200,
    peakSalesYear: 2025,
    currentSalesM: 6100,
    indication: 'prostate',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 16000,
  },
  {
    name: 'Trodelvy (sacituzumab govitecan)',
    company: 'Gilead',
    modality: 'adc',
    peakSalesM: 3000,
    peakSalesYear: 2028,
    currentSalesM: 1320,
    indication: 'breast_tnbc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Tecentriq (atezolizumab)',
    company: 'Roche',
    modality: 'mab',
    peakSalesM: 3800,
    peakSalesYear: 2023,
    currentSalesM: 3400,
    indication: 'lung_nsclc',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 45000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Pemazyre (pemigatinib)',
    company: 'Incyte',
    modality: 'smallMolecule',
    peakSalesM: 110,
    peakSalesYear: 2023,
    currentSalesM: 80,
    indication: 'cholangiocarcinoma',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 800,
  },
  {
    name: 'Tazverik (tazemetostat)',
    company: 'Ipsen',
    modality: 'smallMolecule',
    peakSalesM: 55,
    peakSalesYear: 2024,
    currentSalesM: 45,
    indication: 'epithelioid_sarcoma',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 400,
  },
  {
    name: 'Tabrecta (capmatinib)',
    company: 'Novartis',
    modality: 'smallMolecule',
    peakSalesM: 160,
    peakSalesYear: 2025,
    currentSalesM: 140,
    indication: 'lung_nsclc_met',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1200,
  },
  {
    name: 'Retevmo (selpercatinib)',
    company: 'Eli Lilly',
    modality: 'smallMolecule',
    peakSalesM: 420,
    peakSalesYear: 2026,
    currentSalesM: 380,
    indication: 'ret_fusion_cancers',
    therapeuticArea: 'oncology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
];

// ---------------------------------------------------------------------------
// Neurology
// ---------------------------------------------------------------------------

const NEUROLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Leqembi (lecanemab)',
    company: 'Eisai / Biogen',
    modality: 'mab',
    peakSalesM: 7000,
    peakSalesYear: 2030,
    currentSalesM: 800,
    indication: 'alzheimers',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Kisunla (donanemab)',
    company: 'Eli Lilly',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2030,
    currentSalesM: 400,
    indication: 'alzheimers',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Tecfidera (dimethyl fumarate)',
    company: 'Biogen',
    modality: 'smallMolecule',
    peakSalesM: 4400,
    peakSalesYear: 2019,
    currentSalesM: 800,
    indication: 'multiple_sclerosis',
    therapeuticArea: 'neurology',
    genericCompetition: true,
    genericPriceDiscount: 0.80,
    marketSizeM: 28000,
  },
  {
    name: 'Spinraza (nusinersen)',
    company: 'Biogen',
    modality: 'aso',
    peakSalesM: 2100,
    peakSalesYear: 2019,
    currentSalesM: 1200,
    indication: 'sma',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Nurtec (rimegepant)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 2500,
    peakSalesYear: 2027,
    currentSalesM: 1100,
    indication: 'migraine',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Ocrevus (ocrelizumab)',
    company: 'Roche',
    modality: 'mab',
    peakSalesM: 7600,
    peakSalesYear: 2024,
    currentSalesM: 7600,
    indication: 'multiple_sclerosis',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 28000,
  },
  {
    name: 'Kesimpta (ofatumumab)',
    company: 'Novartis',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2028,
    currentSalesM: 3200,
    indication: 'multiple_sclerosis',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 28000,
  },
  {
    name: 'Vyvanse (lisdexamfetamine)',
    company: 'Takeda',
    modality: 'smallMolecule',
    peakSalesM: 4200,
    peakSalesYear: 2022,
    currentSalesM: 1800,
    indication: 'adhd',
    therapeuticArea: 'neurology',
    genericCompetition: true,
    genericPriceDiscount: 0.80,
    marketSizeM: 18000,
  },
  {
    name: 'Aimovig (erenumab)',
    company: 'Amgen / Novartis',
    modality: 'mab',
    peakSalesM: 600,
    peakSalesYear: 2023,
    currentSalesM: 500,
    indication: 'migraine',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Epidiolex (cannabidiol)',
    company: 'Jazz / GW Pharma',
    modality: 'smallMolecule',
    peakSalesM: 900,
    peakSalesYear: 2025,
    currentSalesM: 850,
    indication: 'epilepsy',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 11000,
  },
  {
    name: 'Ingrezza (valbenazine)',
    company: 'Neurocrine',
    modality: 'smallMolecule',
    peakSalesM: 2200,
    peakSalesYear: 2026,
    currentSalesM: 2000,
    indication: 'tardive_dyskinesia',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Austedo (deutetrabenazine)',
    company: 'Teva',
    modality: 'smallMolecule',
    peakSalesM: 1400,
    peakSalesYear: 2026,
    currentSalesM: 1200,
    indication: 'tardive_dyskinesia',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Fintepla (fenfluramine)',
    company: 'UCB / Zogenix',
    modality: 'smallMolecule',
    peakSalesM: 400,
    peakSalesYear: 2025,
    currentSalesM: 350,
    indication: 'dravet_syndrome',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 800,
  },
  {
    name: 'Xcopri (cenobamate)',
    company: 'SK Biopharmaceuticals',
    modality: 'smallMolecule',
    peakSalesM: 350,
    peakSalesYear: 2026,
    currentSalesM: 300,
    indication: 'focal_epilepsy',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Radicava (edaravone)',
    company: 'Mitsubishi Tanabe',
    modality: 'smallMolecule',
    peakSalesM: 350,
    peakSalesYear: 2022,
    currentSalesM: 200,
    indication: 'als',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1500,
  },
  {
    name: 'Qalsody (tofersen)',
    company: 'Biogen',
    modality: 'aso',
    peakSalesM: 250,
    peakSalesYear: 2028,
    currentSalesM: 100,
    indication: 'als_sod1',
    therapeuticArea: 'neurology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 500,
  },
];

// ---------------------------------------------------------------------------
// Immunology
// ---------------------------------------------------------------------------

const IMMUNOLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Humira (adalimumab)',
    company: 'AbbVie',
    modality: 'mab',
    peakSalesM: 21200,
    peakSalesYear: 2022,
    currentSalesM: 8200,
    indication: 'rheumatoid_arthritis',
    therapeuticArea: 'immunology',
    genericCompetition: true,
    genericPriceDiscount: 0.60,
    marketSizeM: 35000,
  },
  {
    name: 'Dupixent (dupilumab)',
    company: 'Sanofi / Regeneron',
    modality: 'mab',
    peakSalesM: 22000,
    peakSalesYear: 2028,
    currentSalesM: 17800,  // 2025: $17.8B (+26% YoY)
    indication: 'atopic_dermatitis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 22000,
  },
  {
    name: 'Skyrizi (risankizumab)',
    company: 'AbbVie',
    modality: 'mab',
    peakSalesM: 12000,
    peakSalesYear: 2028,
    currentSalesM: 8500,
    indication: 'psoriasis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  {
    name: 'Stelara (ustekinumab)',
    company: 'J&J',
    modality: 'mab',
    peakSalesM: 10900,
    peakSalesYear: 2023,
    currentSalesM: 7800,
    indication: 'psoriasis',
    therapeuticArea: 'immunology',
    genericCompetition: true,
    genericPriceDiscount: 0.45,
    marketSizeM: 20000,
  },
  {
    name: 'Tremfya (guselkumab)',
    company: 'J&J',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2027,
    currentSalesM: 3670,
    indication: 'psoriatic_arthritis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Benlysta (belimumab)',
    company: 'GSK',
    modality: 'mab',
    peakSalesM: 2500,
    peakSalesYear: 2025,
    currentSalesM: 2300,
    indication: 'lupus',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  {
    name: 'Saphnelo (anifrolumab)',
    company: 'AstraZeneca',
    modality: 'mab',
    peakSalesM: 2000,
    peakSalesYear: 2028,
    currentSalesM: 700,
    indication: 'lupus',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  {
    name: 'Xeljanz (tofacitinib)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 2500,
    peakSalesYear: 2021,
    currentSalesM: 1200,
    indication: 'rheumatoid_arthritis',
    therapeuticArea: 'immunology',
    genericCompetition: true,
    genericPriceDiscount: 0.50,
    marketSizeM: 35000,
  },
  {
    name: 'Kevzara (sarilumab)',
    company: 'Sanofi / Regeneron',
    modality: 'mab',
    peakSalesM: 600,
    peakSalesYear: 2024,
    currentSalesM: 550,
    indication: 'rheumatoid_arthritis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 35000,
  },
  {
    name: 'Taltz (ixekizumab)',
    company: 'Eli Lilly',
    modality: 'mab',
    peakSalesM: 2800,
    peakSalesYear: 2024,
    currentSalesM: 2700,
    indication: 'psoriasis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Lupkynis (voclosporin)',
    company: 'Aurinia',
    modality: 'smallMolecule',
    peakSalesM: 300,
    peakSalesYear: 2025,
    currentSalesM: 250,
    indication: 'lupus_nephritis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
  {
    name: 'Tavneos (avacopan)',
    company: 'Amgen / ChemoCentryx',
    modality: 'smallMolecule',
    peakSalesM: 220,
    peakSalesYear: 2026,
    currentSalesM: 180,
    indication: 'anca_vasculitis',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1500,
  },
  {
    name: 'Kineret (anakinra)',
    company: 'Sobi',
    modality: 'mab',
    peakSalesM: 350,
    peakSalesYear: 2023,
    currentSalesM: 300,
    indication: 'still_disease',
    therapeuticArea: 'immunology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1000,
  },
];

// ---------------------------------------------------------------------------
// Metabolic
// ---------------------------------------------------------------------------

const METABOLIC_INDEX: IndexDrug[] = [
  {
    name: 'Ozempic/Wegovy (semaglutide)',
    company: 'Novo Nordisk',
    modality: 'glp1Agonist',
    peakSalesM: 45000,
    peakSalesYear: 2028,
    currentSalesM: 36190,  // 2025 full franchise (Ozempic $20.1B + Wegovy + Rybelsus)
    indication: 'obesity',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 100000,
  },
  {
    name: 'Mounjaro/Zepbound (tirzepatide)',
    company: 'Eli Lilly',
    modality: 'glp1Agonist',
    peakSalesM: 50000,
    peakSalesYear: 2029,
    currentSalesM: 36510,  // 2025 combined Mounjaro + Zepbound
    indication: 'obesity',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 100000,
  },
  {
    name: 'Jardiance (empagliflozin)',
    company: 'Boehringer Ingelheim / Lilly',
    modality: 'smallMolecule',
    peakSalesM: 7500,
    peakSalesYear: 2025,
    currentSalesM: 7200,
    indication: 'type2_diabetes',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 55000,
  },
  {
    name: 'Rezdiffra (resmetirom)',
    company: 'Madrigal',
    modality: 'smallMolecule',
    peakSalesM: 4000,
    peakSalesYear: 2030,
    currentSalesM: 200,
    indication: 'nash_mash',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Farxiga (dapagliflozin)',
    company: 'AstraZeneca',
    modality: 'smallMolecule',
    peakSalesM: 7700,
    peakSalesYear: 2024,
    currentSalesM: 7700,
    indication: 'type2_diabetes',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 55000,
  },
  {
    name: 'Trulicity (dulaglutide)',
    company: 'Eli Lilly',
    modality: 'glp1Agonist',
    peakSalesM: 7400,
    peakSalesYear: 2022,
    currentSalesM: 3200,
    indication: 'type2_diabetes',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 55000,
  },
  {
    name: 'Invokana (canagliflozin)',
    company: 'J&J',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2017,
    currentSalesM: 400,
    indication: 'type2_diabetes',
    therapeuticArea: 'metabolic',
    genericCompetition: true,
    genericPriceDiscount: 0.70,
    marketSizeM: 55000,
  },
  {
    name: 'Uloric (febuxostat)',
    company: 'Takeda',
    modality: 'smallMolecule',
    peakSalesM: 900,
    peakSalesYear: 2018,
    currentSalesM: 200,
    indication: 'gout',
    therapeuticArea: 'metabolic',
    genericCompetition: true,
    genericPriceDiscount: 0.85,
    marketSizeM: 5000,
  },
  {
    name: 'Krystexxa (pegloticase)',
    company: 'Horizon / Amgen',
    modality: 'mab',
    peakSalesM: 900,
    peakSalesYear: 2025,
    currentSalesM: 800,
    indication: 'gout',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Zynquista (sotagliflozin)',
    company: 'Lexicon',
    modality: 'smallMolecule',
    peakSalesM: 500,
    peakSalesYear: 2028,
    currentSalesM: 100,
    indication: 'type1_diabetes',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Oxlumo (lumasiran)',
    company: 'Alnylam',
    modality: 'sirna',
    peakSalesM: 180,
    peakSalesYear: 2027,
    currentSalesM: 120,
    indication: 'primary_hyperoxaluria',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 600,
  },
  {
    name: 'Imcivree (setmelanotide)',
    company: 'Rhythm Pharma',
    modality: 'peptide',
    peakSalesM: 220,
    peakSalesYear: 2027,
    currentSalesM: 150,
    indication: 'genetic_obesity',
    therapeuticArea: 'metabolic',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 800,
  },
  {
    name: 'Galzin (zinc acetate)',
    company: 'Teva',
    modality: 'smallMolecule',
    peakSalesM: 50,
    peakSalesYear: 2020,
    currentSalesM: 30,
    indication: 'wilson_disease',
    therapeuticArea: 'metabolic',
    genericCompetition: true,
    genericPriceDiscount: 0.70,
    marketSizeM: 300,
  },
];

// ---------------------------------------------------------------------------
// Rare Disease
// ---------------------------------------------------------------------------

const RARE_DISEASE_INDEX: IndexDrug[] = [
  {
    name: 'Zolgensma (onasemnogene)',
    company: 'Novartis',
    modality: 'geneTherapy',
    peakSalesM: 1400,
    peakSalesYear: 2023,
    currentSalesM: 1200,
    indication: 'sma',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Soliris/Ultomiris (eculizumab/ravulizumab)',
    company: 'AstraZeneca',
    modality: 'mab',
    peakSalesM: 7500,
    peakSalesYear: 2025,
    currentSalesM: 7200,
    indication: 'pnh',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 10000,
  },
  {
    name: 'Vyvgart (efgartigimod)',
    company: 'argenx',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2028,
    currentSalesM: 2200,
    indication: 'myasthenia_gravis',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  {
    name: 'Trikafta (elexacaftor/tezacaftor/ivacaftor)',
    company: 'Vertex',
    modality: 'smallMolecule',
    peakSalesM: 9000,
    peakSalesYear: 2026,
    currentSalesM: 8800,
    indication: 'cystic_fibrosis',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Elevidys (delandistrogene)',
    company: 'Sarepta',
    modality: 'geneTherapy',
    peakSalesM: 2500,
    peakSalesYear: 2028,
    currentSalesM: 600,
    indication: 'dmd',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Fabrazyme (agalsidase beta)',
    company: 'Sanofi',
    modality: 'mab',
    peakSalesM: 1200,
    peakSalesYear: 2025,
    currentSalesM: 1100,
    indication: 'fabry',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Nexviazyme (avalglucosidase alfa)',
    company: 'Sanofi',
    modality: 'mab',
    peakSalesM: 1500,
    peakSalesYear: 2028,
    currentSalesM: 700,
    indication: 'pompe',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2500,
  },
  {
    name: 'Evrysdi (risdiplam)',
    company: 'Roche',
    modality: 'smallMolecule',
    peakSalesM: 2200,
    peakSalesYear: 2027,
    currentSalesM: 1800,
    indication: 'sma',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Galafold (migalastat)',
    company: 'Amicus',
    modality: 'smallMolecule',
    peakSalesM: 500,
    peakSalesYear: 2026,
    currentSalesM: 420,
    indication: 'fabry',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Palynziq (pegvaliase)',
    company: 'BioMarin',
    modality: 'enzyme',
    peakSalesM: 280,
    peakSalesYear: 2024,
    currentSalesM: 250,
    indication: 'pku',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 800,
  },
  {
    name: 'Skysona (elivaldogene)',
    company: 'bluebird bio',
    modality: 'geneTherapy',
    peakSalesM: 100,
    peakSalesYear: 2026,
    currentSalesM: 40,
    indication: 'cerebral_adrenoleukodystrophy',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 400,
  },
  {
    name: 'Uplizna (inebilizumab)',
    company: 'Amgen / Horizon',
    modality: 'mab',
    peakSalesM: 320,
    peakSalesYear: 2026,
    currentSalesM: 260,
    indication: 'nmosd',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1000,
  },
  {
    name: 'Dojolvi (triheptanoin)',
    company: 'Ultragenyx',
    modality: 'smallMolecule',
    peakSalesM: 60,
    peakSalesYear: 2025,
    currentSalesM: 40,
    indication: 'lc_faod',
    therapeuticArea: 'rareDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 300,
  },
];

// ---------------------------------------------------------------------------
// Cardiovascular
// ---------------------------------------------------------------------------

const CARDIOVASCULAR_INDEX: IndexDrug[] = [
  {
    name: 'Eliquis (apixaban)',
    company: 'BMS / Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 18500,
    peakSalesYear: 2025,
    currentSalesM: 18200,
    indication: 'atrial_fibrillation',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 28000,
  },
  {
    name: 'Entresto (sacubitril/valsartan)',
    company: 'Novartis',
    modality: 'smallMolecule',
    peakSalesM: 6500,
    peakSalesYear: 2025,
    currentSalesM: 6200,
    indication: 'heart_failure',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Repatha (evolocumab)',
    company: 'Amgen',
    modality: 'mab',
    peakSalesM: 2200,
    peakSalesYear: 2026,
    currentSalesM: 1900,
    indication: 'hypercholesterolemia',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Xarelto (rivaroxaban)',
    company: 'Bayer / J&J',
    modality: 'smallMolecule',
    peakSalesM: 6400,
    peakSalesYear: 2022,
    currentSalesM: 4800,
    indication: 'atrial_fibrillation',
    therapeuticArea: 'cardiovascular',
    genericCompetition: true,
    genericPriceDiscount: 0.70,
    marketSizeM: 28000,
  },
  {
    name: 'Pradaxa (dabigatran)',
    company: 'Boehringer Ingelheim',
    modality: 'smallMolecule',
    peakSalesM: 1800,
    peakSalesYear: 2018,
    currentSalesM: 900,
    indication: 'atrial_fibrillation',
    therapeuticArea: 'cardiovascular',
    genericCompetition: true,
    genericPriceDiscount: 0.75,
    marketSizeM: 28000,
  },
  {
    name: 'Uptravi (selexipag)',
    company: 'J&J',
    modality: 'smallMolecule',
    peakSalesM: 2000,
    peakSalesYear: 2025,
    currentSalesM: 1900,
    indication: 'pah',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Opsumit (macitentan)',
    company: 'J&J',
    modality: 'smallMolecule',
    peakSalesM: 2200,
    peakSalesYear: 2024,
    currentSalesM: 2100,
    indication: 'pah',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Verquvo (vericiguat)',
    company: 'Merck / Bayer',
    modality: 'smallMolecule',
    peakSalesM: 1200,
    peakSalesYear: 2028,
    currentSalesM: 400,
    indication: 'heart_failure',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Leqvio (inclisiran)',
    company: 'Novartis',
    modality: 'sirna',
    peakSalesM: 3000,
    peakSalesYear: 2029,
    currentSalesM: 600,
    indication: 'hypercholesterolemia',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Vascepa (icosapent ethyl)',
    company: 'Amarin',
    modality: 'smallMolecule',
    peakSalesM: 700,
    peakSalesYear: 2022,
    currentSalesM: 400,
    indication: 'hypertriglyceridemia',
    therapeuticArea: 'cardiovascular',
    genericCompetition: true,
    genericPriceDiscount: 0.80,
    marketSizeM: 5000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Camzyos (mavacamten)',
    company: 'BMS',
    modality: 'smallMolecule',
    peakSalesM: 450,
    peakSalesYear: 2027,
    currentSalesM: 350,
    indication: 'hypertrophic_cardiomyopathy',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Winrevair (sotatercept)',
    company: 'Merck',
    modality: 'mab',
    peakSalesM: 480,
    peakSalesYear: 2028,
    currentSalesM: 200,
    indication: 'pah',
    therapeuticArea: 'cardiovascular',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Corlanor (ivabradine)',
    company: 'Amgen',
    modality: 'smallMolecule',
    peakSalesM: 180,
    peakSalesYear: 2020,
    currentSalesM: 120,
    indication: 'heart_failure',
    therapeuticArea: 'cardiovascular',
    genericCompetition: true,
    genericPriceDiscount: 0.75,
    marketSizeM: 15000,
  },
];

// ---------------------------------------------------------------------------
// Hematology
// ---------------------------------------------------------------------------

const HEMATOLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Yescarta (axicabtagene ciloleucel)',
    company: 'Kite / Gilead',
    modality: 'carT_heme',
    peakSalesM: 1800,
    peakSalesYear: 2026,
    currentSalesM: 1500,
    indication: 'dlbcl',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Carvykti (ciltacabtagene autoleucel)',
    company: 'Legend / J&J',
    modality: 'carT_heme',
    peakSalesM: 5000,
    peakSalesYear: 2029,
    currentSalesM: 1200,
    indication: 'multiple_myeloma',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 25000,
  },
  {
    name: 'Casgevy (exagamglogene autotemcel)',
    company: 'Vertex / CRISPR',
    modality: 'geneEditing',
    peakSalesM: 3000,
    peakSalesYear: 2030,
    currentSalesM: 100,
    indication: 'sickle_cell',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Hemlibra (emicizumab)',
    company: 'Roche',
    modality: 'bispecific',
    peakSalesM: 5000,
    peakSalesYear: 2026,
    currentSalesM: 4500,
    indication: 'hemophilia_a',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Brukinsa (zanubrutinib)',
    company: 'BeiGene',
    modality: 'smallMolecule',
    peakSalesM: 5000,
    peakSalesYear: 2028,
    currentSalesM: 2600,
    indication: 'cll',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Calquence (acalabrutinib)',
    company: 'AstraZeneca',
    modality: 'smallMolecule',
    peakSalesM: 3500,
    peakSalesYear: 2026,
    currentSalesM: 3200,
    indication: 'cll',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Polivy (polatuzumab vedotin)',
    company: 'Roche',
    modality: 'adc',
    peakSalesM: 1800,
    peakSalesYear: 2027,
    currentSalesM: 1100,
    indication: 'dlbcl',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Adcetris (brentuximab vedotin)',
    company: 'Seagen / Pfizer',
    modality: 'adc',
    peakSalesM: 1400,
    peakSalesYear: 2023,
    currentSalesM: 1200,
    indication: 'hodgkin_lymphoma',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Eloctate (efmoroctocog alfa)',
    company: 'Sanofi',
    modality: 'mab',
    peakSalesM: 1200,
    peakSalesYear: 2020,
    currentSalesM: 500,
    indication: 'hemophilia_a',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Revlimid (lenalidomide — MDS)',
    company: 'BMS',
    modality: 'smallMolecule',
    peakSalesM: 2000,
    peakSalesYear: 2021,
    currentSalesM: 600,
    indication: 'mds',
    therapeuticArea: 'hematology',
    genericCompetition: true,
    genericPriceDiscount: 0.85,
    marketSizeM: 6000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Monjuvi (tafasitamab)',
    company: 'Incyte / MorphoSys',
    modality: 'mab',
    peakSalesM: 160,
    peakSalesYear: 2023,
    currentSalesM: 80,
    indication: 'dlbcl',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Vonjo (pacritinib)',
    company: 'CTI BioPharma',
    modality: 'smallMolecule',
    peakSalesM: 110,
    peakSalesYear: 2025,
    currentSalesM: 80,
    indication: 'myelofibrosis',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Adstiladrin (nadofaragene firadenovec)',
    company: 'Ferring',
    modality: 'geneTherapy',
    peakSalesM: 200,
    peakSalesYear: 2027,
    currentSalesM: 60,
    indication: 'bcg_unresponsive_bladder',
    therapeuticArea: 'hematology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1000,
  },
];

// ---------------------------------------------------------------------------
// Infectious Disease
// ---------------------------------------------------------------------------

const INFECTIOUS_DISEASE_INDEX: IndexDrug[] = [
  {
    name: 'Biktarvy (bictegravir/emtricitabine/TAF)',
    company: 'Gilead',
    modality: 'smallMolecule',
    peakSalesM: 12500,
    peakSalesYear: 2025,
    currentSalesM: 12000,
    indication: 'hiv',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 35000,
  },
  {
    name: 'Paxlovid (nirmatrelvir/ritonavir)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 18900,
    peakSalesYear: 2022,
    currentSalesM: 1200,
    indication: 'covid',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: true,
    genericPriceDiscount: 0.90,
    marketSizeM: 5000,
  },
  {
    name: 'Gardasil 9 (HPV vaccine)',
    company: 'Merck',
    modality: 'vaccine',
    peakSalesM: 8900,
    peakSalesYear: 2023,
    currentSalesM: 8580,
    indication: 'hpv',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 12000,
  },
  {
    name: 'Shingrix (herpes zoster vaccine)',
    company: 'GSK',
    modality: 'vaccine',
    peakSalesM: 4300,
    peakSalesYear: 2023,
    currentSalesM: 3800,
    indication: 'herpes_zoster',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 7000,
  },
  {
    name: 'Prevnar 20 (pneumococcal vaccine)',
    company: 'Pfizer',
    modality: 'vaccine',
    peakSalesM: 6400,
    peakSalesYear: 2024,
    currentSalesM: 6400,
    indication: 'pneumococcal',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 10000,
  },
  {
    name: 'Descovy (emtricitabine/TAF)',
    company: 'Gilead',
    modality: 'smallMolecule',
    peakSalesM: 2200,
    peakSalesYear: 2025,
    currentSalesM: 2100,
    indication: 'hiv',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 35000,
  },
  {
    name: 'Veklury (remdesivir)',
    company: 'Gilead',
    modality: 'smallMolecule',
    peakSalesM: 5600,
    peakSalesYear: 2021,
    currentSalesM: 1800,
    indication: 'covid',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: true,
    genericPriceDiscount: 0.70,
    marketSizeM: 5000,
  },
  {
    name: 'Prevymis (letermovir)',
    company: 'Merck',
    modality: 'smallMolecule',
    peakSalesM: 1000,
    peakSalesYear: 2025,
    currentSalesM: 785,
    indication: 'cmv',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Cresemba (isavuconazonium)',
    company: 'Astellas',
    modality: 'smallMolecule',
    peakSalesM: 800,
    peakSalesYear: 2025,
    currentSalesM: 700,
    indication: 'invasive_fungal',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Dificid (fidaxomicin)',
    company: 'Merck',
    modality: 'smallMolecule',
    peakSalesM: 600,
    peakSalesYear: 2024,
    currentSalesM: 550,
    indication: 'c_diff',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
  {
    name: 'Arexvy (RSV vaccine)',
    company: 'GSK',
    modality: 'vaccine',
    peakSalesM: 2500,
    peakSalesYear: 2027,
    currentSalesM: 1200,
    indication: 'rsv',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Fetroja (cefiderocol)',
    company: 'Shionogi',
    modality: 'smallMolecule',
    peakSalesM: 170,
    peakSalesYear: 2026,
    currentSalesM: 130,
    indication: 'mdr_gram_negative',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1500,
  },
  {
    name: 'Recarbrio (imipenem/cilastatin/relebactam)',
    company: 'Merck',
    modality: 'smallMolecule',
    peakSalesM: 250,
    peakSalesYear: 2026,
    currentSalesM: 200,
    indication: 'complicated_uti_iai',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
  {
    name: 'Arikayce (amikacin liposome)',
    company: 'Insmed',
    modality: 'smallMolecule',
    peakSalesM: 250,
    peakSalesYear: 2025,
    currentSalesM: 220,
    indication: 'mac_lung_disease',
    therapeuticArea: 'infectiousDisease',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1200,
  },
];

// ---------------------------------------------------------------------------
// Ophthalmology
// ---------------------------------------------------------------------------

const OPHTHALMOLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Eylea (aflibercept)',
    company: 'Regeneron',
    modality: 'mab',
    peakSalesM: 9500,
    peakSalesYear: 2023,
    currentSalesM: 7800,
    indication: 'amd',
    therapeuticArea: 'ophthalmology',
    genericCompetition: true,
    genericPriceDiscount: 0.30,
    marketSizeM: 15000,
  },
  {
    name: 'Vabysmo (faricimab)',
    company: 'Roche',
    modality: 'bispecific',
    peakSalesM: 6000,
    peakSalesYear: 2028,
    currentSalesM: 3500,
    indication: 'amd',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Syfovre (pegcetacoplan)',
    company: 'Apellis',
    modality: 'mab',
    peakSalesM: 2000,
    peakSalesYear: 2028,
    currentSalesM: 600,
    indication: 'geographic_atrophy',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Izervay (avacincaptad pegol)',
    company: 'Iveric Bio / Astellas',
    modality: 'mab',
    peakSalesM: 1500,
    peakSalesYear: 2028,
    currentSalesM: 400,
    indication: 'geographic_atrophy',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Lucentis (ranibizumab)',
    company: 'Roche / Novartis',
    modality: 'mab',
    peakSalesM: 4600,
    peakSalesYear: 2018,
    currentSalesM: 1200,
    indication: 'amd',
    therapeuticArea: 'ophthalmology',
    genericCompetition: true,
    genericPriceDiscount: 0.60,
    marketSizeM: 15000,
  },
  {
    name: 'Xiidra (lifitegrast)',
    company: 'Novartis',
    modality: 'smallMolecule',
    peakSalesM: 600,
    peakSalesYear: 2024,
    currentSalesM: 550,
    indication: 'dry_eye',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  {
    name: 'Restasis (cyclosporine)',
    company: 'AbbVie',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2017,
    currentSalesM: 200,
    indication: 'dry_eye',
    therapeuticArea: 'ophthalmology',
    genericCompetition: true,
    genericPriceDiscount: 0.80,
    marketSizeM: 6000,
  },
  {
    name: 'Rhopressa (netarsudil)',
    company: 'Aerie / Alcon',
    modality: 'smallMolecule',
    peakSalesM: 300,
    peakSalesYear: 2025,
    currentSalesM: 250,
    indication: 'glaucoma',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Oxervate (cenegermin)',
    company: 'Dompe',
    modality: 'mab',
    peakSalesM: 120,
    peakSalesYear: 2025,
    currentSalesM: 100,
    indication: 'neurotrophic_keratitis',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 500,
  },
  {
    name: 'Upneeq (oxymetazoline)',
    company: 'RVL Pharmaceuticals',
    modality: 'smallMolecule',
    peakSalesM: 150,
    peakSalesYear: 2026,
    currentSalesM: 100,
    indication: 'acquired_ptosis',
    therapeuticArea: 'ophthalmology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 800,
  },
  {
    name: 'Vuity (pilocarpine)',
    company: 'AbbVie',
    modality: 'smallMolecule',
    peakSalesM: 75,
    peakSalesYear: 2023,
    currentSalesM: 30,
    indication: 'presbyopia',
    therapeuticArea: 'ophthalmology',
    genericCompetition: true,
    genericPriceDiscount: 0.60,
    marketSizeM: 3000,
  },
];

// ---------------------------------------------------------------------------
// Dermatology
// ---------------------------------------------------------------------------

const DERMATOLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Rinvoq (upadacitinib)',
    company: 'AbbVie',
    modality: 'smallMolecule',
    peakSalesM: 8000,
    peakSalesYear: 2028,
    currentSalesM: 5000,
    indication: 'atopic_dermatitis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 22000,
  },
  {
    name: 'Cosentyx (secukinumab)',
    company: 'Novartis',
    modality: 'mab',
    peakSalesM: 5500,
    peakSalesYear: 2024,
    currentSalesM: 5000,
    indication: 'psoriasis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  {
    name: 'Bimzelx (bimekizumab)',
    company: 'UCB',
    modality: 'mab',
    peakSalesM: 5000,
    peakSalesYear: 2029,
    currentSalesM: 2600,
    indication: 'psoriasis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  {
    name: 'Sotyktu (deucravacitinib)',
    company: 'BMS',
    modality: 'smallMolecule',
    peakSalesM: 2000,
    peakSalesYear: 2028,
    currentSalesM: 500,
    indication: 'psoriasis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  {
    name: 'Ebglyss (lebrikizumab)',
    company: 'Eli Lilly',
    modality: 'mab',
    peakSalesM: 2500,
    peakSalesYear: 2030,
    currentSalesM: 200,
    indication: 'atopic_dermatitis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 22000,
  },
  {
    name: 'Litfulo (ritlecitinib)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2029,
    currentSalesM: 200,
    indication: 'alopecia_areata',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Olumiant (baricitinib)',
    company: 'Eli Lilly',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2023,
    currentSalesM: 900,
    indication: 'alopecia_areata',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Adbry (tralokinumab)',
    company: 'LEO Pharma',
    modality: 'mab',
    peakSalesM: 1000,
    peakSalesYear: 2028,
    currentSalesM: 300,
    indication: 'atopic_dermatitis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 22000,
  },
  {
    name: 'Humira (adalimumab — HS)',
    company: 'AbbVie',
    modality: 'mab',
    peakSalesM: 2000,
    peakSalesYear: 2022,
    currentSalesM: 800,
    indication: 'hidradenitis',
    therapeuticArea: 'dermatology',
    genericCompetition: true,
    genericPriceDiscount: 0.60,
    marketSizeM: 5000,
  },
  {
    name: 'Zoryve (roflumilast cream)',
    company: 'Arcutis',
    modality: 'smallMolecule',
    peakSalesM: 800,
    peakSalesYear: 2028,
    currentSalesM: 250,
    indication: 'psoriasis',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 20000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Vtama (tapinarof)',
    company: 'Dermavant',
    modality: 'smallMolecule',
    peakSalesM: 250,
    peakSalesYear: 2028,
    currentSalesM: 120,
    indication: 'plaque_psoriasis_topical',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Opzelura (ruxolitinib cream)',
    company: 'Incyte',
    modality: 'smallMolecule',
    peakSalesM: 450,
    peakSalesYear: 2027,
    currentSalesM: 350,
    indication: 'vitiligo',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Eucrisa (crisaborole)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 200,
    peakSalesYear: 2021,
    currentSalesM: 80,
    indication: 'atopic_dermatitis_mild',
    therapeuticArea: 'dermatology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
];

// ---------------------------------------------------------------------------
// Gastroenterology
// ---------------------------------------------------------------------------

const GASTROENTEROLOGY_INDEX: IndexDrug[] = [
  {
    name: 'Entyvio (vedolizumab)',
    company: 'Takeda',
    modality: 'mab',
    peakSalesM: 5500,
    peakSalesYear: 2025,
    currentSalesM: 5200,
    indication: 'ulcerative_colitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Skyrizi (risankizumab — IBD)',
    company: 'AbbVie',
    modality: 'mab',
    peakSalesM: 4000,
    peakSalesYear: 2028,
    currentSalesM: 1500,
    indication: 'crohns',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 15000,
  },
  {
    name: 'Humira (adalimumab — IBD)',
    company: 'AbbVie',
    modality: 'mab',
    peakSalesM: 6000,
    peakSalesYear: 2022,
    currentSalesM: 2500,
    indication: 'crohns',
    therapeuticArea: 'gastroenterology',
    genericCompetition: true,
    genericPriceDiscount: 0.60,
    marketSizeM: 15000,
  },
  {
    name: 'Rinvoq (upadacitinib — UC)',
    company: 'AbbVie',
    modality: 'smallMolecule',
    peakSalesM: 3000,
    peakSalesYear: 2028,
    currentSalesM: 1200,
    indication: 'ulcerative_colitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Zeposia (ozanimod)',
    company: 'BMS',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2028,
    currentSalesM: 500,
    indication: 'ulcerative_colitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Omvoh (mirikizumab)',
    company: 'Eli Lilly',
    modality: 'mab',
    peakSalesM: 3000,
    peakSalesYear: 2029,
    currentSalesM: 400,
    indication: 'ulcerative_colitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Velsipity (etrasimod)',
    company: 'Pfizer',
    modality: 'smallMolecule',
    peakSalesM: 2500,
    peakSalesYear: 2029,
    currentSalesM: 300,
    indication: 'ulcerative_colitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 18000,
  },
  {
    name: 'Xifaxan (rifaximin)',
    company: 'Salix / Bausch',
    modality: 'smallMolecule',
    peakSalesM: 1700,
    peakSalesYear: 2023,
    currentSalesM: 1500,
    indication: 'ibs',
    therapeuticArea: 'gastroenterology',
    genericCompetition: true,
    genericPriceDiscount: 0.50,
    marketSizeM: 5000,
  },
  {
    name: 'Nexium (esomeprazole)',
    company: 'AstraZeneca',
    modality: 'smallMolecule',
    peakSalesM: 6300,
    peakSalesYear: 2013,
    currentSalesM: 400,
    indication: 'gerd',
    therapeuticArea: 'gastroenterology',
    genericCompetition: true,
    genericPriceDiscount: 0.95,
    marketSizeM: 10000,
  },
  {
    name: 'Dupixent (dupilumab — EoE)',
    company: 'Sanofi / Regeneron',
    modality: 'mab',
    peakSalesM: 2000,
    peakSalesYear: 2028,
    currentSalesM: 800,
    indication: 'eosinophilic_esophagitis',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Ibsrela (tenapanor)',
    company: 'Ardelyx',
    modality: 'smallMolecule',
    peakSalesM: 220,
    peakSalesYear: 2027,
    currentSalesM: 150,
    indication: 'ibs_c',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
  {
    name: 'Motegrity (prucalopride)',
    company: 'Takeda',
    modality: 'smallMolecule',
    peakSalesM: 300,
    peakSalesYear: 2025,
    currentSalesM: 250,
    indication: 'chronic_constipation',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Briumvi (olutasidenib — GI)',
    company: 'Protagonist',
    modality: 'peptide',
    peakSalesM: 150,
    peakSalesYear: 2028,
    currentSalesM: 50,
    indication: 'refractory_ibd',
    therapeuticArea: 'gastroenterology',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
];

// ---------------------------------------------------------------------------
// Women's Health
// ---------------------------------------------------------------------------

const WOMENS_HEALTH_INDEX: IndexDrug[] = [
  {
    name: 'Myrbetriq (mirabegron)',
    company: 'Astellas',
    modality: 'smallMolecule',
    peakSalesM: 1800,
    peakSalesYear: 2023,
    currentSalesM: 1400,
    indication: 'overactive_bladder',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Oriahnn (elagolix/E2/NETA)',
    company: 'AbbVie',
    modality: 'gnrhAntagonist',
    peakSalesM: 800,
    peakSalesYear: 2025,
    currentSalesM: 500,
    indication: 'uterine_fibroids',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3500,
  },
  {
    name: 'Zurzuvae (zuranolone)',
    company: 'Biogen / Sage',
    modality: 'neuroactiveSteroid',
    peakSalesM: 1500,
    peakSalesYear: 2028,
    currentSalesM: 200,
    indication: 'postpartum_depression',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Nexplanon (etonogestrel implant)',
    company: 'Organon',
    modality: 'smallMolecule',
    peakSalesM: 1000,
    peakSalesYear: 2025,
    currentSalesM: 963,
    indication: 'contraception',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 8000,
  },
  {
    name: 'Veozah (fezolinetant)',
    company: 'Astellas',
    modality: 'smallMolecule',
    peakSalesM: 1500,
    peakSalesYear: 2029,
    currentSalesM: 300,
    indication: 'menopause_vms',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  {
    name: 'Myfembree (relugolix combo)',
    company: 'Myovant / Sumitomo',
    modality: 'gnrhAntagonist',
    peakSalesM: 600,
    peakSalesYear: 2027,
    currentSalesM: 250,
    indication: 'uterine_fibroids',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3500,
  },
  {
    name: 'Orilissa (elagolix)',
    company: 'AbbVie',
    modality: 'gnrhAntagonist',
    peakSalesM: 400,
    peakSalesYear: 2021,
    currentSalesM: 130,
    indication: 'endometriosis',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 4000,
  },
  {
    name: 'Lupron Depot (leuprolide)',
    company: 'AbbVie',
    modality: 'peptide',
    peakSalesM: 2500,
    peakSalesYear: 2018,
    currentSalesM: 1200,
    indication: 'endometriosis',
    therapeuticArea: 'womensHealth',
    genericCompetition: true,
    genericPriceDiscount: 0.50,
    marketSizeM: 4000,
  },
  {
    name: 'Letrozole (generic)',
    company: 'Various',
    modality: 'smallMolecule',
    peakSalesM: 600,
    peakSalesYear: 2020,
    currentSalesM: 400,
    indication: 'fertility',
    therapeuticArea: 'womensHealth',
    genericCompetition: true,
    genericPriceDiscount: 0.90,
    marketSizeM: 5000,
  },
  {
    name: 'Gonal-f (follitropin alfa)',
    company: 'EMD Serono / Merck KGaA',
    modality: 'mab',
    peakSalesM: 1200,
    peakSalesYear: 2022,
    currentSalesM: 900,
    indication: 'fertility',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 5000,
  },
  {
    name: 'Bijuva (estradiol/progesterone)',
    company: 'TherapeuticsMD',
    modality: 'smallMolecule',
    peakSalesM: 200,
    peakSalesYear: 2025,
    currentSalesM: 150,
    indication: 'menopause_hrt',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 6000,
  },
  // --- Floor comparables (sub-$500M peak) ---
  {
    name: 'Annovera (segesterone/ethinyl estradiol)',
    company: 'TherapeuticsMD',
    modality: 'smallMolecule',
    peakSalesM: 100,
    peakSalesYear: 2025,
    currentSalesM: 70,
    indication: 'contraception_ring',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 2000,
  },
  {
    name: 'Slynd (drospirenone)',
    company: 'Exeltis',
    modality: 'smallMolecule',
    peakSalesM: 180,
    peakSalesYear: 2025,
    currentSalesM: 150,
    indication: 'contraception_progestin',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 3000,
  },
  {
    name: 'Phexxi (lactic acid/citric acid/potassium bitartrate)',
    company: 'Evofem',
    modality: 'smallMolecule',
    peakSalesM: 50,
    peakSalesYear: 2023,
    currentSalesM: 20,
    indication: 'contraception_nonhormonal',
    therapeuticArea: 'womensHealth',
    genericCompetition: false,
    genericPriceDiscount: 0,
    marketSizeM: 1000,
  },
];

// ---------------------------------------------------------------------------
// Combined Database + Lookup Functions
// ---------------------------------------------------------------------------

export const INDEX_DRUG_DATABASE: IndexDrug[] = [
  ...ONCOLOGY_INDEX,
  ...NEUROLOGY_INDEX,
  ...IMMUNOLOGY_INDEX,
  ...METABOLIC_INDEX,
  ...RARE_DISEASE_INDEX,
  ...CARDIOVASCULAR_INDEX,
  ...HEMATOLOGY_INDEX,
  ...INFECTIOUS_DISEASE_INDEX,
  ...OPHTHALMOLOGY_INDEX,
  ...DERMATOLOGY_INDEX,
  ...GASTROENTEROLOGY_INDEX,
  ...WOMENS_HEALTH_INDEX,
];

/**
 * Find the best matching index drug for a given indication and therapeutic area.
 * Returns the top drug by peak sales in the matching TA, or the closest indication match.
 */
export function findIndexDrug(
  therapeuticArea: string,
  indication?: string,
  modality?: string,
  modelPeakSalesM?: number,
): IndexDrug | null {
  // First try exact indication + modality match
  if (indication && modality) {
    const exactMatch = INDEX_DRUG_DATABASE.find(
      d => d.indication === indication && d.modality === modality && d.therapeuticArea === therapeuticArea
    );
    if (exactMatch) return exactMatch;
  }

  // Then try exact indication match
  if (indication) {
    const indicationMatches = INDEX_DRUG_DATABASE.filter(
      d => d.indication === indication && d.therapeuticArea === therapeuticArea
    );
    if (indicationMatches.length > 0) {
      // If we have a model peak sales estimate, pick the closest match by peak sales
      if (modelPeakSalesM && modelPeakSalesM > 0) {
        return indicationMatches.sort(
          (a, b) => Math.abs(a.peakSalesM - modelPeakSalesM) - Math.abs(b.peakSalesM - modelPeakSalesM)
        )[0];
      }
      return indicationMatches[0];
    }
  }

  // Then try modality match within TA — pick closest by peak sales
  if (modality) {
    const modalityMatches = INDEX_DRUG_DATABASE.filter(
      d => d.modality === modality && d.therapeuticArea === therapeuticArea
    );
    if (modalityMatches.length > 0) {
      if (modelPeakSalesM && modelPeakSalesM > 0) {
        return modalityMatches.sort(
          (a, b) => Math.abs(a.peakSalesM - modelPeakSalesM) - Math.abs(b.peakSalesM - modelPeakSalesM)
        )[0];
      }
      return modalityMatches[0];
    }
  }

  // Fall back to closest drug in TA by peak sales (not the biggest)
  const taMatches = INDEX_DRUG_DATABASE.filter(d => d.therapeuticArea === therapeuticArea);
  if (taMatches.length === 0) return null;

  if (modelPeakSalesM && modelPeakSalesM > 0) {
    return taMatches.sort(
      (a, b) => Math.abs(a.peakSalesM - modelPeakSalesM) - Math.abs(b.peakSalesM - modelPeakSalesM)
    )[0];
  }

  // If no model estimate, pick the median drug (not the blockbuster)
  const sorted = taMatches.sort((a, b) => a.peakSalesM - b.peakSalesM);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Find all index drugs in a therapeutic area, sorted by peak sales descending.
 */
export function getIndexDrugsForTA(therapeuticArea: string): IndexDrug[] {
  return INDEX_DRUG_DATABASE
    .filter(d => d.therapeuticArea === therapeuticArea)
    .sort((a, b) => b.peakSalesM - a.peakSalesM);
}

/**
 * Compute the peak sales sanity check.
 * Returns the index ratio (model / index drug) and a confidence assessment.
 */
export function checkPeakSalesRealism(
  modelPeakSalesM: number,
  therapeuticArea: string,
  indication?: string,
  modality?: string,
): {
  indexDrug: IndexDrug | null;
  indexRatio: number;        // model / index (>1.0 means model exceeds market leader)
  confidence: 'high' | 'moderate' | 'low' | 'warning';
  narrative: string;
} {
  const indexDrug = findIndexDrug(therapeuticArea, indication, modality, modelPeakSalesM);

  if (!indexDrug) {
    return {
      indexDrug: null,
      indexRatio: 0,
      confidence: 'low',
      narrative: 'No comparable index drug found for this indication. Peak sales estimate relies entirely on bottom-up epidemiology model.',
    };
  }

  const indexRatio = modelPeakSalesM / indexDrug.peakSalesM;

  let confidence: 'high' | 'moderate' | 'low' | 'warning';
  let narrative: string;

  if (indexRatio <= 0.25) {
    confidence = 'high';
    narrative = `Model estimate ($${modelPeakSalesM.toFixed(0)}M) is ${(indexRatio * 100).toFixed(0)}% of ${indexDrug.name} peak sales ($${indexDrug.peakSalesM.toLocaleString()}M). Conservative and defensible.`;
  } else if (indexRatio <= 0.60) {
    confidence = 'high';
    narrative = `Model estimate ($${modelPeakSalesM.toFixed(0)}M) is ${(indexRatio * 100).toFixed(0)}% of ${indexDrug.name} peak sales ($${indexDrug.peakSalesM.toLocaleString()}M). Reasonable and within market norms.`;
  } else if (indexRatio <= 1.0) {
    confidence = 'moderate';
    narrative = `Model estimate ($${modelPeakSalesM.toFixed(0)}M) is ${(indexRatio * 100).toFixed(0)}% of ${indexDrug.name} peak sales ($${indexDrug.peakSalesM.toLocaleString()}M). Achievable but requires best-in-class execution.`;
  } else if (indexRatio <= 1.5) {
    confidence = 'low';
    narrative = `Model estimate ($${modelPeakSalesM.toFixed(0)}M) exceeds ${indexDrug.name} peak sales ($${indexDrug.peakSalesM.toLocaleString()}M) by ${((indexRatio - 1) * 100).toFixed(0)}%. This projection may be optimistic — consider adjusting peak sales assumption.`;
  } else {
    confidence = 'warning';
    narrative = `Model estimate ($${modelPeakSalesM.toFixed(0)}M) is ${indexRatio.toFixed(1)}x the current market leader (${indexDrug.name}: $${indexDrug.peakSalesM.toLocaleString()}M). This exceeds any observed peak sales in this indication. Investors and pharma partners will challenge this projection.`;
  }

  return { indexDrug, indexRatio, confidence, narrative };
}

/**
 * Compute the generic market entrenchment penalty.
 * Returns a 0-1 multiplier applied to peak sales when entering a market
 * with established generic competition.
 */
export function getGenericEntrenchmentMultiplier(
  therapeuticArea: string,
  indication?: string,
): { multiplier: number; narrative: string; genericDrug?: string } {
  // Find index drugs with generic competition in this space
  const competitors = INDEX_DRUG_DATABASE.filter(
    d => d.therapeuticArea === therapeuticArea &&
         d.genericCompetition &&
         (indication ? d.indication === indication : true)
  );

  if (competitors.length === 0) {
    return {
      multiplier: 1.0,
      narrative: 'No significant generic competition in this indication. Full market penetration potential.',
    };
  }

  // Use the worst-case generic discount
  const worstDiscount = Math.max(...competitors.map(d => d.genericPriceDiscount));
  const genericDrug = competitors.find(d => d.genericPriceDiscount === worstDiscount);

  // Penetration penalty scales with generic price discount
  // 90% cheaper generics → 0.30x penetration (very hard to displace)
  // 60% cheaper generics → 0.55x penetration (moderate displacement)
  // 30% cheaper generics → 0.75x penetration (easier to displace with innovation)
  const multiplier = Math.max(0.20, 1.0 - (worstDiscount * 0.80));

  const narrative = worstDiscount >= 0.80
    ? `Established generics at ${(worstDiscount * 100).toFixed(0)}% discount dominate this market. Novel entrants historically capture only ${(multiplier * 100).toFixed(0)}% of modeled peak sales due to prescriber inertia and payer step-therapy requirements.`
    : worstDiscount >= 0.50
    ? `Biosimilar/generic competition at ${(worstDiscount * 100).toFixed(0)}% discount creates moderate market access headwinds. Peak sales adjusted to ${(multiplier * 100).toFixed(0)}% of model estimate.`
    : `Limited generic price pressure (${(worstDiscount * 100).toFixed(0)}% discount). Minor impact on market penetration.`;

  return {
    multiplier,
    narrative,
    genericDrug: genericDrug?.name,
  };
}

/**
 * Compute epidemiology data sufficiency rating.
 * Compares the bottom-up model TAM against actual market size for the indication.
 */
export function checkEpidemiologyDataSufficiency(
  modelTamM: number,
  therapeuticArea: string,
  indication?: string,
): {
  confidence: 'high' | 'moderate' | 'low';
  actualMarketSizeM: number | null;
  divergencePercent: number;
  narrative: string;
} {
  const indexDrug = findIndexDrug(therapeuticArea, indication);

  if (!indexDrug || !indexDrug.marketSizeM) {
    return {
      confidence: 'low',
      actualMarketSizeM: null,
      divergencePercent: 0,
      narrative: 'No reference market size data available for this indication. Epidemiology-derived TAM cannot be validated against actual market data.',
    };
  }

  const actualMarketSizeM = indexDrug.marketSizeM;
  const divergencePercent = Math.abs(modelTamM - actualMarketSizeM) / actualMarketSizeM * 100;

  let confidence: 'high' | 'moderate' | 'low';
  let narrative: string;

  if (divergencePercent <= 20) {
    confidence = 'high';
    narrative = `Epidemiology-derived TAM ($${modelTamM.toLocaleString()}M) is within ${divergencePercent.toFixed(0)}% of actual market size ($${actualMarketSizeM.toLocaleString()}M). High confidence in bottom-up model.`;
  } else if (divergencePercent <= 50) {
    confidence = 'moderate';
    narrative = `Epidemiology-derived TAM ($${modelTamM.toLocaleString()}M) diverges ${divergencePercent.toFixed(0)}% from actual market size ($${actualMarketSizeM.toLocaleString()}M). Model may not fully account for market access, pricing dynamics, or competitive realities.`;
  } else {
    confidence = 'low';
    narrative = `Epidemiology-derived TAM ($${modelTamM.toLocaleString()}M) diverges ${divergencePercent.toFixed(0)}% from actual market size ($${actualMarketSizeM.toLocaleString()}M). Bottom-up model may significantly over- or under-estimate market potential. Recommend validating assumptions against commercial analogs.`;
  }

  return { confidence, actualMarketSizeM, divergencePercent, narrative };
}

/**
 * Manufacturing complexity WACC premium by modality.
 * Applied on top of base TA/phase WACC.
 */
export const MANUFACTURING_WACC_PREMIUM: Record<string, number> = {
  geneTherapy: 0.015,      // +1.5pp (viral vector manufacturing, cold chain, per-patient production)
  geneTherapyRare: 0.015,
  geneTherapyOcular: 0.012,
  geneEditing: 0.018,      // +1.8pp (CRISPR manufacturing complexity)
  carT_heme: 0.020,        // +2.0pp (autologous per-patient manufacturing, vein-to-vein logistics)
  carT_solid: 0.022,       // +2.2pp (solid tumor CAR-T has additional TME engineering challenges)
  carT_autoimmune: 0.020,
  cellTherapy: 0.015,      // +1.5pp (cell processing, cryopreservation)
  adc: 0.005,              // +0.5pp (conjugation chemistry, linker-payload stability)
  bispecific: 0.008,       // +0.8pp (complex manufacturing, low yields)
  radiopharmaceutical: 0.012, // +1.2pp (short half-life isotopes, specialized facilities)
  mrna: 0.008,             // +0.8pp (LNP formulation, cold chain)
  // All other modalities: 0 (no additional premium)
};

/**
 * Reimbursement/market access delay by therapeutic area (months).
 * Post-approval lag before revenue starts.
 */
export const MARKET_ACCESS_DELAY_MONTHS: Record<string, { default: number; range: [number, number] }> = {
  rareDisease: { default: 9, range: [3, 18] },     // Payer resistance to ultra-high-cost therapies
  oncology: { default: 3, range: [1, 9] },          // Rapid uptake in cancer (NCCN guidelines drive adoption)
  neurology: { default: 6, range: [3, 12] },        // Step-therapy requirements, specialist prescribing
  immunology: { default: 4, range: [2, 9] },        // Established payer pathways (anti-TNF precedent)
  metabolic: { default: 6, range: [3, 12] },        // Obesity: payer pushback on coverage; T2D: faster
  cardiovascular: { default: 4, range: [2, 9] },    // Large patient populations, established pathways
  infectiousDisease: { default: 2, range: [1, 6] }, // Fastest: CDC/WHO urgency drives adoption
  ophthalmology: { default: 4, range: [2, 9] },     // Specialist-driven, fewer payer hurdles
  hematology: { default: 3, range: [1, 9] },        // Specialist centers, NCCN/ASH guidelines
  dermatology: { default: 5, range: [3, 12] },      // Step-therapy requirements common
  gastroenterology: { default: 5, range: [3, 12] }, // Step-therapy for biologics in IBD
  womensHealth: { default: 4, range: [2, 9] },      // Moderate payer complexity
};
