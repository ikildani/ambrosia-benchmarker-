'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TrendsFilterBar from './trends/TrendsFilterBar';
import DealVolumeChart from './trends/DealVolumeChart';
import MedianUpfrontChart from './trends/MedianUpfrontChart';
import RoyaltyTrendChart from './trends/RoyaltyTrendChart';
import DealTypeMixChart from './trends/DealTypeMixChart';
import ModalityMixChart from './trends/ModalityMixChart';
import PhaseDistributionChart from './trends/PhaseDistributionChart';

interface TrendQuarter {
  quarter: string;
  year: number;
  dealCount: number;
  medianUpfront: number | null;
  medianTotal: number | null;
  avgRoyaltyLow: number | null;
  avgRoyaltyHigh: number | null;
  byTA: Record<string, number>;
  byModality: Record<string, number>;
  byPhase: Record<string, number>;
  byDealType: Record<string, number>;
}

function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
      <div className="h-3 w-64 bg-slate-100 dark:bg-slate-700/50 rounded mb-6" />
      <div className="h-[300px] bg-slate-100 dark:bg-slate-700/30 rounded-lg" />
    </div>
  );
}

function ProGate({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm z-10 rounded-2xl flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Pro Feature</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Upgrade to unlock deal trend analytics</p>
          {onUpgrade && (
            <button onClick={onUpgrade} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 transition-all">
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TrendsTabProps {
  onUpgrade?: () => void;
}

export default function TrendsTab({ onUpgrade }: TrendsTabProps) {
  const { tier } = useAuth();
  const isPro = tier === 'pro' || tier === 'portfolio';

  const [selectedTA, setSelectedTA] = useState('all');
  const [fromYear, setFromYear] = useState(2019);
  const [toYear, setToYear] = useState(2026);
  const [data, setData] = useState<TrendQuarter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTA !== 'all') params.set('ta', selectedTA);
      params.set('from', String(fromYear));
      params.set('to', String(toYear));
      const res = await fetch(`/api/trends?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.quarters || []);
      }
    } catch {
      // silent — trends are non-critical
    } finally {
      setLoading(false);
    }
  }, [selectedTA, fromYear, toYear]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const volumeData = data.map(q => ({
    label: `Q${q.quarter} ${q.year}`,
    total: q.dealCount,
    ...q.byTA,
  }));

  const upfrontData = data.map(q => {
    const row: Record<string, string | number | null> & { label: string } = { label: `Q${q.quarter} ${q.year}` };
    if (selectedTA === 'all') {
      row.medianUpfront = q.medianUpfront;
      for (const [ta, count] of Object.entries(q.byTA)) {
        if (count >= 2) row[ta] = q.medianUpfront;
      }
    } else {
      row[selectedTA] = q.medianUpfront;
    }
    return row;
  });

  const royaltyData = data.map(q => ({
    label: `Q${q.quarter} ${q.year}`,
    royaltyLow: q.avgRoyaltyLow ?? 0,
    royaltyHigh: q.avgRoyaltyHigh ?? 0,
  }));

  const dealTypeData = data.map(q => ({
    label: `Q${q.quarter} ${q.year}`,
    ...q.byDealType,
  }));

  const topModalities = (() => {
    const counts: Record<string, number> = {};
    data.forEach(q => {
      for (const [mod, c] of Object.entries(q.byModality || {})) {
        counts[mod] = (counts[mod] || 0) + c;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
  })();

  const modalityData = data.map(q => ({
    label: `Q${q.quarter} ${q.year}`,
    ...q.byModality,
  }));

  const phaseData = data.map(q => ({
    label: `Q${q.quarter} ${q.year}`,
    ...q.byPhase,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <TrendsFilterBar selectedTA={selectedTA} fromYear={fromYear} toYear={toYear} onTAChange={setSelectedTA} onFromChange={setFromYear} onToChange={setToYear} />
        <ChartSkeleton />
        <div className="grid gap-6 md:grid-cols-2"><ChartSkeleton /><ChartSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrendsFilterBar selectedTA={selectedTA} fromYear={fromYear} toYear={toYear} onTAChange={setSelectedTA} onFromChange={setFromYear} onToChange={setToYear} />

      <DealVolumeChart data={volumeData} selectedTA={selectedTA} />

      {isPro ? (
        <div className="grid gap-6 md:grid-cols-2">
          <MedianUpfrontChart data={upfrontData} selectedTA={selectedTA} />
          <RoyaltyTrendChart data={royaltyData} />
          <DealTypeMixChart data={dealTypeData} />
          <ModalityMixChart data={modalityData} topModalities={topModalities} />
          <PhaseDistributionChart data={phaseData} />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative"><ProGate onUpgrade={onUpgrade} /><MedianUpfrontChart data={[]} selectedTA={selectedTA} /></div>
          <div className="relative"><ProGate onUpgrade={onUpgrade} /><RoyaltyTrendChart data={[]} /></div>
        </div>
      )}
    </div>
  );
}
