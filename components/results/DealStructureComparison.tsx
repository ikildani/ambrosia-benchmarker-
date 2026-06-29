'use client';

import { useMemo } from 'react';
import { calculateDealTerms, type CalculationInput, type CalculationResult, type DealType } from '@/lib/calculations';

interface Props {
  inputs: CalculationInput;
  currentResult: CalculationResult;
  tier: string;
  onBuyReport?: () => void;
}

const STRUCTURES = [
  { key: 'licensing', label: 'Licensing', color: 'teal', description: 'Standard out-license' },
  { key: 'codevelopment', label: 'Co-Development', color: 'blue', description: 'Shared R&D costs' },
  { key: 'option', label: 'Option', color: 'purple', description: 'Option to license' },
  { key: 'acquisition', label: 'Acquisition', color: 'amber', description: 'Full buyout' },
  { key: 'collaboration', label: 'Collaboration', color: 'rose', description: 'Research partnership' },
] as const;

function fmtM(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

const ACCENT = {
  teal: { border: 'border-t-teal-500', bar: 'bg-teal-500' },
  blue: { border: 'border-t-blue-500', bar: 'bg-blue-500' },
  purple: { border: 'border-t-purple-500', bar: 'bg-purple-500' },
  amber: { border: 'border-t-amber-500', bar: 'bg-amber-500' },
  rose: { border: 'border-t-rose-500', bar: 'bg-rose-500' },
};

export default function DealStructureComparison({ inputs, currentResult, tier, onBuyReport }: Props) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';
  const currentDealType = inputs.dealType || 'licensing';

  const comparisons = useMemo(() => {
    return STRUCTURES.map(s => {
      const modified = { ...inputs, dealType: s.key as DealType };
      try {
        const result = calculateDealTerms(modified);
        return { ...s, result, isCurrent: s.key === currentDealType };
      } catch {
        return { ...s, result: null, isCurrent: s.key === currentDealType };
      }
    }).filter(s => s.result !== null);
  }, [inputs, currentDealType]);

  if (comparisons.length < 2) return null;

  const bestUpfront = Math.max(...comparisons.map(c => c.result!.terms.upfront.median));
  const bestTDV = Math.max(...comparisons.map(c => c.result!.terms.totalDealValue.median));

  return (
    <div className="mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-[1px]">
        <div className={`rounded-[11px] bg-white dark:bg-slate-800 ${!hasAccess ? 'select-none' : ''}`}>
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-neutral-800 dark:text-white text-sm sm:text-base">Deal Structure Comparison</h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">Same asset, 5 deal structures — see how structure changes economics</p>
              </div>
            </div>
          </div>

          <div className={`p-4 sm:p-5 ${!hasAccess ? 'blur-[6px] pointer-events-none' : ''}`}>
            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {comparisons.map(c => {
                const r = c.result!;
                const accent = ACCENT[c.color];
                const upfrontPct = bestUpfront > 0 ? (r.terms.upfront.median / bestUpfront) * 100 : 0;
                const tdvPct = bestTDV > 0 ? (r.terms.totalDealValue.median / bestTDV) * 100 : 0;

                return (
                  <div
                    key={c.key}
                    className={`relative border ${accent.border} border-t-[3px] border-neutral-200 dark:border-slate-700 rounded-lg overflow-hidden ${c.isCurrent ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-800' : ''}`}
                  >
                    {c.isCurrent && (
                      <div className="absolute top-2 right-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">Current</span>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="mb-2">
                        <h5 className="text-sm font-bold text-neutral-800 dark:text-white">{c.label}</h5>
                        <p className="text-[10px] text-neutral-500 dark:text-slate-400">{c.description}</p>
                      </div>

                      {/* Upfront */}
                      <div className="mb-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider">Upfront</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white">{fmtM(r.terms.upfront.median)}</span>
                        </div>
                        <div className="mt-1 h-1.5 bg-neutral-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${upfrontPct}%` }} />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] text-neutral-400">{fmtM(r.terms.upfront.low)}</span>
                          <span className="text-[9px] text-neutral-400">{fmtM(r.terms.upfront.high)}</span>
                        </div>
                      </div>

                      {/* TDV */}
                      <div className="mb-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider">{c.key === 'acquisition' ? 'Cash Value' : 'Total Deal'}</span>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white">{fmtM(r.terms.totalDealValue.median)}</span>
                        </div>
                        <div className="mt-1 h-1.5 bg-neutral-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${tdvPct}%` }} />
                        </div>
                      </div>

                      {/* Structure split */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-slate-700 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-neutral-500">Upfront %</span>
                          <span className="font-semibold text-neutral-700 dark:text-slate-300">{r.dealRecommendation.upfrontPercent}%</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-neutral-500">Milestones %</span>
                          <span className="font-semibold text-neutral-700 dark:text-slate-300">{r.dealRecommendation.milestonePercent}%</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-neutral-500">Base Royalty</span>
                          <span className="font-semibold text-neutral-700 dark:text-slate-300">{r.tieredRoyalties.base.low.toFixed(1)}-{r.tieredRoyalties.base.high.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insight row */}
            <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-neutral-50 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-neutral-100 dark:border-slate-700">
              <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                {(() => {
                  const licensing = comparisons.find(c => c.key === 'licensing');
                  const acquisition = comparisons.find(c => c.key === 'acquisition');
                  if (!licensing?.result || !acquisition?.result) return 'Compare structures to find the optimal balance between upfront certainty and total deal value.';
                  const acqUpfrontPct = ((acquisition.result.terms.upfront.median / licensing.result.terms.upfront.median) * 100).toFixed(0);
                  return `Licensing TDV represents total potential value including contingent milestones — the headline number but not guaranteed cash. Acquisition TDV is lower but ${acqUpfrontPct}% of it is upfront cash (vs ${licensing.result.dealRecommendation.upfrontPercent}% for licensing). Co-development shares R&D cost but compresses royalties. Option deals preserve strategic flexibility at the lowest upfront commitment. Choose based on capitalization needs, control preferences, and risk appetite.`;
                })()}
              </p>
            </div>
          </div>

          {/* Paywall overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 rounded-xl">
              <div className="text-center px-6">
                <button
                  onClick={() => onBuyReport?.()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Unlock Structure Comparison
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
