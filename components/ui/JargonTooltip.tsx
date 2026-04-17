'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';

// ── Jargon dictionary ───────────────────────────────────────────────────────

export const JARGON: Record<string, string> = {
  'rNPV': 'Risk-adjusted Net Present Value. Discounts future cash flows by both the time value of money AND the probability of clinical/regulatory failure at each phase.',
  'PoS': 'Probability of Success. The cumulative chance this drug reaches market approval, based on historical phase transition rates.',
  'TDV': 'Total Deal Value. The sum of upfront payment, milestones, and royalties over the deal lifetime.',
  'Total Deal Value': 'The sum of upfront payment, milestones, and royalties over the deal lifetime. Represents maximum potential value if all triggers are met.',
  'Monte Carlo': '10,000 randomized simulations varying peak sales, timing, and success probability to produce a probability distribution of outcomes.',
  'p25/p50/p75': 'Percentiles of the deal-value distribution. p50 is the median; 50% of comparable deals fall above and below this value.',
  'p25': '25th percentile. 75% of comparable deals exceed this value. Represents a conservative estimate.',
  'p50': '50th percentile (median). Half of comparable deals fall above and below this value.',
  'p75': '75th percentile. Only 25% of comparable deals exceed this value. Represents an optimistic estimate.',
  'Upfront': 'Cash paid at deal signing, before any milestones are earned. The most certain component of deal value.',
  'Upfront Payment': 'Cash paid at deal signing, before any milestones are earned. Typically 20-40% of total deal value for Phase 2+ assets.',
  'Development Milestones': 'Payments triggered by clinical development progress: IND filing, Phase 1/2/3 initiation, and data readouts.',
  'Regulatory Milestones': 'Payments upon regulatory events: FDA/EMA submission, approval, and additional market authorizations.',
  'Commercial Milestones': 'Sales-based milestone payments triggered when cumulative net sales reach defined thresholds ($500M, $1B, etc.).',
  'Tiered Royalties': 'Ongoing percentage of net sales paid to the licensor. Rates increase at higher sales thresholds, typically ranging from single-digit to low-twenties percent.',
  'Tornado': 'Sensitivity chart showing which input variables have the largest impact on deal value when varied one at a time.',
  'Sensitivity': 'Analysis of how deal value changes when individual inputs are varied, revealing which assumptions matter most.',
  'Comparable Deals': 'Recent transactions with similar therapeutic area, phase, and modality used as valuation benchmarks.',
};

// ── Component ───────────────────────────────────────────────────────────────

interface JargonTooltipProps {
  term: string;
  children: React.ReactNode;
  className?: string;
}

export default function JargonTooltip({ term, children, className }: JargonTooltipProps) {
  const definition = JARGON[term];
  const [isVisible, setIsVisible] = useState(false);
  const [isTapped, setIsTapped] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  }, []);

  const hideTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 150);
  }, []);

  const handleTap = useCallback(() => {
    setIsTapped(prev => !prev);
    setIsVisible(prev => !prev);
  }, []);

  // Close on outside click (mobile)
  useEffect(() => {
    if (!isTapped) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsTapped(false);
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isTapped]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  if (!definition) {
    return <>{children}</>;
  }

  return (
    <span
      ref={tooltipRef}
      className={`relative inline-flex items-center cursor-help ${className || ''}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onClick={handleTap}
    >
      <span className="border-b border-dotted border-slate-500 dark:border-slate-400">
        {children}
      </span>
      {isVisible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          role="tooltip"
        >
          <span className="block bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg p-3 shadow-xl max-w-xs leading-relaxed whitespace-normal text-left">
            <span className="font-semibold text-teal-300">{term}</span>
            <br />
            {definition}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}
