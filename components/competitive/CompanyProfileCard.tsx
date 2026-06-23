'use client';

import WatchButton from '@/components/WatchButton';
import { formatModality } from '@/lib/config/modality-display';

interface CompanyProfileCardProps {
  company: {
    name: string;
    company_type: string | null;
    hq_country: string | null;
    acquisition_appetite: string | null;
    modalities_active: string[];
    indications_active?: string[];
    deals_last_12mo: number;
    active_trials_count: number;
  };
  isPro: boolean;
  marketPosition?: {
    deal_volume_rank: number | null;
    total_companies: number;
    primary_modality: string | null;
  } | null;
  dealFlowTrend?: { quarter: string; count: number }[];
}

const typeLabels: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Biotech',
  specialty: 'Specialty',
};

const appetiteConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aggressive: { label: 'Aggressive Acquirer', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/20', dot: 'bg-red-500' },
  moderate: { label: 'Active Acquirer', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/20', dot: 'bg-amber-500' },
  selective: { label: 'Selective Acquirer', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/20', dot: 'bg-blue-500' },
};

export default function CompanyProfileCard({ company, isPro, marketPosition, dealFlowTrend }: CompanyProfileCardProps) {
  const appetite = company.acquisition_appetite ? appetiteConfig[company.acquisition_appetite] : null;

  // Mini sparkline from deal flow trend
  const sparkData = (dealFlowTrend || []).slice(-8);
  const maxCount = Math.max(1, ...sparkData.map(d => d.count));
  const sparkWidth = 120;
  const sparkHeight = 32;
  const points = sparkData.map((d, i) => {
    const x = (i / Math.max(1, sparkData.length - 1)) * sparkWidth;
    const y = sparkHeight - (d.count / maxCount) * sparkHeight;
    return `${x},${y}`;
  }).join(' ');

  const isTopRank = marketPosition?.deal_volume_rank && marketPosition.deal_volume_rank <= 20;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700" />

      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{company.name}</h1>
              <WatchButton
                itemType="company"
                itemValue={company.name}
                size="md"
                tier={isPro ? 'pro' : 'free'}
              />
              {company.company_type && (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {typeLabels[company.company_type] || company.company_type}
                </span>
              )}
              {isTopRank && (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  #{marketPosition!.deal_volume_rank} by Deal Volume
                </span>
              )}
            </div>
            {company.hq_country && (
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {company.hq_country}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isPro && appetite && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${appetite.bg} ${appetite.color}`}>
                <span className={`w-2 h-2 rounded-full ${appetite.dot}`} />
                {appetite.label}
              </div>
            )}

            {/* Sparkline */}
            {sparkData.length > 2 && (
              <div className="hidden sm:block">
                <svg width={sparkWidth} height={sparkHeight} className="overflow-visible">
                  <defs>
                    <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`0,${sparkHeight} ${points} ${sparkWidth},${sparkHeight}`}
                    fill="url(#sparkGrad)"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-xs text-slate-400 text-center mt-0.5">Deal trend</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-700/30 dark:to-blue-900/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{company.deals_last_12mo || 0}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Deals (12mo)</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{company.active_trials_count || 0}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Active Trials</div>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{(company.modalities_active || []).length}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Modalities</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{(company.indications_active || []).length}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Indications</div>
          </div>
        </div>

        {/* Modality pills */}
        {(company.modalities_active || []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {company.modalities_active.map((m) => (
              <span key={m} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
                {formatModality(m)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
