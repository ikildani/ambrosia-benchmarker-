'use client';

import { useMemo, useState } from 'react';
import { Calculator, Lock, TrendingUp, Clock, ChevronDown, ChevronRight, Layers, Shield, Target, Sparkles, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { RNPVResult, DealWaterfall, ScenarioComparisonResult, LifecycleExtensionResult } from '@/lib/financial/types';
import type { CompetitiveDynamicsResult, RealOptionsResult } from '@/lib/financial/advanced-upgrades';

interface RnpvAnalysisProps {
  rnpvResult?: RNPVResult;
  benchmarkMedian?: number;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  // New institutional upgrade props
  dealWaterfall?: DealWaterfall;
  scenarioComparison?: ScenarioComparisonResult;
  lifecycleExtensions?: LifecycleExtensionResult;
  competitiveDynamics?: CompetitiveDynamicsResult;
  realOptions?: RealOptionsResult;
}

export default function RnpvAnalysis({
  rnpvResult,
  benchmarkMedian,
  tier,
  onUpgrade,
  onBuyReport,
  dealWaterfall,
  scenarioComparison,
  lifecycleExtensions,
  competitiveDynamics,
  realOptions,
}: RnpvAnalysisProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!rnpvResult) return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">rNPV analysis requires additional data inputs to calculate.</p>
    </div>
  );

  const hasAccess = tier === 'pro' || tier === 'report';

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const derived = useMemo(() => {
    let paybackYear: number | null = null;
    let cumulativeCF = 0;
    for (const cf of rnpvResult.cashFlows) {
      cumulativeCF += cf.riskAdjustedPV;
      if (cumulativeCF > 0 && paybackYear === null) {
        paybackYear = cf.year;
      }
    }
    const currentYear = new Date().getFullYear();
    const paybackPeriod = paybackYear !== null ? `${paybackYear - currentYear}y` : 'N/A';

    const totalInvestment = rnpvResult.cashFlows
      .filter(cf => cf.netCashFlow < 0)
      .reduce((sum, cf) => sum + Math.abs(cf.riskAdjustedPV), 0);

    let annualizedReturn = 'N/A';
    if (totalInvestment > 0 && rnpvResult.yearsToMarket > 0) {
      if (rnpvResult.riskAdjustedNPV < 0) {
        annualizedReturn = 'Negative';
      } else {
        const raw = (Math.pow(rnpvResult.riskAdjustedNPV / totalInvestment, 1 / rnpvResult.yearsToMarket) - 1) * 100;
        annualizedReturn = isNaN(raw) ? 'N/A' : raw.toFixed(1);
      }
    }

    const approvalYear = currentYear + rnpvResult.yearsToMarket;
    const currentCF = rnpvResult.cashFlows.find(cf => cf.year === currentYear);
    const approvalCF = rnpvResult.cashFlows.find(cf => cf.year === approvalYear || cf.year === approvalYear + 1);
    const peakCF = rnpvResult.cashFlows.find(cf => cf.year === rnpvResult.peakSalesYear);
    const totalRevenue = rnpvResult.cashFlows.reduce((sum, cf) => sum + cf.revenue, 0);
    const totalRiskAdjPV = rnpvResult.cashFlows.reduce((sum, cf) => sum + cf.riskAdjustedPV, 0);
    const cv = rnpvResult.crossValidation;
    const cvBenchmark = cv?.benchmarkMedian ?? benchmarkMedian;
    const cvDivergence = cv?.divergencePercent;

    return { paybackPeriod, annualizedReturn, currentYear, currentCF, approvalCF, peakCF, totalRevenue, totalRiskAdjPV, cv, cvBenchmark, cvDivergence };
  }, [rnpvResult, benchmarkMedian]);

  const { paybackPeriod, annualizedReturn, currentYear, currentCF, approvalCF, peakCF, totalRevenue, totalRiskAdjPV, cv, cvBenchmark, cvDivergence } = derived;

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 p-[1px]">
        <div className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${!hasAccess ? 'select-none' : ''}`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Institutional Valuation Engine
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  rNPV + Real Options + Deal Waterfall + Scenario Analysis
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex-shrink-0">
              {rnpvResult.discountRate
                ? `${(rnpvResult.discountRate * 100).toFixed(1)}% WACC`
                : 'rNPV'}
            </span>
          </div>

          {/* Blurred content for non-pro */}
          <div className={`${!hasAccess ? 'blur-[6px] pointer-events-none' : ''} transition-all`}>

            {/* ═══════════ KPI Row ═══════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-lg border border-teal-100 dark:border-teal-500/20 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total rNPV</p>
                <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-400 font-mono">{formatCurrency(rnpvResult.riskAdjustedNPV)}</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cumulative PoS</p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white font-mono">{(rnpvResult.cumulativePoS * 100).toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ann. Return</p>
                <p className={`text-lg sm:text-xl font-bold font-mono ${annualizedReturn === 'Negative' ? 'text-red-600 dark:text-red-400' : 'text-navy-800 dark:text-white'}`}>
                  {annualizedReturn !== 'N/A' && annualizedReturn !== 'Negative' ? `${annualizedReturn}%` : annualizedReturn}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Payback</p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white font-mono">{paybackPeriod}</p>
              </div>
            </div>

            {/* ═══════════ SCENARIO COMPARISON (Bear/Base/Bull) ═══════════ */}
            {scenarioComparison && (
              <div className="mb-5">
                <button onClick={() => toggleSection('scenarios')} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bear / Base / Bull Scenarios</span>
                    <span className="text-xs font-mono text-teal-600 dark:text-teal-400 ml-2">
                      EV: {formatCurrency(scenarioComparison.expectedValue)}
                    </span>
                  </div>
                  {expandedSection === 'scenarios' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'scenarios' && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {/* Bear */}
                    <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
                      <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-2">Bear ({(scenarioComparison.bearWeight * 100).toFixed(0)}%)</p>
                      <p className="text-lg font-bold font-mono text-red-700 dark:text-red-400">{formatCurrency(scenarioComparison.bear.rnpv)}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">PoS: {(scenarioComparison.bear.cumulativePoS * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Time: {scenarioComparison.bear.yearsToMarket.toFixed(1)}y</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Deal: {formatCurrency(scenarioComparison.bear.impliedDeal)}</p>
                    </div>
                    {/* Base */}
                    <div className="p-3 rounded-lg bg-teal-50/50 dark:bg-teal-500/5 border-2 border-teal-200 dark:border-teal-500/20">
                      <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-2">Base ({(scenarioComparison.baseWeight * 100).toFixed(0)}%)</p>
                      <p className="text-lg font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(scenarioComparison.base.rnpv)}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">PoS: {(scenarioComparison.base.cumulativePoS * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Time: {scenarioComparison.base.yearsToMarket.toFixed(1)}y</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Deal: {formatCurrency(scenarioComparison.base.impliedDeal)}</p>
                    </div>
                    {/* Bull */}
                    <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10">
                      <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">Bull ({(scenarioComparison.bullWeight * 100).toFixed(0)}%)</p>
                      <p className="text-lg font-bold font-mono text-green-700 dark:text-green-400">{formatCurrency(scenarioComparison.bull.rnpv)}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">PoS: {(scenarioComparison.bull.cumulativePoS * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Time: {scenarioComparison.bull.yearsToMarket.toFixed(1)}y</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Deal: {formatCurrency(scenarioComparison.bull.impliedDeal)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ DEAL VALUATION WATERFALL ═══════════ */}
            {dealWaterfall && (
              <div className="mb-5">
                <button onClick={() => toggleSection('waterfall')} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Deal Valuation Waterfall</span>
                    <span className="text-xs font-mono text-teal-600 dark:text-teal-400 ml-2">
                      {formatCurrency(dealWaterfall.totalDealValue.median)} total
                    </span>
                  </div>
                  {expandedSection === 'waterfall' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'waterfall' && (
                  <div className="mt-3">
                    {/* Waterfall steps */}
                    <div className="space-y-2 mb-4">
                      {dealWaterfall.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-28 sm:w-36 text-right flex-shrink-0">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{step.label}</span>
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-700/50 rounded relative overflow-hidden">
                              <div
                                className={`h-full rounded flex items-center justify-end px-2 text-[10px] font-bold font-mono text-white ${
                                  step.adjustment >= 0 ? 'bg-teal-500/70' : 'bg-red-400/60'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, (step.runningTotal / Math.max(dealWaterfall.steps[0]?.runningTotal || 1, 1)) * 100))}%` }}
                              >
                                {formatCurrency(step.runningTotal)}
                              </div>
                            </div>
                            <span className={`text-[10px] font-mono font-semibold w-16 text-right flex-shrink-0 ${
                              step.adjustment >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'
                            }`}>
                              {step.adjustment >= 0 ? '+' : ''}{formatCurrency(step.adjustment)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Deal component allocation */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-700/20 rounded-lg">
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Upfront</p>
                        <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(dealWaterfall.upfrontPayment.median)}</p>
                        <p className="text-[9px] text-slate-400">{formatCurrency(dealWaterfall.upfrontPayment.low)} – {formatCurrency(dealWaterfall.upfrontPayment.high)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Dev Milestones</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{formatCurrency(dealWaterfall.developmentMilestones.median)}</p>
                        <p className="text-[9px] text-slate-400">{formatCurrency(dealWaterfall.developmentMilestones.low)} – {formatCurrency(dealWaterfall.developmentMilestones.high)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Comm. Milestones</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{formatCurrency(dealWaterfall.commercialMilestones.median)}</p>
                        <p className="text-[9px] text-slate-400">{formatCurrency(dealWaterfall.commercialMilestones.low)} – {formatCurrency(dealWaterfall.commercialMilestones.high)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Royalty Range</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{dealWaterfall.royaltyRate.low.toFixed(1)}% – {dealWaterfall.royaltyRate.high.toFixed(1)}%</p>
                      </div>
                    </div>

                    {dealWaterfall.narrative && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{dealWaterfall.narrative}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ REAL OPTIONS OVERLAY ═══════════ */}
            {realOptions && (
              <div className="mb-5">
                <button onClick={() => toggleSection('realOptions')} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Real Options Valuation</span>
                    <span className={`text-xs font-mono ml-2 ${
                      realOptions.flexibilityPremium >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {realOptions.flexibilityPremium >= 0 ? '+' : ''}{formatCurrency(realOptions.flexibilityPremium)} flexibility premium
                    </span>
                  </div>
                  {expandedSection === 'realOptions' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'realOptions' && (
                  <div className="mt-3">
                    {/* Option value KPIs */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Option Value</p>
                        <p className="text-lg font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(realOptions.totalOptionValue)}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Implied Volatility</p>
                        <p className="text-lg font-bold font-mono text-navy-800 dark:text-white">{(realOptions.volatilityUsed * 100).toFixed(0)}%</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Flexibility Premium</p>
                        <p className={`text-lg font-bold font-mono ${realOptions.flexibilityPremiumPercent >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {realOptions.flexibilityPremiumPercent >= 0 ? '+' : ''}{realOptions.flexibilityPremiumPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Phase-by-phase option breakdown */}
                    {realOptions.optionValueByPhase.length > 0 && (
                      <div className="overflow-x-auto mb-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-600">
                              <th className="text-left py-2 pr-3 font-medium text-slate-500 dark:text-slate-400">Phase</th>
                              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Option Value</th>
                              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Intrinsic</th>
                              <th className="text-right py-2 pl-2 font-medium text-slate-500 dark:text-slate-400">Time Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {realOptions.optionValueByPhase.map((phase, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{phase.phase}</td>
                                <td className="py-2 px-2 text-right font-mono font-semibold text-teal-700 dark:text-teal-400">{formatCurrency(phase.optionValue)}</td>
                                <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(phase.intrinsicValue)}</td>
                                <td className="py-2 pl-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(phase.timeValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {realOptions.narrative}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                      Cox-Ross-Rubinstein binomial lattice · {realOptions.latticeSteps} steps · {(realOptions.riskFreeRate * 100).toFixed(1)}% risk-free rate
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ COMPETITIVE DYNAMICS ═══════════ */}
            {competitiveDynamics && competitiveDynamics.competitorTimeline.length > 0 && (
              <div className="mb-5">
                <button onClick={() => toggleSection('competitive')} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Competitive Dynamics</span>
                    <span className={`text-xs font-mono ml-2 ${
                      competitiveDynamics.peakShareErosion > 0.25 ? 'text-red-500 dark:text-red-400' :
                      competitiveDynamics.peakShareErosion > 0.10 ? 'text-amber-600 dark:text-amber-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {(competitiveDynamics.peakShareErosion * 100).toFixed(0)}% peak erosion
                    </span>
                  </div>
                  {expandedSection === 'competitive' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'competitive' && (
                  <div className="mt-3">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Competitors</p>
                        <p className="text-lg font-bold font-mono text-navy-800 dark:text-white">{competitiveDynamics.competitorTimeline.length}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Peak Erosion</p>
                        <p className={`text-lg font-bold font-mono ${
                          competitiveDynamics.peakShareErosion > 0.25 ? 'text-red-600 dark:text-red-400' :
                          competitiveDynamics.peakShareErosion > 0.10 ? 'text-amber-600 dark:text-amber-400' :
                          'text-green-600 dark:text-green-400'
                        }`}>{(competitiveDynamics.peakShareErosion * 100).toFixed(1)}%</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Revenue Impact</p>
                        <p className="text-lg font-bold font-mono text-red-600 dark:text-red-400">-{formatCurrency(competitiveDynamics.revenueImpact)}</p>
                      </div>
                    </div>

                    {/* Competitor timeline */}
                    <div className="space-y-2 mb-3">
                      {competitiveDynamics.competitorTimeline.map((comp, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="w-12 font-mono font-semibold text-slate-700 dark:text-slate-300">{comp.entryYear}</span>
                          <div className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            comp.type === 'generic' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                            comp.type === 'biosimilar' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                            comp.type === 'nextGen' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                          }`}>
                            {comp.type.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <span className="text-slate-500 dark:text-slate-400">
                            {(comp.shareImpact * 100).toFixed(0)}% share impact · {comp.rampYears > 0 ? `${comp.rampYears}y ramp` : 'immediate'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{competitiveDynamics.narrative}</p>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ LIFECYCLE EXTENSIONS ═══════════ */}
            {lifecycleExtensions && lifecycleExtensions.extensions.length > 0 && (
              <div className="mb-5">
                <button onClick={() => toggleSection('lifecycle')} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lifecycle Extensions</span>
                    <span className="text-xs font-mono text-teal-600 dark:text-teal-400 ml-2">
                      +{formatCurrency(lifecycleExtensions.incrementalValue)} ({lifecycleExtensions.incrementalPercent.toFixed(0)}% upside)
                    </span>
                  </div>
                  {expandedSection === 'lifecycle' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSection === 'lifecycle' && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Base rNPV</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{formatCurrency(lifecycleExtensions.baseRNPV)}</p>
                      </div>
                      <div className="p-3 bg-teal-50/50 dark:bg-teal-500/5 rounded-lg border border-teal-100 dark:border-teal-500/10 text-center">
                        <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Extended rNPV</p>
                        <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(lifecycleExtensions.extendedRNPV)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {lifecycleExtensions.extensions.map((ext, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/20">
                          <div className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${
                            ext.type === 'labelExpansion' ? 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' :
                            ext.type === 'pediatricExclusivity' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400'
                          }`}>
                            {ext.type === 'labelExpansion' ? 'Label Exp.' :
                             ext.type === 'pediatricExclusivity' ? 'Peds Excl.' : 'Combo'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 dark:text-slate-300">{ext.narrative}</p>
                            <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>{(ext.probability * 100).toFixed(0)}% probability</span>
                              {ext.incrementalPeakSalesPercent > 0 && <span>+{ext.incrementalPeakSalesPercent}% peak sales</span>}
                              {ext.additionalExclusivityYears > 0 && <span>+{ext.additionalExclusivityYears}y exclusivity</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ CASH FLOW SUMMARY TABLE ═══════════ */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Cash Flow Summary</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm" role="table" aria-label="Cash flow summary">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th scope="col" className="text-left py-2 pr-3 font-medium text-neutral-500 dark:text-slate-400">Period</th>
                      <th scope="col" className="text-right py-2 px-2 font-medium text-neutral-500 dark:text-slate-400">Revenue</th>
                      <th scope="col" className="text-right py-2 px-2 font-medium text-neutral-500 dark:text-slate-400">Net CF</th>
                      <th scope="col" className="text-right py-2 pl-2 font-medium text-neutral-500 dark:text-slate-400">Risk-Adj PV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {currentCF && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{currentYear} (Current)</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(currentCF.revenue)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(currentCF.netCashFlow)}</td>
                        <td className="py-2 pl-2 text-right font-mono font-medium text-slate-800 dark:text-slate-200">{formatCurrency(currentCF.riskAdjustedPV)}</td>
                      </tr>
                    )}
                    {approvalCF && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{approvalCF.year} (Approval)</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(approvalCF.revenue)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(approvalCF.netCashFlow)}</td>
                        <td className="py-2 pl-2 text-right font-mono font-medium text-slate-800 dark:text-slate-200">{formatCurrency(approvalCF.riskAdjustedPV)}</td>
                      </tr>
                    )}
                    {peakCF && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{peakCF.year} (Peak)</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(peakCF.revenue)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{formatCurrency(peakCF.netCashFlow)}</td>
                        <td className="py-2 pl-2 text-right font-mono font-medium text-teal-700 dark:text-teal-400">{formatCurrency(peakCF.riskAdjustedPV)}</td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-semibold">
                      <td className="py-2 pr-3 text-navy-800 dark:text-white">Total</td>
                      <td className="py-2 px-2 text-right font-mono text-navy-800 dark:text-white">{formatCurrency(totalRevenue)}</td>
                      <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">--</td>
                      <td className="py-2 pl-2 text-right font-mono text-teal-700 dark:text-teal-400">{formatCurrency(totalRiskAdjPV)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ═══════════ CROSS-VALIDATION ═══════════ */}
            {cvBenchmark != null && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-500/5 dark:to-cyan-500/5 rounded-lg border border-teal-100 dark:border-teal-500/20">
                <h5 className="text-sm font-semibold text-navy-800 dark:text-white mb-2">Cross-Validation: Benchmark vs. rNPV</h5>
                <div className="flex items-center gap-4 mb-2">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">Benchmark Median</p>
                    <p className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{formatCurrency(cvBenchmark)}</p>
                  </div>
                  <div className="text-neutral-400 dark:text-slate-500">vs.</div>
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-slate-400">rNPV-Implied Value</p>
                    <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(cv?.rnpvMedian ?? rnpvResult.impliedDealValue.totalDeal.median)}</p>
                  </div>
                  {cvDivergence != null && (
                    <span className={`ml-auto px-2 py-0.5 text-xs font-semibold rounded-full ${
                      Math.abs(cvDivergence) <= 20
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {cvDivergence > 0 ? '+' : ''}{cvDivergence.toFixed(0)}% divergence
                    </span>
                  )}
                </div>
                {cv?.narrative && <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">{cv.narrative}</p>}
              </div>
            )}

            {/* ═══════════ MODEL ASSUMPTIONS ═══════════ */}
            {rnpvResult.modelAssumptions.length > 0 && (
              <div className="mt-4">
                <button onClick={() => toggleSection('assumptions')} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
                  {expandedSection === 'assumptions' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Model Assumptions ({rnpvResult.modelAssumptions.length})
                </button>
                {expandedSection === 'assumptions' && (
                  <ul className="mt-2 space-y-1">
                    {rnpvResult.modelAssumptions.map((a, i) => (
                      <li key={i} className="text-[10px] text-slate-500 dark:text-slate-400 pl-3 border-l-2 border-slate-200 dark:border-slate-600">{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
                aria-label="Unlock Institutional Valuation Engine"
              >
                <Lock className="w-4 h-4" />
                Unlock Full Valuation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
