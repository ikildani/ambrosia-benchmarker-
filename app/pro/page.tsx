import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import ProCheckoutButton from '@/components/ProCheckoutButton';
import {
  Zap, BarChart3, LineChart, GitBranch, Layers, Network,
  TrendingUp, Repeat, Users, Search, Brain, Activity,
  FileDown, Share2, Check, X, ArrowRight, Shield,
  Building2, Briefcase, ChevronDown, Lock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pro Plan | Unlimited Deal Intelligence | Ambrosia Ventures',
  description:
    'Unlock 14 deal engines, 12 therapeutic areas, and unlimited calculations. rNPV, Monte Carlo, real options, partner matching, and more for biopharma BD professionals.',
  keywords: [
    'biotech deal calculator pro',
    'biopharma deal intelligence platform',
    'pharma licensing analytics tool',
    'rNPV biotech valuation tool',
    'Monte Carlo pharma deal analysis',
    'biopharma partner matching platform',
  ],
  openGraph: {
    title: 'Pro Plan | Unlimited Deal Intelligence | Ambrosia Ventures',
    description: 'Unlock 14 deal engines, 12 therapeutic areas, and unlimited calculations for biopharma deal professionals.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/pro',
    images: [{ url: '/api/og?title=Pro%20Plan&subtitle=Unlimited%20Deal%20Intelligence&type=landing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pro Plan | Unlimited Deal Intelligence',
    description: 'Unlock 14 deal engines, 12 therapeutic areas, and unlimited biopharma deal calculations.',
  },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/pro' },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const comparison = [
  { feature: 'Calculations', free: '3 total', pro: 'Unlimited' },
  { feature: 'Deal term estimates', free: 'Basic ranges', pro: 'Full breakdown with comparables' },
  { feature: 'rNPV analysis', free: false, pro: 'TA-specific curves + index drug validation' },
  { feature: 'Monte Carlo simulation', free: false, pro: 'VaR, CVaR, skewness, kurtosis (P10-P90)' },
  { feature: 'Partner matching', free: '3 basic matches', pro: '10 matches with 10-factor intent scoring' },
  { feature: 'Buyer-specific valuation', free: false, pro: 'Multi-partner comparison (up to 3 buyers)' },
  { feature: 'Scenario comparison', free: false, pro: 'Bear/Base/Bull + compound scenarios' },
  { feature: 'Real options valuation', free: false, pro: 'CRR binomial lattice' },
  { feature: 'Competitive dynamics', free: false, pro: 'Revenue erosion + market access delay' },
  { feature: 'Sensitivity analysis', free: 'Top 3 only', pro: 'All parameters, tornado chart' },
  { feature: 'Peak sales validation', free: false, pro: 'Sanity check vs 164 index drugs' },
  { feature: 'PDF & Excel export', free: false, pro: '20-page reports + workbooks' },
  { feature: 'Share links', free: false, pro: 'Branded dark-theme pages' },
];

const faqs = [
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your account settings at any time. You keep full access through the end of your billing period with no penalties or hidden fees.' },
  { q: 'What\'s included in the annual plan?', a: `Everything in monthly Pro, billed annually at ${PRICING.PRO_ANNUAL_PRICE}/year (${PRICING.PRO_ANNUAL_MONTHLY}). You save ${PRICING.PRO_ANNUAL_SAVINGS} compared to monthly billing.` },
  { q: 'Do I get access to all therapeutic areas?', a: 'Yes. Pro unlocks all 12 therapeutic areas and 562 indications with full deal benchmarks, partner matching, and competitive landscape data.' },
  { q: 'Can I export reports for my deal committee?', a: 'Absolutely. Generate 20-page PDF reports and Excel workbooks with scenario comparison, deal waterfall, real options, competitive dynamics, and buyer-specific valuation. Share via branded links or download directly.' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProPage() {
  const productSchema = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Ambrosia Ventures Pro Plan',
    description: 'Unlimited biopharma deal intelligence with 14 calculation engines, 12 therapeutic areas, and 2,500+ transaction benchmarks.',
    url: 'https://calculator.ambrosiaventures.co/pro',
    brand: { '@type': 'Organization', name: 'Ambrosia Ventures' },
    offers: [
      { '@type': 'Offer', price: PRICING.PRO_PRICE_NUM, priceCurrency: 'USD', priceValidUntil: '2026-12-31', availability: 'https://schema.org/InStock', name: 'Pro Monthly' },
      { '@type': 'Offer', price: PRICING.PRO_ANNUAL_PRICE_NUM, priceCurrency: 'USD', priceValidUntil: '2026-12-31', availability: 'https://schema.org/InStock', name: 'Pro Annual' },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Pro' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="min-h-screen bg-[#0a0f1a]">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO — Dark, cinematic, product-forward
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative pt-28 pb-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_50%,rgba(99,102,241,0.08),transparent)]" />

          <div className="relative max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6">
                  <Zap className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Pro Plan</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                  The deal intelligence<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">your committee expects.</span>
                </h1>

                <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-lg">
                  14 engines. 12 therapeutic areas. {DEAL_STATS.TOTAL_DEALS} transactions.
                  Run rNPV, Monte Carlo, scenario modeling, and buyer-specific valuation — in under 30 seconds.
                </p>

                {/* Price */}
                <div className="mt-8 flex items-center gap-6">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">{PRICING.PRO_PRICE}</span>
                      <span className="text-slate-500">/mo</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">or {PRICING.PRO_ANNUAL_MONTHLY} billed annually</p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold bg-teal-500/15 text-teal-400 rounded-full border border-teal-500/20">
                    Save {PRICING.PRO_ANNUAL_SAVINGS}/yr
                  </span>
                </div>

                {/* CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <ProCheckoutButton
                    billingInterval="monthly"
                    className="px-7 py-3.5 bg-teal-500 text-white text-base shadow-lg shadow-teal-500/25 hover:bg-teal-400 hover:-translate-y-0.5"
                  />
                  <Link
                    href="/calculator"
                    className="inline-flex items-center gap-2 px-7 py-3.5 text-slate-300 font-medium rounded-xl hover:text-white hover:bg-white/5 transition-all border border-white/10"
                  >
                    Try a free calculation first
                  </Link>
                </div>
              </div>

              {/* Right: Product mockup — rNPV KPI cards */}
              <div className="hidden lg:block">
                <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl p-6 shadow-2xl shadow-black/40">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                    <span className="text-xs text-slate-500 font-medium">Phase 2 ADC — Oncology (Solid Tumor)</span>
                  </div>

                  {/* KPI Row */}
                  <div className="grid grid-cols-4 gap-2.5 mb-4">
                    {[
                      { label: 'Total rNPV', value: '$312M', sub: '+$87M option value', color: 'text-teal-400', bg: 'from-teal-500/10 to-cyan-500/10', border: 'border-teal-500/20' },
                      { label: 'Cumulative PoS', value: '24.3%', color: 'text-white', bg: 'from-slate-700/50 to-slate-700/50', border: 'border-slate-600' },
                      { label: 'Ann. Return', value: '18.4%', color: 'text-white', bg: 'from-slate-700/50 to-slate-700/50', border: 'border-slate-600' },
                      { label: 'Payback', value: '10.7y', color: 'text-white', bg: 'from-slate-700/50 to-slate-700/50', border: 'border-slate-600' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`p-2.5 bg-gradient-to-br ${kpi.bg} rounded-lg border ${kpi.border} text-center`}>
                        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{kpi.label}</p>
                        <p className={`text-base font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                        {kpi.sub && <p className="text-[9px] font-mono text-teal-500 mt-0.5">{kpi.sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Valuation Summary Row */}
                  <div className="grid grid-cols-5 gap-1.5 p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/50 mb-4">
                    {[
                      { label: 'rNPV', value: '$312M', color: 'text-teal-400' },
                      { label: 'Implied Deal', value: '$245M', color: 'text-white' },
                      { label: 'Expected Value', value: '$287M', color: 'text-white' },
                      { label: 'Monte Carlo P50', value: '$298M', color: 'text-white' },
                      { label: 'Bear Floor', value: '$85M', color: 'text-amber-400' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center">
                        <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-xs font-bold font-mono ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Monte Carlo mini-chart mockup */}
                  <div className="bg-slate-800/20 rounded-lg border border-slate-700/30 p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Monte Carlo Distribution (10,000 iterations)</span>
                      <span className="text-[10px] text-teal-400 font-mono">87% Prob NPV &gt; 0</span>
                    </div>
                    <svg viewBox="0 0 400 80" className="w-full" xmlns="http://www.w3.org/2000/svg">
                      {/* Simplified histogram bars */}
                      {[8,14,22,35,52,68,80,72,58,42,30,20,14,9,6,4,3,2,1,1].map((h, i) => (
                        <rect key={i} x={i * 20} y={80 - h} width={16} height={h} rx={2}
                          fill={i < 5 ? '#f59e0b33' : '#0d948866'} stroke={i < 5 ? '#f59e0b44' : '#0d948877'} strokeWidth={0.5} />
                      ))}
                      {/* P50 line */}
                      <line x1={140} y1={0} x2={140} y2={80} stroke="#2dd4bf" strokeWidth={1.5} strokeDasharray="4 2" />
                      <text x={142} y={10} fill="#2dd4bf" fontSize={8} fontFamily="ui-monospace">P50: $298M</text>
                    </svg>
                  </div>

                  {/* Risk metrics row */}
                  <div className="grid grid-cols-4 gap-1.5 p-2.5 bg-slate-800/20 rounded-lg border border-slate-700/30 mb-4">
                    <div className="text-center">
                      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">VaR (95%)</p>
                      <p className="text-xs font-bold font-mono text-rose-400">-$42M</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">CVaR (95%)</p>
                      <p className="text-xs font-bold font-mono text-rose-400">-$78M</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Skewness</p>
                      <p className="text-xs font-bold font-mono text-teal-400">+0.84</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Tail Risk</p>
                      <p className="text-xs font-bold font-mono text-amber-400">Moderate</p>
                    </div>
                  </div>

                  {/* Index drug check */}
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 mb-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[10px] text-slate-400">Peak sales vs index:</span>
                    <span className="text-[10px] text-white font-medium">Padcev ($4.2B)</span>
                    <span className="text-[10px] text-emerald-400 font-mono ml-auto">32% of index — credible</span>
                  </div>

                  {/* Partner match preview */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-800/20 rounded-lg border border-slate-700/30">
                    <Users className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    <span className="text-[10px] text-slate-400">Top Match:</span>
                    <span className="text-[10px] text-white font-medium">AstraZeneca</span>
                    <span className="text-[10px] text-teal-400 font-mono ml-auto">92% fit</span>
                    <span className="text-[10px] text-slate-600 mx-1">|</span>
                    <span className="text-[10px] text-amber-400 font-mono">Intent: 78</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PRODUCT SHOWCASE — 3 hero features with mockups
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white">See What Pro Unlocks</h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">Every feature designed for deal committees, not dashboards.</p>
            </div>

            {/* Feature 1: Scenario Comparison */}
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full mb-4">
                  <Layers className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-violet-300 font-medium">Scenario Comparison</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Bear, Base, and Bull — side by side</h3>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Model three scenarios simultaneously with different PoS, peak sales, and discount rate assumptions. See the probability-weighted expected value across all outcomes.
                </p>
                <ul className="space-y-2">
                  {['Scenario-specific rNPV with custom assumptions', 'Compound scenarios — CRL + competitor launch, pricing squeeze + early generics', 'Probability-weighted expected value across all outcomes', 'Tornado chart: top 5 risks and top 5 upsides, ranked by dollar impact'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Mockup */}
              <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Scenario Comparison</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Bear', rnpv: '$85M', deal: '$28M', fill: '#f87171', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: 'Base', rnpv: '$312M', deal: '$95M', fill: '#2dd4bf', bg: 'bg-teal-500/10 border-teal-500/20' },
                    { label: 'Bull', rnpv: '$890M', deal: '$310M', fill: '#34d399', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                  ].map(s => (
                    <div key={s.label} className={`p-3 rounded-lg border ${s.bg} text-center`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: s.fill }}>{s.label}</p>
                      <p className="text-lg font-bold font-mono text-white">{s.rnpv}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Deal: {s.deal}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-2.5 bg-slate-800/30 rounded-lg text-center">
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider">Probability-Weighted Expected Value</p>
                  <p className="text-sm font-bold font-mono text-teal-400">$287M</p>
                </div>
              </div>
            </div>

            {/* Feature 2: Buyer-Specific Valuation */}
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
              {/* Mockup first (left) */}
              <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-5 order-2 lg:order-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Buyer-Specific Valuation</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-700/20 border border-slate-600/30 rounded-lg text-center">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Generic Buyer</p>
                    <p className="text-lg font-bold font-mono text-slate-400">$245M</p>
                    <p className="text-[10px] text-slate-600 mt-1">Upfront: $65M</p>
                  </div>
                  <div className="p-3 bg-teal-900/20 border border-teal-500/20 rounded-lg text-center">
                    <p className="text-[9px] text-teal-400 uppercase tracking-wider mb-2">AstraZeneca</p>
                    <p className="text-lg font-bold font-mono text-teal-400">$340M</p>
                    <p className="text-[10px] text-teal-600 mt-1">+39% premium</p>
                  </div>
                  <div className="p-3 bg-violet-900/20 border border-violet-500/20 rounded-lg text-center">
                    <p className="text-[9px] text-violet-400 uppercase tracking-wider mb-2">Novartis</p>
                    <p className="text-lg font-bold font-mono text-violet-400">$295M</p>
                    <p className="text-[10px] text-violet-600 mt-1">+20% premium</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-800/30 rounded-lg text-center">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Negotiation Leverage</p>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">STRONG</span>
                  </div>
                  <div className="p-2 bg-slate-800/30 rounded-lg text-center">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Upfront Premium</p>
                    <span className="text-xs font-bold font-mono text-teal-400">+$28M</span>
                  </div>
                </div>
              </div>
              {/* Copy */}
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full mb-4">
                  <Users className="w-3 h-3 text-teal-400" />
                  <span className="text-xs text-teal-300 font-medium">Buyer-Specific Valuation</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Know what each buyer will pay — before the meeting</h3>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Compare Generic vs. up to 3 specific buyers side-by-side. The 5-factor strategic premium model accounts for portfolio fit, deal urgency, patent cliff pressure, pipeline gaps, and competitive pressure.
                </p>
                <ul className="space-y-2">
                  {['10-factor Pharma Intent Score per buyer', 'Strategic premium capped at +75% (calibrated from 2,500+ deals)', 'Negotiation leverage assessment', 'Timing advantage analysis'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Feature 3: Partner Matching + Intent */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
                  <Brain className="w-3 h-3 text-amber-400" />
                  <span className="text-xs text-amber-300 font-medium">Partner Matching + Pharma Intent</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">850+ companies ranked by fit and acquisition intent</h3>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Our partner matching engine scores companies across modality alignment, pipeline gaps, patent cliff pressure, and deal velocity. The 10-factor Pharma Intent Score predicts who is most likely to transact in the next 12-18 months.
                </p>
                <ul className="space-y-2">
                  {['Patent cliff revenue-at-risk analysis', 'Pipeline gap detection from ClinicalTrials.gov', 'Deal velocity and serial acquirer tracking', 'Timing probability windows (6mo / 12mo / 18mo)'].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Mockup */}
              <div className="bg-[#0d1420] border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">Top Partner Matches</p>
                <div className="space-y-2">
                  {[
                    { rank: 1, name: 'AstraZeneca', score: 92, intent: 78, timing: 'Near-term', deals: 8 },
                    { rank: 2, name: 'Novartis', score: 87, intent: 71, timing: 'Medium-term', deals: 5 },
                    { rank: 3, name: 'Merck', score: 84, intent: 65, timing: 'Near-term', deals: 12 },
                    { rank: 4, name: 'BMS', score: 79, intent: 58, timing: 'Speculative', deals: 3 },
                    { rank: 5, name: 'Sanofi', score: 76, intent: 52, timing: 'Medium-term', deals: 4 },
                  ].map(p => (
                    <div key={p.name} className="flex items-center gap-3 p-2.5 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-teal-500/20 transition-colors">
                      <span className="text-[10px] text-slate-600 font-mono w-4">{p.rank}</span>
                      <Building2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      <span className="text-xs text-white font-medium flex-1">{p.name}</span>
                      <span className="text-[10px] text-teal-400 font-mono">{p.score}%</span>
                      <span className="text-[10px] text-slate-600">|</span>
                      <span className="text-[10px] text-amber-400 font-mono">Intent: {p.intent}</span>
                      <span className="text-[10px] text-slate-600">|</span>
                      <span className="text-[10px] text-slate-500 capitalize">{p.timing}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            ALL 14 ENGINES — compact grid
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white">14 Engines. One Platform.</h2>
              <p className="mt-3 text-slate-500 max-w-xl mx-auto">Every engine runs in under 400ms. Results populate instantly.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {[
                { icon: Zap, label: 'Deal Terms' },
                { icon: BarChart3, label: 'rNPV' },
                { icon: LineChart, label: 'Monte Carlo' },
                { icon: Activity, label: 'Sensitivity' },
                { icon: Search, label: 'Partners' },
                { icon: TrendingUp, label: 'Competitive' },
                { icon: GitBranch, label: 'Waterfall' },
                { icon: Layers, label: 'Scenarios' },
                { icon: Network, label: 'Real Options' },
                { icon: Repeat, label: 'Lifecycle' },
                { icon: Users, label: 'Buyer-Specific' },
                { icon: Brain, label: 'Intent Score' },
                { icon: FileDown, label: 'PDF/Excel' },
                { icon: Share2, label: 'Share Links' },
              ].map(e => (
                <div key={e.label} className="flex flex-col items-center gap-2 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:border-teal-500/20 hover:bg-white/[0.04] transition-all">
                  <e.icon className="w-4 h-4 text-teal-500" />
                  <span className="text-[11px] text-slate-400 font-medium text-center">{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FREE vs PRO — comparison table
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white">Free vs Pro</h2>
              <p className="mt-3 text-slate-500">See exactly what you unlock.</p>
            </div>
            <div className="bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 text-sm font-semibold">
                <div className="px-6 py-4 text-slate-500">Feature</div>
                <div className="px-6 py-4 text-center text-slate-500">Free</div>
                <div className="px-6 py-4 text-center text-teal-400 bg-teal-500/5 border-b border-teal-500/10">Pro</div>
              </div>
              {comparison.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-3 text-sm ${i < comparison.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                  <div className="px-6 py-3.5 text-slate-300 font-medium">{row.feature}</div>
                  <div className="px-6 py-3.5 text-center flex items-center justify-center">
                    {row.free === false ? (
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                    ) : (
                      <span className="text-slate-500 text-xs">{row.free}</span>
                    )}
                  </div>
                  <div className="px-6 py-3.5 text-center bg-teal-500/[0.03] flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    <span className="text-slate-200 text-xs">{row.pro}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            WHO USES PRO
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04] bg-[#080d16]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold text-white">Built for the People Making the Decisions</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Briefcase, title: 'BD Teams', subtitle: 'Active out-licensing', desc: 'Model every scenario before you walk into the room. Compare partner offers side-by-side with buyer-specific assumptions.' },
                { icon: Shield, title: 'Deal Committees', subtitle: 'Evaluating inbound offers', desc: 'Generate board-ready reports in minutes. rNPV, Monte Carlo, and sensitivity analysis give your committee quantitative rigor.' },
                { icon: Building2, title: 'Investors & Advisors', subtitle: 'Portfolio valuations', desc: 'Stress-test deal economics across bear/base/bull. Real options valuation captures the optionality your DCF models miss.' },
              ].map(uc => (
                <div key={uc.title} className="p-6 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-teal-500/15 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4">
                    <uc.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{uc.title}</h3>
                  <p className="text-xs text-teal-400 font-medium mb-3">{uc.subtitle}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            FAQ
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04]">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Questions</h2>
            <div className="space-y-3">
              {faqs.map(faq => (
                <details key={faq.q} className="group bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                    <span className="font-medium text-slate-200 text-sm">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="px-6 pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM CTA
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-4 border-t border-white/[0.04] bg-gradient-to-b from-[#0a0f1a] to-[#0d1420]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Stop guessing. Start benchmarking.
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              {DEAL_STATS.TOTAL_DEALS} transactions. 14 engines. Under 30 seconds.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="text-center">
                <span className="text-3xl font-bold text-white">{PRICING.PRO_MONTHLY}</span>
                <p className="text-sm text-slate-500 mt-1">or {PRICING.PRO_ANNUAL_MONTHLY} annually</p>
              </div>
              <ProCheckoutButton
                billingInterval="monthly"
                className="px-8 py-4 bg-teal-500 text-white text-lg shadow-lg shadow-teal-500/25 hover:bg-teal-400 hover:-translate-y-0.5"
              />
            </div>
            <p className="mt-6 text-sm text-slate-600">Cancel anytime. No contracts.</p>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
