'use client';

import { useState } from 'react';
import {
  DIFFERENTIATION_FACTORS,
  DIFFERENTIATION_KEYS,
  computeDifferentiationAdjustment,
  validateDifferentiationFactors,
  MAX_DIFFERENTIATION_PREMIUM,
  type DifferentiationKey,
} from '@/lib/financial/differentiation-profiles';

interface AssetDifferentiationSectionProps {
  selectedFactors: string[];
  onToggle: (key: string) => void;
  phase?: string;
}

export function AssetDifferentiationSection({
  selectedFactors,
  onToggle,
  phase,
}: AssetDifferentiationSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const validSelected = selectedFactors.filter(
    (k) => k in DIFFERENTIATION_FACTORS,
  ) as DifferentiationKey[];

  const result = computeDifferentiationAdjustment(validSelected, phase);
  const warnings = validateDifferentiationFactors(validSelected, phase);
  const hasPremium = result.totalAdjustment > 0;
  const capPct = MAX_DIFFERENTIATION_PREMIUM * 100;
  const usedPct = (result.totalAdjustment * 100).toFixed(0);

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/40">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-2.5">
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              expanded ? 'rotate-90' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-sm font-semibold text-slate-200">
            Asset Differentiation
          </span>
          {hasPremium && (
            <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-400">
              +{usedPct}%{' '}
              <span className="ml-1 text-slate-500">/ {capPct}% cap</span>
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {validSelected.length === 0
            ? 'None selected'
            : `${validSelected.length} factor${validSelected.length > 1 ? 's' : ''}`}
        </span>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t border-slate-700/30 px-5 pb-5 pt-4">
          <p className="mb-4 text-xs text-slate-500">
            Toggle factors that differentiate this asset from competitors. Each
            adds an incremental premium to the strategic position multiplier
            (capped at +{capPct}%). Premiums are phase-scaled — early-stage claims
            receive lower credit until validated by clinical data.
          </p>

          <div className="space-y-2.5">
            {DIFFERENTIATION_KEYS.map((key) => {
              const factor = DIFFERENTIATION_FACTORS[key];
              const isActive = validSelected.includes(key);
              const breakdown = result.factorBreakdown.find(f => f.key === key);
              const scalingPct = breakdown ? (breakdown.phaseScaling * 100).toFixed(0) : '100';
              const effectivePct = breakdown ? (breakdown.effectiveAdjustment * 100).toFixed(1) : (factor.baseAdjustment * 100).toFixed(0);
              const warning = warnings.find(w => w.factorKey === key);

              return (
                <div key={key}>
                  <div className="flex items-start gap-3">
                    {/* Toggle switch */}
                    <button
                      type="button"
                      onClick={() => onToggle(key)}
                      className={[
                        'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200',
                        isActive
                          ? 'border-teal-500/40 bg-teal-500/30'
                          : 'border-slate-700 bg-slate-800',
                      ].join(' ')}
                      role="switch"
                      aria-checked={isActive}
                      aria-label={`Toggle ${factor.label}`}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block h-4 w-4 rounded-full shadow transition-transform duration-200',
                          isActive
                            ? 'translate-x-4 bg-teal-400'
                            : 'translate-x-0 bg-slate-500',
                        ].join(' ')}
                      />
                    </button>

                    {/* Label + description + phase scaling */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            'text-sm font-medium',
                            isActive ? 'text-slate-200' : 'text-slate-400',
                          ].join(' ')}
                        >
                          {factor.label}
                        </span>
                        <span
                          className={[
                            'shrink-0 text-[11px] tabular-nums',
                            isActive ? 'text-teal-400' : 'text-slate-600',
                          ].join(' ')}
                        >
                          {isActive ? `+${effectivePct}%` : `+${(factor.baseAdjustment * 100).toFixed(0)}%`}
                        </span>
                        {isActive && scalingPct !== '100' && (
                          <span className="text-[10px] text-amber-500/70">
                            ({scalingPct}% phase credit)
                          </span>
                        )}
                      </div>
                      <p
                        className={[
                          'mt-0.5 text-xs',
                          isActive ? 'text-slate-400' : 'text-slate-600',
                        ].join(' ')}
                      >
                        {factor.description}
                      </p>
                    </div>
                  </div>
                  {/* Validation warning */}
                  {isActive && warning && (
                    <div className={`ml-12 mt-1 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] ${
                      warning.severity === 'warning'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-700/30 text-slate-400'
                    }`}>
                      <svg className="mt-0.5 h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{warning.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary bar with cap progress */}
          {hasPremium && (
            <div className="mt-4 rounded-lg border border-teal-500/20 bg-teal-500/5 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total differentiation premium
                </span>
                <span className="text-sm font-semibold tabular-nums text-teal-400">
                  +{usedPct}%
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    / {capPct}%
                  </span>
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    result.wasCapped ? 'bg-amber-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, (result.totalAdjustment / MAX_DIFFERENTIATION_PREMIUM) * 100)}%` }}
                />
              </div>
              {result.wasCapped && (
                <p className="mt-1.5 text-[11px] text-amber-400/80">
                  Maximum +{capPct}% cap applied — raw total was +{(result.rawTotal * 100).toFixed(0)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
