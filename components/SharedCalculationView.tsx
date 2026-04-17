'use client';

import { CalculationResult, formatCurrency, formatRange } from '@/lib/calculations';

interface FinancialSummary {
  riskAdjustedNPV: number;
  confidenceInterval80: { low: number; high: number };
  cumulativePoS: number;
}

interface SharedCalculationViewProps {
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
  /** R24: when present, renders rNPV headline + 80% CI band + cumulative PoS at the top. */
  financialSummary?: FinancialSummary | null;
}

function Icon({ children, v = 'teal' }: { children: React.ReactNode; v?: 'teal' | 'emerald' | 'cyan' }) {
  const bg = { teal: 'from-teal-500 to-cyan-500', emerald: 'from-emerald-500 to-emerald-400', cyan: 'from-cyan-500 to-blue-500' }[v];
  return (
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center shadow-sm shadow-black/20 flex-shrink-0`}>
      <div className="text-white w-5 h-5">{children}</div>
    </div>
  );
}

function Tag({ children, c = 'teal' }: { children: React.ReactNode; c?: string }) {
  const cls = c === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : c === 'cyan' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-teal-500/10 text-teal-400 border-teal-500/20';
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${cls}`}>{children}</span>;
}

function Bar({ pct, color = 'from-teal-500 to-cyan-400' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-4">
      <div className={`h-full bg-gradient-to-r ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function SharedCalculationView({ results, labels, financialSummary }: SharedCalculationViewProps) {
  const { terms, tieredRoyalties, dealRecommendation, modifiers } = results;
  const maxVal = terms.totalDealValue.high || 1;

  return (
    <div className="space-y-4">
      {/* ── Valuation Headline (R24): rNPV + 80% CI band + PoS ── */}
      {financialSummary && (
        <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-teal-500/[0.08] to-cyan-500/[0.04] border border-teal-500/[0.15]">
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <div className="flex items-center gap-3">
              <Icon>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Icon>
              <div>
                <p className="text-sm font-semibold text-slate-300">Risk-Adjusted NPV (rNPV)</p>
                <p className="hidden md:block text-[11px] text-slate-500 mt-0.5">Valuation with 80% confidence band (P10 – P90) from Monte Carlo</p>
              </div>
            </div>
            <Tag>Institutional</Tag>
          </div>
          {/* Mobile: stacked layout. Desktop: grid */}
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-5 md:items-end">
            <div className="md:col-span-2">
              <p className="text-3xl md:text-4xl lg:text-5xl font-black text-teal-400 tracking-tight font-mono">
                {formatCurrency(financialSummary.riskAdjustedNPV)}
              </p>
            </div>
            {/* CI band — full width on mobile */}
            <div className="md:hidden rounded-lg bg-white/[0.04] border border-white/[0.06] p-3">
              <p className="text-lg font-semibold text-slate-300 font-mono">
                80% CI: {formatCurrency(financialSummary.confidenceInterval80.low)} – {formatCurrency(financialSummary.confidenceInterval80.high)}
              </p>
              <p className="text-xs text-slate-500 mt-1">P10 – P90 from Monte Carlo simulation</p>
            </div>
            <p className="hidden md:block text-sm text-slate-400 mt-2 font-mono md:col-span-2">
              80% CI: <span className="text-slate-300">{formatCurrency(financialSummary.confidenceInterval80.low)} – {formatCurrency(financialSummary.confidenceInterval80.high)}</span>
            </p>
            <div className="text-left md:text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cumulative PoS</p>
              <p className="text-2xl font-black text-white tracking-tight font-mono">
                {Math.round(financialSummary.cumulativePoS * 100)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 md:p-6 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:border-teal-500/20 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Icon>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </Icon>
              <p className="text-sm font-semibold text-slate-400">Upfront Payment</p>
            </div>
            <Tag>Guaranteed</Tag>
          </div>
          <p className="text-2xl md:text-3xl font-black text-white tracking-tight">{formatRange(terms.upfront)}</p>
          <p className="text-sm text-slate-500 mt-1.5">Expected: <span className="font-bold text-teal-400">{formatCurrency(terms.upfront.median)}</span></p>
          <Bar pct={Math.round((terms.upfront.median / maxVal) * 100)} />
        </div>

        <div className="p-4 md:p-6 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:border-emerald-500/20 transition-colors">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Icon v="emerald">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </Icon>
              <p className="text-sm font-semibold text-slate-400">Total Deal Value</p>
            </div>
            <Tag c="emerald">Potential</Tag>
          </div>
          <p className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight">{formatRange(terms.totalDealValue)}</p>
          <p className="text-sm text-slate-500 mt-1.5">Expected: <span className="font-bold text-emerald-400">{formatCurrency(terms.totalDealValue.median)}</span></p>
          <Bar pct={85} color="from-emerald-500 to-emerald-400" />
        </div>
      </div>

      {/* ── Deal Structure ── */}
      <div className="p-6 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
        <div className="flex items-start gap-4">
          <Icon>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </Icon>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommended Structure</p>
            <p className="text-xl font-black text-white tracking-tight">
              {dealRecommendation.upfrontPercent}% Upfront / {dealRecommendation.milestonePercent}% Milestones
            </p>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{dealRecommendation.rationale}</p>
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden h-2.5 mt-5">
          <div className="bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${dealRecommendation.upfrontPercent}%` }} />
          <div className="bg-white/[0.06] flex-1" />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
          <span>Upfront ({dealRecommendation.upfrontPercent}%)</span>
          <span>Milestones ({dealRecommendation.milestonePercent}%)</span>
        </div>
      </div>

      {/* ── Milestones ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { label: 'Development', data: terms.devMilestones, tag: 'If Achieved', v: 'cyan' as const, bar: 'from-cyan-500 to-blue-400', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg> },
          { label: 'Regulatory', data: terms.regMilestones, tag: 'Upon Approval', v: 'teal' as const, bar: 'from-teal-500 to-cyan-400', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
          { label: 'Commercial', data: terms.commMilestones, tag: 'Sales-Based', v: 'cyan' as const, bar: 'from-cyan-500 to-teal-400', icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        ]).map(({ label, data, tag, v, bar, icon }) => (
          <div key={label} className="p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.1] transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Icon v={v}>{icon}</Icon>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
              <Tag c={v}>{tag}</Tag>
            </div>
            <p className="text-xl font-black text-white tracking-tight">{formatRange(data)}</p>
            <p className="text-xs text-slate-600 mt-1">Expected: <span className="font-semibold text-slate-400">{formatCurrency(data.median)}</span></p>
            <Bar pct={Math.round((data.median / maxVal) * 100)} color={bar} />
          </div>
        ))}
      </div>

      {/* ── Royalties ── */}
      <div className="p-6 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
        <div className="flex items-center gap-3 mb-5">
          <Icon>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </Icon>
          <div>
            <p className="text-sm font-semibold text-slate-400">Tiered Royalties</p>
            <p className="text-xs text-slate-600">Escalating on net sales thresholds</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            { label: 'Base (<$500M)', data: tieredRoyalties.base, hl: false },
            { label: 'Mid ($500M–$1B)', data: tieredRoyalties.midTier, hl: false },
            { label: 'High (>$1B)', data: tieredRoyalties.highTier, hl: true },
          ]).map(({ label, data, hl }) => (
            <div key={label} className={`p-4 rounded-xl text-center ${hl ? 'bg-teal-500/[0.06] border border-teal-500/[0.12]' : 'bg-white/[0.04] border border-white/[0.07]'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${hl ? 'text-teal-400/70' : 'text-slate-600'}`}>{label}</p>
              <p className={`text-2xl font-black tracking-tight ${hl ? 'text-teal-400' : 'text-white'}`}>{data.low}–{data.high}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modifiers ── */}
      {modifiers.length > 0 && (
        <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08]">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Valuation Adjustments</p>
          <div className="flex flex-wrap gap-2">
            {modifiers.map((mod, idx) => (
              <span key={idx} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                mod.multiplier > 1 ? 'bg-teal-500/[0.06] text-teal-400 border-teal-500/20'
                : mod.multiplier < 1 ? 'bg-amber-500/[0.06] text-amber-400 border-amber-500/20'
                : 'bg-white/[0.03] text-slate-400 border-white/[0.06]'
              }`}>
                {mod.name}
                {mod.multiplier !== 1 && <span className="font-black">({mod.multiplier > 1 ? '+' : ''}{Math.round((mod.multiplier - 1) * 100)}%)</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Locked Sections ── */}
      <div className="space-y-3 mt-6">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Included in Full Report</p>

        {([
          { title: 'Comparable Transactions', desc: 'Real deals from SEC filings and press releases matched to this asset profile' },
          { title: 'Sensitivity Analysis', desc: 'How upfronts and milestones shift with changes in phase, competitive position, and data quality' },
          { title: 'Partner Matching', desc: 'Ranked list of 850+ pharma/biotech companies actively acquiring in this therapeutic area' },
          { title: 'Negotiation Playbook', desc: 'AI-generated strategic recommendations, risk factors, and leverage points for your term sheet' },
        ]).map(({ title, desc }) => (
          <div key={title} className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-300">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-600 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              $499 Report
            </span>
          </div>
        ))}
      </div>

      {/* ── Bottom CTA — thumb-reachable on mobile ── */}
      <div className="mt-8 p-4 md:p-6 rounded-2xl bg-gradient-to-br from-teal-500/[0.08] to-cyan-500/[0.04] border border-teal-500/[0.15] text-center">
        <p className="text-sm font-semibold text-slate-300 mb-2">Get the full analysis for this asset</p>
        <p className="text-xs text-slate-500 mb-4">Comparable deals, sensitivity analysis, negotiation playbook, and board-ready PDF</p>
        <a
          href="https://calculator.ambrosiaventures.co/calculator"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 text-sm"
        >
          Run your own benchmark
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>

      {/* ── Disclaimer ── */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 text-[11px] text-slate-500 leading-relaxed mt-6">
        <strong className="text-slate-600">Disclaimer:</strong> Estimates derived from 2,500+ biopharma transactions. For informational purposes only — not financial or legal advice.
      </div>
    </div>
  );
}
