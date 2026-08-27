'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

export function MomentumSection() {
  const [signals, setSignals] = useState<MomentumSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/signals?section=momentum')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.momentum) setSignals(data.momentum);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || signals.length === 0) return null;

  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Market Momentum
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {signals.map((s, i) => {
            const Icon = s.direction === 'up' ? TrendingUp : s.direction === 'down' ? TrendingDown : Minus;
            const colorClass = s.direction === 'up' ? 'text-emerald-400' : s.direction === 'down' ? 'text-red-400' : 'text-slate-500';
            const borderClass = s.direction === 'up' ? 'border-emerald-500/20' : s.direction === 'down' ? 'border-red-500/20' : 'border-slate-700';

            return (
              <div key={i} className={`rounded-xl border bg-slate-900/40 p-4 ${borderClass}`}>
                <p className="text-xs font-medium text-slate-500 mb-1 truncate">{s.label}</p>
                <p className="text-lg font-bold text-white font-mono">{formatValue(s.currentValue, s.metric)}</p>
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(0)}% QoQ</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
