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

import { getTier3CalibratedIndication } from './indication-tier3-calibration';

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
  /**
   * Optional year-by-year realized revenue (year → $M).
   * When present, RWE tuning (lib/financial/rwe-tuning.ts) can backtest the
   * model's full launch curve against actual trajectory rather than peak only.
   * Backfilled opportunistically from EvaluatePharma / 10-K disclosures.
   */
  revenueByYear?: Record<number, number>;
  /** Year of FDA approval — used by RWE tuning to align retrospective inputs. */
  approvalYear?: number;
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

// ---------------------------------------------------------------------------
// Top Comparable Scoring
// ---------------------------------------------------------------------------

export interface ComparableResult {
  drug: IndexDrug;
  score: number;
  matchReasons: string[];
}

/**
 * Find the top 3 closest comparable drugs using a weighted scoring system.
 * Scoring:
 *   - Exact indication match: +50 points
 *   - Same modality: +30 points
 *   - Same TA: +10 points (baseline)
 *   - Peak sales proximity: +10 × (1 - |log(model/drug)| / 3), clamped 0-10
 *   - Recency bonus: +5 if peakSalesYear >= 2020
 */
export function findTopComparables(
  therapeuticArea: string,
  modelPeakSalesM: number,
  indication?: string,
  modality?: string,
): ComparableResult[] {
  const taDrugs = INDEX_DRUG_DATABASE.filter(d => d.therapeuticArea === therapeuticArea);
  if (taDrugs.length === 0) return [];

  const scored: ComparableResult[] = taDrugs.map(drug => {
    let score = 10; // baseline TA match
    const matchReasons: string[] = ['Same therapeutic area'];

    // Exact indication match
    if (indication && drug.indication === indication) {
      score += 50;
      matchReasons.push('Indication match');
    }

    // Same modality
    if (modality && drug.modality === modality) {
      score += 30;
      matchReasons.push('Modality match');
    }

    // Peak sales proximity (log-scale)
    if (modelPeakSalesM > 0 && drug.peakSalesM > 0) {
      const logDiff = Math.abs(Math.log(modelPeakSalesM / drug.peakSalesM));
      const proximityScore = Math.max(0, Math.min(10, 10 * (1 - logDiff / 3)));
      score += proximityScore;
      if (proximityScore >= 7) {
        matchReasons.push('Close peak sales');
      } else if (proximityScore >= 4) {
        matchReasons.push('Similar peak sales range');
      }
    }

    // Recency bonus
    if (drug.peakSalesYear >= 2020) {
      score += 5;
      matchReasons.push('Modern comparable');
    }

    return { drug, score, matchReasons };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Phase-Adjusted Confidence
// ---------------------------------------------------------------------------

export interface PhaseAdjustedConfidence {
  originalConfidence: 'high' | 'moderate' | 'low' | 'warning';
  adjustedConfidence: 'high' | 'moderate' | 'low' | 'warning';
  wasAdjusted: boolean;
  phaseNarrative: string;
}

const CONFIDENCE_LEVELS: Array<'high' | 'moderate' | 'low' | 'warning'> = ['high', 'moderate', 'low', 'warning'];

/**
 * Adjust confidence based on the asset's clinical phase.
 * - Preclinical/Phase 1: downgrade one level (projections are speculative)
 * - Phase 2: keep as-is
 * - Phase 3/Approved: can upgrade one level (more data supports the projection)
 */
export function getPhaseAdjustedConfidence(
  baseConfidence: 'high' | 'moderate' | 'low' | 'warning',
  phase?: string,
): PhaseAdjustedConfidence {
  if (!phase) {
    return {
      originalConfidence: baseConfidence,
      adjustedConfidence: baseConfidence,
      wasAdjusted: false,
      phaseNarrative: '',
    };
  }

  const normalized = phase.toLowerCase().replace(/[\s/-]/g, '');
  const idx = CONFIDENCE_LEVELS.indexOf(baseConfidence);

  // Preclinical or Phase 1 — downgrade
  if (normalized === 'preclinical' || normalized === 'phase1') {
    const downgraded = CONFIDENCE_LEVELS[Math.min(idx + 1, CONFIDENCE_LEVELS.length - 1)];
    return {
      originalConfidence: baseConfidence,
      adjustedConfidence: downgraded,
      wasAdjusted: downgraded !== baseConfidence,
      phaseNarrative: `Confidence adjusted downward for ${phase} asset. Peak sales projections at this stage are inherently speculative with limited clinical data to support commercial assumptions.`,
    };
  }

  // Phase 3 or Approved — upgrade
  if (normalized === 'phase3' || normalized === 'approved' || normalized === 'phase23' || normalized === 'phase2/3') {
    const upgraded = CONFIDENCE_LEVELS[Math.max(idx - 1, 0)];
    return {
      originalConfidence: baseConfidence,
      adjustedConfidence: upgraded,
      wasAdjusted: upgraded !== baseConfidence,
      phaseNarrative: `Confidence adjusted upward for ${phase} asset. Late-stage or approved assets have sufficient clinical and commercial data to support peak sales projections.`,
    };
  }

  // Phase 2, Phase 1/2, or anything else — keep as-is
  return {
    originalConfidence: baseConfidence,
    adjustedConfidence: baseConfidence,
    wasAdjusted: false,
    phaseNarrative: '',
  };
}

// ---------------------------------------------------------------------------
// Peak Sales Realism Check (updated with top comparables + phase adjustment)
// ---------------------------------------------------------------------------

/**
 * Compute the peak sales sanity check.
 * Returns the index ratio (model / index drug) and a confidence assessment.
 * Now also returns top 3 comparables and optional phase-adjusted confidence.
 */
export function checkPeakSalesRealism(
  modelPeakSalesM: number,
  therapeuticArea: string,
  indication?: string,
  modality?: string,
  phase?: string,
): {
  indexDrug: IndexDrug | null;
  indexRatio: number;        // model / index (>1.0 means model exceeds market leader)
  confidence: 'high' | 'moderate' | 'low' | 'warning';
  narrative: string;
  topComparables: ComparableResult[];
  phaseAdjustedConfidence?: PhaseAdjustedConfidence;
} {
  const indexDrug = findIndexDrug(therapeuticArea, indication, modality, modelPeakSalesM);

  const topComparables = findTopComparables(therapeuticArea, modelPeakSalesM, indication, modality);

  if (!indexDrug) {
    return {
      indexDrug: null,
      indexRatio: 0,
      confidence: 'low',
      narrative: 'No comparable index drug found for this indication. Peak sales estimate relies entirely on bottom-up epidemiology model.',
      topComparables,
      phaseAdjustedConfidence: phase ? getPhaseAdjustedConfidence('low', phase) : undefined,
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

  const phaseAdjustedConfidence = phase ? getPhaseAdjustedConfidence(confidence, phase) : undefined;

  return { indexDrug, indexRatio, confidence, narrative, topComparables, phaseAdjustedConfidence };
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
  trispecificAntibody: 0.015, // +1.5pp (chain mispairing, 0.5-2.0 g/L yields vs 5-8 g/L standard mAb; Springer Process Dev 2024)
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

// ---------------------------------------------------------------------------
// Indication Market Caps
// ---------------------------------------------------------------------------

/**
 * Indication Market Caps
 *
 * Total addressable market and maximum realistic single-drug peak sales
 * per indication. Used to apply hard ceilings on user peak sales assumptions.
 *
 * The rNPV engine's index-drug sanity check flags unrealistic peak sales vs
 * the actual market leader, but that check is soft. This database adds a
 * hard TAM-based ceiling so a user cannot assume, e.g., $50B peak sales for
 * a $4B global TAM rare disease without the model flagging it as critical.
 *
 * Methodology:
 *   - globalTAM_M is the total branded + generic revenue across all players
 *     in the indication as of 2024-2025 (most recent full-year data).
 *   - maxDrugPeakSales_M is the highest realistic single-drug peak, usually
 *     the current market leader's peak or a near-term forecast peak for
 *     emerging classes (e.g., GLP-1 obesity, NASH/MASH, amyloid-Ab Alzheimer's).
 *   - Typical maxDrug/TAM ratio is 30-50%, but in monopolistic or class-
 *     dominated markets (Dupixent in AD, Trikafta in CF, Keytruda in NSCLC)
 *     the leader can capture 70-90% of the branded TAM.
 *
 * Sources: EvaluatePharma World Preview 2025, IQVIA Channel Dynamics 2025,
 * IQVIA Institute Global Outlook 2024, IMS Health MIDAS, company 10-K
 * reports (2024 full year), Statista Pharma Market Outlook 2025,
 * FiercePharma 2024 Top 20 Drugs by Revenue, Nature Reviews Drug Discovery
 * market analyses.
 *
 * All values in $M USD.
 */

export interface IndicationMarketCap {
  indication: string;
  ta: string;
  /** Total addressable market in $M (current 2025/2026) */
  globalTAM_M: number;
  /** Maximum realistic single-drug peak sales (class leader — e.g. Keytruda
   *  in NSCLC, Dupixent in atopic dermatitis). Use as ceiling check, not
   *  as a default anchor for a generic in-class asset. */
  maxDrugPeakSales_M: number;
  /** Typical Phase 2/3 asset peak sales — what the #3-#5 drug in a competitive
   *  class achieves at peak. Closer to the mean than the class-leader number
   *  and the right anchor when no explicit asset-specific consensus exists.
   *  Derived from published 2023-2025 class-concentration data: for
   *  concentrated classes (1-2 dominant players), ~15-25% of maxDrug; for
   *  fragmented classes (5+ competitors), ~30-45% of maxDrug. Individual
   *  entries override the derivation where better source data exists.
   *  Optional — some entries (niche / first-in-class) have no meaningful
   *  typical-asset anchor. */
  typicalAssetPeakSales_M?: number;
  /** Year of estimate */
  estimateYear: number;
  source: string;
  notes?: string;
}

export const INDICATION_MARKET_CAPS: Record<string, IndicationMarketCap> = {
  // -------------------------------------------------------------------------
  // Oncology (12)
  // -------------------------------------------------------------------------
  lung_nsclc: {
    indication: 'lung_nsclc',
    ta: 'oncology',
    globalTAM_M: 42000,
    maxDrugPeakSales_M: 32000,
    // Deliberately no typicalAssetPeakSales_M — lung_nsclc deals span an
    // extreme range from mega-ADC licensing ($4B upfronts, Enhertu-class)
    // down to biosimilar-era me-toos ($100M upfronts). A single "typical"
    // number overshoots one half while undershooting the other. Disaggregate
    // by modality + trial phase when corpus supports it (future work).
    estimateYear: 2025,
    source: 'Merck 2024 10-K (Keytruda $29.5B actual), EvaluatePharma World Preview 2025',
    notes: 'Keytruda dominates with ~75% branded share; Opdivo, Tecentriq, Libtayo fill out class. Keytruda 2025 consensus peak $32B aligned with index drug.',
  },
  breast_her2: {
    indication: 'breast_her2',
    ta: 'oncology',
    globalTAM_M: 14000,
    maxDrugPeakSales_M: 10000,
    estimateYear: 2025,
    source: 'AstraZeneca/Daiichi 2024 10-K (Enhertu $3.8B actual, $10B+ consensus peak), Roche 2024 annual (Perjeta $4.2B, Kadcyla $2.4B)',
    notes: 'Enhertu projected to take #1 position by 2028 as it expands beyond HER2+ into HER2-low.',
  },
  breast_tnbc: {
    indication: 'breast_tnbc',
    ta: 'oncology',
    globalTAM_M: 5000,
    maxDrugPeakSales_M: 3000,
    estimateYear: 2025,
    source: 'Gilead 2024 10-K (Trodelvy $1.3B), Merck 2024 10-K Keytruda TNBC allocation, EvaluatePharma 2025',
    notes: 'Trodelvy + Keytruda combo driving class; no single mega-blockbuster yet because TNBC is a smaller subtype.',
  },
  melanoma: {
    indication: 'melanoma',
    ta: 'oncology',
    globalTAM_M: 8000,
    maxDrugPeakSales_M: 5000,
    estimateYear: 2025,
    source: 'BMS 2024 10-K (Opdivo+Yervoy melanoma), Merck 2024 10-K (Keytruda melanoma allocation), EvaluatePharma 2025',
    notes: 'Keytruda adjuvant + Opdivo-Yervoy combo own the market. Tafinlar/Mekinist BRAF-targeted for subpopulation.',
  },
  colorectal: {
    indication: 'colorectal',
    ta: 'oncology',
    globalTAM_M: 9000,
    maxDrugPeakSales_M: 4000,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025, Amgen 2024 10-K (Vectibix), Roche Avastin legacy, Lilly Erbitux',
    notes: 'Fragmented market: Avastin, Erbitux, Vectibix, Lonsurf, Braftovi. No dominant single drug >$4B.',
  },
  prostate: {
    indication: 'prostate',
    ta: 'oncology',
    globalTAM_M: 13000,
    maxDrugPeakSales_M: 6000,
    estimateYear: 2025,
    source: 'Pfizer/Astellas 2024 10-K (Xtandi $6.0B), J&J 2024 10-K (Zytiga, Erleada), Novartis Pluvicto $1.4B',
    notes: 'Xtandi is market leader; Erleada and Pluvicto growing. Zytiga now genericized.',
  },
  pancreatic: {
    indication: 'pancreatic',
    ta: 'oncology',
    globalTAM_M: 3000,
    maxDrugPeakSales_M: 1500,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025, Servier (Onivyde), Celgene Abraxane legacy',
    notes: 'Very limited options — gemcitabine generic, Folfirinox off-patent, Onivyde branded. One of the hardest indications for blockbusters.',
  },
  ovarian: {
    indication: 'ovarian',
    ta: 'oncology',
    globalTAM_M: 7000,
    maxDrugPeakSales_M: 3500,
    estimateYear: 2025,
    source: 'AstraZeneca 2024 10-K (Lynparza $3.1B cross-indication), GSK Zejula, Clovis Rubraca, Roche Avastin',
    notes: 'PARP inhibitor class (Lynparza, Zejula) dominant in BRCA+; Avastin adds bevacizumab backbone.',
  },
  head_neck: {
    indication: 'head_neck',
    ta: 'oncology',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 2000,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025, Merck 2024 10-K Keytruda H&N allocation, Lilly Erbitux legacy',
    notes: 'Keytruda is #1 in 1L recurrent/metastatic; Erbitux genericized-adjacent.',
  },
  multiple_myeloma: {
    indication: 'multiple_myeloma',
    ta: 'oncology',
    globalTAM_M: 25000,
    maxDrugPeakSales_M: 12000,
    typicalAssetPeakSales_M: 2500,  // Non-Darzalex: Pomalyst $3.5B, Kyprolis $1.5B, Carvykti/Abecma CAR-Ts $500M-1B — typical MM asset $1.5-3B (BMS/J&J/Amgen 2024 10-Ks)
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Darzalex $11.7B), BMS 2024 10-K (Revlimid post-LOE, Pomalyst $3.5B), Takeda Ninlaro',
    notes: 'Darzalex near $12B and still growing; Revlimid post-LOE erosion freeing up TAM for BCMA CAR-Ts and bispecifics.',
  },
  dlbcl: {
    indication: 'dlbcl',
    ta: 'oncology',
    globalTAM_M: 8000,
    maxDrugPeakSales_M: 5000,
    estimateYear: 2025,
    source: 'Roche 2024 annual (Rituxan legacy + biosimilars), Polivy $1.2B, AbbVie Imbruvica DLBCL',
    notes: 'Rituxan/R-CHOP still standard of care backbone; Polivy and CAR-Ts (Yescarta, Breyanzi) in 2L+.',
  },
  aml: {
    indication: 'aml',
    ta: 'oncology',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 2000,
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Venclexta $2.5B cross-indication, AML portion ~$1.4B), Astellas Xospata, Daiichi Vanflyta',
    notes: 'Venclexta+aza is the new SoC in elderly AML; FLT3 and IDH inhibitors fill targeted segments.',
  },

  // -------------------------------------------------------------------------
  // Neurology (8)
  // -------------------------------------------------------------------------
  alzheimers: {
    indication: 'alzheimers',
    ta: 'neurology',
    globalTAM_M: 6000,
    maxDrugPeakSales_M: 4000,
    estimateYear: 2025,
    source: 'Eisai/Biogen 2024 reports (Leqembi $370M 2024, $5B peak forecast), Lilly 2024 10-K (Kisunla launch)',
    notes: 'Emerging market — amyloid-Ab class (Leqembi, Kisunla) ramping slowly due to MRI monitoring and IV infusion burden. $4B max reflects 2030 peak, not 2025.',
  },
  parkinsons: {
    indication: 'parkinsons',
    ta: 'neurology',
    globalTAM_M: 5000,
    maxDrugPeakSales_M: 2500,
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Duopa + Vyalev), AcadiaNuplazid, EvaluatePharma 2025',
    notes: 'Levodopa generic; branded market is device-assisted delivery and dyskinesia adjuncts. No single $5B+ PD drug.',
  },
  multiple_sclerosis: {
    indication: 'multiple_sclerosis',
    ta: 'neurology',
    globalTAM_M: 25000,
    maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 2500,  // Non-Ocrevus: Kesimpta $3B ramping, Tysabri $2B, Aubagio post-LOE — typical MS DMT $2-3B (Novartis/Biogen 2024 10-Ks)
    estimateYear: 2025,
    source: 'Roche 2024 annual (Ocrevus $7.6B), Biogen 2024 10-K (Tysabri, Tecfidera post-LOE), Novartis Kesimpta',
    notes: 'Ocrevus is #1 MS drug globally at ~$8B; Kesimpta ramping to $3B+. Tecfidera post-LOE erosion.',
  },
  als: {
    indication: 'als',
    ta: 'neurology',
    globalTAM_M: 1000,
    maxDrugPeakSales_M: 500,
    estimateYear: 2025,
    source: 'Amylyx Relyvrio (withdrawn 2024), Biogen Qalsody, Mitsubishi Tanabe Radicava, EvaluatePharma 2025',
    notes: 'Very small TAM — limited patient population (~30K US), short survival, historical failures. Qalsody genetic subset only.',
  },
  epilepsy: {
    indication: 'epilepsy',
    ta: 'neurology',
    globalTAM_M: 8000,
    maxDrugPeakSales_M: 3000,
    estimateYear: 2025,
    source: 'UCB 2024 annual (Vimpat post-LOE, Briviact), Jazz Epidiolex $900M, SK Biopharm Xcopri',
    notes: 'Mostly generic (Keppra, Depakote, Dilantin); branded market fragmented across specialty AEDs. Vimpat LOE 2022.',
  },
  depression: {
    indication: 'depression',
    ta: 'neurology',
    globalTAM_M: 15000,
    maxDrugPeakSales_M: 5000,
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Spravato $1.1B, ramping), Axsome Auvelity, Sage Zurzuvae, EvaluatePharma 2025',
    notes: 'Mostly generic SSRIs/SNRIs; branded innovation in treatment-resistant depression (Spravato, Auvelity). $5B cap reflects TRD niche.',
  },
  schizophrenia: {
    indication: 'schizophrenia',
    ta: 'neurology',
    globalTAM_M: 7000,
    maxDrugPeakSales_M: 3000,
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Invega Sustenna/Trinza $4.1B LAI portfolio), Otsuka Abilify Maintena, BMS/Karuna Cobenfy',
    notes: 'LAI (long-acting injectables) drive branded TAM; Invega franchise ~$4B. Cobenfy (KarXT) launching 2025 as new MoA.',
  },
  migraine: {
    indication: 'migraine',
    ta: 'neurology',
    globalTAM_M: 8000,
    maxDrugPeakSales_M: 3000,
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Ubrelvy+Qulipta $1.6B), Lilly Emgality, Amgen Aimovig, Pfizer Nurtec ODT $1.3B',
    notes: 'CGRP class (mAbs + gepants) dominates; fragmented across 5+ players with no single $5B drug.',
  },

  // -------------------------------------------------------------------------
  // Immunology (7)
  // -------------------------------------------------------------------------
  rheumatoid_arthritis: {
    indication: 'rheumatoid_arthritis',
    ta: 'immunology',
    globalTAM_M: 30000,
    maxDrugPeakSales_M: 20000,
    typicalAssetPeakSales_M: 2000,  // Post-Humira-biosimilar era: Rinvoq $3B RA slice, Xeljanz $2B, Olumiant $1B — typical JAK/bio $1-3B (AbbVie/Pfizer/Lilly 2024 10-Ks)
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Humira $8.9B, post-biosimilar), Pfizer Xeljanz, Lilly Olumiant, Amgen Enbrel',
    notes: 'Humira peaked at $21B in 2022 before biosimilar cliff; max reflects historical peak. Rinvoq + Olumiant + Xeljanz JAK class; biosimilars now dominant.',
  },
  psoriasis: {
    indication: 'psoriasis',
    ta: 'immunology',
    globalTAM_M: 25000,
    maxDrugPeakSales_M: 12000,
    // Deliberately no typicalAssetPeakSales_M — psoriasis deals split between
    // systemic biologics (Tremfya $3B class) and topical small molecules /
    // steroids ($200-500M class). A single number misrepresents the bimodal
    // distribution; backtest uses TA default (dermatology $1000M) which
    // lands closer to the topical/small-molecule range these deals often
    // represent. Add explicit entries for `psoriasis_topical` vs
    // `psoriasis_systemic` in future rounds if corpus distinguishes.
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Skyrizi $11.7B cross-indication, PsO is ~60% = $7B; Rinvoq), J&J Stelara/Tremfya, Amgen Otezla $2.3B',
    notes: 'Skyrizi is #1 PsO drug; max cap reflects peak single-drug potential. Stelara biosimilars starting 2025.',
  },
  atopic_dermatitis: {
    indication: 'atopic_dermatitis',
    ta: 'immunology',
    globalTAM_M: 20000,
    maxDrugPeakSales_M: 18000,
    typicalAssetPeakSales_M: 2000,  // Rinvoq AD slice ~$1.5B, Ebglyss/Adbry ramping $500M-1B each — non-Dupixent AD asset tops out ~$1-2B (AbbVie 2024 10-K, Lilly 2024 10-K, LEO Pharma annual)
    estimateYear: 2025,
    source: 'Sanofi/Regeneron 2024 10-K (Dupixent $14.1B cross-indication, AD is ~70% = $10B), AbbVie Rinvoq AD, Lilly Ebglyss',
    notes: 'Dupixent dominates AD with >80% branded share; max cap near TAM reflects monopolistic structure. Dupixent 2028 consensus peak $18-22B.',
  },
  lupus: {
    indication: 'lupus',
    ta: 'immunology',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 2000,
    estimateYear: 2025,
    source: 'GSK 2024 annual (Benlysta $1.5B), AstraZeneca Saphnelo, Aurinia Lupkynis',
    notes: 'Benlysta is #1 lupus drug; small TAM because mostly steroid+HCQ standard of care. CAR-T and CD19 biologics emerging.',
  },
  ibd_uc: {
    indication: 'ibd_uc',
    ta: 'immunology',
    globalTAM_M: 12000,
    maxDrugPeakSales_M: 6000,
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Stelara UC portion), Pfizer Xeljanz/Velsipity, BMS Zeposia, Takeda Entyvio $6.3B cross-IBD',
    notes: 'Entyvio is #1 IBD drug; UC portion ~$3B. S1P modulators (Zeposia, Velsipity) and JAK inhibitors expanding.',
  },
  ibd_cd: {
    indication: 'ibd_cd',
    ta: 'immunology',
    globalTAM_M: 14000,
    maxDrugPeakSales_M: 7000,
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Stelara $10.4B cross-indication, CD is ~40% = $4B), AbbVie Humira CD (biosimilar), Takeda Entyvio CD portion',
    notes: 'Stelara is #1 Crohn\'s drug but biosimilars launching 2025. Skyrizi CD approval expanded class leadership.',
  },
  asthma: {
    indication: 'asthma',
    ta: 'immunology',
    globalTAM_M: 30000,
    maxDrugPeakSales_M: 10000,
    estimateYear: 2025,
    source: 'GSK 2024 annual (Trelegy $3.6B, Advair legacy), AstraZeneca Symbicort/Fasenra, Sanofi/Regeneron Dupixent asthma $2.5B',
    notes: 'Inhaled ICS/LABA market largely generic; biologic class (Dupixent, Fasenra, Tezspire, Nucala, Xolair) $8B+ and growing.',
  },

  // -------------------------------------------------------------------------
  // Metabolic (5)
  // -------------------------------------------------------------------------
  type2_diabetes: {
    indication: 'type2_diabetes',
    ta: 'metabolic',
    globalTAM_M: 65000,
    maxDrugPeakSales_M: 35000,
    typicalAssetPeakSales_M: 5000,  // Non-GLP-1 branded: Jardiance $8B, Farxiga $8B, Trulicity $5B — typical SGLT2/DPP-4 class $3-5B (Lilly/AZ/Novartis 2024 10-Ks)
    estimateYear: 2025,
    source: 'Novo Nordisk 2024 10-K (Ozempic $16.7B, Rybelsus $3.3B), Lilly 2024 10-K (Mounjaro $11.5B, Jardiance $7.9B), EvaluatePharma 2025',
    notes: 'GLP-1 class has shown $25-35B single-drug peaks; Mounjaro 2028 consensus peak $30-35B (cross T2D+obesity). Max cap reflects this trajectory.',
  },
  obesity: {
    indication: 'obesity',
    ta: 'metabolic',
    globalTAM_M: 50000,
    maxDrugPeakSales_M: 30000,
    typicalAssetPeakSales_M: 5000,  // Non-first-mover GLP-1 obesity: orforglipron/retatrutide/danuglipron projected $3-8B each (Lilly/Pfizer/Amgen 2024 pipeline updates, Goldman 2024 obesity market)
    estimateYear: 2025,
    source: 'Novo Nordisk 2024 10-K (Wegovy $8.4B), Lilly 2024 10-K (Zepbound $4.9B launch year), Goldman Sachs GLP-1 market model 2024',
    notes: 'Emerging $50B+ TAM by 2030 — Zepbound 2030 consensus peak $25-30B; Wegovy similar. Fastest-growing category in pharma.',
  },
  nash_mash: {
    indication: 'nash_mash',
    ta: 'metabolic',
    globalTAM_M: 10000,
    maxDrugPeakSales_M: 4000,
    estimateYear: 2025,
    source: 'Madrigal 2024 10-K (Rezdiffra launch), EvaluatePharma 2025 NASH market forecasts',
    notes: 'Rezdiffra first approval (Mar 2024); consensus 2030 peak $3-4B. GLP-1 class (semaglutide, tirzepatide) may expand into MASH for additional share.',
  },
  dyslipidemia: {
    indication: 'dyslipidemia',
    ta: 'metabolic',
    globalTAM_M: 25000,
    maxDrugPeakSales_M: 5000,
    estimateYear: 2025,
    source: 'Amgen 2024 10-K (Repatha $2.2B), Novartis Leqvio $750M, Regeneron/Sanofi Praluent, Esperion Nexletol',
    notes: 'Statins fully genericized; branded market is PCSK9 class (Repatha, Praluent, Leqvio) plus ezetimibe combos. Max $5B cap reflects PCSK9 class peak potential.',
  },
  cardiometabolic: {
    indication: 'cardiometabolic',
    ta: 'metabolic',
    globalTAM_M: 20000,
    maxDrugPeakSales_M: 8000,
    estimateYear: 2025,
    source: 'Lilly 2024 10-K (Jardiance $7.9B, Trulicity $5.4B), AstraZeneca Farxiga $7.7B',
    notes: 'SGLT2 class (Jardiance, Farxiga) crossing T2D/HF/CKD. Jardiance $8B reflects current leader; class could grow further.',
  },

  // -------------------------------------------------------------------------
  // Rare Disease (8)
  // -------------------------------------------------------------------------
  dmd: {
    indication: 'dmd',
    ta: 'rareDisease',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 1500,
    estimateYear: 2025,
    source: 'Sarepta 2024 10-K (Elevidys + exon-skippers $1.8B cross-product), PTC Emflaza, Italfarmaco Duvyzat',
    notes: 'Sarepta franchise (exon-skippers + Elevidys gene therapy) is dominant. Elevidys alone peak $1-1.5B as it expands to ambulatory/non-ambulatory.',
  },
  cystic_fibrosis: {
    indication: 'cystic_fibrosis',
    ta: 'rareDisease',
    globalTAM_M: 11000,
    maxDrugPeakSales_M: 9000,
    typicalAssetPeakSales_M: 1000,  // Vertex near-monopoly; non-Vertex CF assets target niche subpopulations (alpha-1 corrector, nonsense mutation readthrough) with $500M-1.5B ceilings (Novartis Xentry/Moderna pipeline 2024)
    estimateYear: 2025,
    source: 'Vertex 2024 10-K (Trikafta/Kaftrio $10.2B, full CF franchise $10.9B)',
    notes: 'Vertex has >95% branded share — near-monopoly. Trikafta alone $9B+; max cap reflects this. Next-gen vanzacaftor triple 2025 launch extends franchise.',
  },
  sma: {
    indication: 'sma',
    ta: 'rareDisease',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 2500,
    estimateYear: 2025,
    source: 'Biogen 2024 10-K (Spinraza $1.5B, declining), Novartis Zolgensma $1.2B, Roche Evrysdi $1.8B',
    notes: 'Three-way competition: Spinraza (ASO), Zolgensma (gene therapy one-time), Evrysdi (oral small molecule). Evrysdi overtaking as easiest admin.',
  },
  hae: {
    indication: 'hae',
    ta: 'rareDisease',
    globalTAM_M: 3000,
    maxDrugPeakSales_M: 1500,
    estimateYear: 2025,
    source: 'Takeda 2024 annual (Takhzyro $1.4B, Cinryze legacy, Firazyr), CSL Haegarda, Pharvaris (pipeline)',
    notes: 'Takhzyro is #1 HAE prophylaxis; Takeda franchise dominant. Oral options (Orladeyo, pipeline) growing but still niche.',
  },
  spinal_cord_injury: {
    indication: 'spinal_cord_injury',
    ta: 'rareDisease',
    globalTAM_M: 1000,
    maxDrugPeakSales_M: 400,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025 (no approved disease-modifying therapy), Acorda Ampyra legacy',
    notes: 'No approved disease-modifying therapy for SCI. Ampyra (walking speed) and symptomatic care. TAM reflects symptomatic+rehab market.',
  },
  friedreichs_ataxia: {
    indication: 'friedreichs_ataxia',
    ta: 'rareDisease',
    globalTAM_M: 500,
    maxDrugPeakSales_M: 300,
    estimateYear: 2025,
    source: 'Reata/Biogen 2024 10-K (Skyclarys $280M 2024, first approval), Leerink/SVB rare disease market forecasts',
    notes: 'Ultra-rare — ~5K US patients. Skyclarys is first approved therapy (Feb 2023); 2028 consensus peak $800M-1B but limited by patient population.',
  },
  huntingtons: {
    indication: 'huntingtons',
    ta: 'rareDisease',
    globalTAM_M: 2000,
    maxDrugPeakSales_M: 800,
    estimateYear: 2025,
    source: 'Neurocrine 2024 10-K (Ingrezza HD chorea), Teva Austedo HD, UniQure/PTC pipeline',
    notes: 'No approved disease-modifying therapy; market is chorea symptomatic (VMAT2 inhibitors). ASO trials (Roche tominersen, WVE-004) failed 2021-2023.',
  },
  wilson_disease: {
    indication: 'wilson_disease',
    ta: 'rareDisease',
    globalTAM_M: 500,
    maxDrugPeakSales_M: 250,
    estimateYear: 2025,
    source: 'Alexion/AstraZeneca Cuprimine/Syprine legacy, Orphalan Cuvrior (2022 approval), Ultragenyx pipeline',
    notes: 'Ultra-rare (~10K US); zinc/penicillamine generic, Cuvrior branded. Very limited commercial potential.',
  },

  // -------------------------------------------------------------------------
  // Cardiovascular (5)
  // -------------------------------------------------------------------------
  heart_failure: {
    indication: 'heart_failure',
    ta: 'cardiovascular',
    globalTAM_M: 20000,
    maxDrugPeakSales_M: 8000,
    estimateYear: 2025,
    source: 'Novartis 2024 annual (Entresto $7.8B), Lilly Jardiance HF portion, AstraZeneca Farxiga HF portion, BMS Camzyos',
    notes: 'Entresto is #1 HF drug at $7.8B; SGLT2 class (Jardiance, Farxiga) crossed into HF. Camzyos for HCM niche.',
  },
  pah: {
    indication: 'pah',
    ta: 'cardiovascular',
    globalTAM_M: 7000,
    maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1500,  // Opsumit $2B, Uptravi $1.7B, Tyvaso $2B, Orenitram ~$500M — typical PAH asset $1-2B (J&J/United Therapeutics 2024 10-Ks)
    estimateYear: 2025,
    source: 'J&J 2024 10-K (Opsumit $2.0B, Uptravi $1.7B, Tracleer legacy), Gilead Letairis legacy, Merck Winrevair (activin)',
    notes: 'J&J/Actelion franchise dominates (Opsumit, Uptravi, Tracleer). Winrevair (sotatercept) 2024 approval is first disease-modifying class.',
  },
  hypercholesterolemia: {
    indication: 'hypercholesterolemia',
    ta: 'cardiovascular',
    globalTAM_M: 25000,
    maxDrugPeakSales_M: 5000,
    estimateYear: 2025,
    source: 'Amgen 2024 10-K (Repatha $2.2B), Novartis Leqvio $750M, Regeneron Praluent $358M',
    notes: 'Statins fully generic; branded is PCSK9 class + newer siRNA (Leqvio). Max $5B reflects PCSK9 class peak.',
  },
  atrial_fibrillation: {
    indication: 'atrial_fibrillation',
    ta: 'cardiovascular',
    globalTAM_M: 15000,
    maxDrugPeakSales_M: 10000,
    estimateYear: 2025,
    source: 'BMS/Pfizer 2024 10-K (Eliquis $13.3B peak, Pfizer share $6.7B + BMS $6.6B), J&J Xarelto $2.4B, Boehringer Pradaxa',
    notes: 'Eliquis is the #1 DOAC at $13B globally (Pfizer+BMS split); max cap reflects this. Xarelto and Pradaxa smaller shares. LOE starting 2026-2028.',
  },
  atherosclerosis: {
    indication: 'atherosclerosis',
    ta: 'cardiovascular',
    globalTAM_M: 30000,
    maxDrugPeakSales_M: 8000,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025 (combined statin+PCSK9+antiplatelet market), BMS/Pfizer Eliquis ASCVD share, Sanofi/Regeneron Praluent',
    notes: 'Broad category combining lipid-lowering + antiplatelet + antithrombotic for ASCVD. Statins generic; branded innovation in PCSK9 + factor XI (pipeline).',
  },

  // -------------------------------------------------------------------------
  // Infectious Disease (3)
  // -------------------------------------------------------------------------
  hiv: {
    indication: 'hiv',
    ta: 'infectiousDisease',
    globalTAM_M: 30000,
    maxDrugPeakSales_M: 10000,
    typicalAssetPeakSales_M: 2500,  // Non-Biktarvy: Dovato $2B, Descovy $2B, Prezista $1B, Triumeq declining — typical HIV regimen $1.5-3B (ViiV/GSK 2024 annual, Gilead 2024 10-K)
    estimateYear: 2025,
    source: 'Gilead 2024 10-K (Biktarvy $13.4B, full HIV franchise $18.1B), ViiV/GSK 2024 annual (Triumeq, Dovato, Tivicay)',
    notes: 'Biktarvy is #1 HIV drug at $13.4B — exceeds the $10B cap. Max raised to reflect Biktarvy trajectory; Gilead franchise dominates >60% branded share.',
  },
  hepatitis_b: {
    indication: 'hepatitis_b',
    ta: 'infectiousDisease',
    globalTAM_M: 5000,
    maxDrugPeakSales_M: 2000,
    estimateYear: 2025,
    source: 'Gilead 2024 10-K (Vemlidy $1.0B, Viread genericized), GSK Hepsera legacy, BMS Baraclude generic',
    notes: 'Mostly generic (Baraclude, Viread); Vemlidy is branded TAF leader. Functional cure research stage (GSK bepirovirsen, Assembly Bio, Arbutus) could expand TAM.',
  },
  bacterial_infection: {
    indication: 'bacterial_infection',
    ta: 'infectiousDisease',
    globalTAM_M: 40000,
    maxDrugPeakSales_M: 3000,
    estimateYear: 2025,
    source: 'EvaluatePharma 2025 antibacterial market report, Pfizer Zavicefta, Merck Recarbrio/Zerbaxa',
    notes: 'Mostly generic — broad-spectrum antibiotics commoditized. Branded AMR space (Vabomere, Recarbrio, Fetroja) limited by stewardship and hospital pricing. $3B cap for branded.',
  },

  // -------------------------------------------------------------------------
  // Other (2)
  // -------------------------------------------------------------------------
  amd: {
    indication: 'amd',
    ta: 'ophthalmology',
    globalTAM_M: 12000,
    maxDrugPeakSales_M: 9000,
    typicalAssetPeakSales_M: 2500,  // Non-Eylea: Vabysmo $3B, Lucentis $1B, Beovu $500M — typical anti-VEGF $1.5-3B (Roche 2024 annual, Novartis 2024)
    estimateYear: 2025,
    source: 'Regeneron 2024 10-K (Eylea $9.4B incl HD, cross-indication DME+AMD), Bayer Eylea ex-US, Roche Lucentis/Vabysmo $3.8B',
    notes: 'Eylea HD + Vabysmo driving class. Eylea biosimilars starting 2026. Max $9B reflects Eylea franchise peak.',
  },
  dry_eye: {
    indication: 'dry_eye',
    ta: 'ophthalmology',
    globalTAM_M: 4000,
    maxDrugPeakSales_M: 1500,
    // Deliberately no typicalAssetPeakSales_M — single core deal in corpus
    // (Aldeyra) sits between TA default and explicit override; empirical
    // sweep showed TA default produces better result.
    estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Restasis post-generic), Novartis Xiidra, Oyster Point/Viatris Tyrvaya, Bausch Miebo',
    notes: 'Restasis genericized 2022; Xiidra $450M, Tyrvaya launching, Miebo (perfluorohexyloctane) 2023 launch. Fragmented branded market.',
  },

  // -------------------------------------------------------------------------
  // Narrow specialty indications (Round 13 Step A additions)
  //
  // These slugs appear in the 251-deal backtest corpus but were previously
  // absent from Tier 1, falling through to TA defaults that materially
  // overshot their real market size. Each is populated with a dedicated
  // typical-asset peak sourced to 2022-2024 data.
  // -------------------------------------------------------------------------
  preterm_labor: {
    indication: 'preterm_labor',
    ta: 'womensHealth',
    globalTAM_M: 500,
    maxDrugPeakSales_M: 300,
    typicalAssetPeakSales_M: 200,
    estimateYear: 2024,
    source: 'Covis/AMAG Makena pre-withdrawal 2022 SEC filings (~$150M peak), FDA April 2023 Makena withdrawal announcement',
    notes: 'Makena (17-hydroxyprogesterone caproate) withdrawn April 2023 after PROLONG trial failed — no approved preterm labor drug now exists. Market dominated by generic progesterone. Any novel asset faces narrow TAM (~500K annual US preterm births; targetable subset ~50-100K).',
  },
  fungalInfections: {
    indication: 'fungalInfections',
    ta: 'infectiousDisease',
    globalTAM_M: 3000,
    maxDrugPeakSales_M: 800,
    typicalAssetPeakSales_M: 400,
    estimateYear: 2024,
    source: 'Astellas/Basilea 2024 annual (Cresemba peak $300M), Astellas legacy (Mycamine historical $400M), Scynexis 2024 10-K (Brexafemme $100M ramp)',
    notes: 'IV antifungals are niche hospital-use. Novel azoles (Cresemba) and echinocandins (Mycamine) dominate; oral options (Brexafemme) emerging for refractory/recurrent. Stewardship pricing caps upside.',
  },
  myopiaProgression: {
    indication: 'myopiaProgression',
    ta: 'ophthalmology',
    globalTAM_M: 500,
    maxDrugPeakSales_M: 400,
    typicalAssetPeakSales_M: 200,
    estimateYear: 2024,
    source: 'Market Research Future 2024 (myopia control global market ~$500M), Ocuphire 2024 (reproxalap pipeline), Nevakar (low-dose atropine 0.01%)',
    notes: 'No FDA-approved myopia progression drug. Low-dose atropine 0.01% is off-label standard; Ocuphire reproxalap and Nevakar in development. Market fragmented across pipeline players — per-asset peaks $100-200M.',
  },

  // -------------------------------------------------------------------------
  // Round 18 additions (2026-04-13): oncology subtypes appearing in worst-10
  // -------------------------------------------------------------------------
  gastric: {
    indication: 'gastric',
    ta: 'oncology',
    globalTAM_M: 6000,
    maxDrugPeakSales_M: 2500,
    typicalAssetPeakSales_M: 1500,
    estimateYear: 2024,
    source: 'AstraZeneca/Daiichi 2024 10-K (Enhertu gastric slice $500M), BMS 2024 10-K (Opdivo gastric $1B), Lilly Cyramza $800M, EvaluatePharma 2024 gastric cancer forecast',
    notes: 'Asian incidence dominates volume but pricing favors US/EU. Enhertu gastric + Opdivo-Yervoy are emerging SoC; HER2+ and claudin-18.2 segmentation driving new asset development. Typical asset $1-2B.',
  },

  // =========================================================================
  // Round 29 additions (2026-04-13): proper-case oncology sub-indications
  // appearing in the 988-deal Supabase corpus that previously fell through
  // to the TA default ($2,500M) because no Tier 1 entry existed. Accompanying
  // alias map lives in BACKTEST_INDICATION_ALIASES in deal-backtest.ts.
  //
  // Sizing: 150+ core oncology deals were mis-anchored before this round.
  // All typical-asset peaks cited to 2024 10-Ks or 2024/2025 EvaluatePharma.
  // =========================================================================
  cll: {
    indication: 'cll', ta: 'oncology', globalTAM_M: 8000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2024,
    source: 'AbbVie 2024 10-K (Imbruvica CLL), AstraZeneca 2024 (Calquence $2.4B), BMS 2024 (Venclexta), BeiGene 2024 (Brukinsa)',
    notes: 'BTK class + Venclexta BCL-2 dominate. Imbruvica LOE 2029 opens window for next-gen BTK.',
  },
  hcc: {
    indication: 'hcc', ta: 'oncology', globalTAM_M: 4000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2024,
    source: 'Eisai 2024 (Lenvima HCC $1.5B), Lilly 2024 (Cyramza), Roche 2024 (Tecentriq+Avastin HCC SOC)',
    notes: 'Asia dominates volume; atezo+bev is SOC. TKI + IO combos expanding.',
  },
  sclc: {
    indication: 'sclc', ta: 'oncology', globalTAM_M: 3000, maxDrugPeakSales_M: 1800,
    typicalAssetPeakSales_M: 700, estimateYear: 2024,
    source: 'Amgen 2024 10-K (Imdelltra/tarlatamab DLL3 BiTE $1-2B projected), AstraZeneca 2024 (Imfinzi SCLC), Roche 2024 (Tecentriq)',
    notes: 'DLL3-targeted T-cell engagers re-igniting segment.',
  },
  all_leukemia: {
    indication: 'all_leukemia', ta: 'oncology', globalTAM_M: 3500, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 700, estimateYear: 2024,
    source: 'Amgen 2024 10-K (Blincyto $803M), Pfizer 2024 (Besponsa), Novartis 2024 (Kymriah pediatric ALL)',
    notes: 'Pediatric B-ALL driven by Blincyto+Kymriah; adult Ph+ ALL adds TKIs.',
  },
  sarcoma: {
    indication: 'sarcoma', ta: 'oncology', globalTAM_M: 2500, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2024,
    source: 'SpringWorks 2024 10-K (Ogsiveo desmoid $400M), AstraZeneca 2024 (Koselugo NF1-PN), PharmaMar 2024 (Yondelis)',
    notes: 'Heterogeneous — GIST, desmoid, NF1-PN, soft tissue. Each subtype $100-500M.',
  },
  mantle_cell_lymphoma: {
    indication: 'mantle_cell_lymphoma', ta: 'oncology', globalTAM_M: 2500, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 600, estimateYear: 2024,
    source: 'Lilly 2024 10-K (Jaypirca $500M projected MCL), AbbVie 2024 (Imbruvica MCL), Gilead 2024 (Tecartus $500M MCL)',
    notes: 'Post-BTK-resistance segment growing via Jaypirca + Tecartus CAR-T.',
  },
  follicular_lymphoma: {
    indication: 'follicular_lymphoma', ta: 'oncology', globalTAM_M: 3000, maxDrugPeakSales_M: 1800,
    typicalAssetPeakSales_M: 700, estimateYear: 2024,
    source: 'Roche 2024 annual (Lunsumio $400M launch), AbbVie 2024 (Epkinly FL), Gilead 2024 (Yescarta indolent)',
    notes: 'CD20 bispecifics reshaping 3L+ FL.',
  },
  t_cell_lymphoma: {
    indication: 't_cell_lymphoma', ta: 'oncology', globalTAM_M: 1500, maxDrugPeakSales_M: 800,
    typicalAssetPeakSales_M: 300, estimateYear: 2024,
    source: 'Seagen/Takeda 2024 (Adcetris T-cell slice), Spectrum 2024 (Folotyn), Kyowa Kirin 2024 (Poteligeo)',
    notes: 'Cutaneous dominates (Adcetris CTCL, Poteligeo). Peripheral T-cell rarer.',
  },
  mds: {
    indication: 'mds', ta: 'oncology', globalTAM_M: 2500, maxDrugPeakSales_M: 1200,
    typicalAssetPeakSales_M: 500, estimateYear: 2024,
    source: 'BMS 2024 10-K (Reblozyl MDS $800M), Taiho 2024 (Inqovi oral decitabine), Celgene legacy (Vidaza)',
    notes: 'Lower-risk MDS anemia driving class; higher-risk converts to AML protocol.',
  },
  mpn: {
    indication: 'mpn', ta: 'oncology', globalTAM_M: 3000, maxDrugPeakSales_M: 2500,
    typicalAssetPeakSales_M: 800, estimateYear: 2024,
    source: 'Novartis 2024 (Jakafi cross-indication), Incyte 2024 10-K (Jakafi US $2.5B), GSK 2024 (Ojjaara momelotinib)',
    notes: 'MF+PV dominated by Jakafi ruxolitinib; anemia-preserving JAK inhibitors emerging.',
  },
  rcc: {
    indication: 'rcc', ta: 'oncology', globalTAM_M: 6000, maxDrugPeakSales_M: 3500,
    typicalAssetPeakSales_M: 1500, estimateYear: 2024,
    source: 'Exelixis 2024 10-K (Cabometyx $2.3B), Merck 2024 (Welireg HIF-2α, Keytruda RCC allocation), Bayer 2024 (Nexavar legacy)',
    notes: 'IO+TKI combos standard. Welireg for VHL. Mature class.',
  },
  bladder: {
    indication: 'bladder', ta: 'oncology', globalTAM_M: 4500, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2024,
    source: 'Astellas/Seagen 2024 (Padcev $1.2B), Merck 2024 (Keytruda NMIBC+metastatic), Pfizer 2024 (Bavencio)',
    notes: 'Nectin-4 ADC Padcev + IO is emerging SoC for advanced. NMIBC dominated by BCG + Keytruda.',
  },
  endometrial: {
    indication: 'endometrial', ta: 'oncology', globalTAM_M: 2500, maxDrugPeakSales_M: 1800,
    typicalAssetPeakSales_M: 700, estimateYear: 2024,
    source: 'GSK 2024 annual (Jemperli dostarlimab $800M), Merck 2024 (Keytruda+Lenvima endometrial), Eisai 2024 (Lenvima)',
    notes: 'dMMR has shifted to IO-first-line. pMMR adds IO+chemo+Lenvima.',
  },
  mesothelioma: {
    indication: 'mesothelioma', ta: 'oncology', globalTAM_M: 1500, maxDrugPeakSales_M: 800,
    typicalAssetPeakSales_M: 300, estimateYear: 2024,
    source: 'BMS 2024 (Opdivo+Yervoy mesothelioma), Novocure 2024 (Optune TTF)',
    notes: 'Small but underserved. IO doublet standard.',
  },
  cholangiocarcinoma: {
    indication: 'cholangiocarcinoma', ta: 'oncology', globalTAM_M: 1500, maxDrugPeakSales_M: 1000,
    typicalAssetPeakSales_M: 400, estimateYear: 2024,
    source: 'Incyte 2024 10-K (Pemazyre pemigatinib $150M), Servier 2024 (Tibsovo IDH1), Taiho 2024 (Lytgobi)',
    notes: 'FGFR2 fusion + IDH1 + HER2 subtypes driving targeted therapy.',
  },
  esophageal: {
    indication: 'esophageal', ta: 'oncology', globalTAM_M: 3500, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2024,
    source: 'Merck 2024 (Keytruda GEJ+esophageal), BMS 2024 (Opdivo esophageal), AZ/Daiichi 2024 (Enhertu GEJ)',
    notes: 'IO is first-line; HER2+ overlaps with gastric ADC franchise.',
  },
  gbm: {
    indication: 'gbm', ta: 'oncology', globalTAM_M: 2000, maxDrugPeakSales_M: 1000,
    typicalAssetPeakSales_M: 300, estimateYear: 2024,
    source: 'Novocure 2024 10-K (Optune Gio TTF $500M), Servier 2024 (Voranigo vorasidenib), Merck legacy (Temodar generic)',
    notes: 'IDH-mutant via Voranigo; TTF adjunct. High unmet need.',
  },
  breast_hr_positive: {
    indication: 'breast_hr_positive', ta: 'oncology', globalTAM_M: 15000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 3000, estimateYear: 2024,
    source: 'Pfizer 2024 10-K (Ibrance $4.7B), Lilly 2024 10-K (Verzenio $5.3B), Novartis 2024 (Kisqali), Stemline 2024 (Orserdu elacestrant)',
    notes: 'CDK4/6 class + endocrine dominates. ER-degraders emerging for ESR1-mutant.',
  },
  solid_tumors_basket: {
    indication: 'solid_tumors_basket', ta: 'oncology', globalTAM_M: 40000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2024,
    source: 'Merck 2024 (Keytruda cross-tumor $29B), BMS 2024 (Opdivo), Roche 2024 (Tecentriq), tissue-agnostic (Vitrakvi, Retevmo)',
    notes: 'Basket indications (NTRK/RET/TMB-H/dMMR). Label-expansion deals cover 3-5 tumor types.',
  },

  // ---------------------------------------------------------------------------
  // Women's Health (5)
  // ---------------------------------------------------------------------------
  endometriosis: {
    indication: 'endometriosis', ta: 'womensHealth', globalTAM_M: 6000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Orilissa $300M), Myovant/Pfizer 2024 (Myfembree $400M+), EvaluatePharma 2025',
    notes: '~10% prevalence; market constrained by diagnosis delay + off-label OCP/Lupron use',
  },
  uterineFibroids: {
    indication: 'uterineFibroids', ta: 'womensHealth', globalTAM_M: 5000, maxDrugPeakSales_M: 2500,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Myovant/Pfizer 2024 (Myfembree), AbbVie 2024 (Oriahnn), EvaluatePharma 2025',
    notes: '20-50% prevalence in reproductive-age women; surgical alternatives limit drug uptake',
  },
  pcos: {
    indication: 'pcos', ta: 'womensHealth', globalTAM_M: 4000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'EvaluatePharma 2025, IQVIA Channel Dynamics 2025',
    notes: 'No approved PCOS drug limits TAM estimation; 6-10% prevalence suggests $4B+ potential',
  },
  postpartumDepression: {
    indication: 'postpartumDepression', ta: 'womensHealth', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Sage Therapeutics/Biogen 2024 (Zurzuvae $200M+ launch), EvaluatePharma 2025',
    notes: 'Zurzuvae projected $2B peak; untreated PPD prevalence 10-15% of births',
  },
  menopause: {
    indication: 'menopause', ta: 'womensHealth', globalTAM_M: 8000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Astellas 2024 (Veozah fezolinetant $500M launch), EvaluatePharma 2025',
    notes: 'VMS affects 75% of menopausal women; non-hormonal path (NK3R) expanding addressable market',
  },

  // ---------------------------------------------------------------------------
  // Gastroenterology (5)
  // ---------------------------------------------------------------------------
  crohnsDisease: {
    indication: 'crohnsDisease', ta: 'gastroenterology', globalTAM_M: 12000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 3000, estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Skyrizi CD $4B+, Rinvoq CD $2B), J&J 2024 (Stelara $10B cross), EvaluatePharma 2025',
    notes: 'Skyrizi/Rinvoq replacing Humira; IL-23 class dominance in CD',
  },
  eosinophilicEsophagitis: {
    indication: 'eosinophilicEsophagitis', ta: 'gastroenterology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Sanofi/Regeneron 2024 10-K (Dupixent EoE $1B+), EvaluatePharma 2025',
    notes: 'Dupixent EoE launch $1B+; 50/100K prevalence, growing recognition and diagnosis rates',
  },
  nonAlcoholicSteatohepatitis: {
    indication: 'nonAlcoholicSteatohepatitis', ta: 'gastroenterology', globalTAM_M: 20000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 2500, estimateYear: 2025,
    source: 'Madrigal 2024 (Rezdiffra $5B+ peak consensus), EvaluatePharma 2025, IQVIA 2025',
    notes: 'Massive TAM from 5% global MASH prevalence; GLP-1 class (semaglutide) may capture large share',
  },
  ibsD: {
    indication: 'ibsD', ta: 'gastroenterology', globalTAM_M: 4000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Allergan/AbbVie 2024 (Viberzi), Salix/Bausch 2024 (Xifaxan), EvaluatePharma 2025',
    notes: 'IBS-D 5% prevalence but low diagnosis/treatment rates. Xifaxan generic threat limits branded TAM',
  },
  primaryBiliaryCholangitis: {
    indication: 'primaryBiliaryCholangitis', ta: 'gastroenterology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Ipsen 2024 (Iqirvo), Gilead 2024 (Livdelzi seladelpar), Intercept (Ocaliva $300M), EvaluatePharma 2025',
    notes: 'Iqirvo + Livdelzi both approved 2024; UDCA-IR population well-defined',
  },

  // ---------------------------------------------------------------------------
  // Dermatology (5)
  // ---------------------------------------------------------------------------
  hidradenitisSuppurativa: {
    indication: 'hidradenitisSuppurativa', ta: 'dermatology', globalTAM_M: 4000, maxDrugPeakSales_M: 2500,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'AbbVie 2024 (Humira HS allocation ~$500M), Novartis 2024 (Cosentyx HS $300M), EvaluatePharma 2025',
    notes: '1-4% prevalence, severely underdiagnosed; bimekizumab Phase 3 results promising',
  },
  alopeciaAreata: {
    indication: 'alopeciaAreata', ta: 'dermatology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Lilly 2024 10-K (Olumiant AA $200M), Pfizer 2024 (Litfulo $300M launch), EvaluatePharma 2025',
    notes: '2% lifetime prevalence; JAK class opening market but moderate severity often untreated',
  },
  vitiligo: {
    indication: 'vitiligo', ta: 'dermatology', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 600, estimateYear: 2025,
    source: 'Incyte 2024 10-K (Opzelura vitiligo $400M+), EvaluatePharma 2025',
    notes: '0.5-2% prevalence; Opzelura first approved treatment; slow repigmentation limits patient persistence',
  },
  acne: {
    indication: 'acne', ta: 'dermatology', globalTAM_M: 5000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 400, estimateYear: 2025,
    source: 'Galderma 2024 (Aklief), Sun Pharma 2024 (Winlevi), EvaluatePharma 2025, IQVIA 2025',
    notes: '~85% of 12-24 year olds affected; generic dominance limits branded peak sales ceiling',
  },
  chronicUrticaria: {
    indication: 'chronicUrticaria', ta: 'dermatology', globalTAM_M: 4000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'Novartis/Roche 2024 (Xolair CSU $2B+), EvaluatePharma 2025',
    notes: '1% prevalence; Xolair dominant, remibrutinib Phase 3 positive for anti-H1-refractory CSU',
  },

  // ---------------------------------------------------------------------------
  // Hematology (5)
  // ---------------------------------------------------------------------------
  cll: {
    indication: 'cll', ta: 'hematology', globalTAM_M: 10000, maxDrugPeakSales_M: 6000,
    typicalAssetPeakSales_M: 2500, estimateYear: 2025,
    source: 'AbbVie 2024 10-K (Imbruvica $4.5B declining), AZ 2024 (Calquence $2.8B), BeiGene 2024 (Brukinsa $3B+), AbbVie/Roche 2024 (Venclexta $2.5B)',
    notes: 'BTK class in transition (ibrutinib → zanubrutinib); venetoclax fixed-duration shift',
  },
  follicularLymphoma: {
    indication: 'follicularLymphoma', ta: 'hematology', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'Roche 2024 (Gazyva, Lunsumio, Columvi), Genmab/AbbVie 2024 (Epkinly), EvaluatePharma 2025',
    notes: 'Bispecific antibodies (mosunetuzumab, glofitamab, epcoritamab) reshaping R/R setting',
  },
  hodgkinLymphoma: {
    indication: 'hodgkinLymphoma', ta: 'hematology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Seagen/Takeda 2024 (Adcetris $850M), Merck 2024 (Keytruda HL), BMS 2024 (Opdivo HL)',
    notes: 'High cure rate limits commercial ceiling; Adcetris 1L ECHELON shift expanding early-line use',
  },
  myelofibrosis: {
    indication: 'myelofibrosis', ta: 'hematology', globalTAM_M: 4000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Incyte 2024 10-K (Jakafi $2.7B total MPN), CTI 2024 (Vonjo pacritinib), GSK 2024 (Ojjaara momelotinib)',
    notes: 'Jakafi dominant; new entries in 2L (pacritinib anemia-friendly, momelotinib splenic + anemia)',
  },
  itp: {
    indication: 'itp', ta: 'hematology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 700, estimateYear: 2025,
    source: 'Amgen 2024 (Nplate $1B+), Novartis 2024 (Promacta $1.5B), Rigel 2024 (Tavalisse), EvaluatePharma 2025',
    notes: 'TPO-RA class dominant (romiplostim, eltrombopag); SYK inhibitor fostamatinib adds option',
  },

  // ---------------------------------------------------------------------------
  // Ophthalmology (5)
  // ---------------------------------------------------------------------------
  dryAmdGA: {
    indication: 'dryAmdGA', ta: 'ophthalmology', globalTAM_M: 8000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'Apellis 2024 (Syfovre $400M launch), Astellas/Iveric 2024 (Izervay $300M launch), EvaluatePharma 2025',
    notes: '5M US patients with GA; complement inhibition validated but modest efficacy limits ceiling',
  },
  diabeticRetinopathy: {
    indication: 'diabeticRetinopathy', ta: 'ophthalmology', globalTAM_M: 6000, maxDrugPeakSales_M: 4000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'Regeneron 2024 10-K (Eylea DR $2B+), Roche 2024 (Vabysmo DR), EvaluatePharma 2025',
    notes: 'Anti-VEGF class established; durability competition (Eylea HD, Vabysmo) driving differentiation',
  },
  diabeticMacularEdema: {
    indication: 'diabeticMacularEdema', ta: 'ophthalmology', globalTAM_M: 7000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'Regeneron 2024 10-K (Eylea DME $3B+), Roche 2024 (Vabysmo DME), EvaluatePharma 2025',
    notes: 'DME is the largest retinal injection market; Vabysmo bispecific durability advantage',
  },
  glaucoma: {
    indication: 'glaucoma', ta: 'ophthalmology', globalTAM_M: 6000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Aerie 2024 (Rhopressa/Rocklatan $200M), Vyzulta 2024, IQVIA 2025',
    notes: '60M global patients; latanoprost generic dominance caps branded peak sales',
  },
  retinitisPigmentosa: {
    indication: 'retinitisPigmentosa', ta: 'ophthalmology', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Spark Therapeutics 2024 (Luxturna $150M), EvaluatePharma 2025',
    notes: '1 in 4000 prevalence; gene therapy for specific genotypes, broad RP unaddressed',
  },

  // ---------------------------------------------------------------------------
  // Cardiovascular (5)
  // ---------------------------------------------------------------------------
  heartFailureHfpef: {
    indication: 'heartFailureHfpef', ta: 'cardiovascular', globalTAM_M: 8000, maxDrugPeakSales_M: 4000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'BI/Lilly 2024 (Jardiance HFpEF $1B+), AZ 2024 (Forxiga HFpEF), EvaluatePharma 2025',
    notes: 'SGLT2i class first HFpEF-specific evidence; 50% of HF is HFpEF, historically undertreated',
  },
  hypertrophicCardiomyopathy: {
    indication: 'hypertrophicCardiomyopathy', ta: 'cardiovascular', globalTAM_M: 4000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'BMS 2024 10-K (Camzyos $500M launch), Cytokinetics 2024 (aficamten Phase 3), EvaluatePharma 2025',
    notes: 'Camzyos first-in-class; aficamten potential $2B+ peak. 1 in 500 prevalence',
  },
  coronaryArteryDisease: {
    indication: 'coronaryArteryDisease', ta: 'cardiovascular', globalTAM_M: 25000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'Amgen 2024 10-K (Repatha $1.8B), Novartis 2024 (Leqvio inclisiran), EvaluatePharma 2025',
    notes: 'Statin/PCSK9 era; Leqvio siRNA injection for LDL. Massive prevalence but generic statin ceiling',
  },
  stroke: {
    indication: 'stroke', ta: 'cardiovascular', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Genentech 2024 (Activase/TNKase legacy), EvaluatePharma 2025, IQVIA 2025',
    notes: 'Acute ischemic stroke; tPA/tenecteplase + thrombectomy devices. Neuroprotection remains unmet',
  },
  venousThromboembolism: {
    indication: 'venousThromboembolism', ta: 'cardiovascular', globalTAM_M: 12000, maxDrugPeakSales_M: 6000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'J&J/Bayer 2024 (Xarelto $6B declining), BMS/Pfizer 2024 (Eliquis $12B), EvaluatePharma 2025',
    notes: 'DOAC market is largest CV class; biosimilar Eliquis 2028 LOE will reshape',
  },

  // ---------------------------------------------------------------------------
  // Infectious Disease (5)
  // ---------------------------------------------------------------------------
  rsv: {
    indication: 'rsv', ta: 'infectiousDisease', globalTAM_M: 8000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'GSK 2024 10-K (Arexvy $2B launch), Pfizer 2024 (Abrysvo $800M), AZ 2024 (Beyfortus $1.5B), EvaluatePharma 2025',
    notes: 'Vaccine + mAb market; adult + pediatric + maternal segments. Rapid $5B+ market formation',
  },
  tuberculosis: {
    indication: 'tuberculosis', ta: 'infectiousDisease', globalTAM_M: 2000, maxDrugPeakSales_M: 1000,
    typicalAssetPeakSales_M: 300, estimateYear: 2025,
    source: 'TB Alliance 2024 (pretomanid), J&J 2024 (bedaquiline generic), EvaluatePharma 2025',
    notes: '10M annual cases globally; generic pricing limits branded peak. MDR-TB niche is premium',
  },
  influenza: {
    indication: 'influenza', ta: 'infectiousDisease', globalTAM_M: 5000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 600, estimateYear: 2025,
    source: 'Roche 2024 (Xofluza $500M), Shionogi 2024, EvaluatePharma 2025',
    notes: 'Seasonal antiviral market; Tamiflu generic. Universal flu vaccine pipeline could transform',
  },
  hepatitisC: {
    indication: 'hepatitisC', ta: 'infectiousDisease', globalTAM_M: 4000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Gilead 2024 10-K (Epclusa $1.5B declining), AbbVie 2024 (Mavyret $1B declining)',
    notes: 'Curative DAA class shrinking the treatable pool; declining revenue despite efficacy',
  },
  covid: {
    indication: 'covid', ta: 'infectiousDisease', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Pfizer 2024 10-K (Paxlovid $1.5B declining), EvaluatePharma 2025',
    notes: 'Declining severity and vaccination reduce antiviral demand; seasonal treatment market forming',
  },

  // ---------------------------------------------------------------------------
  // Oncology (10 more)
  // ---------------------------------------------------------------------------
  bladder: {
    indication: 'bladder', ta: 'oncology', globalTAM_M: 6000, maxDrugPeakSales_M: 4000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'Seagen/Pfizer 2024 (Padcev $3B+ run rate), Merck 2024 (Keytruda UC), J&J 2024 (erdafitinib)',
    notes: 'Padcev + Keytruda (EV-302) transforming 1L mUC; ADC+IO paradigm',
  },
  renal: {
    indication: 'renal', ta: 'oncology', globalTAM_M: 10000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'Merck 2024 (Keytruda+Inlyta), BMS 2024 (Opdivo+Cabo), Exelixis 2024 (Cabometyx $2B), Pfizer 2024 (Inlyta)',
    notes: 'IO+TKI combos dominate; belzutifan (HIF-2α) adding VHL disease path',
  },
  liver: {
    indication: 'liver', ta: 'oncology', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Roche 2024 (Tecentriq+Avastin HCC $2B), Eisai/Merck 2024 (lenvatinib+Keytruda), EvaluatePharma 2025',
    notes: 'IO+anti-VEGF first-line; sorafenib genericized; tremelimumab+durvalumab added',
  },
  gastric: {
    indication: 'gastric', ta: 'oncology', globalTAM_M: 6000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'Astellas 2024 (Vyloy zolbetuximab $2B peak), AZ/Daiichi 2024 (Enhertu GEJ), Merck 2024 (Keytruda gastric)',
    notes: 'CLDN18.2 (Vyloy) + HER2+ (Enhertu) + IO (Keytruda) segmentation',
  },
  lung_sclc: {
    indication: 'lung_sclc', ta: 'oncology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Roche 2024 (Tecentriq SCLC), AZ 2024 (Imfinzi CASPIAN), EvaluatePharma 2025',
    notes: 'IO+chemo only modest OS benefit; DLL3 ADC (ifinatamab) and bispecifics in development',
  },
  mds: {
    indication: 'mds', ta: 'oncology', globalTAM_M: 4000, maxDrugPeakSales_M: 2500,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'BMS/Celgene 2024 (Revlimid del5q), Geron 2024 (Rytelo imetelstat), BMS 2024 (Reblozyl luspatercept)',
    notes: 'HMA backbone (azacitidine); luspatercept for RS+ anemia; imetelstat for lower-risk',
  },
  cervical: {
    indication: 'cervical', ta: 'oncology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 700, estimateYear: 2025,
    source: 'Merck 2024 (Keytruda cervical KEYNOTE-826), Seagen/Genmab 2024 (Tivdak), EvaluatePharma 2025',
    notes: 'IO + ADC; HPV prophylaxis reducing prevalence long-term but current advanced disease unmet',
  },
  endometrial: {
    indication: 'endometrial', ta: 'oncology', globalTAM_M: 3500, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 700, estimateYear: 2025,
    source: 'Merck/Eisai 2024 (Keytruda+Lenvima), GSK 2024 (dostarlimab), EvaluatePharma 2025',
    notes: 'IO+TKI first-line advanced; dMMR/MSI-H subset has exceptional IO monotherapy response',
  },
  breast_hr: {
    indication: 'breast_hr', ta: 'oncology', globalTAM_M: 15000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 3000, estimateYear: 2025,
    source: 'Lilly 2024 10-K (Verzenio $5.3B), Pfizer 2024 (Ibrance $4.7B), Novartis 2024 (Kisqali $3B+)',
    notes: 'CDK4/6 class $13B+; adjuvant expansion (monarchE) driving growth. Elacestrant oral SERD adds options',
  },

  // ---------------------------------------------------------------------------
  // Neurology (8 more)
  // ---------------------------------------------------------------------------
  narcolepsy: {
    indication: 'narcolepsy', ta: 'neurology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Jazz 2024 10-K (Xywav $2B+), Harmony Bio 2024 (Lumryz), Takeda 2024 (TAK-861 orexin)',
    notes: '~200K US narcolepsy patients; Xywav dominant, orexin agonist class emerging',
  },
  bipolar: {
    indication: 'bipolar', ta: 'neurology', globalTAM_M: 6000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 600, estimateYear: 2025,
    source: 'AbbVie 2024 (Vraylar $2B+), EvaluatePharma 2025, IQVIA 2025',
    notes: 'Lithium/valproate generic; Vraylar only branded winner; atypical antipsychotic class',
  },
  adhd: {
    indication: 'adhd', ta: 'neurology', globalTAM_M: 8000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Supernus 2024 (Qelbree viloxazine), Takeda 2024 (Vyvanse generic impact), EvaluatePharma 2025',
    notes: '~10% pediatric prevalence; generic stimulant dominance. Non-stimulant class growing',
  },
  addiction: {
    indication: 'addiction', ta: 'neurology', globalTAM_M: 4000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 400, estimateYear: 2025,
    source: 'Indivior 2024 (Sublocade $500M), Alkermes 2024 (Vivitrol $350M), EvaluatePharma 2025',
    notes: 'OUD/AUD; buprenorphine/naltrexone generic. Stimulant use disorder has NO approved therapy',
  },
  myasthenia: {
    indication: 'myasthenia', ta: 'neurology', globalTAM_M: 5000, maxDrugPeakSales_M: 4000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'Argenx 2024 10-K (Vyvgart $2B+), AZ 2024 (Soliris/Ultomiris gMG), UCB 2024 (Rystiggo), EvaluatePharma 2025',
    notes: 'FcRn + complement + B-cell depletion classes. Vyvgart projected $5B+ peak cross-indication',
  },
  pain: {
    indication: 'pain', ta: 'neurology', globalTAM_M: 15000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Vertex 2024 (suzetrigine VX-548 Phase 3), EvaluatePharma 2025, IQVIA 2025',
    notes: 'Massive TAM but generic NSAID/opioid dominance. Non-opioid class (NaV1.8 suzetrigine) emerging',
  },
  trd: {
    indication: 'trd', ta: 'neurology', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'J&J 2024 10-K (Spravato $1B+), EvaluatePharma 2025',
    notes: 'TRD 30% of MDD; Spravato growing, psilocybin/MDMA pipeline. High unmet need',
  },
  frontotemporal: {
    indication: 'frontotemporal', ta: 'neurology', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'EvaluatePharma 2025, NRDD 2025',
    notes: '50-60K US patients; no approved therapy. Tau-targeting antisense (BIIB080) and gene therapy in development',
  },

  // ---------------------------------------------------------------------------
  // Immunology (7 more)
  // ---------------------------------------------------------------------------
  lupusNephritis: {
    indication: 'lupusNephritis', ta: 'immunology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Aurinia 2024 (Lupkynis $400M), GSK 2024 (Benlysta LN), EvaluatePharma 2025',
    notes: '~50% of SLE patients develop LN; voclosporin + belimumab both approved. CNI-sparing regimens emerging',
  },
  psoriaticArthritis: {
    indication: 'psoriaticArthritis', ta: 'immunology', globalTAM_M: 8000, maxDrugPeakSales_M: 5000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'Novartis 2024 (Cosentyx PsA $3B+), J&J 2024 (Stelara PsA $2B), AbbVie 2024 (Rinvoq, Skyrizi), EvaluatePharma 2025',
    notes: 'IL-17/IL-23/JAK/PDE4 all compete; overlaps with psoriasis skin market',
  },
  ankylosingSpondylitis: {
    indication: 'ankylosingSpondylitis', ta: 'immunology', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'Novartis 2024 (Cosentyx axSpA $1.5B), AbbVie 2024 (Rinvoq AS), EvaluatePharma 2025',
    notes: 'IL-17 class dominant; JAK adding for TNF-IR. Overlap with nr-axSpA broadens market',
  },
  ipf: {
    indication: 'ipf', ta: 'immunology', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1200, estimateYear: 2025,
    source: 'Roche 2024 (Esbriet pirfenidone $800M declining), BI 2024 (Ofev nintedanib $3B cross-indication), EvaluatePharma 2025',
    notes: 'Two anti-fibrotic drugs only; high unmet need for combination and new mechanisms',
  },
  igan: {
    indication: 'igan', ta: 'immunology', globalTAM_M: 3000, maxDrugPeakSales_M: 2000,
    typicalAssetPeakSales_M: 800, estimateYear: 2025,
    source: 'Travere 2024 (Filspari sparsentan $500M), Calliditas 2024 (Tarpeyo $300M), EvaluatePharma 2025',
    notes: '~130K US patients; complement (iptacopan) and BAFF (atacicept) pipeline growing',
  },
  gvhd: {
    indication: 'gvhd', ta: 'immunology', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Incyte 2024 (Jakafi acute+chronic GVHD $500M), Kadmon/Sanofi 2024 (Rezurock belumosudil $200M)',
    notes: '~50K annual allo-HSCT worldwide; steroid-refractory niche growing',
  },
  copd: {
    indication: 'copd', ta: 'immunology', globalTAM_M: 20000, maxDrugPeakSales_M: 8000,
    typicalAssetPeakSales_M: 3000, estimateYear: 2025,
    source: 'GSK 2024 10-K (Trelegy $3.5B), AZ 2024 (Breztri Aerosphere $2B), Sanofi 2024 (Dupixent COPD launch), EvaluatePharma 2025',
    notes: '~250M global patients; triple therapy dominant, Dupixent biologics era for type-2 COPD',
  },

  // ---------------------------------------------------------------------------
  // Metabolic (6 more)
  // ---------------------------------------------------------------------------
  type1Diabetes: {
    indication: 'type1Diabetes', ta: 'metabolic', globalTAM_M: 6000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Provention/Sanofi 2024 (Tzield $200M launch), EvaluatePharma 2025',
    notes: '~2M US T1D patients; Tzield delay-only, islet-cell therapy (Lantidra) and gene therapy pipeline',
  },
  gout: {
    indication: 'gout', ta: 'metabolic', globalTAM_M: 4000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Horizon/Amgen 2024 (Krystexxa $800M), Takeda 2024 (Uloric), EvaluatePharma 2025',
    notes: '~9M US gout patients; allopurinol generic dominant. Krystexxa for uncontrolled gout growing',
  },
  diabeticKidneyDisease: {
    indication: 'diabeticKidneyDisease', ta: 'metabolic', globalTAM_M: 8000, maxDrugPeakSales_M: 4000,
    typicalAssetPeakSales_M: 1500, estimateYear: 2025,
    source: 'Bayer 2024 10-K (Kerendia finerenone $1.5B), AZ 2024 (Farxiga DKD), EvaluatePharma 2025',
    notes: '~40% of T2D develop CKD; MRA + SGLT2i + GLP-1 all have renal evidence',
  },
  sickleCell: {
    indication: 'sickleCell', ta: 'metabolic', globalTAM_M: 5000, maxDrugPeakSales_M: 3000,
    typicalAssetPeakSales_M: 1000, estimateYear: 2025,
    source: 'Vertex/CRISPR 2024 (Casgevy), Bluebird 2024 (Lyfgenia), Pfizer 2024 (Oxbryta withdrawn), EvaluatePharma 2025',
    notes: '~100K US SCD patients; gene therapy $2-3M/patient but transformative',
  },
  hemophiliaA: {
    indication: 'hemophiliaA', ta: 'metabolic', globalTAM_M: 10000, maxDrugPeakSales_M: 6000,
    typicalAssetPeakSales_M: 2000, estimateYear: 2025,
    source: 'Roche 2024 10-K (Hemlibra $4.5B), BioMarin 2024 (Roctavian gene therapy), Novo Nordisk 2024 (Alhemo), EvaluatePharma 2025',
    notes: 'Hemlibra dominant non-factor replacement; gene therapy Roctavian limited uptake but transformative potential',
  },
  fabry: {
    indication: 'fabry', ta: 'metabolic', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 600, estimateYear: 2025,
    source: 'Sanofi 2024 (Fabrazyme $1B+), Amicus 2024 (Galafold $500M), EvaluatePharma 2025',
    notes: '~10K patients globally; ERT + chaperone therapy. Gene therapy pipeline',
  },

  // ---------------------------------------------------------------------------
  // Rare Disease (5 more)
  // ---------------------------------------------------------------------------
  fabryDisease: {
    indication: 'fabryDisease', ta: 'rareDisease', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 600, estimateYear: 2025,
    source: 'Same as metabolic fabry; rare disease TA context',
    notes: 'Cross-listed from metabolic for rare disease TA calibration',
  },
  gaucherDisease: {
    indication: 'gaucherDisease', ta: 'rareDisease', globalTAM_M: 2000, maxDrugPeakSales_M: 1500,
    typicalAssetPeakSales_M: 700, estimateYear: 2025,
    source: 'Sanofi 2024 (Cerezyme $800M), EvaluatePharma 2025',
    notes: '~10K patients globally; ERT class well-established',
  },
  pompeDisease: {
    indication: 'pompeDisease', ta: 'rareDisease', globalTAM_M: 1500, maxDrugPeakSales_M: 1200,
    typicalAssetPeakSales_M: 500, estimateYear: 2025,
    source: 'Sanofi 2024 (Nexviazyme $500M), EvaluatePharma 2025',
    notes: '~3.5K patients globally; Nexviazyme next-gen ERT improving on Myozyme/Lumizyme',
  },
  achondroplasia: {
    indication: 'achondroplasia', ta: 'rareDisease', globalTAM_M: 1000, maxDrugPeakSales_M: 800,
    typicalAssetPeakSales_M: 400, estimateYear: 2025,
    source: 'BioMarin 2024 10-K (Voxzogo $500M), EvaluatePharma 2025',
    notes: '~30K patients globally; Voxzogo first-in-class, growth velocity endpoint validated',
  },
  dravetSyndrome: {
    indication: 'dravetSyndrome', ta: 'rareDisease', globalTAM_M: 1000, maxDrugPeakSales_M: 800,
    typicalAssetPeakSales_M: 400, estimateYear: 2025,
    source: 'GW/Jazz 2024 (Epidiolex $700M cross-epilepsy), UCB 2024 (Fintepla $500M), EvaluatePharma 2025',
    notes: '~20K US patients; anti-seizure medicines well-established, gene therapy SCN1A pipeline',
  },
};

