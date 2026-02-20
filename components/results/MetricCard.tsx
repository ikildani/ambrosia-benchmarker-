import React, { useCallback } from 'react';
import { DrillDownData } from '@/lib/calculations';
import DrillDownPanel from './DrillDownPanel';
import InfoTooltip from '@/components/calculator/InfoTooltip';

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  value: string;
  expected: string;
  expectedColor: string;
  badge: string;
  badgeColor: string;
  progressWidth: number;
  progressColor: string;
  drillDown?: DrillDownData;
  isExpanded: boolean;
  onToggle: () => void;
  canExpand: boolean;
  isPro: boolean;
  onProClick: () => void;
  animationIndex?: number;
  tooltipContent?: string;
}

const badgeColorClasses: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-700',
  success: 'bg-success-100 text-success-700',
  cyan: 'bg-cyan-100 text-cyan-700'
};

const iconBgClasses: Record<string, string> = {
  teal: 'bg-gradient-to-br from-teal-500 to-cyan-500',
  success: 'bg-gradient-to-br from-success-500 to-success-400',
  cyan: 'bg-cyan-50 group-hover:bg-cyan-100'
};

const iconTextClasses: Record<string, string> = {
  teal: 'text-white',
  success: 'text-white',
  cyan: 'text-cyan-600'
};

function MetricCardInner({
  title,
  icon,
  value,
  expected,
  expectedColor,
  badge,
  badgeColor,
  progressWidth,
  progressColor,
  drillDown,
  isExpanded,
  onToggle,
  canExpand,
  isPro,
  onProClick,
  animationIndex,
  tooltipContent
}: MetricCardProps) {
  const handleHeaderClick = useCallback(() => {
    if (canExpand) {
      onToggle();
    } else if (!isPro) {
      onProClick();
    }
  }, [canExpand, isPro, onToggle, onProClick]);

  const handleHeaderKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHeaderClick();
    }
  }, [handleHeaderClick]);

  return (
    <div
      className={`group metric-card border-neutral-200 dark:border-slate-600 hover:border-teal-200 dark:hover:border-teal-500/50 transition-all duration-300 ${isExpanded ? 'ring-2 ring-teal-200 dark:ring-teal-500/50' : ''} ${typeof animationIndex === 'number' ? 'motion-safe:animate-metric-cascade' : ''}`}
      style={typeof animationIndex === 'number' ? { animationDelay: `${animationIndex * 100}ms` } : undefined}
    >
      <div
        className={`${canExpand ? 'cursor-pointer' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-label={`${title}: ${value}. ${canExpand ? (isExpanded ? 'Collapse details' : 'Expand details') : ''}`}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${iconBgClasses[badgeColor] || iconBgClasses.teal} flex items-center justify-center shadow-soft group-hover:shadow-glow transition-all duration-300`}>
              <div className={iconTextClasses[badgeColor] || iconTextClasses.teal}>
                {icon}
              </div>
            </div>
            <p className="text-sm font-semibold text-neutral-700 dark:text-slate-200">
              {title}
              {tooltipContent && <InfoTooltip content={tooltipContent} />}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeColorClasses[badgeColor] || badgeColorClasses.teal}`}>
              {badge}
            </span>
            {canExpand && (
              <svg
                className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            {!canExpand && !isPro && (
              <div className="p-1 bg-navy-100 dark:bg-slate-600 rounded">
                <svg className="w-3 h-3 text-navy-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-2 number-animate">
          {value}
        </p>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            Expected: <span className={`font-bold ${expectedColor}`}>{expected}</span>
          </p>
        </div>
        <div className="progress-bar">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Drill-down panel */}
      {isExpanded && drillDown && (
        <DrillDownPanel data={drillDown} />
      )}
    </div>
  );
}

const MetricCard = React.memo(MetricCardInner);
MetricCard.displayName = 'MetricCard';

export default MetricCard;
export type { MetricCardProps };
