'use client';

interface TherapeuticAreaBreakdownProps {
  snapshot: any;
  isPro: boolean;
}

const TA_DISPLAY: Record<string, { label: string; color: string; bgColor: string }> = {
  oncology: { label: 'Oncology', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-500' },
  neurology: { label: 'Neurology', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500' },
  immunology: { label: 'Immunology', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500' },
  metabolic: { label: 'Metabolic', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500' },
  cardiovascular: { label: 'Cardiovascular', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500' },
  infectiousDisease: { label: 'Infectious Disease', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500' },
  infectious_disease: { label: 'Infectious Disease', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500' },
  ophthalmology: { label: 'Ophthalmology', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500' },
  womensHealth: { label: "Women's Health", color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500' },
  womens_health: { label: "Women's Health", color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500' },
  rareDisease: { label: 'Rare Disease', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500' },
  rare_disease: { label: 'Rare Disease', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500' },
  hematology: { label: 'Hematology', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500' },
  dermatology: { label: 'Dermatology', color: 'text-fuchsia-600 dark:text-fuchsia-400', bgColor: 'bg-fuchsia-500' },
  gastroenterology: { label: 'Gastroenterology', color: 'text-lime-600 dark:text-lime-400', bgColor: 'bg-lime-600' },
};

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

export default function TherapeuticAreaBreakdown({ snapshot, isPro }: TherapeuticAreaBreakdownProps) {
  const taData = snapshot.therapeutic_area_breakdown || {};

  const entries = Object.entries(taData)
    .map(([key, data]: [string, any]) => ({
      key,
      display: TA_DISPLAY[key] || { label: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(), color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-500' },
      count: data.count || 0,
      avgUpfront: data.avg_upfront || null,
      totalValue: data.total_value || null,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalDeals = entries.reduce((sum, e) => sum + e.count, 0);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Therapeutic Areas</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Deal distribution this week</p>
      </div>

      {/* Stacked proportion bar */}
      <div className="h-3 rounded-full overflow-hidden flex mb-5" role="img" aria-label="Deal distribution across therapeutic areas">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className={`${entry.display.bgColor} transition-all duration-500`}
            style={{ width: `${(entry.count / totalDeals) * 100}%` }}
            title={`${entry.display.label}: ${entry.count} deals`}
          />
        ))}
      </div>

      {/* TA list */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const pct = ((entry.count / totalDeals) * 100).toFixed(0);
          return (
            <div key={entry.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full ${entry.display.bgColor} shrink-0`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {entry.display.label}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isPro && entry.avgUpfront != null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    avg {formatUsd(entry.avgUpfront)}
                  </span>
                )}
                <span className={`text-sm font-semibold ${entry.display.color}`}>
                  {entry.count}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-right">
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen reader table */}
      <table className="sr-only">
        <caption>Deal distribution by therapeutic area this week</caption>
        <thead>
          <tr>
            <th scope="col">Therapeutic Area</th>
            <th scope="col">Deals</th>
            <th scope="col">Share</th>
            <th scope="col">Avg Upfront</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`sr-${entry.key}`}>
              <td>{entry.display.label}</td>
              <td>{entry.count}</td>
              <td>{((entry.count / totalDeals) * 100).toFixed(0)}%</td>
              <td>{isPro ? formatUsd(entry.avgUpfront) : 'Pro only'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
