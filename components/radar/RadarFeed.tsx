'use client';

import { useState, useEffect, useCallback } from 'react';
import { AssetCard } from './AssetCard';
import { RadarFilters } from './RadarFilters';
import { RadarStats } from './RadarStats';
import { AssetDetailModal } from './AssetDetailModal';

interface Filters {
  ta: string;
  modality: string;
  phase: string;
  partnership: string;
  country: string;
  sort: string;
  q: string;
}

const DEFAULT_FILTERS: Filters = {
  ta: '',
  modality: '',
  phase: '',
  partnership: '',
  country: '',
  sort: 'licensing_intent',
  q: '',
};

interface FeedResponse {
  assets: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface StatsResponse {
  totalAssets: number;
  unpartnered: number;
  activeTrials: number;
  topScoringAssets: Record<string, unknown>[];
}

export function RadarFeed() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filters.ta) params.set('ta', filters.ta);
    if (filters.modality) params.set('modality', filters.modality);
    if (filters.phase) params.set('phase', filters.phase);
    if (filters.partnership) params.set('partnership', filters.partnership);
    if (filters.country) params.set('country', filters.country);
    if (filters.sort) params.set('sort', filters.sort);
    if (debouncedQ) params.set('q', debouncedQ);

    try {
      const res = await fetch(`/api/radar/feed?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data);
      }
    } catch {
      // silently fail — user sees empty state
    } finally {
      setLoading(false);
    }
  }, [filters.ta, filters.modality, filters.phase, filters.partnership, filters.country, filters.sort, debouncedQ, page]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/radar/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silently fail
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filters.ta, filters.modality, filters.phase, filters.partnership, filters.country, debouncedQ]);

  const handleFilterChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = (feed?.assets || []) as any[];

  return (
    <div className="space-y-6">
      <RadarStats stats={stats as StatsResponse | null} loading={statsLoading} />
      <RadarFilters filters={filters} onChange={handleFilterChange} />

      {/* Results bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-amber-500 animate-spin" />
              Scanning universe...
            </span>
          ) : (
            feed ? (
              <span>
                <span className="text-slate-700 dark:text-slate-200 tabular-nums">{feed.total.toLocaleString()}</span> asset{feed.total !== 1 ? 's' : ''}
              </span>
            ) : 'No results'
          )}
        </p>
        {feed && feed.totalPages > 1 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {feed.page} / {feed.totalPages}
          </p>
        )}
      </div>

      {/* Asset grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
              <div className="flex gap-1.5 mb-4">
                <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
              <div className="flex justify-between px-2">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <div className="h-2 w-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30 flex gap-3">
                <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-2.5 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={setSelectedAssetId}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No assets match your filters</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try broadening your search criteria</p>
        </div>
      )}

      {/* Pagination */}
      {feed && feed.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {generatePageNumbers(page, feed.totalPages).map((p, i) => (
            p === '...' ? (
              <span key={`dots-${i}`} className="px-1 text-slate-300 dark:text-slate-600 text-xs">···</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={`w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                  p === page
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            )
          ))}
          <button
            onClick={() => setPage(p => Math.min(feed!.totalPages, p + 1))}
            disabled={page >= feed.totalPages}
            className="px-4 py-2 rounded-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Detail modal */}
      <AssetDetailModal
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
      />
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