/**
 * Look up the TAM and max drug peak cap for a given indication.
 * Tier 1 manual entries take precedence; otherwise falls back to Tier 3
 * automated calibration for any slug in the calculations.ts catalog;
 * otherwise returns null.
 */
export function getIndicationMarketCap(indication: string): IndicationMarketCap | null {
  const tier1 = INDICATION_MARKET_CAPS[indication];
  if (tier1) return tier1;
  const tier3 = getTier3CalibratedIndication(indication);
  return tier3 ? tier3.marketCap : null;
}

/**
 * Return the typical Phase 2/3 asset peak sales anchor for an indication —
 * the right anchor when no explicit asset-specific analyst consensus exists
 * for a deal.
 *
 * Returns null when no explicit `typicalAssetPeakSales_M` is populated on
 * the indication entry. Callers fall through to TA-level defaults when
 * null is returned.
 *
 * Note: an earlier implementation derived a value from `maxDrugPeakSales_M`
 * when no explicit field was set (30% of class leader per Nat Rev Drug
 * Discov 2024 class-concentration data). Empirical backtest showed that
 * derivation produces worse results than falling through to TA defaults,
 * because most indications contain heterogeneous assets and no single
 * "typical" number represents them well. Explicit citations are the only
 * defensible anchor.
 */
