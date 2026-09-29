'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { radarVisibleTo } from '@/lib/radar/launch';

interface AlertItem {
  headline: string;
  date: string;
  ta?: string;
  licensor?: string;
  licensee?: string;
}

interface RadarEvent {
  id: string;
  kind: string;
  channel: string;
  asset_id: string | null;
  mandate_id: string | null;
  sent_at: string;
  read_at: string | null;
  payload: { title?: string; detail?: string; digest?: { mandate_name: string; total_new: number } };
}


function radarTitle(e: RadarEvent): string {
  if (e.payload.title) return e.payload.title;
  if (e.payload.digest) return `${e.payload.digest.total_new} new matches for “${e.payload.digest.mandate_name}”`;
  return e.kind.replace(/_/g, ' ');
}

function radarHref(e: RadarEvent): string {
  if (e.mandate_id) return `/radar/mandates/${e.mandate_id}`;
  if (e.asset_id) return `/radar/${e.asset_id}`;
  return '/radar/alerts';
}

/**
 * Header bell: the deal alert feed (recent announced deals) plus, when Search
 * & Evaluation is on, the caller's own Radar alerts (score crossings,
 * partnership changes, catalysts, mandate digests). Deal alerts are "read"
 * per browser (localStorage); Radar alerts are read server-side, on the
 * Alerts page, so their unread count comes from the API.
 */
export default function NotificationBell() {
  // Radar alerts only when the module is public or this is an internal preview account.
  const { user } = useAuth();
  const RADAR_ENABLED = radarVisibleTo(user?.email);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [radar, setRadar] = useState<RadarEvent[]>([]);
  const [radarUnread, setRadarUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/signals?section=alert_feed')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.alertFeed) {
          const items = (data.alertFeed as AlertItem[]).slice(0, 5);
          setAlerts(items);

          try {
            const lastViewed = localStorage.getItem('solidus_alerts_last_viewed');
            if (lastViewed) {
              const count = items.filter(a => new Date(a.date) > new Date(lastViewed)).length;
              setUnreadCount(count);
            } else {
              setUnreadCount(items.length);
            }
          } catch {
            setUnreadCount(items.length);
          }
        }
      })
      .catch(() => {});

    if (RADAR_ENABLED) {
      fetch('/api/radar/alerts?events=true&limit=5')
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data || !Array.isArray(data.events)) return;
          setRadar(data.events as RadarEvent[]);
          setRadarUnread(Number(data.unread) || 0);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the viewer changes
  }, [RADAR_ENABLED]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen(!open);
    if (!open) {
      try {
        localStorage.setItem('solidus_alerts_last_viewed', new Date().toISOString());
      } catch {}
      setUnreadCount(0);
    }
  }

  const showDot = unreadCount > 0 || radarUnread > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label={radarUnread > 0 ? `Alerts, ${radarUnread} unread` : 'Deal alerts'}
      >
        <Bell className="w-5 h-5" />
        {showDot && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          {RADAR_ENABLED && (
            <>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Search & Evaluation</h4>
                {radarUnread > 0 && (
                  <span className="rounded-full bg-teal-600 px-1.5 text-[11px] font-semibold text-white">{radarUnread} new</span>
                )}
              </div>
              {radar.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-slate-500">
                  No alerts yet.{' '}
                  <Link href="/radar/alerts" onClick={() => setOpen(false)} className="font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700">Set up a rule</Link>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                  {radar.map(e => (
                    <Link
                      key={e.id}
                      href={radarHref(e)}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                        {radarTitle(e)}
                        {e.channel === 'in_app' && !e.read_at && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-teal-500 align-middle" aria-label="unread" />}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(e.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {e.payload.detail ? ` · ${e.payload.detail}` : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <Link href="/radar/alerts" onClick={() => setOpen(false)} className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700">
                  All alerts and rules →
                </Link>
              </div>
            </>
          )}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Deals</h4>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No recent deal activity</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
              {alerts.map((a, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                    {a.licensor && a.licensee ? `${a.licensor} → ${a.licensee}` : a.headline}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {a.ta && (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                        {a.ta.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
            <Link
              href="/dashboard?tab=overview"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700"
            >
              View all in Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
