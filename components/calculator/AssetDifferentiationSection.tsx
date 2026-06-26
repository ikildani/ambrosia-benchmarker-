'use client';

import { useState } from 'react';
import {
  DIFFERENTIATION_FACTORS,
  DIFFERENTIATION_KEYS,
  computeDifferentiationAdjustment,
  type DifferentiationKey,
} from '@/lib/financial/differentiation-profiles';

interface AssetDifferentiationSectionProps {
  selectedFactors: string[];
  onToggle: (key: string) => void;
}

export function AssetDifferentiationSection({
  selectedFactors,
  onToggle,
}: AssetDifferentiationSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const validSelected = selectedFactors.filter(
    (k) => k in DIFFERENTIATION_FACTORS,
  ) as DifferentiationKey[];

  const { totalAdjustment } = computeDifferentiationAdjustment(validSelected);
  const hasPremium = totalAdjustment > 0;

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
              +{(totalAdjustment * 100).toFixed(0)}% differentiation premium
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
            (capped at +20%).
          </p>

          <div className="space-y-2.5">
            {DIFFERENTIATION_KEYS.map((key) => {
              const factor = DIFFERENTIATION_FACTORS[key];
              const isActive = validSelected.includes(key);

              return (
                <div
                  key={key}
                  className="flex items-start gap-3"
                >
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

                  {/* Label + description */}
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
                        +{(factor.baseAdjustment * 100).toFixed(0)}%
                      </span>
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
              );
            })}
          </div>

          {/* Summary bar */}
          {hasPremium && (
            <div className="mt-4 rounded-lg border border-teal-500/20 bg-teal-500/5 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total differentiation premium
                </span>
                <span className="text-sm font-semibold tabular-nums text-teal-400">
                  +{(totalAdjustment * 100).toFixed(0)}%
                </span>
              </div>
              {totalAdjustment >= 0.20 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Maximum +20% cap applied
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
