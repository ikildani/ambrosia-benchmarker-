// Comparable deal references for PDF/Excel reports
// Data sourced from publicly disclosed deal terms (2023-2025)

export interface ComparableDeal {
  licensor: string;
  licensee: string;
  value: string;
  year: number;
  relevance: string;
  modalities?: string[];
  indications?: string[];
  therapeuticArea: 'oncology' | 'neurology' | 'immunology' | 'metabolic' | 'both';
}

const COMPARABLE_DEALS: ComparableDeal[] = [
  // Oncology
  { licensor: 'Seagen', licensee: 'Pfizer', value: '$43B', year: 2023, relevance: 'ADC platform acquisition', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'RayzeBio', licensee: 'BMS', value: '$4.1B', year: 2024, relevance: 'Radiopharmaceutical acquisition', modalities: ['radiopharm'], therapeuticArea: 'oncology' },
  { licensor: 'Point Biopharma', licensee: 'Eli Lilly', value: '$4.9B', year: 2023, relevance: 'Radiopharmaceutical platform', modalities: ['radiopharm'], therapeuticArea: 'oncology' },
  { licensor: 'Daiichi Sankyo', licensee: 'Merck', value: '$22B', year: 2023, relevance: 'ADC co-development (3 assets)', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'Mirati Therapeutics', licensee: 'BMS', value: '$4.8B', year: 2024, relevance: 'Small molecule (KRAS)', modalities: ['smallMolecule'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  // Neurology
  { licensor: 'Karuna Therapeutics', licensee: 'BMS', value: '$14B', year: 2024, relevance: 'Schizophrenia (KarXT/Cobenfy)', modalities: ['smallMolecule'], indications: ['schizophrenia'], therapeuticArea: 'neurology' },
  { licensor: 'Cerevel Therapeutics', licensee: 'AbbVie', value: '$8.7B', year: 2024, relevance: 'CNS pipeline acquisition', indications: ['schizophrenia', 'parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'JCR Pharmaceuticals', licensee: 'AstraZeneca', value: '$825M', year: 2024, relevance: 'BBB delivery platform', modalities: ['bbbPlatform'], therapeuticArea: 'neurology' },
  { licensor: 'ABL Bio', licensee: 'GSK', value: '$2.7B', year: 2024, relevance: 'BBB bispecific platform', modalities: ['bbbPlatform', 'bispecific'], therapeuticArea: 'neurology' },
  { licensor: 'Gilgamesh', licensee: 'AbbVie', value: '$1.2B', year: 2024, relevance: 'Neuroplastogen (Phase 2)', modalities: ['psychedelic'], indications: ['depression'], therapeuticArea: 'neurology' },
  { licensor: 'PTC Therapeutics', licensee: 'Novartis', value: '$1B upfront', year: 2024, relevance: "Huntington's gene therapy", modalities: ['geneTherapy'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Ionis/Biogen', licensee: 'N/A', value: '$1.8B+ revenue', year: 2024, relevance: 'ASO in rare neuro (tofersen/SOD1 ALS)', modalities: ['aso'], indications: ['als'], therapeuticArea: 'neurology' },
  // Immunology / Autoimmune
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', year: 2023, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'immunology' },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', year: 2024, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'Arena Pharmaceuticals', licensee: 'Pfizer', value: '$6.7B', year: 2022, relevance: 'S1P modulator (UC)', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'immunology' },
  { licensor: 'Momenta Pharmaceuticals', licensee: 'J&J', value: '$6.5B', year: 2020, relevance: 'FcRn antagonist (MG, HDFN)', modalities: ['fcrnAntagonist'], indications: ['myastheniaGravis'], therapeuticArea: 'immunology' },
  { licensor: 'Alpine Immune Sciences', licensee: 'Vertex', value: '$4.9B', year: 2024, relevance: 'BAFF/APRIL dual antagonist (IgAN)', modalities: ['dualAntagonist'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Galapagos', licensee: 'Gilead', value: '$5.1B', year: 2019, relevance: 'JAK1 inhibitor (RA, IBD)', modalities: ['jakInhibitor'], indications: ['rheumatoidArthritis'], therapeuticArea: 'immunology' },
  { licensor: 'Morphic Therapeutic', licensee: 'Eli Lilly', value: '$3.2B', year: 2024, relevance: 'Oral integrin inhibitor (IBD)', modalities: ['oralIntegrin'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'ChemoCentryx', licensee: 'Amgen', value: '$3.7B', year: 2022, relevance: 'C5aR inhibitor (vasculitis)', modalities: ['complementInhibitor'], indications: ['aancaVasculitis'], therapeuticArea: 'immunology' },
  { licensor: 'Capstan Therapeutics', licensee: 'AbbVie', value: '$2.1B', year: 2025, relevance: 'In vivo CAR-T (autoimmune)', modalities: ['inVivoCarT'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Dren Bio', licensee: 'Sanofi', value: '$1.9B', year: 2024, relevance: 'Bispecific myeloid engager (lupus)', modalities: ['bispecific'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Ventyx Biosciences', licensee: 'Eli Lilly', value: '$1.2B', year: 2024, relevance: 'TYK2+S1P dual (Crohn\'s, psoriasis)', modalities: ['jakInhibitor', 's1pModulator'], indications: ['crohns', 'psoriasis'], therapeuticArea: 'immunology' },
  { licensor: 'HI-Bio', licensee: 'Biogen', value: '$1.8B', year: 2024, relevance: 'Anti-CD38 (IgAN, AMR)', modalities: ['mab'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Harbour BioMed', licensee: 'AstraZeneca', value: '$4.575B', year: 2024, relevance: 'Bispecific platform (autoimmune)', modalities: ['bispecific'], therapeuticArea: 'immunology' },
  { licensor: 'Earendil Labs', licensee: 'Sanofi', value: '$2.56B', year: 2025, relevance: 'AI-designed bispecifics (IBD)', modalities: ['bispecific'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
  { licensor: 'RemeGen', licensee: 'Vor Bio', value: '$4B+', year: 2024, relevance: 'BAFF/APRIL (MG, SLE, RA)', modalities: ['dualAntagonist'], indications: ['myastheniaGravis', 'sle_lupus'], therapeuticArea: 'immunology' },
  // Metabolic / Obesity
  { licensor: 'Carmot Therapeutics', licensee: 'Roche', value: '$2.7B', year: 2023, relevance: 'GLP-1R/GCGR/FGF21 obesity pipeline acquisition', modalities: ['glp1Agonist', 'tripleIncretin'], indications: ['obesity', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Inversago Pharma', licensee: 'Novo Nordisk', value: '$1.075B', year: 2023, relevance: 'CB1 inverse agonist for obesity', modalities: ['smallMolecule'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Scholar Rock', licensee: 'Eli Lilly', value: '$1.3B', year: 2024, relevance: 'Anti-activin muscle-sparing obesity apamistamab', modalities: ['antiActivin'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Akero Therapeutics', licensee: 'Novo Nordisk', value: '$1.4B', year: 2024, relevance: 'FGF21 analog efruxifermin for MASH', modalities: ['peptide'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Terns Pharmaceuticals', licensee: 'Roche', value: '$2.1B', year: 2024, relevance: 'GLP-1R agonist for obesity and MASH', modalities: ['glp1Agonist'], indications: ['obesity', 'nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Zealand Pharma', licensee: 'Roche', value: '$5.3B', year: 2025, relevance: 'Amylin analog petrelintide for obesity partnership', modalities: ['amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Metsera', licensee: 'Pfizer', value: '$9.8B', year: 2025, relevance: 'Oral GLP-1 obesity pipeline acquisition', modalities: ['oralPeptide'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'CSPC Pharmaceutical', licensee: 'AstraZeneca', value: '$18.5B', year: 2025, relevance: 'Largest metabolic licensing deal - oral GLP-1/GIP dual agonist', modalities: ['dualIncretin', 'oralPeptide'], indications: ['obesity', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Madrigal Pharmaceuticals', licensee: 'N/A (standalone)', value: '$7B+ market cap', year: 2024, relevance: 'First approved MASH drug (resmetirom/Rezdiffra)', modalities: ['smallMolecule'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Gubra', licensee: 'AbbVie', value: '$2.2B', year: 2025, relevance: 'GLP-1/amylin dual agonist for obesity', modalities: ['dualIncretin', 'amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
];

// Extended interface for web UI component
export interface ComparableDealForUI {
  id: string;
  parties: string;
  totalValue: string;
  upfront?: string;
  year: number;
  phase?: string;
  relevanceReasons: string[];
}

// Find comparable deals scored by relevance to current inputs (for web UI)
export function findComparableDeals(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string },
  maxDeals: number = 5
): ComparableDealForUI[] {
  const scored = COMPARABLE_DEALS.map((deal, idx) => {
    let score = 0;
    const reasons: string[] = [];

    if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
      score += 3;
      reasons.push(`Same therapeutic area`);
    }
    if (inputs.modality && deal.modalities?.includes(inputs.modality)) {
      score += 4;
      reasons.push(`Same modality`);
    }
    if (inputs.indication && deal.indications?.includes(inputs.indication)) {
      score += 3;
      reasons.push(`Same indication`);
    }

    return {
      deal,
      score,
      reasons,
      id: `deal-${idx}`,
    };
  });

  return scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => ({
      id: s.id,
      parties: `${s.deal.licensor} / ${s.deal.licensee}`,
      totalValue: s.deal.value,
      year: s.deal.year,
      relevanceReasons: s.reasons,
    }));
}

export function getRelevantDeals(
  therapeuticArea: string,
  modality?: string,
  indication?: string,
  maxDeals: number = 4
): ComparableDeal[] {
  const scored = COMPARABLE_DEALS.map(deal => {
    let score = 0;
    if (deal.therapeuticArea === therapeuticArea || deal.therapeuticArea === 'both') score += 1;
    if (modality && deal.modalities?.includes(modality)) score += 3;
    if (indication && deal.indications?.includes(indication)) score += 3;
    return { deal, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => s.deal);
}
