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

export default function ComparableDeals({ inputs, tier, onBuyReport }: ComparableDealsProps) {
  const [deals, setDeals] = useState<ComparableDealForUI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      therapeuticArea: inputs.therapeuticArea || '',
      modality: inputs.modality || '',
      indication: inputs.indication || '',
      phase: inputs.phase || '',
    });
    fetch(`/api/deals/comparable?${params}`)
      .then(res => res.json())
      .then(data => setDeals(data.deals || []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, [inputs.therapeuticArea, inputs.modality, inputs.indication, inputs.phase]);

  if (!loading && deals.length === 0) return null;

  const hasFullAccess = tier === 'pro' || tier === 'report';
  const FREE_DEAL_LIMIT = 3;
  const visibleDeals = hasFullAccess ? deals : deals.slice(0, FREE_DEAL_LIMIT);
  const hiddenCount = hasFullAccess ? 0 : Math.max(0, deals.length - FREE_DEAL_LIMIT);

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
        Comparable Transactions
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Recent deals with similar characteristics to your asset profile
      </p>
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
        {!loading && visibleDeals.map((deal, idx) => (
          <div
            key={deal.id || idx}
            className="relative p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                  {deal.parties}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {deal.year} &middot; {deal.phase}
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
            {deal.relevanceReasons && deal.relevanceReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {deal.relevanceReasons.map((reason, i) => (
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
        ))}
        {!hasFullAccess && hiddenCount > 0 && (
          <button
            onClick={() => onBuyReport?.()}
            className="w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center hover:border-teal-300 dark:hover:border-teal-600 transition-colors group"
          >
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              +{hiddenCount} more comparable deals
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Get Full Report ({PRICING.REPORT_PRICE}) to see all comparables
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
