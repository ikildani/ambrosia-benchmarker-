'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, RotateCcw, Lock } from 'lucide-react';
import NumberInputWithDefault from './NumberInputWithDefault';
import PerPhaseTransitionTable from './PerPhaseTransitionTable';
import CustomAssumptionsBadge from './CustomAssumptionsBadge';
import type { CustomAssumptions } from '@/lib/financial/types';
import type { ResolvedDefaults } from '@/lib/financial/default-assumptions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  nda_filed: 'NDA Filing',
};

function cleanAssumptions(a: CustomAssumptions): CustomAssumptions | null {
  const hasAny = Object.values(a).some(
    (v) => v != null && (typeof v !== 'object' || Object.keys(v).length > 0),
  );
  return hasAny ? a : null;
}

function countOverrides(assumptions: CustomAssumptions | null): number {
  if (!assumptions) return 0;
  let count = 0;
  if (assumptions.discountRate != null) count++;
  if (assumptions.phaseTransitionRates) count += Object.keys(assumptions.phaseTransitionRates).length;
  if (assumptions.phaseCosts) count += Object.keys(assumptions.phaseCosts).length;
  if (assumptions.revenueCurve) count += Object.keys(assumptions.revenueCurve).length;
  if (assumptions.cogsPercent != null) count++;
  if (assumptions.peakSalesOverride) count++;
  return count;
}

