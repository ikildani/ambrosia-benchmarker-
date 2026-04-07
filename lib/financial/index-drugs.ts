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
    peakSalesM: 25000,
    peakSalesYear: 2025,
    currentSalesM: 25000,
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
    peakSalesM: 18000,
    peakSalesYear: 2028,
    currentSalesM: 13500,
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
];

// ---------------------------------------------------------------------------
// Metabolic
// ---------------------------------------------------------------------------

const METABOLIC_INDEX: IndexDrug[] = [
  {
    name: 'Ozempic/Wegovy (semaglutide)',
    company: 'Novo Nordisk',
    modality: 'glp1Agonist',
    peakSalesM: 35000,
    peakSalesYear: 2028,
    currentSalesM: 28000,
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
    peakSalesM: 25000,
    peakSalesYear: 2029,
    currentSalesM: 16000,
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
];

/**
 * Find the best matching index drug for a given indication and therapeutic area.
 * Returns the top drug by peak sales in the matching TA, or the closest indication match.
 */
export function findIndexDrug(
  therapeuticArea: string,
  indication?: string,
  modality?: string,
): IndexDrug | null {
  // First try exact indication match
  if (indication) {
    const indicationMatch = INDEX_DRUG_DATABASE.find(
      d => d.indication === indication && d.therapeuticArea === therapeuticArea
    );
    if (indicationMatch) return indicationMatch;
  }

  // Then try modality match within TA
  if (modality) {
    const modalityMatch = INDEX_DRUG_DATABASE.find(
      d => d.modality === modality && d.therapeuticArea === therapeuticArea
    );
    if (modalityMatch) return modalityMatch;
  }

  // Fall back to top drug in TA by peak sales
  const taMatches = INDEX_DRUG_DATABASE
    .filter(d => d.therapeuticArea === therapeuticArea)
    .sort((a, b) => b.peakSalesM - a.peakSalesM);

  return taMatches[0] || null;
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
  const indexDrug = findIndexDrug(therapeuticArea, indication, modality);

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
