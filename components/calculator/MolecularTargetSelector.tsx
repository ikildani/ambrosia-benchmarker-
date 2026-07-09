'use client';

import { useMemo, useState } from 'react';
import {
  targetOptionsByTA,
  getTargetEntry,
  getCompositeTargetPosModifier,
  MODALITY_TARGET_OVERLAP,
} from '@/lib/financial/target-taxonomy';
import {
  getTargetCombination,
  getDefaultCombinationEffect,
} from '@/lib/financial/target-combinations';

interface MolecularTargetSelectorProps {
  therapeuticArea: string;
  indication: string;
  modality: string;
  selectedTargets: string[];
  onToggle: (slug: string) => void;
}

export function MolecularTargetSelector({
  therapeuticArea,
  indication,
  modality,
  selectedTargets,
  onToggle,
}: MolecularTargetSelectorProps) {
  const [expanded, setExpanded] = useState(false);

  const options = useMemo(
    () => targetOptionsByTA[therapeuticArea] ?? [],
    [therapeuticArea],
  );

  const overlapTarget = MODALITY_TARGET_OVERLAP[modality];
  const effectiveTargets = selectedTargets.filter(t => t !== overlapTarget);

  const combo = useMemo(() => {
    if (effectiveTargets.length < 2) return undefined;
    return getTargetCombination(effectiveTargets, indication);
  }, [effectiveTargets, indication]);

  const defaultCombo = useMemo(() => {
    if (effectiveTargets.length < 2 || combo) return undefined;
    return getDefaultCombinationEffect(effectiveTargets.length);
  }, [effectiveTargets.length, combo]);

  const compositePoS = getCompositeTargetPosModifier(effectiveTargets);
  const hasSelection = selectedTargets.length > 0;

  const posImpact = compositePoS !== 1.0;
  const posLabel = compositePoS > 1.0
    ? `+${((compositePoS - 1) * 100).toFixed(0)}% PoS`
    : compositePoS < 1.0
      ? `${((compositePoS - 1) * 100).toFixed(0)}% PoS`
      : '';

  const comboLabel = combo
    ? `+${(combo.dealPremium * 100).toFixed(0)}% premium`
    : defaultCombo
      ? `+${(defaultCombo.dealPremium * 100).toFixed(0)}% premium`
      : '';

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-800/30"
      >
        <div className="flex items-center gap-2.5">
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-slate-200">
            Molecular Targets
          </span>
          {posImpact && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              compositePoS > 1.0
                ? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}>
              {posLabel}
            </span>
          )}
          {comboLabel && (
            <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
              {comboLabel}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {!hasSelection
            ? 'Optional'
            : `${selectedTargets.length} target${selectedTargets.length > 1 ? 's' : ''}`}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/30 px-5 pb-5 pt-4">
          <p className="mb-4 text-xs text-slate-500">
            Select the molecular target(s) your asset engages. Multi-target assets (bispecifics, conjugates) can select up to 4. Each target adjusts PoS and deal premiums based on validation history.
          </p>

          <div className="flex flex-wrap gap-2">
            {options.map(opt => {
              const entry = getTargetEntry(opt.value);
              const isSelected = selectedTargets.includes(opt.value);
              const isOverlap = opt.value === overlapTarget;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  disabled={isOverlap}
                  title={isOverlap ? `Already captured by ${modality} modality` : entry?.source}
                  className={`
                    rounded-lg border px-3 py-1.5 text-xs font-medium transition-all
                    ${isOverlap
                      ? 'cursor-not-allowed border-slate-700/20 bg-slate-800/20 text-slate-600 line-through'
                      : isSelected
                        ? entry?.validatedTarget
                          ? 'border-teal-500/50 bg-teal-500/15 text-teal-300 shadow-sm shadow-teal-500/10'
                          : 'border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/10'
                        : 'border-slate-700/40 bg-slate-800/30 text-slate-400 hover:border-slate-600/50 hover:text-slate-300'
                    }
                  `}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Validated combination callout */}
          {combo && (
            <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Validated Combination
              </div>
              {combo.precedentDrug && (
                <p className="mt-1 text-[11px] text-cyan-300/70">
                  Precedent: {combo.precedentDrug}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-500">
                {combo.rationale}
              </p>
            </div>
          )}

          {/* Impact summary */}
          {effectiveTargets.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
                <div className={`text-sm font-bold ${compositePoS >= 1.0 ? 'text-teal-400' : 'text-amber-400'}`}>
                  {compositePoS >= 1.0 ? '+' : ''}{((compositePoS - 1) * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">PoS Impact</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
                <div className="text-sm font-bold text-teal-400">
                  +{((combo?.dealPremium ?? defaultCombo?.dealPremium ?? effectiveTargets.reduce((sum, t) => sum + (getTargetEntry(t)?.dealPremium ?? 0), 0)) * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Deal Premium</div>
              </div>
              <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
                <div className="text-sm font-bold text-slate-300">
                  {effectiveTargets.filter(t => getTargetEntry(t)?.validatedTarget).length}/{effectiveTargets.length}
                </div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Validated</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
