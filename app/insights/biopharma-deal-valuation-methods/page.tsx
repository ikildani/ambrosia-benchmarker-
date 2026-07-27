import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';
import { TableOfContents } from '@/components/insights/TableOfContents';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { DEAL_STATS } from '@/lib/config/constants';

const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));

const BASE_URL = 'https://solidus.ambrosiaventures.co';
const PAGE_URL = `${BASE_URL}/insights/biopharma-deal-valuation-methods`;

export const metadata: Metadata = {
  title: 'Biopharma Deal Valuation: Comparable Transactions, rNPV & Monte Carlo Compared | Ambrosia Ventures',
  description: 'Compare the three core biopharma deal valuation methods: comparable transactions, risk-adjusted NPV (rNPV), and Monte Carlo simulation. Includes PoS rates by phase, discount rate guidance, and the institutional approach to combining all three.',
  keywords: [
    'biopharma deal valuation methods',
    'rNPV biotech valuation',
    'Monte Carlo simulation pharma',
    'comparable transactions biopharma',
    'risk adjusted NPV',
    'pharma deal valuation',
    'probability of success by phase',
    'biotech valuation methodology',
  ],
  openGraph: {
    title: 'Biopharma Deal Valuation: Comps, rNPV & Monte Carlo Compared',
    description: 'Three methods, different strengths. How institutional investors use comparable transactions, rNPV, and Monte Carlo simulation together to value biopharma deals.',
    type: 'article',
    url: PAGE_URL,
    images: [{ url: `/api/og?title=${encodeURIComponent('Biopharma Deal Valuation Methods')}&subtitle=${encodeURIComponent('Comps, rNPV & Monte Carlo Compared')}&type=insight`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Valuation: Comps, rNPV & Monte Carlo',
    description: 'How institutional investors combine comparable transactions, rNPV, and Monte Carlo to value biopharma deals.',
  },
  alternates: {
    canonical: PAGE_URL,
  },
};

export default function BiopharmaDealValuationMethodsPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: `${BASE_URL}/insights` },
      { '@type': 'ListItem', position: 3, name: 'Biopharma Deal Valuation Methods', item: PAGE_URL },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Biopharma Deal Valuation: Comparable Transactions, rNPV & Monte Carlo Compared',
    description: 'A comprehensive comparison of the three core valuation methods used in biopharma deal-making, with practical guidance on when and how to apply each.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-24',
    mainEntityOfPage: PAGE_URL,
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the most common biopharma deal valuation method?',
        acceptedAnswer: { '@type': 'Answer', text: 'Comparable transactions (comps) is the most widely used starting point because it requires the fewest assumptions and anchors negotiations to observable market data. However, institutional investors and large pharma BD teams typically use comps alongside rNPV and sometimes Monte Carlo to triangulate a valuation range.' },
      },
      {
        '@type': 'Question',
        name: 'What discount rate should I use for rNPV in biopharma?',
        acceptedAnswer: { '@type': 'Answer', text: 'Standard biopharma rNPV discount rates range from 8-12%. Use 8-9% for large pharma with diversified pipelines, 10% as the industry median, and 11-12% for early-stage biotech with concentrated risk. The discount rate in rNPV should reflect only the time value of money and systematic risk, since clinical risk is already captured by PoS adjustments.' },
      },
      {
        '@type': 'Question',
        name: 'How does Monte Carlo simulation differ from rNPV?',
        acceptedAnswer: { '@type': 'Answer', text: 'rNPV uses single-point probability estimates for each development phase, producing one expected value. Monte Carlo runs 10,000+ scenarios by sampling from probability distributions for every key variable (PoS, peak sales, pricing, market share, timeline). This produces a full range of outcomes with percentiles, revealing the shape of the value distribution rather than just the mean.' },
      },
      {
        '@type': 'Question',
        name: 'What are typical probability of success (PoS) rates by clinical phase?',
        acceptedAnswer: { '@type': 'Answer', text: 'Industry-wide averages: Preclinical to Phase 1 is ~65%, Phase 1 to Phase 2 is ~52%, Phase 2 to Phase 3 ranges from 28-38% depending on therapeutic area, Phase 3 to NDA filing is ~58%, and NDA to Approval is ~85%. Oncology has the lowest Phase 2 to Phase 3 PoS (~28-35%), while immunology is higher (~38%).' },
      },
      {
        '@type': 'Question',
        name: 'How do institutional investors combine all three valuation methods?',
        acceptedAnswer: { '@type': 'Answer', text: 'The institutional approach uses comps to anchor the valuation range (what the market is paying), rNPV to refine based on asset-specific cash flows and risk (what the asset is intrinsically worth), and Monte Carlo to stress-test assumptions and quantify downside scenarios. The final valuation is typically weighted: 40% comps, 35% rNPV, 25% Monte Carlo, though weights vary by deal stage.' },
      },
    ],
  };

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Biopharma Deal Valuation Methods: Comparable Transactions, rNPV & Monte Carlo',
    description: 'Comparison of the three core biopharma deal valuation methodologies with probability of success rates by phase and therapeutic area, discount rate guidance, and institutional weighting frameworks.',
    url: PAGE_URL,
    creator: { '@type': 'Organization', name: 'Ambrosia Ventures' },
    datePublished: '2026-03-24',
    license: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  };

  const tocItems = [
    { id: 'method-comparison', label: 'Method Comparison: At a Glance' },
    { id: 'comparable-transactions', label: 'Comparable Transactions: The Market Anchor' },
    { id: 'rnpv', label: 'Risk-Adjusted NPV (rNPV): The Intrinsic Value Engine' },
    { id: 'monte-carlo', label: 'Monte Carlo Simulation: Stress-Testing the Range' },
    { id: 'combining-methods', label: 'Combining All Three: The Institutional Approach' },
    { id: 'faq', label: 'Frequently Asked Questions' },
  ];

  const relatedArticles = [
    {
      href: '/insights/preclinical-asset-valuation-licensing',
      title: 'Preclinical Asset Valuation for Licensing',
      description: 'How to value preclinical-stage assets when comparable transaction data is limited.',
      badge: 'Data Report',
    },
    {
      href: '/insights/phase-2-milestone-payment-benchmarks',
      title: 'Phase 2 Milestone Payment Benchmarks',
      description: 'Milestone payment ranges and structures for Phase 2 biopharma licensing deals.',
      badge: 'Data Report',
    },
    {
      href: '/insights/oncology-upfront-payment-benchmarks',
      title: 'Oncology Upfront Payment Benchmarks',
      description: 'Phase-by-phase upfront payment ranges for oncology licensing deals with real transaction examples.',
      badge: 'Data Report',
    },
    {
      href: '/guides/rnpv-biotech-valuation',
      title: 'rNPV Biotech Valuation Guide',
      description: 'Step-by-step guide to building a risk-adjusted NPV model for biopharma deal valuation.',
      badge: 'Guide',
    },
    {
      href: '/guides/how-to-value-biotech-deal',
      title: 'How to Value a Biotech Deal',
      description: 'A complete framework for biotech deal valuation from initial screening to final term sheet.',
      badge: 'Guide',
    },
  ];

  return (
    <>
      <ScrollProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />

      <main className="min-h-screen bg-white">
        {/* Dark masthead */}
        <div className="bg-slate-900">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/"><AmbrosiaLogo variant="reversed" height={32} /></Link>
            <div className="flex items-center gap-4">
              <Link href="/calculator" className="text-xs text-slate-400 hover:text-white transition-colors">Calculator</Link>
              <Link href="/benchmarks" className="text-xs text-slate-400 hover:text-white transition-colors">Benchmarks</Link>
            </div>
          </div>
        </div>

        {/* White hero */}
        <header className="bg-white border-b border-slate-200">
          <div className="h-[3px] bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600" />
          <div className="max-w-4xl mx-auto px-6 pt-14 pb-14">
            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-teal-600 transition-colors">Home</Link>
              <span>/</span>
              <Link href="/insights" className="hover:text-teal-600 transition-colors">Insights</Link>
              <span>/</span>
              <span className="text-slate-600">Valuation Methods</span>
            </nav>
            <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-[0.25em] mb-6">Methodology &middot; March 2026</p>
            <h1 className="text-4xl sm:text-[3.5rem] font-bold text-slate-900 leading-[1.05] tracking-tight mb-4">Biopharma Deal Valuation: Comparable Transactions, rNPV & Monte Carlo Compared</h1>
            <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">Three methods, different strengths. How institutional investors and pharma BD teams triangulate deal value using comps, risk-adjusted NPV, and simulation.</p>
            <div className="flex items-center gap-8 mt-8 pt-8 border-t border-slate-100">
              <div><p className="text-2xl font-bold text-slate-900">3</p><p className="text-xs text-slate-400 uppercase tracking-wide">Methods compared</p></div>
              <div><p className="text-2xl font-bold text-slate-900">8-12%</p><p className="text-xs text-slate-400 uppercase tracking-wide">Typical discount rates</p></div>
              <div><p className="text-2xl font-bold text-slate-900">10,000+</p><p className="text-xs text-slate-400 uppercase tracking-wide">Monte Carlo scenarios</p></div>
            </div>
          </div>
        </header>

        <article className="max-w-4xl mx-auto px-6 py-12">
          <AuthorByline date="2026-03-24" />
          <p className="text-sm text-slate-400 -mt-4 mb-8">15 min read</p>

          <KeyTakeaways
            takeaways={[
              'Comparable transactions are the single most-cited reference in licensing negotiations — 85% of term sheets begin with comp-based anchoring.',
              'rNPV captures phase-specific risk: cumulative probability of success ranges from 5-8% (preclinical) to 85% (NDA\u2192approval).',
              'Monte Carlo simulation running 10,000 scenarios reveals outcome distribution — the difference between P25 and P75 can be $500M+ for Phase 2 assets.',
              'Institutional investors triangulate all three methods: comps anchor (40%), rNPV refines (35%), Monte Carlo stress-tests (25%).',
            ]}
          />

          <TableOfContents items={tocItems} />

          <section className="bg-white">
            <div className="prose prose-slate prose-lg max-w-none">
              <TrustBar />

              <p>
                Every biopharma deal negotiation rests on a valuation — and that valuation is only as credible as the methodology behind it. Walk into a licensing discussion with a single DCF spreadsheet and you will be outgunned by the counterparty&apos;s team, which is almost certainly running three separate models and triangulating them against each other.
              </p>

              <p>
                The three core valuation methods in biopharma are <strong>comparable transactions</strong> (what the market is paying), <strong>risk-adjusted NPV</strong> (what the asset is intrinsically worth), and <strong>Monte Carlo simulation</strong> (how the value distributes across thousands of scenarios). Each has distinct strengths, blind spots, and appropriate use cases. Institutional investors use all three in concert. Biotech founders and BD professionals who understand this triangulation approach negotiate from a fundamentally stronger position.
              </p>

              <p>
                This guide breaks down each method with practical implementation detail, then explains how to combine them into the integrated framework that sophisticated deal teams actually use. For the underlying data that powers comparable transaction analysis, see our <Link href="/methodology" className="text-teal-600 font-medium hover:text-teal-700">methodology page</Link>.
              </p>

              <h2 id="method-comparison">Method Comparison: At a Glance</h2>

              <p>
                Before diving into each method, it is useful to see them side by side. The table below compares key characteristics — this is not gated because understanding the landscape is foundational to everything that follows.
              </p>
            </div>

            {/* Method comparison table — NOT gated (foundational framework) */}
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-10 mb-2">Exhibit 1</p>
            <div className="my-4 bg-white rounded-xl border border-slate-200 p-6">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Dimension</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Comparable Transactions</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">rNPV</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Monte Carlo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Key Inputs</td>
                      <td className="py-3 px-4 text-slate-600">Deal database, phase, TA, modality filters</td>
                      <td className="py-3 px-4 text-slate-600">Cash flows, PoS rates, discount rate, timeline</td>
                      <td className="py-3 px-4 text-slate-600">Probability distributions for all rNPV inputs</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Primary Output</td>
                      <td className="py-3 px-4 text-slate-600">Benchmark range (25th-75th percentile)</td>
                      <td className="py-3 px-4 text-slate-600">Single expected value (risk-adjusted)</td>
                      <td className="py-3 px-4 text-slate-600">Full distribution with percentiles</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Best For</td>
                      <td className="py-3 px-4 text-slate-600">Anchoring negotiations, quick sanity checks</td>
                      <td className="py-3 px-4 text-slate-600">Asset-specific intrinsic valuation</td>
                      <td className="py-3 px-4 text-slate-600">Stress-testing, understanding tail risk</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Assumptions Required</td>
                      <td className="py-3 px-4 text-slate-600">Fewest — relies on market data</td>
                      <td className="py-3 px-4 text-slate-600">Moderate — PoS, revenue, costs</td>
                      <td className="py-3 px-4 text-slate-600">Most — distributions for every variable</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Key Limitation</td>
                      <td className="py-3 px-4 text-slate-600">Backward-looking; ignores asset-specific factors</td>
                      <td className="py-3 px-4 text-slate-600">Sensitive to PoS and discount rate assumptions</td>
                      <td className="py-3 px-4 text-slate-600">Garbage in, garbage out; complex to build</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">Typical Weighting</td>
                      <td className="py-3 px-4 text-slate-600"><strong className="text-blue-700">40%</strong></td>
                      <td className="py-3 px-4 text-slate-600"><strong className="text-blue-700">35%</strong></td>
                      <td className="py-3 px-4 text-slate-600"><strong className="text-blue-700">25%</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">Weightings reflect typical institutional investor approach. Individual deal teams may adjust based on data availability and asset specifics.</p>
            </div>
          </section>

          <section className="bg-slate-50 -mx-6 px-6 py-12 my-10 rounded-sm">
            <div className="prose prose-slate prose-lg max-w-none">
              <h2 id="comparable-transactions">Comparable Transactions: The Market Anchor</h2>

              <p>
                Comparable transaction analysis — often called &quot;comps&quot; — is the most intuitive and widely used starting point for biopharma deal valuation. The premise is simple: if similar assets at similar stages of development have been licensed or acquired at certain values, your asset should be valued in a comparable range.
              </p>

              <p>
                The power of comps lies in their objectivity. Unlike rNPV, which requires you to forecast cash flows 10-15 years into the future, comps rely on observed market behavior. When you tell a counterparty that &quot;the median Phase 2 immunology licensing deal has a $120M <Link href="/glossary/upfront-payment" className="text-teal-600 font-medium hover:text-teal-700">upfront</Link> and $1.5B total deal value,&quot; you are stating a fact from the deal record, not making an assumption.
              </p>

              <p>
                Effective comparable transaction analysis requires three steps:
              </p>

              <p>
                <strong>1. Define the peer set.</strong> Filter deals by development phase, therapeutic area, drug modality, deal type (licensing vs. acquisition vs. co-development), and time window (typically 3-5 years). Overly broad filters dilute the relevance; overly narrow filters reduce sample size. Our benchmark database uses a tiered matching algorithm that starts with tight filters and progressively widens until reaching a minimum sample of 8-12 comparable deals.
              </p>

              <p>
                <strong>2. Extract relevant metrics.</strong> The key metrics are upfront payment, total deal value (upfront + <Link href="/glossary/milestone-payment" className="text-teal-600 font-medium hover:text-teal-700">milestones</Link>), royalty rate, upfront-to-TDV ratio, and deal structure (milestone allocation by type: clinical, regulatory, commercial). For more mature assets, commercial-stage metrics like peak sales multiples become relevant.
              </p>

              <p>
                <strong>3. Adjust for asset-specific factors.</strong> No two assets are perfectly comparable. Apply qualitative adjustments for first-in-class vs. fast-follower positioning, data maturity within the stated phase, competitive landscape dynamics, and geographic scope of the license. These adjustments typically move the valuation 15-30% above or below the peer median.
              </p>

              <p>
                To illustrate the benchmark ranges that comps produce, consider the following cross-phase ranges for a Phase 2 <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">oncology</Link> ADC: the 25th percentile upfront is approximately $65M, the median is $95M, and the 75th percentile reaches $140M. This range gives both sides of a negotiation a grounded starting point. For a comprehensive breakdown of how these ranges vary by therapeutic area, see our <Link href="/insights/deal-terms-by-therapeutic-area" className="text-teal-600 font-medium hover:text-teal-700">deal terms by therapeutic area</Link> report.
              </p>

              <p>
                For a deeper exploration of the comparable transaction methodology and how to build your own comp set, see our <Link href="/methodology" className="text-teal-600 font-medium hover:text-teal-700">methodology page</Link>.
              </p>
            </div>
          </section>

          <section className="bg-white">
            <div className="prose prose-slate prose-lg max-w-none">
              <h2 id="rnpv">Risk-Adjusted NPV (rNPV): The Intrinsic Value Engine</h2>

              <p>
                Risk-adjusted NPV is the workhorse of biopharma intrinsic valuation. Unlike a standard DCF, which applies a single risk-premium to the discount rate, rNPV explicitly adjusts each future cash flow by the probability that the drug reaches the stage necessary to generate that cash flow. This produces a more granular and defensible valuation than blunt discount-rate adjustments.
              </p>

              <p>
                The core rNPV formula discounts each year&apos;s projected net cash flow by two factors: the cumulative probability of success (cPoS) to reach that year, and the time-value discount factor at the selected rate. Costs incurred during development are also probability-adjusted — if there is a 35% chance the drug fails at Phase 2, then Phase 3 development costs should be weighted at 35% of their full value.
              </p>

              <p>
                <strong>Probability of success (PoS) rates</strong> are the most critical input to rNPV. They vary substantially by therapeutic area and should be calibrated to the specific disease context, not just the industry average. The table below provides phase-transition PoS rates across therapeutic areas.
              </p>
            </div>

            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-10 mb-2">Exhibit 2</p>
            <GatedBenchmarkTable
              headers={['Phase Transition', 'Industry Average', 'Oncology', 'Neurology', 'Immunology']}
              rows={[
                ['Preclinical to Phase 1', '~65%', '62%', '60%', '68%'],
                ['Phase 1 to Phase 2', '~52%', '50%', '48%', '55%'],
                ['Phase 2 to Phase 3', '~33%', '28-35%', '33%', '38%'],
                ['Phase 3 to NDA Filing', '~58%', '55%', '56%', '62%'],
                ['NDA to Approval', '~85%', '84%', '83%', '88%'],
                ['Cumulative (Preclinical to Approval)', '~6.2%', '4.0-5.2%', '5.0%', '7.8%'],
              ]}
              freeRows={3}
              ctaText="Unlock full PoS data by therapeutic area — Pro subscription"
              ctaHref="/#pricing"
              footnote="PoS rates derived from industry meta-analyses and Ambrosia Ventures clinical outcomes database. Oncology range reflects solid tumor (lower) vs. hematologic (higher)."
            />

            <div className="prose prose-slate prose-lg max-w-none">
              <p>
                <strong>Discount rate selection</strong> in rNPV is more nuanced than in traditional finance. Because clinical risk is already captured by the PoS adjustments, the discount rate should reflect only the time value of money and systematic (non-diversifiable) risk. Standard biopharma rNPV discount rates range from 8% to 12%:
              </p>

              <ul>
                <li><strong>8-9%:</strong> Large pharma with diversified pipelines and strong commercial infrastructure</li>
                <li><strong>10%:</strong> Industry standard / midpoint for most analyses</li>
                <li><strong>11-12%:</strong> Early-stage biotech with concentrated risk, limited pipeline diversification</li>
              </ul>

              <p>
                A common mistake is &quot;double-counting&quot; risk by using high PoS adjustments <em>and</em> a high discount rate. If your PoS rates already reflect clinical failure risk, using a 15% discount rate effectively double-penalizes the asset. This is the most frequent error we see in biotech valuation models and it systematically undervalues assets by 20-40%.
              </p>

              <p>
                For a step-by-step guide to building an rNPV model, including template structures and sensitivity analysis frameworks, see our <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">rNPV biotech valuation guide</Link>.
              </p>
            </div>
          </section>

          {/* Callout — replaces InsightCallout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-sm font-semibold text-slate-900 mb-2">The discount rate double-counting trap</p>
            <p className="text-slate-600 leading-relaxed">
              If your rNPV model applies a 30% cumulative PoS (preclinical-to-approval) AND a 15% discount rate, you are effectively assuming an implicit risk rate of approximately 35-40%. This is far too aggressive for most biopharma assets and will undervalue your program by $200-500M or more for a potential blockbuster. Use 8-12% discount rates when PoS adjustments are already applied to each cash flow.
            </p>
          </div>

          <InsightCTA
            variant="mid"
            heading="Run an rNPV-Calibrated Benchmark"
            description="Our calculator combines comparable transaction data with rNPV-informed adjustments to produce deal benchmarks grounded in both market reality and intrinsic value."
          />

          <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />

          <section className="bg-slate-50 -mx-6 px-6 py-12 my-10 rounded-sm">
            <div className="prose prose-slate prose-lg max-w-none">
              <h2 id="monte-carlo">Monte Carlo Simulation: Stress-Testing the Range</h2>

              <p>
                Monte Carlo simulation extends rNPV by replacing single-point estimates with probability distributions for every key variable. Instead of assuming peak sales of $2 billion, you model peak sales as a lognormal distribution with a mean of $2 billion, a standard deviation of $800 million, and a minimum of $500 million. Instead of a fixed PoS of 33% for Phase 2-to-3, you model it as a beta distribution ranging from 25% to 45%.
              </p>

              <p>
                The simulation then runs 10,000 or more independent scenarios, sampling from each distribution in every run. The result is not a single value but a full probability distribution of outcomes. You can extract the mean (expected value), the median, the 10th percentile (downside case), the 90th percentile (upside case), and any other percentile relevant to your risk tolerance.
              </p>

              <p>
                <strong>Key variables to model as distributions:</strong>
              </p>

              <ul>
                <li><strong>Peak sales:</strong> Lognormal distribution. Anchored to market sizing analysis with uncertainty reflecting competitive dynamics, pricing risk, and adoption curves.</li>
                <li><strong>Time to peak sales:</strong> Normal distribution, typically 4-7 years post-launch for most indications.</li>
                <li><strong>Probability of success:</strong> Beta distribution, constrained to historical ranges by phase and therapeutic area.</li>
                <li><strong>Development timeline:</strong> Normal or triangular distribution, reflecting the uncertainty in trial duration, enrollment speed, and regulatory timelines.</li>
                <li><strong>Development costs:</strong> Lognormal distribution, skewed right to reflect the common pattern of cost overruns.</li>
                <li><strong>Discount rate:</strong> Uniform distribution across a narrow range (e.g., 9-11%) to test sensitivity.</li>
              </ul>

              <p>
                The primary advantage of Monte Carlo over rNPV is that it reveals the <strong>shape</strong> of the value distribution, not just the expected value. Two assets might have the same rNPV of $500 million, but one might have a Monte Carlo distribution ranging from $100M to $1.2B (high uncertainty, asymmetric upside) while the other ranges from $350M to $650M (lower uncertainty, modest range). These are very different risk profiles that should drive very different deal structures.
              </p>

              <p>
                <strong>Practical implementation.</strong> Monte Carlo simulations can be run in Excel (with add-ins like @RISK or Crystal Ball), Python (using NumPy/SciPy), or specialized biopharma valuation platforms. The key is calibrating the input distributions — this is where domain expertise matters far more than computational sophistication. A beautifully coded simulation with poorly calibrated distributions produces elegant garbage.
              </p>

              <p>
                For most biotech BD teams, we recommend starting with 5-7 key variables and building complexity incrementally. Overloading the model with 30 distribution parameters creates a false sense of precision and makes it difficult to interpret which variables are actually driving the output.
              </p>
            </div>
          </section>

          <section className="bg-white">
            <div className="prose prose-slate prose-lg max-w-none">
              <h2 id="combining-methods">Combining All Three: The Institutional Approach</h2>

              <p>
                Sophisticated deal teams at large pharma companies, institutional investors, and top-tier biotech advisory firms do not rely on any single valuation method. They use all three in a structured triangulation process where each method serves a distinct role.
              </p>

              <p>
                <strong>Step 1: Comps anchor the range.</strong> Before building any model, the deal team assembles a comparable transaction set to establish what the market is currently paying for similar assets. This sets the negotiation boundaries — regardless of what your rNPV says, you are unlikely to negotiate an <Link href="/glossary/upfront-payment" className="text-teal-600 font-medium hover:text-teal-700">upfront</Link> that is 3x the comp median without extraordinary justification.
              </p>

              <p>
                <strong>Step 2: rNPV refines the valuation.</strong> With the comp range established, the team builds an rNPV model to assess the asset&apos;s intrinsic value based on its specific clinical profile, development plan, and commercial opportunity. If the rNPV lands within the comp range, it validates the market pricing. If the rNPV is significantly above or below the comp range, it signals either an undervalued/overvalued asset or a model that needs recalibration.
              </p>

              <p>
                <strong>Step 3: Monte Carlo stress-tests.</strong> Finally, Monte Carlo simulation is applied to the rNPV framework to understand the full range of outcomes. This step is particularly valuable for deal structuring — it reveals which scenarios lead to value destruction (informing walk-away points) and which scenarios create outsized returns (informing <Link href="/glossary/milestone-payment" className="text-teal-600 font-medium hover:text-teal-700">milestone</Link> design and royalty optimization).
              </p>

              <p>
                <strong>The final synthesis</strong> typically weights the three methods: approximately 40% comparable transactions, 35% rNPV, and 25% Monte Carlo. However, these weights shift based on data availability and deal context. For preclinical assets with few comparable deals, rNPV and Monte Carlo may carry 60-70% of the weight. For approved products with rich comp sets, comps may carry 50-60%.
              </p>
            </div>
          </section>

          {/* Callout — replaces InsightCallout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-sm font-semibold text-slate-900 mb-2">The institutional edge</p>
            <p className="text-slate-600 leading-relaxed">
              Most biotech companies negotiate with a single valuation number. The counterparty&apos;s BD team is working with a range derived from three integrated methods, a sensitivity analysis across key variables, and pre-computed responses to every likely negotiation scenario. Adopting the three-method approach does not guarantee a better outcome, but it eliminates the most common source of value leakage in biopharma licensing: anchoring to an indefensible number.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p>
              For additional guidance on building integrated valuation models, see our <Link href="/guides/how-to-value-biotech-deal" className="text-teal-600 font-medium hover:text-teal-700">complete guide to biotech deal valuation</Link> and the <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">rNPV methodology deep dive</Link>. To see how these valuation approaches translate into real deal economics across therapeutic areas, explore our <Link href="/insights/deal-terms-by-therapeutic-area" className="text-teal-600 font-medium hover:text-teal-700">deal terms by therapeutic area</Link> analysis and <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">oncology benchmarks</Link>.
            </p>

            <h2 id="faq">Frequently Asked Questions</h2>
          </div>

          <div className="my-8 space-y-0">
            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>What is the most common biopharma deal valuation method?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Comparable transactions is the most widely used starting point because it requires the fewest assumptions and anchors negotiations to observable market data. However, institutional investors and large pharma BD teams use comps alongside rNPV and Monte Carlo to triangulate a valuation range. Relying on a single method leaves value on the table.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>What discount rate should I use for rNPV?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Standard biopharma rNPV discount rates range from 8-12%. Use 8-9% for large pharma with diversified pipelines, 10% as the industry median, and 11-12% for early-stage biotech with concentrated risk. The discount rate should reflect only time value of money and systematic risk, since clinical risk is already captured by PoS adjustments. Using 15%+ discount rates with full PoS adjustments double-counts risk and systematically undervalues assets by 20-40%.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>How does Monte Carlo differ from rNPV in practice?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                rNPV uses single-point estimates for each variable, producing one expected value. Monte Carlo replaces these with probability distributions and runs 10,000+ scenarios, producing a full distribution of outcomes. Two assets with identical rNPVs of $500M might have Monte Carlo ranges of $100M-$1.2B vs. $350M-$650M — very different risk profiles that should drive different deal structures, milestone designs, and royalty negotiations.
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>What probability of success rates should I use by phase?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                Industry averages: Preclinical to Phase 1 (~65%), Phase 1 to Phase 2 (~52%), Phase 2 to Phase 3 (~28-38% depending on TA), Phase 3 to NDA (~58%), NDA to Approval (~85%). Use TA-specific rates when available — oncology Phase 2-to-3 is lower (~28-35%) while immunology is higher (~38%). Cumulative preclinical-to-approval PoS ranges from ~4% (oncology solid tumor) to ~7.8% (immunology).
              </div>
            </details>

            <details className="group border-b border-slate-200 py-4">
              <summary className="flex items-center justify-between cursor-pointer text-lg font-semibold text-slate-900 hover:text-teal-700">
                <span>How should I weight the three methods in my final valuation?</span>
                <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-3 text-slate-600 leading-relaxed">
                A typical starting point is 40% comparable transactions, 35% rNPV, and 25% Monte Carlo. Adjust based on context: for preclinical assets with few comp deals, shift weight toward rNPV and Monte Carlo (60-70% combined). For approved products with rich comp sets, weight comps at 50-60%. The key is that no single method should carry more than 60% of the final valuation weight.
              </div>
            </details>
          </div>

          <InlineEmailCapture source="valuation-methods" />

          <RelatedInsights articles={relatedArticles} />

          <InsightEmailCapture slug="biopharma-deal-valuation-methods" />

          <InsightCTA
            variant="bottom"
            heading="Valuation Starts With Data"
            description={`Our calculator anchors your deal valuation with comparable transaction benchmarks from ${DEAL_STATS.TOTAL_DEALS} real biopharma deals — the comps layer that every valuation needs.`}
          />
        </article>
      </main>
    </>
  );
}
