'use client';

import { useState, useEffect, useCallback } from 'react';
import { AssetCard } from './AssetCard';
import { AssetDetailModal } from './AssetDetailModal';

interface WatchlistEntry {
  id: string;
  asset_id: string;
  added_at: string;
  score_at_add: number | null;
  tags: string[] | null;
  notes: string | null;
  priority: string | null;
  asset: Record<string, unknown> | null;
  score_change: number;
}

interface Props {
  onBack: () => void;
}

export function RadarWatchlist({ onBack }: Props) {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/radar/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.watchlist || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const removeFromWatchlist = async (assetId: string) => {
    setRemoving(assetId);
    try {
      const res = await fetch(`/api/radar/watchlist?asset_id=${assetId}`, { method: 'DELETE' });
      if (res.ok) {
        setWatchlist(prev => prev.filter(w => w.asset_id !== assetId));
      }
    } catch { /* silent */ }
    finally { setRemoving(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Watchlist</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {watchlist.length} asset{watchlist.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : watchlist.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {watchlist.map(entry => (
            <div key={entry.id} className="relative group/watch">
              {/* Score change badge */}
              {entry.score_change !== 0 && (
                <div className={`absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  entry.score_change > 0
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {entry.score_change > 0 ? '+' : ''}{entry.score_change}
                </div>
              )}

              {entry.asset ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <AssetCard asset={entry.asset as any} onClick={setSelectedAssetId} />
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5">
                  <p className="text-sm text-slate-400">Asset no longer available</p>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); removeFromWatchlist(entry.asset_id); }}
                disabled={removing === entry.asset_id}
                className="absolute top-2 right-2 opacity-0 group-hover/watch:opacity-100 p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 transition-all z-10"
              >
                {removing === entry.asset_id ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-red-500 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>

              {/* Watch metadata */}
              {(entry.tags?.length || entry.notes) && (
                <div className="mt-1 px-1 flex items-center gap-2">
                  {entry.tags?.map((tag, i) => (
                    <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                      {tag}
                    </span>
                  ))}
                  {entry.notes && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={entry.notes}>
                      {entry.notes}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No assets in your watchlist</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Click the star on any asset card to start tracking it</p>
        </div>
      )}

      <AssetDetailModal assetId={selectedAssetId} onClose={() => setSelectedAssetId(null)} />
    </div>
  );
}

// Hook for adding to watchlist from any component
export function useWatchlist() {
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/radar/watchlist')
      .then(r => r.ok ? r.json() : { watchlist: [] })
      .then(data => {
        setWatchedIds(new Set((data.watchlist || []).map((w: { asset_id: string }) => w.asset_id)));
      })
      .catch(() => {});
  }, []);

  const toggle = async (assetId: string, currentScore?: number) => {
    setLoadingId(assetId);
    try {
      if (watchedIds.has(assetId)) {
        const res = await fetch(`/api/radar/watchlist?asset_id=${assetId}`, { method: 'DELETE' });
        if (res.ok) setWatchedIds(prev => { const next = new Set(prev); next.delete(assetId); return next; });
      } else {
        const res = await fetch('/api/radar/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_id: assetId, score_at_add: currentScore }),
        });
        if (res.ok) setWatchedIds(prev => new Set(prev).add(assetId));
      }
    } catch { /* silent */ }
    finally { setLoadingId(null); }
  };

  return { watchedIds, toggle, loadingId };
}
