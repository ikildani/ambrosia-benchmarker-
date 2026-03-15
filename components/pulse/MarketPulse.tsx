'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { captureClientError } from '@/lib/sentry-client';
import WeeklyHighlights from './WeeklyHighlights';
import DealActivityFeed from './DealActivityFeed';
import ModalityHeatMap from './ModalityHeatMap';
import TherapeuticAreaBreakdown from './TherapeuticAreaBreakdown';

const BenchmarkSparklines = dynamic(() => import('./BenchmarkSparklines'), { ssr: false });

interface MarketPulseProps {
  isPro: boolean;
  userId?: string;
  week?: string;
  onUpgrade: () => void;
}

export default function MarketPulse({ isPro, userId, week, onUpgrade }: MarketPulseProps) {
  const [snapshot, setSnapshot] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [historySnapshots, setHistorySnapshots] = useState<any[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPulseData() {
      try {
        setLoading(true);
        const baseParams = new URLSearchParams();
        if (userId) baseParams.set('user_id', userId);
        if (week) baseParams.set('week', week);
        const params = baseParams.toString() ? `?${baseParams.toString()}` : '';
        const historyBaseParams = new URLSearchParams(baseParams);
        historyBaseParams.set('history', 'true');
        const historyParams = `?${historyBaseParams.toString()}`;

        const [pulseRes, historyRes] = await Promise.all([
          fetch(`/api/pulse${params}`),
          fetch(`/api/pulse${historyParams}`),
        ]);

        if (!pulseRes.ok) {
          if (pulseRes.status === 404) {
            setError('No market data available yet. Check back after Monday.');
            return;
          }
          throw new Error('Failed to fetch pulse data');
        }

        const pulseData = await pulseRes.json();
        setSnapshot(pulseData.snapshot);
        setDeals(pulseData.deals || []);
        setTotalDeals(pulseData.total_deals || 0);

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistorySnapshots(historyData.snapshots || []);
        }
      } catch (err) {
        captureClientError(err, 'MarketPulse', { context: 'Pulse fetch error' });
        setError('Failed to load market data');
      } finally {
        setLoading(false);
      }
    }

    fetchPulseData();
  }, [userId, week]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading market intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-slate-600 dark:text-slate-400">{error}</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-500/20 dark:to-cyan-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Your First Pulse is Coming</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          Market intelligence snapshots are generated every Monday at 7 AM ET.
          Check back after the next update for deal activity, benchmark shifts, and modality trends.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Snapshots refresh weekly
        </div>
      </div>
    );
  }

  const snapshotDate = snapshot.snapshot_date
    ? new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8">
      {/* Last Updated + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {snapshotDate && (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Week of {snapshotDate}</span>
            </>
          )}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Upgrade Banner for Free Users */}
      {!isPro && (
        <div className="relative overflow-hidden bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 sm:p-8 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)]" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Unlock Full Market Intelligence</h3>
              <p className="text-slate-300 text-sm">Get complete deal financials, benchmark data, and weekly email digests with Pro.</p>
            </div>
            <button
              onClick={onUpgrade}
              className="shrink-0 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {/* Weekly Highlights — 4 stat cards */}
      <WeeklyHighlights snapshot={snapshot} isPro={isPro} />

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Deal Activity Feed — takes 2 cols */}
        <div className="lg:col-span-2">
          <DealActivityFeed deals={deals} totalDeals={totalDeals} isPro={isPro} onUpgrade={onUpgrade} />
        </div>

        {/* Right sidebar: Modality + TA breakdown */}
        <div className="space-y-8">
          <ModalityHeatMap snapshot={snapshot} isPro={isPro} />
          <TherapeuticAreaBreakdown snapshot={snapshot} isPro={isPro} />
        </div>
      </div>

      {/* Benchmark Sparklines — full width */}
      <BenchmarkSparklines snapshots={historySnapshots} isPro={isPro} />

      {/* Data Freshness */}
      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Data last updated March 2026 &middot; 350+ curated deals across 12 therapeutic areas &middot; Refreshed weekly
      </p>
    </div>
  );
}
