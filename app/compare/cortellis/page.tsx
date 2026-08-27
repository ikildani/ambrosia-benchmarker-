import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Solidus vs Cortellis Deals Intelligence — Platform Comparison | 2026',
  description:
    'Compare Solidus to Clarivate Cortellis Deals Intelligence for biopharma deal analysis. See how analytical depth, pricing, workflow, and deal coverage compare.',
  keywords: [
    'Cortellis alternative',
    'Cortellis Deals Intelligence alternative',
    'Clarivate deals alternative',
    'Cortellis competitor',
    'biopharma deal intelligence platform',
    'pharma deal database comparison',
  ],
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/compare/cortellis',
  },
  openGraph: {
    title: 'Solidus vs Cortellis Deals Intelligence — Platform Comparison | 2026',
    description:
      'Compare Solidus to Clarivate Cortellis for biopharma deal intelligence. Purpose-built modeling vs enterprise data platform.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/compare/cortellis',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solidus vs Cortellis | Biopharma Deal Intelligence',
    description:
      'Biopharma deal intelligence for modern teams. How Solidus and Cortellis compare.',
  },
};

const FAQ_ITEMS = [
  {
    question: 'What is the main difference between Solidus and Cortellis Deals Intelligence?',
    answer:
      'Cortellis Deals Intelligence is part of the Clarivate ecosystem and provides a massive database of 15,500+ deal records with contract-level access, regulatory data, and patent analytics. Solidus is purpose-built for deal teams who need to move from data to decision — integrating deal benchmarks with 21 analytical engines including rNPV modeling, Monte Carlo simulation, AI deal memos, and partner matching. Cortellis covers breadth; Solidus covers analytical depth.',
  },
  {
    question: 'Is Solidus a cheaper alternative to Cortellis?',
    answer:
      'Substantially. Solidus Pro starts at $199/month (annual) or $299/month with no contract required, and includes a free tier for core benchmarking. Cortellis enterprise licenses typically run $100,000-$150,000+ per year depending on modules, with multi-year commitments and per-seat pricing. For teams that need deal modeling capabilities rather than enterprise-wide data access, Solidus delivers more analytical depth at a fraction of the cost.',
  },
  {
    question: 'Can Solidus and Cortellis be used together?',
    answer:
      'Yes, and many sophisticated pharma BD teams do exactly this. Cortellis provides the upstream pipeline intelligence, regulatory context, and patent landscape data. Solidus provides the downstream deal economics — valuation models, competitive dynamics, partner matching, and negotiation analytics. Together they cover the full deal evaluation workflow from target identification through term sheet negotiation.',
  },
];

