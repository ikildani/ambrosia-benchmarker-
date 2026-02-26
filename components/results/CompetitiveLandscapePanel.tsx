'use client';

import type { CompetitiveLandscape } from '@/lib/financial/types';

interface CompetitiveLandscapePanelProps {
  landscape?: CompetitiveLandscape;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

function densityColor(score: number): {
  meter: string;
  badge: string;
  label: string;
} {
  if (score < 30) {
    return {
      meter: 'bg-green-500',
      badge:
        'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
      label: 'Low',
    };
  }
  if (score <= 60) {
    return {
      meter: 'bg-amber-500',
      badge:
        'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
      label: 'Moderate',
    };
  }
  return {
    meter: 'bg-red-500',
    badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
    label: 'High',
  };
}

export default function CompetitiveLandscapePanel({
  landscape,
  tier,
  onUpgrade,
  onBuyReport,
}: CompetitiveLandscapePanelProps) {
  if (!landscape) return null;

  const hasAccess = tier === 'pro' || tier === 'report';
  const ls = landscape;
  const density = densityColor(ls.competitiveDensityScore);

  // Phase display order for the bar chart
  const phaseOrder = ['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3', 'Approved'];
  const phaseKeys = Object.keys(ls.byPhase);
  const maxPhaseCount = Math.max(...Object.values(ls.byPhase), 1);

  // Map byPhase keys to display order -- show known phases first, then any extras
  const orderedPhases = [
    ...phaseOrder.filter((p) => {
      // Case-insensitive match against byPhase keys
      return phaseKeys.some(
        (k) => k.toLowerCase() === p.toLowerCase()
      );
    }),
    ...phaseKeys.filter(
      (k) => !phaseOrder.some((p) => p.toLowerCase() === k.toLowerCase())
    ),
  ];

  function getPhaseCount(displayLabel: string): number {
    // Find matching key in byPhase (case-insensitive)
    const match = phaseKeys.find(
      (k) => k.toLowerCase() === displayLabel.toLowerCase()
    );
    return match ? ls.byPhase[match] : 0;
  }

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-soft flex-shrink-0">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Competitive Landscape
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {ls.indication} &middot; {ls.totalCompetingAssets} competing
                  assets
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
            {/* Density Score Meter */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide">
                  Competitive Density Score
                </p>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${density.badge}`}
                >
                  {density.label}
                </span>
              </div>
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                {/* Background gradient: green -> yellow -> red */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-300 via-amber-300 to-red-400 dark:from-green-600 dark:via-amber-600 dark:to-red-600 opacity-20 rounded-full" />
                <div
                  className={`h-full ${density.meter} rounded-full transition-all duration-700 relative z-10`}
                  style={{
                    width: `${Math.min(ls.competitiveDensityScore, 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-neutral-400 dark:text-slate-500">
                <span>0</span>
                <span>30</span>
                <span>60</span>
                <span>100</span>
              </div>
            </div>

            {/* Competitors by Phase - Bar Visualization */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Pipeline by Phase
              </h5>
              <div className="space-y-2">
                {orderedPhases.map((phase) => {
                  const count = getPhaseCount(phase);
                  if (count === 0) return null;
                  return (
                    <div key={phase} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 dark:text-slate-400 w-20 sm:w-24 flex-shrink-0 truncate">
                        {phase}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(count / maxPhaseCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {ls.expectedNextApproval && (
                <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                  <p className="text-xs text-neutral-500 dark:text-slate-400">
                    Next Expected Approval
                  </p>
                  <p className="text-sm font-bold text-navy-800 dark:text-white">
                    {ls.expectedNextApproval.year}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-slate-500 truncate">
                    {ls.expectedNextApproval.company}
                  </p>
                </div>
              )}
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Market Share Erosion
                </p>
                <p
                  className={`text-sm font-bold ${
                    ls.marketShareErosionEstimate > 0.3
                      ? 'text-red-600 dark:text-red-400'
                      : ls.marketShareErosionEstimate > 0.15
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {(ls.marketShareErosionEstimate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  First-Mover Advantage
                </p>
                <p className="text-sm font-bold text-navy-800 dark:text-white">
                  {ls.firstMoverAdvantage ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* Narrative Summary */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-rose-50/50 to-pink-50/50 dark:from-rose-500/5 dark:to-pink-500/5 rounded-lg border border-rose-100 dark:border-rose-500/20">
              <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">
                {ls.narrative}
              </p>
            </div>
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
