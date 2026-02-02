'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CalculationHistoryItem, formatDate, getHistoryItemWithDefaults } from '@/lib/history';
import {
  calculateDealTerms,
  CalculationInput,
  CalculationResult,
  Phase, Modality, Indication, Territory,
  BiomarkerStatus, LineOfTherapy, CombinationPotential,
  CompetitivePosition, DataQuality
} from '@/lib/calculations';
import { generatePDFReport, PartnerForPDF } from '@/lib/generateReport';
import Results from './Results';
import { PartnerMatchForPDF } from './PartnerMatchesContainer';

interface HistoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CalculationHistoryItem | null;
  tier: 'free' | 'pro';
  onReuse?: (item: CalculationHistoryItem) => void;
  onUpgrade?: () => void;
}

export default function HistoryDetailModal({
  isOpen,
  onClose,
  item,
  tier,
  onReuse,
  onUpgrade
}: HistoryDetailModalProps) {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [partnerMatches, setPartnerMatches] = useState<PartnerForPDF[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isPro = tier === 'pro';

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250); // Match animation duration
  }, [onClose]);

  const handlePartnerMatchesLoaded = useCallback((matches: PartnerMatchForPDF[]) => {
    setPartnerMatches(matches as PartnerForPDF[]);
  }, []);

  // Recalculate when item changes
  useEffect(() => {
    if (item && isOpen) {
      setIsCalculating(true);

      // Apply defaults for legacy items
      const itemWithDefaults = getHistoryItemWithDefaults(item);

      // Build full input from stored data
      const input: CalculationInput = {
        phase: itemWithDefaults.inputs.phase as Phase,
        modality: itemWithDefaults.inputs.modality as Modality,
        indication: itemWithDefaults.inputs.indication as Indication,
        territory: itemWithDefaults.inputs.territory as Territory,
        biomarker: itemWithDefaults.inputs.biomarker as BiomarkerStatus,
        lineOfTherapy: itemWithDefaults.inputs.lineOfTherapy as LineOfTherapy,
        combinationPotential: itemWithDefaults.inputs.combinationPotential as CombinationPotential,
        competitivePosition: itemWithDefaults.inputs.competitivePosition as CompetitivePosition,
        dataQuality: itemWithDefaults.inputs.dataQuality as DataQuality,
        regulatoryDesignations: itemWithDefaults.inputs.regulatoryDesignations!,
      };

      // Slight delay for animation smoothness
      const timer = setTimeout(() => {
        const calculated = calculateDealTerms(input);
        setResult(calculated);
        setIsCalculating(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [item, isOpen]);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      // Focus the close button when modal opens
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, handleClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const handleReuse = useCallback(() => {
    if (item && onReuse) {
      onReuse(getHistoryItemWithDefaults(item));
    }
  }, [item, onReuse]);

  const handleDownloadPDF = useCallback(() => {
    if (result) {
      generatePDFReport(result, item?.id, partnerMatches);
    }
  }, [result, item, partnerMatches]);

  if (!isOpen || !item) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value}M`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-250 ${
          isClosing ? 'opacity-0' : 'animate-backdrop-fade'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-full sm:max-w-4xl sm:mx-4 max-h-[90vh] bg-white
                   rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden
                   transition-all duration-250 ${
                     isClosing
                       ? 'opacity-0 translate-y-8 sm:translate-y-4 scale-95'
                       : 'animate-modal-slide-up'
                   }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-6 overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl" />

          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center
                       rounded-full bg-white/10 hover:bg-white/20 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-white/50"
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
        <div className="overflow-y-auto max-h-[calc(90vh-220px)] p-6">
          {/* Quick Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl border border-teal-200/50">
              <p className="text-xs text-teal-600 font-medium mb-1">Phase</p>
              <p className="text-sm font-semibold text-teal-800 truncate">{item.labels.phase}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-xl border border-cyan-200/50">
              <p className="text-xs text-cyan-600 font-medium mb-1">Modality</p>
              <p className="text-sm font-semibold text-cyan-800 truncate">{item.labels.modality}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200/50">
              <p className="text-xs text-blue-600 font-medium mb-1">Indication</p>
              <p className="text-sm font-semibold text-blue-800 truncate">{item.labels.indication}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl border border-indigo-200/50">
              <p className="text-xs text-indigo-600 font-medium mb-1">Total Value</p>
              <p className="text-sm font-semibold text-indigo-800">{formatCurrency(item.results.totalValueMedian)}</p>
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
                onPartnerMatchesLoaded={handlePartnerMatchesLoaded}
              />
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReuse}
            className="flex-1 inline-flex items-center justify-center gap-2
                       px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-500
                       text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20
                       hover:from-teal-500 hover:to-cyan-400 hover:shadow-xl hover:-translate-y-0.5
                       transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Use These Inputs
          </button>

          {isPro && result && (
            <button
              onClick={handleDownloadPDF}
              className="flex-1 inline-flex items-center justify-center gap-2
                         px-4 py-3 bg-white border border-slate-200
                         text-slate-700 font-semibold rounded-xl
                         hover:bg-slate-50 hover:border-slate-300
                         transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          )}

          <button
            onClick={onClose}
            className="sm:hidden inline-flex items-center justify-center gap-2
                       px-4 py-3 bg-slate-100 text-slate-600 font-medium rounded-xl
                       hover:bg-slate-200 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
