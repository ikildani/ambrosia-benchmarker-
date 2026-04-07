import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart3, TrendingUp, Users, Shield, FileText,
  ArrowRight, CheckCircle2, Zap, Target, LineChart,
  Building2, DollarSign, Percent, Scale, Clock,
  Database, Lock, Download, Star, ChevronRight,
  Globe, Microscope, FlaskConical, Brain, Calculator,
} from 'lucide-react';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';
import ReportIntakeForm from '@/components/ReportIntakeForm';

export const metadata: Metadata = {
  title: 'Deal Intelligence Report — $499 | Ambrosia Ventures',
  description: 'Board-ready biopharma deal benchmarking in 60 seconds. rNPV valuation, comparable transactions, partner matching, sensitivity analysis, negotiation playbook — powered by 2,500+ verified SEC filings.',
  openGraph: {
    title: 'Deal Intelligence Report — $499 | Ambrosia Ventures',
    description: 'Board-ready biopharma deal benchmarking. Comparable deals, partner matching, sensitivity analysis, and negotiation playbook from 2,500+ real transactions.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/report',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Ambrosia Ventures Deal Intelligence Report' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Intelligence Report — $499 | Ambrosia Ventures',
    description: 'Board-ready biopharma deal benchmarking from 2,500+ real transactions.',
    images: ['/api/og'],
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/report',
  },
};

/* ─── Data ─────────────────────────────────────────────────────────────── */

