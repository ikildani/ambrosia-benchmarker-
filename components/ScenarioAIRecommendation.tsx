'use client';

import { useMemo } from 'react';
import { SavedScenario } from '@/lib/scenarioComparison';
import { formatCurrency } from '@/lib/calculations';

interface AIRecommendationProps {
  scenarios: SavedScenario[];
}

interface Recommendation {
  summary: string;
  winnerId: string;
  winnerName: string;
  insights: string[];
  riskAnalysis: string;
}

export default function ScenarioAIRecommendation({ scenarios }: AIRecommendationProps) {
  const recommendation = useMemo<Recommendation | null>(() => {
    if (scenarios.length < 2) return null;

    // Find highest total value scenario
    const byTotalValue = [...scenarios].sort(
      (a, b) =>
        (b.results?.terms?.totalDealValue?.median || 0) -
        (a.results?.terms?.totalDealValue?.median || 0)
    );
    const highestValue = byTotalValue[0];
    const lowestValue = byTotalValue[byTotalValue.length - 1];

    // Find highest upfront scenario
    const byUpfront = [...scenarios].sort(
      (a, b) =>
        (b.results?.terms?.upfront?.median || 0) - (a.results?.terms?.upfront?.median || 0)
    );
    const highestUpfront = byUpfront[0];

    // Calculate upfront percentages for all scenarios
    const upfrontPercentages = scenarios.map((s) => {
      const upfront = s.results?.terms?.upfront?.median || 0;
      const total = s.results?.terms?.totalDealValue?.median || 1;
      return { id: s.id, name: s.name, pct: (upfront / total) * 100, upfront, total };
    });

    // Generate insights
    const insights: string[] = [];

    // Compare total values
    const highValue = highestValue.results?.terms?.totalDealValue?.median || 0;
    const lowValue = lowestValue.results?.terms?.totalDealValue?.median || 1;
    const valueDiff = ((highValue - lowValue) / lowValue) * 100;

    if (valueDiff > 5) {
      insights.push(
        `"${highestValue.name}" yields ${Math.round(valueDiff)}% higher total potential value (${formatCurrency(highValue)}) compared to "${lowestValue.name}" (${formatCurrency(lowValue)}).`
      );
    }

    // Upfront strategy insight
    const mostConservative = upfrontPercentages.reduce((a, b) => (a.pct > b.pct ? a : b));
    const mostAggressive = upfrontPercentages.reduce((a, b) => (a.pct < b.pct ? a : b));

    if (mostConservative.pct - mostAggressive.pct > 8) {
      insights.push(
        `"${mostConservative.name}" offers better cash flow timing with ${Math.round(mostConservative.pct)}% upfront, while "${mostAggressive.name}" is more milestone-dependent at ${Math.round(mostAggressive.pct)}% upfront.`
      );
    }

    // Compare upfront amounts if significantly different
    const upfrontHigh = highestUpfront.results?.terms?.upfront?.median || 0;
    const upfrontLow = byUpfront[byUpfront.length - 1].results?.terms?.upfront?.median || 1;
    const upfrontDiff = ((upfrontHigh - upfrontLow) / upfrontLow) * 100;

    if (upfrontDiff > 15 && insights.length < 3) {
      insights.push(
        `Guaranteed upfront payments range from ${formatCurrency(upfrontLow)} to ${formatCurrency(upfrontHigh)} - a ${Math.round(upfrontDiff)}% difference.`
      );
    }

    // Risk assessment
    const highRiskScenarios = upfrontPercentages.filter((s) => s.pct < 20);
    let riskAnalysis = '';

    if (highRiskScenarios.length > 0) {
      riskAnalysis = `${highRiskScenarios.map((s) => `"${s.name}"`).join(' and ')} ${highRiskScenarios.length > 1 ? 'are' : 'is'} milestone-heavy with higher execution risk. Consider negotiating for more upfront value.`;
    } else if (mostConservative.pct >= 35) {
      riskAnalysis = `All scenarios show strong upfront components (${Math.round(mostAggressive.pct)}%-${Math.round(mostConservative.pct)}%), indicating balanced risk profiles.`;
    } else {
      riskAnalysis = `Consider the trade-off between guaranteed upfront payments and milestone-dependent value when negotiating.`;
    }

    return {
      summary: `Based on your ${scenarios.length} scenarios, "${highestValue.name}" offers the strongest total value potential at ${formatCurrency(highValue)}.`,
      winnerId: highestValue.id,
      winnerName: highestValue.name,
      insights,
      riskAnalysis,
    };
  }, [scenarios]);

  if (!recommendation) return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center flex-shrink-0">
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-1">Recommendation</h4>
          <p className="text-sm text-amber-900 dark:text-amber-100 mb-3">
            {recommendation.summary}
          </p>

          {recommendation.insights.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {recommendation.insights.map((insight, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200"
                >
                  <svg
                    className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {insight}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-amber-700 dark:text-amber-300 italic">
            {recommendation.riskAnalysis}
          </p>
        </div>
      </div>
    </div>
  );
}
