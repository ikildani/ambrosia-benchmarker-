'use client';

import { useState, useEffect, useCallback } from 'react';
import { AssetCard } from './AssetCard';
import { RadarFilters } from './RadarFilters';
import { RadarStats } from './RadarStats';
import { AssetDetailModal } from './AssetDetailModal';
import { OpportunityCard } from './OpportunityCard';
import { CustomWeightsPanel, type WeightConfig, DEFAULT_WEIGHTS } from './CustomWeights';

type ViewMode = 'assets' | 'opportunities' | 'acquirer';

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
  const [viewMode, setViewMode] = useState<ViewMode>('assets');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [opportunities, setOpportunities] = useState<Record<string, unknown>[] | null>(null);
  const [oppsLoading, setOppsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);
  const [, setCustomWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [acquirerData, setAcquirerData] = useState<Record<string, unknown>[] | null>(null);
  const [acquirerLoading, setAcquirerLoading] = useState(false);
  const [nlSearchResults, setNlSearchResults] = useState<{ assets: Record<string, unknown>[]; filters: Record<string, unknown>; query: string } | null>(null);
  const [nlSearching, setNlSearching] = useState(false);

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

  const fetchOpportunities = useCallback(async () => {
    setOppsLoading(true);
    try {
      const res = await fetch('/api/radar/opportunities?top=50');
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch {
      // silently fail
    } finally {
      setOppsLoading(false);
    }
  }, []);

  const fetchAcquirerView = useCallback(async () => {
    setAcquirerLoading(true);
    try {
      const res = await fetch('/api/radar/acquirer-view?top=20');
      if (res.ok) {
        const data = await res.json();
        setAcquirerData(data.acquirers || []);
      }
    } catch { /* silent */ }
    finally { setAcquirerLoading(false); }
  }, []);

  const handleNLSearch = useCallback(async (query: string) => {
    if (query.length < 5) { setNlSearchResults(null); return; }
    setNlSearching(true);
    try {
      const res = await fetch('/api/radar/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setNlSearchResults({ assets: data.assets, filters: data.parsed_filters, query: data.query });
      }
    } catch { /* silent */ }
    finally { setNlSearching(false); }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (viewMode === 'opportunities' && !opportunities) fetchOpportunities(); }, [viewMode, opportunities, fetchOpportunities]);
  useEffect(() => { if (viewMode === 'acquirer' && !acquirerData) fetchAcquirerView(); }, [viewMode, acquirerData, fetchAcquirerView]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filters.ta, filters.modality, filters.phase, filters.partnership, filters.country, debouncedQ]);

  const handleFilterChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assets = (feed?.assets || []) as any[];

  return (
    <div className="space-y-6">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RadarStats stats={stats as any} loading={statsLoading} />

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            onClick={() => setViewMode('assets')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'assets'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              Asset Universe
            </span>
          </button>
          <button
            onClick={() => setViewMode('opportunities')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'opportunities'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Deal Opportunities
              {opportunities && opportunities.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  {opportunities.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setViewMode('acquirer')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'acquirer'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Acquirer View
            </span>
          </button>
        </div>
        <button
          onClick={() => setShowWeights(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Custom Weights
        </button>
      </div>

      {viewMode === 'assets' && <RadarFilters filters={filters} onChange={handleFilterChange} onNLSearch={handleNLSearch} nlSearching={nlSearching} />}

      {/* Results bar */}
      {viewMode === 'assets' && (
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
      )}

      {/* ── DEAL OPPORTUNITIES VIEW ────────────────────── */}
      {viewMode === 'opportunities' && (
        <>
          {oppsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-2"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" /><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" /></div>
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                  </div>
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded mt-4" />
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mt-2" />
                </div>
              ))}
            </div>
          ) : opportunities && opportunities.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-1">
                <span className="text-slate-700 dark:text-slate-200 tabular-nums">{opportunities.length}</span> AI-proposed transactions ranked by opportunity score
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {opportunities.map((opp: any) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="text-3xl block mb-3">🎯</span>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No deal opportunities yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">The Deal Creation Engine runs daily at 11:30 AM UTC</p>
            </div>
          )}
        </>
      )}

      {/* ── ACQUIRER VIEW ──────────────────────────────── */}
      {viewMode === 'acquirer' && (
        <>
          {acquirerLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse">
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : acquirerData && acquirerData.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-1">
                Top acquirers by proposed deal opportunities — click to explore their recommended assets
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {acquirerData.map((acq: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      setViewMode('opportunities');
                    }}
                    className="text-left rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 hover:border-amber-300 dark:hover:border-amber-700/50 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {acq.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {acq.count} proposed deal{acq.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {acq.count}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="text-3xl block mb-3">👁️</span>
              <p className="text-slate-500 dark:text-slate-400 font-medium">No acquirer data yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">The Deal Creation Engine runs daily at 11:30 AM UTC</p>
            </div>
          )}
        </>
      )}

      {/* ── NL SEARCH RESULTS OVERLAY ────────────────────── */}
      {nlSearchResults && viewMode === 'assets' && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-700/30 bg-amber-50/30 dark:bg-amber-900/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">AI Search Results</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                &ldquo;{nlSearchResults.query}&rdquo; — {nlSearchResults.assets.length} matches
              </p>
            </div>
            <button
              onClick={() => setNlSearchResults(null)}
              className="text-[10px] px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 transition-colors font-semibold"
            >
              Clear
            </button>
          </div>
          {nlSearchResults.assets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {nlSearchResults.assets.map((asset: any) => (
                <AssetCard key={asset.id} asset={asset} onClick={setSelectedAssetId} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">No assets match your query</p>
          )}
        </div>
      )}

      {/* ── ASSET FEED VIEW ────────────────────────────── */}
      {viewMode === 'assets' && !nlSearchResults && (
        <>
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

        </>
      )}

      {/* Detail modal */}
      <AssetDetailModal
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
      />

      {/* Custom weights panel */}
      <CustomWeightsPanel
        isOpen={showWeights}
        onClose={() => setShowWeights(false)}
        onChange={setCustomWeights}
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
