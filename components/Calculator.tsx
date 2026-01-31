'use client';

import { useState } from 'react';
import {
  Phase,
  Modality,
  IndicationType,
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  phaseOptions,
  modalityOptions,
  indicationOptions,
} from '@/lib/calculations';
import Results from './Results';
import EmailCapture from './EmailCapture';

interface CalculatorProps {
  tier: 'free' | 'pro';
  onUpgrade: () => void;
}

export default function Calculator({ tier, onUpgrade }: CalculatorProps) {
  const [phase, setPhase] = useState<Phase>('phase2');
  const [modality, setModality] = useState<Modality>('smallMolecule');
  const [indicationType, setIndicationType] = useState<IndicationType>('solidTumor_common');
  const [isFirstInClass, setIsFirstInClass] = useState(false);
  const [isBestInClass, setIsBestInClass] = useState(false);
  const [isCrowdedSpace, setIsCrowdedSpace] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = () => {
    setIsCalculating(true);
    // Simulate calculation delay for premium feel
    setTimeout(() => {
      const input: CalculationInput = {
        phase,
        modality,
        indicationType,
        isFirstInClass,
        isBestInClass,
        isCrowdedSpace,
      };
      const calculatedResult = calculateDealTerms(input);
      setResult(calculatedResult);
      setIsCalculating(false);
    }, 600);
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

          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Deal Terms Calculator</h2>
              </div>
              <p className="text-neutral-400 max-w-md">
                Get data-driven estimates for oncology licensing deal terms based on public benchmarks
              </p>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
              tier === 'pro'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-glow'
                : 'bg-navy-700 text-neutral-300'
            }`}>
              {tier === 'pro' ? 'Pro' : 'Free'}
            </span>
          </div>
        </div>

        {/* Form */}
        <div className="p-8 bg-gradient-subtle">
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
            </div>

            {/* Indication Type */}
            <div className="md:col-span-2 space-y-2">
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
            </div>

            {/* Competitive Position */}
            <div className="md:col-span-2 space-y-3">
              <label className="block text-sm font-semibold text-neutral-700">
                Competitive Position
              </label>
              <div className="flex flex-wrap gap-3">
                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  isFirstInClass
                    ? 'border-teal-500 bg-teal-50 shadow-glow'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={isFirstInClass}
                    onChange={(e) => {
                      setIsFirstInClass(e.target.checked);
                      if (e.target.checked) setIsBestInClass(false);
                    }}
                    className="w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className={`text-sm font-medium ${isFirstInClass ? 'text-teal-700' : 'text-neutral-700'}`}>
                    First-in-class
                  </span>
                </label>

                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  isBestInClass
                    ? 'border-teal-500 bg-teal-50 shadow-glow'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={isBestInClass}
                    onChange={(e) => {
                      setIsBestInClass(e.target.checked);
                      if (e.target.checked) setIsFirstInClass(false);
                    }}
                    className="w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className={`text-sm font-medium ${isBestInClass ? 'text-teal-700' : 'text-neutral-700'}`}>
                    Best-in-class
                  </span>
                </label>

                <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  isCrowdedSpace
                    ? 'border-warning-500 bg-warning-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={isCrowdedSpace}
                    onChange={(e) => setIsCrowdedSpace(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-warning-600 focus:ring-warning-500"
                  />
                  <span className={`text-sm font-medium ${isCrowdedSpace ? 'text-warning-700' : 'text-neutral-700'}`}>
                    Crowded space
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="mt-8 w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-4 px-6 rounded-xl
                     shadow-soft-lg hover:shadow-glow-lg transition-all duration-300
                     hover:from-teal-600 hover:to-cyan-600 hover:-translate-y-0.5
                     disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                     flex items-center justify-center gap-3"
          >
            {isCalculating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Analyzing Market Data...</span>
              </>
            ) : (
              <>
                <span>Calculate Deal Terms</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className="animate-fade-in">
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
    </div>
  );
}
