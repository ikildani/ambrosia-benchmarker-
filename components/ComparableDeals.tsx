'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationInput } from '@/lib/calculations';
import { PRICING } from '@/lib/config/constants';
import { weightedQuantile, recencyWeight } from '@/lib/math/quantile';
import type { UserTier } from '@/types/tier';

// ── Types ────────────────────────────────────────────────────────────────────

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
  tier: UserTier;
  onBuyReport?: () => void;
}

type RecencyFilter = 'all' | '24mo' | '12mo';
type SortKey = 'matchScore' | 'upfrontM' | 'totalValueM' | 'year';
type SortDir = 'asc' | 'desc';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMatchBadge(score: number): { label: string; className: string } {
  if (score >= 0.7) return { label: 'Excellent', className: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' };
  if (score >= 0.5) return { label: 'Strong', className: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' };
  if (score >= 0.35) return { label: 'Good', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' };
  return { label: 'Related', className: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };
}

function fmtM(val: number): string {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${Math.round(val)}M`;
}

function computeBenchmark(deals: EnrichedDeal[], selectedIds: Set<string>): BenchmarkRange | null {
  const selected = deals.filter(d => selectedIds.has(d.id));
  const upfrontPairs = selected
    .filter(d => d.upfrontM && d.upfrontM > 0)
    .map(d => ({ value: d.upfrontM!, weight: recencyWeight(d.year) }));
  const totalPairs = selected
    .filter(d => d.totalValueM && d.totalValueM > 0)
    .map(d => ({ value: d.totalValueM!, weight: recencyWeight(d.year) }));
  if (upfrontPairs.length < 2 && totalPairs.length < 2) return null;
  return {
    upfront: { p25: weightedQuantile(upfrontPairs, 0.25), median: weightedQuantile(upfrontPairs, 0.5), p75: weightedQuantile(upfrontPairs, 0.75) },
    totalValue: { p25: weightedQuantile(totalPairs, 0.25), median: weightedQuantile(totalPairs, 0.5), p75: weightedQuantile(totalPairs, 0.75) },
    n: selected.length,
  };
}

// ── Distribution Chart ───────────────────────────────────────────────────────

function DealDistributionChart({
  deals,
  selectedIds,
  benchmark,
  field,
  label,
}: {
  deals: EnrichedDeal[];
  selectedIds: Set<string>;
  benchmark: BenchmarkRange | null;
  field: 'upfrontM' | 'totalValueM';
  label: string;
}) {
  const bKey = field === 'upfrontM' ? 'upfront' : 'totalValue';
  const dealsWithValue = deals.filter(d => d[field] && d[field]! > 0);
  if (dealsWithValue.length < 3) return null;

  const values = dealsWithValue.map(d => d[field]!);
  const maxVal = Math.max(...values) * 1.1;
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const pct = (v: number) => ((v - minVal) / range) * 100;

  const p25 = benchmark ? benchmark[bKey].p25 : 0;
  const median = benchmark ? benchmark[bKey].median : 0;
  const p75 = benchmark ? benchmark[bKey].p75 : 0;

  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="relative h-14 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* IQR shaded band */}
        {benchmark && (
          <div
            className="absolute top-0 bottom-0 bg-teal-100/60 dark:bg-teal-900/25 border-x border-teal-200 dark:border-teal-700/40"
            style={{ left: `${pct(p25)}%`, width: `${pct(p75) - pct(p25)}%` }}
          />
        )}
        {/* Median line */}
        {benchmark && median > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-teal-500 dark:bg-teal-400 z-10"
            style={{ left: `${pct(median)}%` }}
          >
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-teal-600 dark:text-teal-300 whitespace-nowrap">
              {fmtM(median)}
            </div>
          </div>
        )}
        {/* Deal dots */}
        {dealsWithValue.map(deal => {
          const isSelected = selectedIds.has(deal.id);
          const x = pct(deal[field]!);
          return (
            <div
              key={deal.id}
              className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
                isSelected
                  ? 'w-3 h-3 bg-teal-500 dark:bg-teal-400 border-2 border-white dark:border-slate-900 shadow-sm z-20'
                  : 'w-2 h-2 bg-slate-300 dark:bg-slate-600 opacity-40 z-10'
              }`}
              style={{ left: `${x}%`, marginLeft: isSelected ? '-6px' : '-4px' }}
              title={`${deal.licensor} → ${deal.licensee} (${deal.year}): ${fmtM(deal[field]!)}`}
            />
          );
        })}
        {/* Axis labels */}
        <div className="absolute bottom-0.5 left-1 text-[8px] text-slate-400 dark:text-slate-500">{fmtM(minVal || 1)}</div>
        <div className="absolute bottom-0.5 right-1 text-[8px] text-slate-400 dark:text-slate-500">{fmtM(maxVal)}</div>
      </div>
      {benchmark && (
        <div className="flex justify-between mt-1 text-[9px] text-slate-400 dark:text-slate-500">
          <span style={{ marginLeft: `${pct(p25)}%` }}>p25: {fmtM(p25)}</span>
          <span style={{ marginRight: `${100 - pct(p75)}%` }}>p75: {fmtM(p75)}</span>
        </div>
      )}
    </div>
  );
}

