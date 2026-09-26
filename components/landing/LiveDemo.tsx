'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import type { Phase, Modality, Indication, CalculationInput } from '@/lib/calculations';
import { DEMO_DEFAULT as DEFAULT, type DemoResult, type OptionGroup } from '@/components/landing/live-demo-shared';

export type { DemoResult, OptionGroup };
export interface LiveDemoProps { initial: DemoResult; modalities: OptionGroup[]; indications: OptionGroup[] }

let enginePromise: Promise<typeof import('@/lib/calculations')> | null = null;
function loadEngine() {
  if (!enginePromise) enginePromise = import('@/lib/calculations');
  return enginePromise;
}
function prefetchEngine() { void loadEngine(); }

export default function LiveDemo({ initial, modalities, indications }: LiveDemoProps) {
  const [demoPhase, setDemoPhase] = useState<Phase>('phase2');
  const [demoModality, setDemoModality] = useState<Modality>('adc');
  const [demoIndication, setDemoIndication] = useState<Indication>('breast_tnbc');

  // The deal engine (lib/calculations, ~160 KB compressed) used to ship with the
  // home page for this one widget. The server renders the default scenario; the
  // engine loads only when the visitor changes a control (and is prefetched on
  // first touch/hover of the section).
  const [computed, setComputed] = useState<DemoResult | null>(null);
  const isDefault = demoPhase === DEFAULT.phase && demoModality === DEFAULT.modality && demoIndication === DEFAULT.indication;
  useEffect(() => {
    if (isDefault) { setComputed(null); return; }
    let alive = true;
    loadEngine().then((m) => {
      if (!alive) return;
      const r = m.calculateDealTerms({
        therapeuticArea: 'oncology',
        phase: demoPhase,
        modality: demoModality,
        indication: demoIndication,
        territory: 'global',
        biomarker: 'unselected',
        lineOfTherapy: '2L',
        treatmentApproach: 'symptomatic',
        combinationPotential: 'some',
        competitivePosition: 'racing',
        dataQuality: 'promising',
        regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      } as CalculationInput);
      setComputed({ terms: { upfront: r.terms.upfront, totalDealValue: r.terms.totalDealValue }, tieredRoyalties: { base: r.tieredRoyalties.base } });
    }).catch(() => { /* keep the last numbers */ });
    return () => { alive = false; };
  }, [demoPhase, demoModality, demoIndication, isDefault]);
  const result = computed ?? initial;

  const styledSelect = "w-full px-4 py-3 min-h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-base sm:text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10 shadow-sm hover:border-slate-300 dark:hover:border-slate-500";

  const phasePills = [
    { value: 'preclinical', label: 'Preclinical' },
    { value: 'phase1', label: 'Phase 1' },
    { value: 'phase2', label: 'Phase 2' },
    { value: 'phase3', label: 'Phase 3' },
    { value: 'approved', label: 'Approved' },
  ];

  return (
    <section onPointerEnter={prefetchEngine} onTouchStart={prefetchEngine} className="py-10 sm:py-12 lg:py-16 xl:py-18 px-4 xl:px-6 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300">
      <div className="max-w-5xl xl:max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-navy-800 dark:text-white mb-3">
            See Your Deal Terms Instantly
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Select parameters below — benchmarks update in real time
          </p>
        </div>

        {/* Phase Selector — Pill buttons */}
        <div className="max-w-3xl xl:max-w-4xl mx-auto mb-6">
          <p className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 text-center">Development Phase</p>
          <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1" role="group" aria-label="Development phase">
            {phasePills.map(p => (
              <button
                key={p.value}
                onClick={() => setDemoPhase(p.value as Phase)}
                aria-pressed={demoPhase === p.value}
                className={`px-3 sm:px-5 min-h-11 sm:min-h-0 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                  demoPhase === p.value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modality & Indication — Styled dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl xl:max-w-3xl mx-auto mb-8">
          <div>
            <label htmlFor="demo-modality" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Modality</label>
            <select id="demo-modality" value={demoModality} onChange={(e) => setDemoModality(e.target.value as Modality)} className={styledSelect}>
              {modalities.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="demo-indication" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Indication</label>
            <select id="demo-indication" value={demoIndication} onChange={(e) => setDemoIndication(e.target.value as Indication)} className={styledSelect}>
              {indications.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Result Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl xl:max-w-4xl mx-auto mb-8">
          {[
            {
              label: 'Upfront Payment',
              value: `${formatCurrency(result.terms.upfront.low)} - ${formatCurrency(result.terms.upfront.high)}`,
              median: formatCurrency(result.terms.upfront.median),
            },
            {
              label: 'Total Deal Value',
              value: `${formatCurrency(result.terms.totalDealValue.low)} - ${formatCurrency(result.terms.totalDealValue.high)}`,
              median: formatCurrency(result.terms.totalDealValue.median),
            },
            {
              label: 'Royalty Rate',
              value: `${result.tieredRoyalties.base.low}% - ${result.tieredRoyalties.base.high}%`,
              median: `${((result.tieredRoyalties.base.low + result.tieredRoyalties.base.high) / 2).toFixed(1)}%`,
            },
          ].map((card, idx) => (
            <div key={idx} className="group bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-600 p-4 sm:p-5 lg:p-6 shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{card.label}</div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">
                {card.value}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Median: {card.median}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={`/calculator?phase=${demoPhase}&modality=${demoModality}&indication=${demoIndication}`}
            className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 font-semibold px-8 py-4 rounded-xl
                     shadow-xl shadow-blue-600/20 hover:shadow-2xl hover:shadow-blue-600/15 transition-all duration-300 hover:-translate-y-1 text-sm sm:text-base"
          >
            <span>Get Full Analysis with Milestones & Partner Matching</span>
            <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Free to use. No account required.</p>
        </div>
      </div>
    </section>
  );
}

