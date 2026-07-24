import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: `Biopharma Licensing Benchmarks 2026: Data From ${DEAL_STATS.TOTAL_DEALS} Deals | Ambrosia Ventures`,
  description: `Comprehensive biopharma licensing benchmarks for 2026 including upfront payments, milestones, royalties by phase, modality, and therapeutic area. Based on ${DEAL_STATS.TOTAL_DEALS} disclosed transactions.`,
  keywords: [
    'biopharma licensing benchmarks',
    'pharma deal benchmarks',
    'licensing deal benchmarks 2026',
    'biotech deal terms data',
    'pharma licensing upfront benchmarks',
    'biopharma deal terms',
    'pharma licensing royalty rates',
    'biotech milestone benchmarks',
    'drug licensing deal data',
    'pharma deal comparables',
  ],
  openGraph: {
    title: `Biopharma Licensing Benchmarks 2026: Data From ${DEAL_STATS.TOTAL_DEALS} Deals`,
    description: 'Comprehensive biopharma licensing benchmarks including upfront payments, milestones, and royalties by phase, modality, and therapeutic area.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/biopharma-licensing-benchmarks',
    images: [{ url: '/api/og?title=Biopharma%20Licensing%20Benchmarks%202026&subtitle=Data%20From%202%2C500%2B%20Deals&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Biopharma Licensing Benchmarks 2026: Data From ${DEAL_STATS.TOTAL_DEALS} Deals`,
    description: 'Comprehensive biopharma licensing benchmarks including upfront payments, milestones, and royalties.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/biopharma-licensing-benchmarks',
  },
};

export default function BiopharmaLicensingBenchmarksPage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Biopharma Licensing Benchmarks 2026: Data From ${DEAL_STATS.TOTAL_DEALS} Deals`,
    description: 'Comprehensive biopharma licensing benchmarks including upfront payments, milestones, royalties by phase, modality, and therapeutic area.',
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
    datePublished: '2026-04-06',
    dateModified: '2026-04-06',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/guides/biopharma-licensing-benchmarks`,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is a typical upfront payment for a Phase 2 biopharma licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Based on analysis of ${DEAL_STATS.TOTAL_DEALS} disclosed transactions, the median upfront payment for a Phase 2 biopharma licensing deal is $50M, with the 25th percentile at $20M and the 75th percentile at $125M. Oncology Phase 2 deals skew higher (median $75M) due to larger commercial opportunities, while rare disease deals command premiums for validated targets with clear regulatory pathways.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How have biopharma licensing deal terms changed from 2022 to 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Biopharma licensing deal terms have shifted significantly from 2022 to 2026. Upfront payments have increased 20-30% across all phases as competition for differentiated assets intensifies. Milestone-heavy structures have become more common, with total potential deal value growing faster than upfront components. Royalty rates have remained relatively stable, though tiered structures with escalators tied to sales thresholds are now standard.',
        },
      },
      {
        '@type': 'Question',
        name: 'What royalty rates are standard in biopharma licensing deals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Standard royalty rates in biopharma licensing deals range from single-digit percentages for discovery-stage assets to mid-teens or higher for approved products. Discovery/preclinical deals typically carry 3-8% royalties, Phase 1 assets command 5-10%, Phase 2 assets 8-15%, and Phase 3 or approved assets 12-20%+. Biologics and gene therapies generally command higher royalties than small molecules due to higher barriers to biosimilar competition.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do biopharma licensing benchmarks differ by therapeutic area?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Therapeutic area significantly impacts licensing deal terms. Oncology commands the highest total deal values (median $1.8B total potential value) driven by large commercial opportunities and premium pricing. Rare disease deals feature higher upfront-to-total-value ratios due to regulatory incentives and lower commercial risk. Neurology deals have seen the fastest growth in deal values from 2022-2026, driven by breakthroughs in neurodegeneration. Immunology and metabolic deals tend toward co-development structures with shared risk and reward.',
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
              { label: 'Biopharma Licensing Benchmarks 2026' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              14 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Biopharma Licensing Benchmarks 2026
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              Based on analysis of {DEAL_STATS.TOTAL_DEALS} disclosed transactions. Upfront payments, milestones, royalties, and total deal values broken down by phase, modality, therapeutic area, and deal type.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Licensing deal benchmarks are the foundation of every biopharma negotiation, board presentation, and investment committee memo. Yet most teams rely on a handful of publicly cited comparables or outdated industry reports. This page provides comprehensive, current benchmarks derived from the largest proprietary dataset of disclosed biopharma transactions available: {DEAL_STATS.TOTAL_DEALS} deals spanning 12 therapeutic areas, 23+ modalities, and all clinical phases from discovery through approved products.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Every data point below is derived from real transactions disclosed through SEC filings, press releases, and regulatory documents. We update these benchmarks continuously as new deals close, ensuring the numbers reflect current market conditions rather than historical averages diluted by pre-pandemic deal flow.
            </p>

            {/* Section 1: Upfront Payment Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="upfront-benchmarks">
              Upfront Payment Benchmarks by Phase
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Upfront payments are the most scrutinized component of any licensing deal. They represent the immediate cash commitment and signal the licensee&apos;s conviction level. Our dataset reveals clear phase-dependent patterns with significant dispersion driven by asset quality, competitive dynamics, and therapeutic area:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Phase</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">25th Percentile</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Median</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">75th Percentile</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Deal Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700">Discovery / Preclinical</td><td className="px-4 py-3 text-right text-slate-600">$5M</td><td className="px-4 py-3 text-right font-medium text-slate-900">$15M</td><td className="px-4 py-3 text-right text-slate-600">$40M</td><td className="px-4 py-3 text-right text-slate-500">620+</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 1</td><td className="px-4 py-3 text-right text-slate-600">$10M</td><td className="px-4 py-3 text-right font-medium text-slate-900">$30M</td><td className="px-4 py-3 text-right text-slate-600">$80M</td><td className="px-4 py-3 text-right text-slate-500">480+</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Phase 2</td><td className="px-4 py-3 text-right text-slate-600">$20M</td><td className="px-4 py-3 text-right font-medium text-slate-900">$50M</td><td className="px-4 py-3 text-right text-slate-600">$125M</td><td className="px-4 py-3 text-right text-slate-500">540+</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 3</td><td className="px-4 py-3 text-right text-slate-600">$75M</td><td className="px-4 py-3 text-right font-medium text-slate-900">$150M</td><td className="px-4 py-3 text-right text-slate-600">$400M</td><td className="px-4 py-3 text-right text-slate-500">380+</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Approved / Marketed</td><td className="px-4 py-3 text-right text-slate-600">$200M</td><td className="px-4 py-3 text-right font-medium text-slate-900">$500M</td><td className="px-4 py-3 text-right text-slate-600">$1.2B</td><td className="px-4 py-3 text-right text-slate-500">310+</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              The spread between the 25th and 75th percentile widens dramatically at later stages, reflecting the larger role of asset-specific factors (competitive landscape, data quality, strategic fit) as assets de-risk. A Phase 3 oncology asset with breakthrough designation and differentiated efficacy data can command 3-5x the median upfront, while a me-too asset in a crowded indication may fall below the 25th percentile.
            </p>

            {/* Section 2: Milestone Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="milestone-benchmarks">
              Milestone Payment Benchmarks
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Milestone payments typically represent 60-75% of total potential deal value in licensing agreements. They align risk sharing between licensor and licensee by tying payments to specific value-creating events. Our data reveals distinct patterns across the three major milestone categories:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Milestone Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Median Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">% of Total Deal Value</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Typical Structure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Development milestones</td><td className="px-4 py-3 text-right text-slate-600">$250M</td><td className="px-4 py-3 text-right text-slate-600">20-30%</td><td className="px-4 py-3 text-right text-slate-500">IND, Phase start/completion, data readouts</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Regulatory milestones</td><td className="px-4 py-3 text-right text-slate-600">$200M</td><td className="px-4 py-3 text-right text-slate-600">15-25%</td><td className="px-4 py-3 text-right text-slate-500">NDA/BLA filing, FDA approval, EU/ROW approvals</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Commercial milestones</td><td className="px-4 py-3 text-right text-slate-600">$400M</td><td className="px-4 py-3 text-right text-slate-600">25-35%</td><td className="px-4 py-3 text-right text-slate-500">$500M, $1B, $2B+ net sales thresholds</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Development milestones are the most negotiable component because they depend on clinical execution. Savvy licensors push for milestones tied to trial initiation (higher probability) rather than data outcomes (lower probability). Commercial milestones are increasingly structured with escalating tiers tied to cumulative net sales thresholds, with the largest payments reserved for blockbuster scenarios exceeding $2B in annual sales.
            </p>

            <p className="text-slate-600 leading-relaxed">
              A notable trend in 2025-2026 deals: &quot;accelerated milestone&quot; provisions that combine development and regulatory milestones into a single larger payment triggered by accelerated approval, reflecting the growing use of the FDA&apos;s accelerated pathways in oncology and rare disease.
            </p>

            {/* Mid-article CTA 1 */}
            <div className="my-10 p-6 bg-gradient-to-r from-slate-50 to-teal-50 rounded-xl border border-teal-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Benchmark your deal against {DEAL_STATS.TOTAL_DEALS} transactions</h3>
              <p className="text-slate-600 mb-4">Enter your asset details and get instant comparisons to real deal terms by phase, modality, and therapeutic area.</p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors">
                Open the Calculator
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Section 3: Royalty Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="royalty-benchmarks">
              Royalty Rate Benchmarks by Phase and Modality
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Royalty rates are the most enduring component of licensing deal economics, generating value for decades in successful programs. Rates vary significantly by both the asset&apos;s development stage and its modality, reflecting differences in competitive barriers and commercial potential:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Phase</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Small Molecule</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Antibody / Biologic</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Cell / Gene Therapy</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">ADC / Bispecific</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700">Discovery / Preclinical</td><td className="px-4 py-3 text-right text-slate-600">3-6%</td><td className="px-4 py-3 text-right text-slate-600">4-8%</td><td className="px-4 py-3 text-right text-slate-600">5-10%</td><td className="px-4 py-3 text-right text-slate-600">5-9%</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 1</td><td className="px-4 py-3 text-right text-slate-600">5-8%</td><td className="px-4 py-3 text-right text-slate-600">6-10%</td><td className="px-4 py-3 text-right text-slate-600">7-12%</td><td className="px-4 py-3 text-right text-slate-600">7-11%</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Phase 2</td><td className="px-4 py-3 text-right text-slate-600">8-12%</td><td className="px-4 py-3 text-right text-slate-600">10-15%</td><td className="px-4 py-3 text-right text-slate-600">10-18%</td><td className="px-4 py-3 text-right text-slate-600">10-16%</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 3</td><td className="px-4 py-3 text-right text-slate-600">10-15%</td><td className="px-4 py-3 text-right text-slate-600">12-18%</td><td className="px-4 py-3 text-right text-slate-600">14-22%</td><td className="px-4 py-3 text-right text-slate-600">13-20%</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Approved</td><td className="px-4 py-3 text-right text-slate-600">12-20%</td><td className="px-4 py-3 text-right text-slate-600">15-25%</td><td className="px-4 py-3 text-right text-slate-600">18-30%</td><td className="px-4 py-3 text-right text-slate-600">16-25%</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Cell and gene therapies command the highest royalty rates due to manufacturing complexity, limited competition from generics or biosimilars, and the potential for curative one-time treatments with premium pricing. ADCs and bispecific antibodies have emerged as the fastest-growing modality in terms of deal volume, with royalty rates reflecting their differentiated clinical profiles and rising competitive interest from large pharma acquirers.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Tiered royalty structures are now standard in 80%+ of licensing deals, with rates escalating as cumulative net sales cross defined thresholds (e.g., 12% on the first $500M, 15% on $500M-$1B, 18% above $1B). Anti-stacking provisions and generic entry step-downs are nearly universal and should be factored into effective royalty rate projections.
            </p>

            {/* Section 4: Therapeutic Area Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="therapeutic-area">
              Deal Terms by Therapeutic Area
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Therapeutic area is one of the strongest predictors of deal structure and total value. Market size, competitive intensity, regulatory pathway complexity, and patient population characteristics all influence how deals are structured. Below are benchmarks for the four highest-volume therapeutic areas in our dataset:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Oncology:</strong> Highest total deal values with median total potential value of $1.8B. Upfronts average 12-18% of total deal value. Oncology deals are milestone-heavy with significant commercial milestone components tied to blockbuster sales thresholds. The most active therapeutic area by deal count, representing ~30% of all transactions in our dataset.</li>
              <li><strong>Neurology:</strong> Fastest-growing deal values from 2022-2026, driven by breakthroughs in neurodegeneration (Alzheimer&apos;s, Parkinson&apos;s) and neuropsychiatry. Median total potential value of $1.2B. Neurology deals tend to have higher upfront-to-total-value ratios (15-22%) reflecting longer development timelines and the need for larger clinical programs.</li>
              <li><strong>Immunology:</strong> Mature deal landscape with well-established benchmarks. Median total potential value of $1.4B. Co-development structures are more common than in other TAs, with shared investment and profit-split arrangements replacing traditional royalty structures in 25-30% of recent deals.</li>
              <li><strong>Rare Disease:</strong> Premium upfront-to-total-value ratios (18-25%) driven by orphan drug incentives, smaller trial requirements, and lower commercial risk. Median total potential value of $900M. Gene therapy deals in rare disease command the highest royalty rates in any therapeutic area, often exceeding 20% even at Phase 1.</li>
            </ul>

            {/* Section 5: Deal Type Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="deal-type">
              Deal Terms by Deal Type
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The structure of a transaction fundamentally shapes how value is distributed between parties. Our dataset covers five primary deal types, each with distinct economic profiles:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Exclusive licensing:</strong> The most common structure (45% of deals), with upfront + milestones + royalties. Median upfront is $40M across all phases. Licensors retain downstream royalty economics but cede control of development and commercialization decisions.</li>
              <li><strong>Acquisition:</strong> Single upfront payment (sometimes with CVRs) representing full asset value. Median acquisition price is $350M for clinical-stage assets. Premiums of 50-100% over standalone rNPV are common for competitive auctions with multiple bidders.</li>
              <li><strong>Co-development:</strong> Shared investment and profit splits, typically 50/50 or 60/40. Lower upfront payments (median $25M) but higher long-term economics for the originator. Most common in immunology and metabolic disease where development costs are high and both parties bring complementary capabilities.</li>
              <li><strong>Option deals:</strong> Upfront option fee + exercise price upon data readout. Option fees are typically 15-25% of what a full license upfront would be, with exercise prices 2-4x the option fee. Increasingly popular for discovery and Phase 1 assets where data uncertainty is highest.</li>
              <li><strong>Collaboration:</strong> Broad strategic partnerships covering multiple programs or platform access. Highest total deal values (median $2.2B) but distributed across multiple assets and milestones. Research funding payments ($10M-$50M/year) supplement traditional deal economics.</li>
            </ul>

            {/* Mid-article CTA 2 */}
            <div className="my-10 p-6 bg-gradient-to-r from-slate-50 to-teal-50 rounded-xl border border-teal-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Model any deal structure in seconds</h3>
              <p className="text-slate-600 mb-4">Our calculator supports licensing, acquisition, co-development, option, and collaboration structures with differentiated benchmarks for each.</p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors">
                Try It Now
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Section 6: Year-over-Year Trends */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="yoy-trends">
              Year-over-Year Trends (2022-2026)
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Deal terms are not static. Macro conditions, competitive dynamics, and modality trends all drive structural shifts in how biopharma transactions are priced. Key trends from the past four years:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Upfront inflation (2022-2026):</strong> Median upfronts have increased 20-30% across all phases, driven by intensifying competition for differentiated assets and the return of large pharma M&amp;A budgets after the IRA-driven capital reallocation. Phase 2 assets with positive data have seen the steepest increases.</li>
              <li><strong>Rise of option structures:</strong> Option deals grew from 8% of transactions in 2022 to 18% in 2026, as licensees seek to limit upfront capital exposure while securing access to early-stage innovation. The trend is most pronounced in discovery and Phase 1 deals.</li>
              <li><strong>ADC and bispecific premium:</strong> Deals involving antibody-drug conjugates and bispecific antibodies now command 25-40% premiums over conventional antibody deals at the same phase, reflecting their differentiated clinical profiles and the wave of positive clinical data driving large pharma interest.</li>
              <li><strong>China licensing normalization:</strong> After a surge in 2023-2024, China-origin licensing deal terms have normalized to global benchmarks as market maturity increases and due diligence standards tighten. Ex-China rights deals remain a significant source of innovation for Western pharma.</li>
              <li><strong>Milestone-heavy structures:</strong> Total potential deal values have grown faster than upfront payments, indicating a structural shift toward milestone-heavy deals. The ratio of total potential value to upfront payment has increased from 8-10x in 2022 to 10-14x in 2026 for Phase 1-2 assets.</li>
            </ul>

            {/* Section 7: How to Use These Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="how-to-use">
              How to Use These Benchmarks
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Raw benchmarks are a starting point, not an answer. To translate these numbers into actionable deal strategy, follow a structured approach:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Filter by relevant comparables:</strong> Start with the benchmarks for your asset&apos;s phase, modality, and therapeutic area. Median values across all deals will mislead if your asset is a gene therapy for rare disease being compared against small molecule oncology averages.</li>
              <li><strong>Adjust for asset-specific factors:</strong> Data quality, competitive landscape, regulatory designations (breakthrough, fast track, orphan), and mechanism novelty all justify adjustments above or below the median. A first-in-class asset with positive Phase 2 data and breakthrough designation can reasonably target the 75th percentile or above.</li>
              <li><strong>Model the full deal structure:</strong> Upfront, milestones, and royalties are interdependent. A higher upfront typically correlates with lower royalties and milestone caps. Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> to model the trade-offs and optimize total deal economics.</li>
              <li><strong>Validate with rNPV:</strong> Benchmarks tell you what the market is paying; <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">rNPV analysis</Link> tells you what the asset is worth. The best negotiation position combines market benchmarks with a rigorous intrinsic valuation to set walk-away thresholds and identify value creation opportunities.</li>
              <li><strong>Document your rationale:</strong> Boards and investment committees expect data-backed justifications for deal terms. Reference specific percentile ranges from comparable transactions and articulate why your asset&apos;s terms fall where they do within the distribution.</li>
            </ul>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Benchmark Your Next Deal
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Our calculator applies these benchmarks automatically, generating phase-, modality-, and TA-specific deal terms with rNPV validation across {DEAL_STATS.TOTAL_DEALS} comparable transactions.
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
                    What is a typical upfront payment for a Phase 2 biopharma licensing deal?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Based on our analysis of {DEAL_STATS.TOTAL_DEALS} transactions, the median upfront for a Phase 2 licensing deal is $50M, with the 25th percentile at $20M and the 75th percentile at $125M. Oncology Phase 2 deals skew higher (median $75M), while rare disease deals command premiums for validated targets. Use our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link> to get benchmarks specific to your asset.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How have biopharma licensing deal terms changed from 2022 to 2026?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Upfronts have increased 20-30% across all phases as competition for differentiated assets intensifies. Milestone-heavy structures have become more common, with total potential deal value growing faster than upfront components. Option deal structures have risen from 8% to 18% of transactions. ADC and bispecific deals now command 25-40% premiums over conventional antibody deals.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What royalty rates are standard in biopharma licensing deals?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Royalty rates range from 3-8% for discovery-stage assets to 12-25%+ for approved products. Biologics and gene therapies command higher rates than small molecules due to stronger competitive barriers. Tiered structures with escalators tied to net sales thresholds are now standard in 80%+ of deals. See the <Link href="/methodology" className="text-teal-600 hover:text-teal-700">methodology page</Link> for full details.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How do biopharma licensing benchmarks differ by therapeutic area?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Therapeutic area is one of the strongest predictors of deal terms. Oncology leads with the highest total deal values (median $1.8B total potential value). Rare disease features higher upfront-to-total-value ratios (18-25%) due to regulatory incentives. Neurology has seen the fastest growth in deal values driven by neurodegeneration breakthroughs. Immunology increasingly favors co-development structures with shared risk.
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: '/calculator', title: 'Solidus', desc: `Benchmark your deal against ${DEAL_STATS.TOTAL_DEALS} transactions` },
                { href: '/methodology', title: 'Methodology', desc: 'Data sources and model assumptions' },
                { href: '/guides/rnpv-biotech-valuation', title: 'rNPV Guide', desc: 'Risk-adjusted valuation methodology' },
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
