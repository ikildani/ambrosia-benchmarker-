'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface AlertItem {
  headline: string;
  date: string;
  ta?: string;
  licensor?: string;
  licensee?: string;
}

export default function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
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
  }, []);

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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Deal alerts"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
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