// ── Sortable Column Header ───────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        align === 'right' ? 'ml-auto' : ''
      } ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
    >
      {label}
      {isActive && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentDir === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
        </svg>
      )}
    </button>
  );
}

// ── Filter Pill ──────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
      aria-label={label}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

const MIN_COMPS = 3;
const FREE_DEAL_LIMIT = 3;

export default function ComparableDeals({ inputs, tier, onBuyReport }: ComparableDealsProps) {
  const [deals, setDeals] = useState<EnrichedDeal[]>([]);
  const [fullBenchmark, setFullBenchmark] = useState<BenchmarkRange | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);

  // Interaction state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionActive, setSelectionActive] = useState(false);
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [dealTypeFilter, setDealTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('matchScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const hasFullAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  // Fetch enriched deals
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
        setSelectionActive(false);
      })
      .catch(() => { setDeals([]); setTotalAvailable(0); setFullBenchmark(null); })
      .finally(() => setLoading(false));
  }, [inputs.therapeuticArea, inputs.modality, inputs.indication, inputs.phase, inputs.dealType]);

  // Derived filter options
  const filterOptions = useMemo(() => {
    const phases = new Set(deals.map(d => d.phase).filter(Boolean));
    const modalities = new Set(deals.map(d => d.modality).filter(Boolean));
    const dealTypes = new Set(deals.map(d => d.dealType).filter(Boolean));
    return {
      phases: [{ value: 'all', label: 'All phases' }, ...[...phases].map(p => ({ value: p!, label: p! }))],
      modalities: [{ value: 'all', label: 'All modalities' }, ...[...modalities].map(m => ({ value: m!, label: m! }))],
      dealTypes: [{ value: 'all', label: 'All deal types' }, ...[...dealTypes].map(t => ({ value: t!, label: t! }))],
    };
  }, [deals]);

  // Filter + sort
  const currentYear = new Date().getFullYear();
  const processedDeals = useMemo(() => {
    let filtered = deals.filter(deal => {
      if (recencyFilter === '12mo' && deal.year < currentYear - 1) return false;
      if (recencyFilter === '24mo' && deal.year < currentYear - 2) return false;
      if (phaseFilter !== 'all' && deal.phase !== phaseFilter) return false;
      if (modalityFilter !== 'all' && deal.modality !== modalityFilter) return false;
      if (dealTypeFilter !== 'all' && deal.dealType !== dealTypeFilter) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      const av = typeof aVal === 'number' ? aVal : 0;
      const bv = typeof bVal === 'number' ? bVal : 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return filtered;
  }, [deals, recencyFilter, phaseFilter, modalityFilter, dealTypeFilter, sortKey, sortDir, currentYear]);

  const visibleDeals = hasFullAccess ? processedDeals : processedDeals.slice(0, FREE_DEAL_LIMIT);
  const hiddenCount = hasFullAccess ? 0 : Math.max(0, totalAvailable - FREE_DEAL_LIMIT);

  // Benchmark computation
  const selectedBenchmark = useMemo(() => {
    if (!selectionActive) return fullBenchmark;
    return computeBenchmark(deals, selectedIds);
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

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  if (!loading && deals.length === 0) return null;

  return (
    <div className="mt-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Comparable Transactions
          </h3>
          {selectionActive && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/30">
              Custom comp set
            </span>
          )}
        </div>
        {hasFullAccess && deals.length > 0 && !loading && (
          <div className="flex items-center gap-3">
            {selectionActive && (
              <button onClick={selectAll} className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium">
                Reset to all
              </button>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              {selectedIds.size}/{deals.length}
            </span>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {hasFullAccess ? 'Select deals to build your comp set. Benchmark range updates in real time.' : 'Recent deals with similar characteristics'}
      </p>

      {/* ── Distribution Charts ──────────────────────────────────────── */}
      {hasFullAccess && !loading && selectedBenchmark && (
        <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              {selectionActive ? 'Your Comp Set Distribution' : 'Market Distribution'}
            </p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              n = {selectedBenchmark.n} · recency-weighted · teal dots = selected
            </span>
          </div>
          <DealDistributionChart deals={deals} selectedIds={selectedIds} benchmark={selectedBenchmark} field="upfrontM" label="Upfront Payment Distribution" />
          <DealDistributionChart deals={deals} selectedIds={selectedIds} benchmark={selectedBenchmark} field="totalValueM" label="Total Deal Value Distribution" />

          {/* Percentile positioning */}
          {selectionActive && fullBenchmark && selectedBenchmark && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Upfront median</p>
                <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{fmtM(selectedBenchmark.upfront.median)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {deviationPct > 0 ? '+' : ''}{Math.round(deviationPct)}% vs. full market ({fmtM(fullBenchmark.upfront.median)})
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total deal median</p>
                <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{fmtM(selectedBenchmark.totalValue.median)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {fullBenchmark.totalValue.median > 0 ? `${Math.round(((selectedBenchmark.totalValue.median - fullBenchmark.totalValue.median) / fullBenchmark.totalValue.median) * 100)}% vs. full market` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Deviation warning */}
          {selectionActive && Math.abs(deviationPct) > 30 && (
            <div className={`mt-3 p-2.5 rounded-lg text-xs ${
              Math.abs(deviationPct) > 50
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/30'
            }`}>
              <span className="font-semibold">{Math.abs(deviationPct) > 50 ? 'Significant deviation' : 'Note'}:</span>{' '}
              Your comp set median is {deviationPct > 0 ? '+' : ''}{Math.round(deviationPct)}% from the full market. {Math.abs(deviationPct) > 50 ? 'Consider whether this selection is representative of the deals you expect to negotiate against.' : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Filters + Sort ───────────────────────────────────────────── */}
      {hasFullAccess && !loading && deals.length > 0 && (
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <FilterSelect label="Phase" value={phaseFilter} options={filterOptions.phases} onChange={setPhaseFilter} />
            <FilterSelect label="Modality" value={modalityFilter} options={filterOptions.modalities} onChange={setModalityFilter} />
            <FilterSelect label="Deal type" value={dealTypeFilter} options={filterOptions.dealTypes} onChange={setDealTypeFilter} />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {([['12mo', '12mo'], ['24mo', '24mo'], ['all', 'All']] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRecencyFilter(value)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  recencyFilter === value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Column Headers (sortable) ────────────────────────────────── */}
      {hasFullAccess && !loading && visibleDeals.length > 0 && (
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-4 py-2 mb-1 items-center">
          <div className="w-5" />
          <SortHeader label="Deal" sortKey="matchScore" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Year" sortKey="year" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="Upfront" sortKey="upfrontM" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="Total" sortKey="totalValueM" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
        </div>
      )}

      {/* ── Deal List ────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="flex-1"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-1" /><div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-32" /></div>
                  <div className="h-4 bg-teal-100 dark:bg-teal-900/30 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && visibleDeals.map(deal => {
          const matchBadge = getMatchBadge(deal.matchScore);
          const isSelected = selectedIds.has(deal.id);

          return (
            <div
              key={deal.id}
              onClick={hasFullAccess ? () => toggleDeal(deal.id) : undefined}
              className={`relative grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center p-3 border rounded-lg transition-all duration-150 ${
                hasFullAccess ? 'cursor-pointer' : ''
              } ${
                hasFullAccess && selectionActive && !isSelected
                  ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 opacity-40'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
              }`}
            >
              {/* Checkbox */}
              {hasFullAccess ? (
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              ) : <div className="w-5" />}

              {/* Deal info */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{deal.licensor} <span className="text-slate-400 dark:text-slate-500 font-normal">→</span> {deal.licensee}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 ${matchBadge.className}`}>{matchBadge.label}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {deal.matchBreakdown.ta && <span className="text-[9px] px-1 py-px rounded bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300">TA</span>}
                  {deal.matchBreakdown.modality && <span className="text-[9px] px-1 py-px rounded bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300">Mod</span>}
                  {deal.matchBreakdown.phase && <span className="text-[9px] px-1 py-px rounded bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300">Phase</span>}
                  {deal.matchBreakdown.indication && <span className="text-[9px] px-1 py-px rounded bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300">Ind</span>}
                  {deal.phase && <span className="text-[10px] text-slate-400 dark:text-slate-500">{deal.phase}</span>}
                  {deal.modality && <span className="text-[10px] text-slate-400 dark:text-slate-500">· {deal.modality}</span>}
                </div>
              </div>

              {/* Year */}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">{deal.year}</span>

              {/* Upfront */}
              <div className="text-right">
                {deal.upfront ? (
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-mono tabular-nums">{deal.upfront}</span>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
                )}
              </div>

              {/* Total */}
              <div className="text-right">
                <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 font-mono tabular-nums">{deal.totalValue}</span>
              </div>
            </div>
          );
        })}

        {/* Min comps warning */}
        {hasFullAccess && selectionActive && selectedIds.size <= MIN_COMPS && (
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-center">
            Minimum {MIN_COMPS} deals required for benchmark range
          </div>
        )}

        {/* Free tier paywall */}
        {!hasFullAccess && hiddenCount > 0 && (
          <button
            onClick={() => onBuyReport?.()}
            className="w-full p-5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-center hover:border-teal-300 dark:hover:border-teal-600 transition-colors group"
          >
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              +{hiddenCount} more comparable deals
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upgrade to Pro ({PRICING.PRO_MONTHLY}) — full comp set, custom selection, live benchmark range, distribution charts
            </p>
          </button>
        )}
      </div>

      {/* AI Comparable Narration — Pro only, async loaded */}
      {hasFullAccess && visibleDeals.length > 0 && (
        <ComparableNarrationSection inputs={inputs} deals={visibleDeals} />
      )}
    </div>
  );
}

// ── AI Narration Sub-Component ──

function ComparableNarrationSection({ inputs, deals }: { inputs: CalculationInput; deals: EnrichedDeal[] }) {
  const [narration, setNarration] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useCallback(() => {}, []);
  const [hasStarted, setHasStarted] = useState(false);

  const generateNarration = useCallback(async () => {
    if (loading || narration) return;
    setLoading(true);
    setError(null);
    try {
      const comparables = deals.map(d => ({
        id: d.id,
        parties: d.parties,
        totalValue: d.totalValue,
        year: d.year,
        phase: d.phase,
        relevanceReasons: d.relevanceReasons,
        scoreBreakdown: { weightedScore: d.matchScore },
      }));

      const res = await fetch('/api/comparable-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, results: { terms: {} }, comparables }),
        signal: AbortSignal.timeout(35000),
      });
      if (res.ok) {
        const data = await res.json();
        setNarration(data.narration);
      } else {
        setError('Unable to generate analysis');
      }
    } catch {
      setError('Analysis timed out');
    } finally {
      setLoading(false);
    }
  }, [inputs, deals, loading, narration]);

  // Auto-trigger once on mount
  useEffect(() => {
    if (!hasStarted && deals.length > 0) {
      setHasStarted(true);
      const timer = setTimeout(generateNarration, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasStarted, deals.length, generateNarration]);

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">AI Comparable Analysis</span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">Ambrosia AI</span>
          </div>
        </div>
        {narration?.confidenceLevel && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            narration.confidenceLevel === 'high' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : narration.confidenceLevel === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
          }`}>
            {narration.confidenceLevel} confidence
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-6 justify-center">
          <div className="w-5 h-5 border-2 border-purple-200 dark:border-purple-800 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Analyzing comparables...</span>
        </div>
      )}

      {error && !narration && (
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500">{error}</p>
          <button onClick={generateNarration} className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1 hover:underline">Try again</button>
        </div>
      )}

      {narration && (
        <div className="space-y-3">
          {/* Per-deal narratives */}
          {narration.narratedDeals?.map((d: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{d.parties}</span>
                {d.netAdjustment_pct !== 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${d.netAdjustment_pct > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                    {d.netAdjustment_pct > 0 ? '+' : ''}{d.netAdjustment_pct}% adj
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{d.detailedNarrative}</p>
              {d.adjustments?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.adjustments.map((a: any, j: number) => (
                    <span key={j} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${a.direction === 'premium' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : a.direction === 'discount' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                      {a.factor}: {a.direction === 'discount' ? '-' : '+'}{a.magnitude_pct}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Synthesis */}
          {narration.synthesisNarrative && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-200 dark:border-purple-800">
              <p className="text-xs font-semibold text-purple-800 dark:text-purple-300 mb-1">Synthesis</p>
              <p className="text-xs text-purple-700 dark:text-purple-300/80 leading-relaxed">{narration.synthesisNarrative}</p>
            </div>
          )}

          {/* Valuation implication */}
          {narration.valuationImplication && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/10 dark:to-cyan-900/10 border border-teal-200 dark:border-teal-800">
              <p className="text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">Valuation Implication</p>
              <p className="text-xs text-teal-700 dark:text-teal-300/80 leading-relaxed">{narration.valuationImplication}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
