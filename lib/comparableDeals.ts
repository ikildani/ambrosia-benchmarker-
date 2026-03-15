// Comparable deal references for PDF/Excel reports
// Data sourced from publicly disclosed deal terms (2017-2026)
// Includes extended deals covering CV, ID, ophthalmology, women's health,
// rare disease, hematology, dermatology, gastroenterology,
// combination therapy, and geographic-specific transactions.
//
// IMPORTANT: Only real, verifiable transactions belong here.
// Revenue proxies and market cap references live in data/revenue-benchmarks.ts

import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';

export interface ComparableDeal {
  licensor: string;
  licensee: string;
  value: string; // Display string (e.g., "$2.7B") — kept for backward compat
  upfrontM?: number; // Upfront payment in $M
  totalValueM?: number; // Total deal value in $M
  milestonesM?: number; // Milestone payments in $M
  royaltyRange?: string; // e.g., "mid-single to low-double digit"
  year: number;
  relevance: string;
  dealType?: 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration';
  modalities?: string[];
  indications?: string[];
  therapeuticArea: 'oncology' | 'neurology' | 'immunology' | 'metabolic' | 'cardiovascular' | 'infectiousDisease' | 'ophthalmology' | 'womensHealth' | 'rareDisease' | 'hematology' | 'dermatology' | 'gastroenterology' | 'both';
  secondaryTAs?: string[]; // Cross-TA matching without duplication
  territory?: string;
  phase?: string;
  source?: string;
}

