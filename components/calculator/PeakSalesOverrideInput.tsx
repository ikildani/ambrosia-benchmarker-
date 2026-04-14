'use client';

/**
 * Peak Sales Override Input (R23 — 2026-04-13)
 *
 * BD-facing input for analyst-consensus peak sales. When populated, the
 * value overrides the engine's indication-based anchor in downstream rNPV
 * calculations. Displayed prominently in the calculator so BD users see
 * it as a first-class input rather than an engine internal.
 *
 * Data flow:
 *   UI input → CalculatorFormState.peakSalesOverrideM (setPeakSalesOverrideM)
 *           → buildCalculationInput → CalculationInput.peakSalesOverrideM
 *           → downstream rNPV call (when rnpv-engine is invoked)
 *
 * For BD credibility, the component shows:
 *   - Label: "Your analyst consensus peak sales"
 *   - Helper: explains that this overrides the engine default
 *   - Unit: $M (standard analyst notation)
 *   - Clear button: resets to engine default
 */

import { useState, useEffect } from 'react';

interface PeakSalesOverrideInputProps {
  /** Current override value in $M. null = use engine default. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Optional — indication name to show "vs engine default" hint */
  indicationName?: string;
  /** Optional — engine default peak in $M for this indication, for hint */
  engineDefaultM?: number;
  // R60d (2026-04-14): "Use analyst consensus" lookup. When all three are
  // present, the component enables the "Use analyst consensus peak" button
  // which calls /api/deals/peak-sales-consensus and pre-fills from
  // Supabase-stored peak_sales_consensus_m data.
  therapeuticArea?: string;
  indicationSlug?: string;
  phase?: string;
}

interface ConsensusLookup {
  count: number;
  median: number | null;
  low?: number;
  high?: number;
  sampleAssets?: Array<{ asset: string | null; peak_M: number }>;
  source?: string;
}

export default function PeakSalesOverrideInput({
  value,
  onChange,
  indicationName,
  engineDefaultM,
  therapeuticArea,
  indicationSlug,
  phase,
}: PeakSalesOverrideInputProps) {
  // Use string state for the input so users can type freely (backspace to empty etc.)
  const [rawInput, setRawInput] = useState<string>(value === null ? '' : String(value));
  const [consensus, setConsensus] = useState<ConsensusLookup | null>(null);
  const [loadingConsensus, setLoadingConsensus] = useState(false);

  // Sync from prop changes (e.g., reset from outside)
  useEffect(() => {
    setRawInput(value === null ? '' : String(value));
  }, [value]);

  // Fetch cohort consensus when TA + indication available.
  useEffect(() => {
    if (!therapeuticArea || !indicationSlug) {
      setConsensus(null);
      return;
    }
    let cancelled = false;
    setLoadingConsensus(true);
    const qs = new URLSearchParams({ ta: therapeuticArea, indication: indicationSlug });
    if (phase) qs.set('phase', phase);
    fetch(`/api/deals/peak-sales-consensus?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: ConsensusLookup) => {
        if (!cancelled) {
          setConsensus(data);
          setLoadingConsensus(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConsensus(null);
          setLoadingConsensus(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [therapeuticArea, indicationSlug, phase]);

  const handleUseConsensus = () => {
    if (consensus?.median != null) {
      setRawInput(String(consensus.median));
      onChange(consensus.median);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setRawInput(raw);
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  };

  const handleClear = () => {
    setRawInput('');
    onChange(null);
  };

  const isOverridden = value !== null && value > 0;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Your Analyst Consensus Peak Sales
          </label>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-md">
            Optional. Overrides the engine&rsquo;s indication-based default. Use when you have
            an asset-specific consensus from sell-side or in-house analysts.
          </p>
        </div>
        {isOverridden && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2"
          >
            Reset to default
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rawInput}
            onChange={handleChange}
            placeholder={engineDefaultM ? `${engineDefaultM} (engine default)` : 'e.g. 2500'}
            aria-label="Peak sales override in millions of dollars"
            className={`
              w-full pl-6 pr-10 py-2 text-sm font-mono rounded-md
              border ${isOverridden ? 'border-teal-500/60 bg-teal-50/40 dark:bg-teal-950/20' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'}
              text-slate-900 dark:text-slate-100
              focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30
              transition-colors
            `}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
            M
          </span>
        </div>
      </div>

      {isOverridden && indicationName && engineDefaultM && (
        <div className="mt-2 text-[11px] text-teal-700 dark:text-teal-400">
          Using your $<span className="font-mono font-semibold">{value?.toLocaleString()}</span>M
          for {indicationName} (engine default: ${engineDefaultM.toLocaleString()}M).
        </div>
      )}
      {!isOverridden && (
        <div className="mt-2 text-[11px] text-slate-400">
          Engine is using its calibrated indication-based default.
        </div>
      )}

      {/* R60d: analyst-consensus cohort lookup button */}
      {consensus && consensus.count > 0 && consensus.median != null && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-teal-500/30 bg-teal-50/40 dark:bg-teal-950/20 px-3 py-2">
          <div className="text-[11px] text-teal-800 dark:text-teal-300">
            <span className="font-semibold">Analyst consensus:</span>{' '}
            ${consensus.median.toLocaleString()}M median
            {consensus.low != null && consensus.high != null && (
              <> (${consensus.low.toLocaleString()}–${consensus.high.toLocaleString()}M IQR)</>
            )}{' '}
            across <span className="font-mono">{consensus.count}</span> disclosed deal
            {consensus.count === 1 ? '' : 's'}.
          </div>
          <button
            type="button"
            onClick={handleUseConsensus}
            className="shrink-0 rounded-md border border-teal-500/60 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
          >
            Use consensus
          </button>
        </div>
      )}
      {loadingConsensus && !consensus && (
        <div className="mt-2 text-[11px] text-slate-400">Checking analyst consensus…</div>
      )}
    </div>
  );
}
