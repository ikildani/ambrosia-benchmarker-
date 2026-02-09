'use client';

import { CalculationInput, formatCurrency } from '@/lib/calculations';
import { findComparableDeals, ComparableDeal } from '@/lib/comparableDeals';
import { useMemo } from 'react';

interface ComparableDealsProps {
  inputs: CalculationInput;
  isPro: boolean;
}

export default function ComparableDeals({ inputs, isPro }: ComparableDealsProps) {
  const deals = useMemo(() => findComparableDeals(inputs), [inputs]);

  if (deals.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base sm:text-lg font-bold text-navy-800 dark:text-white">Comparable Deals</h3>
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded">MARKET DATA</span>
      </div>

      <div className={`space-y-3 ${!isPro ? 'relative' : ''}`}>
        {deals.map((deal, idx) => (
          <DealRow key={deal.id} deal={deal} blurred={!isPro && idx > 0} />
        ))}

        {!isPro && deals.length > 1 && (
          <div className="absolute inset-0 top-20 flex items-center justify-center bg-gradient-to-t from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent rounded-xl">
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Unlock all comparable deals</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Upgrade to Pro for full market context</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DealRow({ deal, blurred }: { deal: ComparableDeal; blurred: boolean }) {
  return (
    <div className={`p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${blurred ? 'blur-sm pointer-events-none select-none' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-slate-900 dark:text-white">{deal.parties}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{deal.context}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {deal.relevanceReasons.map((reason) => (
              <span key={reason} className="text-[10px] font-medium px-1.5 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded">
                {reason}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(deal.totalValue)}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {deal.upfront === deal.totalValue ? 'Acquisition' : `${formatCurrency(deal.upfront)} upfront`}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{deal.year}</p>
        </div>
      </div>
    </div>
  );
}
