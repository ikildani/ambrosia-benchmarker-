import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Biotech Licensing Deal Structure in 2026: Upfronts, Milestones & Royalties by Stage',
  description: 'What biotech licensing deals actually pay at each stage: median upfronts, share paid at signing, milestones and royalty tiers from 2,102 primary-sourced deals announced since 2017.',
  keywords: [
    'biotech licensing deal structure',
    'biotech licensing deal structure 2026',
    'pharma deal structure',
    'upfront payment licensing',
    'milestone payment pharma',
    'licensing deal components',
    'biopharma deal terms',
    'drug licensing agreement structure',
    'biotech out-licensing deal terms',
    'pharma licensing deal structure',
    'biopharma deal terms benchmark',
    'option license deal biotech',
    'pharma deal terms 2026',
  ],
  openGraph: {
    title: 'Biotech Licensing Deal Structure in 2026: Upfronts, Milestones & Royalties by Stage',
    description: 'Median upfronts, share paid at signing, milestones and royalty tiers by stage, from 2,102 primary-sourced biopharma deals since 2017.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/biotech-licensing-deal-structure',
    images: [{ url: '/api/og?title=Biotech%20Licensing%20Deal%20Structure&subtitle=Upfront%2C%20Milestones%20%26%20Royalties&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Licensing Deal Structure in 2026: Upfronts, Milestones & Royalties by Stage',
    description: 'Median upfronts, share paid at signing, milestones and royalty tiers by stage, from 2,102 primary-sourced biopharma deals since 2017.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/biotech-licensing-deal-structure',
  },
};

export default function BiotechLicensingDealStructurePage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Biotech Licensing Deal Structure: Upfront, Milestones & Royalties Explained',
    description: 'Complete guide to structuring biopharma licensing deals with real benchmarks on upfronts, milestones, and royalties.',
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
      '@id': `${baseUrl}/guides/biotech-licensing-deal-structure`,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are the main components of a biotech licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A biotech licensing deal typically consists of three main economic components: (1) an upfront payment made at signing, (2) milestone payments triggered by development, regulatory, and commercial achievements, and (3) royalties on net sales of the licensed product. The relative allocation across these components varies by clinical phase, with earlier-stage deals weighting more heavily toward milestones and later-stage deals commanding larger upfronts.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much should the upfront payment be in a licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Upfronts are a small share of announced value at every stage. In our data the median share paid at signing is about 5% for preclinical licenses, 7% at Phase 1, 9.5% at Phase 2, 13% at Phase 3 and 18% for approved products. In dollars, the median upfront is US$10M preclinical, US$30M at Phase 1, US$25M at Phase 2, US$30M at Phase 3 and US$17M for approved products, with wide ranges around each. Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the difference between development and commercial milestones?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Development milestones are triggered by clinical and regulatory events (trial starts, data readouts, filings, approvals). Commercial milestones are tied to annual or cumulative net sales thresholds and are only paid if the product sells. Across 269 deals that disclose the split, 73.1% of milestone value is commercial, 17.6% development and 9.4% regulatory. Total milestones are a large multiple of the upfront: at the median, about 20 times at preclinical, 13 times at Phase 1, 9.5 times at Phase 2 and 7 times at Phase 3.',
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
              { label: 'Biotech Licensing Deal Structure' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              15 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Biotech Licensing Deal Structure: Upfront, Milestones &amp; Royalties Explained
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              A comprehensive breakdown of the three pillars of biopharma licensing economics, with benchmark data and structuring strategies for each component.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Every biopharma licensing deal is built on the same foundational structure: an upfront payment to secure the rights, milestone payments that reward development progress and commercial success, and royalties that share ongoing revenue over the product&apos;s commercial life. Understanding how these components interact is essential for BD professionals on both sides of the table.
            </p>

            <p className="text-slate-600 leading-relaxed">
              While headline &quot;total deal value&quot; numbers grab press attention, the actual economics depend entirely on how value is allocated across these components and the probability of each payment being triggered.
            </p>

            {/* Section 1 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="anatomy">
              Anatomy of a Licensing Deal
            </h2>

            <p className="text-slate-600 leading-relaxed">
              A typical biopharma licensing agreement grants the licensee rights to develop and commercialize a drug candidate in specified territories and indications. In exchange, the licensor receives a combination of economic consideration:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Upfront payment:</strong> A non-refundable cash payment at deal signing that compensates the licensor for the value already created (discovery, preclinical work, clinical data). This is the only guaranteed economic component.</li>
              <li><strong>Development milestones:</strong> Payments triggered by clinical and regulatory achievements (IND filing, Phase 2 initiation, Phase 3 data readout, FDA submission, approval). These are contingent on successful execution.</li>
              <li><strong>Commercial milestones:</strong> Payments triggered when cumulative net sales cross predefined thresholds ($250M, $500M, $1B, $2B, etc.). Only paid if the product achieves significant commercial success.</li>
              <li><strong>Royalties:</strong> Ongoing percentage payments on net sales throughout the product&apos;s commercial life. The primary mechanism for long-term value sharing.</li>
              <li><strong>Equity (optional):</strong> Some deals include equity investments in the licensor, particularly when the licensor is a public biotech. Equity provides additional alignment but introduces market risk.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              The relative weighting across these components varies significantly by clinical phase, and our <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmark database</Link> provides detailed allocation ranges for each phase and therapeutic area.
            </p>

            {/* Section 2 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="upfront-payments">
              Upfront Payments
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The <Link href="/glossary/upfront-payment" className="text-teal-600 font-medium hover:text-teal-700">upfront payment</Link> is the cornerstone of any licensing deal. It represents the licensee&apos;s conviction in the asset and sets the tone for the entire negotiation. Key considerations:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Sizing by stage:</strong> In our data the median upfront is US$10M for preclinical licenses (middle half US$1.3M to US$40M), US$30M at Phase 1 (US$10M to US$100M), US$25M at Phase 2 (US$10M to US$81M), US$30M at Phase 3 (US$12M to US$73M) and US$17M for approved products (US$5M to US$45M). The spread within each stage is wider than the difference between stages.</li>
              <li><strong>Share of announced value:</strong> The share paid at signing rises with maturity: a median of 4.8% at preclinical, 7.4% at Phase 1, 9.5% at Phase 2, 13.1% at Phase 3 and 17.7% for approved products. Headline values for early assets are mostly milestones.</li>
              <li><strong>Cash vs. equity split:</strong> Some licensees offer a portion of the upfront as equity rather than cash, particularly mid-cap companies with strong stock performance. Licensors should evaluate the effective discount and liquidity constraints of equity components.</li>
              <li><strong>Signal value:</strong> Beyond its economic function, the upfront payment signals the licensee&apos;s commitment. A substantive upfront reduces the risk that the licensee will deprioritize the program in favor of internal assets.</li>
            </ul>

            {/* Section 3 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="milestones">
              Development &amp; Commercial Milestones
            </h2>

            <p className="text-slate-600 leading-relaxed">
              <Link href="/glossary/milestone-payment" className="text-teal-600 font-medium hover:text-teal-700">Milestone payments</Link> are the largest component of announced deal value. At the median, only 7.5% of announced value is paid at signing, so most of a headline number is milestones. Structuring milestones effectively requires balancing achievability, value signaling, and economic impact:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Where the money sits:</strong> Across 269 deals that disclose the split, 73.1% of milestone value is commercial, 17.6% is development and 9.4% is regulatory. Most of a headline number is paid only if the product sells.</li>
              <li><strong>Development and regulatory milestones:</strong> These track clinical progress (trial starts, data readouts, filings and approvals), often with separate payments for additional territories and indications.</li>
              <li><strong>Commercial milestones:</strong> These are tied to annual or cumulative net sales thresholds. Higher tiers carry little probability-weighted value, which is why licensees accept large numbers there.</li>
              <li><strong>Milestones versus upfront:</strong> At the median, total milestones are about 20 times the upfront for preclinical licenses, 13 times at Phase 1, 9.5 times at Phase 2, 7 times at Phase 3 and 5 times for approved products.</li>
              <li><strong>Probability weighting:</strong> Not all milestones are equally likely to be achieved. When evaluating a deal, apply probability-of-success rates to each milestone. A $100M Phase 3 milestone for a Phase 1 asset has a probability-weighted value of approximately $15M-$25M.</li>
            </ul>

            {/* Section 4 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="royalty-structures">
              Royalty Structures
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Royalties determine how ongoing commercial value is shared over the product&apos;s lifetime. While representing a smaller fraction of headline deal value, royalties often dominate the net present value of a deal for successful products:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Top tier by stage:</strong> The median top royalty tier is 9% for preclinical licenses, 12% at Phase 1, 15% at Phase 2 and 19% at Phase 3 and for approved products. Across all licenses that disclose tiers, the median runs from 5% at the bottom tier to 12% at the top.</li>
              <li><strong>Tiered escalation:</strong> Most deals use tiers that rise with annual net sales, so the effective rate depends on how large the product becomes.</li>
              <li><strong>Royalty term:</strong> Royalties usually run country by country until patent expiry, loss of regulatory exclusivity or a fixed period after first sale, with step-downs when generics or biosimilars enter.</li>
              <li><strong>Net sales definition:</strong> The definition of &quot;net sales&quot; (gross sales less returns, rebates, chargebacks and allowances) sets the royalty base. In the US, gross-to-net deductions can be large, so negotiate the permitted deductions carefully.</li>
            </ul>

            {/* Section 5 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="structuring-for-value">
              Structuring for Maximum Value
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The optimal deal structure depends on your strategic position and risk tolerance. Here are frameworks for maximizing value on each side:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Licensor strategy (maximize NPV):</strong> Prioritize higher upfronts and royalties over milestone padding. Upfronts are risk-free, and royalties compound over the product lifecycle. Resist the temptation to inflate headline deal value with low-probability milestones that will never be paid.</li>
              <li><strong>Licensee strategy (manage risk):</strong> Weight economics toward milestones and royalties to reduce upfront capital deployment. Back-loaded structures align payments with value creation and protect against clinical failure. However, competitive situations often require substantial upfronts to win the deal.</li>
              <li><strong>Hybrid structures:</strong> Opt-in/opt-out rights, co-development arrangements, and profit-sharing models blend elements of licensing and M&amp;A. These structures are increasingly common for high-value assets where both parties want ongoing strategic alignment.</li>
              <li><strong>Multi-indication optionality:</strong> For platform assets, structure base deal terms for the lead indication and negotiate option fees and incremental royalties for follow-on indications. This captures additional value without overcomplicating the initial deal.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> to model different allocation scenarios and see how the structure affects probability-weighted deal value for both parties.
            </p>

            {/* Deal Terms by Stage */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="deal-terms-by-stage">
              Licensing Deal Terms by Stage: 2026 Benchmarks
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Medians from licenses, options and collaborations announced since 2017, each tied to a regulatory filing or the company&apos;s own announcement. The middle half shows where the central 50% of deals fall.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Stage at signing</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Median upfront</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Middle half</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Paid at signing</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Milestones / upfront</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Top royalty tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Preclinical</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$10M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$1.3M to US$40M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">4.8%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">20x</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">9%</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">Phase 1</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$30M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$10M to US$100M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">7.4%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">13x</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">12%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Phase 2</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$25M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$10M to US$81M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">9.5%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">9.5x</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">15%</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">Phase 3</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$30M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$12M to US$73M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">13.1%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">6.7x</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">19%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Approved</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$17M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">US$5M to US$45M</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">17.7%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">4.7x</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">19%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026; each figure uses the deals that disclose it (for example 136 Phase 2 upfronts and 56 Phase 2 royalty tiers). Full tables:{' '}
              <a href="https://ambrosiaventures.co/benchmarks" className="text-teal-600 hover:text-teal-700">ambrosiaventures.co/benchmarks</a>.
            </p>

            {/* 2026 Deal Terms Trends */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="2026-trends">
              2026 Deal Terms Trends
            </h2>

            <ul className="list-disc pl-6 space-y-2 text-slate-600 my-4">
              <li><strong>Upfronts rose in 2026:</strong> The median license upfront was US$45M in Q3 2026, against US$12M in Q3 2025, across the deals that disclosed one. Details in the{' '}<a href="https://ambrosiaventures.co/reports/2026-q3" className="text-teal-600 font-medium hover:text-teal-700">Q3 2026 deal report</a>.</li>
              <li><strong>China&apos;s share keeps growing:</strong> China-based licensors accounted for 6% of licenses in 2017 and 18.3% in 2025. China out-licensing deals carry a median upfront of US$75M, well above the overall median of US$20M.</li>
              <li><strong>Options defer the commitment:</strong> Across 167 option deals, the median option upfront is US$16M and the median share paid at signing is 4.8%, lower than for licenses overall. Where an exercise fee is disclosed (46 deals), the median is US$10M.</li>
              <li><strong>Royalties follow risk:</strong> The top royalty tier roughly doubles from preclinical (9%) to Phase 3 (19%), the steepest stage effect in the data.</li>
            </ul>

            {/* Inline CTA */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">Model your deal structure against {DEAL_STATS.TOTAL_DEALS} benchmarks</p>
              <p className="text-slate-600 mb-4">
                Our calculator models all 5 deal types with phase-specific allocation benchmarks, Monte Carlo simulations, and comparable transaction matching. See exactly how your structure compares to the market.
              </p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors text-sm">
                Structure Your Deal
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Structure Your Next Deal
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Model upfront, milestone, and royalty allocations with real market benchmarks. See how your deal compares to {DEAL_STATS.TOTAL_DEALS} biopharma transactions.
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
                    What are the main components of a biotech licensing deal?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  A biotech licensing deal typically consists of three main components: an <Link href="/glossary/upfront-payment" className="text-teal-600 hover:text-teal-700">upfront payment</Link> at signing, <Link href="/glossary/milestone-payment" className="text-teal-600 hover:text-teal-700">milestone payments</Link> triggered by development and commercial achievements, and royalties on net sales. The allocation varies by phase, with earlier deals weighting milestones and later deals commanding larger upfronts.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How much should the upfront payment be in a licensing deal?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  At the median, 4.8% of announced value is paid at signing for preclinical licenses, 9.5% at Phase 2 and 17.7% for approved products. In dollars the median upfront is US$10M preclinical, US$25M at Phase 2 and US$30M at Phase 3. Use our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link> to benchmark upfront sizing for your specific parameters.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What is the difference between development and commercial milestones?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Development milestones are triggered by clinical and regulatory achievements (Phase initiation, data readouts, FDA approval) and are paid regardless of commercial success. Commercial milestones are tied to net sales thresholds ($500M, $1B, etc.) and only pay out if the product achieves significant market uptake. Explore our <Link href="/benchmarks" className="text-teal-600 hover:text-teal-700">benchmarks</Link> for typical milestone ranges by phase.
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
                { href: '/benchmarks', title: 'Deal Benchmarks', desc: 'Browse deal terms by modality, phase & TA' },
                { href: '/calculator', title: 'Solidus', desc: 'Model custom deal structures instantly' },
                { href: '/glossary/upfront-payment', title: 'Upfront Payment', desc: 'Definition and benchmarks' },
                { href: '/glossary/milestone-payment', title: 'Milestone Payment', desc: 'Types and typical ranges' },
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