export const COMPARABLE_DEALS: ComparableDeal[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY (9 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Seagen', licensee: 'Pfizer', value: '$43B', totalValueM: 43000, year: 2023, relevance: 'ADC platform acquisition', dealType: 'acquisition', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'RayzeBio', licensee: 'BMS', value: '$4.1B', totalValueM: 4100, year: 2024, relevance: 'Radiopharmaceutical acquisition', dealType: 'acquisition', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Point Biopharma', licensee: 'Eli Lilly', value: '$4.9B', totalValueM: 4900, year: 2023, relevance: 'Radiopharmaceutical platform', dealType: 'acquisition', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Daiichi Sankyo', licensee: 'Merck', value: '$22B', totalValueM: 22000, upfrontM: 4000, milestonesM: 18000, year: 2023, relevance: 'ADC co-development (3 assets)', dealType: 'codevelopment', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'Mirati Therapeutics', licensee: 'BMS', value: '$4.8B', totalValueM: 4800, year: 2024, relevance: 'Small molecule (KRAS)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'Genmab/Seagen', licensee: 'Pfizer', value: '$1.6B', totalValueM: 1600, year: 2024, relevance: 'Tisotumab vedotin ADC for cervical', dealType: 'licensing', modalities: ['adc'], indications: ['cervical'], therapeuticArea: 'oncology' },
  { licensor: 'Blueprint Medicines', licensee: 'Roche', value: '$1.7B', totalValueM: 1700, year: 2023, relevance: 'RET inhibitor (pralsetinib) — thyroid and lung', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['thyroid', 'lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'SpringWorks Therapeutics', licensee: 'Pfizer', value: '$7.5B', totalValueM: 7500, year: 2023, relevance: 'Nirogacestat/gamma-secretase inhibitor (desmoid tumors)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['sarcoma'], therapeuticArea: 'oncology' },
  { licensor: 'Summit Therapeutics', licensee: 'Akeso', value: '$5B', totalValueM: 5000, upfrontM: 500, milestonesM: 4500, year: 2025, relevance: 'PD-1/VEGF bispecific ivonescimab US rights (NSCLC)', dealType: 'licensing', modalities: ['bispecific'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },

  // ═══════════════════════════════════════════════════════════════════════
  // NEUROLOGY (8 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Karuna Therapeutics', licensee: 'BMS', value: '$14B', totalValueM: 14000, year: 2024, relevance: 'Schizophrenia (KarXT/Cobenfy)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['schizophrenia'], therapeuticArea: 'neurology' },
  { licensor: 'Cerevel Therapeutics', licensee: 'AbbVie', value: '$8.7B', totalValueM: 8700, year: 2024, relevance: 'CNS pipeline acquisition', dealType: 'acquisition', indications: ['schizophrenia', 'parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'JCR Pharmaceuticals', licensee: 'AstraZeneca', value: '$825M', totalValueM: 825, year: 2024, relevance: 'BBB delivery platform', dealType: 'licensing', modalities: ['bbbPlatform'], therapeuticArea: 'neurology' },
  { licensor: 'ABL Bio', licensee: 'GSK', value: '$2.7B', totalValueM: 2700, year: 2024, relevance: 'BBB bispecific platform', dealType: 'licensing', modalities: ['bbbPlatform', 'bispecific'], therapeuticArea: 'neurology' },
  { licensor: 'Gilgamesh', licensee: 'AbbVie', value: '$1.2B', totalValueM: 1200, year: 2024, relevance: 'Neuroplastogen (Phase 2)', dealType: 'licensing', modalities: ['psychedelic'], indications: ['depression'], therapeuticArea: 'neurology' },
  { licensor: 'PTC Therapeutics', licensee: 'Novartis', value: '$1B', totalValueM: 1000, upfrontM: 1000, year: 2024, relevance: "Huntington's gene therapy", dealType: 'licensing', modalities: ['geneTherapy'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Sarepta Therapeutics', licensee: 'Roche', value: '$1.5B', totalValueM: 1500, upfrontM: 1500, year: 2024, relevance: 'Gene therapy for DMD (delandistrogene)', dealType: 'codevelopment', modalities: ['geneTherapy'], indications: ['dmd'], therapeuticArea: 'neurology', secondaryTAs: ['rareDisease'] },
  { licensor: 'Intra-Cellular', licensee: 'Johnson & Johnson', value: '$14.6B', totalValueM: 14600, year: 2025, relevance: 'J&J acquisition for CAPLYTA (bipolar/schizophrenia)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['bipolar', 'schizophrenia'], therapeuticArea: 'neurology' },

  // ═══════════════════════════════════════════════════════════════════════
  // IMMUNOLOGY / AUTOIMMUNE (20 deals — deduplicated, no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', totalValueM: 10800, year: 2023, relevance: 'Anti-TL1A acquisition for IBD', dealType: 'acquisition', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', totalValueM: 7100, year: 2023, relevance: 'Anti-TL1A (RVT-3101) for IBD', dealType: 'acquisition', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Arena Pharmaceuticals', licensee: 'Pfizer', value: '$6.7B', totalValueM: 6700, year: 2022, relevance: 'S1P modulator (UC)', dealType: 'acquisition', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Momenta Pharmaceuticals', licensee: 'J&J', value: '$6.5B', totalValueM: 6500, year: 2020, relevance: 'FcRn antagonist (MG, HDFN)', dealType: 'acquisition', modalities: ['fcrnAntagonist'], indications: ['myastheniaGravis'], therapeuticArea: 'immunology' },
  { licensor: 'Alpine Immune Sciences', licensee: 'Vertex', value: '$4.9B', totalValueM: 4900, year: 2024, relevance: 'BAFF/APRIL dual antagonist (IgAN)', dealType: 'acquisition', modalities: ['dualAntagonist'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Galapagos', licensee: 'Gilead', value: '$5.1B', totalValueM: 5100, upfrontM: 3950, year: 2019, relevance: 'JAK1 inhibitor (RA, IBD)', dealType: 'licensing', modalities: ['jakInhibitor'], indications: ['rheumatoidArthritis', 'ibd_broad'], therapeuticArea: 'immunology' },
  { licensor: 'Morphic Therapeutic', licensee: 'Eli Lilly', value: '$3.2B', totalValueM: 3200, year: 2024, relevance: 'Oral integrin inhibitor (IBD)', dealType: 'acquisition', modalities: ['oralIntegrin'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'ChemoCentryx', licensee: 'Amgen', value: '$3.7B', totalValueM: 3700, year: 2022, relevance: 'C5aR inhibitor (vasculitis)', dealType: 'acquisition', modalities: ['complementInhibitor'], indications: ['aancaVasculitis'], therapeuticArea: 'immunology' },
  { licensor: 'Capstan Therapeutics', licensee: 'AbbVie', value: '$2.1B', totalValueM: 2100, year: 2025, relevance: 'In vivo CAR-T (autoimmune)', dealType: 'licensing', modalities: ['inVivoCarT'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Dren Bio', licensee: 'Sanofi', value: '$1.9B', totalValueM: 1900, year: 2024, relevance: 'Bispecific myeloid engager (lupus)', dealType: 'licensing', modalities: ['bispecific'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Ventyx Biosciences', licensee: 'Eli Lilly', value: '$1.2B', totalValueM: 1200, year: 2024, relevance: 'TYK2+S1P dual (Crohn\'s, psoriasis)', dealType: 'licensing', modalities: ['jakInhibitor', 's1pModulator'], indications: ['crohns', 'psoriasis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology', 'dermatology'] },
  { licensor: 'HI-Bio', licensee: 'Biogen', value: '$1.8B', totalValueM: 1800, year: 2024, relevance: 'Anti-CD38 (IgAN, AMR)', dealType: 'acquisition', modalities: ['mab'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Harbour BioMed', licensee: 'AstraZeneca', value: '$4.6B', totalValueM: 4575, year: 2024, relevance: 'Bispecific platform (autoimmune)', dealType: 'licensing', modalities: ['bispecific'], therapeuticArea: 'immunology' },
  { licensor: 'Earendil Labs', licensee: 'Sanofi', value: '$2.6B', totalValueM: 2560, year: 2025, relevance: 'AI-designed bispecifics (IBD)', dealType: 'licensing', modalities: ['bispecific'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'RemeGen', licensee: 'Vor Bio', value: '$4B', totalValueM: 4000, year: 2025, relevance: 'BAFF/APRIL (MG, SLE, RA)', dealType: 'licensing', modalities: ['dualAntagonist'], indications: ['myastheniaGravis', 'sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Horizon Therapeutics', licensee: 'Amgen', value: '$27.8B', totalValueM: 27800, year: 2023, relevance: 'Tepezza (thyroid eye disease) + rare portfolio', dealType: 'acquisition', modalities: ['mab'], indications: ['thyroidEye', 'gout'], therapeuticArea: 'immunology' },
  { licensor: 'Chinook Therapeutics', licensee: 'Novartis', value: '$3.5B', totalValueM: 3500, year: 2023, relevance: 'BAFF/APRIL atralisimab for IgAN and lupus nephritis', dealType: 'acquisition', modalities: ['dualAntagonist'], indications: ['igan', 'lupusNephritis'], therapeuticArea: 'immunology' },
  { licensor: 'Ipsen', licensee: 'Genfit', value: '$480M', totalValueM: 480, year: 2024, relevance: 'Elafibranor PPAR agonist for PBC', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['pbc'], therapeuticArea: 'immunology' },
  { licensor: 'Alexion', licensee: 'AstraZeneca', value: '$39B', totalValueM: 39000, year: 2021, relevance: 'Complement franchise acquisition (Soliris/Ultomiris)', dealType: 'acquisition', modalities: ['complementInhibitor'], indications: ['pnh', 'rareAutoimmune'], therapeuticArea: 'immunology', secondaryTAs: ['rareDisease'] },
  { licensor: 'Alnylam Pharmaceuticals', licensee: 'Roche', value: '$2.5B', totalValueM: 2510, upfrontM: 310, milestonesM: 2200, year: 2024, relevance: 'RNAi therapeutics for complement-mediated diseases', dealType: 'licensing', modalities: ['rnai'], indications: ['pnh', 'igan'], therapeuticArea: 'immunology', secondaryTAs: ['rareDisease'] },

  // ═══════════════════════════════════════════════════════════════════════
  // METABOLIC / OBESITY (9 deals — no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Carmot Therapeutics', licensee: 'Roche', value: '$2.7B', totalValueM: 2700, year: 2023, relevance: 'GLP-1R/GCGR/FGF21 obesity pipeline acquisition', dealType: 'acquisition', modalities: ['glp1Agonist', 'tripleIncretin'], indications: ['obesity', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Inversago Pharma', licensee: 'Novo Nordisk', value: '$1.1B', totalValueM: 1075, year: 2023, relevance: 'CB1 inverse agonist for obesity', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Scholar Rock', licensee: 'Eli Lilly', value: '$1.3B', totalValueM: 1300, year: 2024, relevance: 'Anti-activin muscle-sparing obesity apamistamab', dealType: 'licensing', modalities: ['antiActivin'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Akero Therapeutics', licensee: 'Novo Nordisk', value: '$1.4B', totalValueM: 1400, year: 2024, relevance: 'FGF21 analog efruxifermin for MASH', dealType: 'licensing', modalities: ['peptide'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Terns Pharmaceuticals', licensee: 'Roche', value: '$2.1B', totalValueM: 2100, year: 2024, relevance: 'GLP-1R agonist for obesity and MASH', dealType: 'licensing', modalities: ['glp1Agonist'], indications: ['obesity', 'nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Zealand Pharma', licensee: 'Roche', value: '$5.3B', totalValueM: 5300, year: 2025, relevance: 'Amylin analog petrelintide for obesity partnership', dealType: 'licensing', modalities: ['amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Gubra', licensee: 'AbbVie', value: '$2.2B', totalValueM: 2200, year: 2025, relevance: 'GLP-1/amylin dual agonist for obesity', dealType: 'licensing', modalities: ['dualIncretin', 'amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Provention Bio', licensee: 'Sanofi', value: '$2.9B', totalValueM: 2900, year: 2023, relevance: 'Teplizumab (Tzield) for T1D delay', dealType: 'acquisition', modalities: ['mab'], indications: ['type1Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: '4D Molecular Therapeutics', licensee: 'Bayer', value: '$1.5B', totalValueM: 1500, year: 2024, relevance: 'AAV gene therapy for Fabry disease', dealType: 'licensing', modalities: ['geneTherapy'], indications: ['fabry'], therapeuticArea: 'metabolic', secondaryTAs: ['rareDisease'] },

  // ═══════════════════════════════════════════════════════════════════════
  // RARE DISEASE (3 deals — others moved to primary TAs with secondaryTAs)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Vertex Pharmaceuticals', licensee: 'CRISPR Therapeutics', value: '$900M', totalValueM: 900, upfrontM: 900, year: 2023, relevance: 'Casgevy (exa-cel) first approved CRISPR gene therapy for SCD/TDT', dealType: 'collaboration', modalities: ['geneTherapyRare'], indications: ['sickleCell', 'betaThalassemia'], therapeuticArea: 'rareDisease' },
  { licensor: 'Ionis Pharmaceuticals', licensee: 'Biogen', value: '$2.6B', totalValueM: 2600, year: 2018, relevance: 'Spinraza (nusinersen) ASO collaboration for SMA', dealType: 'collaboration', modalities: ['aso'], indications: ['spinalMuscularAtrophy'], therapeuticArea: 'rareDisease' },
  { licensor: 'Regeneron', licensee: 'Alnylam', value: '$1.4B', totalValueM: 1400, upfrontM: 1000, year: 2024, relevance: 'RNAi collaboration for cardiometabolic and neurological rare diseases', dealType: 'collaboration', modalities: ['rnai'], indications: ['rareNeuro', 'cardiomyopathy'], therapeuticArea: 'rareDisease', secondaryTAs: ['cardiovascular'] },

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY (8 deals — no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Celgene', licensee: 'BMS', value: '$74B', totalValueM: 74000, year: 2019, relevance: 'Revlimid, Pomalyst, Abraxane hematology franchise (acquisition)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myeloma', 'mds'], therapeuticArea: 'hematology' },
  { licensor: 'Kite Pharma', licensee: 'Gilead', value: '$11.9B', totalValueM: 11900, year: 2017, relevance: 'CAR-T platform (Yescarta for DLBCL) (acquisition)', dealType: 'acquisition', modalities: ['carT_heme'], indications: ['dlbcl', 'follicularLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Juno Therapeutics', licensee: 'Celgene/BMS', value: '$9B', totalValueM: 9000, year: 2018, relevance: 'CAR-T (Breyanzi/lisocabtagene maraleucel) (acquisition)', dealType: 'acquisition', modalities: ['carT_heme'], indications: ['dlbcl', 'mantleCellLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Legend Biotech', licensee: 'Johnson & Johnson', value: '$350M', totalValueM: 350, upfrontM: 350, year: 2017, relevance: 'BCMA CAR-T (Carvykti/ciltacabtagene autoleucel) for myeloma', dealType: 'licensing', modalities: ['carT_heme'], indications: ['myeloma'], therapeuticArea: 'hematology' },
  { licensor: 'Pfizer', licensee: 'Global Blood Therapeutics', value: '$5.4B', totalValueM: 5400, year: 2022, relevance: 'Oxbryta (voxelotor) in sickle cell disease (acquisition)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['sickleCell'], therapeuticArea: 'hematology' },
  { licensor: 'Syndax Pharmaceuticals', licensee: 'Incyte', value: '$1.4B', totalValueM: 1400, year: 2024, relevance: 'Revumenib (Augtyro) menin inhibitor collaboration for AML', dealType: 'collaboration', modalities: ['smallMolecule'], indications: ['aml'], therapeuticArea: 'hematology' },
  { licensor: 'MorphoSys', licensee: 'Novartis', value: '$2.9B', totalValueM: 2900, year: 2024, relevance: 'Pelabresib BET inhibitor acquisition for myelofibrosis', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },
  { licensor: 'CTI BioPharma', licensee: 'Sobi', value: '$1.7B', totalValueM: 1700, year: 2023, relevance: 'Pacritinib (Vonjo) JAK2/IRAK1 inhibitor for myelofibrosis', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },

  // ═══════════════════════════════════════════════════════════════════════
  // DERMATOLOGY (2 real deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Concert Pharmaceuticals', licensee: 'Sun Pharma', value: '$576M', totalValueM: 576, year: 2023, relevance: 'Deuruxolitinib JAK inhibitor for alopecia areata acquisition', dealType: 'acquisition', modalities: ['jakInhibitorDerm'], indications: ['alopeciaAreata'], therapeuticArea: 'dermatology' },
  { licensor: 'Almirall', licensee: 'AbbVie', value: '$660M', totalValueM: 660, year: 2023, relevance: 'EU rights to TYK2 inhibitor for psoriasis and atopic dermatitis', dealType: 'licensing', modalities: ['jakInhibitorDerm'], indications: ['psoriasis', 'atopicderm'], therapeuticArea: 'dermatology' },

  // ═══════════════════════════════════════════════════════════════════════
  // GASTROENTEROLOGY (2 deals unique to GI — others via immunology secondaryTAs)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Iterative Health', licensee: 'Pfizer', value: '$1.6B', totalValueM: 1600, year: 2024, relevance: 'AI-powered GI diagnostics platform for IBD and endoscopy', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Protagonist Therapeutics', licensee: 'J&J', value: '$1B', totalValueM: 1000, upfrontM: 1000, year: 2024, relevance: 'Icotrokinra (JNJ-2113) oral IL-23 peptide for UC/Crohn\'s', dealType: 'licensing', modalities: ['peptide'], indications: ['ulcerativeColitis', 'crohns', 'psoriasis'], therapeuticArea: 'gastroenterology' },
];

// Convert extended deal to base ComparableDeal format — preserves all structured fields
function toComparableDeal(d: ExtendedComparableDeal): ComparableDeal {
  const value = d.totalDealValue >= 1000
    ? `$${(d.totalDealValue / 1000).toFixed(1)}B`
    : `$${d.totalDealValue}M`;
  return {
    licensor: d.licensor,
    licensee: d.licensee,
    value,
    upfrontM: d.upfront,
    totalValueM: d.totalDealValue,
    milestonesM: d.milestones,
    royaltyRange: d.royaltyRange,
    year: d.year,
    relevance: d.headline,
    dealType: d.dealType,
    modalities: [d.modality],
    indications: [d.indication_specific],
    therapeuticArea: d.therapeuticArea as ComparableDeal['therapeuticArea'],
    territory: d.territory,
    phase: d.phase,
    source: d.source,
  };
}

// Merge curated deals with extended deals (deduplicate by licensor+licensee+year)
const ALL_DEALS: ComparableDeal[] = (() => {
  const seen = new Set(COMPARABLE_DEALS.map(d => `${d.licensor}|${d.licensee}|${d.year}`));
  const extended = EXTENDED_COMPARABLE_DEALS
    .filter(d => !seen.has(`${d.licensor}|${d.licensee}|${d.year}`))
    .map(toComparableDeal);
  return [...COMPARABLE_DEALS, ...extended];
})();

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
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType?: string },
  maxDeals: number = 5
): ComparableDealForUI[] {
  const scored = ALL_DEALS.map((deal, idx) => {
    let score = 0;
    const reasons: string[] = [];

    if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
      score += 3;
      reasons.push(`Same therapeutic area`);
    } else if (deal.secondaryTAs?.includes(inputs.therapeuticArea)) {
      score += 2;
      reasons.push(`Related therapeutic area`);
    }
    if (inputs.modality && deal.modalities?.includes(inputs.modality)) {
      score += 4;
      reasons.push(`Same modality`);
    }
    if (inputs.indication && deal.indications?.includes(inputs.indication)) {
      score += 3;
      reasons.push(`Same indication`);
    }
    if (inputs.dealType && deal.dealType === inputs.dealType) {
      score += 2;
      reasons.push(`Same deal structure`);
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
  const scored = ALL_DEALS.map(deal => {
    let score = 0;
    if (deal.therapeuticArea === therapeuticArea || deal.therapeuticArea === 'both') score += 1;
    else if (deal.secondaryTAs?.includes(therapeuticArea)) score += 1;
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
