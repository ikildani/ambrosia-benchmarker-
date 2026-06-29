'use client';

import React, { useState } from 'react';
import type { FinancialModelResult } from '@/lib/financial/run-financial-model';

interface Props {
  financialModel: FinancialModelResult;
  tier: string;
  onBuyReport?: () => void;
}

function Section({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-2 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">{children}</div>}
    </div>
  );
}

function KPI({ label, value, sub, color = 'teal' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    teal: 'border-t-teal-500', rose: 'border-t-rose-500', amber: 'border-t-amber-500',
    purple: 'border-t-purple-500', blue: 'border-t-blue-500', green: 'border-t-green-500',
  };
  return (
    <div className={`flex-1 min-w-[120px] border border-slate-200 dark:border-slate-600 ${colors[color] || colors.teal} border-t-2 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50`}>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Narrative({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">{text}</p>;
}

function fmtPct(v: number, decimals = 1): string { return `${(v * 100).toFixed(decimals)}%`; }
function fmtM(v: number): string { return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`; }

export default function InstitutionalAnalyticsPanel({ financialModel: fm, tier, onBuyReport }: Props) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const hasAny = fm.regulatoryRisk || fm.milestoneProbabilities || fm.taxStructure ||
    fm.royaltyStacking || fm.patentDynamics || fm.cmcRisk || fm.earnoutValuation ||
    fm.pricingConstraints || fm.indicationSequence || (fm.buyerSynergies && fm.buyerSynergies.length > 0);

  if (!hasAny) return null;

  if (!hasAccess) {
    return (
      <div className="mt-6 relative">
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 blur-sm pointer-events-none">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Institutional Analytics</h3>
          <p className="text-sm text-slate-500">10 advanced modules including regulatory risk, milestone probability, patent dynamics, and more.</p>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
          <button onClick={onBuyReport} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Unlock Institutional Analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Institutional Analytics</h3>
        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-gradient-to-r from-teal-500/10 to-cyan-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 rounded-full">10 Modules</span>
      </div>

      {fm.regulatoryRisk && (
        <Section title="FDA Regulatory Risk" icon="🏛️" defaultOpen>
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="CRL Probability" value={fmtPct(fm.regulatoryRisk.crlProbability)} color={fm.regulatoryRisk.crlProbability > 0.15 ? 'rose' : fm.regulatoryRisk.crlProbability > 0.10 ? 'amber' : 'green'} />
            <KPI label="AdComm Required" value={fm.regulatoryRisk.adcommRequired ? 'Likely' : 'Unlikely'} sub={fm.regulatoryRisk.adcommRequired ? `${fmtPct(fm.regulatoryRisk.adcommFavorableVoteProbability)} favorable` : undefined} color={fm.regulatoryRisk.adcommRequired ? 'amber' : 'green'} />
            <KPI label="PDUFA On-Time" value={fmtPct(fm.regulatoryRisk.pdufahRisk.onTime)} color="blue" />
            <KPI label="Timeline Impact" value={`${fm.regulatoryRisk.timelineImpact_years > 0 ? '+' : ''}${fm.regulatoryRisk.timelineImpact_years.toFixed(1)}yr`} color={fm.regulatoryRisk.timelineImpact_years > 0 ? 'rose' : 'green'} />
          </div>
          {fm.regulatoryRisk.prvEligible && <div className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg mb-2">Priority Review Voucher eligible — est. value {fmtM(fm.regulatoryRisk.prvValue_M)}</div>}
          <Narrative text={fm.regulatoryRisk.narrative} />
        </Section>
      )}

      {fm.milestoneProbabilities && (
        <Section title="Milestone Probability" icon="🎯">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="P-Weighted Total" value={`${fm.milestoneProbabilities.probabilityWeightedTotalValue.toFixed(0)}%`} sub="of headline TDV" color="teal" />
            <KPI label="Dev Milestones" value={`${fm.milestoneProbabilities.developmentMilestones.length}`} color="blue" />
            <KPI label="Comm Milestones" value={`${fm.milestoneProbabilities.commercialMilestones.length}`} color="purple" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="text-left py-1.5 font-medium">Milestone</th>
                <th className="text-right py-1.5 font-medium">Prob</th>
                <th className="text-right py-1.5 font-medium">Timing</th>
                <th className="text-right py-1.5 font-medium">Value</th>
              </tr></thead>
              <tbody>
                {fm.milestoneProbabilities.developmentMilestones.map((m, i) => (
                  <tr key={`d-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-1.5 text-slate-700 dark:text-slate-300">{m.event}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900 dark:text-white">{fmtPct(m.probability)}</td>
                    <td className="py-1.5 text-right text-slate-500">{m.typicalTiming_years.toFixed(1)}yr</td>
                    <td className="py-1.5 text-right text-slate-500">{m.typicalValue_pct.toFixed(1)}%</td>
                  </tr>
                ))}
                {fm.milestoneProbabilities.commercialMilestones.map((m, i) => (
                  <tr key={`c-${i}`} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-1.5 text-purple-600 dark:text-purple-400">{m.event}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900 dark:text-white">{fmtPct(m.probability)}</td>
                    <td className="py-1.5 text-right text-slate-500">{m.typicalTiming_years.toFixed(1)}yr</td>
                    <td className="py-1.5 text-right text-slate-500">{m.typicalValue_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Narrative text={fm.milestoneProbabilities.narrative} />
        </Section>
      )}

      {fm.earnoutValuation && (
        <Section title="Earnout & CVR Valuation" icon="💰">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Contingent Value" value={fmtM(fm.earnoutValuation.probabilityWeightedValue_M)} color="teal" />
            <KPI label="Upfront Equivalent" value={fmtM(fm.earnoutValuation.upfrontEquivalent_M)} color="blue" />
            <KPI label="Earnout % of Total" value={fmtPct(fm.earnoutValuation.earnoutAsPercentOfTotal)} color="purple" />
          </div>
          {fm.earnoutValuation.tranches.length > 0 && (
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-1.5 font-medium">Trigger</th>
                  <th className="text-right py-1.5 font-medium">Value</th>
                  <th className="text-right py-1.5 font-medium">Prob</th>
                  <th className="text-right py-1.5 font-medium">Disc. Value</th>
                </tr></thead>
                <tbody>
                  {fm.earnoutValuation.tranches.map((t, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="py-1.5 text-slate-700 dark:text-slate-300">{t.trigger}</td>
                      <td className="py-1.5 text-right text-slate-900 dark:text-white">{fmtM(t.value_M)}</td>
                      <td className="py-1.5 text-right text-slate-500">{fmtPct(t.probability)}</td>
                      <td className="py-1.5 text-right font-medium text-teal-600 dark:text-teal-400">{fmtM(t.discountedValue_M)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Narrative text={fm.earnoutValuation.narrative} />
        </Section>
      )}

      {fm.patentDynamics && (
        <Section title="Patent & LOE Dynamics" icon="📜">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Effective LOE" value={`${fm.patentDynamics.effectiveLOE_yearsFromApproval.toFixed(1)}yr`} sub="from approval" color="blue" />
            <KPI label="PTA Adjustment" value={`+${fm.patentDynamics.ptaAdjustment_years.toFixed(1)}yr`} color="green" />
            <KPI label="PTE Extension" value={`+${fm.patentDynamics.pteAdjustment_years.toFixed(1)}yr`} color="green" />
            <KPI label="Year 1 Erosion" value={fmtPct(fm.patentDynamics.genericEntryProfile.year1erosion)} color={fm.patentDynamics.genericEntryProfile.year1erosion > 0.5 ? 'rose' : 'amber'} />
          </div>
          {fm.patentDynamics.paragraphIVRisk && (
            <div className={`text-xs px-3 py-2 rounded-lg mb-2 ${fm.patentDynamics.paragraphIVRisk.probability > 0.3 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500'}`}>
              Paragraph IV challenge probability: {fmtPct(fm.patentDynamics.paragraphIVRisk.probability)}
            </div>
          )}
          <Narrative text={fm.patentDynamics.narrative} />
        </Section>
      )}

      {fm.cmcRisk && (
        <Section title="Manufacturing & CMC Risk" icon="🏭">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Timeline Delay" value={`+${fm.cmcRisk.additionalTimeline_years.toFixed(1)}yr`} color={fm.cmcRisk.additionalTimeline_years > 1 ? 'rose' : 'amber'} />
            <KPI label="Cost Multiplier" value={`${fm.cmcRisk.manufacturingCostMultiplier.toFixed(1)}x`} color={fm.cmcRisk.manufacturingCostMultiplier > 2 ? 'rose' : 'amber'} />
            <KPI label="Supply Risk" value={fm.cmcRisk.supplyChainRisk} color={fm.cmcRisk.supplyChainRisk === 'critical' ? 'rose' : fm.cmcRisk.supplyChainRisk === 'high' ? 'amber' : 'green'} />
            <KPI label="Scalability" value={`${fm.cmcRisk.scalabilityScore}/100`} color={fm.cmcRisk.scalabilityScore < 40 ? 'rose' : fm.cmcRisk.scalabilityScore < 70 ? 'amber' : 'green'} />
          </div>
          <Narrative text={fm.cmcRisk.narrative} />
        </Section>
      )}

      {fm.pricingConstraints && (
        <Section title="Pricing & Reimbursement" icon="💊">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="ICER Risk" value={fm.pricingConstraints.icerRisk} color={fm.pricingConstraints.icerRisk === 'unfavorable' ? 'rose' : fm.pricingConstraints.icerRisk === 'borderline' ? 'amber' : 'green'} />
            <KPI label="Peak Sales Adj" value={`${fm.pricingConstraints.peakSalesAdjustment_pct > 0 ? '-' : ''}${Math.abs(fm.pricingConstraints.peakSalesAdjustment_pct).toFixed(0)}%`} color={Math.abs(fm.pricingConstraints.peakSalesAdjustment_pct) > 15 ? 'rose' : 'amber'} />
            <KPI label="Formulary Tier" value={fm.pricingConstraints.formularyTier?.replace(/_/g, ' ') || 'N/A'} color="blue" />
            {fm.pricingConstraints.iraExposure?.eligible && <KPI label="IRA Exposure" value={`-${fm.pricingConstraints.iraExposure.expectedPriceReduction_pct}%`} sub={`from ${fm.pricingConstraints.iraExposure.negotiationYear}`} color="rose" />}
          </div>
          <Narrative text={fm.pricingConstraints.narrative} />
        </Section>
      )}

      {fm.indicationSequence && (
        <Section title="Franchise Expansion" icon="🔗">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Franchise Value" value={fmtM(fm.indicationSequence.totalFranchiseValue_M)} color="teal" />
            <KPI label="Franchise Premium" value={`+${fm.indicationSequence.franchisePremium_pct.toFixed(0)}%`} sub="over single indication" color="green" />
            <KPI label="Expansions" value={`${fm.indicationSequence.expansionSequence.length}`} color="blue" />
          </div>
          {fm.indicationSequence.expansionSequence.length > 0 && (
            <div className="max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-1.5 font-medium">Indication</th>
                  <th className="text-right py-1.5 font-medium">Prob</th>
                  <th className="text-right py-1.5 font-medium">Lag</th>
                  <th className="text-right py-1.5 font-medium">Incr. Peak</th>
                </tr></thead>
                <tbody>
                  {fm.indicationSequence.expansionSequence.map((s, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="py-1.5 text-slate-700 dark:text-slate-300">{s.indication}</td>
                      <td className="py-1.5 text-right text-slate-900 dark:text-white">{fmtPct(s.probability)}</td>
                      <td className="py-1.5 text-right text-slate-500">{s.lag_years.toFixed(1)}yr</td>
                      <td className="py-1.5 text-right text-teal-600 dark:text-teal-400">{fmtM(s.incrementalPeakSales_M)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Narrative text={fm.indicationSequence.narrative} />
        </Section>
      )}

      {fm.taxStructure && (
        <Section title="Cross-Border Tax Structure" icon="🌍">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Optimal Structure" value={fm.taxStructure.optimalStructure} color="teal" />
            <KPI label="Tax Savings" value={fmtM(fm.taxStructure.taxSavings_M)} color="green" />
            <KPI label="Effective Rate" value={fmtPct(fm.taxStructure.effectiveTaxRate)} color="blue" />
            <KPI label="Transfer Pricing Risk" value={fm.taxStructure.transferPricingRisk} color={fm.taxStructure.transferPricingRisk === 'high' ? 'rose' : 'amber'} />
          </div>
          <Narrative text={fm.taxStructure.narrative} />
        </Section>
      )}

      {fm.royaltyStacking && (
        <Section title="Royalty Stacking" icon="📊">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <KPI label="Gross Royalty" value={fmtPct(fm.royaltyStacking.grossRoyaltyRate)} color="blue" />
            <KPI label="Upstream Burden" value={`-${fmtPct(fm.royaltyStacking.totalUpstreamBurden)}`} color="rose" />
            <KPI label="Net Royalty" value={fmtPct(fm.royaltyStacking.netRoyaltyRate)} color="teal" />
            <KPI label="Deal Value Impact" value={`-${fm.royaltyStacking.impactOnDealValue_pct.toFixed(0)}%`} color="rose" />
          </div>
          <Narrative text={fm.royaltyStacking.narrative} />
        </Section>
      )}

      {fm.buyerSynergies && fm.buyerSynergies.length > 0 && (
        <Section title="Buyer Synergy Analysis" icon="🤝">
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="text-left py-1.5 font-medium">Buyer</th>
                <th className="text-right py-1.5 font-medium">Synergy</th>
                <th className="text-right py-1.5 font-medium">Rev Syn</th>
                <th className="text-right py-1.5 font-medium">Cost Syn</th>
                <th className="text-right py-1.5 font-medium">Risk</th>
              </tr></thead>
              <tbody>
                {fm.buyerSynergies.map((b, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-1.5 font-medium text-slate-700 dark:text-slate-300">{b.synergySources?.[0]?.rationale?.split(' ')[0] || `Buyer ${i + 1}`}</td>
                    <td className="py-1.5 text-right font-bold text-teal-600 dark:text-teal-400">+{b.totalSynergyPremium_pct.toFixed(0)}%</td>
                    <td className="py-1.5 text-right text-slate-900 dark:text-white">{fmtM(b.revenueSynergies_M)}</td>
                    <td className="py-1.5 text-right text-slate-500">{fmtM(b.costSynergies_M)}</td>
                    <td className="py-1.5 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${b.integrationRisk === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : b.integrationRisk === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{b.integrationRisk}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fm.buyerSynergies[0]?.narrative && <Narrative text={fm.buyerSynergies[0].narrative} />}
        </Section>
      )}
    </div>
  );
}
