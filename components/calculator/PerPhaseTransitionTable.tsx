'use client';

import { useMemo, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

interface TransitionRow {
  key: string;
  label: string;
  rate: number;
}

interface PerPhaseTransitionTableProps {
  transitions: TransitionRow[];
  overrides: Partial<Record<string, number>> | undefined;
  onChange: (overrides: Partial<Record<string, number>> | undefined) => void;
  disabled?: boolean;
}

export default function PerPhaseTransitionTable({
  transitions,
  overrides,
  onChange,
  disabled = false,
}: PerPhaseTransitionTableProps) {
  const hasAnyOverride = overrides != null && Object.keys(overrides).length > 0;

  const cumulativePoS = useMemo(() => {
    return transitions.reduce((product, t) => {
      const rate = overrides?.[t.key] ?? t.rate;
      return product * rate;
    }, 1);
  }, [transitions, overrides]);

  const handleOverrideChange = useCallback(
    (key: string, rawValue: string) => {
      const trimmed = rawValue.trim();

      if (trimmed === '') {
        // Clear this override
        const next = { ...overrides };
        delete next[key];
        const remaining = Object.keys(next).length;
        onChange(remaining > 0 ? next : undefined);
        return;
      }

      const parsed = Number(trimmed);
      if (isNaN(parsed)) return;

      const clamped = Math.min(98, Math.max(1, parsed));
      const decimal = clamped / 100;

      const next = { ...overrides, [key]: decimal };
      onChange(next);
    },
    [overrides, onChange],
  );

  const handleResetRow = useCallback(
    (key: string) => {
      const next = { ...overrides };
      delete next[key];
      const remaining = Object.keys(next).length;
      onChange(remaining > 0 ? next : undefined);
    },
    [overrides, onChange],
  );

  const handleResetAll = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const formatPct = (decimal: number) =>
    `${(decimal * 100).toFixed(1).replace(/\.0$/, '')}%`;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        {/* Header */}
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500 font-semibold">
              Transition
            </th>
            <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500 font-semibold text-right">
              Default
            </th>
            <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500 font-semibold text-right">
              <span className="inline-flex items-center gap-2">
                Override
                {hasAnyOverride && !disabled && (
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="text-[10px] normal-case tracking-normal text-teal-500 hover:text-teal-400 transition-colors font-medium"
                  >
                    Reset All
                  </button>
                )}
              </span>
            </th>
            <th className="py-2 px-3 w-8" />
          </tr>
        </thead>

        <tbody>
          {transitions.map((t) => {
            const isOverridden =
              overrides != null && overrides[t.key] != null;
            const overrideValue = overrides?.[t.key];

            return (
              <tr
                key={t.key}
                className="border-b border-neutral-100 dark:border-neutral-800"
              >
                {/* Transition label */}
                <td className="py-2 px-3 text-sm text-neutral-700 dark:text-neutral-300">
                  {t.label}
                </td>

                {/* Default rate */}
                <td className="py-2 px-3 text-xs text-neutral-500 dark:text-neutral-500 text-right tabular-nums">
                  {formatPct(t.rate)}
                </td>

                {/* Override input */}
                <td
                  className={`py-2 px-3 text-right ${
                    isOverridden
                      ? 'border-l-2 border-l-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
                      : ''
                  }`}
                >
                  <div className="inline-flex items-center gap-0.5 justify-end">
                    <input
                      type="number"
                      min={1}
                      max={98}
                      step={1}
                      disabled={disabled}
                      placeholder="—"
                      value={
                        overrideValue != null
                          ? Math.round(overrideValue * 100)
                          : ''
                      }
                      onChange={(e) =>
                        handleOverrideChange(t.key, e.target.value)
                      }
                      className={`w-16 text-right text-sm tabular-nums bg-transparent border-0 border-b focus:border-b-teal-500 focus:ring-0 outline-none py-0.5 px-1 transition-colors
                        ${
                          disabled
                            ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                            : isOverridden
                              ? 'text-teal-700 dark:text-teal-400 border-b-teal-400/40'
                              : 'text-neutral-700 dark:text-neutral-300 border-b-neutral-300 dark:border-b-neutral-700'
                        }
                        placeholder:text-neutral-400 dark:placeholder:text-neutral-600
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                      `}
                    />
                    <span
                      className={`text-xs ${
                        isOverridden
                          ? 'text-teal-600 dark:text-teal-500'
                          : 'text-neutral-400 dark:text-neutral-600'
                      }`}
                    >
                      %
                    </span>
                  </div>
                </td>

                {/* Reset button */}
                <td className="py-2 px-3 w-8">
                  {isOverridden && !disabled && (
                    <button
                      type="button"
                      onClick={() => handleResetRow(t.key)}
                      className="text-neutral-400 hover:text-teal-500 dark:text-neutral-600 dark:hover:text-teal-400 transition-colors p-0.5"
                      title="Reset to default"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Cumulative PoS row */}
          <tr className="border-t-2 border-neutral-200 dark:border-neutral-700">
            <td className="py-2.5 px-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Cumulative PoS
            </td>
            <td className="py-2.5 px-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200 text-right tabular-nums">
              {formatPct(
                transitions.reduce((p, t) => p * t.rate, 1),
              )}
            </td>
            <td
              className={`py-2.5 px-3 text-right ${
                hasAnyOverride
                  ? 'border-l-2 border-l-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
                  : ''
              }`}
            >
              <span
                className={`text-sm font-semibold tabular-nums ${
                  hasAnyOverride
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-neutral-400 dark:text-neutral-600'
                }`}
              >
                {hasAnyOverride ? formatPct(cumulativePoS) : '—'}
              </span>
            </td>
            <td className="py-2.5 px-3 w-8" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
