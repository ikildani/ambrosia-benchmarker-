'use client';

import { useState, useEffect } from 'react';
import { CalculationInput } from '@/lib/calculations';
import { PRICING } from '@/lib/config/constants';

interface ComparableDealForUI {
  id: string;
  parties: string;
  totalValue: string;
  upfront?: string;
  year: number;
  phase?: string;
  relevanceReasons: string[];
}

interface ComparableDealsProps {
  inputs: CalculationInput;
  tier: 'free' | 'report' | 'pro';
  onBuyReport?: () => void;
}

type RecencyFilter = 'all' | '24mo' | '12mo';

// Parse similarity percentage from relevanceReasons (e.g., "85% match")
function parseSimilarity(reasons: string[]): number | null {
  for (const reason of reasons) {
    const match = reason.match(/^(\d+)%\s*match$/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

// Get match quality badge based on similarity score
function getMatchBadge(similarity: number): { label: string; className: string } {
  if (similarity >= 90) return { label: 'Excellent match', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' };
  if (similarity >= 75) return { label: 'Strong match', className: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' };
  if (similarity >= 60) return { label: 'Good match', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' };
  return { label: 'Related', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };
}

export default function ComparableDeals({ inputs, tier, onBuyReport }: ComparableDealsProps) {
  const [deals, setDeals] = useState<ComparableDealForUI[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [hasSemantic, setHasSemantic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      therapeuticArea: inputs.therapeuticArea || '',
      modality: inputs.modality || '',
      indication: inputs.indication || '',
      phase: inputs.phase || '',
      dealType: inputs.dealType || '',
    });
    fetch(`/api/deals/comparable?${params}`)
      .then(res => res.json())
      .then(data => {
        setDeals(data.deals || []);
        setTotalAvailable(data.totalAvailable || (data.deals || []).length);
        setHasSemantic(data.semantic === true);
      })
      .catch(() => { setDeals([]); setTotalAvailable(0); setHasSemantic(false); })
      .finally(() => setLoading(false));
  }, [inputs.therapeuticArea, inputs.modality, inputs.indication, inputs.phase, inputs.dealType]);

  if (!loading && deals.length === 0) return null;

  const hasFullAccess = tier === 'pro' || tier === 'report';
  const FREE_DEAL_LIMIT = 3;
  const currentYear = new Date().getFullYear();
  const filteredDeals = deals.filter(deal => {
    if (recencyFilter === '12mo') return deal.year >= currentYear - 1;
    if (recencyFilter === '24mo') return deal.year >= currentYear - 2;
    return true;
  });
  const visibleDeals = hasFullAccess ? filteredDeals : filteredDeals.slice(0, FREE_DEAL_LIMIT);
  const hiddenCount = hasFullAccess ? 0 : Math.max(0, totalAvailable - FREE_DEAL_LIMIT);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Comparable Transactions
        </h3>
        {hasSemantic && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-medium border border-purple-100 dark:border-purple-800/30">
            Semantic matching
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {hasSemantic ? 'Ranked by contextual similarity to your asset profile' : 'Recent deals with similar characteristics'}
        </p>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {([['12mo', 'Last 12mo'], ['24mo', 'Last 24mo'], ['all', 'All time']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setRecencyFilter(value)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                recencyFilter === value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-2" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-24" />
                  </div>
                  <div className="h-4 bg-teal-100 dark:bg-teal-900/30 rounded w-16" />
                </div>
                <div className="flex gap-1.5 mt-2">
                  <div className="h-5 bg-teal-50 dark:bg-teal-900/20 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && visibleDeals.map((deal, idx) => {
          const similarity = parseSimilarity(deal.relevanceReasons);
          const matchBadge = similarity ? getMatchBadge(similarity) : null;
          const nonSimilarityReasons = deal.relevanceReasons.filter(r => !r.match(/^\d+%\s*match$/));

          return (
            <div
              key={deal.id || idx}
              className="relative p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {deal.parties}
                    </p>
                    {matchBadge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${matchBadge.className}`}>
                        {matchBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {deal.year}{deal.phase ? ` \u00b7 ${deal.phase}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-teal-600 dark:text-teal-400 text-sm whitespace-nowrap">
                    {deal.totalValue}
                  </p>
                  {deal.upfront && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {deal.upfront} upfront
                    </p>
                  )}
                </div>
              </div>
              {(nonSimilarityReasons.length > 0 || similarity) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {similarity && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 font-medium">
                      {similarity}% similar
                    </span>
                  )}
                  {nonSimilarityReasons.map((reason, i) => (
                    <span
                      key={i}
                      className="text-xs px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!hasFullAccess && hiddenCount > 0 && (
          <button
            onClick={() => onBuyReport?.()}
            className="w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center hover:border-teal-300 dark:hover:border-teal-600 transition-colors group"
          >
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              +{hiddenCount} more comparable deals
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Get Full Report ({PRICING.REPORT_PRICE}) to see all comparables
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
