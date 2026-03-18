'use client';

interface WeeklyHighlightsProps {
  snapshot: any;
  isPro: boolean;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

function formatModality(modality: string): string {
  return modality
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function WeeklyHighlights({ snapshot, isPro }: WeeklyHighlightsProps) {
  const modalities = Object.entries(snapshot.modality_breakdown || {}).sort(
    ([, a]: any, [, b]: any) => b.count - a.count
  );
  const hottestModality = modalities.length > 0 ? modalities[0] : null;

  // Find biggest benchmark shift
  const shifts = Object.entries(snapshot.benchmark_changes || {})
    .map(([key, pct]) => ({ modality: key.replace('_upfront_change_pct', ''), pct: pct as number }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const biggestShift = shifts.length > 0 ? shifts[0] : null;

  const cards = [
    {
      label: 'New Deals',
      value: String(snapshot.new_deals_count || 0),
      sub: 'this week',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-slate-900 dark:text-white',
      bg: 'bg-blue-50 dark:bg-blue-900/15',
    },
    {
      label: 'Avg Upfront',
      value: isPro ? formatUsd(snapshot.avg_upfront_usd) : '--',
      sub: isPro ? 'vs trailing 90d' : 'Pro only',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      locked: !isPro,
    },
    {
      label: 'Hottest Modality',
      value: hottestModality ? formatModality(hottestModality[0] as string) : 'N/A',
      sub: hottestModality ? `${(hottestModality[1] as any).count} deals` : '',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ),
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-500/10',
    },
    {
      label: 'Biggest Shift',
      value: biggestShift && isPro
        ? `${biggestShift.pct >= 0 ? '+' : ''}${biggestShift.pct.toFixed(1)}%`
        : biggestShift ? '--' : 'N/A',
      sub: biggestShift && isPro ? formatModality(biggestShift.modality) : biggestShift ? 'Pro only' : '',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: biggestShift && biggestShift.pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg: biggestShift && biggestShift.pct >= 0 ? 'bg-green-50 dark:bg-green-500/10' : 'bg-red-50 dark:bg-red-500/10',
      locked: !isPro,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {card.label}
            </span>
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color}`}>
              {card.locked ? (
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                card.icon
              )}
            </div>
          </div>
          <div className={`text-2xl font-bold ${card.locked ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
            {card.value}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
