'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PulseSnapshot {
  snapshot_date: string;
  week_start: string;
  modality_breakdown: Record<string, { count: number; avg_upfront: number }>;
  [key: string]: unknown;
}

interface BenchmarkSparklinesProps {
  snapshots: PulseSnapshot[];
  isPro: boolean;
}

const MODALITIES_TO_TRACK = ['adc', 'radiopharmaceutical', 'bispecific_antibody', 'car_t', 'small_molecule', 'gene_therapy'];

function formatModality(modality: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', radiopharmaceutical: 'Radiopharm', bispecific_antibody: 'Bispecific',
    car_t: 'CAR-T', small_molecule: 'Small Molecule', gene_therapy: 'Gene Therapy',
  };
  return names[modality] || modality;
}

function formatUsdShort(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${(val / 1e3).toFixed(0)}K`;
}

export default function BenchmarkSparklines({ snapshots, isPro }: BenchmarkSparklinesProps) {
  if (!snapshots || snapshots.length === 0) return null;

  if (snapshots.length < 3) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Benchmark Trends</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Average upfront payment by modality over 12 weeks</p>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/15 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trends Available Soon</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            Benchmark trends require at least 3 weeks of data. Check back in {3 - snapshots.length} week{3 - snapshots.length !== 1 ? 's' : ''} for modality-level trend lines.
          </p>
        </div>
      </div>
    );
  }

  // Reverse to chronological order
  const ordered = [...snapshots].reverse();

  // Build per-modality time series
  const modalityData: Record<string, Array<{ date: string; avg_upfront: number | null }>> = {};

  for (const modality of MODALITIES_TO_TRACK) {
    modalityData[modality] = ordered.map((s) => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avg_upfront: s.modality_breakdown?.[modality]?.avg_upfront ?? null,
    }));
  }

  // Only show modalities that have at least 2 data points
  const activeModalities = MODALITIES_TO_TRACK.filter((m) =>
    modalityData[m].filter((d) => d.avg_upfront != null).length >= 2
  );

  if (activeModalities.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Benchmark Trends</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Average upfront payment by modality over 12 weeks</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="group" aria-label="Benchmark trend sparklines by modality">
        {activeModalities.map((modality) => {
          const data = modalityData[modality];
          const latestValue = data[data.length - 1]?.avg_upfront;
          const firstValue = data.find(d => d.avg_upfront != null)?.avg_upfront;
          const trendDir = latestValue != null && firstValue != null
            ? latestValue > firstValue ? 'trending up' : latestValue < firstValue ? 'trending down' : 'stable'
            : 'insufficient data';
          return (
            <div key={modality} className="relative" role="img" aria-label={`${formatModality(modality)} benchmark trend: ${latestValue != null ? formatUsdShort(latestValue) : 'no data'}, ${trendDir}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatModality(modality)}</span>
                {isPro && data[data.length - 1]?.avg_upfront != null && (
                  <span className="text-xs font-medium text-slate-900 dark:text-white">
                    {formatUsdShort(data[data.length - 1].avg_upfront!)}
                  </span>
                )}
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`gradient-${modality}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    {isPro && (
                      <Tooltip
                        contentStyle={{
                          background: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#fff',
                        }}
                        formatter={(value) => [formatUsdShort(value as number), 'Avg Upfront']}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="avg_upfront"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill={`url(#gradient-${modality})`}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Blur overlay for free */}
              {!isPro && (
                <div className="absolute inset-0 top-8 flex items-center justify-center">
                  <div className="absolute inset-0 backdrop-blur-[2px] bg-white/30 dark:bg-slate-800/30 rounded-lg" />
                  <svg className="w-5 h-5 text-slate-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
