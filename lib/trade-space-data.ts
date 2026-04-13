/**
 * Trade Space Data Loader — server-side.
 *
 * Runs `optimizeDealStructure` for a preset set of representative assets
 * (Phase 2 oncology mAb, Phase 3 rare disease gene therapy, etc.) so the
 * public /trade-space page can show real engine output without requiring
 * the visitor to fill a form first. Users who want custom inputs use the
 * full calculator at /calculator.
 */

import { optimizeDealStructure } from '@/lib/financial/deal-structure-optimizer';
import type { RNPVInput, DealOptimizerResult } from '@/lib/financial/types';

export interface TradeSpaceScenario {
  slug: string;
  title: string;
  subtitle: string;
  asset: {
    ta: string;
    phase: string;
    modality: string;
    indication: string;
    peakSalesM: number;
  };
  result: DealOptimizerResult;
}

const SCENARIOS_CONFIG: Array<{
  slug: string;
  title: string;
  subtitle: string;
  input: RNPVInput;
}> = [
  {
    slug: 'phase2-oncology-mab',
    title: 'Phase 2 oncology mAb',
    subtitle: 'NSCLC, $2B peak, small-biotech licensor',
    input: {
      therapeuticArea: 'oncology',
      indication: 'lung_nsclc',
      modality: 'mab',
      phase: 'phase2',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 1000, median: 2000, high: 4000 },
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
      biomarkerStatus: 'selected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      companyType: 'clinicalStageBiotech',
    },
  },
  {
    slug: 'phase3-rare-gene-therapy',
    title: 'Phase 3 rare disease gene therapy',
    subtitle: 'DMD, $1B peak, orphan designation',
    input: {
      therapeuticArea: 'rareDisease',
      indication: 'duchenne_muscular_dystrophy',
      modality: 'geneTherapy',
      phase: 'phase3',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
      competitivePosition: 'firstInClass',
      dataQuality: 'pivotalReady',
      biomarkerStatus: 'selected',
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: false },
      companyType: 'clinicalStageBiotech',
    },
  },
  {
    slug: 'phase2-immunology-bispecific',
    title: 'Phase 2 immunology bispecific',
    subtitle: 'Atopic dermatitis, $1.5B peak, mid-biotech licensor',
    input: {
      therapeuticArea: 'immunology',
      indication: 'atopic_dermatitis',
      modality: 'bispecific',
      phase: 'phase2',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 750, median: 1500, high: 3000 },
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      companyType: 'biotech',
    },
  },
  {
    slug: 'phase1-platform-rnai',
    title: 'Phase 1 platform RNAi',
    subtitle: 'Cardiovascular, $800M peak, early-stage option play',
    input: {
      therapeuticArea: 'cardiovascular',
      indication: 'atherosclerosis',
      modality: 'rnai',
      phase: 'phase1',
      territory: 'global',
      dealType: 'licensing',
      peakSalesEstimate: { low: 400, median: 800, high: 1600 },
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      companyType: 'clinicalStageBiotech',
    },
  },
];

export function loadTradeSpaceScenarios(): TradeSpaceScenario[] {
  return SCENARIOS_CONFIG.map(cfg => {
    const result = optimizeDealStructure(cfg.input);
    return {
      slug: cfg.slug,
      title: cfg.title,
      subtitle: cfg.subtitle,
      asset: {
        ta: cfg.input.therapeuticArea,
        phase: cfg.input.phase,
        modality: cfg.input.modality,
        indication: cfg.input.indication || '',
        peakSalesM: cfg.input.peakSalesEstimate.median,
      },
      result,
    };
  });
}

export function loadTradeSpaceScenario(slug: string): TradeSpaceScenario | null {
  return loadTradeSpaceScenarios().find(s => s.slug === slug) || null;
}
