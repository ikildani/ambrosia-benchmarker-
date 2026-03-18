'use client';

interface CompanyBenchmarkComparisonProps {
  data: {
    company_avg_upfront: number | null;
    market_avg_upfront: number | null;
  };
  companyName: string;
  isPro?: boolean;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return 'N/A';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

export default function CompanyBenchmarkComparison({ data, companyName, isPro = true }: CompanyBenchmarkComparisonProps) {
  const { company_avg_upfront, market_avg_upfront } = data;
  if (company_avg_upfront == null && market_avg_upfront == null) return null;

  const maxVal = Math.max(company_avg_upfront || 0, market_avg_upfront || 0, 1);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 relative">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Avg Upfront vs Market</h2>
      {!isPro && (
        <div className="absolute inset-0 top-12 flex items-center justify-center z-10">
          <div className="absolute inset-0 backdrop-blur-[3px] bg-white/40 dark:bg-slate-800/40 rounded-b-2xl" />
          <div className="relative flex items-center gap-2 px-4 py-2 bg-navy-900 text-white text-sm font-medium rounded-xl shadow-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Pro only
          </div>
        </div>
      )}
      <div className="space-y-4">
        {/* Company bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{companyName}</span>
            <span className="text-slate-900 dark:text-white font-semibold">{formatUsd(company_avg_upfront)}</span>
          </div>
          <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all duration-500"
              style={{ width: `${company_avg_upfront ? (company_avg_upfront / maxVal) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Market bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-slate-500 dark:text-slate-400">Market Average</span>
            <span className="text-slate-600 dark:text-slate-400 font-semibold">{formatUsd(market_avg_upfront)}</span>
          </div>
          <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
            <div
              className="h-full bg-slate-300 dark:bg-slate-500 rounded-lg transition-all duration-500"
              style={{ width: `${market_avg_upfront ? (market_avg_upfront / maxVal) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
