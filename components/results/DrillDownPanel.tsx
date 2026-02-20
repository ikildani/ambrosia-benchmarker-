import React from 'react';
import { formatCurrency, DrillDownData } from '@/lib/calculations';

interface DrillDownPanelProps {
  data: DrillDownData;
  isRoyalty?: boolean;
}

function DrillDownPanelInner({
  data,
  isRoyalty = false
}: DrillDownPanelProps) {
  return (
    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-slate-600 animate-fade-in">
      {/* Why This Range */}
      <div className="mb-4">
        <h5 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Why This Range?</h5>
        <p className="text-sm text-neutral-600 dark:text-slate-300 leading-relaxed">{data.rangeExplanation}</p>
      </div>

      {/* Breakdown Table */}
      {data.breakdown && data.breakdown.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            {isRoyalty ? 'Royalty Tiers' : 'Breakdown'}
          </h5>
          <div className="bg-neutral-50 dark:bg-slate-700/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="bg-neutral-100 dark:bg-slate-700">
                  <th className="text-left py-2 px-3 font-medium text-neutral-600 dark:text-slate-300">Component</th>
                  <th className="text-center py-2 px-3 font-medium text-neutral-600 dark:text-slate-300">
                    {isRoyalty ? 'Rate' : 'Share'}
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-600 dark:text-slate-300">
                    {isRoyalty ? 'Range' : 'Value'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((item, idx) => (
                  <tr key={idx} className="border-t border-neutral-200 dark:border-slate-600">
                    <td className="py-2 px-3 text-neutral-700 dark:text-slate-200">{item.label}</td>
                    <td className="py-2 px-3 text-center text-neutral-600 dark:text-slate-300">
                      {isRoyalty ? `${item.value.low}% - ${item.value.high}%` : `${item.percentage}%`}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-neutral-800 dark:text-white">
                      {isRoyalty
                        ? `${item.value.low}% - ${item.value.high}%`
                        : `${formatCurrency(item.value.low)} - ${formatCurrency(item.value.high)}`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Key Factors */}
      {data.factors && data.factors.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Key Factors</h5>
          <div className="space-y-1.5">
            {data.factors.slice(0, 5).map((factor, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {factor.impact === 'positive' ? (
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : factor.impact === 'negative' ? (
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-slate-500" />
                  </div>
                )}
                <span className={factor.impact === 'positive' ? 'text-teal-700 dark:text-teal-400' : factor.impact === 'negative' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-600 dark:text-slate-300'}>
                  {factor.name}
                  {factor.percentage !== 0 && (
                    <span className="font-semibold ml-1">
                      ({factor.percentage > 0 ? '+' : ''}{factor.percentage}%)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DrillDownPanel = React.memo(DrillDownPanelInner);
DrillDownPanel.displayName = 'DrillDownPanel';

export default DrillDownPanel;
export type { DrillDownPanelProps };
