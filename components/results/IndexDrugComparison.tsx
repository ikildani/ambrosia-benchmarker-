'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { findIndexDrug, getIndexDrugsForTA, checkPeakSalesRealism } from '@/lib/financial/index-drugs';
import { Lock, Pill, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IndexDrugComparisonProps {
  modelPeakSalesM: number;
  therapeuticArea: string;
  indication?: string;
  modality?: string;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Confidence badge helper
// ---------------------------------------------------------------------------

function confidenceBadge(confidence: 'high' | 'moderate' | 'low' | 'warning'): {
  label: string;
  className: string;
  icon: 'check' | 'info' | 'alert' | 'warning';
} {
  switch (confidence) {
    case 'high':
      return {
        label: 'High Confidence',
        className: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/25',
        icon: 'check',
      };
    case 'moderate':
      return {
        label: 'Moderate Confidence',
        className: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',
        icon: 'info',
      };
    case 'low':
      return {
        label: 'Low Confidence',
        className: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25',
        icon: 'alert',
      };
    case 'warning':
      return {
        label: 'Warning',
        className: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25 animate-pulse',
        icon: 'warning',
      };
  }
}

function ConfidenceIcon({ type }: { type: 'check' | 'info' | 'alert' | 'warning' }) {
  switch (type) {
    case 'check':
      return <CheckCircle className="w-3.5 h-3.5" />;
    case 'info':
      return <Info className="w-3.5 h-3.5" />;
    case 'alert':
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IndexDrugComparison({
  modelPeakSalesM,
  therapeuticArea,
  indication,
  modality,
  tier,
  onUpgrade,
  onBuyReport,
}: IndexDrugComparisonProps) {
  const hasAccess = tier === 'pro' || tier === 'report';

  const analysis = useMemo(() => {
    return checkPeakSalesRealism(modelPeakSalesM, therapeuticArea, indication, modality);
  }, [modelPeakSalesM, therapeuticArea, indication, modality]);

  const sensitivityTable = useMemo(() => {
    if (!analysis.indexDrug) return [];
    const indexPeak = analysis.indexDrug.peakSalesM;
    const percentages = [0.10, 0.25, 0.50, 0.75, 1.00];
    return percentages.map((pct) => {
      const peakAtPct = indexPeak * pct;
      // Simple rNPV proxy: scale linearly from model peak sales ratio
      const ratio = modelPeakSalesM > 0 ? peakAtPct / modelPeakSalesM : 0;
      return {
        pctLabel: `${(pct * 100).toFixed(0)}%`,
        peakSalesM: peakAtPct,
        // Simplified implied rNPV based on scaling
        impliedScalar: ratio,
      };
    });
  }, [analysis.indexDrug, modelPeakSalesM]);

  const taDrugs = useMemo(() => {
    return getIndexDrugsForTA(therapeuticArea).slice(0, 3);
  }, [therapeuticArea]);

  if (!analysis.indexDrug) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No comparable index drug available for this therapeutic area.
        </p>
      </div>
    );
  }

  const badge = confidenceBadge(analysis.confidence);
  const indexDrug = analysis.indexDrug;

  return (
    <div className="relative mt-6 sm:mt-8" role="region" aria-label="Index Drug Comparison">
      <div className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-soft flex-shrink-0">
                <Pill className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Index Drug Comparison
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  Peak sales benchmarked against marketed drugs
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>
            {/* Index Drug Card */}
            <div className="mb-5 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h5 className="text-sm font-bold text-navy-800 dark:text-white truncate">
                      {indexDrug.name}
                    </h5>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.className}`}>
                      <ConfidenceIcon type={badge.icon} />
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-slate-400">
                    {indexDrug.company} &middot; {indexDrug.indication.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mb-0.5">
                      Index Peak Sales
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(indexDrug.peakSalesM)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-teal-600/70 dark:text-teal-400/70 uppercase tracking-wider mb-0.5">
                      Index Ratio
                    </p>
                    <p className={`text-lg sm:text-xl font-bold ${
                      analysis.indexRatio <= 0.60
                        ? 'text-green-600 dark:text-green-400'
                        : analysis.indexRatio <= 1.0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {(analysis.indexRatio * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Your Model vs Index comparison bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">
                  <span>Your Model: {formatCurrency(modelPeakSalesM)}</span>
                  <span>Index: {formatCurrency(indexDrug.peakSalesM)}</span>
                </div>
                <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  {/* Index drug (full width = 100%) */}
                  <div className="absolute inset-0 bg-emerald-200 dark:bg-emerald-700/40 rounded-full" />
                  {/* Your model */}
                  <div
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                      analysis.indexRatio <= 0.60
                        ? 'bg-green-500'
                        : analysis.indexRatio <= 1.0
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(analysis.indexRatio * 100, 100)}%` }}
                  />
                  {/* Overflow indicator */}
                  {analysis.indexRatio > 1.0 && (
                    <div className="absolute right-0 top-0 h-full w-1 bg-red-600 dark:bg-red-400 animate-pulse rounded-r-full" />
                  )}
                </div>
              </div>
            </div>

            {/* Sensitivity Table */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Peak Sales Sensitivity
              </h5>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-xs" aria-label="Peak sales sensitivity at various percentages of index drug">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-3 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        % of Index
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Peak Sales
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        vs. Your Model
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityTable.map((row) => {
                      const delta = row.peakSalesM - modelPeakSalesM;
                      const deltaPct = modelPeakSalesM > 0 ? (delta / modelPeakSalesM) * 100 : 0;
                      const isClose = Math.abs(deltaPct) < 10;

                      return (
                        <tr
                          key={row.pctLabel}
                          className={`border-b border-slate-100 dark:border-slate-700/50 ${
                            isClose ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                            {row.pctLabel}
                            {isClose && (
                              <span className="ml-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                Your Range
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatCurrency(row.peakSalesM)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-semibold ${
                            delta >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {delta >= 0 ? '+' : ''}{deltaPct.toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Drugs in TA */}
            {taDrugs.length > 1 && (
              <div className="mb-5">
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Top Drugs in {therapeuticArea.charAt(0).toUpperCase() + therapeuticArea.slice(1).replace(/([A-Z])/g, ' $1')}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {taDrugs.map((drug, idx) => (
                    <div
                      key={drug.name}
                      className="p-2.5 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex-shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {drug.name.split(' (')[0]}
                        </p>
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-slate-400">{drug.company}</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        {formatCurrency(drug.peakSalesM)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Narrative */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
              <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                {analysis.narrative}
              </p>
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                aria-label="Unlock Index Drug Comparison"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow hover:scale-105 transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Index Drug Comparison
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
