'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateDealTerms, formatCurrency, type CalculationInput, type TherapeuticArea, type Phase, type Modality } from '@/lib/calculations';

const TA_OPTIONS: { value: TherapeuticArea; label: string }[] = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic/Obesity' },
  { value: 'neurology', label: 'Neurology/CNS' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'rareDisease', label: 'Rare Disease' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'infectiousDisease', label: 'Infectious Disease' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'womensHealth', label: "Women's Health" },
];

const PHASE_OPTIONS: { value: Phase; label: string }[] = [
  { value: 'preclinical', label: 'Preclinical' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase3', label: 'Phase 3' },
  { value: 'approved', label: 'Approved' },
];

const MODALITY_OPTIONS: { value: Modality; label: string }[] = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'mab', label: 'Monoclonal Antibody' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific Antibody' },
  { value: 'carT_solid', label: 'CAR-T (Solid)' },
  { value: 'geneTherapy', label: 'Gene Therapy' },
  { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'protac', label: 'PROTAC' },
  { value: 'peptide', label: 'Peptide' },
];

interface MiniCalculatorProps {
  defaultTA?: TherapeuticArea;
  defaultPhase?: Phase;
  defaultModality?: Modality;
}

function makeInput(ta: TherapeuticArea, phase: Phase, modality: Modality): CalculationInput {
  return {
    therapeuticArea: ta,
    phase,
    modality,
    indication: 'lung_nsclc' as CalculationInput['indication'],
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  };
}

export function MiniCalculator({ defaultTA = 'oncology', defaultPhase = 'phase2', defaultModality = 'smallMolecule' }: MiniCalculatorProps) {
  const [ta, setTA] = useState<TherapeuticArea>(defaultTA);
  const [phase, setPhase] = useState<Phase>(defaultPhase);
  const [modality, setModality] = useState<Modality>(defaultModality);

  const result = useMemo(() => {
    try {
      return calculateDealTerms(makeInput(ta, phase, modality));
    } catch {
      return null;
    }
  }, [ta, phase, modality]);

  const selectClass = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';

  return (
    <div className="my-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_-20%,rgba(14,165,165,0.15),transparent)]" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-bold text-white">Quick Benchmark</h3>
        </div>
        <p className="text-sm text-slate-400 mb-5">Live data from 1,900+ deals. Select your parameters:</p>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Therapeutic Area</label>
            <select value={ta} onChange={(e) => setTA(e.target.value as TherapeuticArea)} className={selectClass}>
              {TA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Phase</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)} className={selectClass}>
              {PHASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Modality</label>
            <select value={modality} onChange={(e) => setModality(e.target.value as Modality)} className={selectClass}>
              {MODALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(result.terms.upfront.median)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Upfront</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(result.terms.totalDealValue.median)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Total Deal Value</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-bold text-white">{result.tieredRoyalties.base.low}–{result.tieredRoyalties.base.high}%</div>
              <div className="text-xs text-slate-400 mt-0.5">Base Royalty</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-xl sm:text-2xl font-bold text-white">{formatCurrency(result.terms.upfront.low)}–{formatCurrency(result.terms.upfront.high)}</div>
              <div className="text-xs text-slate-400 mt-0.5">Upfront Range</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href={`/calculator?ta=${ta}&phase=${phase}&modality=${modality}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors w-full sm:w-auto"
          >
            Full Analysis with 15+ Parameters
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <span className="text-xs text-slate-500">Includes rNPV, Monte Carlo, comparable deals, and negotiation playbook</span>
        </div>
      </div>
    </div>
  );
}
