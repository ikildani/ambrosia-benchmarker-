'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { BATNACalculator } from './BATNACalculator';
import { MultiBidderZOPA } from './MultiBidderZOPA';
import type { BuyerZOPAResult } from './MultiBidderZOPA';
import { SensitivitySlider } from './SensitivitySlider';

// ──────────────────────────────────────────────────────────────
// Constants (mirrors the option sets from lib/calculations.ts)
// ──────────────────────────────────────────────────────────────

const TA_OPTIONS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'infectiousDisease', label: 'Infectious Disease' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'womensHealth', label: "Women's Health" },
  { value: 'rareDisease', label: 'Rare Disease' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
] as const;

const PHASE_OPTIONS = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'preclinical', label: 'Preclinical' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase1_2', label: 'Phase 1/2' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase2_3', label: 'Phase 2/3' },
  { value: 'phase3', label: 'Phase 3' },
  { value: 'nda_filed', label: 'NDA Filed' },
  { value: 'approved', label: 'Approved' },
] as const;

const MODALITY_OPTIONS = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'mab', label: 'Monoclonal Antibody' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'carT_heme', label: 'CAR-T (Heme)' },
  { value: 'carT_solid', label: 'CAR-T (Solid)' },
  { value: 'cellTherapy', label: 'Cell Therapy' },
  { value: 'geneTherapy', label: 'Gene Therapy' },
  { value: 'rnai', label: 'RNAi' },
  { value: 'aso', label: 'ASO' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'protac', label: 'PROTAC' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
  { value: 'glp1Agonist', label: 'GLP-1 Agonist' },
  { value: 'antiVegf', label: 'Anti-VEGF' },
  { value: 'enzymeReplacement', label: 'Enzyme Replacement' },
] as const;

const COMPETITIVE_OPTIONS = [
  { value: 'firstInClass', label: 'First-in-class' },
  { value: 'firstToPivotal', label: 'First-to-pivotal' },
  { value: 'bestInClass', label: 'Best-in-class' },
  { value: 'racing', label: 'Racing / competitive' },
  { value: 'behind', label: 'Behind leader' },
  { value: 'crowded', label: 'Crowded field' },
] as const;

const COMPANY_TYPE_OPTIONS = [
  { value: 'largePharma', label: 'Large Pharma' },
  { value: 'midPharma', label: 'Mid Pharma' },
  { value: 'biotech', label: 'Biotech' },
  { value: 'clinicalStageBiotech', label: 'Clinical-stage Biotech' },
  { value: 'academic', label: 'Academic' },
] as const;

