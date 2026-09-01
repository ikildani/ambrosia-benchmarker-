'use client';

import { TrendingUp, TrendingDown, Minus, Clock, Shield, AlertTriangle } from 'lucide-react';

interface PatentCliff {
  drug: string;
  loeYear: number;
  revenueAtRisk?: number;
}

interface LicensingWindow {
  status: 'active' | 'closing' | 'closed' | 'no_window';
  urgency: 'high' | 'medium' | 'low';
  estimatedMonthsRemaining: number | null;
  signals: string[];
}

interface CompanyIntentCardProps {
  companyName: string;
  companyType?: string;
  intentScore: number;
  intentTier?: string;
  trend: 'rising' | 'stable' | 'declining';
  trendDelta?: number;
  patentCliffs: PatentCliff[];
  lastDealDate: string | null;
  timing?: string;
  signals: string[];
  licensingWindow?: LicensingWindow;
  compact?: boolean;
  dark?: boolean;
}

function IntentGauge({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 60 ? '#0EA5A5' : score >= 40 ? '#E6A800' : '#64748B';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth={3}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export function CompanyIntentCard({
  companyName, companyType, intentScore, trend, trendDelta,
  patentCliffs, lastDealDate, timing, signals, licensingWindow, compact, dark,
}: CompanyIntentCardProps) {
  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'rising' ? 'text-emerald-500' : trend === 'declining' ? 'text-red-400' : 'text-slate-400';

  const nearestCliff = (patentCliffs || []).sort((a, b) => a.loeYear - b.loeYear)[0];
  const currentYear = new Date().getFullYear();
  const cliffMonths = nearestCliff ? (nearestCliff.loeYear - currentYear) * 12 : null;

  const windowColor = licensingWindow?.status === 'active'
    ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
    : licensingWindow?.status === 'closing'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : 'bg-slate-500/15 text-slate-400 border-slate-500/30';

  const windowLabel = licensingWindow?.status === 'active'
    ? 'Active Window'
    : licensingWindow?.status === 'closing'
      ? 'Window Closing'
      : 'No Window';

  const cardBg = dark
    ? 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700/80'
    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';

  if (compact) {
    return (
      <div className={`rounded-xl border p-4 transition-colors ${cardBg}`}>
        <div className="flex items-center gap-3">
          <IntentGauge score={intentScore} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{companyName}</h4>
              <TrendIcon className={`w-3.5 h-3.5 flex-shrink-0 ${trendColor}`} />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {licensingWindow && licensingWindow.status !== 'no_window' && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${windowColor}`}>
                  {windowLabel}
                </span>
              )}
              {nearestCliff && cliffMonths !== null && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  LOE {cliffMonths <= 24 ? `${cliffMonths}mo` : `${nearestCliff.loeYear}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${cardBg}`}>
      <div className="flex items-start gap-4">
        <IntentGauge score={intentScore} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-semibold ${dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{companyName}</h4>
            {companyType && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {companyType.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trend}{trendDelta ? ` (${trendDelta > 0 ? '+' : ''}${trendDelta})` : ''}</span>
            </div>
            {timing && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                timing === 'imminent' ? 'bg-red-500/15 text-red-400' :
                timing === 'near_term' ? 'bg-amber-500/15 text-amber-400' :
                'bg-slate-500/15 text-slate-400'
              }`}>
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {timing.replace(/_/g, ' ')}
              </span>
            )}
            {licensingWindow && licensingWindow.status !== 'no_window' && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${windowColor}`}>
                {licensingWindow.status === 'active' ? <Shield className="w-2.5 h-2.5 inline mr-0.5" /> : <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                {windowLabel}
                {licensingWindow.estimatedMonthsRemaining !== null && ` · ${licensingWindow.estimatedMonthsRemaining}mo`}
              </span>
            )}
          </div>
        </div>
      </div>

      {nearestCliff && (
        <div className={`mt-3 flex items-center gap-2 text-xs ${dark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          <span className={`font-medium ${cliffMonths !== null && cliffMonths <= 24 ? 'text-amber-400' : ''}`}>
            LOE: {nearestCliff.drug} ({nearestCliff.loeYear})
          </span>
          {lastDealDate && (
            <>
              <span className="text-slate-600">·</span>
              <span>Last deal: {new Date(lastDealDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </>
          )}
        </div>
      )}

      {signals.length > 0 && (
        <ul className={`mt-3 space-y-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {signals.slice(0, 3).map((s, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1 w-1 h-1 rounded-full bg-teal-500 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
