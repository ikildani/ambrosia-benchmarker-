'use client';

import { useState, useEffect } from 'react';
import AlertFeedItem from './AlertFeedItem';
import { Activity, Lock } from 'lucide-react';
import type { UserTier } from '@/types/tier';

interface AlertDeal {
  dealId?: string;
  headline: string;
  date: string;
  ta?: string;
  modality?: string;
  licensor?: string;
  licensee?: string;
  upfront?: number | null;
  totalValue?: number | null;
  impactNote?: string;
}

interface AlertFeedProps {
  tier: UserTier;
  onUpgrade: () => void;
}

export default function AlertFeed({ tier, onUpgrade }: AlertFeedProps) {
  const [alerts, setAlerts] = useState<AlertDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const hasProAccess = tier === 'pro' || tier === 'portfolio' || tier === 'report';

  useEffect(() => {
    fetch('/api/signals?section=alert_feed')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.alertFeed) {
          setAlerts(data.alertFeed);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="h-6 w-40 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded bg-slate-50 dark:bg-slate-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Deal Activity</h3>
        </div>
        <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm">
          No recent deals in your therapeutic areas. Run a calculation to personalize your feed.
        </div>
      </div>
    );
  }

  const freeLimit = 3;
  const displayLimit = showAll ? alerts.length : Math.min(alerts.length, 6);
  const visibleAlerts = alerts.slice(0, displayLimit);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Deal Activity</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">Last 14 days</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {visibleAlerts.map((alert, i) => (
          <AlertFeedItem
            key={alert.dealId || i}
            headline={alert.headline}
            date={alert.date}
            ta={alert.ta}
            licensor={alert.licensor}
            licensee={alert.licensee}
            upfront={alert.upfront}
            totalValue={alert.totalValue}
            impactNote={alert.impactNote}
            blurred={!hasProAccess && i >= freeLimit}
          />
        ))}
      </div>

      {!hasProAccess && alerts.length > freeLimit && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onUpgrade}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors py-2"
          >
            <Lock className="w-3.5 h-3.5" />
            Upgrade to see all deal details
          </button>
        </div>
      )}

      {hasProAccess && alerts.length > 6 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full text-center text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 py-2 transition-colors"
        >
          Show {alerts.length - 6} more deals
        </button>
      )}
    </div>
  );
}
