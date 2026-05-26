'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CalculationHistoryItem, formatDate, getHistoryItemWithDefaults } from '@/lib/history';
import {
  calculateDealTerms,
  CalculationInput,
  CalculationResult,
  Phase, Modality, Indication, Territory,
  BiomarkerStatus, LineOfTherapy, TreatmentApproach, CombinationPotential,
  CompetitivePosition, DataQuality, TherapeuticArea
} from '@/lib/calculations';
import { generatePDFReport, PartnerForPDF } from '@/lib/report';
import type { PDFReportData } from '@/lib/report';
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import epiData from '@/data/epidemiology.json';
import { computeSensitivityAnalysis } from '@/lib/sensitivity';
import { calculateRiskScore } from '@/lib/calculations';
import { findComparableDeals } from '@/lib/comparableDeals';
import Results from './Results';
import { PartnerMatchForPDF } from './PartnerMatchesContainer';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { UserTier } from '@/types/tier';

interface HistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CalculationHistoryItem | null;
  tier: UserTier;
  onReuse?: (item: CalculationHistoryItem) => void;
  onUpgrade?: () => void;
  userEmail?: string;
}

export default function HistoryDetailModal({
  isOpen,
  onClose,
  item,
  tier,
  onReuse,
  onUpgrade,
  userEmail
}: HistoryDetailModalProps) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [partnerMatches, setPartnerMatches] = useState<PartnerForPDF[]>([]);
  const [fullInputs, setFullInputs] = useState<CalculationInput | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);
  const isPro = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  // Simple close handler
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePartnerMatchesLoaded = useCallback((matches: PartnerMatchForPDF[]) => {
    setPartnerMatches(matches as PartnerForPDF[]);
  }, []);

  // Handle sensitivity analysis changes - recalculate with new inputs
  const handleSensitivityApply = useCallback((newInputs: Partial<CalculationInput>) => {
    if (!fullInputs) return;

    // Merge new inputs with existing
    const updatedInputs: CalculationInput = {
      ...fullInputs,
      ...newInputs,
    };

    setFullInputs(updatedInputs);
    setIsCalculating(true);

    // Recalculate with updated inputs
    setTimeout(() => {
      const calculated = calculateDealTerms(updatedInputs);
      setResult(calculated);
      setIsCalculating(false);
    }, 100);
  }, [fullInputs]);

  // Recalculate when item changes
  useEffect(() => {
    if (item && isOpen) {
      setIsCalculating(true);

      // Apply defaults for legacy items
      const itemWithDefaults = getHistoryItemWithDefaults(item);

      // Build full input from stored data
      const input: CalculationInput = {
        therapeuticArea: (itemWithDefaults.inputs.therapeuticArea as TherapeuticArea) || 'oncology',
        phase: itemWithDefaults.inputs.phase as Phase,
        modality: itemWithDefaults.inputs.modality as Modality,
        indication: itemWithDefaults.inputs.indication as Indication,
        territory: itemWithDefaults.inputs.territory as Territory,
        biomarker: itemWithDefaults.inputs.biomarker as BiomarkerStatus,
        lineOfTherapy: itemWithDefaults.inputs.lineOfTherapy as LineOfTherapy,
        treatmentApproach: (itemWithDefaults.inputs.treatmentApproach as TreatmentApproach) || 'symptomatic',
        combinationPotential: itemWithDefaults.inputs.combinationPotential as CombinationPotential,
        competitivePosition: itemWithDefaults.inputs.competitivePosition as CompetitivePosition,
        dataQuality: itemWithDefaults.inputs.dataQuality as DataQuality,
        regulatoryDesignations: itemWithDefaults.inputs.regulatoryDesignations!,
      };

      // Store full inputs for sensitivity analysis
      setFullInputs(input);

      // Slight delay for animation smoothness
      const timer = setTimeout(() => {
        const calculated = calculateDealTerms(input);
        setResult(calculated);
        setIsCalculating(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [item, isOpen]);



  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);


  const handleReuse = useCallback(() => {
    if (item && onReuse) {
      onReuse(getHistoryItemWithDefaults(item));
    }
  }, [item, onReuse]);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (result && fullInputs) {
      setIsGeneratingPDF(true);
      try {
        const sensitivityData = computeSensitivityAnalysis(fullInputs, result);
        const riskScore = calculateRiskScore(fullInputs);
        const comparableDeals = findComparableDeals({
          therapeuticArea: fullInputs.therapeuticArea,
          modality: fullInputs.modality,
          indication: fullInputs.indication,
          phase: fullInputs.phase,
        }, 6);

        // Fetch deal memo with auth
        let memoData;
        if (userEmail) {
          try {
            const response = await fetch('/api/deal-memo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                inputs: fullInputs,
                results: result,
                labels: {
                  phase: item?.labels?.phase || '',
                  modality: item?.labels?.modality || '',
                  indication: item?.labels?.indication || '',
                },
              }),
            });
            if (response.ok) {
              const data = await response.json();
              memoData = data.memo;
            }
          } catch {
            // Proceed without memo
          }
        }

        // Run financial modeling pipeline for report
        const fm = runFinancialModel(fullInputs, result, epiData.indications);
        const pdfData: PDFReportData = {
          result,
          inputs: fullInputs,
          sensitivityData,
          riskScore,
          partnerMatches: partnerMatches.length > 0 ? partnerMatches : undefined,
          memoData,
          comparableDeals,
          historyId: item?.id,
          rnpvResult: fm.rnpv,
          monteCarloResult: fm.monteCarlo,
          marketSizeEstimate: fm.marketSize ?? undefined,
          scenarioResults: fm.scenarios,
          fxSensitivity: fm.fxSensitivity,
          defensiveAnalysis: fm.defensiveAnalysis,
        };
        generatePDFReport(pdfData);
      } finally {
        setIsGeneratingPDF(false);
      }
    }
  }, [result, item, partnerMatches, fullInputs, userEmail]);

  if (!isOpen || !item) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value}M`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-backdrop-fade"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full sm:max-w-6xl sm:mx-4 max-h-[90vh] bg-white dark:bg-slate-900
                   rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-modal-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-6 py-5 sm:py-6 overflow-hidden">
          {/* Decorative elements - pointer-events-none so they don't block clicks */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-12 h-12 flex items-center justify-center
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              </div>
              <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">
                Historical Calculation
              </span>
              {item.hasPDF && (
                <span className="ml-2 px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                  PDF Generated
                </span>
              )}
            </div>
            <h2 id="modal-title" className="text-xl font-bold text-white">
              Calculation Details
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {formatDate(item.timestamp)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain max-h-[calc(90vh-220px)] p-4 sm:p-6">
          {/* Quick Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-slate-700 dark:to-slate-700 rounded-xl border border-teal-200/50 dark:border-slate-600 overflow-hidden">
              <p className="text-[10px] sm:text-xs text-teal-600 dark:text-teal-400 font-medium mb-0.5 sm:mb-1">Phase</p>
              <p className="text-xs sm:text-sm font-semibold text-teal-800 dark:text-teal-300 truncate">{item.labels.phase}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-slate-700 dark:to-slate-700 rounded-xl border border-cyan-200/50 dark:border-slate-600 overflow-hidden">
              <p className="text-[10px] sm:text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-0.5 sm:mb-1">Modality</p>
              <p className="text-xs sm:text-sm font-semibold text-cyan-800 dark:text-cyan-300 truncate">{item.labels.modality}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-slate-700 dark:to-slate-700 rounded-xl border border-blue-200/50 dark:border-slate-600 overflow-hidden">
              <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium mb-0.5 sm:mb-1">Indication</p>
              <p className="text-xs sm:text-sm font-semibold text-blue-800 dark:text-blue-300 truncate">{item.labels.indication}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-slate-700 dark:to-slate-700 rounded-xl border border-indigo-200/50 dark:border-slate-600 overflow-hidden">
              <p className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-0.5 sm:mb-1">Total Value</p>
              <p className="text-xs sm:text-sm font-semibold text-indigo-800 dark:text-indigo-300">{formatCurrency(item.results.totalValueMedian)}</p>
            </div>
          </div>

          {/* Results */}
          {isCalculating ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-teal-200 rounded-full" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="mt-4 text-slate-500 text-sm">Recalculating results...</p>
            </div>
          ) : result && item ? (
            <div className="animate-fade-in">
              <Results
                result={result}
                tier={tier}
                onUpgrade={onUpgrade}
                inputs={{
                  modality: item.inputs.modality,
                  phase: item.inputs.phase,
                  indication: item.inputs.indication,
                  territory: item.inputs.territory
                }}
                fullInputs={fullInputs || undefined}
                onApplyNewInputs={handleSensitivityApply}
                onPartnerMatchesLoaded={handlePartnerMatchesLoaded}
              />
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800 flex flex-col sm:flex-row gap-2 sm:gap-3 safe-bottom">
          <button
            onClick={handleReuse}
            className="flex-1 inline-flex items-center justify-center gap-2
                       px-4 py-3.5 sm:py-3 bg-gradient-to-r from-teal-600 to-cyan-500
                       text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20
                       hover:from-teal-500 hover:to-cyan-400 hover:shadow-xl sm:hover:-translate-y-0.5
                       transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
                       active:scale-[0.98] touch-feedback"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="truncate">Use These Inputs</span>
          </button>

          {isPro && result && (
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex-1 inline-flex items-center justify-center gap-2
                         px-4 py-3.5 sm:py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600
                         text-slate-700 dark:text-slate-200 font-semibold rounded-xl
                         hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500
                         transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2
                         active:scale-[0.98] touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin flex-shrink-0" />
                  <span className="truncate">Preparing Report...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="truncate">Download PDF</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="sm:hidden inline-flex items-center justify-center gap-2
                       px-4 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl
                       hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200
                       active:scale-[0.98] touch-feedback"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
