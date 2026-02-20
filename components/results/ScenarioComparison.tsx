'use client';

import React from 'react';
import { CalculationResult, formatCurrency } from '@/lib/calculations';
import type { CalculationHistoryItem } from '@/lib/history';

interface ScenarioComparisonProps {
  currentResult: CalculationResult;
  compareItem: CalculationHistoryItem;
  compareLabel: string;
  onClose: () => void;
}

interface ComparisonMetric {
  label: string;
  currentLow: number;
  currentHigh: number;
  currentMedian: number;
  compareLow: number;
  compareHigh: number;
  compareMedian: number;
}

function buildMetrics(
  current: CalculationResult,
  compare: CalculationHistoryItem
): ComparisonMetric[] {
  const { terms } = current;
  const r = compare.results;

  // The history item stores flat results; reconstruct from stored values.
  // For milestone breakdowns, we only have totalValue and upfront in history.
  // We compute milestones from what we do have. Since history doesn't store
  // individual milestone buckets, we show only Total Deal Value, Upfront,
  // and their delta. The remaining milestone-level metrics show "N/A" if
  // not available.

  return [
    {
      label: 'Total Deal Value',
      currentLow: terms.totalDealValue.low,
      currentHigh: terms.totalDealValue.high,
      currentMedian: terms.totalDealValue.median,
      compareLow: r.totalValueLow,
      compareHigh: r.totalValueHigh,
      compareMedian: r.totalValueMedian,
    },
    {
      label: 'Upfront Payment',
      currentLow: terms.upfront.low,
      currentHigh: terms.upfront.high,
      currentMedian: terms.upfront.median,
      compareLow: r.upfrontLow,
      compareHigh: r.upfrontHigh,
      compareMedian: r.upfrontMedian,
    },
    {
      label: 'Development Milestones',
      currentLow: terms.devMilestones.low,
      currentHigh: terms.devMilestones.high,
      currentMedian: terms.devMilestones.median,
      compareLow: 0,
      compareHigh: 0,
      compareMedian: 0,
    },
    {
      label: 'Regulatory Milestones',
      currentLow: terms.regMilestones.low,
      currentHigh: terms.regMilestones.high,
      currentMedian: terms.regMilestones.median,
      compareLow: 0,
      compareHigh: 0,
      compareMedian: 0,
    },
    {
      label: 'Commercial Milestones',
      currentLow: terms.commMilestones.low,
      currentHigh: terms.commMilestones.high,
      currentMedian: terms.commMilestones.median,
      compareLow: 0,
      compareHigh: 0,
      compareMedian: 0,
    },
  ];
}

function DeltaBadge({ currentMedian, compareMedian }: { currentMedian: number; compareMedian: number }) {
  if (compareMedian === 0) {
    return <span className="text-xs text-neutral-400 dark:text-slate-500">--</span>;
  }

  const diff = currentMedian - compareMedian;
  const pctChange = compareMedian !== 0 ? (diff / compareMedian) * 100 : 0;

  if (Math.abs(diff) < 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-500 dark:text-slate-400">
        --
      </span>
    );
  }

  const isPositive = diff > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  const sign = isPositive ? '+' : '';
  const colorClasses = isPositive
    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
    : 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}>
      {arrow} {sign}{formatCurrency(diff)} ({sign}{pctChange.toFixed(1)}%)
    </span>
  );
}

function DeltaBar({ currentMedian, compareMedian }: { currentMedian: number; compareMedian: number }) {
  if (compareMedian === 0) return null;

  const diff = currentMedian - compareMedian;
  const pctChange = compareMedian !== 0 ? Math.abs((diff / compareMedian) * 100) : 0;
  const cappedWidth = Math.min(pctChange, 100);

  if (Math.abs(diff) < 1) return null;

  const isPositive = diff > 0;
  const barColor = isPositive
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : 'bg-gradient-to-r from-red-400 to-red-500';

  return (
    <div className="mt-1.5 h-1 w-full bg-neutral-100 dark:bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${cappedWidth}%` }}
      />
    </div>
  );
}

