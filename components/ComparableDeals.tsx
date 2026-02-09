'use client';

import { CalculationInput } from '@/lib/calculations';
import { findComparableDeals, ComparableDeal } from '@/lib/comparableDeals';

interface ComparableDealsProps {
  inputs: CalculationInput;
  isPro: boolean;
}

export default function ComparableDeals({ inputs, isPro }: ComparableDealsProps) {
  const deals = findComparableDeals(inputs);
  if (deals.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
        Comparable Transactions
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Recent deals with similar characteristics to your asset profile
      </p>
      <div className="space-y-3">
        {deals.map((deal, idx) => (
          <div
            key={deal.id || idx}
            className={`relative p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ${
              !isPro && idx > 0 ? 'blur-sm select-none pointer-events-none' : ''
            }`}
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
                    className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {!isPro && deals.length > 1 && (
          <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2">
            Upgrade to Pro to see all comparable deals
          </p>
        )}
      </div>
    </div>
  );
}
