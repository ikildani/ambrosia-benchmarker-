'use client';

import { useState } from 'react';
import { InteractiveResults } from './InteractiveResults';
import type { TradeSpaceResponse } from './InteractiveResults';
import { AssetDifferentiationSection } from '@/components/calculator/AssetDifferentiationSection';

// ──────────────────────────────────────────────────────────────
// Constants (mirrors the option sets from lib/calculations.ts)
// ──────────────────────────────────────────────────────────────

const TA_OPTIONS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'infectiousDisease', label: 'Infectious Disease' },
  { value: 'rareDisease', label: 'Rare Disease' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'womensHealth', label: "Women's Health" },
] as const;

const PHASE_OPTIONS = [
  { value: 'preclinical', label: 'Preclinical' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase1_2', label: 'Phase 1/2' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase2_3', label: 'Phase 2/3' },
  { value: 'phase3', label: 'Phase 3' },
  { value: 'approved', label: 'Approved' },
] as const;

const MODALITY_OPTIONS = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'mab', label: 'Monoclonal Ab' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'geneTherapy', label: 'Gene Therapy' },
  { value: 'cellTherapy', label: 'Cell Therapy' },
  { value: 'rnai', label: 'RNAi' },
  { value: 'peptide', label: 'Peptide' },
] as const;

const COMPANY_TYPE_OPTIONS = [
  { value: 'clinicalStageBiotech', label: 'Clinical-stage Biotech' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'midPharma', label: 'Mid Pharma' },
  { value: 'largePharma', label: 'Large Pharma' },
] as const;

const COMPETITIVE_OPTIONS = [
  { value: 'firstInClass', label: 'First-in-class' },
  { value: 'bestInClass', label: 'Best-in-class' },
  { value: 'racing', label: 'Racing' },
  { value: 'behind', label: 'Behind' },
  { value: 'crowded', label: 'Crowded' },
] as const;

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function TradeSpaceForm() {
  // Form state
  const [therapeuticArea, setTherapeuticArea] = useState('oncology');
  const [phase, setPhase] = useState('phase2');
  const [modality, setModality] = useState('smallMolecule');
  const [peakSalesLow, setPeakSalesLow] = useState('500');
  const [peakSalesMedian, setPeakSalesMedian] = useState('1000');
  const [peakSalesHigh, setPeakSalesHigh] = useState('2000');
  const [competitivePosition, setCompetitivePosition] = useState('racing');
  const [companyType, setCompanyType] = useState('biotech');
  const [buyerName, setBuyerName] = useState('');
  const [differentiationFactors, setDifferentiationFactors] = useState<string[]>([]);

  const toggleDifferentiationFactor = (key: string) => {
    setDifferentiationFactors((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // API state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeSpaceResponse | null>(null);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/trade-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapeuticArea,
          phase,
          modality,
          peakSalesLow: Number(peakSalesLow) || Number(peakSalesMedian) * 0.5,
          peakSalesMedian: Number(peakSalesMedian),
          peakSalesHigh: Number(peakSalesHigh) || Number(peakSalesMedian) * 2,
          competitivePosition,
          companyType,
          buyerName: buyerName.trim() || undefined,
          differentiationFactors: differentiationFactors.length > 0 ? differentiationFactors : undefined,
        }),
      });

      const data: TradeSpaceResponse = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Optimization failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Pill selector helper
  const renderPills = (
    options: readonly { value: string; label: string }[],
    current: string,
    setter: (v: string) => void,
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setter(opt.value)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
            current === opt.value
              ? 'border-teal-500/60 bg-teal-500/15 text-teal-300'
              : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asset profile */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
            Asset Profile
          </h3>

          <div className="space-y-4">
            {/* Therapeutic area */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">Therapeutic area</label>
              {renderPills(TA_OPTIONS, therapeuticArea, setTherapeuticArea)}
            </div>

            {/* Phase */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">Development phase</label>
              {renderPills(PHASE_OPTIONS, phase, setPhase)}
            </div>

            {/* Modality */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">Modality</label>
              {renderPills(MODALITY_OPTIONS, modality, setModality)}
            </div>

            {/* Competitive position */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">Competitive position</label>
              {renderPills(COMPETITIVE_OPTIONS, competitivePosition, setCompetitivePosition)}
            </div>

            {/* Company type */}
            <div>
              <label className="mb-1.5 block text-xs text-slate-500">Company type (licensor)</label>
              {renderPills(COMPANY_TYPE_OPTIONS, companyType, setCompanyType)}
            </div>
          </div>
        </div>

        {/* Asset Differentiation */}
        <AssetDifferentiationSection
          selectedFactors={differentiationFactors}
          onToggle={toggleDifferentiationFactor}
        />

        {/* Peak sales */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
            Peak Sales Estimates ($M)
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Low</label>
              <input
                type="number"
                min={0}
                step={50}
                value={peakSalesLow}
                onChange={(e) => setPeakSalesLow(e.target.value)}
                placeholder="500"
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Median</label>
              <input
                type="number"
                min={0}
                step={50}
                value={peakSalesMedian}
                onChange={(e) => setPeakSalesMedian(e.target.value)}
                placeholder="1000"
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">High</label>
              <input
                type="number"
                min={0}
                step={50}
                value={peakSalesHigh}
                onChange={(e) => setPeakSalesHigh(e.target.value)}
                placeholder="2000"
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
          </div>
        </div>

        {/* Optional buyer name */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400">
            Buyer (optional)
          </h3>
          <input
            type="text"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="e.g. Pfizer, AbbVie, Novartis..."
            className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            If the buyer is in our counterparty database, we&apos;ll show their historical deal premium.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition-all hover:from-teal-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Optimizing...' : 'Optimize Deal Structure'}
        </button>
      </form>

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && <InteractiveResults data={result} />}
    </div>
  );
}
