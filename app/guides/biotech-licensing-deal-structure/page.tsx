import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

export const metadata: Metadata = {
  title: 'Biotech Licensing Deal Structure: Upfront, Milestones & Royalties Explained | Ambrosia Ventures',
  description: 'Complete guide to biotech licensing deal structure including upfront payments, development and commercial milestones, royalty structures, and strategies for maximizing deal value.',
  keywords: [
    'biotech licensing deal structure',
    'pharma deal structure',
    'upfront payment licensing',
    'milestone payment pharma',
    'licensing deal components',
    'biopharma deal terms',
    'drug licensing agreement structure',
    'biotech licensing deal terms 2026',
    'biotech out-licensing deal terms',
    'pharma licensing deal structure',
    'biopharma deal terms benchmark',
  ],
  openGraph: {
    title: 'Biotech Licensing Deal Structure: Upfront, Milestones & Royalties Explained',
    description: 'Complete guide to structuring biopharma licensing deals with real benchmarks on upfronts, milestones, and royalties.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/guides/biotech-licensing-deal-structure',
    images: [{ url: '/api/og?title=Biotech%20Licensing%20Deal%20Structure&subtitle=Upfront%2C%20Milestones%20%26%20Royalties&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Licensing Deal Structure: Upfront, Milestones & Royalties',
    description: 'Complete guide to structuring biopharma licensing deals with real benchmarks.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/guides/biotech-licensing-deal-structure',
  },
};

export default function BiotechLicensingDealStructurePage() {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${baseUrl}/guides` },
      { '@type': 'ListItem', position: 3, name: 'Biotech Licensing Deal Structure' },
    ],
  };

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
    dateModified: '2026-04-07',
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
          text: 'Upfront payments typically represent 8-15% of total deal value for preclinical/Phase 1 assets, 15-25% for Phase 2 assets, and 25-50% for Phase 3 or approved products. The absolute dollar amount depends on the asset\'s total expected value, which is driven by indication size, competitive position, and development risk. In 2025-2026, median upfronts for Phase 2 oncology deals range from $75M-$200M.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the difference between development and commercial milestones?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Development milestones are triggered by clinical and regulatory achievements (e.g., Phase 2 initiation, Phase 3 data readout, FDA approval) and are paid regardless of commercial success. Commercial milestones are tied to cumulative net sales thresholds (e.g., first $500M, $1B, $2B in annual sales) and are only paid if the product achieves significant market uptake. Development milestones typically total 1.5-3x the upfront payment, while commercial milestones can be 3-8x the upfront for large-market indications.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema, articleSchema, faqSchema]) }} />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,165,0.12),rgba(255,255,255,0))]" />
          </div>
          <div className="relative max-w-3xl mx-auto">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/guides" className="hover:text-white transition-colors">Guides</Link>
              <span>/</span>
              <span className="text-slate-200">Biotech Licensing Deal Structure</span>
            </nav>

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
              <li><strong>Phase-driven sizing:</strong> Preclinical deals typically command upfronts of $5M-$30M, Phase 1 deals $15M-$75M, Phase 2 deals $50M-$250M, and Phase 3/approved products $100M-$1B+. These ranges reflect the progressive de-risking of the asset.</li>
              <li><strong>Percentage of total deal value:</strong> Upfronts as a share of total deal value increase with clinical maturity: 8-15% at preclinical, 15-25% at Phase 2, 25-50% at Phase 3/approved. This allocation reflects the diminishing contingent nature of later-stage deals.</li>
              <li><strong>Cash vs. equity split:</strong> Some licensees offer a portion of the upfront as equity rather than cash, particularly mid-cap companies with strong stock performance. Licensors should evaluate the effective discount and liquidity constraints of equity components.</li>
              <li><strong>Signal value:</strong> Beyond its economic function, the upfront payment signals the licensee&apos;s commitment. A substantive upfront reduces the risk that the licensee will deprioritize the program in favor of internal assets.</li>
            </ul>

            {/* Section 3 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="milestones">
              Development &amp; Commercial Milestones
            </h2>

            <p className="text-slate-600 leading-relaxed">
              <Link href="/glossary/milestone-payment" className="text-teal-600 font-medium hover:text-teal-700">Milestone payments</Link> are the largest single component of total deal value, typically representing 60-80% of headline numbers. Structuring milestones effectively requires balancing achievability, value signaling, and economic impact:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Development milestones:</strong> These track clinical progress and typically include: IND/CTA filing ($3M-$15M), Phase 2 initiation ($10M-$30M), Phase 2 data readout ($15M-$50M), Phase 3 initiation ($20M-$75M), Phase 3 data readout ($25M-$100M), NDA/BLA filing ($25M-$75M), and FDA/EMA approval ($50M-$200M).</li>
              <li><strong>Regulatory milestones:</strong> Approval in additional territories (EU, Japan, China) adds $15M-$75M per territory. Supplemental indications approvals typically trigger additional payments of $10M-$50M each, which can significantly increase total deal value for platform assets.</li>
              <li><strong>Commercial milestones:</strong> These are tied to annual or cumulative net sales thresholds. Common tiers include $250M ($10M-$25M payment), $500M ($25M-$50M), $1B ($50M-$100M), $2B ($75M-$150M), and $3B+ ($100M-$200M). Higher tiers have lower probability-weighted values but are inexpensive for the licensee to pay given the implied revenue.</li>
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
              <li><strong>Base rates by phase:</strong> Preclinical deals: 2-6% royalties. Phase 1: 4-8%. Phase 2: 6-12%. Phase 3: 10-15%. Approved: 12-20%. These ranges reflect the licensor&apos;s remaining contribution to value creation.</li>
              <li><strong>Tiered escalation:</strong> Most deals use tiered structures where royalty rates increase with sales volume. A typical structure might be 8% on the first $500M, 10% on $500M-$1B, 12% on $1B-$2B, and 14% above $2B in annual net sales.</li>
              <li><strong>Royalty term:</strong> Royalties typically run for 10-15 years from first commercial sale or until patent expiry, whichever is later. Step-downs of 30-50% upon generic/biosimilar entry are standard. Orphan drug exclusivity can extend effective royalty protection.</li>
              <li><strong>Net sales definition:</strong> The definition of &quot;net sales&quot; (gross sales minus returns, rebates, chargebacks, allowances, and distribution fees) materially affects the royalty base. Negotiate the specific deductions carefully, as gross-to-net adjustments can reduce the effective royalty base by 30-50% in the US market.</li>
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
              Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">deal calculator</Link> to model different allocation scenarios and see how the structure affects probability-weighted deal value for both parties.
            </p>

            {/* Deal Terms by Deal Type */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="deal-terms-by-type">
              Deal Terms by Deal Type: 2026 Benchmarks
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Deal economics vary dramatically by structure type. The table below shows typical allocation patterns from our analysis of 1,900+ biopharma transactions.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Deal Type</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Upfront</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Dev Milestones</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Reg Milestones</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Comm Milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Licensing</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">20-30%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">30-40%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">15-25%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">15-25%</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">Acquisition</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">100%</td>
                    <td className="py-2.5 px-4 text-center text-slate-500" colSpan={3}>Premium 40-65% over pre-announcement share price</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Co-development</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">15-25%</td>
                    <td className="py-2.5 px-4 text-center text-slate-500" colSpan={2}>Shared costs (50/50 or 60/40)</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">Higher royalties</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">Option / License</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">5-15%</td>
                    <td className="py-2.5 px-4 text-center text-slate-500" colSpan={2}>Option fee 5-10% of total value</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">Back-loaded</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Collaboration</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">10-20%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">25-35%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">15-20%</td>
                    <td className="py-2.5 px-4 text-center text-slate-700">20-30%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal database, 1,900+ transactions as of April 2026. Percentages represent share of total non-royalty deal value.
            </p>

            {/* 2026 Deal Terms Trends */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="2026-trends">
              2026 Deal Terms Trends: The Shift Toward Option/License Structures
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The most significant structural trend in biopharma dealmaking over the past three years has been the dramatic rise of option/license structures. These deals give the licensee a time-limited option (typically exercisable at a key data readout) to acquire full licensing rights, rather than committing to a traditional upfront license.
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600 my-4">
              <li><strong>Option/license market share:</strong> Option/license structures represented just ~5% of biopharma deals in 2023. By Q1 2026, they account for approximately 35% of new licensing transactions -- a 7x increase in three years.</li>
              <li><strong>Why the shift:</strong> Post-2022 capital discipline at large pharma, combined with early-stage pipeline uncertainty, has made option structures more attractive. Licensees pay a smaller initial commitment, preserve capital, and gain data-driven decision points before committing full economics.</li>
              <li><strong>Impact on licensors:</strong> Option structures reduce upfront cash but often yield higher total deal values if the option is exercised, as the licensor captures a &quot;de-risking premium&quot; between option grant and exercise. The tradeoff is increased timing risk and the possibility the option lapses.</li>
              <li><strong>Typical option terms:</strong> Option fees of $10M-$75M (5-10% of total deal value), exercise windows of 12-24 months, and exercise payments that are 2-4x the option fee. Post-exercise economics resemble traditional licensing terms.</li>
              <li><strong>Other 2026 trends:</strong> Increasing use of biobucks structures (milestone-heavy, lower upfront), growing ex-China license carve-outs as geopolitical risk repricing continues, and rising co-development arrangements in oncology as pharma companies seek pipeline control.</li>
            </ul>

            {/* Inline CTA */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">Model your deal structure against 1,900+ benchmarks</p>
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
              Model upfront, milestone, and royalty allocations with real market benchmarks. See how your deal compares to 1,900+ biopharma transactions.
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
                  Upfronts typically represent 8-15% of total deal value for preclinical/Phase 1 assets, 15-25% for Phase 2, and 25-50% for Phase 3 or approved products. In 2025-2026, median upfronts for Phase 2 oncology deals range from $75M-$200M. Use our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link> to benchmark upfront sizing for your specific parameters.
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
                { href: '/calculator', title: 'Deal Calculator', desc: 'Model custom deal structures instantly' },
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
      <SiteFooter />
    </>
  );
}
