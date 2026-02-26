'use client';

import { formatCurrency } from '@/lib/calculations';
import type { ScenarioResult } from '@/lib/financial/types';

interface DefensiveAnalysis {
  worstCase: ScenarioResult;
  bestCase: ScenarioResult;
  defensiveFloor: number;
  walkAwayThreshold: number;
  narrative: string;
}

interface ScenarioPlannerProps {
  scenarios?: ScenarioResult[];
  defensiveAnalysis?: DefensiveAnalysis;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

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

export default function ScenarioPlanner({
  scenarios,
  defensiveAnalysis,
  tier,
  onUpgrade,
  onBuyReport,
}: ScenarioPlannerProps) {
  if (!scenarios || scenarios.length === 0) return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">Scenario analysis requires an rNPV base case to stress-test.</p>
    </div>
  );

  const hasAccess = tier === 'pro' || tier === 'report';

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Scenario Planner
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}{' '}
                  modeled against base rNPV
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
            {/* Scenario Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {scenarios.map((sr) => {
                const badge = impactBadge(sr.impactPercent);
                const isNegative = sr.impactDelta < 0;

                return (
                  <div
                    key={sr.scenario.id}
                    className={`p-3 rounded-lg border ${
                      isNegative
                        ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5'
                        : 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h6 className="text-xs font-semibold text-navy-800 dark:text-white leading-tight">
                        {sr.scenario.name}
                      </h6>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ${badge.className}`}
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
                          className={`text-sm font-bold ${
                            isNegative
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
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

                    <p className="mt-2 text-[10px] text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
                      {sr.scenario.category}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Defensive Analysis Summary */}
            {defensiveAnalysis && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-500/5 dark:to-orange-500/5 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <h5 className="text-sm font-semibold text-navy-800 dark:text-white mb-3">
                  Defensive Analysis
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
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
                <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                  {defensiveAnalysis.narrative}
                </p>
              </div>
            )}
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Unlock Financial Modeling
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
