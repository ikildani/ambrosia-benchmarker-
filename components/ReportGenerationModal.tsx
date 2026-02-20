'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CalculationResult, CalculationInput, calculateRiskScore } from '@/lib/calculations';
import { computeSensitivityAnalysis } from '@/lib/sensitivity';
import { findComparableDeals } from '@/lib/comparableDeals';
import { generateReportHTML } from '@/lib/report';
import { generateExcelReport, PartnerForExcel } from '@/lib/generateExcel';
import type { PDFReportData, PartnerForPDF } from '@/lib/report';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';

type ModalStep = 'idle' | 'analyzing' | 'generating_memo' | 'compiling' | 'building' | 'ready' | 'downloading' | 'success' | 'error';

interface StepDef {
  id: ModalStep;
  label: string;
  sublabel: string;
}

const PDF_STEPS: StepDef[] = [
  { id: 'analyzing', label: 'Analyzing asset profile', sublabel: 'Sensitivity, risk factors & comparable deals' },
  { id: 'generating_memo', label: 'Generating AI deal memo', sublabel: 'Powered by Ambrosia AI' },
  { id: 'compiling', label: 'Compiling visualizations', sublabel: 'Charts, gauges & data tables' },
  { id: 'building', label: 'Building your report', sublabel: '10-page consulting-grade analysis' },
];

const EXCEL_STEPS: StepDef[] = [
  { id: 'analyzing', label: 'Analyzing asset profile', sublabel: 'Sensitivity & comparable deals' },
  { id: 'building', label: 'Building Excel workbook', sublabel: '6-sheet structured analysis' },
];

