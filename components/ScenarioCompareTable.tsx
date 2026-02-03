'use client';

import { useState } from 'react';
import {
  SavedScenario,
  COMPARISON_METRICS,
  calculateDifference,
  formatDifference,
  ComparisonMetric,
} from '@/lib/scenarioComparison';

interface ScenarioCompareTableProps {
  scenarios: SavedScenario[];
  onAddScenario?: () => void;
  onRemoveScenario?: (id: string) => void;
  maxScenarios?: number;
}

export default function ScenarioCompareTable({
  scenarios,
  onAddScenario,
  onRemoveScenario,
  maxScenarios = 4,
}: ScenarioCompareTableProps) {
  const [baselineIndex, setBaselineIndex] = useState(0);

  const baselineScenario = scenarios[baselineIndex];
  const canAddMore = scenarios.length < maxScenarios && onAddScenario;

  // Group metrics by category
  const dealInfoMetrics = COMPARISON_METRICS.filter((m) => m.category === 'dealInfo');
  const financialMetrics = COMPARISON_METRICS.filter((m) => m.category === 'financial');
  const derivedMetrics = COMPARISON_METRICS.filter((m) => m.category === 'derived');

  const renderMetricRow = (metric: ComparisonMetric) => {
    const baseValue = metric.getNumericValue?.(baselineScenario);

    return (
      <tr key={metric.key} className="border-t border-neutral-100 dark:border-neutral-700">
        <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 font-medium">
          {metric.label}
        </td>
        {scenarios.map((scenario, idx) => {
          const value = metric.getValue(scenario);
          const numericValue = metric.getNumericValue?.(scenario);
          const showDiff =
            idx !== baselineIndex && baseValue !== undefined && numericValue !== undefined;
          const diff = showDiff ? calculateDifference(baseValue, numericValue) : null;

          return (
            <td key={scenario.id} className="px-4 py-3 text-sm text-right">
              <div
                className={
                  metric.category === 'financial'
                    ? 'font-bold text-navy-800 dark:text-white'
                    : 'text-neutral-700 dark:text-neutral-300'
                }
              >
                {value}
              </div>
              {diff && diff.direction !== 'neutral' && (
                <div
                  className={`text-xs mt-0.5 ${
                    diff.direction === 'increase'
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {formatDifference(diff)}
                </div>
              )}
            </td>
          );
        })}
        {canAddMore && <td className="px-4 py-3" />}
      </tr>
    );
  };

  const renderSectionHeader = (title: string) => (
    <tr className="bg-neutral-50/50 dark:bg-neutral-800/50">
      <td
        colSpan={scenarios.length + (canAddMore ? 2 : 1)}
        className="px-4 py-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide"
      >
        {title}
      </td>
    </tr>
  );

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase w-32">
                Metric
              </th>
              {scenarios.map((s, idx) => (
                <th key={s.id} className="px-4 py-3 text-right min-w-[150px]">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate max-w-[120px]">
                      {s.name}
                    </span>
                    {idx === baselineIndex && (
                      <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-[10px] rounded font-medium">
                        BASE
                      </span>
                    )}
                    {onRemoveScenario && scenarios.length > 1 && (
                      <button
                        onClick={() => onRemoveScenario(s.id)}
                        className="p-1 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove from comparison"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {idx !== baselineIndex && (
                    <button
                      onClick={() => setBaselineIndex(idx)}
                      className="text-[10px] text-neutral-400 hover:text-teal-600 dark:hover:text-teal-400 mt-0.5 transition-colors"
                    >
                      Set as baseline
                    </button>
                  )}
                </th>
              ))}
              {canAddMore && (
                <th className="px-4 py-3 text-center min-w-[100px]">
                  <button
                    onClick={onAddScenario}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Deal Info Section */}
            {renderSectionHeader('Deal Information')}
            {dealInfoMetrics.map(renderMetricRow)}

            {/* Financial Section */}
            {renderSectionHeader('Financial Terms')}
            {financialMetrics.map(renderMetricRow)}

            {/* Derived Metrics Section */}
            {renderSectionHeader('Analysis')}
            {derivedMetrics.map(renderMetricRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
