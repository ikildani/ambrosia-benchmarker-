import React from 'react';
import { formatCurrency } from '@/lib/calculations';

interface LiveDealPreviewProps {
  totalDealValue: { low: number; median: number; high: number };
  upfront: { low: number; median: number; high: number };
}

const LiveDealPreview = React.memo(function LiveDealPreview({
  totalDealValue,
  upfront,
}: LiveDealPreviewProps) {
  const totalRange = `${formatCurrency(totalDealValue.low)} – ${formatCurrency(totalDealValue.high)}`;
  const upfrontMedian = formatCurrency(upfront.median);

  return (
    <>
      {/* Desktop: sticky card at top of right column */}
      <div className="hidden md:block sticky top-24 z-30 mb-6">
        <div className="relative bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-lg overflow-hidden">
          {/* Teal gradient top bar */}
          <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
          <div className="px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-slate-500 mb-1">
              Estimated Deal Value
            </div>
            <div className="text-xl font-bold text-navy-800 dark:text-white tabular-nums animate-number-flash" key={totalRange}>
              {totalRange}
            </div>
            <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1 tabular-nums">
              Upfront: <span className="font-semibold text-teal-600 dark:text-teal-400">{upfrontMedian}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-neutral-200 dark:border-slate-700 safe-bottom">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-slate-500">
              Est. Deal Value
            </div>
            <div className="text-base font-bold text-navy-800 dark:text-white tabular-nums">
              {totalRange}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400 dark:text-slate-500">Upfront</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 tabular-nums">{upfrontMedian}</div>
          </div>
        </div>
      </div>
    </>
  );
});

export default LiveDealPreview;
