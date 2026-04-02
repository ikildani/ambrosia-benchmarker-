'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRight, Lock, CheckCircle2, BarChart3, ChevronRight, Building2,
  Users, LineChart, Scale, Target, Loader2, Shield, Download, Calculator,
  FileText, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import SearchableCombobox, { type GroupedOption } from '@/components/calculator/SearchableCombobox';
import {
  calculateDealTerms,
  formatCurrency,
  phaseOptions,
  dealTypeOptions,
  modalityOptions,
  indicationOptions,
  neurologyModalityOptions,
  neurologyIndicationOptions,
  immunologyModalityOptions,
  immunologyIndicationOptions,
  metabolicModalityOptions,
  metabolicIndicationOptions,
  cardiovascularModalityOptions,
  cardiovascularIndicationOptions,
  infectiousDiseaseModalityOptions,
  infectiousDiseaseIndicationOptions,
  ophthalmologyModalityOptions,
  ophthalmologyIndicationOptions,
  womensHealthModalityOptions,
  womensHealthIndicationOptions,
  rareDiseaseModalityOptions,
  rareDiseaseIndicationOptions,
  hematologyModalityOptions,
  hematologyIndicationOptions,
  dermatologyModalityOptions,
  dermatologyIndicationOptions,
  gastroenterologyModalityOptions,
  gastroenterologyIndicationOptions,
  type CalculationInput,
  type CalculationResult,
  type Phase,
  type DealType,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from '@/lib/calculations';

/* ─── TA → option maps (same as Calculator.tsx) ────────────────────── */

const modalityMap: Record<TherapeuticArea, GroupedOption[]> = {
  oncology: modalityOptions,
  neurology: neurologyModalityOptions,
  immunology: immunologyModalityOptions,
  metabolic: metabolicModalityOptions,
  cardiovascular: cardiovascularModalityOptions,
  infectiousDisease: infectiousDiseaseModalityOptions,
  ophthalmology: ophthalmologyModalityOptions,
  womensHealth: womensHealthModalityOptions,
  rareDisease: rareDiseaseModalityOptions,
  hematology: hematologyModalityOptions,
  dermatology: dermatologyModalityOptions,
  gastroenterology: gastroenterologyModalityOptions,
};

const indicationMap: Record<TherapeuticArea, GroupedOption[]> = {
  oncology: indicationOptions,
  neurology: neurologyIndicationOptions,
  immunology: immunologyIndicationOptions,
  metabolic: metabolicIndicationOptions,
  cardiovascular: cardiovascularIndicationOptions,
  infectiousDisease: infectiousDiseaseIndicationOptions,
  ophthalmology: ophthalmologyIndicationOptions,
  womensHealth: womensHealthIndicationOptions,
  rareDisease: rareDiseaseIndicationOptions,
  hematology: hematologyIndicationOptions,
  dermatology: dermatologyIndicationOptions,
  gastroenterology: gastroenterologyIndicationOptions,
};

/* Wrap flat option arrays as GroupedOption[] for SearchableCombobox */
const TA_GROUPS: GroupedOption[] = [
  { group: 'Therapeutic Areas', options: [
    { value: 'oncology', label: 'Oncology' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'immunology', label: 'Immunology' },
    { value: 'rareDisease', label: 'Rare Disease' },
    { value: 'cardiovascular', label: 'Cardiovascular' },
    { value: 'metabolic', label: 'Metabolic' },
    { value: 'hematology', label: 'Hematology' },
    { value: 'ophthalmology', label: 'Ophthalmology' },
    { value: 'dermatology', label: 'Dermatology' },
    { value: 'infectiousDisease', label: 'Infectious Disease' },
    { value: 'gastroenterology', label: 'Gastroenterology' },
    { value: 'womensHealth', label: "Women's Health" },
  ]},
];

const PHASE_GROUPS: GroupedOption[] = [
  { group: 'Development Phase', options: phaseOptions },
];

const DEAL_TYPE_GROUPS: GroupedOption[] = [
  { group: 'Deal Type', options: dealTypeOptions },
];

const LOCKED_SECTIONS = [
  { icon: Users, label: 'Partner Intelligence + Pharma Intent Score', desc: '850+ companies ranked by fit' },
  { icon: Calculator, label: 'rNPV & Deal Valuation', desc: 'Phase-specific LoA-calibrated asset value' },
  { icon: Building2, label: 'Buyer-Specific Valuation', desc: 'What your asset is worth to each acquirer' },
  { icon: LineChart, label: 'Monte Carlo Sensitivity Analysis', desc: 'rNPV modeling with probability-weighted outcomes' },
  { icon: Scale, label: 'Negotiation Playbook', desc: 'Data-backed strategy for your counterparty' },
  { icon: Target, label: 'Competitive Landscape', desc: 'Pipeline mapping from ClinicalTrials.gov' },
  { icon: BarChart3, label: 'Extended Comparable Deals', desc: 'Full transaction breakdowns' },
  { icon: FileText, label: 'PDF + Excel Export', desc: 'Board-ready formatting' },
];

/* ─── Main Component ───────────────────────────────────────────────── */

export default function ReportIntakeForm() {
  const [ta, setTA] = useState<TherapeuticArea | ''>('');
  const [phase, setPhase] = useState<Phase | ''>('');
  const [dealType, setDealType] = useState<DealType | ''>('');
  const [modality, setModality] = useState<Modality | ''>('');
  const [indication, setIndication] = useState<Indication | ''>('');

  // Advanced parameters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [territory, setTerritory] = useState('global');
  const [competitivePosition, setCompetitivePosition] = useState('racing');
  const [dataQuality, setDataQuality] = useState('promising');
  const [combinationPotential, setCombinationPotential] = useState('some');
  const [biomarker, setBiomarker] = useState('unselected');
  const [breakthrough, setBreakthrough] = useState(false);
  const [fastTrack, setFastTrack] = useState(false);
  const [orphan, setOrphan] = useState(false);

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calculationInput, setCalculationInput] = useState<CalculationInput | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // TA-filtered options
  const currentModalityOptions = useMemo(
    () => ta ? (modalityMap[ta] || modalityOptions) : modalityOptions,
    [ta]
  );
  const currentIndicationOptions = useMemo(
    () => ta ? (indicationMap[ta] || indicationOptions) : indicationOptions,
    [ta]
  );

  // Reset modality/indication when TA changes
  const handleTAChange = useCallback((newTA: string) => {
    setTA(newTA as TherapeuticArea);
    setModality('');
    setIndication('');
    setResult(null);
  }, []);

  const isReady = ta && phase && dealType && modality && indication;

  // Run calculation
  const handleGenerate = useCallback(() => {
    if (!isReady) return;
    setIsCalculating(true);
    setResult(null);

    setTimeout(() => {
      const input: CalculationInput = {
        therapeuticArea: ta as TherapeuticArea,
        phase: phase as Phase,
        dealType: dealType as DealType,
        modality: modality as Modality,
        indication: indication as Indication,
        territory: territory as any,
        biomarker: biomarker as any,
        lineOfTherapy: '2L',
        treatmentApproach: 'symptomatic',
        combinationPotential: combinationPotential as any,
        competitivePosition: competitivePosition as any,
        dataQuality: dataQuality as any,
        regulatoryDesignations: { breakthrough, fastTrack, orphan, prime: false },
      };

      try {
        const calcResult = calculateDealTerms(input);
        setResult(calcResult);
        setCalculationInput(input);
      } catch {
        // Fallback
      }
      setIsCalculating(false);
    }, 800);
  }, [ta, phase, dealType, modality, indication, isReady, territory, competitivePosition, dataQuality, combinationPotential, biomarker, breakthrough, fastTrack, orphan]);

  // Scroll to results
  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  // Stripe checkout
  const handleCheckout = async () => {
    if (!result || !calculationInput) return;
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'report',
          calculationData: { inputs: calculationInput, results: result },
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      setCheckoutError('Something went wrong. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleEdit = () => {
    setResult(null);
    setCalculationInput(null);
  };

  const terms = result?.terms;
  const royalties = result?.tieredRoyalties;
  const labels = result?.labels;

  return (
    <div className="space-y-0">
      {/* ━━━ FORM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative bg-[#0c1220]/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/[0.03] via-transparent to-cyan-500/[0.03] rounded-2xl blur-xl pointer-events-none" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                {result ? 'Your asset parameters' : 'Configure your report'}
              </h3>
              <p className="text-xs text-slate-500">
                {result
                  ? `${labels?.phase} ${labels?.modality} — ${labels?.indication}`
                  : 'Select your asset parameters to generate a tailored analysis.'
                }
              </p>
            </div>
            {result && (
              <button onClick={handleEdit} className="text-xs font-medium text-teal-400/70 hover:text-teal-400 transition-colors">
                Edit parameters
              </button>
            )}
          </div>

          {/* Form fields — collapse when results shown */}
          {!result && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <SearchableCombobox
                  id="report-ta"
                  label="Therapeutic Area"
                  groups={TA_GROUPS}
                  value={ta}
                  onChange={handleTAChange}
                />
                <SearchableCombobox
                  id="report-phase"
                  label="Development Phase"
                  groups={PHASE_GROUPS}
                  value={phase}
                  onChange={(v) => setPhase(v as Phase)}
                />
                <SearchableCombobox
                  id="report-dealtype"
                  label="Deal Type"
                  groups={DEAL_TYPE_GROUPS}
                  value={dealType}
                  onChange={(v) => setDealType(v as DealType)}
                />
                <SearchableCombobox
                  id="report-modality"
                  label="Modality"
                  groups={currentModalityOptions}
                  value={modality}
                  onChange={(v) => setModality(v as Modality)}
                />
                <div className="sm:col-span-2">
                  <SearchableCombobox
                    id="report-indication"
                    label="Indication"
                    groups={currentIndicationOptions}
                    value={indication}
                    onChange={(v) => setIndication(v as Indication)}
                  />
                </div>
              </div>

              {/* Advanced Parameters Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-medium text-teal-400/60 hover:text-teal-400 transition-colors mb-4"
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Parameters
              </button>

              {showAdvanced && (
                <div className="space-y-4 mb-6 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Territory */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Territory</label>
                      <select value={territory} onChange={e => setTerritory(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#0c1220] border border-white/[0.08] rounded-lg text-white focus:border-teal-500/50 focus:outline-none">
                        <option value="global">Global</option>
                        <option value="us">US</option>
                        <option value="eu5">EU5</option>
                        <option value="japan">Japan</option>
                        <option value="china">China</option>
                        <option value="ex_us">Ex-US</option>
                      </select>
                    </div>

                    {/* Competitive Position */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Competitive Position</label>
                      <select value={competitivePosition} onChange={e => setCompetitivePosition(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#0c1220] border border-white/[0.08] rounded-lg text-white focus:border-teal-500/50 focus:outline-none">
                        <option value="firstInClass">First-in-Class</option>
                        <option value="firstToPivotal">First-to-Pivotal</option>
                        <option value="bestInClass">Best-in-Class</option>
                        <option value="racing">Racing (Default)</option>
                        <option value="behind">Behind</option>
                        <option value="crowded">Crowded</option>
                      </select>
                    </div>

                    {/* Data Quality */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Data Quality</label>
                      <select value={dataQuality} onChange={e => setDataQuality(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#0c1220] border border-white/[0.08] rounded-lg text-white focus:border-teal-500/50 focus:outline-none">
                        <option value="pivotalReady">Pivotal Ready</option>
                        <option value="strongPhase2">Strong Phase 2</option>
                        <option value="promising">Promising (Default)</option>
                        <option value="mixed">Mixed</option>
                        <option value="limited">Limited</option>
                      </select>
                    </div>

                    {/* Combination Potential */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Combination Potential</label>
                      <select value={combinationPotential} onChange={e => setCombinationPotential(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#0c1220] border border-white/[0.08] rounded-lg text-white focus:border-teal-500/50 focus:outline-none">
                        <option value="strong">Strong</option>
                        <option value="moderate">Moderate</option>
                        <option value="some">Some (Default)</option>
                        <option value="limited">Limited</option>
                      </select>
                    </div>

                    {/* Biomarker */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Biomarker Status</label>
                      <select value={biomarker} onChange={e => setBiomarker(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs bg-[#0c1220] border border-white/[0.08] rounded-lg text-white focus:border-teal-500/50 focus:outline-none">
                        <option value="unselected">Unselected (Default)</option>
                        <option value="validated">Validated Biomarker</option>
                        <option value="exploratory">Exploratory Biomarker</option>
                        <option value="companion_dx">Companion Diagnostic</option>
                      </select>
                    </div>
                  </div>

                  {/* Regulatory Designations */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Regulatory Designations</label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: 'breakthrough', label: 'Breakthrough Therapy', value: breakthrough, set: setBreakthrough },
                        { key: 'fastTrack', label: 'Fast Track', value: fastTrack, set: setFastTrack },
                        { key: 'orphan', label: 'Orphan Drug', value: orphan, set: setOrphan },
                      ].map(d => (
                        <label key={d.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={d.value}
                            onChange={e => d.set(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-transparent text-teal-500 focus:ring-teal-500/20"
                          />
                          <span className="text-xs text-slate-400">{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!isReady || isCalculating}
                className="group w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-[#080c16] font-bold rounded-xl transition-all shadow-[0_0_40px_rgba(20,184,166,0.15)] hover:shadow-[0_0_60px_rgba(20,184,166,0.25)] text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing {DEAL_STATS.TOTAL_DEALS} transactions...
                  </>
                ) : (
                  <>
                    Generate Your Report
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-slate-600 mt-3">
                Free preview included &middot; Full report {PRICING.REPORT_PRICE} via Stripe
              </p>
            </>
          )}
        </div>
      </div>

      {/* ━━━ RESULTS PREVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {result && terms && royalties && (
        <div ref={resultsRef} className="mt-6 space-y-4 animate-[fadeIn_0.5s_ease-out]">

          {/* Deal Terms Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Upfront */}
            <div className="bg-[#0c1220]/80 border border-white/[0.06] rounded-xl p-5">
              <div className="text-[9px] font-bold text-teal-400/60 tracking-[0.15em] uppercase mb-3">Upfront Payment</div>
              <div className="font-mono text-2xl font-extrabold text-white tracking-tight mb-1">
                {formatCurrency(terms.upfront.median)}
              </div>
              <div className="text-[11px] text-slate-500 mb-3">
                Range: {formatCurrency(terms.upfront.low)} – {formatCurrency(terms.upfront.high)}
              </div>
              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500/70 to-teal-400/50 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(Math.max((terms.upfront.median / Math.max(terms.upfront.high, 1)) * 100, 15), 90)}%` }}
                />
              </div>
            </div>

            {/* Total Deal Value */}
            <div className="bg-[#0c1220]/80 border border-white/[0.06] rounded-xl p-5">
              <div className="text-[9px] font-bold text-cyan-400/60 tracking-[0.15em] uppercase mb-3">Total Deal Value</div>
              <div className="font-mono text-2xl font-extrabold text-white tracking-tight mb-1">
                {formatCurrency(terms.totalDealValue.median)}
              </div>
              <div className="text-[11px] text-slate-500 mb-3">
                Range: {formatCurrency(terms.totalDealValue.low)} – {formatCurrency(terms.totalDealValue.high)}
              </div>
              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500/70 to-cyan-400/50 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(Math.max((terms.totalDealValue.median / Math.max(terms.totalDealValue.high, 1)) * 100, 15), 90)}%` }}
                />
              </div>
            </div>

            {/* Royalties */}
            <div className="bg-[#0c1220]/80 border border-white/[0.06] rounded-xl p-5">
              <div className="text-[9px] font-bold text-violet-400/60 tracking-[0.15em] uppercase mb-3">Royalty Range</div>
              <div className="font-mono text-2xl font-extrabold text-white tracking-tight mb-1">
                {royalties.base.low.toFixed(1)}–{royalties.highTier.high.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500 mb-3">
                Tiered: base / mid / high thresholds
              </div>
              <div className="flex gap-1">
                <div className="h-1.5 flex-1 bg-violet-500/30 rounded-full" />
                <div className="h-1.5 flex-1 bg-violet-500/50 rounded-full" />
                <div className="h-1.5 flex-1 bg-violet-500/70 rounded-full" />
              </div>
            </div>
          </div>

          {/* Milestone Breakdown */}
          <div className="bg-[#0c1220]/80 border border-white/[0.06] rounded-xl p-5">
            <div className="text-[9px] font-bold text-amber-400/60 tracking-[0.15em] uppercase mb-4">Milestone Structure</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="font-mono text-lg font-bold text-white">{formatCurrency(terms.devMilestones.median)}</div>
                <div className="text-[10px] text-slate-500">Development</div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-white">{formatCurrency(terms.regMilestones.median)}</div>
                <div className="text-[10px] text-slate-500">Regulatory</div>
              </div>
              <div>
                <div className="font-mono text-lg font-bold text-white">{formatCurrency(terms.commMilestones.median)}</div>
                <div className="text-[10px] text-slate-500">Commercial</div>
              </div>
            </div>
          </div>

          {/* Locked Sections */}
          <div className="bg-[#0c1220]/80 border border-teal-500/[0.08] rounded-xl p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-4 h-4 text-teal-400/50" />
              <span className="text-xs font-bold text-teal-400/70 tracking-wide">INCLUDED IN FULL REPORT</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {LOCKED_SECTIONS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300">{label}</div>
                    <div className="text-[10px] text-slate-600">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA — Stripe checkout */}
            <div className="pt-4 border-t border-white/[0.04]">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="group w-full inline-flex items-center justify-center gap-3 px-8 py-4.5 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-[#080c16] font-bold rounded-xl transition-all shadow-[0_0_50px_rgba(20,184,166,0.2)] hover:shadow-[0_0_70px_rgba(20,184,166,0.3)] text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Preparing checkout...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Unlock Full Report — {PRICING.REPORT_PRICE}
                    <ArrowUpRight className="w-4 h-4 opacity-60" />
                  </>
                )}
              </button>

              {checkoutError && (
                <p className="text-center text-xs text-red-400 mt-3">{checkoutError}</p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-[10px] text-slate-600">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Secure Stripe checkout</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  <span>Instant PDF + Excel</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>One-time payment</span>
                </div>
              </div>
            </div>
          </div>

          {/* Or explore free */}
          <div className="text-center pt-2">
            <a
              href={`/calculator?therapeuticArea=${ta}&phase=${phase}&dealType=${dealType}&modality=${modality}&indication=${indication}`}
              className="text-xs text-slate-600 hover:text-teal-400 transition-colors"
            >
              or explore these results in the full calculator &rarr;
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
