'use client';

import { useState, useEffect } from 'react';
import {
  Phase,
  Modality,
  IndicationType,
  Territory,
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  phaseOptions,
  modalityOptions,
  indicationOptions,
  territoryOptions,
} from '@/lib/calculations';
import { canUseCalculator, incrementUsage, getRemainingUses, FREE_LIMIT } from '@/lib/usage';
import Results from './Results';
import EmailCapture from './EmailCapture';
import PaywallModal from './PaywallModal';

interface CalculatorProps {
  tier: 'free' | 'pro';
  onUpgrade: () => void;
}

export default function Calculator({ tier, onUpgrade }: CalculatorProps) {
  const [phase, setPhase] = useState<Phase>('phase2');
  const [modality, setModality] = useState<Modality>('smallMolecule');
  const [indicationType, setIndicationType] = useState<IndicationType>('lung');
  const [territory, setTerritory] = useState<Territory>('global');
  const [isFirstInClass, setIsFirstInClass] = useState(false);
  const [isBestInClass, setIsBestInClass] = useState(false);
  const [isCrowdedSpace, setIsCrowdedSpace] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'limit_reached' | 'pro_feature'>('limit_reached');
  const [remainingUses, setRemainingUses] = useState<number>(FREE_LIMIT);

  useEffect(() => {
    setRemainingUses(getRemainingUses(tier));
  }, [tier]);

  const handleCalculate = () => {
    // Check usage limits for free tier
    if (!canUseCalculator(tier)) {
      setPaywallReason('limit_reached');
      setShowPaywall(true);
      return;
    }

    setIsCalculating(true);
    // Simulate calculation delay for premium feel
    setTimeout(() => {
      const input: CalculationInput = {
        phase,
        modality,
        indicationType,
        territory,
        isFirstInClass,
        isBestInClass,
        isCrowdedSpace,
      };
      const calculatedResult = calculateDealTerms(input);
      setResult(calculatedResult);
      setIsCalculating(false);

      // Increment usage after successful calculation (only for free tier)
      if (tier === 'free') {
        incrementUsage();
        setRemainingUses(getRemainingUses(tier));
      }

      // Scroll to results
      setTimeout(() => {
        document.querySelector('.results-container')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }, 800);
  };

  const handleGetDetailedReport = () => {
    setShowEmailCapture(true);
  };

  return (
    <div id="calculator" className="w-full max-w-4xl mx-auto scroll-mt-24">
      <div className="card-elevated overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-8 py-8 overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>

          {/* Floating accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />

          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Deal Terms Calculator</h2>
                  <p className="text-neutral-400 text-sm mt-0.5">
                    Powered by public benchmark data
                  </p>
                </div>
              </div>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase transition-all duration-300 ${
              tier === 'pro'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-glow'
                : 'bg-navy-700 text-neutral-300 hover:bg-navy-600'
            }`}>
              {tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>

          {/* Progress steps */}
          <div className="relative mt-6 flex items-center justify-between max-w-md">
            {['Asset Details', 'Position', 'Results'].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  idx === 0 ? 'bg-teal-500 text-white' :
                  idx === 1 ? 'bg-teal-500/30 text-teal-300' :
                  'bg-navy-700 text-neutral-400'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-sm hidden sm:block ${idx === 0 ? 'text-teal-300' : 'text-neutral-400'}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="p-8 bg-gradient-subtle">
          {/* Step 1: Asset Details */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">1</span>
              Asset Details
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Phase Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700">
                  Development Phase
                </label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value as Phase)}
                  className="select-field"
                >
                  {phaseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">Select current development stage</p>
              </div>

              {/* Modality Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700">
                  Modality
                </label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as Modality)}
                  className="select-field"
                >
                  {modalityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">Type of therapeutic approach</p>
              </div>

              {/* Indication Type */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700">
                  Indication Type
                </label>
                <select
                  value={indicationType}
                  onChange={(e) => setIndicationType(e.target.value as IndicationType)}
                  className="select-field"
                >
                  {indicationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">Target cancer type affects deal valuation</p>
              </div>

              {/* Territory */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700">
                  Territory Rights
                </label>
                <select
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value as Territory)}
                  className="select-field"
                >
                  {territoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500">Geographic scope of the license</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 my-8" />

          {/* Step 2: Competitive Position */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500/30 text-teal-700 text-xs flex items-center justify-center">2</span>
              Competitive Position
            </h3>
            <p className="text-sm text-neutral-600 mb-4">Select factors that apply to your asset (optional)</p>
            <div className="flex flex-wrap gap-3">
              <label className={`group flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                isFirstInClass
                  ? 'border-teal-500 bg-teal-50 shadow-glow'
                  : 'border-neutral-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
              }`}>
                <input
                  type="checkbox"
                  checked={isFirstInClass}
                  onChange={(e) => {
                    setIsFirstInClass(e.target.checked);
                    if (e.target.checked) setIsBestInClass(false);
                  }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                  isFirstInClass ? 'bg-teal-500 border-teal-500' : 'border-neutral-300 group-hover:border-teal-400'
                }`}>
                  {isFirstInClass && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className={`text-sm font-semibold ${isFirstInClass ? 'text-teal-700' : 'text-neutral-700'}`}>
                    First-in-class
                  </span>
                  <p className="text-xs text-neutral-500">Novel mechanism of action</p>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
                  isFirstInClass ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  +20%
                </span>
              </label>

              <label className={`group flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                isBestInClass
                  ? 'border-teal-500 bg-teal-50 shadow-glow'
                  : 'border-neutral-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
              }`}>
                <input
                  type="checkbox"
                  checked={isBestInClass}
                  onChange={(e) => {
                    setIsBestInClass(e.target.checked);
                    if (e.target.checked) setIsFirstInClass(false);
                  }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                  isBestInClass ? 'bg-teal-500 border-teal-500' : 'border-neutral-300 group-hover:border-teal-400'
                }`}>
                  {isBestInClass && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className={`text-sm font-semibold ${isBestInClass ? 'text-teal-700' : 'text-neutral-700'}`}>
                    Best-in-class
                  </span>
                  <p className="text-xs text-neutral-500">Superior efficacy/safety</p>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
                  isBestInClass ? 'bg-teal-100 text-teal-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  +15%
                </span>
              </label>

              <label className={`group flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                isCrowdedSpace
                  ? 'border-warning-500 bg-warning-50'
                  : 'border-neutral-200 bg-white hover:border-warning-300 hover:bg-warning-50/50'
              }`}>
                <input
                  type="checkbox"
                  checked={isCrowdedSpace}
                  onChange={(e) => setIsCrowdedSpace(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                  isCrowdedSpace ? 'bg-warning-500 border-warning-500' : 'border-neutral-300 group-hover:border-warning-400'
                }`}>
                  {isCrowdedSpace && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className={`text-sm font-semibold ${isCrowdedSpace ? 'text-warning-700' : 'text-neutral-700'}`}>
                    Crowded space
                  </span>
                  <p className="text-xs text-neutral-500">Many competitors</p>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-1 rounded-full ${
                  isCrowdedSpace ? 'bg-warning-100 text-warning-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  -15%
                </span>
              </label>
            </div>
          </div>

          {/* Usage Counter for Free Tier */}
          {tier === 'free' && (
            <div className="mb-6 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-neutral-600">
                    <span className="font-semibold text-navy-800">{remainingUses}</span> of {FREE_LIMIT} free calculations remaining this month
                  </span>
                </div>
                {remainingUses === 0 && (
                  <button
                    onClick={() => {
                      setPaywallReason('limit_reached');
                      setShowPaywall(true);
                    }}
                    className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
              {remainingUses > 0 && remainingUses <= 1 && (
                <p className="text-xs text-warning-600 mt-2">
                  Running low on calculations? Upgrade to Pro for unlimited access.
                </p>
              )}
            </div>
          )}

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-4 px-6 rounded-xl
                     shadow-soft-lg hover:shadow-glow-lg transition-all duration-300
                     hover:from-teal-600 hover:to-cyan-600 hover:-translate-y-0.5
                     disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                     flex items-center justify-center gap-3 group"
          >
            {isCalculating ? (
              <>
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
                <span>Analyzing Market Data...</span>
              </>
            ) : (
              <>
                <span>Calculate Deal Terms</span>
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          {/* Helper text */}
          <p className="text-center text-xs text-neutral-500 mt-4">
            Free tier includes upfront payment and total deal value estimates
          </p>
        </div>
      </div>

      {result && (
        <div className="animate-fade-in results-container">
          <Results
            result={result}
            tier={tier}
            onUpgrade={onUpgrade}
            onGetDetailedReport={handleGetDetailedReport}
          />
        </div>
      )}

      {showEmailCapture && (
        <EmailCapture onClose={() => setShowEmailCapture(false)} />
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
      />
    </div>
  );
}
