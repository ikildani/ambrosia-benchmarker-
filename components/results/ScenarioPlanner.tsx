'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/calculations';
import type { ScenarioResult, DefensiveAnalysis } from '@/lib/financial/types';
import { LayoutGrid, Lock, Shield, TrendingUp, TrendingDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Category chip colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  regulatory: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  clinical: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
  competitive: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
  commercial: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300',
  pricing: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
};

// ---------------------------------------------------------------------------
// Impact badge helper
// ---------------------------------------------------------------------------

function impactBadge(percent: number): { label: string; className: string } {
  const abs = Math.abs(percent);
  if (abs >= 30) {
    return percent < 0
      ? { label: 'High Risk', className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' }
      : { label: 'High Upside', className: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' };
  }
  if (abs >= 10) {
    return percent < 0
      ? { label: 'Moderate Risk', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' }
      : { label: 'Moderate Upside', className: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300' };
  }
  return { label: 'Low Impact', className: 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300' };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScenarioPlannerProps {
  scenarios?: ScenarioResult[];
  defensiveAnalysis?: DefensiveAnalysis;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScenarioPlanner({
  scenarios,
  defensiveAnalysis,
  tier,
  onUpgrade,
  onBuyReport,
}: ScenarioPlannerProps) {
  // Sort scenarios by impact (worst first) with useMemo
  const sortedScenarios = useMemo(() => {
    if (!scenarios || scenarios.length === 0) return [];
    return [...scenarios].sort((a, b) => a.impactDelta - b.impactDelta);
  }, [scenarios]);

  if (sortedScenarios.length === 0) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Scenario analysis requires an rNPV base case to stress-test.
        </p>
      </div>
    );
  }

  const hasAccess = tier === 'pro' || tier === 'report';

  // Compute range values for the defensive range bar
  const rangeMin = defensiveAnalysis
    ? Math.min(
        defensiveAnalysis.worstCase.adjustedRNPV,
        defensiveAnalysis.walkAwayThreshold,
        defensiveAnalysis.defensiveFloor,
      )
    : 0;
  const rangeMax = defensiveAnalysis
    ? Math.max(
        defensiveAnalysis.bestCase.adjustedRNPV,
        defensiveAnalysis.defensiveFloor,
      )
    : 0;
  const rangeSpan = rangeMax - rangeMin || 1;

  function pctPosition(value: number): number {
    return Math.max(0, Math.min(100, ((value - rangeMin) / rangeSpan) * 100));
  }

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* ---------------------------------------------------------------- */}
          {/* Header                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <LayoutGrid className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Scenario Planner
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {sortedScenarios.length} scenario
                  {sortedScenarios.length !== 1 ? 's' : ''} modeled against base
                  rNPV
                </p>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Blurred wrapper for non-pro users                                */}
          {/* ---------------------------------------------------------------- */}
          <div
            className={
              !hasAccess
                ? 'blur-[6px] pointer-events-none transition-all'
                : 'transition-all'
            }
          >
            {/* -------------------------------------------------------------- */}
            {/* Tornado Impact Summary — Top 5 risks + Top 5 upsides          */}
            {/* -------------------------------------------------------------- */}
            {sortedScenarios.length >= 4 && (() => {
              const topRisks = sortedScenarios.filter(s => s.impactDelta < 0).slice(0, 5);
              const topUpsides = sortedScenarios.filter(s => s.impactDelta > 0).slice(-5).reverse();
              const maxImpact = Math.max(
                ...topRisks.map(s => Math.abs(s.impactPercent)),
                ...topUpsides.map(s => Math.abs(s.impactPercent)),
                1,
              );

              return (
                <div className="mb-5 p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
                  <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Scenario Impact Tornado</h5>
                  <div className="space-y-1.5">
                    {topRisks.map(s => (
                      <div key={s.scenario.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 w-28 sm:w-36 truncate text-right flex-shrink-0">{s.scenario.name}</span>
                        <div className="flex-1 flex justify-end">
                          <div
                            className="h-4 bg-gradient-to-l from-red-500 to-red-300 rounded-l-sm"
                            style={{ width: `${Math.max((Math.abs(s.impactPercent) / maxImpact) * 100, 3)}%` }}
                          />
                        </div>
                        <div className="flex-1" />
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 w-12 flex-shrink-0">{s.impactPercent.toFixed(0)}%</span>
                      </div>
                    ))}
                    {/* Center divider */}
                    <div className="flex items-center gap-2">
                      <span className="w-28 sm:w-36 flex-shrink-0" />
                      <div className="flex-1 h-px bg-slate-300 dark:bg-slate-500" />
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold px-1">BASE</div>
                      <div className="flex-1 h-px bg-slate-300 dark:bg-slate-500" />
                      <span className="w-12 flex-shrink-0" />
                    </div>
                    {topUpsides.map(s => (
                      <div key={s.scenario.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 w-28 sm:w-36 truncate text-right flex-shrink-0">{s.scenario.name}</span>
                        <div className="flex-1" />
                        <div className="flex-1 flex justify-start">
                          <div
                            className="h-4 bg-gradient-to-r from-green-300 to-green-500 rounded-r-sm"
                            style={{ width: `${Math.max((Math.abs(s.impactPercent) / maxImpact) * 100, 3)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 w-12 flex-shrink-0">+{s.impactPercent.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* -------------------------------------------------------------- */}
            {/* Scenario Cards Grid                                            */}
            {/* -------------------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {sortedScenarios.map((sr) => {
                const badge = impactBadge(sr.impactPercent);
                const isNegative = sr.impactDelta < 0;
                const categoryColor =
                  CATEGORY_COLORS[sr.scenario.category] ??
                  'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300';

                const isCompound = sr.scenario.id.startsWith('compound_');

                return (
                  <div
                    key={sr.scenario.id}
                    className={`p-3 rounded-lg border transition-all hover:shadow-soft hover:-translate-y-0.5 cursor-default ${
                      isCompound
                        ? 'border-purple-300 dark:border-purple-500/30 bg-purple-50/50 dark:bg-purple-500/5 ring-1 ring-purple-200 dark:ring-purple-500/20'
                        : isNegative
                        ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5'
                        : 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5'
                    }`}
                  >
                    {/* Category chip at TOP */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${categoryColor}`}
                      >
                        {sr.scenario.category}
                      </span>
                      {isCompound && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                          COMPOUND
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h6 className="text-xs font-semibold text-navy-800 dark:text-white leading-tight">
                        {sr.scenario.name}
                      </h6>
                      <span
                        className={`px-1.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-neutral-500 dark:text-slate-400">
                          rNPV Delta
                        </p>
                        <p
                          className={`text-sm font-bold flex items-center gap-1 ${
                            isNegative
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {isNegative ? (
                            <TrendingDown className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                          {isNegative ? '' : '+'}
                          {formatCurrency(sr.impactDelta)}
                        </p>
                      </div>
                      <p
                        className={`text-lg font-bold ${
                          isNegative
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {isNegative ? '' : '+'}
                        {sr.impactPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------------------- */}
            {/* Defensive Analysis Summary                                     */}
            {/* -------------------------------------------------------------- */}
            {defensiveAnalysis && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-500/5 dark:to-orange-500/5 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h5 className="text-sm font-semibold text-navy-800 dark:text-white">
                    Defensive Analysis
                  </h5>
                </div>

                {/* Key metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Walk-Away Threshold
                    </p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(defensiveAnalysis.walkAwayThreshold)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Defensive Floor
                    </p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(defensiveAnalysis.defensiveFloor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Worst Case
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(defensiveAnalysis.worstCase.adjustedRNPV)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Best Case
                    </p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(defensiveAnalysis.bestCase.adjustedRNPV)}
                    </p>
                  </div>
                </div>

                {/* Defensive range bar */}
                <div className="mb-3">
                  <p className="text-xs text-neutral-500 dark:text-slate-400 mb-1.5">
                    Valuation Range
                  </p>
                  <div className="relative h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                    {/* Gradient bar: red -> amber -> green */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-amber-400 to-green-500 rounded-full" />

                    {/* Walk-away threshold marker */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-red-800 dark:bg-red-300 z-10"
                      style={{
                        left: `${pctPosition(defensiveAnalysis.walkAwayThreshold)}%`,
                      }}
                      title={`Walk-Away: ${formatCurrency(defensiveAnalysis.walkAwayThreshold)}`}
                    />

                    {/* Defensive floor marker */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-amber-800 dark:bg-amber-300 z-10"
                      style={{
                        left: `${pctPosition(defensiveAnalysis.defensiveFloor)}%`,
                      }}
                      title={`Defensive Floor: ${formatCurrency(defensiveAnalysis.defensiveFloor)}`}
                    />
                  </div>

                  {/* Labels beneath the bar */}
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                      Walk-Away
                    </span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Floor
                    </span>
                    <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                      Best Case
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                  {defensiveAnalysis.narrative}
                </p>
              </div>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Pro Gate Overlay                                                  */}
          {/* ---------------------------------------------------------------- */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                aria-label="Unlock Scenario Analysis"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Scenario Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
