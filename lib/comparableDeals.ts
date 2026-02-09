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
  therapeuticArea: 'oncology' | 'neurology' | 'both';
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
];

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
