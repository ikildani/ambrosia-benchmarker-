'use client';

import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/calculations';
import { Lock, Layers, ArrowRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StructureMode = 'upfrontHeavy' | 'balanced' | 'milestoneHeavy';

interface DealStructureToggleProps {
  baseRNPV: number;
  phase: string;
  dealType: string;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Default balanced allocations by phase
// [upfront, devMilestones, commMilestones, royalties]
// ---------------------------------------------------------------------------

const BALANCED_ALLOCATIONS: Record<string, [number, number, number, number]> = {
  preclinical: [0.10, 0.30, 0.35, 0.25],
  phase1: [0.12, 0.28, 0.35, 0.25],
  phase2: [0.18, 0.25, 0.32, 0.25],
  phase3: [0.30, 0.15, 0.35, 0.20],
  approved: [0.50, 0.05, 0.30, 0.15],
};

// ---------------------------------------------------------------------------
// Structure adjustments (percentage point shifts from balanced)
// ---------------------------------------------------------------------------

const STRUCTURE_ADJUSTMENTS: Record<StructureMode, [number, number, number, number]> = {
  upfrontHeavy:    [+0.12, -0.05, -0.04, -0.03],
  balanced:        [0, 0, 0, 0],
  milestoneHeavy:  [-0.08, +0.03, +0.03, +0.02],
};

// ---------------------------------------------------------------------------
// Present value discount factors for timing
// Upfront = 1.0 (paid now), Dev = ~0.85, Comm = ~0.65, Royalties = ~0.50
// ---------------------------------------------------------------------------

const PV_FACTORS = [1.0, 0.85, 0.65, 0.50];

// ---------------------------------------------------------------------------
// Labels for each bucket
// ---------------------------------------------------------------------------

const BUCKET_LABELS = ['Upfront', 'Dev Milestones', 'Comm Milestones', 'Royalties'];
const BUCKET_COLORS = [
  'bg-amber-500 dark:bg-amber-400',
  'bg-orange-400 dark:bg-orange-400',
  'bg-yellow-400 dark:bg-yellow-400',
  'bg-amber-300 dark:bg-amber-300',
];
const BUCKET_TEXT_COLORS = [
  'text-amber-700 dark:text-amber-400',
  'text-orange-600 dark:text-orange-400',
  'text-yellow-600 dark:text-yellow-400',
  'text-amber-600 dark:text-amber-300',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DealStructureToggle({
  baseRNPV,
  phase,
  dealType,
  tier,
  onUpgrade,
  onBuyReport,
}: DealStructureToggleProps) {
  const [mode, setMode] = useState<StructureMode>('balanced');
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const structures = useMemo(() => {
    const baseAlloc = BALANCED_ALLOCATIONS[phase] || BALANCED_ALLOCATIONS.phase2;
    const modes: StructureMode[] = ['upfrontHeavy', 'balanced', 'milestoneHeavy'];

    return modes.map((m) => {
      const adj = STRUCTURE_ADJUSTMENTS[m];
      const alloc = baseAlloc.map((base, i) => Math.max(0.01, base + adj[i]));
      // Normalize to sum to 1.0
      const sum = alloc.reduce((a, b) => a + b, 0);
      const normalized = alloc.map((v) => v / sum);

      const nominalValues = normalized.map((pct) => baseRNPV * pct);
      const pvValues = nominalValues.map((val, i) => val * PV_FACTORS[i]);
      const nominalTotal = nominalValues.reduce((a, b) => a + b, 0);
      const pvTotal = pvValues.reduce((a, b) => a + b, 0);

      return {
        mode: m,
        allocations: normalized,
        nominalValues,
        pvValues,
        nominalTotal,
        pvTotal,
      };
    });
  }, [baseRNPV, phase]);

  const currentStructure = structures.find((s) => s.mode === mode) || structures[1];
  const maxNominal = Math.max(...currentStructure.nominalValues);

  if (baseRNPV <= 0) {
    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Deal structure analysis requires a positive rNPV base case.
        </p>
      </div>
    );
  }

  const modeLabels: Record<StructureMode, string> = {
    upfrontHeavy: 'Upfront-Heavy',
    balanced: 'Balanced',
    milestoneHeavy: 'Milestone-Heavy',
  };

  const modeDescriptions: Record<StructureMode, string> = {
    upfrontHeavy: 'Higher guaranteed upfront payment with reduced milestone risk. Preferred by licensors seeking certainty.',
    balanced: 'Standard deal structure with market-consensus allocation across payment types.',
    milestoneHeavy: 'Lower upfront with greater total potential. Preferred by partners managing near-term cash.',
  };

  return (
    <div className="relative mt-6 sm:mt-8" role="region" aria-label="Deal Structure Toggle">
      <div className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Deal Structure Toggle
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  Compare upfront-weighted vs. milestone-weighted structures
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>
            {/* Three-button toggle */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/50 p-1 mb-5" role="tablist" aria-label="Deal structure modes">
              {(['upfrontHeavy', 'balanced', 'milestoneHeavy'] as StructureMode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-md transition-all ${
                    mode === m
                      ? 'bg-white dark:bg-slate-600 text-navy-800 dark:text-white shadow-sm'
                      : 'text-neutral-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>

            {/* Mode description */}
            <p className="text-xs text-neutral-500 dark:text-slate-400 mb-4 leading-relaxed">
              {modeDescriptions[mode]}
            </p>

            {/* Waterfall Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {BUCKET_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-500/30 transition-all"
                >
                  <p className="text-[10px] font-bold text-neutral-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1.5">
                    {label}
                  </p>
                  <p className={`text-sm sm:text-base font-bold ${BUCKET_TEXT_COLORS[i]}`}>
                    {formatCurrency(currentStructure.nominalValues[i])}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-slate-400 mt-0.5">
                    {(currentStructure.allocations[i] * 100).toFixed(0)}% of total
                  </p>
                </div>
              ))}
            </div>

            {/* Visual waterfall bars */}
            <div className="mb-5 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Waterfall Breakdown
              </h5>
              <div className="space-y-2">
                {BUCKET_LABELS.map((label, i) => {
                  const widthPct = maxNominal > 0 ? (currentStructure.nominalValues[i] / maxNominal) * 100 : 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-neutral-500 dark:text-slate-400 w-24 sm:w-28 flex-shrink-0 text-right">
                        {label}
                      </span>
                      <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${BUCKET_COLORS[i]} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(widthPct, 2)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-16 text-right">
                        {formatCurrency(currentStructure.nominalValues[i])}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Present Value Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider mb-1">
                  Nominal Total
                </p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  {formatCurrency(currentStructure.nominalTotal)}
                </p>
                <p className="text-[10px] text-amber-600/50 dark:text-amber-400/40 mt-0.5">
                  Sum of all payments
                </p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-lg border border-orange-100 dark:border-orange-500/20">
                <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-wider mb-1">
                  Present Value
                </p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                  {formatCurrency(currentStructure.pvTotal)}
                </p>
                <p className="text-[10px] text-orange-600/50 dark:text-orange-400/40 mt-0.5">
                  Time-value adjusted
                </p>
              </div>
            </div>

            {/* Cross-structure comparison */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
              <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Structure Comparison
              </h5>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-xs" aria-label="Deal structure comparison across modes">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-1.5 px-2 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Structure
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Upfront
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        Nominal
                      </th>
                      <th className="text-right py-1.5 px-2 font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                        PV
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((s) => {
                      const isActive = s.mode === mode;
                      return (
                        <tr
                          key={s.mode}
                          className={`border-b border-slate-100 dark:border-slate-700/50 ${
                            isActive ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''
                          }`}
                        >
                          <td className={`py-1.5 px-2 font-semibold ${
                            isActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {modeLabels[s.mode]}
                            {isActive && (
                              <ArrowRight className="inline w-3 h-3 ml-1" />
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatCurrency(s.nominalValues[0])}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatCurrency(s.nominalTotal)}
                          </td>
                          <td className={`py-1.5 px-2 text-right font-mono font-semibold ${
                            isActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {formatCurrency(s.pvTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-slate-400 mt-2 leading-relaxed">
                Upfront-heavy structures have lower nominal totals but higher present value due to immediate cash receipt.
                Milestone-heavy structures offer greater nominal upside but carry execution risk and time-value discount.
              </p>
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                aria-label="Unlock Deal Structure Analysis"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow hover:scale-105 transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Deal Structure Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
