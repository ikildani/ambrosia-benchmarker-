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
  { feature: 'Company profiles (850+)', free: 'Names & types only', pro: 'Full deal history, pipeline, patent cliffs' },
  { feature: 'Market Pulse (weekly)', free: false, pro: 'Deal activity, benchmarks, trend analysis' },
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
            BEYOND THE CALCULATOR — Company Intelligence + Market Pulse
        ═══════════════════════════════════════════════════════════════════ */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes btc-fade-up {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes btc-fade-up-2 {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes btc-pulse-glow {
            0%, 100% { box-shadow: 0 0 8px rgba(13,148,136,0.15); }
            50% { box-shadow: 0 0 20px rgba(13,148,136,0.3); }
          }
          @keyframes btc-pulse-glow-indigo {
            0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.15); }
            50% { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
          }
          @keyframes btc-border-shimmer {
            0% { border-color: rgba(13,148,136,0.1); }
            50% { border-color: rgba(13,148,136,0.3); }
            100% { border-color: rgba(13,148,136,0.1); }
          }
          @keyframes btc-border-shimmer-indigo {
            0% { border-color: rgba(99,102,241,0.1); }
            50% { border-color: rgba(99,102,241,0.3); }
            100% { border-color: rgba(99,102,241,0.1); }
          }
          @keyframes btc-bar-grow {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          @keyframes btc-number-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .btc-card-teal {
            transition: all 0.3s ease;
          }
          .btc-card-teal:hover {
            border-color: rgba(13,148,136,0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 40px rgba(13,148,136,0.12), 0 0 0 1px rgba(13,148,136,0.15);
          }
          .btc-card-indigo {
            transition: all 0.3s ease;
          }
          .btc-card-indigo:hover {
            border-color: rgba(99,102,241,0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 40px rgba(99,102,241,0.12), 0 0 0 1px rgba(99,102,241,0.15);
          }
          .btc-stagger-1 { animation: btc-fade-up 0.6s ease both; animation-delay: 0.1s; }
          .btc-stagger-2 { animation: btc-fade-up 0.6s ease both; animation-delay: 0.2s; }
          .btc-stagger-3 { animation: btc-fade-up 0.6s ease both; animation-delay: 0.3s; }
          .btc-stagger-4 { animation: btc-fade-up 0.6s ease both; animation-delay: 0.4s; }
          .btc-stagger-5 { animation: btc-fade-up 0.6s ease both; animation-delay: 0.5s; }
          .btc-stagger-6 { animation: btc-fade-up-2 0.6s ease both; animation-delay: 0.15s; }
          .btc-stagger-7 { animation: btc-fade-up-2 0.6s ease both; animation-delay: 0.25s; }
          .btc-stagger-8 { animation: btc-fade-up-2 0.6s ease both; animation-delay: 0.35s; }
          .btc-stagger-9 { animation: btc-fade-up-2 0.6s ease both; animation-delay: 0.45s; }
          .btc-metric-live {
            animation: btc-number-pulse 3s ease-in-out infinite;
          }
          .btc-bar-animate {
            transform-origin: left;
            animation: btc-bar-grow 1s ease both;
          }
          .btc-bar-animate-d1 { animation-delay: 0.2s; }
          .btc-bar-animate-d2 { animation-delay: 0.35s; }
          .btc-bar-animate-d3 { animation-delay: 0.5s; }
          .btc-bar-animate-d4 { animation-delay: 0.65s; }
        `}} />
        <section className="py-24 px-4 border-t border-white/[0.04] relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_50%,rgba(13,148,136,0.06),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_80%_50%,rgba(99,102,241,0.06),transparent)]" />

          <div className="relative max-w-6xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pro Exclusive Intelligence</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15]">
                Your Edge Between<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400">Board Meetings</span>
              </h2>
              <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Two intelligence platforms that monitor 850+ companies and every deal that moves — so you walk into every meeting knowing what changed.
              </p>
            </div>

            {/* ── Company Intelligence ── */}
            <div className="btc-card-teal bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden mb-8">
              <div className="grid lg:grid-cols-2">
                {/* Left: Detailed company profile mockup */}
                <div className="relative p-5 sm:p-6 bg-gradient-to-br from-[#0a1018] to-[#0d1420] overflow-hidden min-h-[420px]">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_20%,rgba(13,148,136,0.08),transparent)]" />

                  {/* Floating badges */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                    <div className="btc-stagger-1 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full backdrop-blur-sm" style={{ animation: 'btc-fade-up 0.6s ease both, btc-border-shimmer 3s ease-in-out infinite' }}>
                      <span className="text-[10px] font-semibold text-teal-400">850+ companies tracked</span>
                    </div>
                    <div className="btc-stagger-2 px-2.5 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full backdrop-blur-sm">
                      <span className="text-[10px] font-semibold text-teal-400">Updated weekly</span>
                    </div>
                  </div>

                  {/* Simulated company profile */}
                  <div className="relative z-[1]">
                    {/* Company header */}
                    <div className="flex items-start gap-3 mb-4 btc-stagger-1">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">AstraZeneca plc</h4>
                        <p className="text-[10px] text-slate-500">Large Pharma &middot; Cambridge, UK &middot; NASDAQ: AZN</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded">Active Acquirer</span>
                          <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded">Patent Cliff 2028</span>
                        </div>
                      </div>
                    </div>

                    {/* Key metrics row */}
                    <div className="grid grid-cols-4 gap-2 mb-4 btc-stagger-2">
                      {[
                        { label: 'Deals (3yr)', value: '24', color: 'text-teal-400' },
                        { label: 'Intent Score', value: '78', color: 'text-amber-400' },
                        { label: 'Acq. Appetite', value: 'High', color: 'text-emerald-400' },
                        { label: 'Rev at Risk', value: '$18B', color: 'text-rose-400' },
                      ].map(m => (
                        <div key={m.label} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-center">
                          <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{m.label}</p>
                          <p className={`text-sm font-bold font-mono ${m.color} btc-metric-live`}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Deal activity sparkline */}
                    <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg btc-stagger-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Deal Activity (12 months)</span>
                        <span className="text-[9px] font-mono text-teal-400">24 deals</span>
                      </div>
                      <svg viewBox="0 0 280 40" className="w-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="btc-spark-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(13,148,136)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="rgb(13,148,136)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0,32 L23,28 L47,30 L70,22 L93,18 L117,24 L140,14 L163,10 L187,16 L210,8 L233,12 L256,4 L280,6" fill="none" stroke="rgb(13,148,136)" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M0,32 L23,28 L47,30 L70,22 L93,18 L117,24 L140,14 L163,10 L187,16 L210,8 L233,12 L256,4 L280,6 L280,40 L0,40Z" fill="url(#btc-spark-grad)" />
                        {/* Data points */}
                        {[[0,32],[70,22],[140,14],[210,8],[280,6]].map(([cx,cy], i) => (
                          <circle key={i} cx={cx} cy={cy} r="2.5" fill="#0d1420" stroke="rgb(13,148,136)" strokeWidth="1.5" />
                        ))}
                      </svg>
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-slate-600">Apr 2025</span>
                        <span className="text-[8px] text-slate-600">Apr 2026</span>
                      </div>
                    </div>

                    {/* Pipeline phase bars */}
                    <div className="mb-4 btc-stagger-4">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Pipeline by Phase</p>
                      <div className="space-y-1.5">
                        {[
                          { phase: 'Phase 3', count: 14, pct: 85, color: 'bg-teal-500' },
                          { phase: 'Phase 2', count: 22, pct: 100, color: 'bg-cyan-500' },
                          { phase: 'Phase 1', count: 18, pct: 72, color: 'bg-indigo-500' },
                          { phase: 'Preclinical', count: 31, pct: 65, color: 'bg-violet-500/60' },
                        ].map((p, i) => (
                          <div key={p.phase} className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 w-16 text-right font-mono">{p.phase}</span>
                            <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
                              <div className={`h-full ${p.color} rounded-full btc-bar-animate btc-bar-animate-d${i + 1}`} style={{ width: `${p.pct}%` }} />
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono w-6">{p.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Active modalities */}
                    <div className="btc-stagger-5">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Modalities</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['ADC', 'Bispecific', 'Small Molecule', 'mRNA', 'Cell Therapy', 'Gene Therapy'].map(mod => (
                          <span key={mod} className="px-2 py-0.5 text-[9px] font-medium text-teal-300 bg-teal-500/8 border border-teal-500/15 rounded-full">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Copy */}
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full mb-5 w-fit">
                    <Building2 className="w-3 h-3 text-teal-400" />
                    <span className="text-xs text-teal-300 font-medium">Company Intelligence</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                    Know every buyer before<br className="hidden sm:block" /> they know themselves
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Deep profiles on 850+ biopharma companies updated weekly. Patent cliff pressure, pipeline gaps, acquisition appetite, and deal velocity -- the signals that predict who transacts next.
                  </p>

                  <div className="space-y-3 mb-8">
                    {[
                      { title: 'Deal financials and history', sub: 'Every licensing, acquisition, and collaboration with disclosed terms' },
                      { title: 'Patent cliff timelines', sub: 'Revenue-at-risk analysis with LOE dates and biosimilar exposure' },
                      { title: 'Pipeline gap detection', sub: 'Active ClinicalTrials.gov monitoring across all phases and TAs' },
                      { title: 'Acquisition appetite scoring', sub: 'Composite signal from deal velocity, cash reserves, and pipeline depth' },
                      { title: '10-factor Pharma Intent Score', sub: 'Predictive model calibrated against 378 historical transactions' },
                      { title: 'Competitive peer mapping', sub: 'Side-by-side comparison of pipeline overlap and strategic positioning' },
                    ].map(f => (
                      <div key={f.title} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-slate-200 font-medium">{f.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{f.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/companies"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors group/link w-fit"
                  >
                    Explore company profiles <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Market Pulse ── */}
            <div className="btc-card-indigo bg-[#0d1420] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="grid lg:grid-cols-2">
                {/* Left: Copy */}
                <div className="p-8 lg:p-10 flex flex-col justify-center order-2 lg:order-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-5 w-fit">
                    <Activity className="w-3 h-3 text-indigo-400" />
                    <span className="text-xs text-indigo-300 font-medium">Market Pulse</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">
                    Intelligence that does not<br className="hidden sm:block" /> sleep between Mondays
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Weekly market snapshots with deal activity, benchmark shifts, and modality trends. Walk into every meeting knowing exactly what moved, what it means, and what comes next.
                  </p>

                  <div className="space-y-3 mb-8">
                    {[
                      { title: 'Live deal activity feed', sub: 'Every announced transaction with terms, modality, phase, and TA classification' },
                      { title: 'Benchmark trend analysis', sub: '12-month upfront and total deal value trends by modality and phase' },
                      { title: 'Modality heatmaps', sub: 'Visual grid showing where capital is concentrating across deal types' },
                      { title: 'TA breakdown and shifts', sub: 'Week-over-week changes in deal volume and value by therapeutic area' },
                      { title: 'Historical sparklines', sub: 'Inline trend visualization for every key metric and benchmark' },
                      { title: 'Board-ready market context', sub: 'Exportable insights formatted for deal committee presentations' },
                    ].map(f => (
                      <div key={f.title} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-slate-200 font-medium">{f.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{f.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/pulse"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors group/link w-fit"
                  >
                    View market pulse <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                  </Link>
                </div>

                {/* Right: Pulse dashboard mockup */}
                <div className="relative p-5 sm:p-6 bg-gradient-to-br from-[#0a1018] to-[#0d1420] overflow-hidden min-h-[420px] order-1 lg:order-2">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(99,102,241,0.08),transparent)]" />

                  {/* Floating badges */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                    <div className="btc-stagger-6 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full backdrop-blur-sm" style={{ animation: 'btc-fade-up-2 0.6s ease both, btc-border-shimmer-indigo 3s ease-in-out infinite' }}>
                      <span className="text-[10px] font-semibold text-indigo-400">12-month history</span>
                    </div>
                    <div className="btc-stagger-7 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full backdrop-blur-sm">
                      <span className="text-[10px] font-semibold text-indigo-400">Every Monday 6AM UTC</span>
                    </div>
                  </div>

                  <div className="relative z-[1]">
                    {/* Week header */}
                    <div className="flex items-center gap-2 mb-4 btc-stagger-6">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" style={{ animation: 'btc-pulse-glow-indigo 2s ease-in-out infinite' }} />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Week of April 7, 2026</span>
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-4 gap-2 mb-4 btc-stagger-7">
                      {[
                        { label: 'Deals', value: '23', delta: '+5', up: true },
                        { label: 'Announced', value: '8', delta: '+2', up: true },
                        { label: 'Avg Upfront', value: '$142M', delta: '+$18M', up: true },
                        { label: 'Median', value: '$85M', delta: '-$4M', up: false },
                      ].map(kpi => (
                        <div key={kpi.label} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-center">
                          <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                          <p className="text-sm font-bold font-mono text-white btc-metric-live">{kpi.value}</p>
                          <p className={`text-[8px] font-mono ${kpi.up ? 'text-emerald-400' : 'text-rose-400'}`}>{kpi.delta} WoW</p>
                        </div>
                      ))}
                    </div>

                    {/* Deal trend line chart */}
                    <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg btc-stagger-8">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Weekly Deal Volume</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-0.5 bg-indigo-500 rounded-full" />
                            <span className="text-[8px] text-slate-600">2026</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-0.5 bg-slate-600 rounded-full" />
                            <span className="text-[8px] text-slate-600">2025</span>
                          </div>
                        </div>
                      </div>
                      <svg viewBox="0 0 280 60" className="w-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="btc-pulse-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* Grid lines */}
                        {[15,30,45].map(y => (
                          <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                        ))}
                        {/* 2025 line (prior year) */}
                        <path d="M0,38 L23,42 L47,36 L70,40 L93,34 L117,38 L140,32 L163,36 L187,30 L210,34 L233,28 L256,32 L280,26" fill="none" stroke="rgba(100,116,139,0.4)" strokeWidth="1" strokeDasharray="3 3" />
                        {/* 2026 line (current) */}
                        <path d="M0,44 L23,38 L47,42 L70,32 L93,28 L117,34 L140,22 L163,18 L187,24 L210,14 L233,18 L256,10 L280,8" fill="none" stroke="rgb(99,102,241)" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M0,44 L23,38 L47,42 L70,32 L93,28 L117,34 L140,22 L163,18 L187,24 L210,14 L233,18 L256,10 L280,8 L280,60 L0,60Z" fill="url(#btc-pulse-grad)" />
                        {/* Latest data point */}
                        <circle cx="280" cy="8" r="3" fill="#0d1420" stroke="rgb(99,102,241)" strokeWidth="1.5" />
                        <circle cx="280" cy="8" r="1.5" fill="rgb(99,102,241)" />
                      </svg>
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-slate-600">Jan</span>
                        <span className="text-[8px] text-slate-600">Apr</span>
                        <span className="text-[8px] text-slate-600">Jul</span>
                        <span className="text-[8px] text-slate-600">Oct</span>
                      </div>
                    </div>

                    {/* Deal activity feed */}
                    <div className="mb-4 btc-stagger-8">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Latest Deals</p>
                      <div className="space-y-1.5">
                        {[
                          { parties: 'Pfizer / Vanguard Biotech', mod: 'ADC', phase: 'Phase 2', value: '$2.1B', ta: 'Oncology' },
                          { parties: 'Roche / NeuralPath', mod: 'Bispecific Ab', phase: 'Phase 1', value: '$840M', ta: 'Neurology' },
                          { parties: 'Novartis / CellGenix', mod: 'Cell Therapy', phase: 'Phase 3', value: '$3.4B', ta: 'Hematology' },
                          { parties: 'AbbVie / MetaboRx', mod: 'Small Molecule', phase: 'Phase 2', value: '$1.2B', ta: 'Metabolic' },
                        ].map((d, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <div className="w-1 h-5 rounded-full bg-indigo-500/50 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-semibold text-slate-300 truncate">{d.parties}</p>
                              <p className="text-[8px] text-slate-600">{d.mod} &middot; {d.phase} &middot; {d.ta}</p>
                            </div>
                            <span className="text-[10px] font-bold font-mono text-indigo-400 flex-shrink-0">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Modality heatmap */}
                    <div className="btc-stagger-9">
                      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Modality Heatmap (Deal Count)</p>
                      <div className="grid grid-cols-6 gap-1">
                        {[
                          { mod: 'ADC', heat: 0.9 },
                          { mod: 'mAb', heat: 0.7 },
                          { mod: 'SM', heat: 0.6 },
                          { mod: 'Gene', heat: 0.5 },
                          { mod: 'Cell', heat: 0.8 },
                          { mod: 'RNA', heat: 0.4 },
                          { mod: 'Bisp', heat: 0.85 },
                          { mod: 'PDC', heat: 0.3 },
                          { mod: 'mRNA', heat: 0.55 },
                          { mod: 'PROTAC', heat: 0.45 },
                          { mod: 'RNAi', heat: 0.35 },
                          { mod: 'Other', heat: 0.2 },
                        ].map(cell => (
                          <div
                            key={cell.mod}
                            className="p-1.5 rounded text-center border border-white/[0.03]"
                            style={{ backgroundColor: `rgba(99,102,241,${cell.heat * 0.25})` }}
                          >
                            <p className="text-[7px] font-semibold text-slate-400">{cell.mod}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
            TEAM TIER — multi-seat CTA (A+ redesign)
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-4 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Team Access</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                One platform.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">Every seat at the deal table.</span>
              </h2>
              <p className="mt-5 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Multi-seat Pro access for BD, Corp Dev, and Alliance Management teams — per-seat pricing, shared partner intelligence, pre-loaded against your pipeline.
              </p>
            </div>

            {/* Feature grid — 4 cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
              {[
                { icon: Layers, title: 'Full Pro per seat', desc: 'All 14 engines, unlimited calculations, PDF & Excel exports for every team member.', accent: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/20', iconColor: 'text-indigo-400' },
                { icon: Users, title: 'Dedicated onboarding', desc: '30-minute kickoff walkthrough. Your team runs live calculations before the session ends.', accent: 'from-purple-500/20 to-fuchsia-500/20', border: 'border-purple-500/20', iconColor: 'text-purple-400' },
                { icon: Search, title: 'Pre-loaded intelligence', desc: 'Partner profiles and counterparty data configured for your therapeutic focus from day one.', accent: 'from-cyan-500/20 to-indigo-500/20', border: 'border-cyan-500/20', iconColor: 'text-cyan-400' },
                { icon: Shield, title: 'Direct support line', desc: 'Email access to Ambrosia for engine questions, methodology queries, and deal-readiness support.', accent: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-500/20', iconColor: 'text-teal-400' },
              ].map(item => (
                <div key={item.title} className={`group relative bg-[#0d1420] border ${item.border} rounded-2xl p-7 hover:border-indigo-500/30 transition-all duration-300 overflow-hidden`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${item.accent} border ${item.border} flex items-center justify-center mb-5`}>
                      <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA banner */}
            <div className="relative bg-gradient-to-r from-indigo-500/[0.08] via-purple-500/[0.06] to-indigo-500/[0.08] border border-indigo-500/15 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(99,102,241,0.06),transparent)]" />
              <div className="relative flex flex-col sm:flex-row items-center justify-between gap-8 px-10 py-10 lg:px-16">
                <div>
                  <h3 className="text-2xl font-bold text-white">Ready to bring your team on?</h3>
                  <p className="text-slate-400 mt-2 max-w-lg">Send your team size, therapeutic focus, and timeline. Pricing and access delivered same day.</p>
                </div>
                <div className="flex flex-col items-center sm:items-end gap-3 flex-shrink-0">
                  <Link
                    href="mailto:ikildani@ambrosiaventures.co?subject=Team%20access%20—%20Ambrosia%20Benchmarker&body=Hi%20Issa%2C%0A%0AWe%27re%20interested%20in%20multi-seat%20Pro%20access%20for%20our%20team.%0A%0ATeam%20size%3A%20%0ATherapeutic%20focus%3A%20%0ATimeline%3A%20%0A%0AThanks"
                    className="inline-flex items-center gap-2.5 px-8 py-4 bg-indigo-500 text-white text-base font-semibold rounded-xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-400 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Contact for team pricing
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-xs text-slate-500">Typically responds same day</p>
                </div>
              </div>
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
