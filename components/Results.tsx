'use client';

import { useState, useCallback, useRef, useMemo, useEffect, createRef } from 'react';
import dynamic from 'next/dynamic';
import { toast as sonnerToast } from 'sonner';
import { CalculationResult, CalculationInput, formatCurrency, formatRange, calculateRiskScore } from '@/lib/calculations';
import type { PartnerForPDF } from '@/lib/report';
import ReportGenerationModal from './ReportGenerationModal';
import ShareModal from './ShareModal';
import { useTracking } from './TrackingProvider';
import { PRICING } from '@/lib/config/constants';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import { staticBenchmarks as benchmarks } from '@/lib/benchmarks';
import { getHistory, formatDate as historyFormatDate } from '@/lib/history';
import type { CalculationHistoryItem } from '@/lib/history';

// Dynamic imports for heavy below-fold components
const SensitivityAnalysis = dynamic(() => import('./sensitivity').then(m => ({ default: m.SensitivityAnalysis })), { ssr: false });
const ChartSection = dynamic(() => import('./charts/ChartSection'), { ssr: false });
const ScenarioComparison = dynamic(() => import('./ScenarioComparison'), { ssr: false });
const NegotiationPlaybookModal = dynamic(() => import('./NegotiationPlaybookModal'), { ssr: false });
const PartnerMatchesContainer = dynamic(() => import('./PartnerMatchesContainer'), { ssr: false });
const ComparableDeals = dynamic(() => import('./ComparableDeals'), { ssr: false });
const HistoryPicker = dynamic(() => import('./results/HistoryPicker'), { ssr: false });
const ScenarioComparisonPanel = dynamic(() => import('./results/ScenarioComparison'), { ssr: false });
const MarketUrgency = dynamic(() => import('./results/MarketUrgency'), { ssr: false });
const PipelineIntelligence = dynamic(() => import('./results/PipelineIntelligence'), { ssr: false });

// Static type import (types are erased at runtime, safe alongside dynamic component import)
import type { PartnerMatchForPDF } from './PartnerMatchesContainer';
export type { PartnerMatchForPDF };

// Sub-components
import ResultsHeader from './results/ResultsHeader';
import InfoTooltip from './calculator/InfoTooltip';
import MetricCard from './results/MetricCard';
import DrillDownPanel from './results/DrillDownPanel';
import DealMemoSection from './results/DealMemoSection';
import ResultsDisclaimer from './results/ResultsDisclaimer';

interface ResultsProps {
  result: CalculationResult;
  tier?: 'free' | 'report' | 'pro';
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  reportId?: string;
  userId?: string;
  userEmail?: string;
  inputs?: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  };
  fullInputs?: CalculationInput;
  onApplyNewInputs?: (inputs: Partial<CalculationInput>) => void;
  onPartnerMatchesLoaded?: (matches: PartnerMatchForPDF[]) => void;
}

// Badge configuration for each metric
const metricBadges: Record<string, { label: string; color: string }> = {
  upfront: { label: 'Guaranteed', color: 'teal' },
  totalDealValue: { label: 'Potential', color: 'success' },
  devMilestones: { label: 'If Achieved', color: 'cyan' },
  regMilestones: { label: 'Upon Approval', color: 'teal' },
  commMilestones: { label: 'Sales-Based', color: 'cyan' },
  royalties: { label: 'On Net Sales', color: 'teal' }
};

const metricTooltips: Record<string, string> = {
  upfront: 'The guaranteed payment at deal signing, regardless of future milestones. Typically 20-40% of total deal value for Phase 2+ assets.',
  totalDealValue: 'Maximum potential value if all milestones are achieved and commercial targets met. Includes upfront, milestones, and estimated royalty value.',
  devMilestones: 'Payments triggered by clinical development progress: IND filing, Phase 1/2/3 initiation, and data readouts. Usually the largest milestone bucket.',
  regMilestones: 'Payments upon regulatory events: FDA/EMA submission, approval, and additional market authorizations. Typically 10-20% of total milestones.',
  commMilestones: 'Sales-based milestone payments triggered when cumulative net sales reach defined thresholds ($500M, $1B, etc.). Paid once per threshold.',
  royalties: 'Ongoing percentage of net sales paid to the licensor. Tiered rates increase at higher sales thresholds. Typically range from single-digit to low-twenties percent.',
};

