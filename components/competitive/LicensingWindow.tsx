'use client';

import { Shield, AlertTriangle, Clock, Lock } from 'lucide-react';

interface LicensingWindowProps {
  status: 'active' | 'closing' | 'closed' | 'no_window';
  urgency: 'high' | 'medium' | 'low';
  estimatedMonthsRemaining: number | null;
  patentCliffYear: number | null;
  biosimilarYear: number | null;
  signals: string[];
  hasProAccess?: boolean;
  onUpgrade?: () => void;
}

export default function LicensingWindow({
  status, urgency, estimatedMonthsRemaining, patentCliffYear, biosimilarYear, signals, hasProAccess = true, onUpgrade,
}: LicensingWindowProps) {
  if (!hasProAccess) {
    return (
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 overflow-hidden">
        <div className="blur-sm pointer-events-none select-none">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Licensing Window Analysis</h3>
              <p className="text-sm text-slate-500">Forward-looking partnership intelligence</p>
            </div>
          </div>
          <div className="h-20 bg-slate-50 dark:bg-slate-700/50 rounded-lg" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-800/60">
          <div className="text-center">
            <Lock className="w-5 h-5 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Licensing window analysis is a Pro feature</p>
            {onUpgrade && (
              <button
                onClick={onUpgrade}
                className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700"
              >
                Upgrade to Pro →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = {
    active: { icon: Shield, color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/30', label: 'Active Licensing Window', pillBg: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
    closing: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Window Closing', pillBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    closed: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', label: 'Window Closed', pillBg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
    no_window: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', label: 'No Active Window', pillBg: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const urgencySegments = [
    { level: 'high', color: urgency === 'high' ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700' },
    { level: 'medium', color: urgency === 'medium' || urgency === 'high' ? (urgency === 'high' ? 'bg-teal-400' : 'bg-amber-500') : 'bg-slate-200 dark:bg-slate-700' },
    { level: 'low', color: 'bg-slate-200 dark:bg-slate-700' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${config.bg} border flex items-center justify-center`}>
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Licensing Window</h3>
            <span className={`inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${config.pillBg}`}>
              {config.label}
            </span>
          </div>
        </div>
        {estimatedMonthsRemaining !== null && estimatedMonthsRemaining > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{estimatedMonthsRemaining}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">months</div>
          </div>
        )}
      </div>

      {(patentCliffYear || biosimilarYear) && (
        <div className="mb-4">
          <div className="relative h-8 flex items-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200 dark:bg-slate-700" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-teal-500 border-2 border-white dark:border-slate-800 z-10" />
            {patentCliffYear && (
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10"
                style={{ left: `${Math.min(85, Math.max(15, ((patentCliffYear - currentYear) / 10) * 100))}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-slate-800" />
              </div>
            )}
            {biosimilarYear && (
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10"
                style={{ left: `${Math.min(95, Math.max(25, ((biosimilarYear - currentYear) / 10) * 100))}%` }}
              >
                <div className="w-3 h-3 rounded-full bg-slate-400 border-2 border-white dark:border-slate-800" />
              </div>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>Now ({currentYear})</span>
            {patentCliffYear && <span className="text-amber-500">LOE ({patentCliffYear})</span>}
            {biosimilarYear && <span>Biosimilar ({biosimilarYear})</span>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">Urgency</span>
        {urgencySegments.map((s) => (
          <div key={s.level} className={`h-1.5 flex-1 rounded-full ${s.color}`} />
        ))}
      </div>

      {signals.length > 0 && (
        <ul className="space-y-1.5">
          {signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${config.color.replace('text-', 'bg-')}`} />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
