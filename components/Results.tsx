'use client';

import { CalculationResult, formatCurrency, formatRange } from '@/lib/calculations';

interface ResultsProps {
  result: CalculationResult;
  tier: 'free' | 'pro';
  onUpgrade: () => void;
  onGetDetailedReport: () => void;
}

export default function Results({ result, tier, onUpgrade, onGetDetailedReport }: ResultsProps) {
  const { terms, modifiers, labels } = result;
  const isPro = tier === 'pro';

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
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse-slow"></div>
              <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
            </div>
            <h3 className="text-xl font-bold text-white">Estimated Deal Terms</h3>
            <p className="text-neutral-400 mt-1 text-sm">
              {labels.phase} &bull; {labels.modality}
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
              <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-sm font-semibold text-neutral-700">Applied Adjustments</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {modifiers.map((mod, idx) => (
                <span
                  key={idx}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    mod.multiplier > 1
                      ? 'bg-success-50 text-success-700 border border-success-200'
                      : 'bg-warning-50 text-warning-700 border border-warning-200'
                  }`}
                >
                  {mod.name}
                  <span className="ml-1.5 opacity-75">
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
          <div className="group p-6 bg-white rounded-xl border border-teal-200 shadow-soft hover:shadow-soft-lg hover:border-teal-300 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-teal-700">Upfront Payment</p>
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-1">
              {formatRange(terms.upfront)}
            </p>
            <p className="text-sm text-neutral-500">
              Median: <span className="font-semibold text-teal-600">{formatCurrency(terms.upfront.median)}</span>
            </p>
          </div>

          {/* Total Deal Value - Always visible */}
          <div className="group p-6 bg-white rounded-xl border border-success-200 shadow-soft hover:shadow-soft-lg hover:border-success-300 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-success-700">Total Deal Value</p>
              <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center group-hover:bg-success-100 transition-colors">
                <svg className="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-1">
              {formatRange(terms.totalDealValue)}
            </p>
            <p className="text-sm text-neutral-500">
              Median: <span className="font-semibold text-success-600">{formatCurrency(terms.totalDealValue.median)}</span>
            </p>
          </div>

          {/* Pro-only metrics */}
          {[
            { key: 'devMilestones', label: 'Development Milestones', data: terms.devMilestones },
            { key: 'regMilestones', label: 'Regulatory Milestones', data: terms.regMilestones },
            { key: 'commMilestones', label: 'Commercial Milestones', data: terms.commMilestones },
            { key: 'royalties', label: 'Royalty Rate', data: terms.royalties, isPercentage: true },
          ].map(({ key, label, data, isPercentage }) => (
            <div
              key={key}
              className={`group relative p-6 bg-white rounded-xl border shadow-soft transition-all duration-200 ${
                isPro ? 'border-neutral-200 hover:shadow-soft-lg hover:border-neutral-300' : 'border-neutral-100'
              }`}
            >
              {!isPro && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-neutral-600">Pro Feature</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-neutral-700">{label}</p>
                <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center group-hover:bg-neutral-100 transition-colors">
                  <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-neutral-900 mb-1">
                {formatRange(data, isPercentage)}
              </p>
              <p className="text-sm text-neutral-500">
                Median: <span className="font-semibold text-neutral-700">
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
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-teal-500/20 rounded-full px-4 py-1.5 mb-4">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-sm font-medium text-teal-300">Unlock Full Insights</span>
              </div>
              <h4 className="text-2xl font-bold text-white mb-2">
                Get Complete Deal Analysis
              </h4>
              <p className="text-neutral-300 mb-6 max-w-md mx-auto">
                Access milestone breakdowns, royalty analysis, and downloadable reports with Pro
              </p>
              <button
                onClick={onUpgrade}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3.5 px-8 rounded-xl
                         hover:from-teal-600 hover:to-cyan-600 transition-all duration-200 shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5"
              >
                <span>Upgrade to Pro</span>
                <span className="text-teal-100">$150/mo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 p-8 bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                backgroundSize: '16px 16px'
              }} />
            </div>
            <div className="relative">
              <h4 className="text-xl font-bold text-white mb-2">
                Need Custom Advisory?
              </h4>
              <p className="text-neutral-400 mb-6 max-w-md mx-auto">
                Get comparable deals, valuation drivers, and negotiation strategy from our expert team
              </p>
              <button
                onClick={onGetDetailedReport}
                className="inline-flex items-center gap-2 bg-white text-neutral-900 font-semibold py-3.5 px-8 rounded-xl
                         hover:bg-neutral-100 transition-all duration-200 shadow-soft-lg hover:shadow-soft-xl hover:-translate-y-0.5"
              >
                <span>Request Advisory Consultation</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="mt-8 text-xs text-neutral-400 text-center leading-relaxed max-w-2xl mx-auto">
          These estimates are based on publicly available deal data and are intended for illustrative purposes only.
          Actual deal terms vary significantly based on asset-specific factors, market conditions, competitive dynamics,
          and negotiation outcomes. This tool does not constitute financial or legal advice.
        </p>
      </div>
    </div>
  );
}
