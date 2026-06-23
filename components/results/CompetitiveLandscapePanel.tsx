'use client';

import { useMemo } from 'react';
import { Target, Lock, Users } from 'lucide-react';
import type { CompetitiveLandscape } from '@/lib/financial/types';

interface CompetitiveLandscapePanelProps {
  landscape?: CompetitiveLandscape;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

const PHASE_ORDER = ['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3', 'Approved'];

const DENSITY_TICKS = [0, 25, 50, 75, 100];

/** Phase chip color classes keyed by lowercase phase string. */
const phaseChipColors: Record<string, string> = {
  preclinical:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  'phase 1':
    'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'phase 2':
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'phase 3':
    'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  approved:
    'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
};

function getPhaseChip(phase: string): string {
  return (
    phaseChipColors[phase.toLowerCase()] ||
    'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
  );
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
  // ---- Computed values via useMemo ----
  const computed = useMemo(() => {
    if (!landscape) return null;

    const ls = landscape;
    const density = densityColor(ls.competitiveDensityScore);
    const phaseKeys = Object.keys(ls.byPhase);

    // Build ordered phases: show ALL standard phases (even if zero), plus any extras from data
    const orderedPhases = [
      ...PHASE_ORDER,
      ...phaseKeys.filter(
        (k) => !PHASE_ORDER.some((p) => p.toLowerCase() === k.toLowerCase()),
      ),
    ];

    // Deduplicate (case-insensitive) and collect counts
    const seen = new Set<string>();
    const phasesWithCounts: { label: string; count: number }[] = [];
    for (const phase of orderedPhases) {
      const key = phase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const match = phaseKeys.find((k) => k.toLowerCase() === key);
      phasesWithCounts.push({ label: phase, count: match ? ls.byPhase[match] : 0 });
    }

    const maxPhaseCount = Math.max(
      ...phasesWithCounts.map((p) => p.count),
      1,
    );

    const erosionPct = (ls.marketShareErosionEstimate * 100).toFixed(0);

    return { ls, density, phasesWithCounts, maxPhaseCount, erosionPct };
  }, [landscape]);

  // ---- Empty state ----
  if (!landscape || !computed) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Competitive landscape data is unavailable for this indication.
        </p>
      </div>
    );
  }

  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';
  const { ls, density, phasesWithCounts, maxPhaseCount, erosionPct } = computed;

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-rose-400 to-pink-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* ---- Header ---- */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
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

          {/* ---- Blurred content for non-pro ---- */}
          <div
            className={
              !hasAccess
                ? 'blur-[6px] pointer-events-none transition-all'
                : 'transition-all'
            }
          >
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
              <div className="flex justify-between mt-1 text-xs text-neutral-400 dark:text-slate-500">
                {DENSITY_TICKS.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </div>

            {/* ---- Pipeline by Phase (bar chart -- ALL phases shown) ---- */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Pipeline by Phase
              </h5>
              <div className="space-y-2">
                {phasesWithCounts.map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-28 sm:w-32 flex-shrink-0">
                      {label}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${(count / maxPhaseCount) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Key Metrics Row ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {/* Next Expected Approval -- always rendered */}
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Next Expected Approval
                </p>
                {ls.expectedNextApproval ? (
                  <>
                    <p className="text-sm font-bold text-navy-800 dark:text-white">
                      {ls.expectedNextApproval.year}
                    </p>
                    <p className="text-[10px] text-neutral-400 dark:text-slate-500 truncate">
                      {ls.expectedNextApproval.company}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    None imminent
                  </p>
                )}
              </div>

              {/* Market Share Erosion */}
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Market Share Erosion
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-slate-500 mb-0.5">
                  Est. peak sales reduction
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
                  {erosionPct}%
                </p>
              </div>

              {/* First-Mover Advantage */}
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  First-Mover Advantage
                </p>
                <p className="text-sm font-bold text-navy-800 dark:text-white">
                  {ls.firstMoverAdvantage ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* ---- Key Competitors Section ---- */}
            {ls.keyCompetitors.length > 0 && (
              <div className="mb-5">
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-500" />
                  Key Competitors
                </h5>
                <div className="space-y-0 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                  {ls.keyCompetitors.map((competitor, idx) => (
                    <div
                      key={`${competitor.companyName}-${competitor.assetName}-${idx}`}
                      className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-semibold text-navy-800 dark:text-white truncate"
                            title={competitor.companyName}
                          >
                            {competitor.companyName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPhaseChip(competitor.phase)}`}
                          >
                            {competitor.phase}
                          </span>
                        </div>
                        <p
                          className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5 truncate"
                          title={`${competitor.assetName}${competitor.expectedApprovalYear ? ` \u00B7 Expected approval ${competitor.expectedApprovalYear}` : ''}`}
                        >
                          {competitor.assetName}
                          {competitor.expectedApprovalYear
                            ? ` \u00B7 Expected approval ${competitor.expectedApprovalYear}`
                            : ''}
                        </p>
                        {competitor.differentiator && (
                          <p className="text-xs text-neutral-400 dark:text-slate-500 mt-1 italic">
                            {competitor.differentiator}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---- Narrative Summary ---- */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-rose-50/50 to-pink-50/50 dark:from-rose-500/5 dark:to-pink-500/5 rounded-lg border border-rose-100 dark:border-rose-500/20">
              <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">
                {ls.narrative}
              </p>
            </div>
          </div>

          {/* ---- Pro Gate Overlay ---- */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                aria-label="Unlock Competitive Intelligence"
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Competitive Intelligence
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
