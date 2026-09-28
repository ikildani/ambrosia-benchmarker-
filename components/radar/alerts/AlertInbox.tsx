'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson, btnGhost, Skeleton, ErrorState, EmptyState } from '@/components/radar/asset/ui';
import { fmtDateTime } from '@/components/radar/asset/format';

export interface AlertEvent {
  id: string;
  kind: string;
  channel: string;
  asset_id: string | null;
  mandate_id: string | null;
  sent_at: string;
  delivery_status: string | null;
  read_at: string | null;
  payload: { title?: string; detail?: string; url?: string; digest?: { mandate_name: string; total_new: number } };
}

export function eventTitle(e: AlertEvent): string {
  if (e.payload.title) return e.payload.title;
  if (e.payload.digest) return `${e.payload.digest.total_new} new matches for “${e.payload.digest.mandate_name}”`;
  return e.kind.replace(/_/g, ' ');
}

function eventHref(e: AlertEvent): string | null {
  if (e.mandate_id) return `/radar/mandates/${e.mandate_id}`;
  if (e.asset_id) return `/radar/${e.asset_id}`;
  return null;
}

/**
 * Every alert delivered to the caller (in-app, email, Slack), newest first.
 * In-app events are marked read when the inbox is opened, so the unread
 * count in the header bell clears here.
 */
export function AlertInbox({ limit = 50 }: { limit?: number }) {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiJson<{ events: AlertEvent[] }>(`/api/radar/alerts?events=true&limit=${limit}`);
      setEvents(data.events);
      const unread = data.events.filter(e => e.channel === 'in_app' && !e.read_at).map(e => e.id);
      if (unread.length > 0) {
        void apiJson('/api/radar/alerts?mark_read=true', { method: 'POST', body: JSON.stringify({ ids: unread }) }).catch(() => undefined);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load alerts'); } finally { setLoading(false); }
  }, [limit]);
  useEffect(() => { void load(); }, [load]);

  const shown = filter === 'unread' ? events.filter(e => e.channel === 'in_app' && !e.read_at) : events;

  if (loading) return <Skeleton lines={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div role="group" aria-label="Filter alerts" className="flex gap-1">
          <button type="button" onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={`${btnGhost} ${filter === 'all' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}>All</button>
          <button type="button" onClick={() => setFilter('unread')} aria-pressed={filter === 'unread'} className={`${btnGhost} ${filter === 'unread' ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}>Unread</button>
        </div>
        <button type="button" onClick={load} className={btnGhost}>Refresh</button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={filter === 'unread' ? 'Nothing unread' : 'No alerts yet'} detail="Threshold, partnership, catalyst, watchlist and mandate digest alerts land here once a rule fires." />
      ) : (
        <ol className="divide-y divide-neutral-100 dark:divide-neutral-800/70" aria-label="Alerts">
          {shown.map(e => {
            const href = eventHref(e);
            const unread = e.channel === 'in_app' && !e.read_at;
            return (
              <li key={e.id} className="py-2 text-xs">
                <p className="text-neutral-900 dark:text-neutral-100">
                  {href ? <Link href={href} className="font-medium hover:underline">{eventTitle(e)}</Link> : <span className="font-medium">{eventTitle(e)}</span>}
                  {unread && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">new</span>}
                </p>
                <p className="text-neutral-500 dark:text-neutral-400">
                  {fmtDateTime(e.sent_at)} · {e.channel.replace('_', '-')}
                  {e.delivery_status && e.delivery_status !== 'sent' && e.delivery_status !== 'delivered' ? ` · ${e.delivery_status}` : ''}
                  {e.payload.detail ? ` · ${e.payload.detail}` : ''}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
