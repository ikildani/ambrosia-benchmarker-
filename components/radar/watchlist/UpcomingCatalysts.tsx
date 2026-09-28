'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson, Skeleton, ErrorState, EmptyState, ExternalLink } from '@/components/radar/asset/ui';
import { fmtDate } from '@/components/radar/asset/format';

interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  detail?: string;
  nct_id?: string;
  url?: string;
  asset_id?: string;
  asset_name?: string;
  company_name?: string;
}

/** Days from today (UTC) to an ISO date; negative when past. */
export function daysUntil(iso: string, now = new Date()): number {
  const target = Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

/**
 * Primary completions in the next 90 days across the caller's watched
 * assets (team-shared rows included), from GET /api/radar/timeline?watchlist=true.
 */
export function UpcomingCatalysts() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiJson<{ events: TimelineEvent[]; total: number }>('/api/radar/timeline?watchlist=true');
      setEvents(d.events); setTotal(d.total);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load catalysts'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton lines={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (events.length === 0) return <EmptyState title="No primary completions in the next 90 days" detail="Registry primary-completion dates for watched assets appear here as they come up." />;

  return (
    <div>
      <ol className="divide-y divide-neutral-100 dark:divide-neutral-800/70" aria-label="Upcoming primary completions">
        {events.map(e => {
          const days = daysUntil(e.date);
          return (
            <li key={`${e.nct_id ?? e.title}-${e.date}`} className="flex items-start justify-between gap-3 py-2 text-xs">
              <span className="min-w-0">
                <span className="font-mono tabular-nums text-neutral-500 dark:text-neutral-400">{fmtDate(e.date)}</span>
                <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{days <= 0 ? 'today' : `in ${days} d`}</span>
                <span className="block truncate">
                  {e.asset_id ? <Link href={`/radar/${e.asset_id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{e.asset_name ?? e.title}</Link> : <span className="font-medium">{e.title}</span>}
                  {e.company_name && <span className="text-neutral-500 dark:text-neutral-400"> · {e.company_name}</span>}
                </span>
                {e.detail && <span className="block truncate text-neutral-500 dark:text-neutral-400">{e.detail}</span>}
              </span>
              {e.url && e.nct_id && <ExternalLink href={e.url} className="shrink-0 font-mono">{e.nct_id}</ExternalLink>}
            </li>
          );
        })}
      </ol>
      {total > events.length && <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">Showing {events.length} of {total}.</p>}
    </div>
  );
}
