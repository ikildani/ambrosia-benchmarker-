'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';
import {
  findIndexDrug,
  getIndexDrugsForTA,
  checkPeakSalesRealism,
  findTopComparables,
  type ComparableResult,
  type PhaseAdjustedConfidence,
} from '@/lib/financial/index-drugs';
import { Lock, Pill, AlertTriangle, CheckCircle, Info, TrendingUp, BarChart3, Target } from 'lucide-react';
import { formatModality } from '@/lib/config/modality-display';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IndexDrugComparisonProps {
  modelPeakSalesM: number;
  therapeuticArea: string;
  indication?: string;
  modality?: string;
  phase?: string;
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
        className: 'bg-green-500/15 text-green-400 border-green-500/25',
        icon: 'check',
      };
    case 'moderate':
      return {
        label: 'Moderate Confidence',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        icon: 'info',
      };
    case 'low':
      return {
        label: 'Low Confidence',
        className: 'bg-red-500/15 text-red-400 border-red-500/25',
        icon: 'alert',
      };
    case 'warning':
      return {
        label: 'Warning',
        className: 'bg-red-500/15 text-red-400 border-red-500/25 animate-pulse',
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
// Format TA name
// ---------------------------------------------------------------------------

function formatTA(ta: string): string {
  return ta.charAt(0).toUpperCase() + ta.slice(1).replace(/([A-Z])/g, ' $1');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IndexDrugComparison({
  modelPeakSalesM,
  therapeuticArea,
  indication,
  modality,
  phase,
  tier,
  onUpgrade,
  onBuyReport,
}: IndexDrugComparisonProps) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const analysis = useMemo(() => {
    return checkPeakSalesRealism(modelPeakSalesM, therapeuticArea, indication, modality, phase);
  }, [modelPeakSalesM, therapeuticArea, indication, modality, phase]);

  const sensitivityTable = useMemo(() => {
    const primaryDrug = analysis.topComparables[0]?.drug ?? analysis.indexDrug;
    if (!primaryDrug) return [];
    const indexPeak = primaryDrug.peakSalesM;
    const percentages = [0.25, 0.50, 0.75, 1.00];
    return percentages.map((pct) => {
      const peakAtPct = indexPeak * pct;
      const ratio = modelPeakSalesM > 0 ? peakAtPct / modelPeakSalesM : 0;
      return {
        pctLabel: `${(pct * 100).toFixed(0)}%`,
        peakSalesM: peakAtPct,
        impliedScalar: ratio,
      };
    });
  }, [analysis.topComparables, analysis.indexDrug, modelPeakSalesM]);

  const allTaDrugs = useMemo(() => {
    return getIndexDrugsForTA(therapeuticArea);
  }, [therapeuticArea]);

  // Distribution stats
  const distributionStats = useMemo(() => {
    if (allTaDrugs.length === 0) return null;
    const sorted = [...allTaDrugs].sort((a, b) => a.peakSalesM - b.peakSalesM);
    const min = sorted[0].peakSalesM;
    const max = sorted[sorted.length - 1].peakSalesM;
    const medianIdx = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[medianIdx - 1].peakSalesM + sorted[medianIdx].peakSalesM) / 2
      : sorted[medianIdx].peakSalesM;
    return { min, max, median, drugs: sorted };
  }, [allTaDrugs]);

  const effectiveConfidence = analysis.phaseAdjustedConfidence?.adjustedConfidence ?? analysis.confidence;
  const badge = confidenceBadge(effectiveConfidence);

  if (!analysis.indexDrug && analysis.topComparables.length === 0) {
    return (
      <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-400">
          No comparable index drug available for this therapeutic area.
        </p>
      </div>
    );
  }

  const primaryComparable = analysis.topComparables[0] ?? null;
  const primaryDrug = primaryComparable?.drug ?? analysis.indexDrug;

  return (
    <div className="relative mt-6 sm:mt-8" role="region" aria-label="Index Drug Comparison">
      <div className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Header                                                          */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Pill className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base">
                  Index Drug Comparison
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Peak sales benchmarked against {allTaDrugs.length} marketed drugs in {formatTA(therapeuticArea)}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border ${badge.className}`}>
              <ConfidenceIcon type={badge.icon} />
              {badge.label}
            </span>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>

            {/* ---------------------------------------------------------------- */}
            {/* 1. Primary Comparison Card                                       */}
            {/* ---------------------------------------------------------------- */}
            {primaryDrug && (
              <div className="mb-5 p-4 sm:p-5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-lg border border-emerald-500/20">
                {/* Drug info row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h5 className="text-base sm:text-lg font-bold text-white">
                        {primaryDrug.name}
                      </h5>
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {formatModality(primaryDrug.modality)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {primaryDrug.company} &middot; {primaryDrug.indication.replace(/_/g, ' ')}
                    </p>
                    {/* Match quality indicators */}
                    {primaryComparable && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {primaryComparable.matchReasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded bg-slate-700/80 text-slate-300 border border-slate-600/50"
                          >
                            <Target className="w-2.5 h-2.5" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {primaryComparable && (
                    <div className="flex-shrink-0 text-center px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600/50">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Match Score</p>
                      <p className="text-xl font-bold text-emerald-400">
                        {primaryComparable.score.toFixed(0)}
                      </p>
                      <p className="text-[9px] text-slate-500">/105</p>
                    </div>
                  )}
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600/30 text-center">
                    <p className="text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-1">
                      Your Model
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-white">
                      {formatCurrency(modelPeakSalesM)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-700/40 rounded-lg border border-slate-600/30 text-center">
                    <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-1">
                      Index Peak Sales
                    </p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-400">
                      {formatCurrency(primaryDrug.peakSalesM)}
                    </p>
                  </div>
                </div>

                {/* Visual bar comparison */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <span>Your Model: {formatCurrency(modelPeakSalesM)}</span>
                    <span>
                      {(analysis.indexRatio * 100).toFixed(0)}% of Index
                    </span>
                  </div>
                  <div className="relative h-4 bg-slate-700 rounded-full overflow-hidden">
                    {/* Index drug background (100%) */}
                    <div className="absolute inset-0 bg-emerald-700/30 rounded-full" />
                    {/* Your model bar */}
                    <div
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
                        analysis.indexRatio <= 0.60
                          ? 'bg-gradient-to-r from-green-500 to-green-400'
                          : analysis.indexRatio <= 1.0
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-red-500 to-red-400'
                      }`}
                      style={{ width: `${Math.min(analysis.indexRatio * 100, 100)}%` }}
                    />
                    {/* Overflow indicator */}
                    {analysis.indexRatio > 1.0 && (
                      <div className="absolute right-0 top-0 h-full w-1.5 bg-red-400 animate-pulse rounded-r-full" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 2. Top 3 Comparables Table                                       */}
            {/* ---------------------------------------------------------------- */}
            {analysis.topComparables.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <h5 className="text-sm font-semibold text-slate-200">
                    Top Comparable Drugs
                  </h5>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-xs" aria-label="Top 3 comparable index drugs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2.5 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Drug</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px] hidden sm:table-cell">Company</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Peak Sales</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px] hidden sm:table-cell">Modality</th>
                        <th className="text-right py-2.5 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.topComparables.map((comp, idx) => {
                        const isPrimary = idx === 0;
                        const scoreWidth = Math.min(100, (comp.score / 105) * 100);
                        return (
                          <tr
                            key={comp.drug.name}
                            className={`border-b border-slate-700/50 ${
                              isPrimary ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full flex-shrink-0 ${
                                  isPrimary
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'
                                    : 'bg-slate-700 text-slate-400'
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className={`font-semibold truncate max-w-[140px] sm:max-w-none ${
                                  isPrimary ? 'text-white' : 'text-slate-300'
                                }`}>
                                  {comp.drug.name.split(' (')[0]}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">{comp.drug.company}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {formatCurrency(comp.drug.peakSalesM)}
                            </td>
                            <td className="py-2.5 px-3 hidden sm:table-cell">
                              <span className="inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-700 text-slate-300 border border-slate-600">
                                {formatModality(comp.drug.modality)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full rounded-full ${
                                      isPrimary ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`}
                                    style={{ width: `${scoreWidth}%` }}
                                  />
                                </div>
                                <span className={`font-mono font-bold text-[11px] ${
                                  isPrimary ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {comp.score.toFixed(0)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 3. Distribution Context — Dot Plot                               */}
            {/* ---------------------------------------------------------------- */}
            {distributionStats && distributionStats.drugs.length > 1 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <h5 className="text-sm font-semibold text-slate-200">
                    TA Distribution Context
                  </h5>
                </div>
                <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/40">
                  {/* Labels row */}
                  <div className="flex items-center justify-between text-[9px] text-slate-500 mb-2">
                    <span>Min: {formatCurrency(distributionStats.min)}</span>
                    <span>Median: {formatCurrency(distributionStats.median)}</span>
                    <span>Max: {formatCurrency(distributionStats.max)}</span>
                  </div>
                  {/* Strip chart */}
                  <div className="relative h-10 bg-slate-700/50 rounded-lg overflow-visible">
                    {/* Use log scale for better distribution */}
                    {(() => {
                      const logMin = Math.log(Math.max(distributionStats.min, 1));
                      const logMax = Math.log(Math.max(distributionStats.max, 1));
                      const logRange = logMax - logMin || 1;
                      const getPos = (val: number) =>
                        ((Math.log(Math.max(val, 1)) - logMin) / logRange) * 100;

                      const modelPos = Math.min(100, Math.max(0, getPos(modelPeakSalesM)));
                      const medianPos = getPos(distributionStats.median);

                      return (
                        <>
                          {/* Median line */}
                          <div
                            className="absolute top-0 h-full w-px bg-slate-500/50"
                            style={{ left: `${medianPos}%` }}
                          />
                          {/* Drug dots */}
                          {distributionStats.drugs.map((drug, i) => {
                            const pos = getPos(drug.peakSalesM);
                            const isPrimaryMatch = primaryDrug && drug.name === primaryDrug.name;
                            return (
                              <div
                                key={`${drug.name}-${i}`}
                                className={`absolute top-1/2 -translate-y-1/2 rounded-full ${
                                  isPrimaryMatch
                                    ? 'w-3 h-3 bg-emerald-400 border-2 border-emerald-300 z-20'
                                    : 'w-2 h-2 bg-slate-500/60 z-10'
                                }`}
                                style={{ left: `${pos}%`, marginLeft: isPrimaryMatch ? '-6px' : '-4px' }}
                                title={`${drug.name}: ${formatCurrency(drug.peakSalesM)}`}
                              />
                            );
                          })}
                          {/* Model marker */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 z-30"
                            style={{ left: `${modelPos}%`, marginLeft: '-7px' }}
                            title={`Your Model: ${formatCurrency(modelPeakSalesM)}`}
                          >
                            <div className="w-3.5 h-3.5 rotate-45 bg-teal-400 border-2 border-teal-200 shadow-lg shadow-teal-400/30" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 text-[9px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-slate-500/60" />
                      <span>Marketed drugs ({distributionStats.drugs.length})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-300" />
                      <span>Primary match</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rotate-45 bg-teal-400 border border-teal-200" />
                      <span>Your model</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 4. Phase-Adjusted Narrative                                       */}
            {/* ---------------------------------------------------------------- */}
            {analysis.phaseAdjustedConfidence?.wasAdjusted && (
              <div className="mb-5 p-3 bg-slate-700/30 rounded-lg border border-slate-600/40 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Phase Adjustment Applied
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {analysis.phaseAdjustedConfidence.phaseNarrative}
                  </p>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 5. Sensitivity Mini-Table                                         */}
            {/* ---------------------------------------------------------------- */}
            {sensitivityTable.length > 0 && primaryDrug && (
              <div className="mb-5">
                <h5 className="text-sm font-semibold text-slate-200 mb-3">
                  Peak Sales Sensitivity vs. {primaryDrug.name.split(' (')[0]}
                </h5>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full text-xs" aria-label="Peak sales sensitivity at various percentages of index drug">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                          % of Index
                        </th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                          Peak Sales
                        </th>
                        <th className="text-right py-2 px-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
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
                            className={`border-b border-slate-700/50 ${
                              isClose ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-semibold text-slate-200">
                              {row.pctLabel}
                              {isClose && (
                                <span className="ml-1.5 text-[9px] font-bold text-emerald-400 uppercase">
                                  Your Range
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">
                              {formatCurrency(row.peakSalesM)}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-semibold ${
                              delta >= 0
                                ? 'text-green-400'
                                : 'text-red-400'
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
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Narrative                                                         */}
            {/* ---------------------------------------------------------------- */}
            <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/40">
              <p className="text-xs text-slate-400 leading-relaxed">
                {analysis.narrative}
              </p>
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                aria-label="Unlock Index Drug Comparison"
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-teal-500/25 hover:scale-105 transition-all"
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
