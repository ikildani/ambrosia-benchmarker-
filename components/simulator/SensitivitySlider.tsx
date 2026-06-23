'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { BuyerZOPAResult } from './MultiBidderZOPA';

interface SensitivitySliderProps {
  /** Current buyer ZOPA results (from the last API response) */
  buyers: BuyerZOPAResult[];
  /** Base peak sales values from the form */
  basePeakSales: { low: number; median: number; high: number };
  /** Called with adjusted peak sales when the slider changes */
  onAdjust: (adjusted: { low: number; median: number; high: number }) => void;
  /** Whether an API call is currently in flight */
  loading?: boolean;
}

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

export function SensitivitySlider({
  buyers,
  basePeakSales,
  onAdjust,
  loading,
}: SensitivitySliderProps) {
  const [adjustment, setAdjustment] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFiredRef = useRef(0);

  const handleChange = useCallback(
    (value: number) => {
      setAdjustment(value);

      // Debounce the API call (500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Skip if we already fired for this value
        if (lastFiredRef.current === value) return;
        lastFiredRef.current = value;

        const multiplier = 1 + value / 100;
        onAdjust({
          low: Math.round(basePeakSales.low * multiplier),
          median: Math.round(basePeakSales.median * multiplier),
          high: Math.round(basePeakSales.high * multiplier),
        });
      }, 500);
    },
    [basePeakSales, onAdjust]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const multiplier = 1 + adjustment / 100;
  const adjustedMedian = Math.round(basePeakSales.median * multiplier);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium uppercase tracking-wider text-slate-400">
          Peak Sales Sensitivity
        </h4>
        {loading && (
          <span className="text-xs text-slate-500 animate-pulse">Recalculating...</span>
        )}
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 w-12 text-right">-30%</span>
          <input
            type="range"
            min={-30}
            max={30}
            step={5}
            value={adjustment}
            onChange={(e) => handleChange(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-slate-800 cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-teal-500 [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-slate-900 [&::-webkit-slider-thumb]:shadow
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-teal-500
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-900"
          />
          <span className="text-xs text-slate-500 w-12">+30%</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Adjustment:{' '}
            <span
              className={`font-mono ${
                adjustment > 0
                  ? 'text-teal-400'
                  : adjustment < 0
                    ? 'text-amber-400'
                    : 'text-slate-300'
              }`}
            >
              {adjustment > 0 ? '+' : ''}
              {adjustment}%
            </span>
          </span>
          <span className="text-slate-500">
            Peak sales:{' '}
            <span className="font-mono text-slate-200">{fmtMoney(adjustedMedian)}</span>
            {adjustment !== 0 && (
              <span className="text-slate-600 ml-1">
                (base: {fmtMoney(basePeakSales.median)})
              </span>
            )}
          </span>
          {adjustment !== 0 && (
            <button
              type="button"
              onClick={() => {
                setAdjustment(0);
                lastFiredRef.current = 0;
                onAdjust(basePeakSales);
              }}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Per-buyer ZOPA width indicators */}
      {buyers.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {buyers.map((buyer) => (
            <div
              key={buyer.name}
              className="flex items-center justify-between rounded border border-slate-700/40 bg-slate-950/40 px-3 py-2"
            >
              <span className="text-xs text-slate-400 truncate mr-2">{buyer.name}</span>
              <span
                className={`font-mono text-xs ${
                  buyer.zopaWidth > 0 ? 'text-teal-300' : 'text-amber-400'
                }`}
              >
                {buyer.zopaWidth > 0 ? fmtMoney(buyer.zopaWidth) : 'No ZOPA'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
