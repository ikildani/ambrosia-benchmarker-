'use client';

interface PatentCliff {
  drug_name?: string;
  year: number;
  revenue_at_risk?: number;
  therapeutic_area?: string;
}

interface PatentCliffTimelineProps {
  cliffs: PatentCliff[];
}

function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return 'N/A';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

export default function PatentCliffTimeline({ cliffs }: PatentCliffTimelineProps) {
  if (!cliffs || cliffs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Patent Cliff Timeline</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Revenue at risk from upcoming patent expirations</p>
        <div className="flex flex-col items-center py-8 text-center">
          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-slate-400">No patent cliff data available for this company.</p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const sorted = [...cliffs].filter(c => c.year >= currentYear).sort((a, b) => a.year - b.year);

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Patent Cliff Timeline</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Revenue at risk from upcoming patent expirations</p>
        <div className="flex flex-col items-center py-8 text-center">
          <p className="text-sm text-slate-400">No upcoming patent cliffs found for this company.</p>
        </div>
      </div>
    );
  }

  const years = [...new Set(sorted.map(c => c.year))];
  const maxRevenue = Math.max(1, ...sorted.map(c => c.revenue_at_risk || 0));

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Patent Cliff Timeline</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Revenue at risk from upcoming patent expirations</p>

      <div className="relative">
        {/* Timeline bar */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="flex justify-between relative">
          {years.map((year) => {
            const yearCliffs = sorted.filter(c => c.year === year);
            const totalRevenue = yearCliffs.reduce((sum, c) => sum + (c.revenue_at_risk || 0), 0);
            const severity = totalRevenue / maxRevenue;

            return (
              <div key={year} className="flex flex-col items-center flex-1">
                {/* Marker */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                  severity >= 0.7
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 ring-2 ring-red-300 dark:ring-red-500/40'
                    : severity >= 0.3
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-2 ring-amber-300 dark:ring-amber-500/40'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-2 ring-slate-300 dark:ring-slate-600'
                }`}>
                  {yearCliffs.length}
                </div>

                {/* Year label */}
                <span className="text-sm font-semibold text-slate-900 dark:text-white mt-2">{year}</span>

                {/* Revenue */}
                <span className={`text-xs font-medium mt-1 ${
                  severity >= 0.7 ? 'text-red-600 dark:text-red-400' : severity >= 0.3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                }`}>
                  {formatUsd(totalRevenue)}
                </span>

                {/* Drug names */}
                <div className="mt-2 space-y-0.5 text-center">
                  {yearCliffs.slice(0, 3).map((c, idx) => (
                    <div
                      key={idx}
                      className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px] cursor-default"
                      title={`${c.drug_name || 'Undisclosed'}${c.revenue_at_risk ? ` — ${formatUsd(c.revenue_at_risk)} at risk` : ''}${c.therapeutic_area ? ` (${c.therapeutic_area})` : ''}`}
                    >
                      {c.drug_name || 'Undisclosed'}
                    </div>
                  ))}
                  {yearCliffs.length > 3 && (
                    <div
                      className="text-[10px] text-blue-500 dark:text-blue-400 font-medium cursor-default"
                      title={yearCliffs.slice(3).map(c => c.drug_name || 'Undisclosed').join(', ')}
                    >
                      +{yearCliffs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 text-right">Data source: SEC filings, FDA Orange Book</p>
    </div>
  );
}
