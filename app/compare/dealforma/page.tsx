import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Solidus vs DealForma — Biopharma Deal Intelligence Comparison | 2026',
  description:
    'Compare Solidus to DealForma for biopharma deal benchmarking. See how deal coverage, analytical engines, pricing, and workflow compare for BD teams.',
  keywords: [
    'DealForma alternative',
    'DealForma vs',
    'biopharma deal database comparison',
    'DealForma competitor',
    'biopharma deal intelligence',
    'licensing deal comps',
    'deal benchmarking platform',
  ],
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/compare/dealforma',
  },
  openGraph: {
    title: 'Solidus vs DealForma — Biopharma Deal Intelligence Comparison | 2026',
    description:
      'Compare Solidus to DealForma for biopharma deal benchmarking. Integrated rNPV modeling, 21 analytical engines, and real-time benchmarking vs established deal comps.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/compare/dealforma',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solidus vs DealForma | Biopharma Deal Intelligence',
    description:
      'Which biopharma deal platform fits your workflow? Feature-by-feature comparison.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'Is Solidus a good alternative to DealForma for biopharma deal comps?',
    answer:
      'Yes. DealForma is well-established for licensing deal comparables, particularly upfront and milestone data. Solidus goes further by integrating deal comps with 21 analytical engines — rNPV modeling, Monte Carlo simulation, competitive dynamics, partner matching, and AI-generated deal memos — so you move from data to decision in one workflow. If your team needs more than a reference database, Solidus is built for that.',
  },
  {
    question: 'How does Solidus pricing compare to DealForma?',
    answer:
      'DealForma subscriptions typically run $15,000-$30,000+ per year depending on modules and seat count, with annual contracts. Solidus Pro starts at $199/month (annual) or $299/month with no contract required. Both platforms offer tiered access, but Solidus provides transparent self-serve pricing with a free tier that includes core benchmarking across 12 therapeutic areas.',
  },
  {
    question: 'Can I use Solidus and DealForma together?',
    answer:
      'Absolutely. Some BD teams use DealForma as a reference database for historical deal comps and Solidus for active deal modeling — running rNPV scenarios, Monte Carlo simulations, and partner matching against their specific asset parameters. The platforms are complementary: DealForma for looking up precedent, Solidus for building the analytical case around a live transaction.',
  },
];

const FEATURES = [
  { feature: 'Licensing Deal Comps Database', solidus: true, competitor: true },
  { feature: 'Upfront/Milestone Benchmarking', solidus: true, competitor: true },
  { feature: 'rNPV Valuation Engine', solidus: true, competitor: false },
  { feature: 'Monte Carlo Simulation (10K iterations)', solidus: true, competitor: false },
  { feature: 'AI Deal Memos & Narratives', solidus: true, competitor: false },
  { feature: 'Partner Matching (850+ companies)', solidus: true, competitor: false },
  { feature: 'Competitive Dynamics Engine', solidus: true, competitor: false },
  { feature: 'Real Options Valuation', solidus: true, competitor: false },
  { feature: 'Pharma Intent Scoring', solidus: true, competitor: false },
  { feature: 'Deal Waterfall Analysis', solidus: true, competitor: false },
  { feature: 'Royalty Rate Benchmarking', solidus: true, competitor: true },
  { feature: 'Therapeutic Area Filtering', solidus: true, competitor: true },
  { feature: 'PDF/Excel Export', solidus: true, competitor: true },
  { feature: 'Free Tier Available', solidus: true, competitor: false },
  { feature: 'Self-Serve Signup (No Sales Call)', solidus: true, competitor: false },
  { feature: 'API Access', solidus: true, competitor: true },
];

