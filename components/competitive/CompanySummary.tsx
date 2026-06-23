'use client';

import { formatModality } from '@/lib/config/modality-display';

interface CompanySummaryProps {
  summary: string;
  marketPosition: {
    deal_volume_rank: number | null;
    total_companies: number;
    primary_modality: string | null;
  } | null;
}

export default function CompanySummary({ summary, marketPosition }: CompanySummaryProps) {
  const hasRank =
    marketPosition && marketPosition.deal_volume_rank !== null && marketPosition.total_companies > 0;
  const hasModality = marketPosition && marketPosition.primary_modality;
  const hasBadges = hasRank || hasModality;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-blue-600">
      <div className="p-6">
        <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          {summary}
        </p>

        {hasBadges && (
          <div className="flex flex-wrap gap-2 mt-5">
            {hasRank && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V6"
                  />
                </svg>
                Rank #{marketPosition!.deal_volume_rank} of {marketPosition!.total_companies} by deal volume
              </span>
            )}
            {hasModality && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-1.341 4.023a2.25 2.25 0 01-2.134 1.527H8.475a2.25 2.25 0 01-2.134-1.527L5 14.5m14 0H5"
                  />
                </svg>
                {formatModality(marketPosition!.primary_modality!)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
