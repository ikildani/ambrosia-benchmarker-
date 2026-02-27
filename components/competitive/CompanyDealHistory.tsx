'use client';

import { useState, useMemo } from 'react';

interface Deal {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  phase_at_signing: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
  indication_category?: string;
  therapeutic_area?: string;
}

interface CompanyDealHistoryProps {
  deals: Deal[];
  isPro: boolean;
  dealsByModality?: Record<string, number>;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'Discovery', preclinical: 'Preclinical', phase_1: 'P1',
    phase_1_2: 'P1/2', phase_2: 'P2', phase_2_3: 'P2/3', phase_3: 'P3', approved: 'Approved',
  };
  return map[phase] || phase;
}

function formatModality(m: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', bispecific_antibody: 'Bispecific', small_molecule: 'SM',
    radiopharmaceutical: 'Radiopharm', monoclonal_antibody: 'mAb', gene_therapy: 'Gene Tx',
    mrna: 'mRNA', rnai: 'RNAi', antibody: 'Antibody', peptide: 'Peptide',
    cell_therapy: 'Cell Tx', protac: 'PROTAC',
  };
  return names[m] || m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CompanyDealHistory({ deals, isPro, dealsByModality }: CompanyDealHistoryProps) {
  const [modalityFilter, setModalityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'value'>('date');

  const modalities = useMemo(() => {
    const mods = new Set(deals.map(d => d.modality).filter(Boolean));
    return Array.from(mods).sort();
  }, [deals]);

  const filteredDeals = useMemo(() => {
    let result = [...deals];
    if (modalityFilter !== 'all') {
      result = result.filter(d => d.modality === modalityFilter);
    }
    if (sortBy === 'value') {
      result.sort((a, b) => (b.upfront_usd || 0) - (a.upfront_usd || 0));
    } else {
      result.sort((a, b) => new Date(b.announced_date).getTime() - new Date(a.announced_date).getTime());
    }
    return result;
  }, [deals, modalityFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const withUpfront = deals.filter(d => d.upfront_usd != null && d.upfront_usd > 0);
    const totalUpfront = withUpfront.reduce((sum, d) => sum + (d.upfront_usd || 0), 0);
    return {
      totalDeals: deals.length,
      disclosedCount: withUpfront.length,
      totalUpfront,
    };
  }, [deals]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Deals</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Last 12 months</p>
          </div>
          {deals.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Modality filter */}
              {modalities.length > 1 && (
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="all">All modalities</option>
                  {modalities.map(m => (
                    <option key={m} value={m}>{formatModality(m)}</option>
                  ))}
                </select>
              )}
              {/* Sort toggle */}
              <button
                onClick={() => setSortBy(sortBy === 'date' ? 'value' : 'date')}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                {sortBy === 'date' ? 'By date' : 'By value'}
              </button>
            </div>
          )}
        </div>

        {/* Summary stats row */}
        {deals.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{summaryStats.totalDeals}</span>
              <span className="text-xs text-slate-500">deals</span>
            </div>
            {isPro && summaryStats.disclosedCount > 0 && (
              <>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{formatUsd(summaryStats.totalUpfront)}</span>
                  <span className="text-xs text-slate-500">total upfront</span>
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{summaryStats.disclosedCount}/{summaryStats.totalDeals}</span>
                  <span className="text-xs text-slate-500">disclosed</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {filteredDeals.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {modalityFilter !== 'all' ? 'No deals match this filter' : 'No deals in the last 12 months'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Counterparty</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Modality</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Phase</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Upfront</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(deal.announced_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {deal.licensor_name} → {deal.licensee_name}
                    </div>
                    {deal.asset_name && (
                      <div className="text-xs text-slate-400 truncate">{deal.asset_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                      {formatModality(deal.modality)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 text-xs font-medium">
                    {formatPhase(deal.phase_at_signing)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {isPro ? (
                      <span className="text-teal-600 dark:text-teal-400">{formatUsd(deal.upfront_usd)}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 blur-sm select-none">$XXM</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
