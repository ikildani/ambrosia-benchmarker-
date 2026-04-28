'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationInput } from '@/lib/calculations';
import { PRICING } from '@/lib/config/constants';
import { weightedQuantile, recencyWeight } from '@/lib/math/quantile';

interface EnrichedDeal {
  id: string;
  parties: string;
  licensor: string;
  licensee: string;
  totalValue: string;
  upfront: string | null;
  upfrontM: number | null;
  totalValueM: number | null;
  year: number;
  phase: string | null;
  modality: string | null;
  indication: string | null;
  therapeuticArea: string | null;
  dealType: string | null;
  territory: string | null;
  matchScore: number;
  matchBreakdown: { ta: boolean; modality: boolean; phase: boolean; indication: boolean; recency: number };
  relevanceReasons: string[];
}

interface BenchmarkRange {
  upfront: { p25: number; median: number; p75: number };
  totalValue: { p25: number; median: number; p75: number };
  n: number;
}

interface ComparableDealsProps {
  inputs: CalculationInput;
  tier: 'free' | 'report' | 'pro';
  onBuyReport?: () => void;
}

type RecencyFilter = 'all' | '24mo' | '12mo';

function getMatchBadge(score: number): { label: string; className: string } {
  if (score >= 0.7) return { label: 'Excellent match', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' };
  if (score >= 0.5) return { label: 'Strong match', className: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' };
  if (score >= 0.35) return { label: 'Good match', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' };
  return { label: 'Related', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };
}

function formatM(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${Math.round(val)}M`;
}

function computeSelectedBenchmark(deals: EnrichedDeal[], selectedIds: Set<string>): BenchmarkRange | null {
  const selected = deals.filter(d => selectedIds.has(d.id));
  const upfrontPairs = selected
    .filter(d => d.upfrontM && d.upfrontM > 0)
    .map(d => ({ value: d.upfrontM!, weight: recencyWeight(d.year) }));
  const totalPairs = selected
    .filter(d => d.totalValueM && d.totalValueM > 0)
    .map(d => ({ value: d.totalValueM!, weight: recencyWeight(d.year) }));

  if (upfrontPairs.length < 3 && totalPairs.length < 3) return null;

  return {
    upfront: {
      p25: weightedQuantile(upfrontPairs, 0.25),
      median: weightedQuantile(upfrontPairs, 0.5),
      p75: weightedQuantile(upfrontPairs, 0.75),
    },
    totalValue: {
      p25: weightedQuantile(totalPairs, 0.25),
      median: weightedQuantile(totalPairs, 0.5),
      p75: weightedQuantile(totalPairs, 0.75),
    },
    n: selected.length,
  };
}

export default function ComparableDeals({ inputs, tier, onBuyReport }: ComparableDealsProps) {
  const [deals, setDeals] = useState<EnrichedDeal[]>([]);
  const [fullBenchmark, setFullBenchmark] = useState<BenchmarkRange | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionActive, setSelectionActive] = useState(false);

  const hasFullAccess = tier === 'pro' || tier === 'report';
  const FREE_DEAL_LIMIT = 3;
  const MIN_COMPS = 3;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      therapeuticArea: inputs.therapeuticArea || '',
      modality: inputs.modality || '',
      indication: inputs.indication || '',
      phase: inputs.phase || '',
      dealType: inputs.dealType || '',
      enriched: 'true',
    });
    fetch(`/api/deals/comparable?${params}`)
      .then(res => res.json())
      .then(data => {
        const d = data.deals || [];
        setDeals(d);
        setTotalAvailable(data.totalAvailable || d.length);
        setFullBenchmark(data.benchmarkRange || null);
        setSelectedIds(new Set(d.map((deal: EnrichedDeal) => deal.id)));
      })
      .catch(() => { setDeals([]); setTotalAvailable(0); setFullBenchmark(null); })
      .finally(() => setLoading(false));
  }, [inputs.therapeuticArea, inputs.modality, inputs.indication, inputs.phase, inputs.dealType]);

  const currentYear = new Date().getFullYear();
  const filteredDeals = useMemo(() => deals.filter(deal => {
    if (recencyFilter === '12mo') return deal.year >= currentYear - 1;
    if (recencyFilter === '24mo') return deal.year >= currentYear - 2;
    return true;
  }), [deals, recencyFilter, currentYear]);

  const visibleDeals = hasFullAccess ? filteredDeals : filteredDeals.slice(0, FREE_DEAL_LIMIT);
  const hiddenCount = hasFullAccess ? 0 : Math.max(0, totalAvailable - FREE_DEAL_LIMIT);

  const selectedBenchmark = useMemo(() => {
    if (!selectionActive) return fullBenchmark;
    return computeSelectedBenchmark(deals, selectedIds);
  }, [deals, selectedIds, selectionActive, fullBenchmark]);

  const deviationPct = useMemo(() => {
    if (!fullBenchmark || !selectedBenchmark || !selectionActive) return 0;
    if (fullBenchmark.upfront.median === 0) return 0;
    return ((selectedBenchmark.upfront.median - fullBenchmark.upfront.median) / fullBenchmark.upfront.median) * 100;
  }, [fullBenchmark, selectedBenchmark, selectionActive]);

  const toggleDeal = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= MIN_COMPS) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!selectionActive) setSelectionActive(true);
  }, [selectionActive]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(deals.map(d => d.id)));
    setSelectionActive(false);
  }, [deals]);

  if (!loading && deals.length === 0) return null;

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Comparable Transactions
          </h3>
          {selectionActive && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/30">
              Custom selection
            </span>
          )}
        </div>
        {hasFullAccess && deals.length > 0 && !loading && (
          <div className="flex items-center gap-2">
            {selectionActive && (
              <button
                onClick={selectAll}
                className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
              >
                Reset to all
              </button>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {selectedIds.size} of {deals.length} selected
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {hasFullAccess
            ? 'Toggle deals to customize your benchmark range'
            : 'Recent deals with similar characteristics'}
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

      {/* Live Benchmark Range */}
      {hasFullAccess && selectedBenchmark && !loading && (
        <div className={`mb-4 p-4 rounded-xl border ${
          selectionActive
            ? 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/40'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {selectionActive ? 'Custom Benchmark Range' : 'Market Benchmark Range'}
            </p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              n = {selectedBenchmark.n} deals · recency-weighted
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Upfront Payment</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatM(selectedBenchmark.upfront.p25)}</span>
                <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{formatM(selectedBenchmark.upfront.median)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatM(selectedBenchmark.upfront.p75)}</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">p25 — median — p75</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Deal Value</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatM(selectedBenchmark.totalValue.p25)}</span>
                <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{formatM(selectedBenchmark.totalValue.median)}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{formatM(selectedBenchmark.totalValue.p75)}</span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">p25 — median — p75</p>
            </div>
          </div>

          {/* Deviation warning */}
          {selectionActive && Math.abs(deviationPct) > 30 && (
            <div className={`mt-3 p-2.5 rounded-lg text-xs ${
              Math.abs(deviationPct) > 50
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30'
            }`}>
              Your selected comp set produces a median {deviationPct > 0 ? '+' : ''}{Math.round(deviationPct)}% {deviationPct > 0 ? 'above' : 'below'} the full market benchmark. {Math.abs(deviationPct) > 50 ? 'This is a significant deviation — consider whether your selection is representative.' : 'Review your selection to ensure it reflects the relevant comp set.'}
            </div>
          )}
        </div>
      )}

      {/* Minimum comps warning */}
      {hasFullAccess && selectionActive && selectedIds.size <= MIN_COMPS && (
        <div className="mb-3 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Minimum {MIN_COMPS} comparable deals required to compute a benchmark range.
        </div>
      )}

      {/* Deal List */}
      <div className="space-y-2">
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-2" /><div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-24" /></div>
                  <div className="h-4 bg-teal-100 dark:bg-teal-900/30 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && visibleDeals.map((deal) => {
          const matchBadge = getMatchBadge(deal.matchScore);
          const isSelected = selectedIds.has(deal.id);

          return (
            <div
              key={deal.id}
              className={`relative p-4 border rounded-lg transition-colors ${
                hasFullAccess && selectionActive && !isSelected
                  ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 opacity-50'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {hasFullAccess && (
                  <button
                    onClick={() => toggleDeal(deal.id)}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-teal-400'
                    }`}
                    title={isSelected ? 'Exclude from benchmark' : 'Include in benchmark'}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Deal info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {deal.parties}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${matchBadge.className}`}>
                      {matchBadge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {deal.year}
                    {deal.phase ? ` · ${deal.phase}` : ''}
                    {deal.modality ? ` · ${deal.modality}` : ''}
                    {deal.dealType ? ` · ${deal.dealType}` : ''}
                  </p>
                </div>

                {/* Values */}
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

              {/* Match breakdown tags */}
              <div className="flex flex-wrap gap-1.5 mt-2 ml-8">
                {deal.matchBreakdown.ta && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">Same TA</span>
                )}
                {deal.matchBreakdown.modality && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">Same modality</span>
                )}
                {deal.matchBreakdown.phase && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">Same phase</span>
                )}
                {deal.matchBreakdown.indication && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 font-medium">Same indication</span>
                )}
                {deal.matchBreakdown.recency >= 2 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 font-medium">Current year</span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium font-mono">
                  {Math.round(deal.matchScore * 100)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Free tier paywall */}
        {!hasFullAccess && hiddenCount > 0 && (
          <button
            onClick={() => onBuyReport?.()}
            className="w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center hover:border-teal-300 dark:hover:border-teal-600 transition-colors group"
          >
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              +{hiddenCount} more comparable deals + custom comp selection
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upgrade to Pro ({PRICING.PRO_MONTHLY}) to see all comparables and build your own benchmark range
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
