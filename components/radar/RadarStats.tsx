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

function StatCard({ label, value, subtitle, icon, accent, accentBg }: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1.5 tabular-nums ${accent}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">{subtitle}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl ${accentBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-2.5 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}

export function RadarStats({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
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
        label="Asset Universe"
        value={stats.totalAssets}
        subtitle="Clinical-stage programs indexed"
        accent="text-slate-900 dark:text-slate-100"
        accentBg="bg-slate-100 dark:bg-slate-700"
        icon={
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        }
      />
      <StatCard
        label="Unpartnered"
        value={stats.unpartnered}
        subtitle={`${unpartneredPct}% of universe available`}
        accent="text-emerald-600 dark:text-emerald-400"
        accentBg="bg-emerald-50 dark:bg-emerald-900/20"
        icon={
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label="Active Trials"
        value={stats.activeTrials}
        subtitle="Currently recruiting or running"
        accent="text-blue-600 dark:text-blue-400"
        accentBg="bg-blue-50 dark:bg-blue-900/20"
        icon={
          <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        }
      />
      <StatCard
        label="Top Intent"
        value={stats.topScoringAssets?.[0]?.licensing_intent_score
          ? Math.round(stats.topScoringAssets[0].licensing_intent_score)
          : '—'}
        subtitle={stats.topScoringAssets?.[0]
          ? `${stats.topScoringAssets[0].asset_name} · ${stats.topScoringAssets[0].company_name}`
          : 'No scores yet'}
        accent="text-amber-600 dark:text-amber-400"
        accentBg="bg-amber-50 dark:bg-amber-900/20"
        icon={
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
          </svg>
        }
      />
    </div>
  );
}
