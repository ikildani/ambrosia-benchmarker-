'use client';

import { useMemo } from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import type { PartnerForPDF } from '@/lib/report/types';

interface MarketUrgencyProps {
  partnerMatches: PartnerForPDF[];
  therapeuticArea?: string;
  isPro: boolean;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

interface UrgencyAnalysis {
  totalRevenueAtRisk: number;
  companiesWithCliffs: number;
  totalPartnersAnalyzed: number;
  urgencyLevel: 'High' | 'Medium' | 'Low';
  narrative: string;
  topCliffs: { drug_name: string; company: string; revenue_usd: number; expiry_year: number }[];
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
}

const TA_LABELS: Record<string, string> = {
  oncology: 'oncology',
  neurology: 'neurology',
  immunology: 'immunology',
  metabolic: 'metabolic/obesity',
};

function analyzeUrgency(
  matches: PartnerForPDF[],
  therapeuticArea?: string
): UrgencyAnalysis | null {
  // Take the top 8 matches (already ranked by score)
  const topMatches = matches.slice(0, 8);

  // Aggregate patent cliff data
  let totalRevenueAtRisk = 0;
  let companiesWithCliffs = 0;
  const allCliffs: { drug_name: string; company: string; revenue_usd: number; expiry_year: number }[] = [];

  for (const match of topMatches) {
    const ctx = match.strategic_context;
    if (!ctx) continue;

    // Count cliffs expiring 2025-2028
    const imminentCliffs = ctx.patent_cliffs.filter(
      (c) => c.expiry_year >= 2025 && c.expiry_year <= 2028
    );

    if (imminentCliffs.length > 0) {
      companiesWithCliffs++;
    }

    for (const cliff of imminentCliffs) {
      totalRevenueAtRisk += cliff.revenue_usd;
      allCliffs.push({
        drug_name: cliff.drug_name,
        company: match.company_name,
        revenue_usd: cliff.revenue_usd,
        expiry_year: cliff.expiry_year,
      });
    }

    // Note: ctx.revenue_at_risk contains company-level aggregates from the DB
    // (revenue_at_risk_2025/2026/2027 columns). We intentionally skip these
    // to avoid double-counting with the granular patent_cliffs data above.
  }

  // Need at least some data to show the card
  if (companiesWithCliffs === 0 || totalRevenueAtRisk === 0) {
    return null;
  }

  // Determine urgency level
  let urgencyLevel: 'High' | 'Medium' | 'Low';
  if (totalRevenueAtRisk >= 20_000_000_000 || companiesWithCliffs >= 4) {
    urgencyLevel = 'High';
  } else if (totalRevenueAtRisk >= 5_000_000_000 || companiesWithCliffs >= 2) {
    urgencyLevel = 'Medium';
  } else {
    urgencyLevel = 'Low';
  }

  // Sort cliffs by revenue and pick top ones
  const topCliffs = allCliffs
    .sort((a, b) => b.revenue_usd - a.revenue_usd)
    .slice(0, 3);

  // Build narrative
  const taLabel = therapeuticArea ? TA_LABELS[therapeuticArea] || therapeuticArea : 'your';
  const revenueFormatted = formatCurrencyShort(totalRevenueAtRisk);

  // Find the latest expiry year among imminent cliffs for the narrative
  const latestYear = Math.max(...allCliffs.map((c) => c.expiry_year));

  const narrative =
    `${companiesWithCliffs} of your top partner matches have ${revenueFormatted} in revenue at risk by ${latestYear}, ` +
    `creating strong pipeline fill urgency for ${taLabel} assets. ` +
    `This competitive pressure works in your favor during term negotiations.`;

  return {
    totalRevenueAtRisk,
    companiesWithCliffs,
    totalPartnersAnalyzed: topMatches.length,
    urgencyLevel,
    narrative,
    topCliffs,
  };
}

const urgencyColors = {
  High: {
    badge: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300',
    glow: 'from-teal-500/20 to-cyan-500/20',
  },
  Medium: {
    badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    glow: 'from-amber-500/20 to-yellow-500/20',
  },
  Low: {
    badge: 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300',
    glow: 'from-slate-500/10 to-slate-500/10',
  },
};

export default function MarketUrgency({
  partnerMatches,
  therapeuticArea,
  isPro,
  onUpgrade,
  onBuyReport,
}: MarketUrgencyProps) {
  const analysis = useMemo(
    () => analyzeUrgency(partnerMatches, therapeuticArea),
    [partnerMatches, therapeuticArea]
  );

  // Don't render if no patent cliff data available
  if (!analysis) return null;

  const colors = urgencyColors[analysis.urgencyLevel];

  return (
    <div className="relative mt-6 sm:mt-8">
      {/* Gradient border wrapper */}
      <div className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !isPro ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Partner Pipeline Urgency
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  Based on top {analysis.totalPartnersAnalyzed} partner matches
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colors.badge} flex-shrink-0`}
            >
              {analysis.urgencyLevel} Urgency
            </span>
          </div>

          {/* Main Metric */}
          <div className={`${!isPro ? 'blur-[6px]' : ''} transition-all`}>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6 mb-4">
              <div>
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Total Revenue at Risk
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-teal-700 dark:text-teal-400">
                  {formatCurrencyShort(analysis.totalRevenueAtRisk)}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-neutral-400 dark:text-slate-500" />
                  <span className="text-neutral-600 dark:text-slate-300">
                    <strong className="text-neutral-800 dark:text-white">
                      {analysis.companiesWithCliffs}
                    </strong>{' '}
                    partners with imminent cliffs
                  </span>
                </div>
              </div>
            </div>

            {/* Top Cliffs */}
            {analysis.topCliffs.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {analysis.topCliffs.map((cliff, i) => (
                  <div
                    key={`${cliff.drug_name}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 rounded-lg text-xs"
                  >
                    <span className="font-medium text-teal-800 dark:text-teal-300 truncate max-w-[120px] sm:max-w-none">
                      {cliff.drug_name}
                    </span>
                    <span className="text-teal-600 dark:text-teal-400">
                      {formatCurrencyShort(cliff.revenue_usd)}
                    </span>
                    <span className="px-1.5 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded font-medium">
                      {cliff.expiry_year}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Narrative */}
            <div className="p-3 sm:p-4 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-500/5 dark:to-cyan-500/5 rounded-lg border border-teal-100 dark:border-teal-500/20">
              <p className="text-sm text-neutral-700 dark:text-slate-300 leading-relaxed">
                {analysis.narrative}
              </p>
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 dark:bg-slate-900/60">
              <button
                onClick={() => (onBuyReport ? onBuyReport() : onUpgrade?.())}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
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
                Unlock Market Urgency Insights
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