// Helper to extract indication category from specific indication
function getIndicationCategory(indication: string): string | null {
  if (indication.startsWith('lung_') || indication.startsWith('breast_') ||
      indication.startsWith('colorectal') || indication.startsWith('pancreatic') ||
      indication.startsWith('gastric') || indication.startsWith('ovarian') ||
      indication.startsWith('prostate') || indication.startsWith('melanoma') ||
      indication.startsWith('rcc') || indication.startsWith('hcc') ||
      indication.startsWith('bladder') || indication.startsWith('head_neck') ||
      indication.startsWith('glioblastoma') || indication.startsWith('solid')) {
    return 'solid_tumor';
  }
  if (indication.startsWith('aml') || indication.startsWith('all') ||
      indication.startsWith('cll') || indication.startsWith('dlbcl') ||
      indication.startsWith('follicular') || indication.startsWith('myeloma') ||
      indication.startsWith('mds') || indication.startsWith('lymphoma') ||
      indication.startsWith('heme')) {
    return 'hematological';
  }
  if (indication.startsWith('ra_') || indication.startsWith('lupus') ||
      indication.startsWith('ibd') || indication.startsWith('psoriasis') ||
      indication.startsWith('ms_') || indication.startsWith('autoimmune')) {
    return 'autoimmune';
  }
  if (indication.startsWith('alzheimer') || indication.startsWith('parkinson') ||
      indication.startsWith('depression') || indication.startsWith('schizophrenia') ||
      indication.startsWith('pain') || indication.startsWith('cns')) {
    return 'cns';
  }
  if (indication.startsWith('rare_') || indication.startsWith('orphan')) {
    return 'rare_disease';
  }
  if (indication.startsWith('hiv') || indication.startsWith('hep') ||
      indication.startsWith('covid') || indication.startsWith('infectious')) {
    return 'infectious';
  }
  return null;
}

