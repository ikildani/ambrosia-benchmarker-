'use client';

import { useState, useEffect } from 'react';

interface BATNACalculatorProps {
  onChange: (batnaUpfrontM: number) => void;
  initialValue?: number;
}

type BurnUnit = '$M/mo' | '$K/mo';

export function BATNACalculator({ onChange, initialValue }: BATNACalculatorProps) {
  const [cashOnHand, setCashOnHand] = useState<string>('');
  const [burnRate, setBurnRate] = useState<string>('');
  const [burnUnit, setBurnUnit] = useState<BurnUnit>('$M/mo');
  const [monthsToInflection, setMonthsToInflection] = useState<string>('');
  const [manualOverride, setManualOverride] = useState<string>(
    initialValue != null ? String(initialValue) : ''
  );
  const [useManual, setUseManual] = useState(initialValue != null);

  const burnInM = burnRate
    ? burnUnit === '$K/mo' ? Number(burnRate) / 1000 : Number(burnRate)
    : 0;

  const computedBATNA =
    cashOnHand && burnRate && monthsToInflection
      ? Math.max(0, Number(cashOnHand) - burnInM * Number(monthsToInflection))
      : null;

  useEffect(() => {
    if (useManual && manualOverride) {
      onChange(Number(manualOverride));
    } else if (!useManual && computedBATNA != null) {
      onChange(computedBATNA);
    }
  }, [useManual, manualOverride, computedBATNA, onChange]);

  const activeValue = useManual
    ? manualOverride ? Number(manualOverride) : null
    : computedBATNA;

  return (
    <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-teal-400">BATNA Calculator</h4>
        <button
          type="button"
          onClick={() => setUseManual(!useManual)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {useManual ? 'Switch to cash runway calc' : 'Enter manually'}
        </button>
      </div>

      {useManual ? (
        <div>
          <label className="block text-xs text-slate-500 mb-1">Walk-away upfront ($M)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={manualOverride}
            onChange={(e) => setManualOverride(e.target.value)}
            placeholder="e.g. 150"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Cash on hand ($M)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={cashOnHand}
                onChange={(e) => setCashOnHand(e.target.value)}
                placeholder="e.g. 50"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Monthly burn rate</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={burnUnit === '$K/mo' ? 10 : 0.1}
                  value={burnRate}
                  onChange={(e) => setBurnRate(e.target.value)}
                  placeholder={burnUnit === '$K/mo' ? 'e.g. 250' : 'e.g. 8'}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                />
                <button
                  type="button"
                  onClick={() => setBurnUnit(burnUnit === '$M/mo' ? '$K/mo' : '$M/mo')}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {burnUnit}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Months to inflection</label>
              <input
                type="number"
                min={0}
                step={1}
                value={monthsToInflection}
                onChange={(e) => setMonthsToInflection(e.target.value)}
                placeholder="e.g. 18"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-600">
            Toggle between $M/mo and $K/mo for the burn rate. Early-stage biotechs often burn in the thousands, not millions.
          </p>
        </div>
      )}

      {activeValue != null && (
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xs text-slate-500">Walk-away floor:</span>
          <span className="font-mono text-lg font-semibold text-teal-300">
            ${activeValue < 1 ? `${Math.round(activeValue * 1000)}K` : `${Math.round(activeValue)}M`}
          </span>
          {!useManual && computedBATNA != null && (
            <span className="text-[11px] text-slate-500">
              = ${cashOnHand}M &minus; {burnUnit === '$K/mo' ? `$${burnRate}K` : `$${burnRate}M`}/mo &times; {monthsToInflection}mo
            </span>
          )}
        </div>
      )}

      {!useManual && computedBATNA === null && (
        <p className="mt-2 text-xs text-slate-500 italic">
          Fill all three fields to auto-compute your walk-away floor.
        </p>
      )}
    </div>
  );
}
