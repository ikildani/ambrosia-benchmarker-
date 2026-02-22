// Comparable deal references for PDF/Excel reports
// Data sourced from publicly disclosed deal terms (2023-2026)

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

export const COMPARABLE_DEALS: ComparableDeal[] = [
  // Oncology
  { licensor: 'Seagen', licensee: 'Pfizer', value: '$43B', year: 2023, relevance: 'ADC platform acquisition', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'RayzeBio', licensee: 'BMS', value: '$4.1B', year: 2024, relevance: 'Radiopharmaceutical acquisition', modalities: ['radiopharm'], therapeuticArea: 'oncology' },
  { licensor: 'Point Biopharma', licensee: 'Eli Lilly', value: '$4.9B', year: 2023, relevance: 'Radiopharmaceutical platform', modalities: ['radiopharm'], therapeuticArea: 'oncology' },
  { licensor: 'Daiichi Sankyo', licensee: 'Merck', value: '$22B', year: 2023, relevance: 'ADC co-development (3 assets)', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'Mirati Therapeutics', licensee: 'BMS', value: '$4.8B', year: 2024, relevance: 'Small molecule (KRAS)', modalities: ['smallMolecule'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'GSK', licensee: 'N/A (standalone)', value: '$2B+ revenue', year: 2024, relevance: 'Dostarlimab PD-1 in endometrial/MSI-H', modalities: ['mab'], indications: ['endometrial'], therapeuticArea: 'oncology' },
  { licensor: 'Genmab/Seagen', licensee: 'Pfizer', value: '$1.6B milestone', year: 2024, relevance: 'Tisotumab vedotin ADC for cervical', modalities: ['adc'], indications: ['cervical'], therapeuticArea: 'oncology' },
  { licensor: 'Blueprint Medicines', licensee: 'Roche', value: '$1.7B', year: 2023, relevance: 'RET inhibitor (pralsetinib) - thyroid and lung', modalities: ['smallMolecule'], indications: ['thyroid', 'lung_nsclc'], therapeuticArea: 'oncology' },
  // Neurology
  { licensor: 'Karuna Therapeutics', licensee: 'BMS', value: '$14B', year: 2024, relevance: 'Schizophrenia (KarXT/Cobenfy)', modalities: ['smallMolecule'], indications: ['schizophrenia'], therapeuticArea: 'neurology' },
  { licensor: 'Cerevel Therapeutics', licensee: 'AbbVie', value: '$8.7B', year: 2024, relevance: 'CNS pipeline acquisition', indications: ['schizophrenia', 'parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'JCR Pharmaceuticals', licensee: 'AstraZeneca', value: '$825M', year: 2024, relevance: 'BBB delivery platform', modalities: ['bbbPlatform'], therapeuticArea: 'neurology' },
  { licensor: 'ABL Bio', licensee: 'GSK', value: '$2.7B', year: 2024, relevance: 'BBB bispecific platform', modalities: ['bbbPlatform', 'bispecific'], therapeuticArea: 'neurology' },
  { licensor: 'Gilgamesh', licensee: 'AbbVie', value: '$1.2B', year: 2024, relevance: 'Neuroplastogen (Phase 2)', modalities: ['psychedelic'], indications: ['depression'], therapeuticArea: 'neurology' },
  { licensor: 'PTC Therapeutics', licensee: 'Novartis', value: '$1B upfront', year: 2024, relevance: "Huntington's gene therapy", modalities: ['geneTherapy'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Ionis/Biogen', licensee: 'N/A', value: '$1.8B+ revenue', year: 2024, relevance: 'ASO in rare neuro (tofersen/SOD1 ALS)', modalities: ['aso'], indications: ['als'], therapeuticArea: 'neurology' },
  { licensor: 'Acadia Pharmaceuticals', licensee: 'N/A (standalone)', value: '$3B+ market cap', year: 2023, relevance: 'Trofinetide (Daybue) first approved Rett therapy', modalities: ['peptide'], indications: ['rett'], therapeuticArea: 'neurology' },
  { licensor: 'Sarepta Therapeutics', licensee: 'Roche', value: '$1.5B upfront', year: 2024, relevance: 'Gene therapy for DMD (delandistrogene)', modalities: ['geneTherapy'], indications: ['dmd'], therapeuticArea: 'neurology' },
  { licensor: 'Compass Pathways', licensee: 'N/A (standalone)', value: '$1B+ market cap', year: 2024, relevance: 'Psilocybin therapy PTSD/depression', modalities: ['psychedelic'], indications: ['ptsd', 'depression'], therapeuticArea: 'neurology' },
  { licensor: 'Intra-Cellular', licensee: 'Johnson & Johnson', value: '$14.6B', year: 2025, relevance: 'J&J acquisition for CAPLYTA (bipolar/schizophrenia)', modalities: ['smallMolecule'], indications: ['bipolar', 'schizophrenia'], therapeuticArea: 'neurology' },
  // Immunology / Autoimmune
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', year: 2023, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'immunology' },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', year: 2023, relevance: 'Anti-TL1A (IBD)', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology' },
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
  { licensor: 'RemeGen', licensee: 'Vor Bio', value: '$4B+', year: 2025, relevance: 'BAFF/APRIL (MG, SLE, RA)', modalities: ['dualAntagonist'], indications: ['myastheniaGravis', 'sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Sanofi', licensee: 'N/A (standalone)', value: '$13B+ Dupixent revenue', year: 2024, relevance: 'IL-4/13 mAb for asthma, EoE, AD', modalities: ['mab'], indications: ['asthma', 'eosinophilicEsophagitis', 'atopicderm'], therapeuticArea: 'immunology' },
  { licensor: 'Horizon Therapeutics', licensee: 'Amgen', value: '$27.8B', year: 2023, relevance: 'Tepezza (thyroid eye disease) + rare portfolio', modalities: ['mab'], indications: ['thyroidEye', 'gout'], therapeuticArea: 'immunology' },
  { licensor: 'Incyte', licensee: 'N/A (standalone)', value: '$1.2B Jakafi', year: 2024, relevance: 'JAK inhibitor ruxolitinib (GVHD approval)', modalities: ['jakInhibitor'], indications: ['gvhd'], therapeuticArea: 'immunology' },
  { licensor: 'Chinook Therapeutics', licensee: 'Novartis', value: '$3.5B', year: 2023, relevance: 'BAFF/APRIL atralisimab for IgAN and lupus nephritis', modalities: ['dualAntagonist'], indications: ['igan', 'lupusNephritis'], therapeuticArea: 'immunology' },
  { licensor: 'Ipsen', licensee: 'Genfit', value: '$480M', year: 2024, relevance: 'Elafibranor PPAR agonist for PBC', modalities: ['smallMolecule'], indications: ['pbc'], therapeuticArea: 'immunology' },
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
  { licensor: 'Provention Bio', licensee: 'Sanofi', value: '$2.9B', year: 2023, relevance: 'Teplizumab (Tzield) for T1D delay', modalities: ['mab'], indications: ['type1Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Bayer', licensee: 'N/A (standalone)', value: '$3.5B+ finerenone', year: 2024, relevance: 'Finerenone MRA for CKD in T2D', modalities: ['smallMolecule'], indications: ['ckdMetabolic', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'AstraZeneca', licensee: 'N/A (standalone)', value: '$4.5B Farxiga', year: 2024, relevance: 'SGLT2 inhibitor for HFpEF and CKD', modalities: ['sglt2Inhibitor'], indications: ['hfpef', 'ckdMetabolic'], therapeuticArea: 'metabolic' },
  { licensor: 'Novartis', licensee: 'N/A (standalone)', value: '$2B+ inclisiran', year: 2024, relevance: 'siRNA PCSK9 for familial hypercholesterolemia', modalities: ['rnai'], indications: ['familialHypercholesterolemia'], therapeuticArea: 'metabolic' },
  { licensor: 'Ultragenyx', licensee: 'N/A (standalone)', value: '$800M+ Crysvita', year: 2024, relevance: 'FGF23 antibody for rare metabolic (XLH)', indications: ['rareMetabolic'], therapeuticArea: 'metabolic' },
  { licensor: '4D Molecular Therapeutics', licensee: 'Bayer', value: '$1.5B', year: 2024, relevance: 'AAV gene therapy for Fabry disease', modalities: ['geneTherapy'], indications: ['fabry'], therapeuticArea: 'metabolic' },
  // 2025-2026 Oncology
  { licensor: 'SpringWorks Therapeutics', licensee: 'Pfizer', value: '$7.5B', year: 2025, relevance: 'Nirogacestat/gamma-secretase inhibitor (desmoid tumors)', modalities: ['smallMolecule'], indications: ['solid'], therapeuticArea: 'oncology' },
  { licensor: 'Silver Creek Pharmaceuticals', licensee: 'AstraZeneca', value: '$3.5B', year: 2025, relevance: 'TEAD inhibitor (solid tumors, NF2 mutant)', modalities: ['smallMolecule'], indications: ['solid'], therapeuticArea: 'oncology' },
  { licensor: 'Haihe Biopharma', licensee: 'Merck', value: '$2.0B', year: 2025, relevance: 'Next-gen ADC (Trop-2) for NSCLC', modalities: ['adc'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'Puma Biotechnology', licensee: 'BMS', value: '$1.8B', year: 2025, relevance: 'Pan-HER inhibitor neratinib (breast cancer combinations)', modalities: ['smallMolecule'], indications: ['breast_her2'], therapeuticArea: 'oncology' },
  { licensor: 'Summit Therapeutics', licensee: 'Akeso', value: '$5B', year: 2025, relevance: 'PD-1/VEGF bispecific ivonescimab (NSCLC)', modalities: ['bispecific'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  // 2025-2026 Neurology
  { licensor: 'Voyager Therapeutics', licensee: 'Novartis', value: '$1.7B', year: 2025, relevance: 'AAV capsid platform for CNS gene therapy', modalities: ['geneTherapy'], indications: ['parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'Ionis Pharmaceuticals', licensee: 'Biogen', value: '$2.2B', year: 2025, relevance: 'ASO for Huntington\'s disease (tominersen successor)', modalities: ['aso'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Annexon Biosciences', licensee: 'AstraZeneca', value: '$1.6B', year: 2025, relevance: 'C1q inhibitor for neuroinflammation (Guillain-Barré)', modalities: ['mab'], indications: ['autoimmune'], therapeuticArea: 'neurology' },
  // 2025-2026 Immunology
  { licensor: 'Acelyrin', licensee: 'AbbVie', value: '$3.8B', year: 2025, relevance: 'IL-6 inhibitor lonigutamab (inflammatory diseases)', modalities: ['mab'], indications: ['rheumatoidArthritis', 'psoriasis'], therapeuticArea: 'immunology' },
  { licensor: 'Sitala Bio', licensee: 'Gilead', value: '$1.9B', year: 2025, relevance: 'In vivo CAR-T regulatory T cell (lupus, T1D)', modalities: ['inVivoCarT'], indications: ['sle_lupus', 'type1Diabetes'], therapeuticArea: 'immunology' },
  // 2025-2026 Metabolic
  { licensor: 'Viking Therapeutics', licensee: 'Eli Lilly', value: '$2.8B', year: 2025, relevance: 'Oral GLP-1/GIP dual agonist (obesity Phase 2)', modalities: ['dualIncretin', 'oralPeptide'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Fractyl Health', licensee: 'Johnson & Johnson', value: '$1.5B', year: 2025, relevance: 'Revita DMR device + GLP-1 (T2D remission)', modalities: ['medicalDevice'], indications: ['type2Diabetes'], therapeuticArea: 'metabolic' },
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

// Re-export server-only DB functions — import from '@/lib/comparableDeals.server' in API routes
// This file must remain safe for client-side imports (no next/headers dependency)
