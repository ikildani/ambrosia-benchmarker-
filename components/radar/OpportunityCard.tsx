'use client';

interface DealOpportunity {
  id: string;
  asset_name: string;
  asset_company_name: string;
  acquirer_name: string;
  opportunity_score: number;
  strategic_fit_score: number;
  timing_score: number;
  rationale: string;
  strategic_drivers: string[];
  risk_factors: string[];
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  predicted_total_low: number | null;
  predicted_total_mid: number | null;
  predicted_total_high: number | null;
  gap_type: string | null;
  gap_detail: string | null;
  comp_count: number;
  confidence: number;
}

interface Props {
  opportunity: DealOpportunity;
}

function fmt(val: number | null): string {
  if (val === null) return '—';
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${val.toFixed(0)}M`;
}

const GAP_LABELS: Record<string, { label: string; color: string }> = {
  patent_cliff_replacement: { label: 'Patent Cliff', color: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
  therapeutic_gap:          { label: 'TA Expansion',  color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
  modality_gap:             { label: 'Modality Gap',  color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
  pipeline_stage_gap:       { label: 'Pipeline Gap',  color: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' },
  geographic_gap:           { label: 'Geo Expansion',  color: 'bg-cyan-100 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300' },
  competitive_response:     { label: 'Competitive',   color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
};

export function OpportunityCard({ opportunity: o }: Props) {
  const isHighScore = o.opportunity_score >= 60;
  const gapConfig = GAP_LABELS[o.gap_type || ''] || { label: o.gap_type || '—', color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };

  return (
    <div className={`rounded-xl border p-5 transition-all hover:shadow-lg ${
      isHighScore
        ? 'border-amber-200/60 dark:border-amber-700/30 bg-gradient-to-br from-amber-50/30 via-white to-white dark:from-amber-900/5 dark:via-slate-800/60 dark:to-slate-800/60 hover:shadow-amber-500/5'
        : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 hover:shadow-slate-200/50'
    }`}>
      {isHighScore && <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent rounded-t-xl" />}

      {/* Header: Acquirer → Asset */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{o.acquirer_name}</span>
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">{o.asset_name}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">from {o.asset_company_name}</p>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold tabular-nums ${
            isHighScore
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}>
            {Math.round(o.opportunity_score)}
          </div>
        </div>
      </div>

      {/* Tags: gap type + fit/timing */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${gapConfig.color}`}>
          {gapConfig.label}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          Fit {Math.round(o.strategic_fit_score)}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Timing {Math.round(o.timing_score)}
        </span>
        {o.comp_count > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{o.comp_count} comps</span>
        )}
      </div>

      {/* Predicted terms (if available) */}
      {o.predicted_upfront_mid && (
        <div className="flex items-center gap-4 mb-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/30">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upfront</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmt(o.predicted_upfront_mid)}</p>
            <p className="text-[10px] text-slate-400 tabular-nums">{fmt(o.predicted_upfront_low)}–{fmt(o.predicted_upfront_high)}</p>
          </div>
          {o.predicted_total_mid && (
            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{fmt(o.predicted_total_mid)}</p>
              <p className="text-[10px] text-slate-400 tabular-nums">{fmt(o.predicted_total_low)}–{fmt(o.predicted_total_high)}</p>
            </div>
          )}
        </div>
      )}

      {/* Rationale */}
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 mb-3">{o.rationale}</p>

      {/* Drivers */}
      {o.strategic_drivers?.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {o.strategic_drivers.slice(0, 2).map((d, i) => (
            <span key={i} className="text-emerald-600 dark:text-emerald-400">+ {d}</span>
          ))}
          {o.risk_factors?.slice(0, 1).map((r, i) => (
            <span key={i} className="text-red-400 dark:text-red-400/70">– {r}</span>
          ))}
        </div>
      )}
    </div>
  );
}