const FEATURES = [
  { feature: 'Deal Terms Database', solidus: true, competitor: true },
  { feature: 'rNPV Valuation Engine', solidus: true, competitor: false },
  { feature: 'Monte Carlo Simulation (10K iterations)', solidus: true, competitor: false },
  { feature: 'AI Deal Memos & Narratives', solidus: true, competitor: false },
  { feature: 'Partner Matching (700+ companies)', solidus: true, competitor: false },
  { feature: 'Competitive Dynamics Engine', solidus: true, competitor: false },
  { feature: 'Real Options Valuation', solidus: true, competitor: false },
  { feature: 'Pharma Intent Scoring', solidus: true, competitor: false },
  { feature: 'Deal Waterfall Analysis', solidus: true, competitor: false },
  { feature: 'Real-time Deal Benchmarking', solidus: true, competitor: false },
  { feature: 'Pipeline Intelligence (global)', solidus: false, competitor: true },
  { feature: 'Regulatory & Clinical Trial Data', solidus: false, competitor: true },
  { feature: 'Patent Analytics', solidus: false, competitor: true },
  { feature: 'Contract-Level Document Access', solidus: false, competitor: true },
  { feature: 'PDF/Excel Export', solidus: true, competitor: true },
  { feature: 'Self-Serve Signup (No Sales Call)', solidus: true, competitor: false },
  { feature: 'Free Tier Available', solidus: true, competitor: false },
  { feature: 'API Access', solidus: true, competitor: true },
  { feature: 'Pricing Transparency', solidus: true, competitor: false },
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

export default function CortellisComparePage() {
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
        name: 'vs Cortellis',
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
          Solidus vs Cortellis: Biopharma Deal Intelligence for Modern Teams
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl">
          Clarivate Cortellis is an enterprise standard for pipeline and regulatory intelligence
          with 15,500+ deal records. Solidus delivers the deal economics and modeling layer
          that modern BD teams need — {DEAL_STATS.TOTAL_DEALS} verified transactions, 21
          analytical engines, and pricing starting at {PRICING.PRO_ANNUAL_MONTHLY}.
        </p>
      </section>

      {/* Overview */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Enterprise Data Platform vs Purpose-Built Deal Workbench</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Cortellis Deals Intelligence sits within the broader Clarivate ecosystem — connecting deal
            data to pipeline intelligence, regulatory filings, clinical trial databases, and patent
            analytics. It is built for organizations that need enterprise-wide data access across
            research, regulatory, and commercial functions.
          </p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Solidus is built specifically for deal teams. Rather than covering the full R&D
            intelligence landscape, it goes deep on the deal economics workflow: benchmarking
            deal terms, modeling valuations, matching partners, scoring buyer intent, and
            generating the analytical narratives that drive board presentations and partner
            negotiations. Different problems. Different tools.
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
                <th className="text-center py-4 px-5 text-slate-400 font-medium">Cortellis</th>
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
              title: 'Deal Economics, Not Pipeline Data',
              description:
                'Cortellis maps pipelines, regulatory milestones, and patent landscapes. Solidus analyzes the deal terms themselves — what comparable transactions paid in upfronts, how milestone structures break down by type, what royalty rates look like by therapeutic area and phase, and how competitive dynamics affect deal leverage.',
            },
            {
              title: '21 Integrated Analytical Engines',
              description:
                'Run rNPV, Monte Carlo simulation, real options, tornado sensitivity, deal waterfall, competitive dynamics, partner matching, and AI deal memo generation on demand. Cortellis provides deal summaries and search — Solidus provides the analytical workbench.',
            },
            {
              title: 'Faster Time to Decision',
              description:
                'Cortellis is designed for comprehensive research workflows across large organizations. Solidus is designed for the BD professional who needs to benchmark a deal, model scenarios, and build a recommendation deck in hours, not weeks. Self-serve access, no IT provisioning.',
            },
            {
              title: 'A Fraction of the Cost',
              description: `Solidus Pro starts at ${PRICING.PRO_ANNUAL_MONTHLY} (annual) with no contract. Cortellis enterprise licenses typically run $100K-$150K+ per year with per-module pricing, multi-year commitments, and per-seat costs. For smaller biotech teams and emerging pharma, Solidus delivers institutional-grade analysis without the enterprise price tag.`,
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
                Model deal valuations with rNPV, Monte Carlo, and scenario analysis
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Generate AI deal memos and negotiation playbooks for board presentations
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Match assets to potential acquirers and partners with intent scoring
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Move from benchmarking to recommendation in one platform
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Get institutional-grade deal analytics without enterprise procurement
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">&#x2022;</span>
                Serve a smaller team that needs depth over breadth
              </li>
            </ul>
          </div>
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-lg font-semibold text-slate-300 mb-4">Choose Cortellis if you need to:</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Access a massive 15,500+ deal record database with contract documents
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Connect deal data to Clarivate&apos;s pipeline, regulatory, and patent intelligence
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Serve a large enterprise with research, regulatory, and commercial users
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Maintain a single vendor relationship across the full Clarivate suite
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">&#x2022;</span>
                Prioritize database coverage over integrated analytical modeling
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
            Cortellis is built for large pharma with enterprise budgets and organization-wide
            data needs. Solidus delivers deal-specific analytical depth at a fraction of the cost.
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
                Clarivate Cortellis
              </p>
              <p className="text-3xl font-bold text-white">
                ~$120K+<span className="text-sm font-normal text-slate-500">/year</span>
              </p>
              <p className="text-sm text-slate-400 mt-1">Per-module enterprise pricing</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>Module-based pricing adds up</li>
                <li>Multi-year commitments expected</li>
                <li>Per-seat costs on top</li>
                <li>Sales-led procurement only</li>
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
            The Deal Modeling Layer Cortellis Doesn&apos;t Cover
          </h2>
          <p className="text-slate-400 mb-6 max-w-xl mx-auto">
            Run your asset through Solidus&apos;s 21 analytical engines and get the deal-level
            modeling that pipeline databases can&apos;t provide.
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
