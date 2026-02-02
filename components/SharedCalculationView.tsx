'use client';

import { CalculationResult, formatCurrency, formatRange } from '@/lib/calculations';

interface SharedCalculationViewProps {
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
}

export default function SharedCalculationView({ results, labels }: SharedCalculationViewProps) {
  const { terms, tieredRoyalties, dealRecommendation, modifiers } = results;

  return (
    <div className="space-y-6">
      {/* Deal Recommendation */}
      <div className="p-5 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200">
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

      {/* Applied Modifiers */}
      {modifiers.length > 0 && (
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm font-semibold text-neutral-700 mb-3">Applied Adjustments</p>
          <div className="flex flex-wrap gap-2">
            {modifiers.map((mod, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  mod.multiplier > 1
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : mod.multiplier < 1
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-neutral-50 text-neutral-700 border border-neutral-200'
                }`}
              >
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
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Upfront Payment */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-1">Upfront Payment</p>
          <p className="text-xl font-bold text-navy-800">{formatRange(terms.upfront)}</p>
          <p className="text-sm text-neutral-500 mt-1">
            Expected: <span className="font-semibold text-teal-600">{formatCurrency(terms.upfront.median)}</span>
          </p>
        </div>

        {/* Total Deal Value */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-1">Total Deal Value</p>
          <p className="text-xl font-bold text-success-600">{formatRange(terms.totalDealValue)}</p>
          <p className="text-sm text-neutral-500 mt-1">
            Expected: <span className="font-semibold text-success-600">{formatCurrency(terms.totalDealValue.median)}</span>
          </p>
        </div>

        {/* Development Milestones */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-1">Development Milestones</p>
          <p className="text-xl font-bold text-navy-800">{formatRange(terms.devMilestones)}</p>
        </div>

        {/* Regulatory Milestones */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-1">Regulatory Milestones</p>
          <p className="text-xl font-bold text-navy-800">{formatRange(terms.regMilestones)}</p>
        </div>

        {/* Commercial Milestones */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-1">Commercial Milestones</p>
          <p className="text-xl font-bold text-navy-800">{formatRange(terms.commMilestones)}</p>
        </div>

        {/* Royalties */}
        <div className="p-4 bg-white rounded-xl border border-neutral-200">
          <p className="text-sm text-neutral-500 mb-2">Tiered Royalties</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Base (&lt;$500M)</span>
              <span className="font-semibold">{tieredRoyalties.base.low}% - {tieredRoyalties.base.high}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Mid ($500M-$1B)</span>
              <span className="font-semibold">{tieredRoyalties.midTier.low}% - {tieredRoyalties.midTier.high}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">High (&gt;$1B)</span>
              <span className="font-semibold">{tieredRoyalties.highTier.low}% - {tieredRoyalties.highTier.high}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 bg-neutral-100 rounded-xl text-xs text-neutral-500">
        <strong>Disclaimer:</strong> These estimates are for informational purposes only and do not
        constitute financial or legal advice. Actual deal terms vary significantly based on
        asset-specific factors, market conditions, and negotiation dynamics.
      </div>
    </div>
  );
}
