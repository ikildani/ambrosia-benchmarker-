'use client';

import { useMemo, useState } from 'react';
import { Target, Lock } from 'lucide-react';
import type { MilestoneProbabilityResult, MilestoneEntry } from '@/lib/financial/milestone-probability';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MilestoneProbabilityPanelProps {
  milestoneProbabilities: MilestoneProbabilityResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MilestoneCategory = 'development' | 'commercial' | 'regulatory';

const CATEGORY_COLORS: Record<MilestoneCategory, { bar: string; label: string; fill: string }> = {
  development: {
    bar: 'bg-teal-500 dark:bg-teal-400',
    label: 'text-teal-700 dark:text-teal-300',
    fill: '#14b8a6',
  },
  commercial: {
    bar: 'bg-indigo-500 dark:bg-indigo-400',
    label: 'text-indigo-700 dark:text-indigo-300',
    fill: '#6366f1',
  },
  regulatory: {
    bar: 'bg-amber-500 dark:bg-amber-400',
    label: 'text-amber-700 dark:text-amber-300',
    fill: '#f59e0b',
  },
};

function probabilityColor(p: number): string {
  if (p >= 0.7) return 'bg-emerald-500 dark:bg-emerald-400';
  if (p >= 0.4) return 'bg-amber-400 dark:bg-amber-500';
  if (p >= 0.15) return 'bg-orange-400 dark:bg-orange-500';
  return 'bg-red-400 dark:bg-red-500';
}

function probabilityTextColor(p: number): string {
  if (p >= 0.7) return 'text-emerald-700 dark:text-emerald-400';
  if (p >= 0.4) return 'text-amber-600 dark:text-amber-400';
  if (p >= 0.15) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtYears(y: number): string {
  if (y <= 0) return 'Now';
  if (y < 1) return `${Math.round(y * 12)}mo`;
  return `${y.toFixed(1)}yr`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Timeline row for the Gantt-style milestone visualization. */
function TimelineRow({
  entry,
  category,
  maxYears,
  isHovered,
  onHover,
  onLeave,
}: {
  entry: MilestoneEntry;
  category: MilestoneCategory;
  maxYears: number;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const barWidth = Math.max((entry.probability / 1.0) * 100, 3);
  const leftOffset = maxYears > 0 ? (entry.typicalTiming_years / maxYears) * 100 : 0;
  const colors = CATEGORY_COLORS[category];

  return (
    <div
      className={`flex items-center gap-2 py-1.5 group cursor-default transition-all duration-200 ${
        isHovered ? 'bg-slate-50 dark:bg-slate-700/30 rounded' : ''
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Event label */}
      <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 w-28 sm:w-36 flex-shrink-0 text-right truncate">
        {entry.event}
      </span>

      {/* Bar track */}
      <div className="flex-1 relative h-5">
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-700/40 rounded" />

        {/* Position marker + probability bar */}
        <div
          className="absolute top-0 h-full flex items-center"
          style={{ left: `${Math.min(leftOffset, 95)}%` }}
        >
          <div
            className={`h-4 rounded-sm ${colors.bar} transition-all duration-300 ${
              isHovered ? 'opacity-100 shadow-sm' : 'opacity-75 group-hover:opacity-90'
            }`}
            style={{ width: `${barWidth}px`, minWidth: '4px', maxWidth: '80px' }}
          />
        </div>

        {/* Hover tooltip */}
        {isHovered && (
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 bg-slate-800 dark:bg-slate-600 text-white text-[10px] leading-tight rounded px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
            <span className="font-semibold">{entry.event}</span>
            <br />
            <span className="text-slate-300">Prob: {fmtPct(entry.probability)}</span>
            <span className="mx-1 text-slate-500">|</span>
            <span className="text-slate-300">Timing: {fmtYears(entry.typicalTiming_years)}</span>
            <span className="mx-1 text-slate-500">|</span>
            <span className="text-slate-300">Value: {entry.typicalValue_pct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Probability % */}
      <span className={`text-[10px] sm:text-[11px] font-semibold w-11 flex-shrink-0 text-right ${probabilityTextColor(entry.probability)}`}>
        {fmtPct(entry.probability)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MilestoneProbabilityPanel({
  milestoneProbabilities,
  tier,
  onUpgrade,
  onBuyReport,
}: MilestoneProbabilityPanelProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredPayoutYear, setHoveredPayoutYear] = useState<number | null>(null);

  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';
  const data = milestoneProbabilities;

  // -- Memoized computations --

  const allMilestones = useMemo(() => {
    const tagged = (entries: MilestoneEntry[], cat: MilestoneCategory) =>
      entries.map((e) => ({ ...e, category: cat }));
    return [
      ...tagged(data.developmentMilestones, 'development'),
      ...tagged(data.commercialMilestones, 'commercial'),
      ...tagged(data.regulatoryMilestones, 'regulatory'),
    ];
  }, [data]);

  const maxTimingYears = useMemo(
    () => Math.max(...allMilestones.map((m) => m.typicalTiming_years), 1),
    [allMilestones],
  );

  const payoutMax = useMemo(
    () => Math.max(...data.expectedPayoutSchedule.map((p) => p.expectedPayout_pct), 0.01),
    [data],
  );

  const totalAllocatedPct = useMemo(
    () => allMilestones.reduce((s, m) => s + m.typicalValue_pct, 0),
    [allMilestones],
  );

  const highProbCount = useMemo(
    () => data.developmentMilestones.filter((m) => m.probability >= 0.5).length,
    [data],
  );

  if (!data) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="relative mt-6 sm:mt-8">
      {/* Gradient border wrapper */}
      <div className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 p-[1px]">
        <div className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${!hasAccess ? 'select-none' : ''}`}>

          {/* ---- Header ---- */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-soft flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Milestone Probability Analysis
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  Cascading conditional probabilities across development, commercial &amp; regulatory milestones
                </p>
              </div>
            </div>
          </div>

          {/* ---- Blur wrapper for non-pro ---- */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>

            {/* ---- KPI Row ---- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {/* P-weighted total */}
              <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20">
                <p className="text-[10px] font-medium text-teal-500/70 dark:text-teal-400/70 uppercase tracking-wider">
                  P-Weighted Value
                </p>
                <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                  {data.probabilityWeightedTotalValue.toFixed(1)}%
                </p>
                <p className="text-[10px] text-teal-500/50 dark:text-teal-400/40 mt-0.5">
                  of headline deal value
                </p>
              </div>
              {/* Total milestone allocation */}
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-[10px] font-medium text-indigo-500/70 dark:text-indigo-400/70 uppercase tracking-wider">
                  Total Allocated
                </p>
                <p className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {totalAllocatedPct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-indigo-500/50 dark:text-indigo-400/40 mt-0.5">
                  across all milestones
                </p>
              </div>
              {/* High-probability milestones */}
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                <p className="text-[10px] font-medium text-emerald-500/70 dark:text-emerald-400/70 uppercase tracking-wider">
                  High Prob (&gt;50%)
                </p>
                <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {highProbCount}
                  <span className="text-sm font-normal text-emerald-500/60 dark:text-emerald-400/50"> / 12</span>
                </p>
                <p className="text-[10px] text-emerald-500/50 dark:text-emerald-400/40 mt-0.5">
                  dev milestones
                </p>
              </div>
              {/* Payout years */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                <p className="text-[10px] font-medium text-amber-500/70 dark:text-amber-400/70 uppercase tracking-wider">
                  Payout Horizon
                </p>
                <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {Math.ceil(maxTimingYears)}
                  <span className="text-sm font-normal text-amber-500/60 dark:text-amber-400/50"> yr</span>
                </p>
                <p className="text-[10px] text-amber-500/50 dark:text-amber-400/40 mt-0.5">
                  to final milestone
                </p>
              </div>
            </div>

            {/* ---- Milestone Timeline (Gantt-style) ---- */}
            <div className="mb-5">
              <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wider">
                Milestone Timeline
              </h5>
              <div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                {/* X-axis year markers */}
                <div className="flex items-center justify-between mb-1 px-[7.5rem] sm:px-[9.5rem]">
                  {Array.from({ length: Math.min(Math.ceil(maxTimingYears) + 1, 16) }, (_, i) => (
                    <span
                      key={i}
                      className="text-[9px] text-slate-400 dark:text-slate-500 font-medium"
                      style={{ position: 'absolute', left: `calc(${(i / maxTimingYears) * 100}% + 7.5rem)` }}
                    >
                      {i === 0 ? 'Sign' : `Y${i}`}
                    </span>
                  ))}
                </div>
                <div className="relative mt-3">
                  {/* Category: Development */}
                  <div className="mb-1">
                    <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                      Development
                    </span>
                  </div>
                  {data.developmentMilestones
                    .filter((m) => m.typicalValue_pct > 0)
                    .map((m) => (
                      <TimelineRow
                        key={m.event}
                        entry={m}
                        category="development"
                        maxYears={maxTimingYears}
                        isHovered={hoveredRow === m.event}
                        onHover={() => setHoveredRow(m.event)}
                        onLeave={() => setHoveredRow(null)}
                      />
                    ))}

                  {/* Category: Commercial */}
                  <div className="mt-3 mb-1">
                    <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                      Commercial
                    </span>
                  </div>
                  {data.commercialMilestones.map((m) => (
                    <TimelineRow
                      key={m.event}
                      entry={m}
                      category="commercial"
                      maxYears={maxTimingYears}
                      isHovered={hoveredRow === m.event}
                      onHover={() => setHoveredRow(m.event)}
                      onLeave={() => setHoveredRow(null)}
                    />
                  ))}

                  {/* Category: Regulatory */}
                  <div className="mt-3 mb-1">
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                      Regulatory
                    </span>
                  </div>
                  {data.regulatoryMilestones.map((m) => (
                    <TimelineRow
                      key={m.event}
                      entry={m}
                      category="regulatory"
                      maxYears={maxTimingYears}
                      isHovered={hoveredRow === m.event}
                      onHover={() => setHoveredRow(m.event)}
                      onLeave={() => setHoveredRow(null)}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                  {(['development', 'commercial', 'regulatory'] as MilestoneCategory[]).map((cat) => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${CATEGORY_COLORS[cat].bar}`} />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ---- Payout Schedule (inline bar chart) ---- */}
            <div className="mb-5">
              <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wider">
                Expected Payout Schedule
              </h5>
              <div className="relative bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
                <div className="flex items-end gap-[2px] h-32 sm:h-40">
                  {data.expectedPayoutSchedule.map((payout) => {
                    const heightPct = (payout.expectedPayout_pct / payoutMax) * 100;
                    const isHovered = hoveredPayoutYear === payout.year;

                    // Determine dominant category for coloring
                    const devCount = payout.milestones.filter((m) =>
                      data.developmentMilestones.some((d) => d.event === m),
                    ).length;
                    const comCount = payout.milestones.filter((m) =>
                      data.commercialMilestones.some((c) => c.event === m),
                    ).length;
                    const regCount = payout.milestones.filter((m) =>
                      data.regulatoryMilestones.some((r) => r.event === m),
                    ).length;
                    let barColor = CATEGORY_COLORS.development.bar;
                    if (comCount > devCount && comCount >= regCount) barColor = CATEGORY_COLORS.commercial.bar;
                    else if (regCount > devCount && regCount > comCount) barColor = CATEGORY_COLORS.regulatory.bar;

                    return (
                      <div
                        key={payout.year}
                        className="relative flex-1 flex flex-col items-center justify-end h-full"
                        onMouseEnter={() => setHoveredPayoutYear(payout.year)}
                        onMouseLeave={() => setHoveredPayoutYear(null)}
                      >
                        {/* Hover tooltip */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-2 z-10 bg-slate-800 dark:bg-slate-600 text-white text-[10px] leading-tight rounded px-2 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
                            <span className="font-semibold">Year {payout.year}</span>
                            <br />
                            <span className="text-slate-300">
                              Expected: {payout.expectedPayout_pct.toFixed(2)}% of TDV
                            </span>
                            <br />
                            <span className="text-slate-400 text-[9px]">
                              {payout.milestones.slice(0, 3).join(', ')}
                              {payout.milestones.length > 3 ? ` +${payout.milestones.length - 3} more` : ''}
                            </span>
                          </div>
                        )}
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t-sm transition-all duration-200 cursor-pointer ${barColor} ${
                            isHovered ? 'opacity-100 scale-x-110' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                        {/* Year label */}
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                          {payout.year === 0 ? 'Sign' : `Y${payout.year}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ---- Scrollable Milestone Table ---- */}
            <div>
              <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wider">
                All Milestones
              </h5>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="w-full text-[11px] sm:text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700 z-10">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-slate-600 dark:text-slate-300">Event</th>
                      <th className="text-left py-2 px-2 font-semibold text-slate-600 dark:text-slate-300 w-36">Probability</th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-600 dark:text-slate-300 w-16">Timing</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-600 dark:text-slate-300 w-16">Value %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMilestones
                      .filter((m) => m.typicalValue_pct > 0 || m.probability > 0)
                      .map((m) => {
                        const catColors = CATEGORY_COLORS[m.category];
                        return (
                          <tr
                            key={`${m.category}-${m.event}`}
                            className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${catColors.bar}`} />
                                <span className="text-slate-700 dark:text-slate-200">{m.event}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${probabilityColor(m.probability)}`}
                                    style={{ width: `${Math.max(m.probability * 100, 1)}%` }}
                                  />
                                </div>
                                <span className={`font-semibold flex-shrink-0 ${probabilityTextColor(m.probability)}`}>
                                  {fmtPct(m.probability)}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                              {fmtYears(m.typicalTiming_years)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-200">
                              {m.typicalValue_pct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ---- Narrative ---- */}
            {data.narrative && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {data.narrative}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Pro Gate Overlay ---- */}
      {!hasAccess && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
          <button
            onClick={() => (onBuyReport ? onBuyReport() : onUpgrade?.())}
            aria-label="Unlock Milestone Probability Analysis"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
          >
            <Lock className="w-4 h-4" />
            Unlock Milestone Analysis
          </button>
        </div>
      )}
    </div>
  );
}
