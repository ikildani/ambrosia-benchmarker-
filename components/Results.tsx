'use client';

import { CalculationResult, formatCurrency, formatRange } from '@/lib/calculations';
import { generatePDFReport } from '@/lib/generateReport';

interface ResultsProps {
  result: CalculationResult;
  tier: 'free' | 'pro';
  onUpgrade: () => void;
  onGetDetailedReport: () => void;
}

export default function Results({ result, tier, onUpgrade, onGetDetailedReport }: ResultsProps) {
  const { terms, modifiers, labels } = result;
  const isPro = tier === 'pro';

  const handleDownloadReport = () => {
    generatePDFReport(result);
  };

  // Calculate visual bar width for metrics (normalized to median values)
  const getBarWidth = (median: number, max: number) => {
    return Math.min((median / max) * 100, 100);
  };

  const maxTotalValue = terms.totalDealValue.high;

  return (
    <div className="mt-8 card-elevated overflow-hidden animate-slide-up">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-8 py-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }} />
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
              </div>
              <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
            </div>
            <h3 className="text-xl font-bold text-white">Estimated Deal Terms</h3>
            <p className="text-neutral-400 mt-1 text-sm flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded-md text-xs">
                {labels.phase}
              </span>
              <span className="text-neutral-500">&bull;</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded-md text-xs">
                {labels.modality}
              </span>
            </p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
            isPro ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-glow' : 'bg-navy-700 text-neutral-300'
          }`}>
            {isPro ? 'Pro Analysis' : 'Free'}
          </span>
        </div>
      </div>

      <div className="p-8 bg-gradient-subtle">
        {/* Applied Modifiers */}
        {modifiers.length > 0 && (
          <div className="mb-8 p-5 bg-white rounded-xl border border-neutral-200 shadow-inner-soft">
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
                      : 'bg-warning-50 text-warning-700 border border-warning-200'
                  }`}
                >
                  {mod.multiplier > 1 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {mod.name}
                  <span className="font-bold">
                    ({mod.multiplier > 1 ? '+' : ''}{Math.round((mod.multiplier - 1) * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deal Terms Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Upfront Payment - Always visible */}
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
                Median: <span className="font-bold text-teal-600">{formatCurrency(terms.upfront.median)}</span>
              </p>
            </div>
            {/* Visual bar */}
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${getBarWidth(terms.upfront.median, maxTotalValue)}%` }}
              />
            </div>
          </div>

          {/* Total Deal Value - Always visible */}
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
                Median: <span className="font-bold text-success-600">{formatCurrency(terms.totalDealValue.median)}</span>
              </p>
            </div>
            {/* Visual bar */}
            <div className="progress-bar">
              <div
                className="h-full bg-gradient-to-r from-success-500 to-success-400 rounded-full transition-all duration-500"
                style={{ width: `${getBarWidth(terms.totalDealValue.median, maxTotalValue)}%` }}
              />
            </div>
          </div>

          {/* Pro-only metrics */}
          {[
            { key: 'devMilestones', label: 'Development Milestones', data: terms.devMilestones, color: 'cyan' },
            { key: 'regMilestones', label: 'Regulatory Milestones', data: terms.regMilestones, color: 'teal' },
            { key: 'commMilestones', label: 'Commercial Milestones', data: terms.commMilestones, color: 'cyan' },
            { key: 'royalties', label: 'Royalty Rate', data: terms.royalties, isPercentage: true, color: 'teal' },
          ].map(({ key, label, data, isPercentage, color }) => (
            <div
              key={key}
              className={`group relative metric-card transition-all duration-300 ${
                isPro ? 'border-neutral-200 hover:border-teal-200' : 'border-neutral-100'
              }`}
            >
              {!isPro && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-50 flex items-center justify-center mb-3 shadow-inner-soft">
                    <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-600">Pro Feature</p>
                  <p className="text-xs text-neutral-400 mt-1">Upgrade to unlock</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center transition-colors group-hover:bg-${color}-100`}>
                    <svg className={`w-5 h-5 text-${color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700">{label}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mb-2">
                {formatRange(data, isPercentage)}
              </p>
              <p className="text-sm text-neutral-500">
                Median: <span className="font-bold text-neutral-700">
                  {isPercentage ? `${data.median}%` : formatCurrency(data.median)}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        {!isPro ? (
          <div className="mt-8 p-8 bg-gradient-to-br from-navy-800 to-navy-900 rounded-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
                backgroundSize: '16px 16px'
              }} />
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-teal-500/20 rounded-full px-4 py-1.5 mb-4">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-teal-300">Unlock Full Insights</span>
              </div>
              <h4 className="text-2xl font-bold text-white mb-3">
                Get Complete Deal Analysis
              </h4>
              <p className="text-neutral-300 mb-6 max-w-md mx-auto">
                Access milestone breakdowns, royalty analysis, and downloadable reports with Pro
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={onUpgrade}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3.5 px-8 rounded-xl
                           hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 group"
                >
                  <span>Upgrade to Pro</span>
                  <span className="text-teal-100 font-normal">$99/mo</span>
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-4">Cancel anytime. No commitment required.</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {/* Download Report Button */}
            <div className="p-6 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl border border-teal-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-navy-800">Download Report</h4>
                    <p className="text-sm text-neutral-600">Save your analysis as a PDF</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadReport}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3 px-6 rounded-xl
                           hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-soft hover:shadow-glow hover:-translate-y-0.5 group"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Advisory CTA */}
            <div className="p-8 bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                  backgroundSize: '16px 16px'
                }} />
              </div>
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-teal-500/20 rounded-full px-4 py-1.5 mb-4">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-sm font-medium text-teal-300">Expert Advisory</span>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">
                  Need Custom Advisory?
                </h4>
                <p className="text-neutral-400 mb-6 max-w-md mx-auto">
                  Get comparable deals, valuation drivers, and negotiation strategy from our expert team
                </p>
                <button
                  onClick={onGetDetailedReport}
                  className="inline-flex items-center gap-2 bg-white text-neutral-900 font-semibold py-3.5 px-8 rounded-xl
                           hover:bg-neutral-100 transition-all duration-200 shadow-soft-lg hover:shadow-soft-xl hover:-translate-y-0.5 group"
                >
                  <span>Request Advisory Consultation</span>
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-neutral-100 rounded-xl border border-neutral-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-neutral-500 leading-relaxed">
              <strong className="text-neutral-600">Disclaimer:</strong> These estimates are based on publicly available deal data and are intended for illustrative purposes only.
              Actual deal terms vary significantly based on asset-specific factors, market conditions, competitive dynamics,
              and negotiation outcomes. This tool does not constitute financial or legal advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