const reportModules = [
  {
    icon: DollarSign,
    title: 'Deal Terms Engine',
    subtitle: 'Upfronts, milestones, royalties',
    description: 'Precise benchmarks calibrated to your therapeutic area, modality, and development phase. Median, P25, P75, and maximum values from real transactions.',
    highlight: `${DEAL_STATS.TOTAL_DEALS} deals analyzed`,
    color: 'teal',
  },
  {
    icon: BarChart3,
    title: 'Comparable Transactions',
    subtitle: 'Your deal in context',
    description: 'The most relevant recent deals matched to your parameters — upfront ratios, total deal values, milestone structures, and royalty tiers side by side.',
    highlight: 'Curated + extended comps',
    color: 'cyan',
  },
  {
    icon: Users,
    title: 'Partner Intelligence',
    subtitle: 'AI-scored matching + Pharma Intent Score',
    description: 'Every potential partner ranked by therapeutic alignment, pipeline gaps, deal history, geography, and financial capacity — plus our proprietary Pharma Intent Score, a 10-factor predictive model that forecasts which companies are most likely to transact in your space within 12-18 months.',
    highlight: `${DEAL_STATS.TOTAL_COMPANIES} companies · Intent scoring`,
    color: 'violet',
  },
  {
    icon: Target,
    title: 'Competitive Landscape',
    subtitle: 'Pipeline mapping',
    description: 'Active competitors in your indication mapped by stage, mechanism, differentiation score, and estimated peak sales. Know exactly where you stand.',
    highlight: 'ClinicalTrials.gov + proprietary',
    color: 'amber',
  },
  {
    icon: LineChart,
    title: 'Sensitivity & Simulation',
    subtitle: 'Monte Carlo + VaR/CVaR + tornado chart',
    description: '10,000-iteration Monte Carlo with institutional risk metrics — VaR (95%), CVaR (expected tail loss), skewness, and kurtosis. Tornado chart showing top 5 risks and top 5 upsides. Compound scenario modeling captures non-linear interactions (e.g., CRL + competitor launch, Phase 3 failure + subgroup rescue).',
    highlight: 'Goldman/Lazard-grade risk metrics',
    color: 'rose',
  },
  {
    icon: Calculator,
    title: 'rNPV & Deal Valuation',
    subtitle: 'Probability-weighted asset value',
    description: 'Risk-adjusted NPV with phase-specific PoS across 12 therapeutic areas, TA-specific revenue curves (orphan exclusivity for rare disease, GLP-1 ramp for metabolic), bear/base/bull scenario comparison, real options valuation via CRR binomial lattice, and peak sales sanity check against 40+ index drugs (Keytruda, Ozempic, Dupixent, Trikafta). Manufacturing WACC premiums for gene therapy, CAR-T, and ADC. Market access delay modeling by TA.',
    highlight: 'Index drug validation + real options',
    color: 'sky',
  },
  {
    icon: Building2,
    title: 'Buyer-Specific Valuation',
    subtitle: 'What your asset is worth to each buyer',
    description: 'Multi-partner comparison showing what up to 3 specific buyers would pay vs. a generic buyer. 5-factor strategic premium model (portfolio fit, deal urgency, patent cliff pressure, pipeline gaps, competitive pressure) with negotiation leverage assessment and timing advantage analysis.',
    highlight: 'Multi-buyer side-by-side comparison',
    color: 'indigo',
  },
  {
    icon: Scale,
    title: 'Negotiation Playbook',
    subtitle: 'Data-backed strategy',
    description: 'Where to push, where to concede, and how your structure compares to market norms. Leverage analysis based on buyer pipeline gaps and patent cliff pressure.',
    highlight: 'Tailored to counterparty',
    color: 'emerald',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  teal:    { bg: 'bg-teal-500/[0.07]',    border: 'border-teal-500/[0.12]',    text: 'text-teal-400',    glow: 'group-hover:shadow-teal-500/5' },
  cyan:    { bg: 'bg-cyan-500/[0.07]',     border: 'border-cyan-500/[0.12]',    text: 'text-cyan-400',    glow: 'group-hover:shadow-cyan-500/5' },
  violet:  { bg: 'bg-violet-500/[0.07]',   border: 'border-violet-500/[0.12]',  text: 'text-violet-400',  glow: 'group-hover:shadow-violet-500/5' },
  amber:   { bg: 'bg-amber-500/[0.07]',    border: 'border-amber-500/[0.12]',   text: 'text-amber-400',   glow: 'group-hover:shadow-amber-500/5' },
  rose:    { bg: 'bg-rose-500/[0.07]',     border: 'border-rose-500/[0.12]',    text: 'text-rose-400',    glow: 'group-hover:shadow-rose-500/5' },
  sky:     { bg: 'bg-sky-500/[0.07]',      border: 'border-sky-500/[0.12]',     text: 'text-sky-400',     glow: 'group-hover:shadow-sky-500/5' },
  indigo:  { bg: 'bg-indigo-500/[0.07]',   border: 'border-indigo-500/[0.12]',  text: 'text-indigo-400',  glow: 'group-hover:shadow-indigo-500/5' },
  emerald: { bg: 'bg-emerald-500/[0.07]',  border: 'border-emerald-500/[0.12]', text: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/5' },
};

const therapeuticAreas = [
  'Oncology', 'Neurology', 'Immunology', 'Rare Disease',
  'Cardiovascular', 'Metabolic', 'Hematology', 'Ophthalmology',
  'Dermatology', 'Infectious Disease', 'Gastroenterology', "Women's Health",
];

const dealTypes = ['Licensing', 'Co-Development', 'Acquisition', 'Option', 'Collaboration'];

const faqs = [
  {
    q: 'What do I need to generate a report?',
    a: 'Just four inputs: therapeutic area, modality (e.g., small molecule, ADC, gene therapy), development phase, and deal type. The entire process takes about 60 seconds.',
  },
  {
    q: 'What format is the report delivered in?',
    a: 'You get both a board-ready PDF and a structured Excel workbook with 6 analysis sheets. Both are generated instantly and available for immediate download.',
  },
  {
    q: 'Where does the data come from?',
    a: `Our database contains ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions sourced from SEC 8-K filings, FTC premerger filings, press releases, and regulatory databases. Data is updated daily.`,
  },
  {
    q: 'Can I try before I buy?',
    a: 'Yes. Create a free account and get 3 calculations with headline deal term estimates. The $499 report unlocks the full analysis including rNPV with VaR/CVaR risk metrics, Monte Carlo simulation, multi-buyer valuation, partner matching with Pharma Intent scoring, and negotiation playbook.',
  },
  {
    q: 'Is there a subscription option?',
    a: `Yes. Pro subscribers (${PRICING.PRO_MONTHLY}) get unlimited reports, priority data access, and the Pharma Intent Score predictive model. The one-time report is ideal if you need a single comprehensive analysis.`,
  },
  {
    q: 'How current is the data?',
    a: 'Our pipeline ingests new deals daily from SEC EDGAR, press releases, FTC filings, and clinical trial registries. Most major deals appear in our database within 24 hours of public disclosure.',
  },
];

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-[#080c16] text-white antialiased">

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden">
        {/* Mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#080c16] via-[#0a1020] to-[#080c16]" />
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-teal-500/[0.03] blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/[0.02] blur-[100px]" />
          <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.015] blur-[80px]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative">
          {/* Nav */}
          <nav className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link href="/" className="opacity-70 hover:opacity-100 transition-opacity">
              <Image src="/logo-white.png" alt="Ambrosia Ventures" width={160} height={32} className="h-7 w-auto" priority />
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/calculator" className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors">
                Calculator
              </Link>
              <Link
                href="/calculator"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-400 border border-teal-500/20 rounded-lg hover:bg-teal-500/[0.06] transition-all"
              >
                Start Free
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </nav>

          {/* Hero content */}
          <div className="max-w-6xl mx-auto px-6 pt-16 sm:pt-20 pb-24 sm:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              {/* Left: copy */}
              <div>
                {/* Badge */}
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-teal-500/[0.06] border border-teal-500/[0.1] mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-teal-400/90 tracking-[0.12em] uppercase">
                    {DEAL_STATS.TOTAL_DEALS} Verified Transactions
                  </span>
                </div>

                {/* Headline */}
                <h1 className="font-display text-[2.75rem] sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.035em] leading-[1.02] text-white mb-6">
                  Deal intelligence<br />
                  <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-300 bg-clip-text text-transparent">
                    that closes deals.
                  </span>
                </h1>

                {/* Sub */}
                <p className="text-base sm:text-lg text-slate-400 max-w-lg mb-8 leading-relaxed font-light">
                  Comparable transactions, partner matching, sensitivity analysis, and a negotiation
                  playbook — generated in 60 seconds from {DEAL_STATS.TOTAL_DEALS} real SEC filings.
                </p>

                {/* Price */}
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">{PRICING.REPORT_PRICE}</span>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500">One-time payment</span>
                    <span className="text-xs text-slate-600">Instant PDF + Excel delivery</span>
                  </div>
                </div>

                {/* Trust bar */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
                {[
                  { icon: Download, label: 'PDF + Excel export' },
                  { icon: Shield, label: 'Secure Stripe checkout' },
                  { icon: FileText, label: 'Board-ready formatting' },
                  { icon: Clock, label: 'Ready in 60 seconds' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-teal-500/40" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              </div>

              {/* Right: intake form */}
              <div className="lg:pt-4">
                <ReportIntakeForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ SOCIAL PROOF BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative border-y border-white/[0.04] bg-[#0a0e1a]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals', sub: 'SEC 8-K + FTC + press' },
              { value: DEAL_STATS.TOTAL_COMPANIES, label: 'Companies Profiled', sub: 'AI-scored partner matching' },
              { value: '14', label: 'Analysis Engines', sub: 'rNPV, Monte Carlo, VaR/CVaR, + more' },
              { value: 'Daily', label: 'Data Refresh', sub: 'Automated pipeline' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">{stat.value}</div>
                <div className="text-xs font-semibold text-slate-400 mb-0.5">{stat.label}</div>
                <div className="text-[10px] text-slate-600">{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ REPORT PREVIEW MOCKUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/[0.01] to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">What You Get</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              A complete deal intelligence package
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Not a generic template — every section is calibrated to your exact therapeutic area,
              modality, phase, and deal type.
            </p>
          </div>

          {/* Report mockup */}
          <div className="relative max-w-4xl mx-auto">
            {/* Glow behind */}
            <div className="absolute -inset-8 bg-gradient-to-r from-teal-500/[0.04] via-cyan-500/[0.03] to-violet-500/[0.04] rounded-3xl blur-2xl" />

            <div className="relative bg-[#0c1220] border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-white/[0.03] text-[10px] text-slate-600 font-mono">
                    report-oncology-adc-phase2.pdf
                  </div>
                </div>
              </div>

              {/* Mock report content */}
              <div className="p-6 sm:p-10">
                {/* Report header */}
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-2">Deal Intelligence Report</div>
                    <div className="text-xl sm:text-2xl font-bold text-white mb-1">ADC Licensing — Oncology</div>
                    <div className="text-xs text-slate-500">Phase 2 &middot; Solid Tumors &middot; Generated Apr 2026</div>
                  </div>
                  <div className="hidden sm:block opacity-40">
                    <Image src="/logo-white.png" alt="" width={100} height={20} className="h-5 w-auto" />
                  </div>
                </div>

                {/* Mock sections grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  {/* Deal Terms */}
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-teal-400/60 tracking-wider uppercase mb-3">Upfront Payment</div>
                    <div className="font-mono text-xl font-bold text-white mb-1">$45–85M</div>
                    <div className="text-[10px] text-slate-600">Median: $62M &middot; P75: $78M</div>
                    <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full w-[65%] bg-gradient-to-r from-teal-500/60 to-teal-400/40 rounded-full" />
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-cyan-400/60 tracking-wider uppercase mb-3">Total Milestones</div>
                    <div className="font-mono text-xl font-bold text-white mb-1">$380–920M</div>
                    <div className="text-[10px] text-slate-600">Clinical + commercial + sales</div>
                    <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full w-[78%] bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-full" />
                    </div>
                  </div>

                  {/* Royalties */}
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 col-span-2 sm:col-span-1">
                    <div className="text-[9px] font-bold text-violet-400/60 tracking-wider uppercase mb-3">Royalty Rate</div>
                    <div className="font-mono text-xl font-bold text-white mb-1">8–15%</div>
                    <div className="text-[10px] text-slate-600">Tiered, net sales based</div>
                    <div className="mt-3 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full w-[52%] bg-gradient-to-r from-violet-500/60 to-violet-400/40 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Mock comparable deals table */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 mb-6">
                  <div className="text-[9px] font-bold text-amber-400/60 tracking-wider uppercase mb-3">Top Comparable Transactions</div>
                  <div className="space-y-2">
                    {[
                      { deal: 'Pfizer / Seagen', value: '$43B', upfront: '100%', year: '2023' },
                      { deal: 'AbbVie / ImmunoGen', value: '$10.1B', upfront: '100%', year: '2023' },
                      { deal: 'Merck / Daiichi Sankyo', value: '$22B', upfront: '$4B', year: '2023' },
                    ].map((row) => (
                      <div key={row.deal} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-xs text-slate-300 font-medium">{row.deal}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-500">{row.year}</span>
                          <span className="text-xs text-slate-500">Up: {row.upfront}</span>
                          <span className="font-mono text-xs font-bold text-white">{row.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* rNPV + Monte Carlo row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-sky-400/60 tracking-wider uppercase mb-3">rNPV Valuation</div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: 'rNPV', value: '$312M', color: 'text-teal-400' },
                        { label: 'PoS', value: '24.3%', color: 'text-white' },
                        { label: 'Return', value: '18.4%', color: 'text-white' },
                        { label: 'Payback', value: '10.7y', color: 'text-white' },
                      ].map(kpi => (
                        <div key={kpi.label} className="text-center">
                          <div className="text-[8px] text-slate-600 uppercase">{kpi.label}</div>
                          <div className={`text-xs font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                      <span className="text-slate-600">Index: Padcev ($4.2B) — 32% of index, credible</span>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-rose-400/60 tracking-wider uppercase mb-2">Monte Carlo · Risk Metrics</div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[
                        { label: 'VaR 95%', value: '-$42M', color: 'text-rose-400' },
                        { label: 'CVaR', value: '-$78M', color: 'text-rose-400' },
                        { label: 'Skew', value: '+0.84', color: 'text-teal-400' },
                        { label: 'Tail', value: 'Mod.', color: 'text-amber-400' },
                      ].map(m => (
                        <div key={m.label} className="text-center">
                          <div className="text-[8px] text-slate-600 uppercase">{m.label}</div>
                          <div className={`text-xs font-bold font-mono ${m.color}`}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-slate-600">10,000 iterations</span>
                      <span className="text-teal-400/60 font-mono">87% Prob NPV &gt; 0</span>
                    </div>
                  </div>
                </div>

                {/* Buyer-specific + Tornado preview */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-indigo-400/60 tracking-wider uppercase mb-3">Buyer-Specific Valuation</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-[8px] text-slate-600 uppercase">Generic</div>
                        <div className="text-xs font-bold font-mono text-slate-400">$245M</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-teal-500 uppercase">AstraZeneca</div>
                        <div className="text-xs font-bold font-mono text-teal-400">$340M</div>
                        <div className="text-[8px] text-teal-600">+39%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-violet-500 uppercase">Novartis</div>
                        <div className="text-xs font-bold font-mono text-violet-400">$295M</div>
                        <div className="text-[8px] text-violet-600">+20%</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                    <div className="text-[9px] font-bold text-amber-400/60 tracking-wider uppercase mb-2">Tornado · Top Risks &amp; Upsides</div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Peak Sales', risk: 35, upside: 42 },
                        { label: 'PoS Phase 3', risk: 28, upside: 18 },
                        { label: 'Competitor', risk: 22, upside: 8 },
                      ].map(row => (
                        <div key={row.label} className="flex items-center gap-2">
                          <span className="text-[8px] text-slate-600 w-14 text-right truncate">{row.label}</span>
                          <div className="flex-1 flex items-center h-3">
                            <div className="flex-1 flex justify-end"><div className="h-full bg-rose-500/30 rounded-l" style={{ width: `${row.risk}%` }} /></div>
                            <div className="w-[1px] h-full bg-slate-700 mx-0.5" />
                            <div className="flex-1"><div className="h-full bg-emerald-500/30 rounded-r" style={{ width: `${row.upside}%` }} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fade overlay */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0c1220]/60 to-[#0c1220] z-10 flex items-end justify-center pb-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06]">
                      <Lock className="w-3.5 h-3.5 text-teal-400/60" />
                      <span className="text-[11px] text-slate-400 font-medium">Scenario comparison, real options, lifecycle extensions, negotiation playbook &amp; more</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 opacity-20">
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 h-20" />
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 h-20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ 6 MODULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-14">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">Eight Core Analysis Modules</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Everything you need for a deal committee presentation
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Each module is independently valuable. Together, they give you the most comprehensive
              deal analysis available outside a top-tier advisory engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportModules.map((mod) => {
              const c = colorMap[mod.color];
              return (
                <div
                  key={mod.title}
                  className={`group relative bg-[#0c1220]/80 border border-white/[0.04] rounded-xl p-6 hover:border-white/[0.08] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${c.glow}`}
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r ${c.text === 'text-teal-400' ? 'from-teal-500/30' : c.text === 'text-cyan-400' ? 'from-cyan-500/30' : c.text === 'text-violet-400' ? 'from-violet-500/30' : c.text === 'text-amber-400' ? 'from-amber-500/30' : c.text === 'text-rose-400' ? 'from-rose-500/30' : c.text === 'text-sky-400' ? 'from-sky-500/30' : c.text === 'text-indigo-400' ? 'from-indigo-500/30' : 'from-emerald-500/30'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

                  <div className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5`}>
                    <mod.icon className={`w-5 h-5 ${c.text}`} />
                  </div>

                  <h3 className="text-sm font-bold text-white mb-0.5">{mod.title}</h3>
                  <p className={`text-[11px] ${c.text} font-medium mb-3 opacity-70`}>{mod.subtitle}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{mod.description}</p>

                  <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.04]">
                    <Database className="w-3 h-3 text-slate-600" />
                    <span className="text-[10px] text-slate-600 font-medium">{mod.highlight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24 border-y border-white/[0.04]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.005] to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">How It Works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              From parameters to board deck in 60 seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '01',
                icon: FlaskConical,
                title: 'Define your asset',
                desc: 'Select therapeutic area, modality, development phase, deal type, and indication. Four dropdowns — takes 30 seconds.',
                detail: 'Free account — 3 calculations',
              },
              {
                step: '02',
                icon: Brain,
                title: 'Review the free analysis',
                desc: 'See deal term ranges, comparable deal previews, and a competitive snapshot — instantly. Decide if the full report is worth it.',
                detail: 'Full transparency before you pay',
              },
              {
                step: '03',
                icon: FileText,
                title: 'Unlock the full report',
                desc: 'One click, $499. Get the complete package: partner matching, sensitivity modeling, negotiation playbook, and PDF + Excel exports.',
                detail: 'Instant download via Stripe',
              },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {/* Connector line (not on last) */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-[1px] bg-gradient-to-r from-white/[0.06] to-transparent" />
                )}

                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0c1220] border border-white/[0.06] mb-6 mx-auto">
                  <item.icon className="w-8 h-8 text-teal-400/70" />
                </div>

                <div className="font-mono text-[10px] font-bold text-teal-500/30 tracking-widest mb-2">{item.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3 max-w-[260px] mx-auto">{item.desc}</p>
                <p className="text-[10px] text-teal-500/40 font-semibold">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ ROI COMPARISON ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">The Math</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              {PRICING.REPORT_PRICE} vs. the alternative
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              What it actually costs to build this analysis manually — and what you get for a fraction of the price.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Manual */}
            <div className="bg-[#0c1220]/60 border border-white/[0.04] rounded-xl p-8">
              <div className="text-[10px] font-bold text-slate-600 tracking-[0.15em] uppercase mb-6">Manual Research</div>
              <div className="space-y-4 mb-8">
                {[
                  { item: 'Comparable deal search & analysis', time: '8–12 hours', cost: '$2,000+' },
                  { item: 'Partner screening & scoring', time: '6–10 hours', cost: '$1,500+' },
                  { item: 'Sensitivity & financial modeling', time: '4–6 hours', cost: '$1,000+' },
                  { item: 'Market & competitive landscape', time: '6–8 hours', cost: '$1,500+' },
                  { item: 'Report formatting & presentation', time: '3–4 hours', cost: '$750+' },
                ].map((row) => (
                  <div key={row.item} className="flex items-start justify-between gap-4 pb-3 border-b border-white/[0.03]">
                    <div>
                      <div className="text-xs text-slate-300 font-medium">{row.item}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{row.time}</div>
                    </div>
                    <div className="font-mono text-xs text-slate-500 font-medium whitespace-nowrap">{row.cost}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between pt-4 border-t border-white/[0.06]">
                <span className="text-xs font-semibold text-slate-400">Total cost</span>
                <div className="text-right">
                  <div className="font-mono text-2xl font-extrabold text-white">$6,750+</div>
                  <div className="text-[10px] text-slate-600">27–40 hours of work</div>
                </div>
              </div>
            </div>

            {/* Ambrosia */}
            <div className="relative bg-gradient-to-b from-teal-500/[0.04] to-[#0c1220]/60 border border-teal-500/[0.12] rounded-xl p-8">
              {/* Recommended badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500 text-[10px] font-bold text-[#080c16] tracking-wide">
                  <Zap className="w-3 h-3" />
                  RECOMMENDED
                </div>
              </div>

              <div className="text-[10px] font-bold text-teal-400/60 tracking-[0.15em] uppercase mb-6">Ambrosia Report</div>
              <div className="space-y-4 mb-8">
                {[
                  'Deal terms benchmark (upfronts, milestones, royalties)',
                  'Comparable transactions analysis',
                  'AI-scored partner matching + 10-factor Pharma Intent Score',
                  'rNPV with peak sales validation vs 40+ index drugs',
                  'Multi-buyer valuation — what 3 specific acquirers would pay',
                  'Monte Carlo (10K iterations) + VaR/CVaR risk metrics',
                  'Tornado chart + compound scenario modeling',
                  'Competitive landscape & pipeline mapping',
                  'Negotiation playbook with leverage analysis',
                  'Board-ready PDF + structured Excel export',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-500/60 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-slate-300 leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between pt-4 border-t border-teal-500/[0.1]">
                <span className="text-xs font-semibold text-teal-400/70">Total cost</span>
                <div className="text-right">
                  <div className="font-mono text-2xl font-extrabold text-teal-400">{PRICING.REPORT_PRICE}</div>
                  <div className="text-[10px] text-slate-500">Ready in 60 seconds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ SOCIAL PROOF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-16 border-y border-white/[0.04] bg-[#0a0e1a]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 mb-6">Trusted by deal teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {['Insilico Medicine', 'Opus Genetics', 'Novartis'].map(name => (
              <span key={name} className="text-lg font-bold text-white/20 tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-20 border-y border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* TAs */}
            <div>
              <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-3">Coverage</p>
              <h3 className="font-display text-2xl font-bold text-white mb-2">12 Therapeutic Areas</h3>
              <p className="text-xs text-slate-500 mb-6">Every report is calibrated with TA-specific benchmarks, competitive data, and partner pools.</p>
              <div className="flex flex-wrap gap-2">
                {therapeuticAreas.map((ta) => (
                  <span
                    key={ta}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-xs font-medium text-slate-400 hover:border-teal-500/10 hover:text-teal-400 transition-colors"
                  >
                    {ta}
                  </span>
                ))}
              </div>
            </div>

            {/* Deal types + stats */}
            <div>
              <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-3">Transaction Types</p>
              <h3 className="font-display text-2xl font-bold text-white mb-2">5 Deal Structures</h3>
              <p className="text-xs text-slate-500 mb-6">Differentiated benchmarks for each structure — upfront ratios, milestone allocations, and royalty scalars.</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {dealTypes.map((dt) => (
                  <span
                    key={dt}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/[0.05] border border-teal-500/[0.08] text-xs font-semibold text-teal-400"
                  >
                    {dt}
                  </span>
                ))}
              </div>

              {/* Data sources */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Globe, label: 'SEC EDGAR 8-K filings' },
                  { icon: Shield, label: 'FTC premerger filings' },
                  { icon: Microscope, label: 'ClinicalTrials.gov' },
                  { icon: FileText, label: 'Public press releases' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-600" />
                    <span className="text-[11px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ WHO IT'S FOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">Built For</p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              BD teams that need data, not opinions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              {
                icon: Building2,
                title: 'Biotech BD & Licensing',
                items: [
                  'Benchmark term sheets with real transaction data',
                  'Identify the right partner with AI-scored matching',
                  'Build the quantitative case for deal committees',
                ],
              },
              {
                icon: TrendingUp,
                title: 'Pharma Search & Evaluation',
                items: [
                  'Validate internal comps with independent benchmarks',
                  'Screen 850+ companies for therapeutic pipeline fit',
                  'Support investment committee presentations',
                ],
              },
              {
                icon: Percent,
                title: 'Biotech Founders & CEOs',
                items: [
                  'Know what your asset is worth before engaging partners',
                  'Identify buyers with pipeline gaps in your space',
                  'Negotiate from data, not assumptions',
                ],
              },
              {
                icon: Star,
                title: 'Investors & Advisors',
                items: [
                  'Due diligence on deal economics and structure',
                  'Comparable transaction analysis for valuation',
                  'Market sizing with epidemiological precision',
                ],
              },
            ].map((group) => (
              <div key={group.title} className="bg-[#0c1220]/60 border border-white/[0.04] rounded-xl p-6 hover:border-white/[0.08] transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/[0.06] border border-teal-500/[0.08] flex items-center justify-center">
                    <group.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{group.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                      <ChevronRight className="w-3.5 h-3.5 text-teal-500/30 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ PRO UPGRADE CALLOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-[#0c1220]/60 border border-white/[0.04] rounded-xl p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/[0.06] border border-violet-500/[0.1] mb-3">
                <Star className="w-3 h-3 text-violet-400" />
                <span className="text-[10px] font-bold text-violet-400/80 tracking-wider">PRO</span>
              </div>
              <h3 className="font-display text-xl font-bold text-white mb-2">Need unlimited reports?</h3>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                Pro subscribers get unlimited deal reports, Pharma Intent Score access, priority data,
                and all 8 calculation engines — {PRICING.PRO_MONTHLY}.
              </p>
            </div>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold text-violet-400 border border-violet-500/20 rounded-xl hover:bg-violet-500/[0.06] transition-all whitespace-nowrap"
            >
              View Pro Plans
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━ FAQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[10px] font-bold text-teal-500/50 tracking-[0.2em] uppercase mb-4">FAQ</p>
            <h2 className="font-display text-3xl font-extrabold text-white tracking-tight">
              Common questions
            </h2>
          </div>

          <div className="space-y-0">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-white/[0.04] py-6 first:pt-0 last:border-0">
                <h3 className="text-sm font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 overflow-hidden">
        {/* Background drama */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c16] via-transparent to-[#080c16]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-teal-500/[0.03] rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/[0.06] border border-teal-500/[0.1] mb-8">
              <Clock className="w-3 h-3 text-teal-400" />
              <span className="text-[11px] font-bold text-teal-400/80 tracking-wide">Ready in 60 seconds</span>
            </div>

            <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-5 leading-[1.05]">
              Your next deal deserves<br />
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                better data.
              </span>
            </h2>

            <p className="text-base text-slate-400 max-w-lg mx-auto mb-0 leading-relaxed">
              Select your asset parameters. See your deal benchmarks instantly.
              Unlock the full report for {PRICING.REPORT_PRICE} — no page reload, no friction.
            </p>
          </div>

          <div className="max-w-xl mx-auto">
            <ReportIntakeForm />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-[11px] text-slate-600">
            <span>{PRICING.REPORT_PRICE} one-time</span>
            <span className="text-slate-700">&middot;</span>
            <span>PDF + Excel</span>
            <span className="text-slate-700">&middot;</span>
            <span>Instant delivery</span>
            <span className="text-slate-700">&middot;</span>
            <span>Secure Stripe checkout</span>
          </div>

          <p className="mt-6 text-xs text-slate-600">
            or <Link href="/#pricing" className="text-teal-500/50 hover:text-teal-400 transition-colors">subscribe to Pro for unlimited reports</Link>
          </p>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <footer className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={120} height={24} className="h-4 w-auto opacity-30" />
            <span className="text-[11px] text-slate-600">Data-driven deal intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-600">
            <Link href="/methodology" className="hover:text-slate-400 transition-colors">Methodology</Link>
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
