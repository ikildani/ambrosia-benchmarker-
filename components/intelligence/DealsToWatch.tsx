'use client';

import { useState, useEffect } from 'react';
import { CompanyIntentCard } from './CompanyIntentCard';
import { Eye, Lock } from 'lucide-react';
import Link from 'next/link';

interface DealToWatch {
  companyId: string;
  companyName: string;
  companyType?: string;
  intentScore: number;
  intentTier?: string;
  trend: 'rising' | 'stable' | 'declining';
  trendDelta?: number;
  patentCliffs: { drug: string; loeYear: number; revenueAtRisk?: number }[];
  lastDealDate: string | null;
  timing?: string;
  signals: string[];
  licensingWindow?: {
    status: 'active' | 'closing' | 'closed' | 'no_window';
    urgency: 'high' | 'medium' | 'low';
    estimatedMonthsRemaining: number | null;
    signals: string[];
  };
}

interface DealsToWatchProps {
  selectedTA?: string;
  hasProAccess: boolean;
}

export function DealsToWatch({ selectedTA, hasProAccess }: DealsToWatchProps) {
  const [deals, setDeals] = useState<DealToWatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ section: 'deals_to_watch' });
    if (selectedTA) params.set('ta', selectedTA);

    fetch(`/api/signals?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.dealsToWatch) {
          setDeals(data.dealsToWatch);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedTA]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900/40 border border-slate-800/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500">
        <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No high-intent companies detected for this therapeutic area.</p>
      </div>
    );
  }

  const visibleDeals = hasProAccess ? deals : deals.slice(0, 2);
  const hiddenCount = hasProAccess ? 0 : Math.max(0, deals.length - 2);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleDeals.map((d) => (
          <CompanyIntentCard
            key={d.companyId}
            companyName={d.companyName}
            companyType={d.companyType}
            intentScore={d.intentScore}
            intentTier={d.intentTier}
            trend={d.trend}
            trendDelta={d.trendDelta}
            patentCliffs={d.patentCliffs}
            lastDealDate={d.lastDealDate}
            timing={d.timing}
            signals={d.signals}
            licensingWindow={d.licensingWindow}
            dark
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-4 relative">
          <div className="grid gap-3 sm:grid-cols-2 blur-sm pointer-events-none select-none opacity-40">
            {deals.slice(2, 4).map((d) => (
              <CompanyIntentCard
                key={d.companyId}
                companyName={d.companyName}
                companyType={d.companyType}
                intentScore={d.intentScore}
                trend={d.trend}
                patentCliffs={[]}
                lastDealDate={null}
                signals={[]}
                dark
              />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Lock className="w-5 h-5 mx-auto mb-2 text-slate-500" />
              <p className="text-sm text-slate-400 mb-2">{hiddenCount} more companies with active licensing signals</p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
