'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson, Skeleton, ErrorState, EmptyState } from '@/components/radar/asset/ui';
import { fmtDate } from '@/components/radar/asset/format';

interface Activity { asset_id: string; asset_name: string | null; company_name: string | null; date: string; score: number; delta: number; trend: string | null }
interface AlertEvent { id: string; kind: string; channel: string; asset_id: string | null; sent_at: string; read_at: string | null; payload: { title?: string; detail?: string; digest?: { mandate_name: string; total_new: number } } }

/**
 * Recent score moves across the caller's (or team's) watched assets plus
 * in-app alert events. `assetId` narrows both lists to one asset.
 */
export function ActivityFeed({ assetId, scope = 'team' }: { assetId?: string; scope?: 'mine' | 'team' }) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [w, ev] = await Promise.all([
        apiJson<{ activity: Activity[] }>(`/api/radar/watchlist?scope=${scope}&include=activity`),
        apiJson<{ events: AlertEvent[] }>(`/api/radar/alerts?events=true&limit=30${assetId ? `&asset_id=${assetId}` : ''}`),
      ]);
      setActivity(assetId ? w.activity.filter(a => a.asset_id === assetId) : w.activity);
      setEvents(ev.events);
      const unread = ev.events.filter(e => e.channel === 'in_app' && !e.read_at).map(e => e.id);
      if (unread.length > 0) void apiJson('/api/radar/alerts?mark_read=true', { method: 'POST', body: JSON.stringify({ ids: unread }) }).catch(() => undefined);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load activity'); } finally { setLoading(false); }
  }, [assetId, scope]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton lines={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Score moves (30 days)</h3>
        {activity.length === 0 ? <div className="mt-2"><EmptyState title="No score moves" detail="Snapshots with a non-zero delta on watched assets appear here." /></div> : (
          <ol className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {activity.slice(0, 20).map((a, i) => (
              <li key={`${a.asset_id}-${a.date}-${i}`} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <span className="min-w-0 truncate">
                  <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">{fmtDate(a.date)}</span>{' '}
                  {a.asset_name && !assetId ? <Link href={`/radar/${a.asset_id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{a.asset_name}</Link> : null}
                  {a.company_name && !assetId ? <span className="text-neutral-500 dark:text-neutral-400"> · {a.company_name}</span> : null}
                </span>
                <span className="shrink-0 font-mono tabular-nums">
                  <span className={a.delta > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{a.delta > 0 ? '+' : ''}{a.delta}</span>
                  <span className="ml-1.5 text-neutral-600 dark:text-neutral-300">→ {a.score}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Alerts</h3>
        {events.length === 0 ? <div className="mt-2"><EmptyState title="No alerts yet" detail="Threshold, partnership, catalyst and digest alerts land here once rules exist." /></div> : (
          <ol className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800/70">
            {events.map(e => (
              <li key={e.id} className="py-1.5 text-xs">
                <p className="text-neutral-900 dark:text-neutral-100">
                  {e.payload.title || (e.payload.digest ? `${e.payload.digest.total_new} new matches for “${e.payload.digest.mandate_name}”` : e.kind.replace(/_/g, ' '))}
                  {!e.read_at && e.channel === 'in_app' && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">new</span>}
                </p>
                <p className="text-neutral-500 dark:text-neutral-400">{fmtDate(e.sent_at)} · {e.channel.replace('_', '-')}{e.payload.detail ? ` · ${e.payload.detail}` : ''}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
