import type { ComparableDealForUI, HedocnicScoreBreakdown, ComparableDeal } from '@/lib/comparableDeals';
import type { ComparableNarrationResult } from '@/lib/ai/comparable-narrator';
import type { BrandConfig } from '../types';

export interface CompReportInputs {
  therapeuticArea: string;
  phase: string;
  modality: string;
  indication: string;
  territory: string;
  dealType?: string;
  competitivePosition?: string;
}

export interface CompReportBenchmarkRange {
  totalDealValue: { p25: number; median: number; p75: number };
  upfront: { p25: number; median: number; p75: number };
  compCount: number;
  yearRange: { min: number; max: number };
  upfrontPctOfTDV: number;
}

export interface ScoredComparable {
  deal: ComparableDeal;
  score: HedocnicScoreBreakdown;
  reasons: string[];
  id: string;
}

export interface CompReportData {
  assetName?: string;
  assetCode?: string;
  preparedFor?: string;

  inputs: CompReportInputs;

  benchmarkRange: CompReportBenchmarkRange;

  comparableDeals: ComparableDealForUI[];
  hedonicResults: ScoredComparable[];

  narration?: ComparableNarrationResult;

  brandConfig?: BrandConfig;
}
