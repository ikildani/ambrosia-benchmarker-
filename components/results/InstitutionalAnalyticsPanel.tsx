'use client';

import React, { useState } from 'react';
import { Shield, Target, FileText, Scale, Clock, Factory, DollarSign, TrendingUp, Globe, Users, ChevronDown, Lock, AlertTriangle } from 'lucide-react';
import type { FinancialModelResult } from '@/lib/financial/run-financial-model';

interface Props {
  financialModel: FinancialModelResult;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

function fmtPct(v: number, d = 1): string { return `${(v * 100).toFixed(d)}%`; }
function fmtM(v: number): string { return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.abs(v).toFixed(0)}M`; }

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    high: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    critical: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    favorable: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    borderline: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    unfavorable: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    standard: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    elevated: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    complex: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    unprecedented: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors[level?.toLowerCase()] || colors.medium}`}>
      {level}
    </span>
  );
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mb-4">{children}</div>;
}

function Kpi({ label, value, sub, accent = 'teal' }: { label: string; value: string; sub?: string; accent?: 'teal' | 'rose' | 'amber' | 'emerald' | 'blue' | 'purple' }) {
  const borderColors = { teal: 'border-t-teal-500', rose: 'border-t-rose-500', amber: 'border-t-amber-500', emerald: 'border-t-emerald-500', blue: 'border-t-blue-500', purple: 'border-t-purple-500' };
  return (
    <div className={`border border-neutral-200 dark:border-slate-700 ${borderColors[accent]} border-t-[3px] rounded-lg p-3 bg-white dark:bg-slate-800`}>
      <div className="text-[10px] font-semibold text-neutral-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-base font-bold text-neutral-900 dark:text-white leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

interface ModulePanelProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function ModulePanel({ title, subtitle, icon, gradient, defaultOpen = false, children }: ModulePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="relative">
      <div className={`rounded-xl bg-gradient-to-r ${gradient} p-[1px]`}>
        <div className="rounded-[11px] bg-white dark:bg-slate-800 overflow-hidden">
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-neutral-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-soft flex-shrink-0`}>
                {icon}
              </div>
              <div>
                <h4 className="font-bold text-neutral-800 dark:text-white text-sm sm:text-base">{title}</h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-neutral-100 dark:border-slate-700 pt-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Narrative({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="mt-3 p-3 bg-gradient-to-r from-neutral-50 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-lg border border-neutral-100 dark:border-slate-700">
      <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">{text}</p>
    </div>
  );
}

export default function InstitutionalAnalyticsPanel({ financialModel: fm, tier, onUpgrade, onBuyReport }: Props) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const hasAny = fm.regulatoryRisk || fm.milestoneProbabilities || fm.taxStructure ||
    fm.royaltyStacking || fm.patentDynamics || fm.cmcRisk || fm.earnoutValuation ||
    fm.pricingConstraints || fm.indicationSequence || (fm.buyerSynergies && fm.buyerSynergies.length > 0);

  if (!hasAny) return null;

  const moduleCount = [fm.regulatoryRisk, fm.milestoneProbabilities, fm.taxStructure,
    fm.royaltyStacking, fm.patentDynamics, fm.cmcRisk, fm.earnoutValuation,
    fm.pricingConstraints, fm.indicationSequence, fm.buyerSynergies?.length ? fm.buyerSynergies : null,
  ].filter(Boolean).length;

  return (
    <div className="mt-6 sm:mt-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-soft">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-neutral-800 dark:text-white text-base">Institutional Analytics</h3>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">{moduleCount} modules</span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">M&A-grade analytics across regulatory, financial, and strategic dimensions</p>
        </div>
      </div>

      {!hasAccess ? (
        <div className="relative">
          <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-[1px]">
            <div className="rounded-[11px] bg-white dark:bg-slate-800 p-6 blur-sm pointer-events-none select-none">
              <div className="grid grid-cols-2 gap-3">
                {['FDA Regulatory Risk', 'Milestone Probability', 'Patent & LOE', 'Manufacturing Risk', 'Pricing & Access', 'Earnout Valuation'].map(t => (
                  <div key={t} className="h-16 rounded-lg bg-neutral-100 dark:bg-slate-700 flex items-center px-4">
                    <div className="h-3 bg-neutral-200 dark:bg-slate-600 rounded w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 rounded-xl">
            <div className="text-center px-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h4 className="text-base font-bold text-neutral-800 dark:text-white mb-1">Institutional Analytics</h4>
              <p className="text-sm text-neutral-500 dark:text-slate-400 mb-4 max-w-xs">
                FDA regulatory risk, milestone probability, patent dynamics, and 7 more institutional-grade modules.
              </p>
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
              >
                <Lock className="w-4 h-4" />
                Unlock Full Analysis
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tier 1: Highest impact — default open */}
          {fm.regulatoryRisk && (
            <ModulePanel
              title="Global Regulatory Risk"
              subtitle={`${(fm.regulatoryRisk as any).agencies?.length || 1} agencies · Rejection rates, expert committees, review timelines`}
              icon={<Shield className="w-5 h-5 text-white" />}
              gradient="from-rose-500 to-orange-500"
              defaultOpen
            >
              {/* Primary agency KPIs (FDA for US/global, EMA for EU, etc.) */}
              <KpiGrid>
                <Kpi label="Rejection Probability" value={fmtPct(fm.regulatoryRisk.crlProbability)} sub={(fm.regulatoryRisk as any).primary?.rejectionLabel || 'CRL'} accent={fm.regulatoryRisk.crlProbability > 0.15 ? 'rose' : fm.regulatoryRisk.crlProbability > 0.10 ? 'amber' : 'emerald'} />
                <Kpi label="Expert Committee" value={fm.regulatoryRisk.adcommRequired ? 'Likely' : 'Unlikely'} sub={fm.regulatoryRisk.adcommRequired ? `${fmtPct(fm.regulatoryRisk.adcommFavorableVoteProbability)} favorable` : undefined} accent={fm.regulatoryRisk.adcommRequired ? 'amber' : 'emerald'} />
                <Kpi label="Review On-Time" value={fmtPct(fm.regulatoryRisk.pdufahRisk.onTime)} sub={`${fmtPct(fm.regulatoryRisk.pdufahRisk.delay3mo)} delayed`} accent="blue" />
                <Kpi label="Timeline Impact" value={`${fm.regulatoryRisk.timelineImpact_years > 0 ? '+' : ''}${fm.regulatoryRisk.timelineImpact_years.toFixed(1)} yr`} accent={fm.regulatoryRisk.timelineImpact_years > 0 ? 'rose' : 'emerald'} />
              </KpiGrid>

              {/* Multi-agency comparison table (when global result available) */}
              {(fm.regulatoryRisk as any).agencies?.length > 1 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="py-1.5 pr-3 text-left font-semibold text-slate-500 dark:text-slate-400">Agency</th>
                        <th className="py-1.5 px-2 text-right font-semibold text-slate-500 dark:text-slate-400">Rejection</th>
                        <th className="py-1.5 px-2 text-right font-semibold text-slate-500 dark:text-slate-400">Review (mo)</th>
                        <th className="py-1.5 px-2 text-right font-semibold text-slate-500 dark:text-slate-400">Timeline</th>
                        <th className="py-1.5 pl-2 text-left font-semibold text-slate-500 dark:text-slate-400">Conditional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((fm.regulatoryRisk as any).agencies as Array<{agency: string; agencyFullName: string; rejectionProbability: number; rejectionLabel: string; standardReviewMonths: number; currentReviewType: string; timelineImpact_years: number; conditionalApprovalLabel: string; conditionalApprovalAvailable: boolean}>).map((a) => (
                        <tr key={a.agency} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200">{a.agency}</td>
                          <td className={`py-1.5 px-2 text-right tabular-nums font-semibold ${a.rejectionProbability > 0.10 ? 'text-rose-500' : a.rejectionProbability > 0.05 ? 'text-amber-500' : 'text-emerald-500'}`}>{fmtPct(a.rejectionProbability)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{a.standardReviewMonths}{a.currentReviewType !== 'standard' ? ` (${a.currentReviewType})` : ''}</td>
                          <td className={`py-1.5 px-2 text-right tabular-nums ${a.timelineImpact_years > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{a.timelineImpact_years > 0 ? '+' : ''}{a.timelineImpact_years.toFixed(1)}yr</td>
                          <td className="py-1.5 pl-2 text-slate-500 dark:text-slate-400">{a.conditionalApprovalAvailable ? a.conditionalApprovalLabel : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Overall risk score (when multi-agency) */}
              {(fm.regulatoryRisk as any).overallRiskScore != null && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Overall Regulatory Risk Score:</span>
                  <span className={`text-sm font-bold tabular-nums ${(fm.regulatoryRisk as any).overallRiskScore > 20 ? 'text-rose-500' : (fm.regulatoryRisk as any).overallRiskScore > 10 ? 'text-amber-500' : 'text-emerald-500'}`}>{Math.round((fm.regulatoryRisk as any).overallRiskScore)}/100</span>
                </div>
              )}

              {fm.regulatoryRisk.prvEligible && (
                <div className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 mb-3">
                  <DollarSign className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Priority Review Voucher eligible — estimated value {fmtM(fm.regulatoryRisk.prvValue_M)}</span>
                </div>
              )}
              {fm.regulatoryRisk.acceleratedApprovalRisk?.eligible && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">Accelerated approval pathway — {fmtPct(fm.regulatoryRisk.acceleratedApprovalRisk.confirmatoryFailureProbability)} confirmatory failure risk</span>
                </div>
              )}
              <Narrative text={fm.regulatoryRisk.narrative} />
            </ModulePanel>
          )}

          {fm.milestoneProbabilities && (
            <ModulePanel
              title="Milestone Probability Analysis"
              subtitle="Cascading conditional probability for each payment trigger"
              icon={<Target className="w-5 h-5 text-white" />}
              gradient="from-teal-500 to-cyan-500"
              defaultOpen
            >
              <KpiGrid>
                <Kpi label="P-Weighted Total" value={`${fm.milestoneProbabilities.probabilityWeightedTotalValue.toFixed(0)}%`} sub="of headline TDV" accent="teal" />
                <Kpi label="Dev Milestones" value={`${fm.milestoneProbabilities.developmentMilestones.length}`} accent="blue" />
                <Kpi label="Comm Milestones" value={`${fm.milestoneProbabilities.commercialMilestones.length}`} accent="purple" />
              </KpiGrid>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-slate-800">
                    <tr className="text-neutral-400 dark:text-slate-500">
                      <th className="text-left py-2 px-3 font-semibold">Milestone</th>
                      <th className="text-right py-2 px-3 font-semibold">Probability</th>
                      <th className="text-right py-2 px-3 font-semibold">Timing</th>
                      <th className="text-right py-2 px-3 font-semibold">Value %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                    {[...fm.milestoneProbabilities.developmentMilestones, ...fm.milestoneProbabilities.commercialMilestones].map((m, i) => (
                      <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 px-3 text-neutral-700 dark:text-slate-300 font-medium">{m.event}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-bold ${m.probability > 0.5 ? 'text-emerald-600 dark:text-emerald-400' : m.probability > 0.2 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {fmtPct(m.probability)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-500 dark:text-slate-400">{m.typicalTiming_years.toFixed(1)}yr</td>
                        <td className="py-2 px-3 text-right text-neutral-500 dark:text-slate-400">{m.typicalValue_pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Narrative text={fm.milestoneProbabilities.narrative} />
            </ModulePanel>
          )}

          {/* Tier 2: Deal economics — closed by default */}
          {fm.earnoutValuation && (
            <ModulePanel
              title="Earnout & CVR Valuation"
              subtitle="Contingent payment probability weighting and time value"
              icon={<DollarSign className="w-5 h-5 text-white" />}
              gradient="from-amber-500 to-yellow-500"
            >
              <KpiGrid>
                <Kpi label="Contingent Value" value={fmtM(fm.earnoutValuation.probabilityWeightedValue_M)} accent="teal" />
                <Kpi label="Upfront Equivalent" value={fmtM(fm.earnoutValuation.upfrontEquivalent_M)} accent="blue" />
                <Kpi label="Earnout % of Total" value={fmtPct(fm.earnoutValuation.earnoutAsPercentOfTotal)} accent="purple" />
              </KpiGrid>
              {fm.earnoutValuation.tranches.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 dark:border-slate-700 mb-3">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-50 dark:bg-slate-800">
                      <tr className="text-neutral-400 dark:text-slate-500">
                        <th className="text-left py-2 px-3 font-semibold">Trigger</th>
                        <th className="text-right py-2 px-3 font-semibold">Value</th>
                        <th className="text-right py-2 px-3 font-semibold">Prob</th>
                        <th className="text-right py-2 px-3 font-semibold">Discounted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                      {fm.earnoutValuation.tranches.map((t, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 text-neutral-700 dark:text-slate-300 font-medium">{t.trigger}</td>
                          <td className="py-2 px-3 text-right text-neutral-900 dark:text-white">{fmtM(t.value_M)}</td>
                          <td className="py-2 px-3 text-right text-neutral-500">{fmtPct(t.probability)}</td>
                          <td className="py-2 px-3 text-right font-bold text-teal-600 dark:text-teal-400">{fmtM(t.discountedValue_M)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Narrative text={fm.earnoutValuation.narrative} />
            </ModulePanel>
          )}

          {fm.patentDynamics && (
            <ModulePanel
              title="Patent & LOE Dynamics"
              subtitle="Patent term adjustments, exclusivity layers, generic erosion"
              icon={<FileText className="w-5 h-5 text-white" />}
              gradient="from-violet-500 to-indigo-500"
            >
              <KpiGrid>
                <Kpi label="Effective LOE" value={`${fm.patentDynamics.effectiveLOE_yearsFromApproval.toFixed(1)} yrs`} sub="from approval" accent="blue" />
                <Kpi label="PTA Extension" value={`+${fm.patentDynamics.ptaAdjustment_years.toFixed(1)} yrs`} accent="emerald" />
                <Kpi label="PTE Extension" value={`+${fm.patentDynamics.pteAdjustment_years.toFixed(1)} yrs`} accent="emerald" />
                <Kpi label="Year 1 Generic Erosion" value={fmtPct(fm.patentDynamics.genericEntryProfile.year1erosion)} accent={fm.patentDynamics.genericEntryProfile.year1erosion > 0.5 ? 'rose' : 'amber'} />
              </KpiGrid>
              {fm.patentDynamics.paragraphIVRisk && fm.patentDynamics.paragraphIVRisk.probability > 0 && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg border mb-3 ${fm.patentDynamics.paragraphIVRisk.probability > 0.3 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  <Scale className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span className="text-xs text-neutral-700 dark:text-slate-300">Paragraph IV challenge probability: <strong>{fmtPct(fm.patentDynamics.paragraphIVRisk.probability)}</strong></span>
                </div>
              )}
              <Narrative text={fm.patentDynamics.narrative} />
            </ModulePanel>
          )}

          {fm.cmcRisk && (
            <ModulePanel
              title="Manufacturing & CMC Risk"
              subtitle="Timeline delay, cost multiplier, supply chain, scalability"
              icon={<Factory className="w-5 h-5 text-white" />}
              gradient="from-slate-500 to-zinc-600"
            >
              <KpiGrid>
                <Kpi label="Timeline Delay" value={`+${fm.cmcRisk.additionalTimeline_years.toFixed(1)} yrs`} accent={fm.cmcRisk.additionalTimeline_years > 1 ? 'rose' : 'amber'} />
                <Kpi label="Cost Multiplier" value={`${fm.cmcRisk.manufacturingCostMultiplier.toFixed(1)}x`} accent={fm.cmcRisk.manufacturingCostMultiplier > 2 ? 'rose' : 'amber'} />
                <Kpi label="Supply Chain" value={<RiskBadge level={fm.cmcRisk.supplyChainRisk} /> as any} accent="blue" />
                <Kpi label="Scalability" value={`${fm.cmcRisk.scalabilityScore}/100`} accent={fm.cmcRisk.scalabilityScore < 40 ? 'rose' : fm.cmcRisk.scalabilityScore < 70 ? 'amber' : 'emerald'} />
              </KpiGrid>
              <Narrative text={fm.cmcRisk.narrative} />
            </ModulePanel>
          )}

          {fm.pricingConstraints && (
            <ModulePanel
              title="Pricing & Reimbursement"
              subtitle="ICER/NICE thresholds, IRA exposure, payer dynamics"
              icon={<TrendingUp className="w-5 h-5 text-white" />}
              gradient="from-emerald-500 to-teal-500"
            >
              <KpiGrid>
                <Kpi label="ICER Risk" value={<RiskBadge level={fm.pricingConstraints.icerRisk} /> as any} accent="teal" />
                <Kpi label="Peak Sales Impact" value={`${fm.pricingConstraints.peakSalesAdjustment_pct > 0 ? '-' : ''}${Math.abs(fm.pricingConstraints.peakSalesAdjustment_pct).toFixed(0)}%`} accent={Math.abs(fm.pricingConstraints.peakSalesAdjustment_pct) > 15 ? 'rose' : 'amber'} />
                <Kpi label="Formulary Tier" value={fm.pricingConstraints.formularyTier?.replace(/_/g, ' ') || 'N/A'} accent="blue" />
                {fm.pricingConstraints.iraExposure?.eligible && (
                  <Kpi label="IRA Exposure" value={`-${fm.pricingConstraints.iraExposure.expectedPriceReduction_pct}%`} sub={`from ${fm.pricingConstraints.iraExposure.negotiationYear}`} accent="rose" />
                )}
              </KpiGrid>
              <Narrative text={fm.pricingConstraints.narrative} />
            </ModulePanel>
          )}

          {fm.indicationSequence && fm.indicationSequence.expansionSequence.length > 0 && (
            <ModulePanel
              title="Franchise Expansion"
              subtitle="Indication sequencing with cannibalization modeling"
              icon={<Layers className="w-5 h-5 text-white" />}
              gradient="from-blue-500 to-indigo-500"
            >
              <KpiGrid>
                <Kpi label="Franchise Value" value={fmtM(fm.indicationSequence.totalFranchiseValue_M)} accent="teal" />
                <Kpi label="Franchise Premium" value={`+${fm.indicationSequence.franchisePremium_pct.toFixed(0)}%`} sub="over single indication" accent="emerald" />
                <Kpi label="Expansion Indications" value={`${fm.indicationSequence.expansionSequence.length}`} accent="blue" />
              </KpiGrid>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 dark:border-slate-700 mb-3">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-slate-800">
                    <tr className="text-neutral-400 dark:text-slate-500">
                      <th className="text-left py-2 px-3 font-semibold">Indication</th>
                      <th className="text-right py-2 px-3 font-semibold">Probability</th>
                      <th className="text-right py-2 px-3 font-semibold">Lag</th>
                      <th className="text-right py-2 px-3 font-semibold">Peak Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                    {fm.indicationSequence.expansionSequence.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-neutral-700 dark:text-slate-300 font-medium">{s.indication}</td>
                        <td className="py-2 px-3 text-right font-bold text-neutral-900 dark:text-white">{fmtPct(s.probability)}</td>
                        <td className="py-2 px-3 text-right text-neutral-500">{s.lag_years.toFixed(1)}yr</td>
                        <td className="py-2 px-3 text-right text-teal-600 dark:text-teal-400 font-medium">{fmtM(s.incrementalPeakSales_M)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Narrative text={fm.indicationSequence.narrative} />
            </ModulePanel>
          )}

          {fm.taxStructure && (
            <ModulePanel
              title="Cross-Border Tax Structure"
              subtitle="IP jurisdiction optimization and Pillar Two impact"
              icon={<Globe className="w-5 h-5 text-white" />}
              gradient="from-sky-500 to-blue-500"
            >
              <KpiGrid>
                <Kpi label="Optimal Structure" value={fm.taxStructure.optimalStructure?.charAt(0).toUpperCase() + fm.taxStructure.optimalStructure?.slice(1)} accent="teal" />
                <Kpi label="Tax Savings" value={fmtM(fm.taxStructure.taxSavings_M)} accent="emerald" />
                <Kpi label="Effective Rate" value={fmtPct(fm.taxStructure.effectiveTaxRate)} accent="blue" />
                <Kpi label="Transfer Pricing" value={<RiskBadge level={fm.taxStructure.transferPricingRisk} /> as any} accent="amber" />
              </KpiGrid>
              <Narrative text={fm.taxStructure.narrative} />
            </ModulePanel>
          )}

          {fm.royaltyStacking && (
            <ModulePanel
              title="Royalty Stacking Analysis"
              subtitle="Upstream IP obligations and net royalty impact"
              icon={<Scale className="w-5 h-5 text-white" />}
              gradient="from-orange-500 to-red-500"
            >
              <KpiGrid>
                <Kpi label="Gross Royalty" value={fmtPct(fm.royaltyStacking.netRoyaltyRate + fm.royaltyStacking.totalUpstreamBurden)} accent="blue" />
                <Kpi label="Upstream Burden" value={`-${fmtPct(fm.royaltyStacking.totalUpstreamBurden)}`} accent="rose" />
                <Kpi label="Net Royalty" value={fmtPct(fm.royaltyStacking.netRoyaltyRate)} accent="teal" />
                <Kpi label="Deal Value Impact" value={`-${fm.royaltyStacking.impactOnDealValue_pct.toFixed(0)}%`} accent="rose" />
              </KpiGrid>
              <Narrative text={fm.royaltyStacking.narrative} />
            </ModulePanel>
          )}

          {fm.buyerSynergies && fm.buyerSynergies.length > 0 && (
            <ModulePanel
              title="Buyer Synergy Analysis"
              subtitle="Acquirer-specific synergy premiums and integration risk"
              icon={<Users className="w-5 h-5 text-white" />}
              gradient="from-fuchsia-500 to-pink-500"
            >
              <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-slate-700 mb-3">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-neutral-50 dark:bg-slate-800">
                    <tr className="text-neutral-400 dark:text-slate-500">
                      <th className="text-left py-2 px-3 font-semibold">Buyer</th>
                      <th className="text-right py-2 px-3 font-semibold">Synergy</th>
                      <th className="text-right py-2 px-3 font-semibold">Rev Synergy</th>
                      <th className="text-right py-2 px-3 font-semibold">Cost Synergy</th>
                      <th className="text-right py-2 px-3 font-semibold">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                    {fm.buyerSynergies.map((b, i) => (
                      <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-2 px-3 font-medium text-neutral-700 dark:text-slate-300">{b.synergySources?.[0]?.rationale?.split(' ')[0] || `Buyer ${i + 1}`}</td>
                        <td className="py-2 px-3 text-right font-bold text-teal-600 dark:text-teal-400">+{b.totalSynergyPremium_pct.toFixed(0)}%</td>
                        <td className="py-2 px-3 text-right text-neutral-900 dark:text-white">{fmtM(b.revenueSynergies_M)}</td>
                        <td className="py-2 px-3 text-right text-neutral-500">{fmtM(b.costSynergies_M)}</td>
                        <td className="py-2 px-3 text-right"><RiskBadge level={b.integrationRisk} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {fm.buyerSynergies[0]?.narrative && <Narrative text={fm.buyerSynergies[0].narrative} />}
            </ModulePanel>
          )}
        </div>
      )}
    </div>
  );
}

function Layers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
}
