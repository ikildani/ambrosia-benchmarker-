'use client';

import { useState, useEffect } from 'react';
import { CompanyIntentCard } from '../intelligence/CompanyIntentCard';
import { ArrowRight, Eye } from 'lucide-react';
import Link from 'next/link';
import type { UserTier } from '@/types/tier';

interface DealToWatch {
  companyId: string;
  companyName: string;
  companyType?: string;
  intentScore: number;
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

interface DealsToWatchTeaserProps {
  tier: UserTier;
  onUpgrade: () => void;
}

export default function DealsToWatchTeaser({ tier, onUpgrade }: DealsToWatchTeaserProps) {
  const [deals, setDeals] = useState<DealToWatch[]>([]);
  const [loading, setLoading] = useState(true);
  const hasProAccess = tier === 'pro' || tier === 'portfolio' || tier === 'report';

  useEffect(() => {
    fetch('/api/signals?section=deals_to_watch')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.dealsToWatch) {
          setDeals(data.dealsToWatch.slice(0, 3).map((d: any) => ({
            ...d,
            companyName: d.companyName || d.name || 'Unknown',
            patentCliffs: d.patentCliffs || d.licensingWindow?.patentCliffDrug ? [{
              drug: d.licensingWindow?.patentCliffDrug || '',
              loeYear: d.licensingWindow?.patentCliffYear || 0,
              revenueAtRisk: d.licensingWindow?.revenueAtRiskM,
            }] : [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="h-6 w-40 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-slate-50 dark:bg-slate-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (deals.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Companies to Watch</h3>
        </div>
        {hasProAccess && (
          <Link
            href="/intelligence"
            className="flex items-center gap-1 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {deals.map((d) => (
          <CompanyIntentCard
            key={d.companyId}
            companyName={d.companyName}
            companyType={d.companyType}
            intentScore={d.intentScore}
            trend={d.trend}
            trendDelta={d.trendDelta}
            patentCliffs={d.patentCliffs}
            lastDealDate={d.lastDealDate}
            timing={d.timing}
            signals={d.signals}
            licensingWindow={d.licensingWindow}
            compact
          />
        ))}
      </div>

      {!hasProAccess && (
        <button
          onClick={onUpgrade}
          className="mt-4 w-full text-center text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 py-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-500 transition-colors"
        >
          Upgrade to see all companies + licensing windows
        </button>
      )}
    </div>
  );
}