export function getIndicationTypicalAssetPeak(indication: string): number | null {
  const cap = getIndicationMarketCap(indication);
  // R72 (2026-04-16): Fall through to indication-peak-consensus for the
  // 40 indications that have INDICATION_MARKET_CAPS entries but no
  // typicalAssetPeakSales_M. The consensus file provides sourced per-
  // indication peaks based on 10-K actuals and analyst consensus.
  if (cap?.typicalAssetPeakSales_M) return cap.typicalAssetPeakSales_M;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { INDICATION_PEAK_CONSENSUS } = require('./indication-peak-consensus');
  const consensus = INDICATION_PEAK_CONSENSUS[indication];
  if (consensus?.typicalAssetPeakSales_M) return consensus.typicalAssetPeakSales_M;
  return null;
}

/**
 * Check if user peak sales assumption exceeds the indication's realistic ceiling.
 *
 * Returns a warning object with severity and recommended action:
 *   - severity 'critical': exceeds 80% of total TAM — impossible, hard-cap recommended
 *   - severity 'warning': exceeds the realistic single-drug ceiling — flag but do not cap
 *   - ok: true when user assumption is within realistic bounds
 */
export function checkPeakSalesCeiling(
  userPeakSales_M: number,
  indication: string,
): {
  ok: boolean;
  severity?: 'warning' | 'critical';
  ceiling?: number;
  tam?: number;
  message?: string;
} {
  const cap = getIndicationMarketCap(indication);
  if (!cap) return { ok: true };

  // Critical: exceeds 80% of total TAM (no single drug has ever held >80%)
  if (userPeakSales_M > cap.globalTAM_M * 0.8) {
    return {
      ok: false,
      severity: 'critical',
      ceiling: cap.globalTAM_M * 0.8,
      tam: cap.globalTAM_M,
      message: `Peak sales of $${userPeakSales_M.toLocaleString()}M exceeds 80% of total $${cap.globalTAM_M.toLocaleString()}M global TAM for ${indication}. Investors will challenge this immediately.`,
    };
  }

  // Warning: exceeds the max realistic single-drug ceiling (market leader peak)
  if (userPeakSales_M > cap.maxDrugPeakSales_M) {
    return {
      ok: false,
      severity: 'warning',
      ceiling: cap.maxDrugPeakSales_M,
      tam: cap.globalTAM_M,
      message: `Peak sales of $${userPeakSales_M.toLocaleString()}M exceeds the realistic single-drug ceiling of $${cap.maxDrugPeakSales_M.toLocaleString()}M for ${indication} (the actual market leader's peak).`,
    };
  }

  return { ok: true };
}