function countSectionOverrides(
  assumptions: CustomAssumptions | null,
  section: 'discount' | 'pos' | 'costs' | 'revenue' | 'cogs' | 'peakSales',
): number {
  if (!assumptions) return 0;
  switch (section) {
    case 'discount':
      return assumptions.discountRate != null ? 1 : 0;
    case 'pos':
      return assumptions.phaseTransitionRates
        ? Object.keys(assumptions.phaseTransitionRates).length
        : 0;
    case 'costs':
      return assumptions.phaseCosts
        ? Object.keys(assumptions.phaseCosts).length
        : 0;
    case 'revenue':
      return assumptions.revenueCurve
        ? Object.keys(assumptions.revenueCurve).length
        : 0;
    case 'cogs':
      return assumptions.cogsPercent != null ? 1 : 0;
    case 'peakSales':
      return assumptions.peakSalesOverride ? 1 : 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
  title: string;
  overrideCount: number;
  children: React.ReactNode;
}

function CollapsibleSection({ title, overrideCount, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 px-1 text-left group"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300">
          {title}
          <CustomAssumptionsBadge count={overrideCount} />
        </span>
        <ChevronDown
          size={16}
          className={`text-neutral-400 dark:text-slate-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-1 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CustomAssumptionsPanelProps {
  assumptions: CustomAssumptions | null;
  defaults: ResolvedDefaults;
  onChange: (assumptions: CustomAssumptions | null) => void;
  tier: 'free' | 'pro' | 'report';
  onUpgradeClick?: () => void;
}

function CustomAssumptionsPanelInner({
  assumptions,
  defaults,
  onChange,
  tier,
  onUpgradeClick,
}: CustomAssumptionsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const overrideCount = useMemo(() => countOverrides(assumptions), [assumptions]);
  const isGated = tier === 'free';

  // Merge a partial change into the current assumptions, clean, and propagate
  const update = useCallback(
    (patch: Partial<CustomAssumptions>) => {
      const merged: CustomAssumptions = { ...assumptions, ...patch };
      onChange(cleanAssumptions(merged));
    },
    [assumptions, onChange],
  );

  const handleResetAll = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // ----- Section-level change handlers -----

  const handleDiscountRateChange = useCallback(
    (v: number | undefined) => {
      // Display is in %, storage is decimal
      update({ discountRate: v != null ? v / 100 : undefined });
    },
    [update],
  );

  const handleTransitionChange = useCallback(
    (overrides: Partial<Record<string, number>> | undefined) => {
      update({ phaseTransitionRates: overrides });
    },
    [update],
  );

  const handlePhaseCostChange = useCallback(
    (phase: string, v: number | undefined) => {
      const next = { ...assumptions?.phaseCosts };
      if (v != null) {
        next[phase] = v;
      } else {
        delete next[phase];
      }
      update({ phaseCosts: Object.keys(next).length > 0 ? next : undefined });
    },
    [assumptions?.phaseCosts, update],
  );

  const handleRevenueCurveChange = useCallback(
    (key: string, v: number | undefined, isPercent = false) => {
      const next = { ...assumptions?.revenueCurve };
      if (v != null) {
        (next as Record<string, number>)[key] = isPercent ? v / 100 : v;
      } else {
        delete (next as Record<string, number | undefined>)[key];
      }
      const hasKeys = Object.keys(next).length > 0;
      update({
        revenueCurve: hasKeys
          ? (next as CustomAssumptions['revenueCurve'])
          : undefined,
      });
    },
    [assumptions?.revenueCurve, update],
  );

  const handleCogsChange = useCallback(
    (v: number | undefined) => {
      update({ cogsPercent: v != null ? v / 100 : undefined });
    },
    [update],
  );

  const handlePeakSalesChange = useCallback(
    (key: 'low' | 'median' | 'high', v: number | undefined) => {
      const current = assumptions?.peakSalesOverride ?? {
        low: 0,
        median: 0,
        high: 0,
      };
      if (v != null) {
        const next = { ...current, [key]: v };
        update({ peakSalesOverride: next });
      } else {
        // If clearing one field, check if others remain
        const next = { ...current, [key]: 0 };
        const allZero = next.low === 0 && next.median === 0 && next.high === 0;
        update({ peakSalesOverride: allZero ? undefined : next });
      }
    },
    [assumptions?.peakSalesOverride, update],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="border-t border-neutral-200 dark:border-neutral-800">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full py-4 px-4 bg-neutral-50/50 dark:bg-neutral-900/30
                   hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            size={18}
            className={`text-neutral-500 dark:text-slate-400 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
          <span className="text-sm font-semibold text-neutral-800 dark:text-slate-200">
            Custom Model Assumptions
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400">
            PRO
          </span>
          <CustomAssumptionsBadge count={overrideCount} />
        </div>

        {/* Reset All — only when expanded with overrides */}
        {expanded && overrideCount > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleResetAll();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                handleResetAll();
              }
            }}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 dark:text-slate-400
                       hover:text-teal-600 dark:hover:text-teal-400 transition-colors duration-150"
          >
            <RotateCcw size={12} />
            Reset
          </span>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel-content"
            initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="relative px-4 pb-4">
              {/* Pro gate overlay */}
              {isGated && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-sm bg-white/60 dark:bg-neutral-900/60 rounded-b-lg">
                  <Lock size={24} className="text-neutral-400 dark:text-slate-500 mb-2" />
                  <p className="text-sm text-neutral-600 dark:text-slate-400 mb-3 text-center max-w-xs">
                    Upgrade to Pro to customize model assumptions
                  </p>
                  {onUpgradeClick && (
                    <button
                      type="button"
                      onClick={onUpgradeClick}
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold
                                 transition-colors duration-150 shadow-sm"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              )}

              {/* Sections */}
              <div className={isGated ? 'pointer-events-none select-none' : ''}>
                {/* 1. Discount Rate */}
                <CollapsibleSection
                  title="Discount Rate"
                  overrideCount={countSectionOverrides(assumptions, 'discount')}
                >
                  <NumberInputWithDefault
                    label="Weighted Average Cost of Capital (WACC)"
                    defaultValue={Math.round(defaults.discountRate * 100 * 10) / 10}
                    value={
                      assumptions?.discountRate != null
                        ? Math.round(assumptions.discountRate * 100 * 10) / 10
                        : undefined
                    }
                    onChange={handleDiscountRateChange}
                    suffix="%"
                    min={1}
                    max={30}
                    step={0.5}
                    disabled={isGated}
                  />
                </CollapsibleSection>

                {/* 2. Probability of Success */}
                <CollapsibleSection
                  title="Probability of Success"
                  overrideCount={countSectionOverrides(assumptions, 'pos')}
                >
                  <PerPhaseTransitionTable
                    transitions={defaults.phaseTransitionRates}
                    overrides={assumptions?.phaseTransitionRates}
                    onChange={handleTransitionChange}
                    disabled={isGated}
                  />
                </CollapsibleSection>

                {/* 3. Development Costs */}
                <CollapsibleSection
                  title="Development Costs"
                  overrideCount={countSectionOverrides(assumptions, 'costs')}
                >
                  {defaults.phaseCosts.map((pc) => (
                    <NumberInputWithDefault
                      key={pc.phase}
                      label={PHASE_LABELS[pc.phase] ?? pc.phase}
                      defaultValue={pc.costM}
                      value={assumptions?.phaseCosts?.[pc.phase]}
                      onChange={(v) => handlePhaseCostChange(pc.phase, v)}
                      suffix="$M"
                      min={0}
                      max={5000}
                      step={5}
                      disabled={isGated}
                    />
                  ))}
                </CollapsibleSection>

                {/* 4. Revenue Curve */}
                <CollapsibleSection
                  title="Revenue Curve"
                  overrideCount={countSectionOverrides(assumptions, 'revenue')}
                >
                  <NumberInputWithDefault
                    label="Ramp-Up Period"
                    defaultValue={defaults.revenueCurve.rampUpYears}
                    value={assumptions?.revenueCurve?.rampUpYears}
                    onChange={(v) => handleRevenueCurveChange('rampUpYears', v)}
                    suffix="yrs"
                    min={1}
                    max={10}
                    step={0.5}
                    disabled={isGated}
                  />
                  <NumberInputWithDefault
                    label="Peak Duration"
                    defaultValue={defaults.revenueCurve.peakDurationYears}
                    value={assumptions?.revenueCurve?.peakDurationYears}
                    onChange={(v) => handleRevenueCurveChange('peakDurationYears', v)}
                    suffix="yrs"
                    min={1}
                    max={15}
                    step={0.5}
                    disabled={isGated}
                  />
                  <NumberInputWithDefault
                    label="Annual Decline Rate"
                    defaultValue={Math.round(defaults.revenueCurve.declineRate * 100)}
                    value={
                      assumptions?.revenueCurve?.declineRate != null
                        ? Math.round(assumptions.revenueCurve.declineRate * 100)
                        : undefined
                    }
                    onChange={(v) => handleRevenueCurveChange('declineRate', v, true)}
                    suffix="%"
                    min={1}
                    max={50}
                    step={1}
                    disabled={isGated}
                  />
                  <NumberInputWithDefault
                    label="Years to LOE"
                    defaultValue={defaults.revenueCurve.loeYearsAfterApproval}
                    value={assumptions?.revenueCurve?.loeYearsAfterApproval}
                    onChange={(v) => handleRevenueCurveChange('loeYearsAfterApproval', v)}
                    suffix="yrs"
                    min={5}
                    max={25}
                    step={1}
                    disabled={isGated}
                  />
                </CollapsibleSection>

                {/* 5. Cost of Goods Sold */}
                <CollapsibleSection
                  title="Cost of Goods Sold"
                  overrideCount={countSectionOverrides(assumptions, 'cogs')}
                >
                  <NumberInputWithDefault
                    label="COGS (% of Revenue)"
                    defaultValue={Math.round(defaults.cogsPercent * 100)}
                    value={
                      assumptions?.cogsPercent != null
                        ? Math.round(assumptions.cogsPercent * 100)
                        : undefined
                    }
                    onChange={handleCogsChange}
                    suffix="%"
                    min={1}
                    max={80}
                    step={1}
                    disabled={isGated}
                  />
                </CollapsibleSection>

                {/* 6. Peak Sales */}
                <CollapsibleSection
                  title="Peak Sales"
                  overrideCount={countSectionOverrides(assumptions, 'peakSales')}
                >
                  <NumberInputWithDefault
                    label="Low"
                    defaultValue={0}
                    value={assumptions?.peakSalesOverride?.low || undefined}
                    onChange={(v) => handlePeakSalesChange('low', v)}
                    suffix="$M"
                    min={0}
                    max={100000}
                    step={50}
                    disabled={isGated}
                  />
                  <NumberInputWithDefault
                    label="Median"
                    defaultValue={0}
                    value={assumptions?.peakSalesOverride?.median || undefined}
                    onChange={(v) => handlePeakSalesChange('median', v)}
                    suffix="$M"
                    min={0}
                    max={100000}
                    step={50}
                    disabled={isGated}
                  />
                  <NumberInputWithDefault
                    label="High"
                    defaultValue={0}
                    value={assumptions?.peakSalesOverride?.high || undefined}
                    onChange={(v) => handlePeakSalesChange('high', v)}
                    suffix="$M"
                    min={0}
                    max={100000}
                    step={50}
                    disabled={isGated}
                  />
                </CollapsibleSection>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CustomAssumptionsPanel = React.memo(CustomAssumptionsPanelInner);
export default CustomAssumptionsPanel;
