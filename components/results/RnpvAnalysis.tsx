'use client';

import { formatCurrency } from '@/lib/calculations';
import type { RNPVResult } from '@/lib/financial/types';

interface RnpvAnalysisProps {
  rnpvResult?: RNPVResult;
  benchmarkMedian?: number;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

export default function RnpvAnalysis({
  rnpvResult,
  benchmarkMedian,
  tier,
  onUpgrade,
  onBuyReport,
}: RnpvAnalysisProps) {
  if (!rnpvResult) return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">rNPV analysis requires additional data inputs to calculate.</p>
    </div>
  );

  const hasAccess = tier === 'pro' || tier === 'report';

  // Derive payback period from cash flows
  let paybackYear: number | null = null;
  let cumulativeCF = 0;
  for (const cf of rnpvResult.cashFlows) {
    cumulativeCF += cf.riskAdjustedPV;
    if (cumulativeCF > 0 && paybackYear === null) {
      paybackYear = cf.year;
    }
  }
  const paybackPeriod =
    paybackYear !== null
      ? `${paybackYear - new Date().getFullYear()}y`
      : 'N/A';

  // Annualized return: approximate IRR proxy from rNPV / investment over years to market
  const totalInvestment = rnpvResult.cashFlows
    .filter((cf) => cf.netCashFlow < 0)
    .reduce((sum, cf) => sum + Math.abs(cf.riskAdjustedPV), 0);
  const annualizedReturn =
    totalInvestment > 0 && rnpvResult.yearsToMarket > 0
      ? (
          (Math.pow(
            rnpvResult.riskAdjustedNPV / totalInvestment,
            1 / rnpvResult.yearsToMarket
          ) -
            1) *
          100
        ).toFixed(1)
      : 'N/A';

  // Key cash flow rows: current year, approval year, peak year, totals
  const currentYear = new Date().getFullYear();
  const approvalYear = currentYear + rnpvResult.yearsToMarket;
  const currentCF = rnpvResult.cashFlows.find((cf) => cf.year === currentYear);
  const approvalCF = rnpvResult.cashFlows.find(
    (cf) => cf.year === approvalYear || cf.year === approvalYear + 1
  );
  const peakCF = rnpvResult.cashFlows.find(
    (cf) => cf.year === rnpvResult.peakSalesYear
  );
  const totalRevenue = rnpvResult.cashFlows.reduce(
    (sum, cf) => sum + cf.revenue,
    0
  );
  const totalRiskAdjPV = rnpvResult.cashFlows.reduce(
    (sum, cf) => sum + cf.riskAdjustedPV,
    0
  );

  // Cross-validation
  const cv = rnpvResult.crossValidation;
  const cvBenchmark = cv?.benchmarkMedian ?? benchmarkMedian;
  const cvDivergence = cv?.divergencePercent;

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Risk-Adjusted NPV Analysis
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  Discounted cash flow with phase-gated probability of success
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex-shrink-0">
              {rnpvResult.discountRate
                ? `${(rnpvResult.discountRate * 100).toFixed(0)}% WACC`
                : 'rNPV'}
            </span>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-lg border border-teal-100 dark:border-teal-500/20 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Total rNPV
                </p>
                <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-400">
                  {formatCurrency(rnpvResult.riskAdjustedNPV)}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Cumulative PoS
                </p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">
                  {(rnpvResult.cumulativePoS * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Annualized Return
                </p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">
                  {annualizedReturn !== 'N/A'
                    ? `${annualizedReturn}%`
                    : annualizedReturn}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Payback Period
                </p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white">
                  {paybackPeriod}
                </p>
              </div>
            </div>

            {/* Cash Flow Summary Table */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Cash Flow Summary
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 pr-3 font-medium text-neutral-500 dark:text-slate-400">
                        Period
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-neutral-500 dark:text-slate-400">
                        Revenue
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-neutral-500 dark:text-slate-400">
                        Net CF
                      </th>
                      <th className="text-right py-2 pl-2 font-medium text-neutral-500 dark:text-slate-400">
                        Risk-Adj PV
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {currentCF && (
                      <tr>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                          {currentYear} (Current)
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(currentCF.revenue)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(currentCF.netCashFlow)}
                        </td>
                        <td className="py-2 pl-2 text-right font-medium text-slate-800 dark:text-slate-200">
                          {formatCurrency(currentCF.riskAdjustedPV)}
                        </td>
                      </tr>
                    )}
                    {approvalCF && (
                      <tr>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                          {approvalCF.year} (Approval)
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(approvalCF.revenue)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(approvalCF.netCashFlow)}
                        </td>
                        <td className="py-2 pl-2 text-right font-medium text-slate-800 dark:text-slate-200">
                          {formatCurrency(approvalCF.riskAdjustedPV)}
                        </td>
                      </tr>
                    )}
                    {peakCF && (
                      <tr>
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">
                          {peakCF.year} (Peak)
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(peakCF.revenue)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                          {formatCurrency(peakCF.netCashFlow)}
                        </td>
                        <td className="py-2 pl-2 text-right font-medium text-teal-700 dark:text-teal-400">
                          {formatCurrency(peakCF.riskAdjustedPV)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-semibold">
                      <td className="py-2 pr-3 text-navy-800 dark:text-white">
                        Total
                      </td>
                      <td className="py-2 px-2 text-right text-navy-800 dark:text-white">
                        {formatCurrency(totalRevenue)}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                        --
                      </td>
                      <td className="py-2 pl-2 text-right text-teal-700 dark:text-teal-400">
                        {formatCurrency(totalRiskAdjPV)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cross-Validation Callout */}
            {cvBenchmark != null && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-500/5 dark:to-cyan-500/5 rounded-lg border border-teal-100 dark:border-teal-500/20">
                <h5 className="text-sm font-semibold text-navy-800 dark:text-white mb-2">
                  Cross-Validation: Benchmark vs. rNPV
                </h5>
                <div className="flex items-center gap-4 mb-2">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      Benchmark Median
                    </p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {formatCurrency(cvBenchmark)}
                    </p>
                  </div>
                  <div className="text-neutral-400 dark:text-slate-500">vs.</div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">
                      rNPV-Implied Value
                    </p>
                    <p className="text-sm font-bold text-teal-700 dark:text-teal-400">
                      {formatCurrency(
                        cv?.rnpvMedian ??
                          rnpvResult.impliedDealValue.totalDeal.median
                      )}
                    </p>
                  </div>
                  {cvDivergence != null && (
                    <span
                      className={`ml-auto px-2 py-0.5 text-xs font-semibold rounded-full ${
                        Math.abs(cvDivergence) <= 20
                          ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {cvDivergence > 0 ? '+' : ''}
                      {cvDivergence.toFixed(0)}% divergence
                    </span>
                  )}
                </div>
                {cv?.narrative && (
                  <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                    {cv.narrative}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Unlock Financial Modeling
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