interface ReportGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: CalculationResult;
  fullInputs: CalculationInput;
  partnerMatches: PartnerForPDF[];
  existingMemo: DealMemo | null;
  reportId?: string;
  userId?: string;
  userEmail?: string;
  labels: { phase: string; modality: string; indication: string };
  onMemoGenerated: (memo: DealMemo) => void;
  onDownloadComplete: () => void;
  format: 'pdf' | 'excel';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function StepIcon({ status }: { status: 'pending' | 'active' | 'done' }) {
  if (status === 'done') {
    return (
      <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center animate-step-check flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5L6.5 12L13 4" className="animate-draw-check" />
        </svg>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="w-7 h-7 relative flex-shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-teal-200 dark:border-teal-800" />
        <div className="absolute inset-0 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-7 h-7 rounded-full border-2 border-neutral-200 dark:border-slate-700 flex-shrink-0" />
  );
}

export default function ReportGenerationModal({
  isOpen,
  onClose,
  result,
  fullInputs,
  partnerMatches,
  existingMemo,
  reportId,
  userId,
  userEmail,
  labels,
  onMemoGenerated,
  onDownloadComplete,
  format,
}: ReportGenerationModalProps) {
  const [currentStep, setCurrentStep] = useState<ModalStep>('idle');
  const [completedSteps, setCompletedSteps] = useState<Set<ModalStep>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canSkipMemo, setCanSkipMemo] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);

  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const pdfBlobRef = useRef<Blob | null>(null);
  const pdfDataRef = useRef<PDFReportData | null>(null);
  const abortRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const steps = format === 'pdf' ? PDF_STEPS : EXCEL_STEPS;

  const getStepStatus = (stepId: ModalStep): 'pending' | 'active' | 'done' => {
    if (completedSteps.has(stepId)) return 'done';
    if (currentStep === stepId) return 'active';
    return 'pending';
  };

  const markComplete = useCallback((stepId: ModalStep) => {
    setCompletedSteps(prev => new Set(prev).add(stepId));
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('idle');
      setCompletedSteps(new Set());
      setErrorMessage(null);
      setCanSkipMemo(false);
      setFileSize(null);
      pdfBlobRef.current = null;
      pdfDataRef.current = null;
      abortRef.current = false;
      previousActiveElement.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 100);
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Run the generation pipeline when modal opens
  useEffect(() => {
    if (!isOpen || currentStep !== 'idle') return;

    const run = async () => {
      try {
        // Step 1: Analyzing
        setCurrentStep('analyzing');
        const sensitivityData = computeSensitivityAnalysis(fullInputs, result);
        const riskScore = calculateRiskScore(fullInputs);
        const comparableDeals = findComparableDeals({
          therapeuticArea: fullInputs.therapeuticArea,
          modality: fullInputs.modality,
          indication: fullInputs.indication,
          phase: fullInputs.phase,
        }, 6);
        await delay(800);
        if (abortRef.current) return;
        markComplete('analyzing');

        if (format === 'excel') {
          // Excel: skip memo/compiling, go straight to building
          setCurrentStep('building');
          const partnersForExcel: PartnerForExcel[] = partnerMatches.map(p => ({
            company_name: p.company_name,
            match_score: p.match_score,
            match_reasons: p.match_reasons,
            deals_last_12mo: p.deals_last_12mo,
            hq_country: p.hq_country,
          }));
          await generateExcelReport(
            result,
            { modality: fullInputs.modality, phase: fullInputs.phase, indication: fullInputs.indication, territory: fullInputs.territory },
            partnersForExcel,
            fullInputs.therapeuticArea,
            fullInputs.treatmentApproach,
            sensitivityData
          );
          if (abortRef.current) return;
          markComplete('building');
          setCurrentStep('success');
          onDownloadComplete();
          await delay(1500);
          if (!abortRef.current) onClose();
          return;
        }

        // Step 2: Generate AI memo (PDF only)
        setCurrentStep('generating_memo');
        let memo = existingMemo;
        if (!memo) {
          try {
            const response = await fetch('/api/deal-memo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reportId: reportId || undefined,
                userId: userId || undefined,
                email: userEmail || undefined,
                inputs: fullInputs,
                results: result,
                labels: { phase: labels.phase, modality: labels.modality, indication: labels.indication },
              }),
            });
            if (response.ok) {
              const data = await response.json();
              memo = data.memo || data;
              onMemoGenerated(memo as DealMemo);
            } else {
              setCanSkipMemo(true);
            }
          } catch {
            setCanSkipMemo(true);
          }
        }
        if (abortRef.current) return;
        markComplete('generating_memo');

        // Step 3: Compile visualizations
        setCurrentStep('compiling');
        const pdfData: PDFReportData = {
          result,
          inputs: fullInputs,
          sensitivityData,
          riskScore,
          partnerMatches: partnerMatches.length > 0 ? partnerMatches : undefined,
          memoData: memo || undefined,
          comparableDeals,
        };
        pdfDataRef.current = pdfData;

        // Render HTML into hidden container
        const html = generateReportHTML(pdfData);
        if (hiddenContainerRef.current) {
          hiddenContainerRef.current.innerHTML = html;
        }
        await delay(600);
        if (abortRef.current) return;
        markComplete('compiling');

        // Step 4: Build PDF via html2pdf.js
        setCurrentStep('building');
        try {
          const html2pdf = (await import('html2pdf.js')).default;
          const blob: Blob = await html2pdf()
            .set({
              margin: 0,
              filename: `Ambrosia-Deal-Report-${labels.indication.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, useCORS: true, logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: ['css', 'legacy'] },
            })
            .from(hiddenContainerRef.current!)
            .outputPdf('blob');

          pdfBlobRef.current = blob;
          const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
          setFileSize(`${sizeMB} MB`);
        } catch (err) {
          console.error('PDF generation failed:', err);
          setErrorMessage('Failed to build PDF. Please try again.');
          setCurrentStep('error');
          return;
        }
        if (abortRef.current) return;
        markComplete('building');
        setCurrentStep('ready');
      } catch (err) {
        console.error('Report generation failed:', err);
        if (!abortRef.current) {
          setErrorMessage('Something went wrong. Please try again.');
          setCurrentStep('error');
        }
      }
    };

    // Kick off on next tick to avoid React strict mode double-fire
    const timer = setTimeout(run, 50);
    return () => {
      clearTimeout(timer);
      abortRef.current = true;
    };
  }, [isOpen, currentStep, format, fullInputs, result, partnerMatches, existingMemo, reportId, userId, userEmail, labels, markComplete, onMemoGenerated, onDownloadComplete, onClose]);

  const handleDownload = useCallback(() => {
    if (!pdfBlobRef.current) return;
    setCurrentStep('downloading');

    const url = URL.createObjectURL(pdfBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ambrosia-Deal-Report-${labels.indication.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setCurrentStep('success');
    onDownloadComplete();
    setTimeout(() => {
      if (!abortRef.current) onClose();
    }, 1500);
  }, [labels.indication, onDownloadComplete, onClose]);

  const handleSkipMemo = useCallback(() => {
    setCanSkipMemo(false);
    markComplete('generating_memo');
    // Continue the pipeline from compiling step
    setCurrentStep('compiling');
  }, [markComplete]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        abortRef.current = true;
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isProcessing = !['ready', 'success', 'error', 'idle'].includes(currentStep);

  return (
    <>
      {/* Hidden render container for html2pdf */}
      <div
        ref={hiddenContainerRef}
        style={{ position: 'fixed', left: '-9999px', top: 0, width: '210mm', zIndex: -1 }}
        aria-hidden="true"
      />

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
          onClick={() => {
            if (!isProcessing) {
              abortRef.current = true;
              onClose();
            }
          }}
        />

        {/* Modal card */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-slide-up overflow-hidden outline-none"
          role="dialog"
          aria-modal="true"
          aria-label="Report generation"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft">
                  {format === 'pdf' ? (
                    <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {currentStep === 'success' ? 'Report Downloaded' : currentStep === 'ready' ? 'Your Report is Ready' : 'Preparing Your Report'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-navy-100 dark:bg-navy-800 text-navy-600 dark:text-navy-300 rounded font-medium">{labels.phase}</span>
                    <span className="text-xs text-neutral-300 dark:text-slate-600">&bull;</span>
                    <span className="text-xs px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded font-medium">{labels.modality}</span>
                    <span className="text-xs text-neutral-300 dark:text-slate-600">&bull;</span>
                    <span className="text-xs text-neutral-500 dark:text-slate-400 font-medium truncate max-w-[120px]">{labels.indication}</span>
                  </div>
                </div>
              </div>
              {!isProcessing && (
                <button
                  onClick={() => {
                    abortRef.current = true;
                    onClose();
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-200 dark:bg-slate-700" />

          {/* Steps */}
          <div className="px-6 py-5">
            <div className="space-y-4">
              {steps.map((step, i) => {
                const status = getStepStatus(step.id);
                return (
                  <div
                    key={step.id}
                    className="flex items-start gap-3.5 animate-step-fade-in"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <StepIcon status={status} />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className={`text-sm font-semibold transition-colors duration-300 ${
                        status === 'done' ? 'text-teal-600 dark:text-teal-400' :
                        status === 'active' ? 'text-neutral-900 dark:text-white' :
                        'text-neutral-400 dark:text-slate-500'
                      }`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                        status === 'active' ? 'text-neutral-500 dark:text-slate-400 animate-progress-pulse' :
                        'text-neutral-400 dark:text-slate-600'
                      }`}>
                        {step.sublabel}
                      </p>
                      {/* Memo error with skip option */}
                      {step.id === 'generating_memo' && canSkipMemo && status === 'active' && (
                        <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-400">Memo generation encountered an issue.</p>
                          <button
                            onClick={handleSkipMemo}
                            className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline"
                          >
                            Skip memo, continue anyway
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Success state */}
            {currentStep === 'success' && (
              <div className="mt-5 flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg animate-step-fade-in">
                <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0 animate-step-check">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5L6.5 12L13 4" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                  {format === 'pdf' ? 'PDF report saved to your downloads' : 'Excel workbook saved to your downloads'}
                </p>
              </div>
            )}

            {/* Error state */}
            {currentStep === 'error' && errorMessage && (
              <div className="mt-5 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-step-fade-in">
                <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
                <button
                  onClick={() => {
                    setCurrentStep('idle');
                    setCompletedSteps(new Set());
                    setErrorMessage(null);
                  }}
                  className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Footer with download button */}
          {currentStep === 'ready' && format === 'pdf' && (
            <>
              <div className="h-px bg-neutral-200 dark:bg-slate-700" />
              <div className="px-6 py-5">
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all duration-200 animate-download-glow text-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF Report
                </button>
                {fileSize && (
                  <p className="text-xs text-neutral-400 dark:text-slate-500 text-center mt-2.5">
                    PDF &middot; {fileSize} &middot; 10 pages
                  </p>
                )}
              </div>
            </>
          )}

          {/* Processing indicator bar */}
          {isProcessing && (
            <div className="h-1 bg-neutral-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 animate-progress-pulse" style={{ width: `${((completedSteps.size) / steps.length) * 100}%`, transition: 'width 0.5s ease-out' }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
