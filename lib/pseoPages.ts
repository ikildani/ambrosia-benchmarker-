export interface PseoPageData {
  slug: string;
  modality: string;
  modalityLabel: string;
  phase: string;
  phaseLabel: string;
  totalDeals: number;
  dealsWithUpfront: number;
  medianUpfrontM: number;
  medianTdvM: number | null;
  avgRoyaltyLow: number | null;
  avgRoyaltyHigh: number | null;
  earliestDeal: string;
  latestDeal: string;
  dbModalityPattern: string;
  dbPhase: string;
}

const PSEO_PAGES: PseoPageData[] = [
  { slug: 'small-molecule-approved', modality: 'small-molecule', modalityLabel: 'Small Molecule', phase: 'approved', phaseLabel: 'Approved', totalDeals: 128, dealsWithUpfront: 63, medianUpfrontM: 1200, medianTdvM: 1550, avgRoyaltyLow: 10.3, avgRoyaltyHigh: 17.1, earliestDeal: '2011-06-15', latestDeal: '2026-07-20', dbModalityPattern: '%small%molecule%', dbPhase: 'approved' },
  { slug: 'small-molecule-phase-3', modality: 'small-molecule', modalityLabel: 'Small Molecule', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 67, dealsWithUpfront: 45, medianUpfrontM: 160, medianTdvM: 775, avgRoyaltyLow: 8.2, avgRoyaltyHigh: 15.0, earliestDeal: '2017-08-07', latestDeal: '2026-07-18', dbModalityPattern: '%small%molecule%', dbPhase: 'phase_3' },
  { slug: 'small-molecule-phase-2', modality: 'small-molecule', modalityLabel: 'Small Molecule', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 66, dealsWithUpfront: 48, medianUpfrontM: 136, medianTdvM: 1040, avgRoyaltyLow: 10.1, avgRoyaltyHigh: 18.0, earliestDeal: '2017-10-12', latestDeal: '2026-07-18', dbModalityPattern: '%small%molecule%', dbPhase: 'phase_2' },
  { slug: 'antibody-phase-2', modality: 'antibody', modalityLabel: 'Antibody', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 50, dealsWithUpfront: 37, medianUpfrontM: 600, medianTdvM: 1800, avgRoyaltyLow: 7.8, avgRoyaltyHigh: 16.4, earliestDeal: '2017-07-18', latestDeal: '2026-07-05', dbModalityPattern: '%antibody%', dbPhase: 'phase_2' },
  { slug: 'small-molecule-preclinical', modality: 'small-molecule', modalityLabel: 'Small Molecule', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 47, dealsWithUpfront: 34, medianUpfrontM: 60, medianTdvM: 1138, avgRoyaltyLow: 4.4, avgRoyaltyHigh: 12.3, earliestDeal: '2019-04-08', latestDeal: '2026-07-18', dbModalityPattern: '%small%molecule%', dbPhase: 'preclinical' },
  { slug: 'gene-therapy-preclinical', modality: 'gene-therapy', modalityLabel: 'Gene Therapy', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 38, dealsWithUpfront: 26, medianUpfrontM: 84, medianTdvM: 1100, avgRoyaltyLow: 5.3, avgRoyaltyHigh: 12.0, earliestDeal: '2020-02-03', latestDeal: '2026-05-23', dbModalityPattern: '%gene_therapy%', dbPhase: 'preclinical' },
  { slug: 'small-molecule-phase-1', modality: 'small-molecule', modalityLabel: 'Small Molecule', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 35, dealsWithUpfront: 34, medianUpfrontM: 150, medianTdvM: 950, avgRoyaltyLow: 4.9, avgRoyaltyHigh: 10.0, earliestDeal: '2019-07-26', latestDeal: '2026-07-06', dbModalityPattern: '%small%molecule%', dbPhase: 'phase_1' },
  { slug: 'antibody-approved', modality: 'antibody', modalityLabel: 'Antibody', phase: 'approved', phaseLabel: 'Approved', totalDeals: 31, dealsWithUpfront: 13, medianUpfrontM: 2900, medianTdvM: 2975, avgRoyaltyLow: 5.5, avgRoyaltyHigh: 11.5, earliestDeal: '2017-01-01', latestDeal: '2026-07-18', dbModalityPattern: '%antibody%', dbPhase: 'approved' },
  { slug: 'bispecific-phase-1', modality: 'bispecific', modalityLabel: 'Bispecific Antibody', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 27, dealsWithUpfront: 16, medianUpfrontM: 194, medianTdvM: 1150, avgRoyaltyLow: 6.6, avgRoyaltyHigh: 14.9, earliestDeal: '2019-05-03', latestDeal: '2026-04-18', dbModalityPattern: '%bispecific%', dbPhase: 'phase_1' },
  { slug: 'antibody-preclinical', modality: 'antibody', modalityLabel: 'Antibody', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 25, dealsWithUpfront: 17, medianUpfrontM: 89, medianTdvM: 1246, avgRoyaltyLow: 6.4, avgRoyaltyHigh: 13.2, earliestDeal: '2019-10-15', latestDeal: '2026-06-15', dbModalityPattern: '%antibody%', dbPhase: 'preclinical' },
  { slug: 'antibody-phase-1', modality: 'antibody', modalityLabel: 'Antibody', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 22, dealsWithUpfront: 17, medianUpfrontM: 205, medianTdvM: 1200, avgRoyaltyLow: 6.2, avgRoyaltyHigh: 15.6, earliestDeal: '2018-07-11', latestDeal: '2025-06-15', dbModalityPattern: '%antibody%', dbPhase: 'phase_1' },
  { slug: 'antibody-phase-3', modality: 'antibody', modalityLabel: 'Antibody', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 22, dealsWithUpfront: 15, medianUpfrontM: 650, medianTdvM: 2000, avgRoyaltyLow: 4.2, avgRoyaltyHigh: 12.9, earliestDeal: '2019-09-16', latestDeal: '2026-06-22', dbModalityPattern: '%antibody%', dbPhase: 'phase_3' },
  { slug: 'mrna-preclinical', modality: 'mrna', modalityLabel: 'mRNA', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 22, dealsWithUpfront: 11, medianUpfrontM: 75, medianTdvM: 176, avgRoyaltyLow: null, avgRoyaltyHigh: null, earliestDeal: '2017-03-20', latestDeal: '2026-07-18', dbModalityPattern: '%mrna%', dbPhase: 'preclinical' },
  { slug: 'bispecific-preclinical', modality: 'bispecific', modalityLabel: 'Bispecific Antibody', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 21, dealsWithUpfront: 16, medianUpfrontM: 62, medianTdvM: 850, avgRoyaltyLow: 5.8, avgRoyaltyHigh: 12.3, earliestDeal: '2018-06-15', latestDeal: '2026-05-15', dbModalityPattern: '%bispecific%', dbPhase: 'preclinical' },
  { slug: 'gene-therapy-phase-1', modality: 'gene-therapy', modalityLabel: 'Gene Therapy', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 16, dealsWithUpfront: 12, medianUpfrontM: 100, medianTdvM: 718, avgRoyaltyLow: 10.5, avgRoyaltyHigh: 17.0, earliestDeal: '2017-05-04', latestDeal: '2026-04-05', dbModalityPattern: '%gene_therapy%', dbPhase: 'phase_1' },
  { slug: 'oligonucleotide-preclinical', modality: 'oligonucleotide', modalityLabel: 'Oligonucleotide', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 16, dealsWithUpfront: 12, medianUpfrontM: 78, medianTdvM: 1290, avgRoyaltyLow: null, avgRoyaltyHigh: null, earliestDeal: '2022-06-15', latestDeal: '2026-06-03', dbModalityPattern: '%oligonucleotide%', dbPhase: 'preclinical' },
  { slug: 'cell-therapy-preclinical', modality: 'cell-therapy', modalityLabel: 'Cell Therapy', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 16, dealsWithUpfront: 10, medianUpfrontM: 91, medianTdvM: 941, avgRoyaltyLow: 5.8, avgRoyaltyHigh: 12.0, earliestDeal: '2019-03-18', latestDeal: '2026-05-23', dbModalityPattern: '%cell_therapy%', dbPhase: 'preclinical' },
  { slug: 'peptide-phase-2', modality: 'peptide', modalityLabel: 'Peptide', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 15, dealsWithUpfront: 11, medianUpfrontM: 125, medianTdvM: 1590, avgRoyaltyLow: 6.6, avgRoyaltyHigh: 14.9, earliestDeal: '2019-10-02', latestDeal: '2026-06-07', dbModalityPattern: '%peptide%', dbPhase: 'phase_2' },
  { slug: 'gene-therapy-approved', modality: 'gene-therapy', modalityLabel: 'Gene Therapy', phase: 'approved', phaseLabel: 'Approved', totalDeals: 14, dealsWithUpfront: 7, medianUpfrontM: 450, medianTdvM: 2212, avgRoyaltyLow: 11.5, avgRoyaltyHigh: 25.0, earliestDeal: '2019-02-22', latestDeal: '2026-04-10', dbModalityPattern: '%gene_therapy%', dbPhase: 'approved' },
  { slug: 'adc-preclinical', modality: 'adc', modalityLabel: 'ADC', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 14, dealsWithUpfront: 8, medianUpfrontM: 54, medianTdvM: 1000, avgRoyaltyLow: 6.0, avgRoyaltyHigh: 13.2, earliestDeal: '2019-01-19', latestDeal: '2026-07-09', dbModalityPattern: '%adc%', dbPhase: 'preclinical' },
  { slug: 'gene-therapy-phase-3', modality: 'gene-therapy', modalityLabel: 'Gene Therapy', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 14, dealsWithUpfront: 12, medianUpfrontM: 430, medianTdvM: 2050, avgRoyaltyLow: 11.9, avgRoyaltyHigh: 24.6, earliestDeal: '2019-01-05', latestDeal: '2026-04-15', dbModalityPattern: '%gene_therapy%', dbPhase: 'phase_3' },
  { slug: 'peptide-preclinical', modality: 'peptide', modalityLabel: 'Peptide', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 13, dealsWithUpfront: 9, medianUpfrontM: 70, medianTdvM: 768, avgRoyaltyLow: 4.4, avgRoyaltyHigh: 7.0, earliestDeal: '2017-10-05', latestDeal: '2026-06-29', dbModalityPattern: '%peptide%', dbPhase: 'preclinical' },
  { slug: 'adc-phase-2', modality: 'adc', modalityLabel: 'ADC', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 11, dealsWithUpfront: 11, medianUpfrontM: 800, medianTdvM: 3356, avgRoyaltyLow: 6.6, avgRoyaltyHigh: 17.2, earliestDeal: '2019-08-01', latestDeal: '2026-04-07', dbModalityPattern: '%adc%', dbPhase: 'phase_2' },
  { slug: 'gene-therapy-phase-2', modality: 'gene-therapy', modalityLabel: 'Gene Therapy', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 10, dealsWithUpfront: 8, medianUpfrontM: 170, medianTdvM: 950, avgRoyaltyLow: 7.6, avgRoyaltyHigh: 15.6, earliestDeal: '2019-07-01', latestDeal: '2024-12-16', dbModalityPattern: '%gene_therapy%', dbPhase: 'phase_2' },
  { slug: 'adc-approved', modality: 'adc', modalityLabel: 'ADC', phase: 'approved', phaseLabel: 'Approved', totalDeals: 10, dealsWithUpfront: 6, medianUpfrontM: 15550, medianTdvM: 13380, avgRoyaltyLow: 15.0, avgRoyaltyHigh: 21.0, earliestDeal: '2020-06-15', latestDeal: '2026-04-29', dbModalityPattern: '%adc%', dbPhase: 'approved' },
  { slug: 'peptide-phase-1', modality: 'peptide', modalityLabel: 'Peptide', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 9, dealsWithUpfront: 9, medianUpfrontM: 113, medianTdvM: 1382, avgRoyaltyLow: 6.0, avgRoyaltyHigh: 13.0, earliestDeal: '2020-02-11', latestDeal: '2025-01-06', dbModalityPattern: '%peptide%', dbPhase: 'phase_1' },
  { slug: 'cell-therapy-phase-1', modality: 'cell-therapy', modalityLabel: 'Cell Therapy', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 9, dealsWithUpfront: 9, medianUpfrontM: 150, medianTdvM: 1700, avgRoyaltyLow: 6.2, avgRoyaltyHigh: 14.4, earliestDeal: '2018-01-22', latestDeal: '2026-04-20', dbModalityPattern: '%cell_therapy%', dbPhase: 'phase_1' },
  { slug: 'rnai-preclinical', modality: 'rnai', modalityLabel: 'RNAi / siRNA', phase: 'preclinical', phaseLabel: 'Preclinical', totalDeals: 8, dealsWithUpfront: 7, medianUpfrontM: 150, medianTdvM: 839, avgRoyaltyLow: 6.2, avgRoyaltyHigh: 14.4, earliestDeal: '2019-02-17', latestDeal: '2025-01-07', dbModalityPattern: '%rnai%', dbPhase: 'preclinical' },
  { slug: 'bispecific-phase-2', modality: 'bispecific', modalityLabel: 'Bispecific Antibody', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 8, dealsWithUpfront: 7, medianUpfrontM: 588, medianTdvM: 1400, avgRoyaltyLow: 7.3, avgRoyaltyHigh: 15.3, earliestDeal: '2019-05-28', latestDeal: '2025-04-28', dbModalityPattern: '%bispecific%', dbPhase: 'phase_2' },
  { slug: 'mrna-approved', modality: 'mrna', modalityLabel: 'mRNA', phase: 'approved', phaseLabel: 'Approved', totalDeals: 8, dealsWithUpfront: 3, medianUpfrontM: 950, medianTdvM: 2250, avgRoyaltyLow: 11.0, avgRoyaltyHigh: 25.0, earliestDeal: '2022-03-23', latestDeal: '2026-03-03', dbModalityPattern: '%mrna%', dbPhase: 'approved' },
  { slug: 'mrna-phase-1', modality: 'mrna', modalityLabel: 'mRNA', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 8, dealsWithUpfront: 7, medianUpfrontM: 145, medianTdvM: 1389, avgRoyaltyLow: 6.5, avgRoyaltyHigh: 15.0, earliestDeal: '2021-03-13', latestDeal: '2026-05-14', dbModalityPattern: '%mrna%', dbPhase: 'phase_1' },
  { slug: 'peptide-phase-3', modality: 'peptide', modalityLabel: 'Peptide', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 7, dealsWithUpfront: 6, medianUpfrontM: 600, medianTdvM: 1050, avgRoyaltyLow: 10.0, avgRoyaltyHigh: 20.0, earliestDeal: '2018-01-01', latestDeal: '2026-04-09', dbModalityPattern: '%peptide%', dbPhase: 'phase_3' },
  { slug: 'protac-phase-1', modality: 'protac', modalityLabel: 'PROTAC / Degrader', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 7, dealsWithUpfront: 7, medianUpfrontM: 96, medianTdvM: 832, avgRoyaltyLow: 6.3, avgRoyaltyHigh: 17.0, earliestDeal: '2020-11-26', latestDeal: '2024-12-16', dbModalityPattern: '%protac%', dbPhase: 'phase_1' },
  { slug: 'rnai-phase-1', modality: 'rnai', modalityLabel: 'RNAi / siRNA', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 7, dealsWithUpfront: 7, medianUpfrontM: 120, medianTdvM: 1478, avgRoyaltyLow: 8.0, avgRoyaltyHigh: 17.0, earliestDeal: '2019-05-05', latestDeal: '2025-07-01', dbModalityPattern: '%rnai%', dbPhase: 'phase_1' },
  { slug: 'adc-phase-3', modality: 'adc', modalityLabel: 'ADC', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 7, dealsWithUpfront: 7, medianUpfrontM: 462, medianTdvM: 6900, avgRoyaltyLow: 7.4, avgRoyaltyHigh: 15.3, earliestDeal: '2019-12-11', latestDeal: '2026-07-10', dbModalityPattern: '%adc%', dbPhase: 'phase_3' },
  { slug: 'adc-phase-1', modality: 'adc', modalityLabel: 'ADC', phase: 'phase-1', phaseLabel: 'Phase 1', totalDeals: 7, dealsWithUpfront: 5, medianUpfrontM: 185, medianTdvM: 1330, avgRoyaltyLow: 6.8, avgRoyaltyHigh: 15.8, earliestDeal: '2019-06-08', latestDeal: '2024-06-15', dbModalityPattern: '%adc%', dbPhase: 'phase_1' },
  { slug: 'mrna-phase-2', modality: 'mrna', modalityLabel: 'mRNA', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 6, dealsWithUpfront: 5, medianUpfrontM: 376, medianTdvM: 2000, avgRoyaltyLow: 9.3, avgRoyaltyHigh: 19.3, earliestDeal: '2019-09-25', latestDeal: '2025-01-15', dbModalityPattern: '%mrna%', dbPhase: 'phase_2' },
  { slug: 'bispecific-phase-3', modality: 'bispecific', modalityLabel: 'Bispecific Antibody', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 6, dealsWithUpfront: 5, medianUpfrontM: 1250, medianTdvM: 5150, avgRoyaltyLow: 10.7, avgRoyaltyHigh: 19.7, earliestDeal: '2020-04-04', latestDeal: '2025-06-02', dbModalityPattern: '%bispecific%', dbPhase: 'phase_3' },
  { slug: 'cell-therapy-phase-2', modality: 'cell-therapy', modalityLabel: 'Cell Therapy', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 5, dealsWithUpfront: 4, medianUpfrontM: 136, medianTdvM: 999, avgRoyaltyLow: 9.5, avgRoyaltyHigh: 19.0, earliestDeal: '2019-01-01', latestDeal: '2024-04-01', dbModalityPattern: '%cell_therapy%', dbPhase: 'phase_2' },
  { slug: 'rnai-phase-2', modality: 'rnai', modalityLabel: 'RNAi / siRNA', phase: 'phase-2', phaseLabel: 'Phase 2', totalDeals: 5, dealsWithUpfront: 3, medianUpfrontM: 250, medianTdvM: 1000, avgRoyaltyLow: 6.0, avgRoyaltyHigh: 15.3, earliestDeal: '2018-04-12', latestDeal: '2024-11-11', dbModalityPattern: '%rnai%', dbPhase: 'phase_2' },
  { slug: 'mrna-phase-3', modality: 'mrna', modalityLabel: 'mRNA', phase: 'phase-3', phaseLabel: 'Phase 3', totalDeals: 5, dealsWithUpfront: 4, medianUpfrontM: 590, medianTdvM: 590, avgRoyaltyLow: 1.0, avgRoyaltyHigh: 4.0, earliestDeal: '2024-03-27', latestDeal: '2025-12-15', dbModalityPattern: '%mrna%', dbPhase: 'phase_3' },
];

export function getAllPseoSlugs(): string[] {
  return PSEO_PAGES.map(p => p.slug);
}

export function getPseoBySlug(slug: string): PseoPageData | undefined {
  return PSEO_PAGES.find(p => p.slug === slug);
}

export function getRelatedPseoPages(page: PseoPageData): PseoPageData[] {
  return PSEO_PAGES
    .filter(p => p.slug !== page.slug && (p.modality === page.modality || p.phase === page.phase))
    .slice(0, 4);
}

export function formatDollar(millions: number): string {
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  return `$${millions}M`;
}

export { PSEO_PAGES };
