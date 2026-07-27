'use client';

interface TherapeuticAreaBreakdownProps {
  snapshot: any;
  isPro: boolean;
  onUpgrade?: () => void;
}

const TA_DISPLAY: Record<string, { label: string; color: string; bgColor: string; hexColor: string }> = {
  oncology: { label: 'Oncology', color: 'text-rose-600 dark:text-rose-400', bgColor: 'bg-rose-500', hexColor: '#f43f5e' },
  neurology: { label: 'Neurology', color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-500', hexColor: '#8b5cf6' },
  immunology: { label: 'Immunology', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500', hexColor: '#3b82f6' },
  metabolic: { label: 'Metabolic', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500', hexColor: '#f59e0b' },
  cardiovascular: { label: 'Cardiovascular', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500', hexColor: '#ef4444' },
  infectiousDisease: { label: 'Infectious Disease', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500', hexColor: '#10b981' },
  infectious_disease: { label: 'Infectious Disease', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500', hexColor: '#10b981' },
  ophthalmology: { label: 'Ophthalmology', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500', hexColor: '#06b6d4' },
  womensHealth: { label: "Women's Health", color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500', hexColor: '#ec4899' },
  womens_health: { label: "Women's Health", color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500', hexColor: '#ec4899' },
  rareDisease: { label: 'Rare Disease', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500', hexColor: '#a855f7' },
  rare_disease: { label: 'Rare Disease', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500', hexColor: '#a855f7' },
  hematology: { label: 'Hematology', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500', hexColor: '#f97316' },
  dermatology: { label: 'Dermatology', color: 'text-fuchsia-600 dark:text-fuchsia-400', bgColor: 'bg-fuchsia-500', hexColor: '#d946ef' },
  gastroenterology: { label: 'Gastroenterology', color: 'text-lime-600 dark:text-lime-400', bgColor: 'bg-lime-600', hexColor: '#84cc16' },
};

const DEFAULT_DISPLAY = { label: '', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-500', hexColor: '#64748b' };

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

// All 12 canonical TAs
const CANONICAL_TAS = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
];

export default function TherapeuticAreaBreakdown({ snapshot, isPro, onUpgrade }: TherapeuticAreaBreakdownProps) {
  const taData = snapshot.therapeutic_area_breakdown || {};

  // Build entries from snapshot data
  const dataEntries = Object.entries(taData)
    .map(([key, data]: [string, any]) => {
      const display = TA_DISPLAY[key] || {
        ...DEFAULT_DISPLAY,
        label: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
      };
      return {
        key,
        display,
        count: data.count || 0,
        avgUpfront: data.avg_upfront || null,
        totalValue: data.total_value || null,
      };
    });

  // Ensure all 12 canonical TAs appear even with 0 deals
  const existingKeys = new Set(dataEntries.map(e => e.key));
  for (const ta of CANONICAL_TAS) {
    if (!existingKeys.has(ta)) {
      dataEntries.push({
        key: ta,
        display: TA_DISPLAY[ta]!,
        count: 0,
        avgUpfront: null,
        totalValue: null,
      });
    }
  }

  // Sort by deal count descending
  const entries = dataEntries.sort((a, b) => b.count - a.count);
  const totalDeals = entries.reduce((sum, e) => sum + e.count, 0);

  if (entries.length === 0) {
    return null;
  }

  // Build bar segments: group TAs with < 3% share into "Other" for the bar only
  const barThreshold = 3;
  const barSegments: Array<{ key: string; label: string; bgColor: string; count: number; pct: number }> = [];
  let otherCount = 0;

  for (const entry of entries) {
    const pct = totalDeals > 0 ? (entry.count / totalDeals) * 100 : 0;
    if (pct >= barThreshold && entry.count > 0) {
      barSegments.push({
        key: entry.key,
        label: entry.display.label,
        bgColor: entry.display.bgColor,
        count: entry.count,
        pct,
      });
    } else {
      otherCount += entry.count;
    }
  }

  if (otherCount > 0) {
    barSegments.push({
      key: '_other',
      label: 'Other',
      bgColor: 'bg-slate-400',
      count: otherCount,
      pct: totalDeals > 0 ? (otherCount / totalDeals) * 100 : 0,
    });
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Therapeutic Areas</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Deal distribution this week</p>
      </div>

      {/* Stacked proportion bar with percentage labels */}
      {totalDeals > 0 && (
        <div className="h-7 rounded-full overflow-hidden flex mb-5" role="img" aria-label="Deal distribution across therapeutic areas">
          {barSegments.map((seg) => (
            <div
              key={seg.key}
              className={`${seg.bgColor} transition-all duration-500 flex items-center justify-center overflow-hidden`}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.label}: ${seg.count} deals (${seg.pct.toFixed(0)}%)`}
            >
              {seg.pct >= 8 && (
                <span className="text-[10px] font-bold text-white leading-none truncate px-1">
                  {seg.pct.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TA list — all entries, sorted by count descending */}
      <div className="space-y-3">
        {entries.map((entry) => {
          const pct = totalDeals > 0 ? ((entry.count / totalDeals) * 100).toFixed(0) : '0';
          return (
            <div key={entry.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full ${entry.display.bgColor} shrink-0`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {entry.display.label}
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-normal">({entry.count})</span>
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isPro && entry.avgUpfront != null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    avg {formatUsd(entry.avgUpfront)}
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-right">
                  {entry.count > 0 ? `${pct}%` : '--'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline upgrade CTA for free users */}
      {!isPro && totalDeals > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <a
            href="/pro"
            onClick={(e) => { if (onUpgrade) { e.preventDefault(); onUpgrade(); } }}
            className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Unlock avg upfront data per TA
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}

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
              <td>{totalDeals > 0 ? ((entry.count / totalDeals) * 100).toFixed(0) : 0}%</td>
              <td>{isPro ? formatUsd(entry.avgUpfront) : 'Pro only'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
