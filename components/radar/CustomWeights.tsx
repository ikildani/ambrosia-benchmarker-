'use client';

import { useState, useEffect } from 'react';

export interface WeightConfig {
  cash_runway: number;
  regulatory_milestone: number;
  competitor_failure: number;
  management_commentary: number;
  strategic_review: number;
  patent_filing: number;
  publication_velocity: number;
  conference_activity: number;
  bd_executive_hire: number;
}

export const DEFAULT_WEIGHTS: WeightConfig = {
  cash_runway: 18,
  regulatory_milestone: 16,
  competitor_failure: 14,
  management_commentary: 12,
  strategic_review: 11,
  patent_filing: 9,
  publication_velocity: 7,
  conference_activity: 7,
  bd_executive_hire: 6,
};

const FACTOR_META: { key: keyof WeightConfig; label: string; icon: string }[] = [
  { key: 'cash_runway',           label: 'Cash Runway Pressure',     icon: '💰' },
  { key: 'regulatory_milestone',  label: 'Regulatory Milestones',    icon: '📋' },
  { key: 'competitor_failure',    label: 'Competitor Failures',      icon: '📉' },
  { key: 'management_commentary', label: 'Management Commentary',    icon: '🎙️' },
  { key: 'strategic_review',      label: 'Strategic Review',         icon: '🔍' },
  { key: 'patent_filing',         label: 'Patent Activity',          icon: '📝' },
  { key: 'publication_velocity',  label: 'Publication Velocity',     icon: '📚' },
  { key: 'conference_activity',   label: 'Conference Activity',      icon: '🎤' },
  { key: 'bd_executive_hire',     label: 'BD Hiring',                icon: '👤' },
];

const STORAGE_KEY = 'solidus_radar_custom_weights';

export function loadWeights(): WeightConfig {
  if (typeof window === 'undefined') return DEFAULT_WEIGHTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_WEIGHTS;
}

function saveWeights(weights: WeightConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch { /* ignore */ }
}

export function reweightScore(
  factorScores: Record<string, number>,
  weights: WeightConfig,
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;

  let weighted = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const score = factorScores[key] || 0;
    weighted += score * (weight / totalWeight);
  }
  return Math.min(Math.round(weighted), 100);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChange: (weights: WeightConfig) => void;
}

export function CustomWeightsPanel({ isOpen, onClose, onChange }: Props) {
  const [weights, setWeights] = useState<WeightConfig>(DEFAULT_WEIGHTS);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const loaded = loadWeights();
    setWeights(loaded);
    setIsCustom(JSON.stringify(loaded) !== JSON.stringify(DEFAULT_WEIGHTS));
  }, []);

  if (!isOpen) return null;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleChange = (key: keyof WeightConfig, value: number) => {
    const updated = { ...weights, [key]: value };
    setWeights(updated);
    setIsCustom(true);
    saveWeights(updated);
    onChange(updated);
  };

  const handleReset = () => {
    setWeights(DEFAULT_WEIGHTS);
    setIsCustom(false);
    saveWeights(DEFAULT_WEIGHTS);
    onChange(DEFAULT_WEIGHTS);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Custom Scoring Weights</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Adjust factor importance to match your evaluation criteria
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isCustom && (
                <button onClick={handleReset} className="text-[10px] px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors font-semibold">
                  Reset to Default
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Weight total indicator */}
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Total Weight</span>
            <span className={`text-xs font-bold tabular-nums ml-auto ${totalWeight === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {totalWeight}%
            </span>
            {totalWeight !== 100 && (
              <span className="text-[10px] text-amber-500">(will be normalized)</span>
            )}
          </div>

          {/* Sliders */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {FACTOR_META.map(({ key, label, icon }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                    <span className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300 w-8 text-right">{weights[key]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={weights[key]}
                    onChange={(e) => handleChange(key, parseInt(e.target.value, 10))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
