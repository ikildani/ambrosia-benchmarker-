'use client';

import { useState } from 'react';
import { therapeuticAreaOptions, phaseOptions } from '@/lib/calculations';
import EstimateResults from './EstimateResults';

const MODALITY_OPTIONS = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'mab', label: 'mAb' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'carT', label: 'CAR-T' },
  { value: 'geneTherapy', label: 'Gene Therapy' },
  { value: 'rnai', label: 'RNAi / siRNA' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'protac', label: 'PROTAC' },
  { value: 'aso', label: 'ASO' },
  { value: 'radiopharmaceutical', label: 'Radiopharm' },
];

const TERRITORY_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'us_only', label: 'US Only' },
  { value: 'us_eu', label: 'US + EU' },
  { value: 'ex_us', label: 'Ex-US' },
  { value: 'ex_us_eu', label: 'Ex-US/EU' },
];

interface InstantEstimatorProps {
  compact?: boolean;
}

interface EstimateData {
  upfront: { p10: number; p25: number; median: number; p75: number; p90: number };
  totalValue: { p10: number; p25: number; median: number; p75: number; p90: number };
  sampleSize: number;
}

export default function InstantEstimator({ compact }: InstantEstimatorProps) {
  const [ta, setTA] = useState('');
  const [phase, setPhase] = useState('');
  const [modality, setModality] = useState('');
  const [territory, setTerritory] = useState('global');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateData | null>(null);
  const [error, setError] = useState('');

  const canSubmit = ta && phase && modality && !loading;

  const handleEstimate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const params = new URLSearchParams({ ta, phase, modality, territory });
      const res = await fetch(`/api/estimate?${params}`);
      if (!res.ok) throw new Error('Failed to estimate');
      const json = await res.json();
      if (json.sampleSize < 3) {
        setError('Not enough comparable deals for this combination. Try a broader selection.');
        return;
      }
      setResult(json);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectClass = 'w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-colors';

  return (
    <div className={compact ? '' : 'max-w-2xl mx-auto'}>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Therapeutic Area</label>
          <select value={ta} onChange={e => setTA(e.target.value)} className={selectClass}>
            <option value="">Select TA</option>
            {therapeuticAreaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Phase</label>
          <select value={phase} onChange={e => setPhase(e.target.value)} className={selectClass}>
            <option value="">Select Phase</option>
            {phaseOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Modality</label>
          <select value={modality} onChange={e => setModality(e.target.value)} className={selectClass}>
            <option value="">Select Modality</option>
            {MODALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Territory</label>
          <select value={territory} onChange={e => setTerritory(e.target.value)} className={selectClass}>
            {TERRITORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={handleEstimate}
          disabled={!canSubmit}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Estimating...
            </span>
          ) : 'Estimate My Deal'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{error}</p>
      )}

      {result && <EstimateResults data={result} compact={compact} />}
    </div>
  );
}
