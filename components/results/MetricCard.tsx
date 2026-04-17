import React, { useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DrillDownData, formatCurrency } from '@/lib/calculations';
import DrillDownPanel from './DrillDownPanel';
import InfoTooltip from '@/components/calculator/InfoTooltip';
import AnimatedValue from './AnimatedValue';

interface PercentileContext {
  percentile: number; // 0-100, where the user's value falls
  label: string; // e.g., "below market", "at market", "above market"
}

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
  contextLine?: string;
  previousValue?: number;
  currentValue?: number;
  warningText?: string;
  percentileContext?: PercentileContext;
  confidenceLevel?: 'high' | 'medium' | 'low';
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

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 24,
      delay: i * 0.05,
    },
  }),
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
  tooltipContent,
  contextLine,
  previousValue,
  currentValue,
  warningText,
  percentileContext,
  confidenceLevel
}: MetricCardProps) {
  const prefersReducedMotion = useReducedMotion();

  // Allow expanding for preview even when canExpand is false, as long as there's drill-down data
  const handleHeaderClick = useCallback(() => {
    if (canExpand || drillDown) {
      onToggle();
    } else if (!isPro) {
      onProClick();
    }
  }, [canExpand, isPro, onToggle, onProClick, drillDown]);

  const handleHeaderKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHeaderClick();
    }
  }, [handleHeaderClick]);

  const idx = animationIndex ?? 0;

  return (
    <motion.div
      custom={idx}
      variants={prefersReducedMotion ? undefined : cardVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="visible"
      whileHover={prefersReducedMotion ? undefined : { y: -2, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
      className={`group metric-card p-5 sm:p-6 xl:p-7 rounded-xl bg-white dark:bg-slate-800/80 border border-neutral-100 dark:border-slate-700/60 hover:border-teal-200/60 dark:hover:border-teal-500/30 hover:shadow-lg dark:hover:shadow-teal-500/5 transition-all duration-300 ${isExpanded ? 'ring-1 ring-teal-300/50 dark:ring-teal-500/30' : ''}`}
    >
      <div
        className={`${(canExpand || drillDown) ? 'cursor-pointer' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={(canExpand || drillDown) ? isExpanded : undefined}
        aria-label={`${title}: ${value}. ${canExpand ? (isExpanded ? 'Collapse details' : 'Expand details') : ''}`}
        onClick={handleHeaderClick}
        onKeyDown={handleHeaderKeyDown}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 xl:w-12 xl:h-12 rounded-xl flex-shrink-0 ${iconBgClasses[badgeColor] || iconBgClasses.teal} flex items-center justify-center shadow-sm`}>
              <div className={iconTextClasses[badgeColor] || iconTextClasses.teal}>
                {icon}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm xl:text-[15px] font-semibold text-neutral-800 dark:text-slate-100 leading-tight">
                  {title}
                  {tooltipContent && <InfoTooltip content={tooltipContent} />}
                </p>
                {confidenceLevel && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                    confidenceLevel === 'high'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : confidenceLevel === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}>
                    {confidenceLevel === 'high' ? 'High confidence' : confidenceLevel === 'medium' ? 'Moderate confidence' : 'Estimate range'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap uppercase tracking-wider ${badgeColorClasses[badgeColor] || badgeColorClasses.teal}`}>
              {badge}
            </span>
            {(canExpand || drillDown) && (
              <motion.svg
                className="w-4 h-4 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            )}
            {!canExpand && !drillDown && !isPro && (
              <div className="p-1 bg-neutral-100 dark:bg-slate-600 rounded">
                <svg className="w-3 h-3 text-neutral-500 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Value */}
        <p className="text-2xl sm:text-[28px] xl:text-[32px] font-bold text-neutral-900 dark:text-white mb-3 number-animate tracking-tight">
          {value}
        </p>

        {/* Expected + change indicator */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] text-neutral-500 dark:text-slate-400">
            Expected: <span className={`font-bold ${expectedColor}`}>
              {currentValue !== undefined ? (
                <AnimatedValue value={currentValue} duration={900 + idx * 100} />
              ) : (
                expected
              )}
            </span>
            {previousValue !== undefined && currentValue !== undefined && previousValue !== currentValue && (
              <span
                className={`ml-2 inline-flex items-center text-xs font-semibold motion-safe:animate-fade-in ${
                  currentValue > previousValue
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                }`}
              >
                {currentValue > previousValue ? '\u2191' : '\u2193'}{' '}
                {currentValue > previousValue ? '+' : '-'}
                {formatCurrency(Math.abs(currentValue - previousValue))}
              </span>
            )}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-neutral-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${progressColor} rounded-full`}
            initial={prefersReducedMotion ? { width: `${progressWidth}%` } : { width: '0%' }}
            animate={{ width: `${progressWidth}%` }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 100, damping: 20, delay: idx * 0.05 + 0.2 }}
          />
        </div>

        {/* Percentile context — "You vs. Market" */}
        {percentileContext && (
          <div className="mt-3">
            <div className="relative h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/30 via-teal-400/30 to-emerald-400/30 rounded-full" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-100 border-2 border-teal-500 shadow-sm"
                style={{ left: `calc(${Math.min(Math.max(percentileContext.percentile, 2), 98)}% - 5px)` }}
              />
            </div>
            <p className={`mt-1.5 text-xs ${
              percentileContext.percentile < 25
                ? 'text-amber-400'
                : percentileContext.percentile > 75
                ? 'text-emerald-400'
                : 'text-teal-400'
            }`}>
              Your estimate: p{Math.round(percentileContext.percentile)} — {percentileContext.label}
            </p>
          </div>
        )}

        {/* Context line */}
        {contextLine && (
          <p className="mt-2.5 text-[12px] text-slate-500 dark:text-slate-400">{contextLine}</p>
        )}
        {warningText && (
          <div className="mt-3 flex items-start gap-1.5 text-[12px] text-amber-600 dark:text-amber-400">
            <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{warningText}</span>
          </div>
        )}
      </div>

      {/* Drill-down panel */}
      <AnimatePresence initial={false}>
        {isExpanded && drillDown && (
          <motion.div
            key="drilldown"
            initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
            <DrillDownPanel
              data={drillDown}
              previewMode={!canExpand && !isPro}
              onUpgradeClick={onProClick}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const MetricCard = React.memo(MetricCardInner);
MetricCard.displayName = 'MetricCard';

export default MetricCard;
export type { MetricCardProps };