function RoyaltyRow({
  label,
  currentLow,
  currentHigh,
  compareLow,
  compareHigh,
}: {
  label: string;
  currentLow: number;
  currentHigh: number;
  compareLow: number;
  compareHigh: number;
}) {
  const hasBoth = compareLow > 0 || compareHigh > 0;

  return (
    <div className="py-3 border-b border-neutral-100 dark:border-slate-700 last:border-b-0">
      {/* Desktop layout */}
      <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 sm:items-center">
        <div className="text-sm font-medium text-neutral-600 dark:text-slate-300">
          {label}
        </div>
        <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
          {currentLow}% - {currentHigh}%
        </div>
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {hasBoth ? `${compareLow}% - ${compareHigh}%` : '--'}
        </div>
        <div>
          {hasBoth ? (
            <DeltaBadge
              currentMedian={(currentLow + currentHigh) / 2}
              compareMedian={(compareLow + compareHigh) / 2}
            />
          ) : (
            <span className="text-xs text-neutral-400 dark:text-slate-500">--</span>
          )}
        </div>
      </div>
      {/* Mobile layout */}
      <div className="sm:hidden space-y-2">
        <div className="text-sm font-medium text-neutral-600 dark:text-slate-300">{label}</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-teal-500 dark:text-teal-400 font-medium mb-0.5">Current</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">{currentLow}% - {currentHigh}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400 dark:text-slate-500 font-medium mb-0.5">Previous</div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {hasBoth ? `${compareLow}% - ${compareHigh}%` : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealStructureRow({
  currentResult,
  compareItem,
}: {
  currentResult: CalculationResult;
  compareItem: CalculationHistoryItem;
}) {
  const currentUpfrontPct = currentResult.dealRecommendation.upfrontPercent;
  const currentMilestonePct = currentResult.dealRecommendation.milestonePercent;

  // Reconstruct approx upfront % from history
  const compareUpfrontPct =
    compareItem.results.totalValueMedian > 0
      ? Math.round(
          (compareItem.results.upfrontMedian / compareItem.results.totalValueMedian) * 100
        )
      : 0;
  const compareMilestonePct = 100 - compareUpfrontPct;

  return (
    <div className="py-3">
      {/* Desktop layout */}
      <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 sm:items-center">
        <div className="text-sm font-medium text-neutral-600 dark:text-slate-300">
          Deal Structure
        </div>
        <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
          {currentUpfrontPct}% / {currentMilestonePct}%
        </div>
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {compareUpfrontPct > 0 ? `${compareUpfrontPct}% / ${compareMilestonePct}%` : '--'}
        </div>
        <div>
          <DeltaBadge currentMedian={currentUpfrontPct} compareMedian={compareUpfrontPct} />
        </div>
      </div>
      {/* Mobile layout */}
      <div className="sm:hidden space-y-2">
        <div className="text-sm font-medium text-neutral-600 dark:text-slate-300">Deal Structure (Upfront / Milestones)</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-teal-500 dark:text-teal-400 font-medium mb-0.5">Current</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">{currentUpfrontPct}% / {currentMilestonePct}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400 dark:text-slate-500 font-medium mb-0.5">Previous</div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {compareUpfrontPct > 0 ? `${compareUpfrontPct}% / ${compareMilestonePct}%` : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioComparisonInner({
  currentResult,
  compareItem,
  compareLabel,
  onClose,
}: ScenarioComparisonProps) {
  const metrics = buildMetrics(currentResult, compareItem);

  return (
    <div className="mt-6 sm:mt-8 bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden motion-safe:animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200 dark:border-slate-700 bg-gradient-to-r from-neutral-50 to-slate-50 dark:from-slate-800 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
              Scenario Comparison
            </h3>
            <p className="text-xs text-neutral-500 dark:text-slate-400">
              Current vs. {compareLabel}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close comparison"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Column headers - desktop */}
      <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 px-4 sm:px-6 py-3 bg-neutral-50 dark:bg-slate-800/80 border-b border-neutral-100 dark:border-slate-700">
        <div className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
          Metric
        </div>
        <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          Current
        </div>
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
          Previous
        </div>
        <div className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">
          Delta
        </div>
      </div>

      {/* Metric rows */}
      <div className="px-4 sm:px-6 divide-y divide-neutral-100 dark:divide-slate-700">
        {metrics.map((metric) => (
          <div key={metric.label} className="py-3">
            {/* Desktop layout */}
            <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 sm:items-center">
              <div className="text-sm font-medium text-neutral-600 dark:text-slate-300">
                {metric.label}
              </div>
              <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                {formatCurrency(metric.currentLow)} - {formatCurrency(metric.currentHigh)}
              </div>
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {metric.compareMedian > 0
                  ? `${formatCurrency(metric.compareLow)} - ${formatCurrency(metric.compareHigh)}`
                  : '--'}
              </div>
              <div>
                <DeltaBadge currentMedian={metric.currentMedian} compareMedian={metric.compareMedian} />
                <DeltaBar currentMedian={metric.currentMedian} compareMedian={metric.compareMedian} />
              </div>
            </div>

            {/* Mobile layout - stacked */}
            <div className="sm:hidden space-y-2">
              <div className="text-sm font-medium text-neutral-700 dark:text-slate-200">
                {metric.label}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-teal-500 dark:text-teal-400 font-medium mb-0.5">Current</div>
                  <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                    {formatCurrency(metric.currentLow)} - {formatCurrency(metric.currentHigh)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-400 dark:text-slate-500 font-medium mb-0.5">Previous</div>
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {metric.compareMedian > 0
                      ? `${formatCurrency(metric.compareLow)} - ${formatCurrency(metric.compareHigh)}`
                      : '--'}
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <DeltaBadge currentMedian={metric.currentMedian} compareMedian={metric.compareMedian} />
              </div>
              <DeltaBar currentMedian={metric.currentMedian} compareMedian={metric.compareMedian} />
            </div>
          </div>
        ))}

        {/* Royalties */}
        <div>
          <div className="py-2 mt-1">
            <div className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Royalties
            </div>
          </div>
          <RoyaltyRow
            label="Base (<$500M)"
            currentLow={currentResult.tieredRoyalties.base.low}
            currentHigh={currentResult.tieredRoyalties.base.high}
            compareLow={0}
            compareHigh={0}
          />
          <RoyaltyRow
            label="Mid ($500M-$1B)"
            currentLow={currentResult.tieredRoyalties.midTier.low}
            currentHigh={currentResult.tieredRoyalties.midTier.high}
            compareLow={0}
            compareHigh={0}
          />
          <RoyaltyRow
            label="High (>$1B)"
            currentLow={currentResult.tieredRoyalties.highTier.low}
            currentHigh={currentResult.tieredRoyalties.highTier.high}
            compareLow={0}
            compareHigh={0}
          />
        </div>

        {/* Deal Structure */}
        <DealStructureRow currentResult={currentResult} compareItem={compareItem} />
      </div>

      {/* Footer note */}
      <div className="px-4 sm:px-6 py-3 bg-neutral-50 dark:bg-slate-800/80 border-t border-neutral-100 dark:border-slate-700">
        <p className="text-xs text-neutral-400 dark:text-slate-500">
          Milestone and royalty breakdowns are only available for the current analysis.
          Previous analysis shows total deal value and upfront payment deltas.
        </p>
      </div>
    </div>
  );
}

const ScenarioComparisonPanel = React.memo(ScenarioComparisonInner);
ScenarioComparisonPanel.displayName = 'ScenarioComparisonPanel';

export default ScenarioComparisonPanel;
export type { ScenarioComparisonProps };
