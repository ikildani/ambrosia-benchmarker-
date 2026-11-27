import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Pharma Royalty Rates by Phase & Modality: 2026 Benchmarks and Negotiation Guide',
  description: 'Median top royalty tier by stage: preclinical 9%, Phase 1 12%, Phase 2 15%, Phase 3 and approved 19%. Royalty benchmarks by phase and modality from 2,102 primary-sourced deals, plus negotiation strategies that work.',
  keywords: [
    'pharma royalty rates',
    'biopharma royalty rates',
    'biotech royalty benchmarks',
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
    'pharma royalty rates 2026',
    'biotech royalty rate by modality',
  ],
  openGraph: {
    title: 'Pharma Royalty Rates by Phase & Modality: 2026 Benchmarks and Negotiation Guide',
    description: 'Median top royalty tier by stage: preclinical 9%, Phase 2 15%, Phase 3 and approved 19%. Biopharma royalty benchmarks from 2,102 primary-sourced deals.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/negotiate-pharma-royalty-rates',
    images: [{ url: '/api/og?title=Negotiate%20Pharma%20Royalty%20Rates&subtitle=A%20Data-Backed%20Guide&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pharma Royalty Rates by Phase & Modality: 2026 Benchmarks and Negotiation Guide',
    description: 'Median top royalty tier by stage: preclinical 9%, Phase 2 15%, Phase 3 and approved 19%. Biopharma royalty benchmarks from 2,102 primary-sourced deals.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/negotiate-pharma-royalty-rates',
  },
};

export default function NegotiatePharmaRoyaltyRatesPage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How to Negotiate Pharma Licensing Royalty Rates',
    description: 'Data-backed strategies for negotiating royalty rates in biopharma licensing deals, with benchmarks from 2,102 primary-sourced deals announced January 2017 to November 2026.',
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
    dateModified: '2026-11-27',
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
          text: 'Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The median top tier rises with stage at signing: 9% preclinical, 12% Phase 1, 15% Phase 2, and 19% at Phase 3 and for approved products. The exact rate also depends on therapeutic area, modality, competitive landscape, and territory scope. Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do tiered royalties work in biopharma licensing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tiered royalties escalate the royalty percentage as annual net sales cross predefined thresholds. As a hypothetical example, a deal might specify 8% on the first $500M in annual net sales, 10% on $500M to $1B, and 12% above $1B. This structure aligns incentives: the licensor captures more value as the product proves commercially successful, while the licensee benefits from lower rates during the initial launch period.',
        },
      },
      {
        '@type': 'Question',
        name: 'Should royalty rates differ by territory in a global licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, territory-based royalty adjustments are common and strategically important. The US is usually the most valuable territory given its premium pricing environment, so US rights anchor most negotiations. Ex-US territories may warrant lower royalties due to reference pricing, lower reimbursement ceilings, and higher market access complexity. Japan and certain EU5 markets often command intermediate rates.',
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
              A data-backed framework for structuring and negotiating royalty rates in biopharma licensing deals, informed by benchmarks from 2,102 primary-sourced deals announced January 2017 to November 2026.
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
              <span>All benchmarks below come from the Ambrosia Ventures deal benchmarks: <strong>2,102 primary-sourced deals</strong> announced January 2017 to November 2026, each tied to a regulatory filing or company announcement. Each figure uses only the deals that disclose it.</span>
            </div>

            {/* Royalty Rates by Phase */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="royalty-rates-by-phase">
              Royalty Rates by Clinical Phase
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Clinical phase is a strong predictor of royalty rates. Each phase transition de-risks the asset and shifts value toward the licensor. Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The table below shows the median top tier by stage at signing.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Clinical Phase</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Middle Half</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Median Top Tier</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Commentary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 text-slate-700">Preclinical (n=137)</td><td className="py-2.5 px-4 text-center text-slate-900">5% to 12%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">9%</td><td className="py-2.5 px-4 text-slate-500">High risk, unvalidated; royalties offset by large milestone packages</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Phase 1 (n=56)</td><td className="py-2.5 px-4 text-center text-slate-900">9.8% to 18.2%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">12%</td><td className="py-2.5 px-4 text-slate-500">Safety data available; efficacy still unproven</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Phase 2 (n=56)</td><td className="py-2.5 px-4 text-center text-slate-900">11.5% to 19%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">15%</td><td className="py-2.5 px-4 text-slate-500">Proof-of-concept data; competitive bidding common</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Phase 3 (n=75)</td><td className="py-2.5 px-4 text-center text-slate-900">12% to 25%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">19%</td><td className="py-2.5 px-4 text-slate-500">Pivotal data de-risks; licensee paying for near-term revenue</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Approved (n=78)</td><td className="py-2.5 px-4 text-center text-slate-900">12% to 22%</td><td className="py-2.5 px-4 text-center font-medium text-teal-700">19%</td><td className="py-2.5 px-4 text-slate-500">Commercial product; royalty reflects proven revenue stream</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026. Licenses that disclose a top royalty tier; middle half is the 25th to 75th percentile. Full table:{' '}<a href="https://ambrosiaventures.co/benchmarks/royalty-rates" className="underline hover:text-slate-600">royalty rates</a>.
            </p>

            {/* Royalty Rates by Modality */}
            <h3 className="text-xl font-bold text-slate-900 mt-10 mb-4" id="royalty-rates-by-modality">
              Royalty Rates by Modality
            </h3>

            <p className="text-slate-600 leading-relaxed mb-4">
              Modality also shapes royalty rates. The figures below are median top tiers across all stages, so they are not adjusted for stage mix; compare within stage where you can.
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600 mb-6">
              <li><strong>Monoclonal antibodies:</strong> 15% median top tier (70 deals), the highest of any modality. Brand loyalty and switching costs support rates above small molecules despite growing biosimilar exposure.</li>
              <li><strong>Bispecifics:</strong> 14% (26 deals). Differentiated clinical profiles and strong pharma interest support rates close to conventional antibodies.</li>
              <li><strong>ADCs (antibody-drug conjugates):</strong> 13.5% (22 deals). Complex manufacturing and strong IP positions support rates above small molecules.</li>
              <li><strong>siRNA and antisense:</strong> 13% (30 deals). Platform value and multi-indication potential support above-average rates for validated targets.</li>
              <li><strong>Small molecules:</strong> 12% (204 deals). The most benchmarked modality with deep comparable data. Generic erosion risk at patent expiry limits upper-tier rates.</li>
              <li><strong>Peptides:</strong> 10.5% (20 deals).</li>
              <li><strong>Gene therapy:</strong> 9% (35 deals). One-time curative therapies present unique royalty economics; some deals use profit-sharing models instead of traditional royalties.</li>
              <li><strong>Cell therapy (CAR-T, TCR):</strong> 9% (29 deals). Manufacturing complexity and autologous vs. allogeneic differences create wide royalty variation within the modality.</li>
            </ul>

            {/* Inline CTA */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">See royalty benchmarks for your specific deal</p>
              <p className="text-slate-600 mb-4">
                Our calculator generates royalty benchmarks tailored to your phase, modality, and therapeutic area, calibrated against {DEAL_STATS.TOTAL_DEALS} real transactions.
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
              Many biopharma licensing deals use <Link href="/glossary/tiered-royalties" className="text-teal-600 font-medium hover:text-teal-700">tiered royalty structures</Link> rather than flat rates. Tiers align economic incentives: the licensor captures increasing value as the product proves its commercial potential, while the licensee benefits from lower initial rates during launch. Across disclosed deals, the median bottom tier is 5% and the median top tier is 12%.
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Entry tier (base rate):</strong> Applies to the first tranche of annual net sales. This rate reflects the minimum acceptable return for the licensor; the median bottom tier across 502 disclosed deals is 5%.</li>
              <li><strong>Mid tier:</strong> Kicks in once sales demonstrate meaningful commercial traction. This tier captures value from a product that has moved beyond launch risk.</li>
              <li><strong>Upper tier:</strong> Applies to sales above a high threshold. The median top tier across 534 disclosed deals is 12%, with a middle half of 9% to 19%, and it rises to 19% for Phase 3 and approved assets. Upper-tier rates compensate the licensor for having originated an asset that generated exceptional returns.</li>
              <li><strong>Step-down provisions:</strong> Royalties typically step down upon loss of exclusivity (patent expiry, generic entry) and may also reduce if a competing biosimilar captures significant market share.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              The number of tiers, threshold amounts, and step-down triggers are all negotiable. Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> to model how different tier structures affect total licensor economics under various peak sales scenarios.
            </p>

            {/* Section 2 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="benchmarking">
              Benchmarking Comparable Deals
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Effective royalty negotiation starts with knowing what the market pays. Without rigorous benchmarking, both sides risk anchoring on outdated precedents or anecdotal data points. The key variables that drive royalty rate differentiation are:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Clinical phase:</strong> The median top tier is 19% for Phase 3 and approved deals, against 9% preclinical and 12% at Phase 1. Risk reduction is the dominant factor in royalty benchmarking.</li>
              <li><strong>Therapeutic area:</strong> Premium pricing and faster market uptake can support higher royalties in oncology, and orphan drug pricing power can do the same in rare disease. Benchmark against deals in your own area rather than cross-area averages.</li>
              <li><strong>Modality:</strong> Antibodies (15%), bispecifics (14%) and ADCs (13.5%) carry higher median top tiers than small molecules (12%), while cell and gene therapies sit lower at 9%.</li>
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
              <li><strong>Milestone padding:</strong> Development and commercial milestones can be structured to compensate for concessions on royalty rates. A licensee offering an aggressive milestone package may negotiate a lower royalty in return.</li>
              <li><strong>Anti-stacking provisions:</strong> If the licensee must pay royalties to third-party patent holders, anti-stacking clauses allow partial offset against the licensor&apos;s royalty. These provisions are common and can materially reduce the net royalty.</li>
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
              <li><strong>United States:</strong> Usually the most valuable territory due to premium drug pricing, large patient populations, and fast market uptake, which makes US rights the anchor of most royalty negotiations.</li>
              <li><strong>EU5 (UK, Germany, France, Italy, Spain):</strong> Royalties are often set below US rates. Reference pricing, health technology assessments (HTAs), and longer market access timelines reduce net revenue per patient.</li>
              <li><strong>Japan:</strong> Often commands intermediate royalty rates between US and EU levels. Japan&apos;s biennial drug price revisions create unique economic dynamics that should be modeled separately.</li>
              <li><strong>China and emerging markets:</strong> Regional rights are often priced at lower rates, reflecting pricing constraints, IP enforcement considerations, and smaller addressable populations at premium pricing. Note the reverse case: across licenses where a China-based company is the licensor, the median top royalty tier is 18.5% (20 deals), above the overall median of 12%.</li>
              <li><strong>Rest of world (RoW):</strong> Often bundled at reduced rates. Territory carve-outs for specific high-value markets (e.g., South Korea, Australia) can optimize overall deal economics.</li>
            </ul>

            {/* Section 5 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="common-pitfalls">
              Common Pitfalls
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Even experienced BD teams make mistakes in royalty negotiations. Avoid these common pitfalls:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Anchoring on headline rates:</strong> A headline royalty can look high, but the net effective royalty after step-downs, anti-stacking offsets, and tiering is often well below it. Always negotiate and model the blended effective rate across the product lifecycle.</li>
              <li><strong>Ignoring the royalty term:</strong> As a hypothetical example, a 10% royalty for 10 years can be worth less than 8% for 15 years with strong IP protection. Patent life, data exclusivity, and orphan drug exclusivity all affect the total royalty income.</li>
              <li><strong>Neglecting net sales definitions:</strong> How &quot;net sales&quot; is defined (gross-to-net deductions, sample units, chargebacks, rebates) materially affects the royalty base. A favorable net sales definition can be worth more than an extra percentage point on the rate.</li>
              <li><strong>Overlooking combination product provisions:</strong> If the licensed compound is used in fixed-dose combinations, how is the royalty calculated? Proportional allocation based on standalone value is a common approach, but the formula matters enormously for combination-heavy therapeutic areas.</li>
              <li><strong>Failing to model downside scenarios:</strong> Stress-test royalties against scenarios where peak sales fall well below the base case, for example at half of forecast. If the deal economics collapse under moderate downside, the structure needs rebalancing.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Use the <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmarks</Link> section to see how recent deals in your therapeutic area and modality have structured these provisions, and run sensitivity analyses in our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link> to quantify the impact of each variable. Full royalty tables are also published at{' '}<a href="https://ambrosiaventures.co/benchmarks/royalty-rates" className="text-teal-600 font-medium hover:text-teal-700">ambrosiaventures.co/benchmarks/royalty-rates</a>.
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
                  Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The median top tier rises with stage at signing: 9% preclinical, 12% Phase 1, 15% Phase 2, and 19% at Phase 3 and for approved products. The exact rate also depends on therapeutic area, modality, competitive landscape, and territory scope. Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026. Full tables at <a href="https://ambrosiaventures.co/benchmarks/royalty-rates" className="text-teal-600 hover:text-teal-700">ambrosiaventures.co/benchmarks/royalty-rates</a>. Use our <Link href="/benchmarks" className="text-teal-600 hover:text-teal-700">benchmarks</Link> to see current market ranges.
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
                  <Link href="/glossary/tiered-royalties" className="text-teal-600 hover:text-teal-700">Tiered royalties</Link> escalate the royalty percentage as annual net sales cross predefined thresholds. As a hypothetical example, a deal might specify 8% on the first $500M in annual net sales, 10% on $500M to $1B, and 12% above $1B. This structure aligns incentives: the licensor captures more value as the product proves commercially successful, while the licensee benefits from lower rates during the initial launch period.
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
                  Yes, territory-based royalty adjustments are common and strategically important. The US is usually the most valuable territory given its premium pricing environment, so US rights anchor most negotiations. Ex-US territories may warrant lower royalties due to reference pricing, lower reimbursement ceilings, and higher market access complexity. Japan and certain EU5 markets often command intermediate rates. Model territory-specific scenarios in our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link>.
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
                { href: '/calculator', title: 'Solidus', desc: 'Model royalty scenarios with real data' },
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
    </>
  );
}
