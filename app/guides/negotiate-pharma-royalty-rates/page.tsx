import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'How to Negotiate Pharma Licensing Royalty Rates | Ambrosia Ventures',
  description: 'Learn how to negotiate pharma royalty rates with data-backed benchmarks. Covers tiered royalties, territory adjustments, comparable deal analysis, and common pitfalls in biopharma licensing.',
  keywords: [
    'pharma royalty rates',
    'negotiate royalty rate',
    'pharma licensing royalty',
    'tiered royalties biopharma',
    'royalty rate benchmarks',
    'biopharma licensing negotiation',
    'pharma deal royalties',
    'pharma royalty rates benchmark',
    'biotech licensing royalty rates',
    'pharma royalty rate by phase',
    'biopharma royalty benchmarks 2026',
  ],
  openGraph: {
    title: 'How to Negotiate Pharma Licensing Royalty Rates',
    description: `Data-backed strategies for negotiating royalty rates in biopharma licensing deals, with benchmarks from ${DEAL_STATS.TOTAL_DEALS} transactions.`,
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/guides/negotiate-pharma-royalty-rates',
    images: [{ url: '/api/og?title=Negotiate%20Pharma%20Royalty%20Rates&subtitle=A%20Data-Backed%20Guide&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Negotiate Pharma Licensing Royalty Rates',
    description: 'Data-backed strategies for negotiating royalty rates in biopharma licensing deals.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/guides/negotiate-pharma-royalty-rates',
  },
};

export default function NegotiatePharmaRoyaltyRatesPage() {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How to Negotiate Pharma Licensing Royalty Rates',
    description: `Data-backed strategies for negotiating royalty rates in biopharma licensing deals, with benchmarks from ${DEAL_STATS.TOTAL_DEALS} transactions.`,
    author: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
    },
    datePublished: '2026-03-20',
    dateModified: '2026-04-07',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/guides/negotiate-pharma-royalty-rates`,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the typical royalty rate range for a pharma licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Royalty rates in pharma licensing deals typically range from low-single digits (2-5%) for early-stage preclinical assets to mid-teens (12-18%) for approved or late-stage products with strong clinical data. The exact rate depends on clinical phase, therapeutic area, modality, competitive landscape, and territory scope. Oncology deals and first-in-class mechanisms generally command higher royalties.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do tiered royalties work in biopharma licensing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tiered royalties escalate the royalty percentage as cumulative net sales cross predefined thresholds. For example, a deal might specify 8% on the first $500M in annual net sales, 10% on $500M-$1B, and 12% above $1B. This structure aligns incentives: the licensor captures more value as the product proves commercially successful, while the licensee benefits from lower rates during the initial launch period.',
        },
      },
      {
        '@type': 'Question',
        name: 'Should royalty rates differ by territory in a global licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, territory-based royalty adjustments are common and strategically important. US-only deals typically command 60-70% of global royalty economics given the premium pricing environment. Ex-US territories may warrant lower royalties (often 2-4 percentage points below US rates) due to reference pricing, lower reimbursement ceilings, and higher market access complexity. Japan and certain EU5 markets often command intermediate rates.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, faqSchema]) }} />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,165,0.12),rgba(255,255,255,0))]" />
          </div>
          <div className="relative max-w-3xl mx-auto">
            <Breadcrumbs items={[
              { label: 'Home', href: '/' },
              { label: 'Guides', href: '/guides' },
              { label: 'Negotiate Pharma Royalty Rates' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              14 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              How to Negotiate Pharma Licensing Royalty Rates
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              A data-backed framework for structuring and negotiating royalty rates in biopharma licensing deals, informed by benchmarks from {DEAL_STATS.TOTAL_DEALS} transactions.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Royalty rates are often the most debated element of a pharma licensing deal. They directly determine how ongoing commercial value is shared between licensor and licensee over the product&apos;s lifetime. Unlike upfront payments or milestones, royalties compound over decades of sales, making even a single percentage point difference worth hundreds of millions of dollars for a blockbuster drug.
            </p>

            <p className="text-slate-600 leading-relaxed">
              This guide provides a structured approach to negotiating <Link href="/glossary/royalty-rate" className="text-teal-600 font-medium hover:text-teal-700">royalty rates</Link> that are both competitive and defensible, drawing on market data and negotiation principles used by top-tier BD teams.
            </p>

            <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg my-6 text-sm text-slate-600">
              <svg className="w-5 h-5 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>All benchmarks below are derived from analysis of <strong>{DEAL_STATS.TOTAL_DEALS} biopharma transactions</strong> in the Ambrosia Ventures database, updated April 2026.</span>
            </div>

            {/* Royalty Rates by Phase */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="royalty-rates-by-phase">
              Royalty Rates by Clinical Phase
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Clinical phase is the single strongest predictor of royalty rates. Each phase transition de-risks the asset and shifts value toward the licensor. The table below shows observed ranges and medians from our deal database.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Clinical Phase</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Royalty Range</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Median</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Commentary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 text-slate-700">Preclinical</td><td className="py-2.5 px-4 text-center text-slate-900">2-4%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">3%</td><td className="py-2.5 px-4 text-slate-500">High risk, unvalidated; royalties offset by large milestone packages</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Phase 1</td><td className="py-2.5 px-4 text-center text-slate-900">3-6%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">4.5%</td><td className="py-2.5 px-4 text-slate-500">Safety data available; efficacy still unproven</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Phase 2</td><td className="py-2.5 px-4 text-center text-slate-900">5-9%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">7%</td><td className="py-2.5 px-4 text-slate-500">Proof-of-concept data; competitive bidding common</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Phase 3</td><td className="py-2.5 px-4 text-center text-slate-900">8-14%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">11%</td><td className="py-2.5 px-4 text-slate-500">Pivotal data de-risks; licensee paying for near-term revenue</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Approved</td><td className="py-2.5 px-4 text-center text-slate-900">12-22%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">16%</td><td className="py-2.5 px-4 text-slate-500">Commercial product; royalty reflects proven revenue stream</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal database, {DEAL_STATS.TOTAL_DEALS} transactions as of April 2026. Ranges represent 25th-75th percentile; outliers in oncology and rare disease can exceed upper bounds.
            </p>

            {/* Royalty Rates by Modality */}
            <h3 className="text-xl font-bold text-slate-900 mt-10 mb-4" id="royalty-rates-by-modality">
              Royalty Rates by Modality
            </h3>

            <p className="text-slate-600 leading-relaxed mb-4">
              Modality increasingly influences royalty rates as novel platforms command premiums over traditional small molecules. The following ranges represent typical Phase 2+ deals:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600 mb-6">
              <li><strong>ADCs (antibody-drug conjugates):</strong> Mid-teens to low-20s. ADCs command premium royalties due to complex manufacturing, strong IP moats, and demonstrated clinical differentiation in oncology.</li>
              <li><strong>Small molecules:</strong> Low-to-mid teens. The most benchmarked modality with deep comparable data. Generic erosion risk at patent expiry limits upper-tier rates.</li>
              <li><strong>Monoclonal antibodies (mAbs):</strong> Mid-single digits to low-double digits. Biosimilar exposure is growing, but brand loyalty and switching costs support rates above small molecules at equivalent phases.</li>
              <li><strong>Gene therapy:</strong> High-single digits to mid-teens. One-time curative therapies present unique royalty economics; some deals use profit-sharing models instead of traditional royalties.</li>
              <li><strong>Cell therapy (CAR-T, TCR):</strong> Mid-single to low-double digits. Manufacturing complexity and autologous vs. allogeneic differences create wide royalty variation within the modality.</li>
              <li><strong>RNA therapeutics (siRNA, mRNA, ASO):</strong> Low-to-mid teens. Platform value and multi-indication potential support above-average rates for validated targets.</li>
            </ul>

            {/* Inline CTA */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">See royalty benchmarks for your specific deal</p>
              <p className="text-slate-600 mb-4">
                Our calculator generates royalty benchmarks tailored to your phase, modality, and therapeutic area -- calibrated against {DEAL_STATS.TOTAL_DEALS} real transactions across 12 TAs and 23+ modalities.
              </p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors text-sm">
                Get Your Royalty Benchmark
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>

            {/* Section 1 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="tiered-royalties">
              Understanding Tiered Royalties
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Most modern biopharma licensing deals use <Link href="/glossary/tiered-royalties" className="text-teal-600 font-medium hover:text-teal-700">tiered royalty structures</Link> rather than flat rates. Tiers align economic incentives: the licensor captures increasing value as the product proves its commercial potential, while the licensee benefits from lower initial rates during launch.
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Entry tier (base rate):</strong> Applies to the first tranche of annual net sales, typically up to $500M-$1B. This rate reflects the minimum acceptable return for the licensor and usually falls in the mid-single digits for early-stage assets.</li>
              <li><strong>Mid tier:</strong> Kicks in once sales demonstrate meaningful commercial traction. Usually 2-4 percentage points above the base rate, this tier captures value from a product that has moved beyond launch risk.</li>
              <li><strong>Upper tier:</strong> Applies to sales above a high threshold (e.g., $1B+). Upper-tier rates in the mid-teens reflect the blockbuster premium and compensate the licensor for having originated the asset that generated exceptional returns.</li>
              <li><strong>Step-down provisions:</strong> Royalties typically step down 30-50% upon loss of exclusivity (patent expiry, generic entry) and may also reduce if a competing biosimilar captures significant market share.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              The number of tiers, threshold amounts, and step-down triggers are all negotiable. Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">deal calculator</Link> to model how different tier structures affect total licensor economics under various peak sales scenarios.
            </p>

            {/* Section 2 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="benchmarking">
              Benchmarking Comparable Deals
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Effective royalty negotiation starts with knowing what the market pays. Without rigorous benchmarking, both sides risk anchoring on outdated precedents or anecdotal data points. The key variables that drive royalty rate differentiation are:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Clinical phase:</strong> Phase 3 and approved-product deals command royalties 4-8 percentage points higher than preclinical or Phase 1 deals. The risk reduction premium is the dominant factor in royalty benchmarking.</li>
              <li><strong>Therapeutic area:</strong> Oncology royalties average 2-3 percentage points higher than other TAs at comparable phases, driven by premium pricing and faster market uptake. Rare disease deals also command above-average royalties due to orphan drug pricing power.</li>
              <li><strong>Modality:</strong> Novel modalities (ADCs, bispecifics, cell therapies) command higher royalties than small molecules, reflecting differentiated clinical profiles and higher barriers to generic/biosimilar competition.</li>
              <li><strong>Competitive landscape:</strong> First-in-class assets in underserved indications command premium royalties. Best-in-class entries in crowded markets face downward pressure on rates.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Our <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmark database</Link> provides royalty rate ranges segmented by all four dimensions above, drawn from {DEAL_STATS.TOTAL_DEALS} publicly disclosed biopharma transactions.
            </p>

            {/* Section 3 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="negotiation-levers">
              Key Negotiation Levers
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Royalty rates do not exist in isolation. They are one component of a broader deal structure that includes upfront payments, milestones, and co-development rights. Skilled negotiators use the interdependencies between these elements as leverage:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Upfront-royalty tradeoff:</strong> A larger upfront payment justifies a lower royalty rate, and vice versa. Licensors with strong cash positions may prefer higher royalties (ongoing revenue stream), while cash-constrained biotechs may prioritize larger upfronts. Model both scenarios in our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link> to find the optimal balance.</li>
              <li><strong>Milestone padding:</strong> Development and commercial milestones can be structured to compensate for concessions on royalty rates. A licensee offering aggressive milestone packages may negotiate 1-2 percentage points lower on royalties.</li>
              <li><strong>Anti-stacking provisions:</strong> If the licensee must pay royalties to third-party patent holders, anti-stacking clauses allow partial offset against the licensor&apos;s royalty. These provisions are increasingly common and can effectively reduce the net royalty by 25-50%.</li>
              <li><strong>Co-promotion rights:</strong> Retaining co-promotion rights in key territories allows the licensor to participate in commercial upside beyond royalties, sometimes justifying a lower base royalty rate.</li>
              <li><strong>Minimum royalty guarantees:</strong> Licensors can secure downside protection through annual minimum royalty commitments, ensuring a revenue floor regardless of commercial performance.</li>
            </ul>

            {/* Section 4 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="territory-adjustments">
              Territory-Based Royalty Adjustments
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Global licensing deals rarely apply a uniform royalty rate across all territories. Market-specific factors warrant differentiated rates:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>United States:</strong> Commands the highest royalty rates due to premium drug pricing, large patient populations, and fastest market uptake. US-only deals typically capture 60-70% of global royalty economics.</li>
              <li><strong>EU5 (UK, Germany, France, Italy, Spain):</strong> Royalties are generally 2-3 percentage points below US rates. Reference pricing, health technology assessments (HTAs), and longer market access timelines reduce net revenue per patient.</li>
              <li><strong>Japan:</strong> Often commands intermediate royalty rates between US and EU levels. Japan&apos;s biennial drug price revisions create unique economic dynamics that should be modeled separately.</li>
              <li><strong>China and emerging markets:</strong> Significantly lower royalty rates (often 40-60% of US rates) reflect pricing constraints, IP enforcement challenges, and smaller addressable patient populations at premium pricing.</li>
              <li><strong>Rest of world (RoW):</strong> Bundled at reduced rates, typically 50-70% of the US royalty. Territory carve-outs for specific high-value markets (e.g., South Korea, Australia) can optimize overall deal economics.</li>
            </ul>

            {/* Section 5 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="common-pitfalls">
              Common Pitfalls
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Even experienced BD teams make mistakes in royalty negotiations. Avoid these common pitfalls:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Anchoring on headline rates:</strong> A 12% royalty sounds high, but net effective royalties after step-downs, anti-stacking offsets, and tiering may be 6-8%. Always negotiate and model the blended effective rate across the product lifecycle.</li>
              <li><strong>Ignoring the royalty term:</strong> A 10% royalty for 10 years is worth far less than 8% for 15 years with strong IP protection. Patent life, data exclusivity, and orphan drug exclusivity all affect the total royalty income.</li>
              <li><strong>Neglecting net sales definitions:</strong> How &quot;net sales&quot; is defined (gross-to-net deductions, free goods, chargebacks, rebates) materially affects the royalty base. A favorable net sales definition can be worth more than an extra percentage point on the rate.</li>
              <li><strong>Overlooking combination product provisions:</strong> If the licensed compound is used in fixed-dose combinations, how is the royalty calculated? Proportional allocation based on standalone value is the most common approach, but the formula matters enormously for combination-heavy therapeutic areas.</li>
              <li><strong>Failing to model downside scenarios:</strong> Royalties should be stress-tested against scenarios where peak sales fall 50-70% below the base case. If the deal economics collapse under moderate downside, the structure needs rebalancing.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Use the <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmarks</Link> section to see how recent deals in your therapeutic area and modality have structured these provisions, and run sensitivity analyses in our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link> to quantify the impact of each variable.
            </p>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Model Your Royalty Scenarios
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Input your deal parameters and see how royalty rates compare against market benchmarks from {DEAL_STATS.TOTAL_DEALS} biopharma transactions.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
            >
              Open the Calculator
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What is the typical royalty rate range for a pharma licensing deal?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Royalty rates in pharma licensing deals typically range from low-single digits (2-5%) for early-stage preclinical assets to mid-teens (12-18%) for approved or late-stage products. The exact rate depends on clinical phase, therapeutic area, modality, competitive landscape, and territory scope. Use our <Link href="/benchmarks" className="text-teal-600 hover:text-teal-700">benchmarks</Link> to see current market ranges.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How do tiered royalties work in biopharma licensing?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  <Link href="/glossary/tiered-royalties" className="text-teal-600 hover:text-teal-700">Tiered royalties</Link> escalate the royalty percentage as cumulative net sales cross predefined thresholds. For example, 8% on the first $500M, 10% on $500M-$1B, and 12% above $1B. This aligns incentives by rewarding the licensor as the product proves commercially successful while giving the licensee lower rates during launch.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    Should royalty rates differ by territory in a global licensing deal?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Yes, territory-based adjustments are common and strategically important. US-only deals typically capture 60-70% of global royalty economics given premium pricing. Ex-US territories may warrant lower royalties (2-4 percentage points below US rates) due to reference pricing and lower reimbursement ceilings. Model territory-specific scenarios in our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link>.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Related Resources */}
        <section className="py-16 px-4 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Related Resources
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/benchmarks', title: 'Deal Benchmarks', desc: 'Royalty rate ranges by modality, phase & TA' },
                { href: '/calculator', title: 'Deal Calculator', desc: 'Model royalty scenarios with real data' },
                { href: '/glossary/royalty-rate', title: 'Royalty Rate', desc: 'Definition and industry context' },
                { href: '/glossary/tiered-royalties', title: 'Tiered Royalties', desc: 'How escalating royalties work' },
              ].map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-teal-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors mb-2">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-slate-500">{resource.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
