import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';
import {
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateWebPageSchema,
} from '@/lib/seo/structured-data';

export const metadata: Metadata = {
  title: 'Biopharma Deal Tracker 2026 — M&A, Licensing & Partnerships | Solidus',
  description: `Track every biopharma deal in real time. ${DEAL_STATS.TOTAL_DEALS} verified M&A, licensing, and partnership transactions across 12 therapeutic areas. Filter by deal type, stage, modality, and value. Updated daily. Free to explore.`,
  keywords: [
    'biotech M&A tracker',
    'pharma deal tracker 2026',
    'biopharma deal database',
    'biotech deal tracker',
    'pharma licensing tracker',
    'life sciences M&A tracker',
    'biopharma transactions 2026',
    'biotech acquisitions tracker',
    'pharma partnership tracker',
    'drug deal database',
    'biopharma deal intelligence',
    'biotech M&A database',
  ],
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/tracker',
  },
  openGraph: {
    title: 'Biopharma Deal Tracker 2026 — M&A, Licensing & Partnerships | Solidus',
    description: `Track every biopharma deal in real time. ${DEAL_STATS.TOTAL_DEALS} verified transactions across 12 therapeutic areas. Updated daily.`,
    type: 'website',
    url: 'https://solidus.ambrosiaventures.co/tracker',
    images: [
      {
        url: `/api/og?title=${encodeURIComponent('Biopharma Deal Tracker 2026')}&subtitle=${encodeURIComponent(`${DEAL_STATS.TOTAL_DEALS} Deals | 12 Therapeutic Areas | Updated Daily`)}`,
        width: 1200,
        height: 630,
        alt: 'Biopharma Deal Tracker 2026 — Solidus by Ambrosia Ventures',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Tracker 2026 — M&A, Licensing & Partnerships',
    description: `${DEAL_STATS.TOTAL_DEALS} verified biopharma deals tracked in real time. M&A, licensing, partnerships across 12 TAs. Free to explore.`,
    images: [`/api/og?title=${encodeURIComponent('Biopharma Deal Tracker 2026')}`],
  },
};

const FAQS = [
  {
    question: 'How many deals does the Solidus tracker cover?',
    answer: `Solidus tracks ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions spanning licensing agreements, acquisitions, collaborations, option deals, and co-development partnerships. The database covers deals from 2011 to present, with comprehensive coverage of 2024-2026 activity across 12 therapeutic areas.`,
  },
  {
    question: 'How often is the deal data updated?',
    answer: 'The Solidus deal database is updated daily. New transactions are sourced from SEC 8-K filings, FTC premerger notifications, company press releases, and regulatory databases. Each deal is verified and standardized before inclusion, ensuring consistent, comparable data across the entire database.',
  },
  {
    question: 'What deal types are tracked?',
    answer: 'Solidus tracks five primary deal types: licensing agreements (exclusive and co-exclusive), acquisitions (full and asset purchases), research collaborations, option agreements, and co-development partnerships. Each deal record includes upfront payments, milestone structures, royalty rates, territory scope, and development obligations where disclosed.',
  },
  {
    question: 'How is Solidus different from DealForma or Cortellis?',
    answer: `Solidus goes beyond deal aggregation. Every transaction in the database is benchmarked against comparable deals, with quantitative analysis including rNPV modeling, Monte Carlo simulation (10,000 iterations), and Pharma Intent Score tracking. While platforms like DealForma and Cortellis catalog deals, Solidus provides the analytical layer — what a deal is worth, how it compares, and what it signals about partner strategy.`,
  },
  {
    question: 'Is the tracker free?',
    answer: 'Yes. The core deal tracker and calculator are free to use with no account required. Free access includes deal browsing, basic benchmarking across all 12 therapeutic areas, and company profiles. Pro subscribers unlock rNPV modeling, Monte Carlo simulation, AI deal memos, comparable deal analysis, and full negotiation playbooks.',
  },
];

const THERAPEUTIC_AREAS = [
  { slug: 'oncology', name: 'Oncology' },
  { slug: 'neurology', name: 'Neurology & CNS' },
  { slug: 'immunology', name: 'Immunology' },
  { slug: 'cardiovascular', name: 'Cardiovascular' },
  { slug: 'metabolic', name: 'Metabolic & Obesity' },
  { slug: 'rareDisease', name: 'Rare Disease' },
  { slug: 'infectiousDisease', name: 'Infectious Disease' },
  { slug: 'ophthalmology', name: 'Ophthalmology' },
  { slug: 'dermatology', name: 'Dermatology' },
  { slug: 'womensHealth', name: "Women's Health" },
  { slug: 'gastroenterology', name: 'Gastroenterology' },
  { slug: 'hematology', name: 'Hematology' },
];

const DIFFERENTIATORS = [
  {
    title: 'Deal Benchmarking',
    description: 'Every transaction is benchmarked against comparable deals by phase, modality, therapeutic area, and deal structure. Know instantly where a deal falls relative to market norms.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    title: 'rNPV Modeling',
    description: 'Risk-adjusted net present value calculations calibrated to phase-specific success probabilities, development timelines, and market assumptions. Not back-of-envelope math — real financial modeling.',
    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  },
  {
    title: 'Monte Carlo Simulation',
    description: '10,000-iteration stochastic simulation across every material variable — approval probability, market size, competitive dynamics, pricing erosion. Probability distributions, not point estimates.',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  },
  {
    title: 'Pharma Intent Score',
    description: 'Proprietary 10-factor scoring system that tracks acquirer behavior signals — clinical investments, hiring patterns, conference activity, pipeline gaps — to surface which pharma companies are most likely to transact next.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  {
    title: 'Deal Structure Analysis',
    description: 'Milestone waterfall decomposition, royalty tier modeling, territory economics, and option exercise analysis. Understand not just total deal value, but how value is structured and when it realizes.',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    title: 'Competitive Dynamics',
    description: 'Track how competitive landscape shifts affect deal terms. See how new entrants, regulatory decisions, and clinical readouts in adjacent programs reprice comparable assets in real time.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
];

export default function TrackerPage() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://solidus.ambrosiaventures.co' },
    { name: 'Deal Tracker' },
  ]);

  const webPageSchema = generateWebPageSchema({
    name: 'Biopharma Deal Tracker 2026',
    description: `Track every biopharma deal in real time. ${DEAL_STATS.TOTAL_DEALS} verified M&A, licensing, and partnership transactions across 12 therapeutic areas.`,
    url: 'https://solidus.ambrosiaventures.co/tracker',
  });

  const faqSchema = generateFAQSchema(FAQS);

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Biopharma Deal Tracker 2026',
    description: `Real-time database of ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions including M&A, licensing, collaborations, and partnerships across 12 therapeutic areas. Includes upfront payments, milestone structures, royalty rates, and deal terms.`,
    url: 'https://solidus.ambrosiaventures.co/tracker',
    keywords: [
      'biopharma deal tracker',
      'biotech M&A database',
      'pharma licensing tracker',
      'biopharma transactions 2026',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: 'https://solidus.ambrosiaventures.co',
    },
    temporalCoverage: '2011/2026',
    variableMeasured: [
      'Upfront Payment (USD)',
      'Total Deal Value (USD)',
      'Milestone Payments',
      'Royalty Rates',
      'Development Phase',
      'Therapeutic Area',
      'Modality',
      'Deal Type',
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />

      <main className="min-h-screen bg-[#0a0e1a]">
        {/* ─── Hero ─── */}
        <header className="relative pt-24 pb-20 px-4 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,165,0.15),rgba(255,255,255,0))]" />
            <div className="absolute top-32 right-[8%] w-80 h-80 bg-teal-500/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-[5%] w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500 mb-10">
              <Link href="/" className="hover:text-teal-400 transition-colors">
                Home
              </Link>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-slate-300 font-medium">Deal Tracker</span>
            </nav>

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-300 text-sm mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Updated Daily
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1]">
                Biopharma Deal{' '}
                <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Tracker
                </span>{' '}
                2026
              </h1>

              <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl">
                Every M&A, licensing, and partnership deal across life sciences — tracked,
                benchmarked, and analyzed. {DEAL_STATS.TOTAL_DEALS} verified transactions.
                12 therapeutic areas. Real-time coverage.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/calculator?utm_source=seo&utm_medium=tracker&utm_content=hero_cta"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20"
                >
                  Explore Deals
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
                <Link
                  href="/benchmarks?utm_source=seo&utm_medium=tracker&utm_content=hero_secondary"
                  className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/5 transition-all"
                >
                  View Benchmarks
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Stats Bar ─── */}
        <section className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="max-w-5xl mx-auto px-4 py-10 sm:py-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
              {[
                { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals', sublabel: 'M&A, licensing, partnerships' },
                { value: '12', label: 'Therapeutic Areas', sublabel: 'Oncology to rare disease' },
                { value: '23+', label: 'Modalities Tracked', sublabel: 'ADCs, CAR-T, gene therapy, mAbs' },
                { value: 'Daily', label: 'Update Frequency', sublabel: 'SEC, FTC, press releases' },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-sm font-semibold text-teal-400 mb-0.5">{stat.label}</p>
                  <p className="text-xs text-slate-500">{stat.sublabel}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 2026 Deal Landscape ─── */}
        <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Market Overview</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            2026 Deal Landscape
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mb-12">
            The biopharma transaction market is on pace for a record year. Here is what the
            data shows through H1 2026.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-4xl font-bold text-white mb-2">$134B+</p>
              <p className="text-sm font-semibold text-teal-400 mb-1">Total Deal Value, H1 2026</p>
              <p className="text-sm text-slate-500">
                Aggregate disclosed value across M&A, licensing, and partnerships in the first half of 2026 — surpassing full-year 2024 totals.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-4xl font-bold text-white mb-2">33</p>
              <p className="text-sm font-semibold text-teal-400 mb-1">Acquisitions Over $1B</p>
              <p className="text-sm text-slate-500">
                Large-cap pharma is deploying cash aggressively. Oncology and immunology dominate mega-deal activity, with obesity/metabolic a close third.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-4xl font-bold text-white mb-2">Record</p>
              <p className="text-sm font-semibold text-teal-400 mb-1">Deal Pace</p>
              <p className="text-sm text-slate-500">
                Transaction volume is up 28% year-over-year. Patent cliffs, IRA pricing pressure, and GLP-1 competition are accelerating dealmaking across the sector.
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-teal-500/[0.06] to-cyan-500/[0.06] border border-teal-500/10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="flex-1">
                <p className="text-white font-semibold mb-1">Weekly deal intelligence in your inbox</p>
                <p className="text-sm text-slate-400">
                  Market Pulse delivers the week&apos;s most significant transactions, benchmark shifts,
                  and strategic analysis every Monday.
                </p>
              </div>
              <Link
                href="/pulse?utm_source=seo&utm_medium=tracker&utm_content=pulse_cta"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500/15 border border-teal-500/25 text-teal-300 font-semibold rounded-lg hover:bg-teal-500/25 transition-all text-sm whitespace-nowrap"
              >
                Read Market Pulse
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── What Makes Solidus Different ─── */}
        <section className="border-t border-white/[0.06] bg-white/[0.01]">
          <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
            <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Beyond Aggregation</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Not just a deal list. A deal intelligence platform.
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mb-12">
              Generic trackers catalog transactions. Solidus tells you what they mean —
              quantitatively. Every deal is benchmarked, valued, and analyzed with the same
              rigor a top-tier advisory desk applies to live mandates.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {DIFFERENTIATORS.map((item) => (
                <div
                  key={item.title}
                  className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/15 transition-colors"
                >
                  <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Therapeutic Areas ─── */}
        <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Coverage</p>
          <h2 className="text-3xl font-bold text-white mb-4">
            12 Therapeutic Areas. Full Deal Coverage.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mb-10">
            From blockbuster oncology acquisitions to rare disease licensing, Solidus tracks
            deal activity across every major therapeutic category in biopharma.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {THERAPEUTIC_AREAS.map((ta) => (
              <Link
                key={ta.slug}
                href={`/therapeutic-areas/${ta.slug}?utm_source=seo&utm_medium=tracker&utm_content=ta_grid`}
                className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/20 hover:bg-white/[0.04] transition-all"
              >
                <p className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors">
                  {ta.name}
                </p>
                <p className="text-xs text-slate-500 mt-1">View deals</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── How It Works ─── */}
        <section className="border-t border-white/[0.06] bg-white/[0.01]">
          <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
            <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Getting Started</p>
            <h2 className="text-3xl font-bold text-white mb-10">
              From deal search to board-ready analysis in minutes
            </h2>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Search & filter',
                  description: 'Find deals by therapeutic area, modality, phase, deal type, value range, or company. Browse the full database or zero in on your competitive set.',
                  link: { href: '/calculator?utm_source=seo&utm_medium=tracker&utm_content=step1', label: 'Open Calculator' },
                },
                {
                  step: '02',
                  title: 'Benchmark & compare',
                  description: 'Every result includes percentile positioning, comparable deals, and benchmark ranges for upfronts, milestones, and royalties. Context, not just data.',
                  link: { href: '/benchmarks?utm_source=seo&utm_medium=tracker&utm_content=step2', label: 'View Benchmarks' },
                },
                {
                  step: '03',
                  title: 'Model & present',
                  description: 'Run rNPV, Monte Carlo, and scenario analysis. Generate deal memos and negotiation playbooks. Export board-ready reports.',
                  link: { href: '/companies?utm_source=seo&utm_medium=tracker&utm_content=step3', label: 'Explore Companies' },
                },
              ].map((item) => (
                <div key={item.step}>
                  <p className="text-5xl font-bold text-teal-500/20 mb-4">{item.step}</p>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{item.description}</p>
                  <Link
                    href={item.link.href}
                    className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors inline-flex items-center gap-1"
                  >
                    {item.link.label}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Who Uses Solidus ─── */}
        <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Built For</p>
          <h2 className="text-3xl font-bold text-white mb-10">
            The deal intelligence layer for biopharma professionals
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                title: 'Business Development & Licensing',
                description: 'Benchmark your deal terms against market. Identify the right partners. Build data-backed negotiation positions instead of relying on anecdote and instinct.',
              },
              {
                title: 'Corporate Development & M&A',
                description: 'Screen acquisition targets with real comparable transaction data. Model deal economics with phase-adjusted rNPV and Monte Carlo simulation before term sheets go out.',
              },
              {
                title: 'Venture Capital & Investment',
                description: 'Evaluate portfolio company licensing potential. Size exit scenarios against verified deal comps. Track competitor deal activity across your thesis areas.',
              },
              {
                title: 'Strategy & Consulting',
                description: 'Arm client presentations with current, verified deal data. Build competitive landscape analyses that reference actual transaction terms, not estimates.',
              },
            ].map((persona) => (
              <div
                key={persona.title}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
              >
                <h3 className="text-base font-semibold text-white mb-2">{persona.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{persona.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="border-t border-white/[0.06] bg-white/[0.01]">
          <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
            <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-white mb-10">
              Frequently Asked Questions
            </h2>

            <div className="space-y-8">
              {FAQS.map((faq, index) => (
                <div key={index} className="border-b border-white/[0.06] pb-8 last:border-0">
                  <h3 className="text-base font-semibold text-white mb-3">{faq.question}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Advisory CTA ─── */}
        <section className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
          <div className="p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/[0.06] text-center">
            <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">Advisory Services</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Need deal-level advisory, not just data?
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto mb-8">
              Ambrosia Ventures provides hands-on M&A and licensing advisory for biotech companies
              navigating complex transactions. The same team and data behind Solidus, applied
              directly to your deal.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://ambrosiaventures.co/advisory"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20"
              >
                Learn About Advisory
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <Link
                href="/calculator?utm_source=seo&utm_medium=tracker&utm_content=bottom_cta"
                className="inline-flex items-center gap-2 px-7 py-3.5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/5 transition-all"
              >
                Try the Free Calculator
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Bottom SEO Content ─── */}
        <section className="border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <h2 className="text-xl font-bold text-white mb-4">
              About the Solidus Biopharma Deal Tracker
            </h2>
            <div className="prose prose-sm prose-invert prose-slate max-w-none text-slate-400 space-y-4">
              <p>
                The Solidus biopharma deal tracker is built and maintained by{' '}
                <a href="https://ambrosiaventures.co" className="text-teal-400 hover:text-teal-300 transition-colors">
                  Ambrosia Ventures
                </a>
                , a life sciences M&A advisory firm. Unlike passive deal databases, Solidus applies
                quantitative analysis to every transaction — risk-adjusted valuation, stochastic
                simulation, and competitive benchmarking — using the same frameworks applied in
                live advisory mandates.
              </p>
              <p>
                The database currently contains {DEAL_STATS.TOTAL_DEALS}{' '}
                {DEAL_STATS.TOTAL_DEALS_DESCRIPTION}. Coverage spans 2011 to present with
                comprehensive indexing of 2024-2026 transaction activity.
              </p>
              <p>
                For professionals evaluating licensing opportunities, assessing acquisition
                targets, or building competitive intelligence, Solidus provides the analytical
                depth that generic deal aggregators lack. Explore the{' '}
                <Link href="/benchmarks" className="text-teal-400 hover:text-teal-300 transition-colors">
                  deal benchmarks
                </Link>
                , run a{' '}
                <Link href="/calculator" className="text-teal-400 hover:text-teal-300 transition-colors">
                  custom analysis
                </Link>
                , or browse{' '}
                <Link href="/companies" className="text-teal-400 hover:text-teal-300 transition-colors">
                  {DEAL_STATS.TOTAL_COMPANIES} company profiles
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