// Top 15 buyer names from counterparty_premiums table
const BUYER_OPTIONS = [
  'AbbVie',
  'Amgen',
  'AstraZeneca',
  'Biogen',
  'Bristol-Myers Squibb',
  'Eli Lilly',
  'Gilead Sciences',
  'GSK',
  'Johnson & Johnson',
  'Merck',
  'Novartis',
  'Novo Nordisk',
  'Pfizer',
  'Roche',
  'Sanofi',
] as const;

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface SimulatorResponse {
  success: boolean;
  baseRNPV: {
    upfrontMedian: number;
    totalDealMedian: number;
    riskAdjustedNPV: number;
  };
  buyers: BuyerZOPAResult[];
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

export function SimulatorForm() {
  // Form state
  const [therapeuticArea, setTherapeuticArea] = useState('oncology');
  const [phase, setPhase] = useState('phase2');
  const [modality, setModality] = useState('smallMolecule');
  const [peakSalesLow, setPeakSalesLow] = useState('500');
  const [peakSalesMedian, setPeakSalesMedian] = useState('1000');
  const [peakSalesHigh, setPeakSalesHigh] = useState('2000');
  const [competitivePosition, setCompetitivePosition] = useState('racing');
  const [companyType, setCompanyType] = useState('biotech');
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [batnaUpfrontM, setBatnaUpfrontM] = useState(0);

  // API state
  const [loading, setLoading] = useState(false);
  const [sensitivityLoading, setSensitivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulatorResponse | null>(null);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBuyerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buyer multi-select handlers
  const filteredBuyers = BUYER_OPTIONS.filter(
    (b) =>
      b.toLowerCase().includes(buyerSearch.toLowerCase()) &&
      !selectedBuyers.includes(b)
  );

  const addBuyer = (name: string) => {
    if (selectedBuyers.length < 3 && !selectedBuyers.includes(name)) {
      setSelectedBuyers([...selectedBuyers, name]);
    }
    setBuyerSearch('');
    setShowBuyerDropdown(false);
  };

  const removeBuyer = (name: string) => {
    setSelectedBuyers(selectedBuyers.filter((b) => b !== name));
  };

  // BATNA callback
  const handleBATNAChange = useCallback((value: number) => {
    setBatnaUpfrontM(value);
  }, []);

  // Submit
  const handleSubmit = async (
    e?: React.FormEvent,
    overridePeakSales?: { low: number; median: number; high: number }
  ) => {
    if (e) e.preventDefault();
    if (selectedBuyers.length === 0) {
      setError('Select at least one buyer.');
      return;
    }

    const isSensitivity = !!overridePeakSales;
    if (isSensitivity) {
      setSensitivityLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapeuticArea,
          indication: '',
          modality,
          phase,
          peakSalesLow: overridePeakSales ? overridePeakSales.low : Number(peakSalesLow) || Number(peakSalesMedian) * 0.5,
          peakSalesMedian: overridePeakSales ? overridePeakSales.median : Number(peakSalesMedian),
          peakSalesHigh: overridePeakSales ? overridePeakSales.high : Number(peakSalesHigh) || Number(peakSalesMedian) * 2,
          competitivePosition,
          companyType,
          buyers: selectedBuyers,
          batnaUpfrontM,
        }),
      });

      const data: SimulatorResponse = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Simulation failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setSensitivityLoading(false);
    }
  };

  // Sensitivity slider callback
  const handleSensitivityAdjust = useCallback(
    (adjusted: { low: number; median: number; high: number }) => {
      handleSubmit(undefined, adjusted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [therapeuticArea, modality, phase, competitivePosition, companyType, selectedBuyers, batnaUpfrontM]
  );

  // Pill selector helper
  const renderPills = (
    options: readonly { value: string; label: string }[],
    current: string,
    setter: (v: string) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setter(opt.value)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
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
        {/* Asset profile row */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5">
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

        {/* Peak sales */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5">
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

        {/* Buyer multi-select */}
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-5">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-cyan-400">
            Counterparties (1-3 buyers)
          </h3>

          {/* Selected buyers */}
          {selectedBuyers.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedBuyers.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300"
                >
                  {b}
                  <button
                    type="button"
                    onClick={() => removeBuyer(b)}
                    className="text-cyan-400 hover:text-cyan-200 transition-colors"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search dropdown */}
          {selectedBuyers.length < 3 && (
            <div ref={dropdownRef} className="relative">
              <input
                type="text"
                value={buyerSearch}
                onChange={(e) => {
                  setBuyerSearch(e.target.value);
                  setShowBuyerDropdown(true);
                }}
                onFocus={() => setShowBuyerDropdown(true)}
                placeholder={
                  selectedBuyers.length === 0
                    ? 'Search buyers (e.g. Pfizer, AbbVie)...'
                    : 'Add another buyer...'
                }
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              />

              {showBuyerDropdown && filteredBuyers.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-700 bg-slate-900 shadow-xl">
                  {filteredBuyers.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => addBuyer(b)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedBuyers.length >= 3 && (
            <p className="text-xs text-slate-500 italic">Maximum 3 buyers selected.</p>
          )}
        </div>

        {/* BATNA */}
        <BATNACalculator onChange={handleBATNAChange} />

        {/* Error */}
        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || selectedBuyers.length === 0}
          className="w-full rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Computing ZOPA...' : 'Run Negotiation Simulator'}
        </button>
      </form>

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6">
          {/* Base rNPV summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
              <div className="text-xs text-slate-500">Engine base upfront</div>
              <div className="mt-1 font-mono text-lg text-slate-200">
                {fmtMoney(result.baseRNPV.upfrontMedian)}
              </div>
              <div className="text-[11px] text-slate-500">pre-buyer-premium</div>
            </div>
            <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
              <div className="text-xs text-slate-500">Engine total deal</div>
              <div className="mt-1 font-mono text-lg text-slate-200">
                {fmtMoney(result.baseRNPV.totalDealMedian)}
              </div>
              <div className="text-[11px] text-slate-500">bio-bucks headline</div>
            </div>
            <div className="rounded border border-slate-700/50 bg-slate-900/30 p-3 text-center">
              <div className="text-xs text-slate-500">Risk-adjusted NPV</div>
              <div className="mt-1 font-mono text-lg text-slate-200">
                {fmtMoney(result.baseRNPV.riskAdjustedNPV)}
              </div>
              <div className="text-[11px] text-slate-500">asset intrinsic value</div>
            </div>
          </div>

          {/* Multi-bidder ZOPA */}
          <MultiBidderZOPA buyers={result.buyers} />

          {/* Sensitivity slider */}
          <SensitivitySlider
            buyers={result.buyers}
            basePeakSales={{
              low: Number(peakSalesLow) || Number(peakSalesMedian) * 0.5,
              median: Number(peakSalesMedian),
              high: Number(peakSalesHigh) || Number(peakSalesMedian) * 2,
            }}
            onAdjust={handleSensitivityAdjust}
            loading={sensitivityLoading}
          />
        </div>
      )}
    </div>
  );
}
