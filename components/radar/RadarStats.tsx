'use client';

interface StatsData {
  totalAssets: number;
  unpartnered: number;
  activeTrials: number;
  topScoringAssets: {
    id: string;
    company_name: string;
    asset_name: string;
    therapeutic_area: string | null;
    modality: string | null;
    phase: string | null;
    licensing_intent_score: number;
    deal_readiness_score: number;
    competitive_heat: number;
  }[];
}

interface Props {
  stats: StatsData | null;
  loading: boolean;
}

function StatCard({ label, value, subtitle, accent }: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || 'text-slate-900 dark:text-slate-100'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export function RadarStats({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
            <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const unpartneredPct = stats.totalAssets > 0
    ? Math.round((stats.unpartnered / stats.totalAssets) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Assets"
        value={stats.totalAssets}
        subtitle="Clinical-stage programs indexed"
      />
      <StatCard
        label="Unpartnered"
        value={stats.unpartnered}
        subtitle={`${unpartneredPct}% of universe`}
        accent="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        label="Active Trials"
        value={stats.activeTrials}
        subtitle="Currently recruiting or active"
        accent="text-blue-600 dark:text-blue-400"
      />
      <StatCard
        label="Top Intent Score"
        value={stats.topScoringAssets?.[0]?.licensing_intent_score
          ? Math.round(stats.topScoringAssets[0].licensing_intent_score)
          : '—'}
        subtitle={stats.topScoringAssets?.[0]?.asset_name || 'No scores yet'}
        accent="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}
