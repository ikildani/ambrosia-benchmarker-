'use client';

import { TopValueDriver } from '@/lib/sensitivity';
import { formatCurrency } from '@/lib/calculations';

interface KeyInsightBoxProps {
  topValueDriver: TopValueDriver;
  currentTotalValue: number;
}

export default function KeyInsightBox({ topValueDriver, currentTotalValue }: KeyInsightBoxProps) {
  const { bestOption, insightText } = topValueDriver;
  const hasImprovement = bestOption.delta > 0;

  return (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border border-teal-200 dark:border-teal-700/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-teal-500 dark:bg-teal-600 rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-1">
            KEY INSIGHT
          </h4>
          <p className="text-sm text-teal-700 dark:text-teal-300 leading-relaxed">
            {insightText}
          </p>
          {hasImprovement && (
            <div className="mt-2 text-xs text-teal-600 dark:text-teal-400">
              Current: {formatCurrency(currentTotalValue)} → Potential: {formatCurrency(bestOption.resultingTotalValue)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