// Methodology Section component
function MethodologySection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-navy-50 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-navy-200 dark:border-slate-600 hover:border-navy-300 dark:hover:border-slate-500 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="font-semibold text-navy-800 dark:text-white">How We Calculate This</span>
        </div>
        <svg
          className={`w-5 h-5 text-navy-500 dark:text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 p-5 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-bold text-navy-800 dark:text-white">Powered by</span>
            <span className="text-lg font-bold text-teal-600 dark:text-teal-400">Ambrosia Ventures</span>
          </div>

          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 leading-relaxed">
            These estimates are generated using Ambrosia Ventures&apos; proprietary benchmarking model,
            developed from our team&apos;s deep expertise in life sciences M&A and licensing transactions.
          </p>

          <h5 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Our Model Analyzes</h5>
          <ul className="space-y-2 mb-4">
            {[
              'Publicly disclosed deal terms (SEC filings, press releases)',
              'Industry benchmark reports and market intelligence',
              'Recent transaction activity and emerging trends'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-slate-300">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 leading-relaxed">
            The algorithm weighs multiple factors including development phase, therapeutic modality,
            indication, territory scope, competitive landscape, and clinical data quality to generate
            customized ranges specific to your asset profile.
          </p>

          <div className="p-3 bg-amber-50 dark:bg-amber-500/20 rounded-lg border border-amber-200 dark:border-amber-500/30">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Important:</strong> These are illustrative estimates for planning purposes only.
              Actual deal terms vary significantly based on asset-specific factors, market conditions,
              negotiation dynamics, and factors not captured in this model. This does not constitute
              financial or legal advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header gradient skeleton */}
      <div className="rounded-2xl bg-gradient-to-r from-neutral-200 to-neutral-100 h-32" />

      {/* Deal structure bar skeleton */}
      <div className="h-12 bg-neutral-100 rounded-xl" />

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-neutral-100 rounded-xl p-5 space-y-3">
            <div className="h-3 bg-neutral-100 rounded w-2/3" />
            <div className="h-7 bg-neutral-200 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="bg-white border border-neutral-100 rounded-xl p-6">
        <div className="h-4 bg-neutral-100 rounded w-1/4 mb-4" />
        <div className="h-48 bg-neutral-50 rounded-lg" />
      </div>
    </div>
  );
}

export default function Results({ result, tier = 'free', onUpgrade, onBuyReport, reportId, userId, userEmail, inputs, fullInputs, onApplyNewInputs, onPartnerMatchesLoaded }: ResultsProps) {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels, drillDown } = result;
  const isPro = tier === 'pro';
  const isReport = tier === 'report';
  const hasFullAccess = isPro || isReport;
  const { trackProFeatureClick, trackExportAttempted, trackUpgradeCtaClick } = useTracking();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [partnerMatches, setPartnerMatches] = useState<PartnerForPDF[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [emailForResults, setEmailForResults] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [dealMemo, setDealMemo] = useState<DealMemo | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [compareItem, setCompareItem] = useState<CalculationHistoryItem | null>(null);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);

  // Track previous result values for sensitivity analysis delta badges
  const isFirstRenderRef = useRef(true);
  const [previousTerms, setPreviousTerms] = useState<{
    upfront: number;
    totalDealValue: number;
    devMilestones: number;
    regMilestones: number;
    commMilestones: number;
  } | null>(null);

  // Use a ref to always hold the "current" medians so we can capture them before they change
  const currentMediansRef = useRef({
    upfront: terms.upfront.median,
    totalDealValue: terms.totalDealValue.median,
    devMilestones: terms.devMilestones.median,
    regMilestones: terms.regMilestones.median,
    commMilestones: terms.commMilestones.median,
  });

  useEffect(() => {
    const prev = currentMediansRef.current;
    const curr = {
      upfront: terms.upfront.median,
      totalDealValue: terms.totalDealValue.median,
      devMilestones: terms.devMilestones.median,
      regMilestones: terms.regMilestones.median,
      commMilestones: terms.commMilestones.median,
    };

    // Only show delta when values actually changed (not first render)
    if (!isFirstRenderRef.current && (
      prev.upfront !== curr.upfront ||
      prev.totalDealValue !== curr.totalDealValue ||
      prev.devMilestones !== curr.devMilestones ||
      prev.regMilestones !== curr.regMilestones ||
      prev.commMilestones !== curr.commMilestones
    )) {
      setPreviousTerms({ ...prev });
    }

    // Update ref to current values
    currentMediansRef.current = curr;
    isFirstRenderRef.current = false;
  }, [terms]);

  // Check if there's calculation history for the Compare button
  useEffect(() => {
    const history = getHistory();
    setHasHistory(history.length > 0);
  }, []);

  // Auto-scroll to comparison panel when a compare item is selected
  useEffect(() => {
    if (compareItem && comparisonRef.current) {
      setTimeout(() => {
        comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [compareItem]);

  // Build compare label from history item
  const compareLabel = compareItem
    ? `${compareItem.labels.phase} ${compareItem.labels.modality} -- ${historyFormatDate(compareItem.timestamp)}`
    : '';

  // Compute context lines comparing metrics against phase baselines
  const contextLines = useMemo(() => {
    if (!fullInputs) return {};

    const ta = fullInputs.therapeuticArea;
    const phase = fullInputs.phase;

    // Pick the right baselines for the therapeutic area
    const baselines = ta === 'metabolic'
      ? benchmarks.metabolicPhaseBaselines[phase]
      : ta === 'immunology'
      ? benchmarks.immunologyPhaseBaselines[phase]
      : ta === 'neurology'
      ? benchmarks.neurologyPhaseBaselines[phase]
      : benchmarks.phaseBaselines[phase];

    if (!baselines) return {};

    const taLabel = ta === 'oncology' ? 'oncology'
      : ta === 'neurology' ? 'neurology'
      : ta === 'immunology' ? 'immunology'
      : 'metabolic';
    const phaseLabel = benchmarks.labels.phases[phase];

    function buildContextLine(actual: number, baseline: number, metricLabel: string): string {
      if (baseline === 0) return '';
      const pctDiff = Math.round(((actual - baseline) / baseline) * 100);
      if (Math.abs(pctDiff) <= 5) {
        return `In line with typical ${phaseLabel} ${taLabel} ${metricLabel}`;
      }
      const direction = pctDiff > 0 ? 'above' : 'below';
      return `${Math.abs(pctDiff)}% ${direction} ${phaseLabel} ${taLabel} median`;
    }

    return {
      totalDealValue: buildContextLine(terms.totalDealValue.median, baselines.totalValue.median, 'deal terms'),
      upfront: buildContextLine(terms.upfront.median, baselines.upfront.median, 'upfront'),
      devMilestones: '',
      regMilestones: '',
      commMilestones: '',
    };
  }, [fullInputs, terms]);

  // Copy results to clipboard
  const handleCopyResults = useCallback(() => {
    const taLabel = fullInputs?.therapeuticArea
      ? fullInputs.therapeuticArea.charAt(0).toUpperCase() + fullInputs.therapeuticArea.slice(1)
      : '';
    const text = [
      `${taLabel} | ${labels.phase} | ${labels.modality} | ${labels.indication}`,
      '',
      `Total Deal Value: ${formatCurrency(terms.totalDealValue.median)} (range: ${formatCurrency(terms.totalDealValue.low)} - ${formatCurrency(terms.totalDealValue.high)})`,
      `Upfront Payment: ${formatCurrency(terms.upfront.median)} (range: ${formatCurrency(terms.upfront.low)} - ${formatCurrency(terms.upfront.high)})`,
      `Development Milestones: ${formatCurrency(terms.devMilestones.median)} (range: ${formatCurrency(terms.devMilestones.low)} - ${formatCurrency(terms.devMilestones.high)})`,
      `Regulatory Milestones: ${formatCurrency(terms.regMilestones.median)} (range: ${formatCurrency(terms.regMilestones.low)} - ${formatCurrency(terms.regMilestones.high)})`,
      `Commercial Milestones: ${formatCurrency(terms.commMilestones.median)} (range: ${formatCurrency(terms.commMilestones.low)} - ${formatCurrency(terms.commMilestones.high)})`,
      `Royalties: ${tieredRoyalties.base.low}% - ${tieredRoyalties.highTier.high}%`,
      '',
      `Deal Structure: ${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones`,
      `Generated by Ambrosia Benchmarker`,
    ].join('\n');

    navigator.clipboard.writeText(text);
  }, [fullInputs, labels, terms, tieredRoyalties, dealRecommendation]);

  const handleGenerateMemo = useCallback(async () => {
    if (memoLoading || dealMemo) return;
    setMemoLoading(true);
    setMemoError(null);
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
      if (!response.ok) {
        throw new Error('Failed to generate memo');
      }
      const data = await response.json();
      setDealMemo(data.memo || data);
    } catch {
      setMemoError('Unable to generate memo. Please try again.');
      sonnerToast.error('Failed to generate deal memo');
    } finally {
      setMemoLoading(false);
    }
  }, [memoLoading, dealMemo, reportId, userId, userEmail, fullInputs, result, labels]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForResults || emailSubmitting) return;
    setEmailSubmitting(true);
    try {
      // Send to Formspree
      await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForResults,
          source: 'results_email_capture',
          analysis: `${labels.phase} ${labels.modality} ${labels.indication}`,
          upfront: `${formatCurrency(terms.upfront.low)} - ${formatCurrency(terms.upfront.high)}`,
          totalDealValue: `${formatCurrency(terms.totalDealValue.low)} - ${formatCurrency(terms.totalDealValue.high)}`,
        }),
      });
      // Also save to newsletter API
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForResults, source: 'results' }),
      }).catch(() => {});
      setEmailSubmitted(true);
      sessionStorage.setItem('email_captured', 'true');
      // If this was triggered by PDF gate, open report modal
      if (showEmailGate) {
        setShowEmailGate(false);
        setReportFormat('pdf');
        setShowReportModal(true);
      }
    } catch {
      // Still mark as submitted for UX
      setEmailSubmitted(true);
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleFreePDFClick = () => {
    if (sessionStorage.getItem('email_captured') || emailSubmitted) {
      trackExportAttempted('pdf');
      setReportFormat('pdf');
      setShowReportModal(true);
    } else {
      setShowEmailGate(true);
    }
  };

  const handleLinkedInShare = () => {
    const text = `${labels.phase} ${labels.modality} deals for ${labels.indication}: Upfront ${formatCurrency(terms.upfront.low)}-${formatCurrency(terms.upfront.high)}, Total value up to ${formatCurrency(terms.totalDealValue.high)}.\n\nBenchmark your deal terms: https://calculator.ambrosiaventures.co/calculator`;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://calculator.ambrosiaventures.co/calculator')}&summary=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=500');
  };

  const handleDownloadPDF = () => {
    trackExportAttempted('pdf');
    setReportFormat('pdf');
    setShowReportModal(true);
  };

  const handleDownloadExcel = () => {
    trackExportAttempted('excel');
    setReportFormat('excel');
    setShowReportModal(true);
  };

  const handleDownloadExecutiveSummary = useCallback(() => {
    if (!fullInputs || !result) return;

    import('@/lib/report').then(({ generateExecutiveSummaryPDF }) => {
      const pdfData = {
        result,
        inputs: fullInputs,
        riskScore: calculateRiskScore(fullInputs),
      };
      generateExecutiveSummaryPDF(pdfData as any);
    });
  }, [fullInputs, result]);

  const handlePartnerMatchesLoaded = (matches: PartnerMatchForPDF[]) => {
    setPartnerMatches(matches as PartnerForPDF[]);
    // Also notify parent component if callback provided
    onPartnerMatchesLoaded?.(matches);
  };

  const handleProFeatureClick = (feature: string) => {
    trackProFeatureClick(feature as 'export_excel' | 'export_pdf' | 'comparable_deals' | 'saved_scenarios' | 'team_sharing', 'results_section');
    onUpgrade?.();
  };

  const handleUpgradeClick = () => {
    trackUpgradeCtaClick('results_section');
    onUpgrade?.();
  };

  const getBarWidth = (median: number, max: number) => {
    return Math.min((median / max) * 100, 100);
  };

  const maxTotalValue = terms.totalDealValue.high;

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  // Determine if a card can be expanded (free users can only expand upfront)
  const canExpandCard = (cardId: string) => {
    if (hasFullAccess) return true;
    return cardId === 'upfront';
  };

  return (
    <div aria-live="polite" aria-label="Deal analysis results" className="card-elevated overflow-hidden animate-slide-up">
      {/* Header */}
      <ResultsHeader
        labels={labels}
        isPro={isPro}
        hasFullAccess={hasFullAccess}
        tier={tier}
        inputs={inputs}
        onDownloadPDF={handleDownloadPDF}
        onDownloadExcel={handleDownloadExcel}
        onFreePDFClick={handleFreePDFClick}
        onShare={() => setShowShareModal(true)}
        onLinkedInShare={handleLinkedInShare}
        onDownloadExecutiveSummary={handleDownloadExecutiveSummary}
        onCompare={() => setShowHistoryPicker(true)}
        hasHistory={hasHistory}
        onCopyResults={handleCopyResults}
      />

      {/* Email Capture Bar */}
      {!emailSubmitted && !sessionStorage?.getItem?.('email_captured') && (
        <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-teal-100 dark:border-teal-800">
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 max-w-xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">Email me my results</span>
            </div>
            <input
              type="email"
              value={emailForResults}
              onChange={(e) => setEmailForResults(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={emailSubmitting}
              className="px-4 py-1.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {emailSubmitting ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      )}
      {emailSubmitted && (
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800 text-center">
          <span className="text-sm text-teal-700 dark:text-teal-400 font-medium">Results sent! Check your inbox.</span>
        </div>
      )}

      {/* Email Gate Modal for Free PDF */}
      {showEmailGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEmailGate(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-xs sm:max-w-sm w-full p-4 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Download Your PDF Report</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Enter your email to receive the PDF and get weekly deal insights.</p>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={emailForResults}
                onChange={(e) => setEmailForResults(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={emailSubmitting}
                className="w-full py-2.5 text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50"
              >
                {emailSubmitting ? 'Processing...' : 'Get PDF Report'}
              </button>
            </form>
            <button onClick={() => setShowEmailGate(false)} className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-gradient-subtle">
        {/* Deal Structure Recommendation */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 xl:p-6 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-navy-800 mb-1 text-sm sm:text-base">Recommended Deal Structure</h4>
              <p className="text-base sm:text-lg font-semibold text-teal-700">
                {dealRecommendation.upfrontPercent}% Upfront / {dealRecommendation.milestonePercent}% Milestones
              </p>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1">{dealRecommendation.rationale}</p>
            </div>
          </div>
        </div>

        {/* Applied Modifiers - Horizontal scroll on mobile */}
        {modifiers.length > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 xl:p-6 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600 shadow-inner-soft">
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <svg className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-slate-200">Applied Adjustments</p>
              {modifiers.length > 2 && (
                <span className="sm:hidden text-xs text-neutral-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Scroll
                </span>
              )}
            </div>
            {/* Mobile: horizontal scroll, Desktop: wrap */}
            <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
              {modifiers.map((mod, idx) => (
                <div key={idx} className="group relative flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-help ${
                      mod.multiplier > 1
                        ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                        : mod.multiplier < 1
                        ? 'bg-warning-50 dark:bg-amber-500/20 text-warning-700 dark:text-amber-300 border border-warning-200 dark:border-amber-500/30'
                        : 'bg-neutral-50 dark:bg-slate-700 text-neutral-700 dark:text-slate-300 border border-neutral-200 dark:border-slate-600'
                    }`}
                  >
                    {mod.multiplier > 1 ? (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : mod.multiplier < 1 ? (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    ) : null}
                    <span className="whitespace-nowrap">{mod.name}</span>
                    {mod.multiplier !== 1 && (
                      <span className="font-bold whitespace-nowrap">
                        ({mod.multiplier > 1 ? '+' : ''}{Math.round((mod.multiplier - 1) * 100)}%)
                      </span>
                    )}
                  </span>
                  {/* Tooltip with context */}
                  {mod.context && (
                    <div className="invisible group-hover:visible sm:group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] shadow-xl min-w-[200px] max-w-[280px] text-center leading-relaxed whitespace-normal hidden sm:block">
                      {mod.context}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy-800" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable hint for free users */}
        {!hasFullAccess && (
          <div className="mb-4 flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click on Upfront Payment to see detailed breakdown. Get Full Report for complete analysis.</span>
          </div>
        )}

        {/* Deal Terms Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 xl:gap-6">
          {/* Upfront Payment */}
          <MetricCard
            title="Upfront Payment"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={formatRange(terms.upfront)}
            expected={formatCurrency(terms.upfront.median)}
            expectedColor="text-teal-600"
            badge={metricBadges.upfront.label}
            badgeColor={metricBadges.upfront.color}
            progressWidth={getBarWidth(terms.upfront.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-teal-500 to-cyan-500"
            drillDown={drillDown?.upfront}
            isExpanded={expandedCard === 'upfront'}
            onToggle={() => toggleCard('upfront')}
            canExpand={canExpandCard('upfront')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={0}
            tooltipContent={metricTooltips.upfront}
            contextLine={contextLines.upfront}
            previousValue={previousTerms?.upfront}
            currentValue={terms.upfront.median}
          />

          {/* Total Deal Value */}
          <MetricCard
            title="Total Deal Value"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            value={formatRange(terms.totalDealValue)}
            expected={formatCurrency(terms.totalDealValue.median)}
            expectedColor="text-success-600"
            badge={metricBadges.totalDealValue.label}
            badgeColor={metricBadges.totalDealValue.color}
            progressWidth={getBarWidth(terms.totalDealValue.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-success-500 to-success-400"
            drillDown={drillDown?.totalDealValue}
            isExpanded={expandedCard === 'totalDealValue'}
            onToggle={() => toggleCard('totalDealValue')}
            canExpand={canExpandCard('totalDealValue')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={1}
            tooltipContent={metricTooltips.totalDealValue}
            contextLine={contextLines.totalDealValue}
            previousValue={previousTerms?.totalDealValue}
            currentValue={terms.totalDealValue.median}
          />

          {/* Development Milestones */}
          <MetricCard
            title="Development Milestones"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            }
            value={formatRange(terms.devMilestones)}
            expected={formatCurrency(terms.devMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.devMilestones.label}
            badgeColor={metricBadges.devMilestones.color}
            progressWidth={getBarWidth(terms.devMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-cyan-500 to-cyan-400"
            drillDown={drillDown?.devMilestones}
            isExpanded={expandedCard === 'devMilestones'}
            onToggle={() => toggleCard('devMilestones')}
            canExpand={canExpandCard('devMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={2}
            tooltipContent={metricTooltips.devMilestones}
            previousValue={previousTerms?.devMilestones}
            currentValue={terms.devMilestones.median}
          />

          {/* Regulatory Milestones */}
          <MetricCard
            title="Regulatory Milestones"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            value={formatRange(terms.regMilestones)}
            expected={formatCurrency(terms.regMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.regMilestones.label}
            badgeColor={metricBadges.regMilestones.color}
            progressWidth={getBarWidth(terms.regMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-teal-500 to-teal-400"
            drillDown={drillDown?.regMilestones}
            isExpanded={expandedCard === 'regMilestones'}
            onToggle={() => toggleCard('regMilestones')}
            canExpand={canExpandCard('regMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={3}
            tooltipContent={metricTooltips.regMilestones}
            previousValue={previousTerms?.regMilestones}
            currentValue={terms.regMilestones.median}
          />

          {/* Commercial Milestones */}
          <MetricCard
            title="Commercial Milestones"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            value={formatRange(terms.commMilestones)}
            expected={formatCurrency(terms.commMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.commMilestones.label}
            badgeColor={metricBadges.commMilestones.color}
            progressWidth={getBarWidth(terms.commMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-cyan-500 to-cyan-400"
            drillDown={drillDown?.commMilestones}
            isExpanded={expandedCard === 'commMilestones'}
            onToggle={() => toggleCard('commMilestones')}
            canExpand={canExpandCard('commMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={4}
            tooltipContent={metricTooltips.commMilestones}
            previousValue={previousTerms?.commMilestones}
            currentValue={terms.commMilestones.median}
          />

          {/* Tiered Royalties */}
          <div
            className={`group metric-card border-neutral-200 dark:border-slate-600 hover:border-teal-200 dark:hover:border-teal-500/50 transition-all duration-300 ${expandedCard === 'royalties' ? 'ring-2 ring-teal-200 dark:ring-teal-500/50' : ''} motion-safe:animate-metric-cascade`}
            style={{ animationDelay: '500ms' }}
          >
            <div
              className={canExpandCard('royalties') ? 'cursor-pointer' : ''}
              onClick={() => {
                if (canExpandCard('royalties')) {
                  toggleCard('royalties');
                } else {
                  handleProFeatureClick('comparable_deals');
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-teal-50 dark:bg-teal-500/20 flex items-center justify-center transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-500/30">
                    <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-slate-200 truncate">
                    Tiered Royalties
                    <InfoTooltip content={metricTooltips.royalties} />
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                    {metricBadges.royalties.label}
                  </span>
                  {canExpandCard('royalties') ? (
                    <svg
                      className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${expandedCard === 'royalties' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <div className="p-1 bg-navy-100 dark:bg-slate-600 rounded">
                      <svg className="w-3 h-3 text-navy-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">Base (&lt;$500M)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.base.low}% - {tieredRoyalties.base.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">Mid ($500M-$1B)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.midTier.low}% - {tieredRoyalties.midTier.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">High (&gt;$1B)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.highTier.low}% - {tieredRoyalties.highTier.high}%</span>
                </div>
              </div>
            </div>

            {/* Drill-down panel for royalties */}
            {expandedCard === 'royalties' && drillDown?.royalties && (
              <DrillDownPanel data={drillDown.royalties} isRoyalty={true} />
            )}
          </div>
        </div>

        {/* Interactive Charts Section */}
        <ChartSection
          terms={terms}
          tieredRoyalties={tieredRoyalties}
          modifiers={modifiers}
          isPro={hasFullAccess}
          onUpgrade={onUpgrade}
        />

        {/* Market Urgency - Patent Cliff Signal */}
        {partnerMatches.length > 0 && (
          <MarketUrgency
            partnerMatches={partnerMatches}
            therapeuticArea={fullInputs?.therapeuticArea}
            isPro={hasFullAccess}
            onUpgrade={onUpgrade}
            onBuyReport={onBuyReport}
          />
        )}

        {/* Therapeutic Area Milestone Explanation */}
        {result.milestoneExplanation && (
          <div className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl">
            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fullInputs?.therapeuticArea === 'immunology' ? 'Why Immunology Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'metabolic' ? 'Why Metabolic/Obesity Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'oncology' ? 'Why Oncology Deal Structures Differ'
                : 'Why Neurology Deal Structures Differ'}
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-300 leading-relaxed">
              {result.milestoneExplanation}
            </p>
          </div>
        )}

        {/* Sensitivity Analysis */}
        {fullInputs && onApplyNewInputs && (
          <SensitivityAnalysis
            currentInputs={fullInputs}
            currentResult={result}
            onApplyChanges={onApplyNewInputs}
            tier={tier}
            onUpgrade={onUpgrade}
            onBuyReport={onBuyReport}
          />
        )}

        {/* Comparable Deals */}
        {fullInputs && (
          <ComparableDeals inputs={fullInputs} tier={tier} onBuyReport={onBuyReport} />
        )}

        {/* Pipeline Intelligence — Clinical Trials */}
        {fullInputs && (
          <PipelineIntelligence
            therapeuticArea={fullInputs.therapeuticArea}
            modality={fullInputs.modality}
            tier={tier}
            onUpgrade={onUpgrade}
            onBuyReport={onBuyReport}
          />
        )}

        {/* AI Deal Memo */}
        <DealMemoSection
          hasFullAccess={hasFullAccess}
          dealMemo={dealMemo}
          memoLoading={memoLoading}
          memoError={memoError}
          onGenerateMemo={handleGenerateMemo}
          onBuyReport={onBuyReport}
        />

        {/* Partner Matches */}
        {inputs && (
          <div className="mb-4 sm:mb-6">
            <PartnerMatchesContainer
              modality={inputs.modality}
              phase={inputs.phase}
              indicationCategory={getIndicationCategory(inputs.indication)}
              indicationSpecific={inputs.indication}
              territory={inputs.territory}
              therapeuticArea={fullInputs?.therapeuticArea}
              tier={tier}
              onUpgrade={onUpgrade || (() => {})}
              onMatchesLoaded={handlePartnerMatchesLoaded}
            />
          </div>
        )}

        {/* Negotiation Insight - Pro Feature */}
        <div className="relative mb-4 sm:mb-6">
          <div className={`p-3 sm:p-4 lg:p-5 xl:p-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 ${!hasFullAccess ? 'blur-sm' : ''}`}>
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-amber-800 mb-1 text-sm sm:text-base">Negotiation Insight</h4>
                <p className="text-xs sm:text-sm text-amber-900">{negotiationInsight}</p>
              </div>
            </div>
          </div>
          {!hasFullAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : handleProFeatureClick('comparable_deals')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Full Analysis
              </button>
            </div>
          )}
        </div>

        {/* Negotiation Playbook CTA */}
        <div className="relative mt-6 sm:mt-8">
          <div className={`p-4 sm:p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl ${!hasFullAccess ? 'blur-sm pointer-events-none' : ''}`}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-lg font-bold text-white mb-1">AI-Powered Negotiation Playbook</h4>
                <p className="text-neutral-300 text-sm">
                  Get strategic talking points tailored to your asset profile and market position
                </p>
              </div>
              <button
                onClick={() => setShowPlaybookModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow whitespace-nowrap"
              >
                Generate Playbook
              </button>
            </div>
          </div>
          {!hasFullAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : handleProFeatureClick('negotiation_playbook')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Full Analysis
              </button>
            </div>
          )}
        </div>

        {/* Scenario Comparison (Pro/Report) */}
        {hasFullAccess && (
          <ScenarioComparison
            currentResult={result}
            currentInputs={inputs}
            currentLabels={labels}
          />
        )}

        {/* Compare with Previous - History-based comparison */}
        <div ref={comparisonRef}>
          {compareItem && (
            <ScenarioComparisonPanel
              currentResult={result}
              compareItem={compareItem}
              compareLabel={compareLabel}
              onClose={() => setCompareItem(null)}
            />
          )}
        </div>

        {/* History Picker Modal */}
        {showHistoryPicker && (
          <HistoryPicker
            onSelect={(item) => {
              setCompareItem(item);
              setShowHistoryPicker(false);
            }}
            onClose={() => setShowHistoryPicker(false)}
          />
        )}

        {/* Share Modal */}
        {inputs && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            inputs={inputs}
            results={result}
            labels={labels}
          />
        )}

        {/* Negotiation Playbook Modal */}
        {inputs && (
          <NegotiationPlaybookModal
            isOpen={showPlaybookModal}
            onClose={() => setShowPlaybookModal(false)}
            inputs={{ ...inputs, therapeuticArea: fullInputs?.therapeuticArea }}
            results={result}
            labels={labels}
            userId={userId}
            userEmail={userEmail}
            reportId={reportId}
          />
        )}

        {/* Report Generation Modal */}
        {fullInputs && (
          <ReportGenerationModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            result={result}
            fullInputs={fullInputs}
            partnerMatches={partnerMatches}
            existingMemo={dealMemo}
            reportId={reportId}
            userId={userId}
            userEmail={userEmail}
            labels={labels}
            onMemoGenerated={(memo) => setDealMemo(memo)}
            onDownloadComplete={() => setToast({ message: 'Report downloaded successfully', type: 'success' })}
            format={reportFormat}
          />
        )}

        {/* Success Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 left-4 sm:left-auto z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl shadow-2xl max-w-sm ${toast ? 'animate-toast-in' : 'animate-toast-out'}`}
            role="status"
            onAnimationEnd={() => {
              setTimeout(() => setToast(null), 3000);
            }}
          >
            <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5L6.5 12L13 4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-neutral-800 dark:text-white">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Upgrade CTA for Free Users */}
        {!hasFullAccess && (
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
            <h4 className="text-base sm:text-lg font-bold text-white mb-2">Unlock Full Analysis</h4>
            <p className="text-neutral-300 text-xs sm:text-sm mb-4 sm:mb-5 max-w-md mx-auto">
              AI deal memo, full comparable deals, sensitivity analysis, negotiation playbook, and board-ready PDF
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onBuyReport?.()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-white text-navy-900 text-sm font-semibold rounded-xl hover:bg-neutral-100 transition-all shadow-soft w-full sm:w-auto"
              >
                <span>Get Full Report — {PRICING.REPORT_PRICE}</span>
              </button>
              <span className="text-neutral-500 text-xs">or</span>
              <button
                onClick={handleUpgradeClick}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow w-full sm:w-auto"
              >
                <span>Go Pro — {PRICING.PRO_MONTHLY}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Methodology Section */}
        <MethodologySection />

        {/* Data Freshness Indicator */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Benchmarks last updated{' '}
            {(() => {
              const [y, m] = (benchmarks.metadata.lastUpdated as string).split('-');
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
            })()}
            {' '}&middot;{' '}Deal data refreshed daily via SEC EDGAR
          </p>
        </div>

        {/* World-Class Disclaimer */}
        <ResultsDisclaimer />
      </div>
    </div>
  );
}
