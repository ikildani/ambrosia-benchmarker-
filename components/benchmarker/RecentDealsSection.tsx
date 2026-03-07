'use client';

import { FileText, Clock, DollarSign } from 'lucide-react';
import type { RelevantDeal } from '@/types/partner-breakdown';

interface RecentDealsSectionProps {
  deals: RelevantDeal[];
  maxDeals?: number;
}

export function RecentDealsSection({ deals, maxDeals = 3 }: RecentDealsSectionProps) {
  if (!deals || deals.length === 0) {
    return null;
  }

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return '';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="mt-4">
      <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2.5">
        Recent Deal Activity
      </div>
      <div className="space-y-2">
        {deals.slice(0, maxDeals).map((deal, i) => (
          <div
            key={deal.id || i}
            className="flex items-start gap-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"
          >
            <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-slate-100 text-sm">
                  {deal.asset_name}
                </span>
                {deal.modality && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {formatModality(deal.modality)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {deal.partner_name && (
                  <span className="truncate">{deal.partner_name}</span>
                )}
                {deal.relevance && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">{deal.relevance}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              {deal.total_value_usd ? (
                <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                  {formatCurrency(deal.total_value_usd)}
                  <span className="text-xs text-gray-400 font-normal">total</span>
                </div>
              ) : deal.upfront_usd ? (
                <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                  {formatCurrency(deal.upfront_usd)}
                  <span className="text-xs text-gray-400 font-normal">upfront</span>
                </div>
              ) : null}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {formatDate(deal.announced_date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatModality(modality: string): string {
  const labels: Record<string, string> = {
    'adc': 'ADC',
    'bispecific': 'Bispecific',
    'small_molecule': 'Small Molecule',
    'antibody': 'Antibody',
    'car_t': 'CAR-T',
    'cell_therapy': 'Cell Therapy',
    'gene_therapy': 'Gene Therapy',
    'mrna': 'mRNA',
    'radiopharm': 'Radiopharm',
    'oligonucleotide': 'Oligo',
    'peptide': 'Peptide',
    'vaccine': 'Vaccine',
  };
  return labels[modality] || modality;
}

export default RecentDealsSection;
