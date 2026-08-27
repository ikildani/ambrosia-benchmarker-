'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MomentumSignal {
  dimension: string;
  label: string;
  metric: string;
  currentValue: number;
  priorValue: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
}

function formatValue(value: number, metric: string) {
  if (metric === 'deal_count') return `${value} deals`;
  if (metric === 'median_upfront') return value >= 1000 ? `$${(value / 1000).toFixed(1)}B` : `$${Math.round(value)}M`;
  return String(Math.round(value));
}

export default function MomentumIndicators() {
  const { tier } = useAuth();
  const isPro = tier === 'pro' || tier === 'portfolio';
  const [signals, setSignals] = useState<MomentumSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    fetch('/api/signals?section=momentum')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.momentum) setSignals(data.momentum.slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isPro]);

  if (!isPro) return null;
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (signals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-teal-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Market Momentum</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {signals.map((s, i) => {
          const Icon = s.direction === 'up' ? TrendingUp : s.direction === 'down' ? TrendingDown : Minus;
          const colorClass = s.direction === 'up' ? 'text-emerald-500' : s.direction === 'down' ? 'text-red-400' : 'text-slate-400';
          const bgClass = s.direction === 'up' ? 'bg-emerald-500/10 border-emerald-500/20' : s.direction === 'down' ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600';

          return (
            <div key={i} className={`rounded-xl border p-4 ${bgClass}`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">{s.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{formatValue(s.currentValue, s.metric)}</p>
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${colorClass}`}>
                <Icon className="w-3.5 h-3.5" />
                <span>{s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(0)}% QoQ</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