function Check() {
  return (
    <svg className="w-5 h-5 text-teal-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="w-5 h-5 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function DealFormaComparePage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://solidus.ambrosiaventures.co',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Compare',
        item: 'https://solidus.ambrosiaventures.co/compare',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'vs DealForma',
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0a0e1a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <Link
          href="/compare"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-400 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Comparisons
        </Link>
        <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">
          Platform Comparison
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Solidus vs DealForma: Which Biopharma Deal Platform Fits Your Workflow?
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          DealForma has been a go-to for biopharma licensing comps since 2013. Solidus takes the
          deal intelligence layer further with {DEAL_STATS.TOTAL_DEALS} verified transactions, 21
          integrated analytical engines, and real-time benchmarking starting at{' '}
          {PRICING.PRO_ANNUAL_MONTHLY}.
        </p>
      </section>

      {/* Overview */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Two Different Approaches to Deal Intelligence</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            DealForma built its reputation as a curated licensing deal database. It excels at
            providing searchable deal comps with clean upfront, milestone, and royalty data points
            that BD professionals have relied on for term sheet benchmarking.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Solidus was built by practitioners who needed more than a reference database. It
            integrates deal comps with valuation engines, partner matching, competitive dynamics
            modeling, and AI-powered analysis — so your team goes from &ldquo;what did comparable
            deals pay?&rdquo; to &ldquo;what should this deal be worth, and who should we talk
            to?&rdquo; in one platform.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Feature Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-4 px-5 text-slate-400 font-medium">Feature</th>
                <th className="text-center py-4 px-5 text-teal-400 font-semibold">Solidus</th>
                <th className="text-center py-4 px-5 text-slate-400 font-medium">DealForma</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(({ feature, solidus, competitor }, i) => (
                <tr
                  key={feature}
                  className={`border-b border-white/[0.04] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                >
                  <td className="py-3.5 px-5 text-slate-300 font-medium">{feature}</td>
                  <td className="py-3.5 px-5">{solidus ? <Check /> : <Cross />}</td>
                  <td className="py-3.5 px-5">{competitor ? <Check /> : <Cross />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Key Differentiators */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Key Differentiators</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: 'From Comps to Conclusions',
              description:
                'DealForma gives you the data points. Solidus gives you the analysis. Run rNPV models, Monte Carlo simulations, and scenario comparisons directly on top of deal benchmarks — no spreadsheet gymnastics required.',
            },
            {
              title: '21 Integrated Analytical Engines',
              description:
                'Deal waterfall, tornado sensitivity, competitive dynamics, real options valuation, partner matching, Pharma Intent Scoring, AI deal memos — all connected to the same deal dataset. DealForma provides the database; Solidus provides the analytical layer.',
            },
            {
              title: 'Built by Deal Practitioners',
              description:
                'Solidus was built by an M&A advisory team that structures real transactions. The engines reflect how BD professionals actually work — not how a data vendor thinks they should. Every feature maps to a real workflow in deal evaluation.',
            },
            {
              title: 'Accessible Pricing, No Procurement',
              description: `Start free, upgrade to Pro at ${PRICING.PRO_ANNUAL_MONTHLY} (annual) with no contract. DealForma requires annual subscriptions typically starting at $15K-$30K+. Solidus makes institutional-grade deal intelligence accessible to emerging biotech teams, not just large pharma.`,
            },
          ].map(({ title, description }) => (
            <div
              key={title}
              className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who Should Choose */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Which Platform Fits Your Team?</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-teal-500/5 border border-teal-500/20">
            <h3 className="text-lg font-semibold text-teal-400 mb-4">Choose Solidus if you need to:</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Model deal economics with rNPV, Monte Carlo, and scenario analysis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Generate AI-powered deal memos and negotiation playbooks
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Match assets to potential partners with intent scoring
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Track competitive dynamics across therapeutic areas in real time
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Get started quickly without a procurement cycle or six-figure budget
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Work across the full deal lifecycle, not just the comp search
              </li>
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-lg font-semibold text-slate-300 mb-4">Choose DealForma if you need to:</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Search a well-established licensing deal comps database
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Reference historical deal terms for term sheet benchmarking
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Access deal summaries and press release aggregation
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Work within a team already trained on DealForma&apos;s interface
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Pricing Comparison</h2>
          <p className="text-slate-400 mb-6">
            Both platforms serve biopharma BD teams. The difference is access model and analytical depth.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-teal-500/5 border border-teal-500/20">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-1">
                Solidus Pro
              </p>
              <p className="text-3xl font-bold text-white">
                {PRICING.PRO_ANNUAL_MONTHLY}{' '}
                <span className="text-sm font-normal text-slate-500">(annual)</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or {PRICING.PRO_MONTHLY} month-to-month
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li>All 21 analytical engines</li>
                <li>Unlimited benchmarks &amp; exports</li>
                <li>AI deal memos &amp; negotiation playbooks</li>
                <li>Partner matching &amp; intent scoring</li>
                <li>Free tier available &mdash; no contract required</li>
              </ul>
            </div>
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                DealForma
              </p>
              <p className="text-3xl font-bold text-white">
                ~$15K-$30K+<span className="text-sm font-normal text-slate-500">/year</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Annual subscriptions, module-dependent</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>Deal comps database access</li>
                <li>Annual commitment typically required</li>
                <li>No integrated valuation engines</li>
                <li>No free tier</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <div
              key={question}
              className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <h3 className="text-base font-semibold text-white mb-2">{question}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cross-links */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Explore Solidus</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: '/benchmarks', label: 'Deal Benchmarks', desc: 'Browse benchmarks by TA and phase' },
            { href: '/calculator', label: 'Deal Calculator', desc: 'Model your deal parameters' },
            { href: '/tracker', label: 'Deal Tracker', desc: 'Monitor live deal activity' },
            { href: 'https://ambrosiaventures.co/advisory', label: 'Advisory', desc: 'Bespoke deal intelligence' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-teal-500/20 hover:bg-white/[0.04] transition-all"
              {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <p className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors">
                {label}
              </p>
              <p className="text-xs text-slate-500 mt-1">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center rounded-xl bg-gradient-to-b from-teal-500/5 to-transparent border border-teal-500/10 p-10">
          <h2 className="text-2xl font-bold text-white mb-3">
            More Than a Deal Database
          </h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Run your asset through Solidus&apos;s 21 engines and see the deal intelligence
            that a reference database alone can&apos;t provide.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/calculator"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all text-sm"
            >
              Start Free Trial
            </Link>
            <Link
              href="mailto:issa@ambrosiaventures.co?subject=Demo%20Request"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.04] border border-white/[0.1] text-white font-semibold rounded-xl hover:bg-white/[0.08] transition-all text-sm"
            >
              Schedule Demo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
