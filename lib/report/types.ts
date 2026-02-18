import type { CalculationResult, CalculationInput } from '@/lib/calculations';
import type { SensitivityData } from '@/lib/sensitivity';
import type { ComparableDealForUI } from '@/lib/comparableDeals';
import type { NegotiationPlaybook } from '@/lib/ai/playbook-generator';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';

export interface PartnerForPDF {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
}

export interface PDFReportData {
  result: CalculationResult;
  inputs: CalculationInput;
  sensitivityData: SensitivityData;
  riskScore: number;
  partnerMatches?: PartnerForPDF[];
  playbookData?: NegotiationPlaybook;
  memoData?: DealMemo;
  comparableDeals: ComparableDealForUI[];
  historyId?: string;
}

export interface ReportMeta {
  reportId: string;
  generatedAt: string;
  version: string;
  pageCount: number;
}
