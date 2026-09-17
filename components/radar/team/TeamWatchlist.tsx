'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiJson, btnGhost, btnSecondary, Pill, Skeleton, ErrorState, EmptyState, scoreTone } from '@/components/radar/asset/ui';
import { label, fmtAge } from '@/components/radar/asset/format';
import { ActivityFeed } from './ActivityFeed';

interface WatchAsset { id: string; asset_name: string; company_name: string; phase: string | null; modality: string | null; therapeutic_area: string | null; partnership_status: string | null; licensing_intent_score: number | string | null; score_confidence: number | string | null; originator_country: string | null; last_scored_at: string | null }
interface WatchItem { id: string; asset_id: string; priority: 'high' | 'normal' | 'low'; tags: string[]; notes: string | null; is_mine: boolean; owner: string; added_at: string; score_change: number; asset: WatchAsset | null }
interface Resp { watchlist: WatchItem[]; team: { id: string; name: string } | null; scope: 'mine' | 'team' }

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/**
 * Personal / organisation watchlist table. "Org" is available when the caller
 * has an active team_members row; rows shared into the team are read-only
 * for non-owners (priority/tags edit only on own rows).
 */
export function TeamWatchlist() {
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'priority' | 'score' | 'change' | 'added'>('priority');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiJson<Resp>(`/api/radar/watchlist?scope=${scope}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load watchlist'); }
    finally { setLoading(false); }
  }, [scope]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const list = [...(data?.watchlist ?? [])];
    list.sort((a, b) => {
      if (sort === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || Number(b.asset?.licensing_intent_score ?? 0) - Number(a.asset?.licensing_intent_score ?? 0);
      if (sort === 'score') return Number(b.asset?.licensing_intent_score ?? 0) - Number(a.asset?.licensing_intent_score ?? 0);
      if (sort === 'change') return b.score_change - a.score_change;
      return b.added_at.localeCompare(a.added_at);
    });
    return list;
  }, [data, sort]);

  const setPriority = async (item: WatchItem, priority: WatchItem['priority']) => {
    try {
      await apiJson(`/api/radar/watchlist?asset_id=${item.asset_id}`, { method: 'PATCH', body: JSON.stringify({ priority }) });
      setData(d => d ? { ...d, watchlist: d.watchlist.map(w => w.id === item.id ? { ...w, priority } : w) } : d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const remove = async (item: WatchItem) => {
    try {
      await apiJson(`/api/radar/watchlist?asset_id=${item.asset_id}`, { method: 'DELETE' });
      setData(d => d ? { ...d, watchlist: d.watchlist.filter(w => w.id !== item.id) } : d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/radar/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'xlsx', source: 'watchlist', scope }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `solidus-radar-watchlist-${scope}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed'); } finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Watchlist scope" className="flex gap-1">
          <button type="button" onClick={() => setScope('mine')} aria-pressed={scope === 'mine'} className={`${btnGhost} ${scope === 'mine' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}>Mine</button>
          <button type="button" onClick={() => setScope('team')} aria-pressed={scope === 'team'} disabled={data ? !data.team && scope !== 'team' : false} className={`${btnGhost} ${scope === 'team' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} title={data && !data.team ? 'Join a team to see the org watchlist' : undefined}>
            Org{data?.team ? ` · ${data.team.name}` : ''}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-600 dark:text-neutral-300">Sort{' '}
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
              <option value="priority">Priority</option><option value="score">Score</option><option value="change">Change since watch</option><option value="added">Recently added</option>
            </select>
          </label>
          <button type="button" onClick={exportXlsx} disabled={exporting || !rows.length} className={btnSecondary}>{exporting ? 'Exporting…' : 'Export XLSX'}</button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {loading ? <Skeleton lines={5} /> : rows.length === 0 ? (
        <EmptyState title={scope === 'team' ? 'Nothing on the org watchlist' : 'Your watchlist is empty'} detail="Open any asset brief and press Watch." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[820px] text-xs">
            <caption className="sr-only">Watched assets</caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                <th scope="col" className="px-3 py-2">Priority</th>
                <th scope="col" className="px-3 py-2">Asset</th>
                <th scope="col" className="px-3 py-2">Profile</th>
                <th scope="col" className="px-3 py-2 text-right">Score</th>
                <th scope="col" className="px-3 py-2 text-right">Since watch</th>
                <th scope="col" className="px-3 py-2">Tags</th>
                <th scope="col" className="px-3 py-2">Watched by</th>
                <th scope="col" className="px-3 py-2">Scored</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => {
                const a = w.asset;
                const score = Math.round(Number(a?.licensing_intent_score ?? 0));
                return (
                  <tr key={w.id} className="border-b border-neutral-100 dark:border-neutral-800/70">
                    <td className="px-3 py-2">
                      {w.is_mine ? (
                        <select value={w.priority} onChange={e => setPriority(w, e.target.value as WatchItem['priority'])} aria-label={`Priority for ${a?.asset_name ?? 'asset'}`} className="rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-xs capitalize dark:border-neutral-700 dark:bg-neutral-900">
                          <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
                        </select>
                      ) : <span className="capitalize text-neutral-600 dark:text-neutral-300">{w.priority}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {a ? <Link href={`/radar/${a.id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{a.asset_name}</Link> : <span className="text-neutral-500">Asset removed</span>}
                      {a && <span className="block text-neutral-500 dark:text-neutral-400">{a.company_name}{a.originator_country ? ` · ${label(a.originator_country)}` : ''}</span>}
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{a ? `${label(a.phase)} · ${label(a.modality)} · ${label(a.therapeutic_area)}` : '—'}{a?.partnership_status && <span className="block"><Pill tone={a.partnership_status === 'unpartnered' ? 'emerald' : 'amber'}>{label(a.partnership_status)}</Pill></span>}</td>
                    <td className={`px-3 py-2 text-right font-mono text-sm tabular-nums ${scoreTone(score) === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : scoreTone(score) === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>{score}</td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${w.score_change > 0 ? 'text-emerald-700 dark:text-emerald-400' : w.score_change < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-500'}`}>{w.score_change > 0 ? '+' : ''}{w.score_change}</td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{w.tags.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{w.is_mine ? 'You' : w.owner}</td>
                    <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{fmtAge(a?.last_scored_at)}</td>
                    <td className="px-3 py-2 text-right">{w.is_mine && <button type="button" onClick={() => remove(w)} className={btnGhost}>Remove</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="wl-activity">
        <h2 id="wl-activity" className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">Activity</h2>
        <ActivityFeed scope={scope} />
      </section>
    </div>
  );
}
