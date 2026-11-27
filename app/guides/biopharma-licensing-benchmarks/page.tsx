import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Pharma Licensing Benchmarks 2026: Upfronts, Royalties & Milestones From 2,102 Deals',
  description: 'Median upfront by stage: preclinical US$10M, Phase 2 US$25M, Phase 3 US$30M. Royalty, milestone and deal value benchmarks from 2,102 primary-sourced biopharma deals announced January 2017 to November 2026.',
  keywords: [
    'pharma licensing benchmarks',
    'biopharma deal benchmarks',
    'pharma licensing benchmarks 2026',
    'biotech deal terms data',
    'pharma licensing upfront benchmarks',
    'biopharma deal terms',
    'pharma licensing royalty rates',
    'biotech milestone benchmarks',
    'drug licensing deal data',
    'pharma deal comparables',
    'biopharma licensing benchmarks',
    'pharma deal benchmarks 2026',
    'biotech deal benchmarks',
  ],
  openGraph: {
    title: 'Pharma Licensing Benchmarks 2026: Upfronts, Royalties & Milestones From 2,102 Deals',
    description: 'Median upfront by stage: preclinical US$10M, Phase 2 US$25M, Phase 3 US$30M. Royalty, milestone and deal value benchmarks from 2,102 primary-sourced biopharma deals.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/biopharma-licensing-benchmarks',
    images: [{ url: '/api/og?title=Biopharma%20Licensing%20Benchmarks%202026&subtitle=Data%20From%202%2C100%2B%20Deals&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pharma Licensing Benchmarks 2026: Upfronts, Royalties & Milestones From 2,102 Deals',
    description: 'Median upfront by stage: preclinical US$10M, Phase 2 US$25M, Phase 3 US$30M. Biopharma deal benchmarks from 2,102 primary-sourced deals.',
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
    headline: 'Biopharma Licensing Benchmarks 2026: Data From 2,102 Deals',
    description: 'Biopharma licensing benchmarks for upfront payments, milestones, royalties and announced deal values by stage, modality and deal type, from 2,102 primary-sourced deals announced January 2017 to November 2026.',
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
    dateModified: '2026-11-27',
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
          text: 'In the Ambrosia Ventures deal benchmarks (2,102 primary-sourced deals announced January 2017 to November 2026), the median upfront for a license, option or collaboration signed at Phase 2 is US$25M, with a middle half (25th to 75th percentile) of US$10M to US$81.2M across 136 deals that disclose an upfront. The median announced total value at Phase 2 is US$328M, and the median share of announced value paid at signing is 9.5%. Data quality, competition and strategic fit drive wide dispersion around the median.',
        },
      },
      {
        '@type': 'Question',
        name: 'How have biopharma licensing deal terms changed recently?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'In Q3 2026 the median license upfront was US$45M, against US$12M in Q3 2025, across 151 deals in the quarter (107 licenses and 44 acquisitions) with US$4.0B in disclosed upfronts. Over the longer run, China-based licensors grew from 6% of licenses in 2017 to 18.3% in 2025. Structures remain milestone-heavy: across all licenses, options and collaborations, the median share of announced value paid at signing is 7.5%.',
        },
      },
      {
        '@type': 'Question',
        name: 'What royalty rates are standard in biopharma licensing deals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The median top tier rises with stage at signing: 9% preclinical, 12% Phase 1, 15% Phase 2, and 19% at Phase 3 and for approved products. By modality, antibodies have the highest median top tier at 15%, followed by bispecifics at 14% and ADCs at 13.5%; small molecules sit at 12%, and cell and gene therapies at 9%.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do biopharma licensing benchmarks differ by therapeutic area?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Therapeutic area shapes deal terms through market size, competitive intensity, regulatory pathway and patient population. Oncology deals tend to carry large commercial milestone packages tied to sales thresholds. Rare disease deals benefit from orphan incentives and smaller trials. Neurology deals reflect long development timelines. Immunology and metabolic deals more often use co-development structures with shared risk. We do not publish therapeutic-area medians on this page; filter comparables by area in the calculator.',
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
              Based on 2,102 primary-sourced deals announced January 2017 to November 2026. Upfront payments, milestones, royalties, and announced deal values broken down by stage, modality, and deal type.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Licensing deal benchmarks are the foundation of every biopharma negotiation, board presentation, and investment committee memo. Yet most teams rely on a handful of publicly cited comparables or outdated industry reports. This page sets out current benchmarks from the Ambrosia Ventures deal benchmarks: 2,102 licenses, options, collaborations and acquisitions announced January 2017 to November 2026, each tied to a regulatory filing or company announcement.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Each figure below uses only the deals that disclose that figure, so sample sizes differ by metric and are shown alongside the numbers. &quot;Middle half&quot; means the 25th to 75th percentile. Full tables are published at{' '}<a href="https://ambrosiaventures.co/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">ambrosiaventures.co/benchmarks</a>.
            </p>

            {/* Section 1: Upfront Payment Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="upfront-benchmarks">
              Upfront Payment Benchmarks by Phase
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Upfront payments are the most scrutinized component of any licensing deal. They represent the immediate cash commitment and signal the licensee&apos;s conviction level. Across 1,208 licenses, options and collaborations that disclose an upfront, the median is US$20M, with a middle half of US$5M to US$55M. By stage at signing:
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
                  <tr><td className="px-4 py-3 text-slate-700">Preclinical</td><td className="px-4 py-3 text-right text-slate-600">US$1.3M</td><td className="px-4 py-3 text-right font-medium text-slate-900">US$10M</td><td className="px-4 py-3 text-right text-slate-600">US$40M</td><td className="px-4 py-3 text-right text-slate-500">295</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 1</td><td className="px-4 py-3 text-right text-slate-600">US$10M</td><td className="px-4 py-3 text-right font-medium text-slate-900">US$30M</td><td className="px-4 py-3 text-right text-slate-600">US$100M</td><td className="px-4 py-3 text-right text-slate-500">149</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Phase 2</td><td className="px-4 py-3 text-right text-slate-600">US$10M</td><td className="px-4 py-3 text-right font-medium text-slate-900">US$25M</td><td className="px-4 py-3 text-right text-slate-600">US$81.2M</td><td className="px-4 py-3 text-right text-slate-500">136</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 3</td><td className="px-4 py-3 text-right text-slate-600">US$12M</td><td className="px-4 py-3 text-right font-medium text-slate-900">US$30M</td><td className="px-4 py-3 text-right text-slate-600">US$73M</td><td className="px-4 py-3 text-right text-slate-500">193</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Approved / Marketed</td><td className="px-4 py-3 text-right text-slate-600">US$5M</td><td className="px-4 py-3 text-right font-medium text-slate-900">US$17M</td><td className="px-4 py-3 text-right text-slate-600">US$44.5M</td><td className="px-4 py-3 text-right text-slate-500">161</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026. Licenses, options and collaborations that disclose an upfront. Full table:{' '}<a href="https://ambrosiaventures.co/benchmarks/upfront-payments-by-phase" className="underline hover:text-slate-600">upfront payments by phase</a>.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Median upfronts do not climb steadily with stage. They peak around Phase 1 and Phase 3 at US$30M and fall to US$17M for approved products. What does climb is the share of value paid at signing: later-stage deals put more of the announced value up front and less into contingent payments. The spread around each median is wide, reflecting asset-specific factors such as competitive landscape, data quality, and strategic fit. A differentiated asset with strong data can price well above the 75th percentile, while a me-too asset in a crowded indication may fall below the 25th.
            </p>

            {/* Section 2: Milestone Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="milestone-benchmarks">
              Milestone Payment Benchmarks
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Milestones make up most of announced deal value. Across 966 deals that disclose both an upfront and an announced total, the median share paid at signing is 7.5% (middle half 3.6% to 16.4%). The median total milestone package is US$275M (1,152 deals), and the median announced total value is US$357.8M (1,112 deals; middle half US$111.9M to US$1.0B). Among the 269 deals that disclose how milestones split, the weight sits heavily on commercial events:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Milestone Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Share of Milestone Value</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Typical Triggers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Commercial milestones</td><td className="px-4 py-3 text-right text-slate-600">73.1%</td><td className="px-4 py-3 text-right text-slate-500">Annual net sales thresholds</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Development milestones</td><td className="px-4 py-3 text-right text-slate-600">17.6%</td><td className="px-4 py-3 text-right text-slate-500">IND, phase start or completion, data readouts</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Regulatory milestones</td><td className="px-4 py-3 text-right text-slate-600">9.4%</td><td className="px-4 py-3 text-right text-slate-500">NDA/BLA filing, FDA approval, EU and other approvals</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Stage at signing drives how much of a deal is contingent. Earlier deals carry larger announced totals but pay a smaller share at signing:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Phase</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Median Announced Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Share Paid at Signing</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Milestones / Upfront</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700">Preclinical</td><td className="px-4 py-3 text-right text-slate-600">US$446M (n=247)</td><td className="px-4 py-3 text-right text-slate-600">4.8%</td><td className="px-4 py-3 text-right text-slate-600">20x</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 1</td><td className="px-4 py-3 text-right text-slate-600">US$588M (n=139)</td><td className="px-4 py-3 text-right text-slate-600">7.4%</td><td className="px-4 py-3 text-right text-slate-600">12.9x</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Phase 2</td><td className="px-4 py-3 text-right text-slate-600">US$328M (n=133)</td><td className="px-4 py-3 text-right text-slate-600">9.5%</td><td className="px-4 py-3 text-right text-slate-600">9.5x</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 3</td><td className="px-4 py-3 text-right text-slate-600">US$220.7M (n=190)</td><td className="px-4 py-3 text-right text-slate-600">13.1%</td><td className="px-4 py-3 text-right text-slate-600">6.7x</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Approved / Marketed</td><td className="px-4 py-3 text-right text-slate-600">US$118M (n=145)</td><td className="px-4 py-3 text-right text-slate-600">17.7%</td><td className="px-4 py-3 text-right text-slate-600">4.7x</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026. Full table:{' '}<a href="https://ambrosiaventures.co/benchmarks/milestone-payments" className="underline hover:text-slate-600">milestone payments</a>.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Development milestones are the most negotiable component because they depend on clinical execution. Savvy licensors push for milestones tied to trial initiation (higher probability) rather than data outcomes (lower probability). Commercial milestones carry most of the headline value but are paid only in strong sales scenarios, so a large announced total with a thin upfront is worth far less than it looks.
            </p>

            <p className="text-slate-600 leading-relaxed">
              A notable trend in recent deals: &quot;accelerated milestone&quot; provisions that combine development and regulatory milestones into a single larger payment triggered by accelerated approval, reflecting the growing use of the FDA&apos;s accelerated pathways in oncology and rare disease.
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
              Royalty rates are the most enduring component of licensing deal economics, generating value for decades in successful programs. Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The top tier rises with stage at signing:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Phase</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Median Top Tier</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Middle Half</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Deal Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700">Preclinical</td><td className="px-4 py-3 text-right font-medium text-slate-900">9%</td><td className="px-4 py-3 text-right text-slate-600">5% to 12%</td><td className="px-4 py-3 text-right text-slate-500">137</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 1</td><td className="px-4 py-3 text-right font-medium text-slate-900">12%</td><td className="px-4 py-3 text-right text-slate-600">9.8% to 18.2%</td><td className="px-4 py-3 text-right text-slate-500">56</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Phase 2</td><td className="px-4 py-3 text-right font-medium text-slate-900">15%</td><td className="px-4 py-3 text-right text-slate-600">11.5% to 19%</td><td className="px-4 py-3 text-right text-slate-500">56</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Phase 3</td><td className="px-4 py-3 text-right font-medium text-slate-900">19%</td><td className="px-4 py-3 text-right text-slate-600">12% to 25%</td><td className="px-4 py-3 text-right text-slate-500">75</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Approved</td><td className="px-4 py-3 text-right font-medium text-slate-900">19%</td><td className="px-4 py-3 text-right text-slate-600">12% to 22%</td><td className="px-4 py-3 text-right text-slate-500">78</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              By modality, the median top tier is highest for antibodies and lowest for cell and gene therapies:
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Modality</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Median Top Tier</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Deal Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700">Antibody</td><td className="px-4 py-3 text-right font-medium text-slate-900">15%</td><td className="px-4 py-3 text-right text-slate-500">70</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Bispecific</td><td className="px-4 py-3 text-right font-medium text-slate-900">14%</td><td className="px-4 py-3 text-right text-slate-500">26</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">ADC</td><td className="px-4 py-3 text-right font-medium text-slate-900">13.5%</td><td className="px-4 py-3 text-right text-slate-500">22</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">siRNA / antisense</td><td className="px-4 py-3 text-right font-medium text-slate-900">13%</td><td className="px-4 py-3 text-right text-slate-500">30</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Small molecule</td><td className="px-4 py-3 text-right font-medium text-slate-900">12%</td><td className="px-4 py-3 text-right text-slate-500">204</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Peptide</td><td className="px-4 py-3 text-right font-medium text-slate-900">10.5%</td><td className="px-4 py-3 text-right text-slate-500">20</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700">Gene therapy</td><td className="px-4 py-3 text-right font-medium text-slate-900">9%</td><td className="px-4 py-3 text-right text-slate-500">35</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700">Cell therapy</td><td className="px-4 py-3 text-right font-medium text-slate-900">9%</td><td className="px-4 py-3 text-right text-slate-500">29</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures deal benchmarks, 2,102 primary-sourced deals announced January 2017 to November 2026. Licenses that disclose a top royalty tier. Full table:{' '}<a href="https://ambrosiaventures.co/benchmarks/royalty-rates" className="underline hover:text-slate-600">royalty rates</a>.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Modality medians are not adjusted for stage mix, so compare within stage where you can. Cell and gene therapy licenses sit at the bottom of the royalty range, and some of these deals use profit-sharing or other structures in place of a conventional royalty. Antibodies, bispecifics and ADCs sit above small molecules.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Many licenses use tiered royalty structures, with rates escalating as annual net sales cross defined thresholds. For example, a hypothetical schedule might pay 12% on the first US$500M of annual net sales, 15% from US$500M to US$1B, and 18% above US$1B. Anti-stacking provisions and generic entry step-downs are common and should be factored into effective royalty rate projections.
            </p>

            {/* Section 4: Therapeutic Area Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="therapeutic-area">
              Deal Terms by Therapeutic Area
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Market size, competitive intensity, regulatory pathway complexity, and patient population all influence how deals are structured. We do not publish therapeutic-area medians on this page, but the qualitative patterns are consistent:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Oncology:</strong> Deals tend to be milestone-heavy, with large commercial milestone components tied to sales thresholds.</li>
              <li><strong>Neurology:</strong> Long development timelines and large clinical programs shape both upfronts and milestone schedules, with neurodegeneration and neuropsychiatry drawing renewed interest.</li>
              <li><strong>Immunology:</strong> A mature landscape with well-established comparables. Co-development and profit-split structures appear more often than in other areas.</li>
              <li><strong>Rare Disease:</strong> Orphan drug incentives, smaller trials, and clearer regulatory pathways can support a larger share of value paid at signing.</li>
            </ul>

            {/* Section 5: Deal Type Benchmarks */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="deal-type">
              Deal Terms by Deal Type
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The structure of a transaction fundamentally shapes how value is distributed between parties. The dataset covers licenses, options, collaborations and acquisitions:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Exclusive licensing:</strong> Upfront plus milestones plus royalties. Across licenses, options and collaborations, the median upfront is US$20M (1,208 deals; middle half US$5M to US$55M) and the median announced total value is US$357.8M (1,112 deals). Licensors retain downstream royalty economics but cede control of development and commercialization decisions.</li>
              <li><strong>Acquisition:</strong> A single payment for the asset or company, sometimes with CVRs. The dataset includes 421 acquisitions, with a median announced value of US$447.5M across the 338 that disclose a value.</li>
              <li><strong>Co-development:</strong> Shared investment and profit splits. Upfronts are typically lower in exchange for larger long-term economics for the originator. Most common where development costs are high and both parties bring complementary capabilities.</li>
              <li><strong>Option deals:</strong> An upfront option fee plus an exercise fee, usually triggered by a data readout. Across 167 option deals, the median option upfront is US$16M (123 deals), the median share of announced value paid at signing is 4.8%, and the median disclosed exercise fee is US$10M (46 deals). The median top royalty tier is 12%, in line with licenses overall.</li>
              <li><strong>Collaboration:</strong> Broad strategic partnerships covering multiple programs or platform access, often with research funding alongside conventional deal economics. Their figures are included in the license, option and collaboration medians above.</li>
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
              Market Trends (2017 to 2026)
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Deal terms are not static. Macro conditions, competitive dynamics, and modality trends all drive structural shifts in how biopharma transactions are priced. Key trends in the data:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Upfronts rose in 2026:</strong> In Q3 2026 the median license upfront was US$45M, against US$12M in Q3 2025. The quarter saw 151 deals (107 licenses and 44 acquisitions) with US$4.0B in disclosed upfronts, and Roche signed the most deals (9). A single quarter is a small sample, so treat it as a signal rather than a new baseline. Details in the{' '}<a href="https://ambrosiaventures.co/reports/2026-q3" className="text-teal-600 font-medium hover:text-teal-700">Q3 2026 deal report</a>.</li>
              <li><strong>China out-licensing:</strong> China-based licensors accounted for 6% of licenses in 2017 and 18.3% in 2025. Across 78 licenses from China-based licensors, the median upfront is US$75M, the median announced value is US$1.13B, and the median top royalty tier is 18.5% (20 deals), all above the overall license medians.</li>
              <li><strong>Options as a risk-sharing tool:</strong> Option deals pay a smaller share at signing (median 4.8%) than licenses overall (7.5%), letting licensees limit upfront exposure while securing access to early-stage innovation.</li>
              <li><strong>Most active licensees:</strong> Since 2017, Eli Lilly has been the most active licensee with 67 deals, followed by Roche (47), Novartis (43), AstraZeneca (37), and Merck &amp; Co. (34).</li>
              <li><strong>Milestone-heavy early deals:</strong> Total milestones run at a median 20x the upfront for preclinical deals, against 9.5x at Phase 2 and 4.7x for approved products. Early-stage licensors carry most of the risk through contingent payments.</li>
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
                  In the Ambrosia Ventures deal benchmarks (2,102 primary-sourced deals announced January 2017 to November 2026), the median upfront for a license, option or collaboration signed at Phase 2 is US$25M, with a middle half (25th to 75th percentile) of US$10M to US$81.2M across 136 deals that disclose an upfront. The median announced total value at Phase 2 is US$328M, and the median share of announced value paid at signing is 9.5%. Data quality, competition and strategic fit drive wide dispersion around the median. Use our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link> to get benchmarks specific to your asset.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How have biopharma licensing deal terms changed recently?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  In Q3 2026 the median license upfront was US$45M, against US$12M in Q3 2025, across 151 deals in the quarter (107 licenses and 44 acquisitions) with US$4.0B in disclosed upfronts. Over the longer run, China-based licensors grew from 6% of licenses in 2017 to 18.3% in 2025. Structures remain milestone-heavy: across all licenses, options and collaborations, the median share of announced value paid at signing is 7.5%. Details in the <a href="https://ambrosiaventures.co/reports/2026-q3" className="text-teal-600 hover:text-teal-700">Q3 2026 deal report</a>.
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
                  Across licenses that disclose royalty tiers, the median bottom tier is 5% (502 deals) and the median top tier is 12% (534 deals; middle half 9% to 19%). The median top tier rises with stage at signing: 9% preclinical, 12% Phase 1, 15% Phase 2, and 19% at Phase 3 and for approved products. By modality, antibodies have the highest median top tier at 15%, followed by bispecifics at 14% and ADCs at 13.5%; small molecules sit at 12%, and cell and gene therapies at 9%. See the <Link href="/methodology" className="text-teal-600 hover:text-teal-700">methodology page</Link> for full details.
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
                  Therapeutic area shapes deal terms through market size, competitive intensity, regulatory pathway and patient population. Oncology deals tend to carry large commercial milestone packages tied to sales thresholds. Rare disease deals benefit from orphan incentives and smaller trials. Neurology deals reflect long development timelines. Immunology and metabolic deals more often use co-development structures with shared risk. We do not publish therapeutic-area medians on this page; filter comparables by area in the calculator.
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
    </>
  );
}
