'use client';

import { CalculationResult, formatCurrency, formatRange } from '@/lib/calculations';
import { generatePDFReport } from '@/lib/generateReport';
import { useTracking } from './TrackingProvider';

interface ResultsProps {
  result: CalculationResult;
  tier?: 'free' | 'pro';
  onUpgrade?: () => void;
}

export default function Results({ result, tier = 'free', onUpgrade }: ResultsProps) {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels } = result;
  const isPro = tier === 'pro';
  const { trackProFeatureClick, trackExportAttempted, trackUpgradeCtaClick } = useTracking();

  const handleDownloadPDF = () => {
    trackExportAttempted('pdf');
    generatePDFReport(result);
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

  return (
    <div className="card-elevated overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-8 py-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
              </div>
              <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
              {isPro && (
                <span className="ml-2 px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                  PRO
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-white">Estimated Deal Terms</h3>
            <p className="text-neutral-400 mt-1 text-sm flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded-md text-xs">
                {labels.phase}
              </span>
              <span className="text-neutral-500">&bull;</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded-md text-xs">
                {labels.modality}
              </span>
              <span className="text-neutral-500">&bull;</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded-md text-xs">
                {labels.indication}
              </span>
            </p>
          </div>
          {isPro && (
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-8 bg-gradient-subtle">
        {/* Deal Structure Recommendation */}
        <div className="mb-6 p-5 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-navy-800 mb-1">Recommended Deal Structure</h4>
              <p className="text-lg font-semibold text-teal-700">
                {dealRecommendation.upfrontPercent}% Upfront / {dealRecommendation.milestonePercent}% Milestones
              </p>
              <p className="text-sm text-neutral-600 mt-1">{dealRecommendation.rationale}</p>
            </div>
          </div>
        </div>

        {/* Negotiation Insight - Pro Feature */}
        <div className="relative mb-6">
          <div className={`p-5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 ${!isPro ? 'blur-sm' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-amber-800 mb-1">Negotiation Insight</h4>
                <p className="text-sm text-amber-900">{negotiationInsight}</p>
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

        {/* Applied Modifiers */}
        {modifiers.length > 0 && (
          <div className="mb-6 p-5 bg-white rounded-xl border border-neutral-200 shadow-inner-soft">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-sm font-semibold text-neutral-700">Applied Adjustments</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {modifiers.map((mod, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    mod.multiplier > 1
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : mod.multiplier < 1
                      ? 'bg-warning-50 text-warning-700 border border-warning-200'
                      : 'bg-neutral-50 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {mod.multiplier > 1 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : mod.multiplier < 1 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  ) : null}
                  {mod.name}
                  {mod.multiplier !== 1 && (
                    <span className="font-bold">
                      ({mod.multiplier > 1 ? '+' : ''}{Math.round((mod.multiplier - 1) * 100)}%)
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deal Terms Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Upfront Payment */}
          <div className="group metric-card border-teal-200 hover:border-teal-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft group-hover:shadow-glow transition-all duration-300">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-teal-700">Upfront Payment</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-2 number-animate">
              {formatRange(terms.upfront)}
            </p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-neutral-500">
                Expected: <span className="font-bold text-teal-600">{formatCurrency(terms.upfront.median)}</span>
              </p>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${getBarWidth(terms.upfront.median, maxTotalValue)}%` }}
              />
            </div>
          </div>

          {/* Total Deal Value */}
          <div className="group metric-card border-success-200 hover:border-success-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success-500 to-success-400 flex items-center justify-center shadow-soft group-hover:shadow-soft-lg transition-all duration-300">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-success-700">Total Deal Value</p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-success-100 text-success-700">
                Potential
              </span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-2 number-animate">
              {formatRange(terms.totalDealValue)}
            </p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-neutral-500">
                Expected: <span className="font-bold text-success-600">{formatCurrency(terms.totalDealValue.median)}</span>
              </p>
            </div>
            <div className="progress-bar">
              <div
                className="h-full bg-gradient-to-r from-success-500 to-success-400 rounded-full transition-all duration-500"
                style={{ width: `${getBarWidth(terms.totalDealValue.median, maxTotalValue)}%` }}
              />
            </div>
          </div>

          {/* Development Milestones - Pro Feature */}
          <div className="relative">
            <div className={`group metric-card border-neutral-200 hover:border-teal-200 ${!isPro ? 'blur-sm' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center transition-colors group-hover:bg-cyan-100">
                  <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-neutral-700">Development Milestones</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mb-2">
                {formatRange(terms.devMilestones)}
              </p>
              <p className="text-sm text-neutral-500">
                Expected: <span className="font-bold text-neutral-700">{formatCurrency(terms.devMilestones.median)}</span>
              </p>
            </div>
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-2 bg-navy-800 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Regulatory Milestones - Pro Feature */}
          <div className="relative">
            <div className={`group metric-card border-neutral-200 hover:border-teal-200 ${!isPro ? 'blur-sm' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center transition-colors group-hover:bg-teal-100">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-neutral-700">Regulatory Milestones</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mb-2">
                {formatRange(terms.regMilestones)}
              </p>
              <p className="text-sm text-neutral-500">
                Expected: <span className="font-bold text-neutral-700">{formatCurrency(terms.regMilestones.median)}</span>
              </p>
            </div>
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-2 bg-navy-800 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Commercial Milestones - Pro Feature */}
          <div className="relative">
            <div className={`group metric-card border-neutral-200 hover:border-teal-200 ${!isPro ? 'blur-sm' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center transition-colors group-hover:bg-cyan-100">
                  <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-neutral-700">Commercial Milestones</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mb-2">
                {formatRange(terms.commMilestones)}
              </p>
              <p className="text-sm text-neutral-500">
                Expected: <span className="font-bold text-neutral-700">{formatCurrency(terms.commMilestones.median)}</span>
              </p>
            </div>
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-2 bg-navy-800 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Tiered Royalties - Pro Feature */}
          <div className="relative">
            <div className={`group metric-card border-neutral-200 hover:border-teal-200 ${!isPro ? 'blur-sm' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center transition-colors group-hover:bg-teal-100">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-neutral-700">Tiered Royalties</p>
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
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-2 bg-navy-800 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upgrade CTA for Free Users */}
        {!isPro && (
          <div className="mt-8 p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
            <h4 className="text-lg font-bold text-white mb-2">Unlock Full Analysis</h4>
            <p className="text-neutral-300 text-sm mb-4">
              Get milestone breakdowns, royalty tiers, negotiation insights, and downloadable PDF reports
            </p>
            <button
              onClick={handleUpgradeClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow"
            >
              <span>Upgrade to Pro - $99/month</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-neutral-100 rounded-xl border border-neutral-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-neutral-500 leading-relaxed">
              <strong className="text-neutral-600">Disclaimer:</strong> These estimates are based on publicly available deal data and 2025 market benchmarks.
              Actual deal terms vary significantly based on asset-specific factors, market conditions, competitive dynamics,
              and negotiation outcomes. This tool does not constitute financial or legal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
