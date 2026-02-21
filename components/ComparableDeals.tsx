'use client';

import { CalculationInput } from '@/lib/calculations';
import { findComparableDeals } from '@/lib/comparableDeals';
import { PRICING } from '@/lib/config/constants';

interface ComparableDealsProps {
  inputs: CalculationInput;
  tier: 'free' | 'report' | 'pro';
  onBuyReport?: () => void;
}

export default function ComparableDeals({ inputs, tier, onBuyReport }: ComparableDealsProps) {
  const deals = findComparableDeals(inputs);
  if (deals.length === 0) return null;

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
        {visibleDeals.map((deal, idx) => (
          <div
            key={deal.id || idx}
            className="relative p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                  {deal.parties}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {deal.year} &middot; {deal.phase}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-teal-600 dark:text-teal-400 text-sm">
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
