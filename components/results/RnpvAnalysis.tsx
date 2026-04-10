'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import { Calculator, Lock, ChevronDown, ChevronRight, Layers, Shield, Target, Sparkles, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { CHART_COLORS } from '@/lib/chartTheme';
import type { RNPVResult, DealWaterfall, ScenarioComparisonResult, LifecycleExtensionResult } from '@/lib/financial/types';
import type { CompetitiveDynamicsResult, RealOptionsResult } from '@/lib/financial/advanced-upgrades';

interface RnpvAnalysisProps {
  rnpvResult?: RNPVResult;
  benchmarkMedian?: number;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  dealWaterfall?: DealWaterfall;
  scenarioComparison?: ScenarioComparisonResult;
  lifecycleExtensions?: LifecycleExtensionResult;
  competitiveDynamics?: CompetitiveDynamicsResult;
  realOptions?: RealOptionsResult;
}

const fmt = (v: number) => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(0)}M`;
  return `$${v.toFixed(1)}M`;
};

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Convert raw phase keys to display names */
const phaseDisplayName = (phase: string): string => {
  const map: Record<string, string> = {
    discovery: 'Discovery',
    preclinical: 'Preclinical',
    phase1: 'Phase 1',
    phase1_2: 'Phase 1/2',
    phase2: 'Phase 2',
    phase2_3: 'Phase 2/3',
    phase3: 'Phase 3',
    nda_filed: 'NDA Filed',
    approved: 'Approved',
    regulatory: 'Regulatory Review',
  };
  // Handle "Phase 2 -> Phase 3" style labels too
  if (phase.includes('->') || phase.includes('\u2192')) return phase;
  return map[phase] || phase.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const ChartTooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => {
        // Skip the invisible base bar in waterfall tooltips
        if (p.dataKey === 'base' && p.fill === 'transparent') return null;
        return (
          <p key={i} className="text-xs font-mono font-semibold" style={{ color: p.color || p.fill }}>
            {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
          </p>
        );
      })}
    </div>
  );
};

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
  // Fix 2: Use a Set so multiple sections can be open simultaneously; scenarios + waterfall open by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['scenarios', 'waterfall']));
  const toggle = (s: string) => setExpandedSections(prev => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  if (!rnpvResult) return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">rNPV analysis requires additional data inputs to calculate.</p>
    </div>
  );

  const hasAccess = tier === 'pro' || tier === 'report';

  const derived = useMemo(() => {
    // Payback conditional on success — uses unadjusted PV, not risk-adjusted.
    // BD teams want "if approved, when do we break even?" — not a PoS-weighted
    // answer that's always N/A for early-stage because 5% PoS makes revenue tiny.
    let paybackYear: number | null = null;
    let cumulativeCF = 0;
    let prevCF = 0;
    for (const cf of rnpvResult.cashFlows) {
      prevCF = cumulativeCF;
      cumulativeCF += cf.presentValue;
      if (cumulativeCF > 0 && paybackYear === null) {
        if (prevCF < 0 && cf.presentValue !== 0) {
          // Linear interpolation for fractional year precision
          const fraction = -prevCF / cf.presentValue;
          paybackYear = Math.round(((cf.year - 1) + fraction) * 10) / 10;
        } else {
          paybackYear = cf.year;
        }
      }
    }
    const paybackPeriod = paybackYear !== null ? `${paybackYear}y` : 'N/A';
    const currentYear = new Date().getFullYear();

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

    const cv = rnpvResult.crossValidation;
    const cvBenchmark = cv?.benchmarkMedian ?? benchmarkMedian;
    const cvDivergence = cv?.divergencePercent;

    return { paybackPeriod, annualizedReturn, currentYear, cv, cvBenchmark, cvDivergence };
  }, [rnpvResult, benchmarkMedian]);

  // ── Chart Data: Revenue Projection with Bear/Base/Bull ──
  const revenueChartData = useMemo(() => {
    if (!scenarioComparison) {
      return rnpvResult.cashFlows.filter(cf => cf.revenue > 0 || cf.rdCosts > 0).map(cf => ({
        year: cf.year,
        base: cf.revenue,
      }));
    }
    const baseCFs = rnpvResult.cashFlows;
    const bearMultiplier = scenarioComparison.bear.rnpv / Math.max(scenarioComparison.base.rnpv, 1);
    const bullMultiplier = scenarioComparison.bull.rnpv / Math.max(scenarioComparison.base.rnpv, 1);

    return baseCFs.filter(cf => cf.revenue > 0 || cf.rdCosts > 0).map(cf => ({
      year: cf.year,
      bear: Math.max(0, cf.revenue * Math.max(bearMultiplier, 0)),
      base: cf.revenue,
      bull: cf.revenue * Math.max(bullMultiplier, 1),
    }));
  }, [rnpvResult, scenarioComparison]);

  // ── Fix 1: True Waterfall Chart Data ──
  const waterfallChartData = useMemo(() => {
    if (!dealWaterfall) return [];
    return dealWaterfall.steps.map((step, i) => {
      const isFirst = i === 0;
      const isLast = i === dealWaterfall.steps.length - 1;
      const shortName = step.label.length > 14 ? step.label.substring(0, 14) + '\u2026' : step.label;
      if (isFirst || isLast) {
        return {
          name: shortName,
          fullName: step.label,
          base: 0,
          delta: step.runningTotal,
          adjustment: step.adjustment,
          runningTotal: step.runningTotal,
          fill: isFirst ? '#64748B' : CHART_COLORS.teal500,
        };
      }
      const prevTotal = dealWaterfall.steps[i - 1].runningTotal;
      const lower = Math.min(prevTotal, step.runningTotal);
      const upper = Math.max(prevTotal, step.runningTotal);
      return {
        name: shortName,
        fullName: step.label,
        base: lower,
        delta: upper - lower,
        adjustment: step.adjustment,
        runningTotal: step.runningTotal,
        fill: step.adjustment >= 0 ? '#34d399' : '#f87171',
      };
    });
  }, [dealWaterfall]);

  // ── Chart Data: Scenario Bar Comparison ──
  const scenarioBarData = useMemo(() => {
    if (!scenarioComparison) return [];
    return [
      { name: 'Bear', rnpv: scenarioComparison.bear.rnpv, deal: scenarioComparison.bear.impliedDeal, fill: '#f87171' },
      { name: 'Base', rnpv: scenarioComparison.base.rnpv, deal: scenarioComparison.base.impliedDeal, fill: CHART_COLORS.teal500 },
      { name: 'Bull', rnpv: scenarioComparison.bull.rnpv, deal: scenarioComparison.bull.impliedDeal, fill: '#34d399' },
    ];
  }, [scenarioComparison]);

  // ── Chart Data: Competitive Revenue Erosion ──
  const competitiveChartData = useMemo(() => {
    if (!competitiveDynamics) return [];
    return competitiveDynamics.baselineRevenue.map((base, i) => ({
      year: rnpvResult.cashFlows[i]?.year ?? derived.currentYear + i,
      baseline: base,
      adjusted: competitiveDynamics.adjustedRevenue[i],
    })).filter(d => d.baseline > 0 || d.adjusted > 0);
  }, [competitiveDynamics, rnpvResult, derived.currentYear]);

  const { paybackPeriod, annualizedReturn, cv, cvBenchmark, cvDivergence } = derived;

  // Section header component — updated for Set-based expanded state
  const SectionToggle = ({ id, icon: Icon, title, badge, badgeColor }: {
    id: string; icon: any; title: string; badge?: string; badgeColor?: string;
  }) => (
    <button onClick={() => toggle(id)} className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-teal-500" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        {badge && <span className={`text-xs font-mono ml-2 ${badgeColor || 'text-teal-600 dark:text-teal-400'}`}>{badge}</span>}
      </div>
      {expandedSections.has(id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
    </button>
  );

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
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">rNPV & Deal Valuation</h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">Risk-adjusted NPV · Real Options · Deal Waterfall · Scenario Analysis</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex-shrink-0">
              {rnpvResult.discountRate ? `${(rnpvResult.discountRate * 100).toFixed(1)}% WACC` : 'rNPV'}
            </span>
          </div>

          <div className={`${!hasAccess ? 'blur-[6px] pointer-events-none' : ''} transition-all`}>

            {/* ═══ KPI Row ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-lg border border-teal-100 dark:border-teal-500/20 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total rNPV</p>
                <p className="text-lg sm:text-xl font-bold text-teal-700 dark:text-teal-400 font-mono">{formatCurrency(rnpvResult.riskAdjustedNPV)}</p>
                {realOptions && realOptions.flexibilityPremium !== 0 && (
                  <p className={`text-[10px] font-mono mt-0.5 ${realOptions.flexibilityPremium >= 0 ? 'text-teal-600 dark:text-teal-500' : 'text-amber-600'}`}>
                    {realOptions.flexibilityPremium >= 0 ? '+' : ''}{fmt(realOptions.flexibilityPremium)} option value
                  </p>
                )}
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cumulative PoS</p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white font-mono">{fmtPct(rnpvResult.cumulativePoS)}</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Ann. Return</p>
                <p className={`text-lg sm:text-xl font-bold font-mono ${annualizedReturn === 'Negative' ? 'text-red-600 dark:text-red-400' : 'text-navy-800 dark:text-white'}`}>
                  {annualizedReturn !== 'N/A' && annualizedReturn !== 'Negative' ? `${annualizedReturn}%` : annualizedReturn}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                <p className="text-[10px] font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-1">Payback (if appr.)</p>
                <p className="text-lg sm:text-xl font-bold text-navy-800 dark:text-white font-mono">{paybackPeriod}</p>
              </div>
            </div>

            {/* ═══ Fix 3: Valuation Summary — Goldman one-pager row ═══ */}
            <div className="grid grid-cols-5 gap-2 mb-5 p-3 bg-slate-50 dark:bg-slate-700/20 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="text-center">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">rNPV</p>
                <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{fmt(rnpvResult.riskAdjustedNPV)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Implied Deal</p>
                <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{dealWaterfall ? fmt(dealWaterfall.totalDealValue.median) : '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expected Value</p>
                <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{scenarioComparison ? fmt(scenarioComparison.expectedValue) : '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Option Value</p>
                <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{realOptions ? fmt(realOptions.totalOptionValue) : '--'}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upfront Est.</p>
                <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{dealWaterfall ? fmt(dealWaterfall.upfrontPayment.median) : '--'}</p>
              </div>
            </div>

            {/* ═══ HERO CHART: Revenue Projection with Scenarios ═══ */}
            {revenueChartData.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Revenue Projection</h5>
                  {scenarioComparison && (
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Bear</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS.teal500 }} />Base</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" />Bull</span>
                    </div>
                  )}
                </div>
                <div className="h-52 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradBase" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.teal500} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.teal500} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradBull" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradBear" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f87171" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} strokeOpacity={0.3} />
                      <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={{ stroke: CHART_COLORS.axisLine, strokeOpacity: 0.3 }} />
                      <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={52} />
                      <Tooltip content={<ChartTooltipContent />} />
                      {scenarioComparison && <Area type="monotone" dataKey="bull" stroke="#34d399" strokeWidth={1} fill="url(#gradBull)" name="Bull" dot={false} />}
                      <Area type="monotone" dataKey="base" stroke={CHART_COLORS.teal500} strokeWidth={2} fill="url(#gradBase)" name="Base" dot={false} />
                      {scenarioComparison && <Area type="monotone" dataKey="bear" stroke="#f87171" strokeWidth={1} fill="url(#gradBear)" name="Bear" dot={false} />}
                      <ReferenceLine x={rnpvResult.peakSalesYear} stroke={CHART_COLORS.axisLabel} strokeDasharray="3 3" strokeOpacity={0.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {scenarioComparison && (
                  <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>EV: <span className="font-mono font-semibold text-teal-600 dark:text-teal-400">{fmt(scenarioComparison.expectedValue)}</span></span>
                    <span>Bear {(scenarioComparison.bearWeight * 100).toFixed(0)}% · Base {(scenarioComparison.baseWeight * 100).toFixed(0)}% · Bull {(scenarioComparison.bullWeight * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* ═══ SCENARIO COMPARISON BAR CHART ═══ */}
            {scenarioBarData.length > 0 && (
              <div className="mb-6">
                <SectionToggle id="scenarios" icon={BarChart3} title="Bear / Base / Bull Scenarios" badge={`EV: ${fmt(scenarioComparison!.expectedValue)}`} />
                {expandedSections.has('scenarios') && (
                  <div className="mt-3">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scenarioBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={8}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} strokeOpacity={0.3} vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_COLORS.axisLabelBold, fontWeight: 600 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} tickFormatter={fmt} width={52} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="rnpv" name="rNPV" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {scenarioBarData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.8} />)}
                          </Bar>
                          <Bar dataKey="deal" name="Implied Deal" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {scenarioBarData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.35} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {[
                        { label: 'Bear', data: scenarioComparison!.bear, weight: scenarioComparison!.bearWeight, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50/50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10' },
                        { label: 'Base', data: scenarioComparison!.base, weight: scenarioComparison!.baseWeight, color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50/50 dark:bg-teal-500/5 border-teal-200 dark:border-teal-500/20' },
                        { label: 'Bull', data: scenarioComparison!.bull, weight: scenarioComparison!.bullWeight, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50/50 dark:bg-green-500/5 border-green-100 dark:border-green-500/10' },
                      ].map(s => (
                        <div key={s.label} className={`p-3 rounded-lg border ${s.bg}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${s.color}`}>{s.label} ({(s.weight * 100).toFixed(0)}%)</p>
                          <p className={`text-sm font-bold font-mono ${s.color}`}>{fmt(s.data.rnpv)}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">PoS {fmtPct(s.data.cumulativePoS)} · {s.data.yearsToMarket.toFixed(1)}y</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Fix 1: TRUE WATERFALL CHART — stacked base+delta ═══ */}
            {waterfallChartData.length > 0 && (
              <div className="mb-6">
                <SectionToggle id="waterfall" icon={Layers} title="Deal Valuation Waterfall" badge={`${fmt(dealWaterfall!.totalDealValue.median)} total`} />
                {expandedSections.has('waterfall') && (
                  <div className="mt-3">
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waterfallChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} strokeOpacity={0.3} vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} tickFormatter={fmt} width={52} />
                          <Tooltip content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                                <p className="text-xs font-semibold text-white mb-1">{d?.fullName || d?.name}</p>
                                <p className="text-xs font-mono text-teal-400">Value: {fmt(d?.runningTotal)}</p>
                                {d?.adjustment !== undefined && d?.adjustment !== d?.runningTotal && (
                                  <p className={`text-xs font-mono ${d.adjustment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {d.adjustment >= 0 ? '+' : ''}{fmt(d.adjustment)}
                                  </p>
                                )}
                              </div>
                            );
                          }} />
                          {/* Invisible base bar — creates the floating effect */}
                          <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={[0, 0, 0, 0]} maxBarSize={56} />
                          {/* Visible delta bar — the actual colored segment */}
                          <Bar dataKey="delta" stackId="waterfall" radius={[3, 3, 0, 0]} maxBarSize={56}>
                            {waterfallChartData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.75} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Allocation boxes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 p-3 bg-slate-50 dark:bg-slate-700/20 rounded-lg">
                      {[
                        { label: 'Upfront', data: dealWaterfall!.upfrontPayment, accent: true },
                        { label: 'Dev Milestones', data: dealWaterfall!.developmentMilestones, accent: false },
                        { label: 'Comm. Milestones', data: dealWaterfall!.commercialMilestones, accent: false },
                        { label: 'Royalty', data: dealWaterfall!.royaltyRate, accent: false, isPercent: true },
                      ].map(item => (
                        <div key={item.label} className="text-center">
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                          <p className={`text-sm font-bold font-mono ${item.accent ? 'text-teal-700 dark:text-teal-400' : 'text-navy-800 dark:text-white'}`}>
                            {'isPercent' in item && item.isPercent ? `${item.data.low.toFixed(1)}%–${item.data.high.toFixed(1)}%` : fmt(item.data.median)}
                          </p>
                          {!('isPercent' in item && item.isPercent) && (
                            <p className="text-[9px] text-slate-400 font-mono">{fmt(item.data.low)} – {fmt(item.data.high)}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Deal-type-specific structural components
                        (co-dev cost sharing, option exercise fee,
                        collaboration FTE / equity). Shown only when the
                        rNPV engine surfaced any of these fields. */}
                    {(rnpvResult.impliedDealValue.codevCostSharing
                      || rnpvResult.impliedDealValue.optionExerciseFee
                      || rnpvResult.impliedDealValue.fteResearchValue
                      || rnpvResult.impliedDealValue.equityInvestment != null) && (
                      <div className="mt-4 p-3 bg-teal-50/40 dark:bg-teal-500/5 rounded-lg border border-teal-100 dark:border-teal-500/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-2">
                          Deal Structure Components
                        </p>
                        <div className="space-y-2">
                          {rnpvResult.impliedDealValue.codevCostSharing && (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Co-Dev Cost Sharing</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Licensee absorbs {(rnpvResult.impliedDealValue.codevCostSharing.ratioLicensee * 100).toFixed(0)}% of {fmt(rnpvResult.impliedDealValue.codevCostSharing.totalRDCost_M)} remaining R&amp;D
                                </p>
                              </div>
                              <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
                                {fmt(rnpvResult.impliedDealValue.codevCostSharing.sharedRDCost_M)}
                              </p>
                            </div>
                          )}
                          {rnpvResult.impliedDealValue.optionExerciseFee && (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Option Exercise Fee</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {fmt(rnpvResult.impliedDealValue.optionExerciseFee.fee_M)} nominal × {(rnpvResult.impliedDealValue.optionExerciseFee.probability * 100).toFixed(0)}% exercise probability
                                </p>
                              </div>
                              <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
                                {fmt(rnpvResult.impliedDealValue.optionExerciseFee.expectedValue_M)}
                              </p>
                            </div>
                          )}
                          {rnpvResult.impliedDealValue.fteResearchValue && (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">FTE Research Funding</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {rnpvResult.impliedDealValue.fteResearchValue.fteCount} FTEs × {fmt(rnpvResult.impliedDealValue.fteResearchValue.costPerFTE_M)}/yr × {rnpvResult.impliedDealValue.fteResearchValue.yearsOfFunding}y
                                </p>
                              </div>
                              <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
                                {fmt(rnpvResult.impliedDealValue.fteResearchValue.totalValue_M)}
                              </p>
                            </div>
                          )}
                          {rnpvResult.impliedDealValue.equityInvestment != null && rnpvResult.impliedDealValue.equityInvestment > 0 && (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Equity Investment</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Licensee takes equity stake in licensor at signing
                                </p>
                              </div>
                              <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
                                {fmt(rnpvResult.impliedDealValue.equityInvestment)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ REAL OPTIONS ═══ */}
            {realOptions && (
              <div className="mb-6">
                <SectionToggle id="realOptions" icon={Sparkles} title="Real Options Valuation"
                  badge={`${realOptions.flexibilityPremium >= 0 ? '+' : ''}${fmt(realOptions.flexibilityPremium)} flexibility`}
                  badgeColor={realOptions.flexibilityPremium >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}
                />
                {expandedSections.has('realOptions') && (
                  <div className="mt-3">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Option Value</p>
                        <p className="text-lg font-bold font-mono text-teal-700 dark:text-teal-400">{fmt(realOptions.totalOptionValue)}</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Implied Vol</p>
                        <p className="text-lg font-bold font-mono text-navy-800 dark:text-white">{(realOptions.volatilityUsed * 100).toFixed(0)}%</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Flex. Premium</p>
                        <p className={`text-lg font-bold font-mono ${realOptions.flexibilityPremiumPercent >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {realOptions.flexibilityPremiumPercent >= 0 ? '+' : ''}{realOptions.flexibilityPremiumPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Phase breakdown as mini horizontal bars */}
                    {realOptions.optionValueByPhase.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {realOptions.optionValueByPhase.map((phase, i) => {
                          const maxVal = Math.max(...realOptions.optionValueByPhase.map(p => p.optionValue), 1);
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 w-24 text-right flex-shrink-0 truncate">{phaseDisplayName(phase.phase)}</span>
                              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden relative">
                                <div className="absolute inset-y-0 left-0 bg-teal-500/20 rounded" style={{ width: `${(phase.intrinsicValue / maxVal) * 100}%` }} />
                                <div className="absolute inset-y-0 left-0 bg-teal-500/50 rounded" style={{ width: `${(phase.optionValue / maxVal) * 100}%` }} />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-semibold text-slate-600 dark:text-slate-300">{fmt(phase.optionValue)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{realOptions.narrative}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">CRR binomial lattice · {realOptions.latticeSteps} steps · {(realOptions.riskFreeRate * 100).toFixed(1)}% rf</p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ COMPETITIVE DYNAMICS with AREA CHART ═══ */}
            {competitiveDynamics && competitiveDynamics.competitorTimeline.length > 0 && (
              <div className="mb-6">
                <SectionToggle id="competitive" icon={Target} title="Competitive Dynamics"
                  badge={`${(competitiveDynamics.peakShareErosion * 100).toFixed(0)}% peak erosion`}
                  badgeColor={competitiveDynamics.peakShareErosion > 0.25 ? 'text-red-500 dark:text-red-400' : competitiveDynamics.peakShareErosion > 0.10 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}
                />
                {expandedSections.has('competitive') && (
                  <div className="mt-3">
                    {/* Fix 4: Handle empty competitive chart data */}
                    {competitiveChartData.length > 0 ? (
                      <div className="h-44 mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={competitiveChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.slate400} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={CHART_COLORS.slate400} stopOpacity={0.02} />
                              </linearGradient>
                              <linearGradient id="gradAdjusted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.teal500} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_COLORS.teal500} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} strokeOpacity={0.3} />
                            <XAxis dataKey="year" tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: CHART_COLORS.axisLabel }} tickLine={false} axisLine={false} tickFormatter={fmt} width={52} />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Area type="monotone" dataKey="baseline" stroke={CHART_COLORS.slate400} strokeWidth={1} strokeDasharray="4 4" fill="url(#gradBaseline)" name="Without Competition" dot={false} />
                            <Area type="monotone" dataKey="adjusted" stroke={CHART_COLORS.teal500} strokeWidth={2} fill="url(#gradAdjusted)" name="With Competition" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
                        Revenue projection and competitor timelines do not overlap — competitive impact will materialize in later years.
                      </p>
                    )}

                    {/* Top row: Competitors, Peak Erosion (combined), $ Impact */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="p-2 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Competitors</p>
                        <p className="text-base font-bold font-mono text-navy-800 dark:text-white">{competitiveDynamics.competitorTimeline.length}</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Peak Erosion</p>
                        <p className={`text-base font-bold font-mono ${(competitiveDynamics.peakShareErosion + competitiveDynamics.peakPriceErosion) > 0.25 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {((competitiveDynamics.peakShareErosion + competitiveDynamics.peakPriceErosion - competitiveDynamics.peakShareErosion * competitiveDynamics.peakPriceErosion) * 100).toFixed(1)}%
                        </p>
                        <p className="text-[8px] text-slate-400 mt-0.5">in {competitiveDynamics.peakErosionYear}</p>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">$ Impact</p>
                        <p className="text-base font-bold font-mono text-red-600 dark:text-red-400">-{fmt(competitiveDynamics.revenueImpact)}</p>
                      </div>
                    </div>

                    {/* Second row: Volume vs Price decomposition */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-0.5">Volume Erosion</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">
                          {(competitiveDynamics.peakShareErosion * 100).toFixed(1)}% <span className="text-[10px] text-slate-500">·</span> -{fmt(competitiveDynamics.volumeImpact)}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Price Erosion</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">
                          {(competitiveDynamics.peakPriceErosion * 100).toFixed(1)}% <span className="text-[10px] text-slate-500">·</span> -{fmt(competitiveDynamics.priceImpact)}
                        </p>
                      </div>
                    </div>

                    {/* Confidence + data source badge + territorial/response info */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        competitiveDynamics.confidence === 'high' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                        competitiveDynamics.confidence === 'moderate' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' :
                        'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                      }`}>
                        {competitiveDynamics.confidence} confidence
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">
                        {competitiveDynamics.dataSource === 'pipeline-intelligence' ? '● Real pipeline data' :
                         competitiveDynamics.dataSource === 'hybrid' ? '● Pipeline + calibrated' :
                         '○ TA-calibrated model'}
                      </span>
                      {competitiveDynamics.territorialLagYears != null && competitiveDynamics.territorialLagYears > 0 && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                          · +{competitiveDynamics.territorialLagYears.toFixed(1)}y territorial lag
                        </span>
                      )}
                      {competitiveDynamics.competitorResponseImpact != null && competitiveDynamics.competitorResponseImpact > 1 && (
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                          · -{fmt(competitiveDynamics.competitorResponseImpact)} competitor response
                        </span>
                      )}
                    </div>

                    {/* Monte Carlo uncertainty bands */}
                    {competitiveDynamics.revenueImpactP10 != null && competitiveDynamics.revenueImpactP90 != null && (
                      <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Uncertainty Bands (P10 – P90)</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 dark:text-green-400 font-mono font-semibold">-{fmt(competitiveDynamics.revenueImpactP10)}</span>
                          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full relative">
                            <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-green-400 via-amber-400 to-red-400 rounded-full opacity-60"></div>
                          </div>
                          <span className="text-red-600 dark:text-red-400 font-mono font-semibold">-{fmt(competitiveDynamics.revenueImpactP90)}</span>
                        </div>
                        <p className="text-[8px] text-slate-400 mt-1">
                          P10 erosion: {((competitiveDynamics.peakErosionP10 ?? 0) * 100).toFixed(1)}% · P90: {((competitiveDynamics.peakErosionP90 ?? 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    )}

                    {/* Competitor timeline entries */}
                    <div className="space-y-1.5">
                      {competitiveDynamics.competitorTimeline.map((comp, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="w-12 font-mono font-bold text-slate-600 dark:text-slate-300">{comp.entryYear}</span>
                          <div className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            comp.type === 'generic' ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' :
                            comp.type === 'nextGen' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            comp.type === 'biosimilar' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400' :
                            'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                          }`}>{comp.type.replace(/([A-Z])/g, ' $1').trim()}</div>
                          {comp.name && <span className="text-slate-700 dark:text-slate-200 font-semibold">{comp.name}</span>}
                          <span className="text-slate-500 dark:text-slate-400 ml-auto">{(comp.shareImpact * 100).toFixed(0)}% impact · {comp.rampYears > 0 ? `${comp.rampYears}y ramp` : 'immediate'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ LIFECYCLE EXTENSIONS ═══ */}
            {lifecycleExtensions && lifecycleExtensions.extensions.length > 0 && (
              <div className="mb-6">
                <SectionToggle id="lifecycle" icon={Shield} title="Lifecycle Extensions"
                  badge={`+${fmt(lifecycleExtensions.incrementalValue)} (${lifecycleExtensions.incrementalPercent.toFixed(0)}% upside)`}
                />
                {expandedSections.has('lifecycle') && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-center">
                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Base rNPV</p>
                        <p className="text-sm font-bold font-mono text-navy-800 dark:text-white">{fmt(lifecycleExtensions.baseRNPV)}</p>
                      </div>
                      <div className="p-3 bg-teal-50/50 dark:bg-teal-500/5 rounded-lg border border-teal-100 dark:border-teal-500/10 text-center">
                        <p className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Extended rNPV</p>
                        <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{fmt(lifecycleExtensions.extendedRNPV)}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lifecycleExtensions.extensions.map((ext, i) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/20">
                          <div className={`mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase flex-shrink-0 ${
                            ext.type === 'labelExpansion' ? 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400' :
                            ext.type === 'pediatricExclusivity' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400'
                          }`}>{ext.type === 'labelExpansion' ? 'Label' : ext.type === 'pediatricExclusivity' ? 'Peds' : 'Combo'}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 dark:text-slate-300">{ext.narrative}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>{(ext.probability * 100).toFixed(0)}% prob</span>
                              {ext.incrementalPeakSalesPercent > 0 && <span>+{ext.incrementalPeakSalesPercent}% sales</span>}
                              {ext.additionalExclusivityYears > 0 && <span>+{ext.additionalExclusivityYears}y excl.</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ CROSS-VALIDATION ═══ */}
            {cvBenchmark != null && (
              <div className="p-3 sm:p-4 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-500/5 dark:to-cyan-500/5 rounded-lg border border-teal-100 dark:border-teal-500/20 mb-5">
                <h5 className="text-sm font-semibold text-navy-800 dark:text-white mb-2">Cross-Validation</h5>
                <div className="flex items-center gap-4 mb-2">
                  <div>
                    <p className="text-[10px] text-neutral-500 dark:text-slate-400">Benchmark</p>
                    <p className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{formatCurrency(cvBenchmark)}</p>
                  </div>
                  <div className="text-neutral-400 dark:text-slate-500 text-xs">vs.</div>
                  <div>
                    <p className="text-[10px] text-neutral-500 dark:text-slate-400">rNPV-Implied</p>
                    <p className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">{formatCurrency(cv?.rnpvMedian ?? rnpvResult.impliedDealValue.totalDeal.median)}</p>
                  </div>
                  {cvDivergence != null && (
                    <span className={`ml-auto px-2 py-0.5 text-xs font-semibold rounded-full ${
                      Math.abs(cvDivergence) <= 20 ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    }`}>{cvDivergence > 0 ? '+' : ''}{cvDivergence.toFixed(0)}%</span>
                  )}
                </div>
                {cv?.narrative && <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">{cv.narrative}</p>}
              </div>
            )}

            {/* ═══ MODEL ASSUMPTIONS ═══ */}
            {rnpvResult.modelAssumptions.length > 0 && (
              <div>
                <button onClick={() => toggle('assumptions')} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
                  {expandedSections.has('assumptions') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Assumptions ({rnpvResult.modelAssumptions.length})
                </button>
                {expandedSections.has('assumptions') && (
                  <ul className="mt-2 space-y-1">
                    {rnpvResult.modelAssumptions.map((a, i) => (
                      <li key={i} className="text-[10px] text-slate-500 dark:text-slate-400 pl-3 border-l-2 border-slate-200 dark:border-slate-600">{a}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Pro Gate */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all">
                <Lock className="w-4 h-4" />Unlock Full Valuation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
