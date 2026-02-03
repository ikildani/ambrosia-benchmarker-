'use client';

import { useState } from 'react';
import { CalculationResult, formatCurrency, formatRange, DrillDownData, MilestoneBreakdown } from '@/lib/calculations';
import { generatePDFReport, PartnerForPDF } from '@/lib/generateReport';
import { generateExcelReport, PartnerForExcel } from '@/lib/generateExcel';
import BenchmarkInfo from './BenchmarkInfo';
import ChartSection from './charts/ChartSection';
import ScenarioComparison from './ScenarioComparison';
import ShareModal from './ShareModal';
import { useTracking } from './TrackingProvider';
import PartnerMatchesContainer, { PartnerMatchForPDF } from './PartnerMatchesContainer';

interface ResultsProps {
  result: CalculationResult;
  tier?: 'free' | 'pro';
  onUpgrade?: () => void;
  inputs?: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  };
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

// Drill-down panel component
function DrillDownPanel({
  data,
  isRoyalty = false
}: {
  data: DrillDownData;
  isRoyalty?: boolean;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-neutral-200 animate-fade-in">
      {/* Why This Range */}
      <div className="mb-4">
        <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Why This Range?</h5>
        <p className="text-sm text-neutral-600 leading-relaxed">{data.rangeExplanation}</p>
      </div>

      {/* Breakdown Table */}
      {data.breakdown && data.breakdown.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            {isRoyalty ? 'Royalty Tiers' : 'Breakdown'}
          </h5>
          <div className="bg-neutral-50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="text-left py-2 px-3 font-medium text-neutral-600">Component</th>
                  <th className="text-center py-2 px-3 font-medium text-neutral-600">
                    {isRoyalty ? 'Rate' : 'Share'}
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-600">
                    {isRoyalty ? 'Range' : 'Value'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((item, idx) => (
                  <tr key={idx} className="border-t border-neutral-200">
                    <td className="py-2 px-3 text-neutral-700">{item.label}</td>
                    <td className="py-2 px-3 text-center text-neutral-600">
                      {isRoyalty ? `${item.value.low}% - ${item.value.high}%` : `${item.percentage}%`}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-neutral-800">
                      {isRoyalty
                        ? `${item.value.low}% - ${item.value.high}%`
                        : `${formatCurrency(item.value.low)} - ${formatCurrency(item.value.high)}`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Key Factors */}
      {data.factors && data.factors.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Key Factors</h5>
          <div className="space-y-1.5">
            {data.factors.slice(0, 5).map((factor, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {factor.impact === 'positive' ? (
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : factor.impact === 'negative' ? (
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  </div>
                )}
                <span className={factor.impact === 'positive' ? 'text-teal-700' : factor.impact === 'negative' ? 'text-amber-700' : 'text-neutral-600'}>
                  {factor.name}
                  {factor.percentage !== 0 && (
                    <span className="font-semibold ml-1">
                      ({factor.percentage > 0 ? '+' : ''}{factor.percentage}%)
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Expandable Metric Card component
function MetricCard({
  title,
  icon,
  value,
  expected,
  expectedColor,
  badge,
  badgeColor,
  progressWidth,
  progressColor,
  drillDown,
  isExpanded,
  onToggle,
  canExpand,
  isPro,
  onProClick
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  expected: string;
  expectedColor: string;
  badge: string;
  badgeColor: string;
  progressWidth: number;
  progressColor: string;
  drillDown?: DrillDownData;
  isExpanded: boolean;
  onToggle: () => void;
  canExpand: boolean;
  isPro: boolean;
  onProClick: () => void;
}) {
  const badgeColorClasses: Record<string, string> = {
    teal: 'bg-teal-100 text-teal-700',
    success: 'bg-success-100 text-success-700',
    cyan: 'bg-cyan-100 text-cyan-700'
  };

  const iconBgClasses: Record<string, string> = {
    teal: 'bg-gradient-to-br from-teal-500 to-cyan-500',
    success: 'bg-gradient-to-br from-success-500 to-success-400',
    cyan: 'bg-cyan-50 group-hover:bg-cyan-100'
  };

  const iconTextClasses: Record<string, string> = {
    teal: 'text-white',
    success: 'text-white',
    cyan: 'text-cyan-600'
  };

  return (
    <div
      className={`group metric-card border-neutral-200 hover:border-teal-200 transition-all duration-300 ${isExpanded ? 'ring-2 ring-teal-200' : ''}`}
    >
      <div
        className={`${canExpand ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (canExpand) {
            onToggle();
          } else if (!isPro) {
            onProClick();
          }
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${iconBgClasses[badgeColor] || iconBgClasses.teal} flex items-center justify-center shadow-soft group-hover:shadow-glow transition-all duration-300`}>
              <div className={iconTextClasses[badgeColor] || iconTextClasses.teal}>
                {icon}
              </div>
            </div>
            <p className="text-sm font-semibold text-neutral-700">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeColorClasses[badgeColor] || badgeColorClasses.teal}`}>
              {badge}
            </span>
            {canExpand && (
              <svg
                className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            {!canExpand && !isPro && (
              <div className="p-1 bg-navy-100 rounded">
                <svg className="w-3 h-3 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2 number-animate">
          {value}
        </p>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-neutral-500">
            Expected: <span className={`font-bold ${expectedColor}`}>{expected}</span>
          </p>
        </div>
        <div className="progress-bar">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>

      {/* Drill-down panel */}
      {isExpanded && drillDown && (
        <DrillDownPanel data={drillDown} />
      )}
    </div>
  );
}

// Methodology Section component
function MethodologySection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-navy-50 to-slate-50 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-navy-200 dark:border-slate-700 hover:border-navy-300 dark:hover:border-slate-600 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="font-semibold text-navy-800">How We Calculate This</span>
        </div>
        <svg
          className={`w-5 h-5 text-navy-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 p-5 bg-white rounded-xl border border-neutral-200 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-bold text-navy-800">Powered by</span>
            <span className="text-lg font-bold text-teal-600">Ambrosia Ventures</span>
          </div>

          <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
            These estimates are generated using Ambrosia Ventures&apos; proprietary benchmarking model,
            developed from our team&apos;s deep expertise in life sciences M&A and licensing transactions.
          </p>

          <h5 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Our Model Analyzes</h5>
          <ul className="space-y-2 mb-4">
            {[
              'Publicly disclosed deal terms (SEC filings, press releases)',
              'Industry benchmark reports and market intelligence',
              'Recent transaction activity and emerging trends'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-neutral-600">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-sm text-neutral-600 mb-4 leading-relaxed">
            The algorithm weighs multiple factors including development phase, therapeutic modality,
            indication, territory scope, competitive landscape, and clinical data quality to generate
            customized ranges specific to your asset profile.
          </p>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-800">
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

export default function Results({ result, tier = 'free', onUpgrade, inputs, onPartnerMatchesLoaded }: ResultsProps) {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels, drillDown } = result;
  const isPro = tier === 'pro';
  const { trackProFeatureClick, trackExportAttempted, trackUpgradeCtaClick } = useTracking();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [partnerMatches, setPartnerMatches] = useState<PartnerForPDF[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleDownloadPDF = () => {
    trackExportAttempted('pdf');
    generatePDFReport(result, undefined, partnerMatches);
  };

  const handleDownloadExcel = () => {
    trackExportAttempted('excel');
    const partnersForExcel: PartnerForExcel[] = partnerMatches.map(p => ({
      company_name: p.company_name,
      match_score: p.match_score,
      match_reasons: p.match_reasons,
      deals_last_12mo: p.deals_last_12mo,
      hq_country: p.hq_country,
    }));
    generateExcelReport(result, inputs, partnersForExcel);
  };

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
    if (isPro) return true;
    return cardId === 'upfront';
  };

  return (
    <div className="card-elevated overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400" />
                <div className="absolute inset-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400 animate-ping" />
              </div>
              <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
              {isPro && (
                <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                  PRO
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white">Estimated Deal Terms</h3>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 text-neutral-400 text-xs sm:text-sm">
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[100px] sm:max-w-none">
                {labels.phase}
              </span>
              <span className="text-neutral-500 hidden sm:inline">&bull;</span>
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[100px] sm:max-w-none">
                {labels.modality}
              </span>
              <span className="text-neutral-500 hidden sm:inline">&bull;</span>
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[100px] sm:max-w-none">
                {labels.indication}
              </span>
              <span className="text-neutral-500 hidden sm:inline">&bull;</span>
              <BenchmarkInfo />
            </div>
          </div>
          {isPro && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>PDF</span>
              </button>
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-100 text-sm font-medium rounded-xl transition-all duration-200 border border-teal-400/30 hover:border-teal-400/50 w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Excel</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 text-sm font-medium rounded-xl transition-all duration-200 border border-cyan-400/30 hover:border-cyan-400/50 w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 bg-gradient-subtle">
        {/* Deal Structure Recommendation */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-teal-200 dark:border-slate-700">
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

        {/* Negotiation Insight - Pro Feature */}
        <div className="relative mb-4 sm:mb-6">
          <div className={`p-3 sm:p-4 lg:p-5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-amber-200 dark:border-slate-700 ${!isPro ? 'blur-sm' : ''}`}>
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
          {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
              <button
                onClick={() => handleProFeatureClick('comparable_deals')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock with Pro
              </button>
            </div>
          )}
        </div>

        {/* Applied Modifiers - Horizontal scroll on mobile */}
        {modifiers.length > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 bg-white rounded-xl border border-neutral-200 shadow-inner-soft">
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-xs sm:text-sm font-semibold text-neutral-700">Applied Adjustments</p>
              {modifiers.length > 2 && (
                <span className="sm:hidden text-xs text-neutral-400 ml-auto flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Scroll
                </span>
              )}
            </div>
            {/* Mobile: horizontal scroll, Desktop: wrap */}
            <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0 pt-12 -mt-12">
              {modifiers.map((mod, idx) => (
                <div key={idx} className="group relative flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-help ${
                      mod.multiplier > 1
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : mod.multiplier < 1
                        ? 'bg-warning-50 text-warning-700 border border-warning-200'
                        : 'bg-neutral-50 text-neutral-700 border border-neutral-200'
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
                    <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] shadow-xl min-w-[200px] max-w-[280px] text-center leading-relaxed whitespace-normal">
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
        {!isPro && (
          <div className="mb-4 flex items-center gap-2 text-xs text-neutral-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click on Upfront Payment to see detailed breakdown. Upgrade to Pro for full analysis.</span>
          </div>
        )}

        {/* Deal Terms Grid */}
        <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
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
          />

          {/* Tiered Royalties */}
          <div className={`group metric-card border-neutral-200 hover:border-teal-200 transition-all duration-300 ${expandedCard === 'royalties' ? 'ring-2 ring-teal-200' : ''}`}>
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center transition-colors group-hover:bg-teal-100">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700">Tiered Royalties</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-teal-100 text-teal-700">
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
                    <div className="p-1 bg-navy-100 rounded">
                      <svg className="w-3 h-3 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Base (&lt;$500M)</span>
                  <span className="font-bold text-neutral-900">{tieredRoyalties.base.low}% - {tieredRoyalties.base.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Mid ($500M-$1B)</span>
                  <span className="font-bold text-neutral-900">{tieredRoyalties.midTier.low}% - {tieredRoyalties.midTier.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">High (&gt;$1B)</span>
                  <span className="font-bold text-neutral-900">{tieredRoyalties.highTier.low}% - {tieredRoyalties.highTier.high}%</span>
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
          isPro={isPro}
          onUpgrade={onUpgrade}
        />

        {/* Scenario Comparison (Pro only) */}
        {isPro && (
          <ScenarioComparison
            currentResult={result}
            currentInputs={inputs}
            currentLabels={labels}
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

        {/* Upgrade CTA for Free Users */}
        {!isPro && (
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
            <h4 className="text-base sm:text-lg font-bold text-white mb-2">Unlock Full Analysis</h4>
            <p className="text-neutral-300 text-xs sm:text-sm mb-3 sm:mb-4 max-w-md mx-auto">
              Get detailed breakdowns for all metrics, negotiation insights, and downloadable PDF reports
            </p>
            <button
              onClick={handleUpgradeClick}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm sm:text-base font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow w-full sm:w-auto"
            >
              <span>Upgrade to Pro - $99/month</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}

        {/* Partner Matches */}
        {inputs && (
          <PartnerMatchesContainer
            modality={inputs.modality}
            phase={inputs.phase}
            indicationCategory={getIndicationCategory(inputs.indication)}
            indicationSpecific={inputs.indication}
            territory={inputs.territory}
            tier={tier}
            onUpgrade={onUpgrade || (() => {})}
            onMatchesLoaded={handlePartnerMatchesLoaded}
          />
        )}

        {/* Methodology Section */}
        <MethodologySection />

        {/* World-Class Disclaimer */}
        <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-br from-slate-100 to-neutral-100 dark:from-slate-800 dark:to-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Important Disclaimer</h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-2">
                <strong className="text-slate-600">For Informational Purposes Only:</strong> These estimates are generated
                using publicly available deal data, industry benchmarks, and algorithmic models. They are intended solely
                for educational and planning purposes.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mb-2">
                <strong className="text-slate-600">Not Professional Advice:</strong> This tool does not constitute financial,
                legal, investment, or professional advice of any kind. Actual deal terms can vary significantly (often by
                50% or more) based on asset-specific factors, competitive dynamics, market conditions, negotiation leverage,
                and numerous other variables not captured by this model.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-600">Consult Professionals:</strong> Before making any business decisions,
                consult qualified financial advisors, legal counsel, and industry experts familiar with your specific situation.
                <a href="/terms" className="text-teal-600 hover:text-teal-700 ml-1 underline">Terms</a>
                {' '}&bull;{' '}
                <a href="/privacy" className="text-teal-600 hover:text-teal-700 underline">Privacy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
