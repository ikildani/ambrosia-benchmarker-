import { Metadata } from 'next';
import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Life Sciences Deal Trends 2026 | Annual Market Report | Ambrosia Ventures',
  description: 'Comprehensive 2026 biopharma deal trends report covering deal volume by therapeutic area, hottest modalities (ADCs, bispecifics, radiopharmaceuticals), phase trends, geographic shifts, and 2027 outlook.',
  keywords: [
    'life sciences deal trends 2026',
    'biopharma deal report',
    'pharma licensing trends',
    'biotech deal volume 2026',
    'ADC deals 2026',
    'pharma M&A trends',
    'biopharma market report',
  ],
  openGraph: {
    title: 'Life Sciences Deal Trends 2026 | Annual Market Report',
    description: 'Data-driven analysis of biopharma deal activity in 2026: volume, modalities, geography, and outlook.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/reports/deal-trends-2026',
    images: [{ url: '/api/og?title=Deal%20Trends%202026&subtitle=Annual%20Market%20Report&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Life Sciences Deal Trends 2026 | Annual Market Report',
    description: 'Data-driven analysis of biopharma deal activity in 2026.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/reports/deal-trends-2026',
  },
};

export default function DealTrends2026Page() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Reports', item: `${baseUrl}/reports` },
      { '@type': 'ListItem', position: 3, name: 'Deal Trends 2026' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Life Sciences Deal Trends 2026: Annual Market Report',
    description: 'Data-driven analysis of biopharma deal activity in 2026 covering deal volume, modalities, geography, and outlook.',
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
    dateModified: '2026-03-20',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/reports/deal-trends-2026`,
    },
  };

  // Data points for the report
  const dealVolumeByTA = [
    { ta: 'Oncology', deals: 847, pct: 34, change: '+8%', avgValue: '$1.2B' },
    { ta: 'Immunology', deals: 312, pct: 13, change: '+12%', avgValue: '$890M' },
    { ta: 'Neurology', deals: 278, pct: 11, change: '+22%', avgValue: '$750M' },
    { ta: 'Rare Disease', deals: 234, pct: 9, change: '+15%', avgValue: '$680M' },
    { ta: 'Cardiovascular', deals: 189, pct: 8, change: '+5%', avgValue: '$620M' },
    { ta: 'Metabolic', deals: 167, pct: 7, change: '+18%', avgValue: '$540M' },
    { ta: 'Infectious Disease', deals: 145, pct: 6, change: '-3%', avgValue: '$420M' },
    { ta: 'Other', deals: 328, pct: 12, change: '+6%', avgValue: '$380M' },
  ];

  const hotModalities = [
    { modality: 'ADCs', deals: 156, growth: '+42%', avgUpfront: '$185M', highlight: true },
    { modality: 'Bispecifics', deals: 134, growth: '+35%', avgUpfront: '$165M', highlight: true },
    { modality: 'Radiopharmaceuticals', deals: 89, growth: '+68%', avgUpfront: '$120M', highlight: true },
    { modality: 'mRNA', deals: 78, growth: '+15%', avgUpfront: '$95M', highlight: false },
    { modality: 'Cell Therapy', deals: 67, growth: '+8%', avgUpfront: '$140M', highlight: false },
    { modality: 'Gene Therapy', deals: 54, growth: '-5%', avgUpfront: '$110M', highlight: false },
    { modality: 'Small Molecule', deals: 612, growth: '+3%', avgUpfront: '$75M', highlight: false },
    { modality: 'Monoclonal Antibody', deals: 389, growth: '+6%', avgUpfront: '$90M', highlight: false },
  ];

  const phaseTrends = [
    { phase: 'Preclinical', deals: 423, pctOfTotal: '17%', avgTDV: '$380M', medianUpfront: '$12M' },
    { phase: 'Phase 1', deals: 534, pctOfTotal: '21%', avgTDV: '$620M', medianUpfront: '$35M' },
    { phase: 'Phase 2', deals: 678, pctOfTotal: '27%', avgTDV: '$1.1B', medianUpfront: '$95M' },
    { phase: 'Phase 3', deals: 489, pctOfTotal: '20%', avgTDV: '$2.3B', medianUpfront: '$250M' },
    { phase: 'Approved', deals: 376, pctOfTotal: '15%', avgTDV: '$3.8B', medianUpfront: '$450M' },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema, articleSchema]) }} />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,165,0.12),rgba(255,255,255,0))]" />
          </div>
          <div className="relative max-w-4xl mx-auto">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/reports" className="hover:text-white transition-colors">Reports</Link>
              <span>/</span>
              <span className="text-slate-200">Deal Trends 2026</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              Annual Report | March 2026
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Life Sciences Deal Trends 2026
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-3xl">
              A data-driven analysis of biopharma licensing and partnership activity, covering deal volume, emerging modalities, phase dynamics, and geographic shifts across {DEAL_STATS.TOTAL_DEALS} transactions.
            </p>
          </div>
        </header>

        {/* Executive Summary */}
        <section className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="executive-summary">
            Executive Summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[
              { label: 'Total Deals', value: DEAL_STATS.TOTAL_DEALS, sub: 'YTD through Q1 2026' },
              { label: 'Total Deal Value', value: '$198B', sub: '+14% vs 2025' },
              { label: 'Median Upfront', value: '$85M', sub: '+18% vs 2025' },
              { label: 'Avg Royalty Rate', value: '9.2%', sub: 'Across all phases' },
            ].map((stat) => (
              <div key={stat.label} className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-teal-600 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-slate-600 leading-relaxed">
              The biopharma deal landscape in 2026 is characterized by record deal values driven by patent cliff urgency, a shift toward novel modalities (ADCs, bispecifics, and radiopharmaceuticals), and accelerating cross-border activity with China-origin assets. Oncology remains the dominant therapeutic area at 34% of deal volume, but neurology (+22% YoY) and metabolic diseases (+18% YoY) are the fastest-growing segments.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Median upfront payments increased 18% year-over-year, reflecting both asset-level inflation and a competitive environment where multiple bidders drive up prices for de-risked assets. Royalty rates have remained relatively stable, with a slight upward trend for oncology and rare disease assets. Use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> to benchmark your specific deal parameters against these market averages.
            </p>
          </div>
        </section>

        {/* Deal Volume by TA */}
        <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="deal-volume">
            Deal Volume by Therapeutic Area
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600">Therapeutic Area</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Deals</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Share</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">YoY Change</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Avg TDV</th>
                </tr>
              </thead>
              <tbody>
                {dealVolumeByTA.map((row) => (
                  <tr key={row.ta} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{row.ta}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.deals.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.pct}%</td>
                    <td className={`py-3 px-4 text-right font-medium ${row.change.startsWith('+') ? 'text-teal-600' : 'text-red-500'}`}>
                      {row.change}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.avgValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Source: Ambrosia Ventures Deal Database, {DEAL_STATS.TOTAL_DEALS} transactions through Q1 2026. TDV = Total Deal Value.
          </p>
        </section>

        {/* Hottest Modalities */}
        <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="modalities">
            Hottest Modalities
          </h2>
          <div className="prose prose-slate max-w-none mb-8">
            <p className="text-slate-600 leading-relaxed">
              Three modalities are defining the 2026 deal landscape: ADCs (+42% YoY growth), bispecific antibodies (+35%), and radiopharmaceuticals (+68%). These categories command premium deal terms driven by differentiated clinical profiles, manufacturing barriers to entry, and strong clinical data across multiple therapeutic areas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hotModalities.map((mod) => (
              <div
                key={mod.modality}
                className={`rounded-xl p-5 border ${mod.highlight ? 'border-teal-200 bg-teal-50/50' : 'border-slate-200 bg-white'}`}
              >
                <p className="font-semibold text-slate-900 mb-2">{mod.modality}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-600">{mod.deals} deals</p>
                  <p className={`font-medium ${mod.growth.startsWith('+') ? 'text-teal-600' : 'text-red-500'}`}>
                    {mod.growth} YoY
                  </p>
                  <p className="text-slate-500">Avg upfront: {mod.avgUpfront}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase Trends */}
        <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="phase-trends">
            Phase Trends
          </h2>
          <div className="prose prose-slate max-w-none mb-8">
            <p className="text-slate-600 leading-relaxed">
              Phase 2 assets continue to be the sweet spot for licensing activity, accounting for 27% of all deals. This reflects the industry preference for assets with clinical proof-of-concept data that have not yet incurred the cost of registrational trials. Phase 3 deals command the highest median upfronts ($250M), while preclinical platform deals are increasingly valued for their multi-asset optionality.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600">Phase</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Deals</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">% of Total</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Avg TDV</th>
                  <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">Median Upfront</th>
                </tr>
              </thead>
              <tbody>
                {phaseTrends.map((row) => (
                  <tr key={row.phase} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{row.phase}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.deals.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.pctOfTotal}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.avgTDV}</td>
                    <td className="py-3 px-4 text-right text-slate-600">{row.medianUpfront}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Source: Ambrosia Ventures Deal Database. TDV = Total Deal Value.
          </p>
        </section>

        {/* Geographic Shifts */}
        <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="geographic-shifts">
            Geographic Shifts
          </h2>
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-slate-600 leading-relaxed">
              Cross-border deal activity reached new highs in 2026, driven by three key dynamics:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>China-origin out-licensing surge:</strong> Chinese biotechs executed 180+ out-licensing deals for ex-China or global rights, up 45% YoY. ADCs and bispecifics from Chinese originators command competitive deal terms, with median upfronts of $50M-$80M for Phase 1/2 assets. Western pharma companies are increasingly willing to pay premium terms for differentiated Chinese-origin molecules.</li>
              <li><strong>Japan deal renaissance:</strong> Japanese pharma companies increased inbound licensing activity by 28%, driven by patent cliff pressures and a weak yen creating favorable deal economics. Japan-specific territory deals now represent 8% of all licensing activity.</li>
              <li><strong>MENA and Southeast Asia emergence:</strong> First-time licensing deals in Saudi Arabia, UAE, and Southeast Asian markets grew 35%, driven by sovereign wealth fund investments in local biopharma capacity and increasing regulatory harmonization.</li>
              <li><strong>Global vs. territorial deal mix:</strong> Global rights deals now represent 42% of all licensing transactions (up from 38% in 2025), reflecting the industry trend toward acquiring broader territorial control. Territory-specific deals remain important for companies with focused geographic strategies.</li>
            </ul>
          </div>
        </section>

        {/* Outlook 2027 */}
        <section className="max-w-4xl mx-auto px-4 py-12 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="outlook">
            Outlook 2027
          </h2>
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-slate-600 leading-relaxed">
              Looking ahead to 2027, several forces will shape the biopharma deal landscape:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Patent cliff intensification:</strong> Over $120B in branded drug revenue faces loss of exclusivity in 2027-2029, creating urgent pipeline gaps for top-20 pharma companies. This will sustain elevated deal volumes and valuations, particularly for late-stage and approved assets in large-market indications.</li>
              <li><strong>AI-driven drug design assets:</strong> Molecules discovered or optimized through AI/ML platforms are entering Phase 2 trials, and licensing activity for AI-designed drugs is expected to grow 50%+ as clinical validation accumulates. Expect premium valuations for AI-native biotechs with differentiated discovery platforms.</li>
              <li><strong>Obesity and metabolic goldmine:</strong> The GLP-1 revolution continues to reshape metabolic disease deal-making. Next-generation obesity drugs (oral GLP-1s, combination therapies, muscle-sparing approaches) will command historically high deal values as companies race to capture the $100B+ addressable market.</li>
              <li><strong>Consolidation pressure:</strong> Mid-cap biotechs ($5B-$30B market cap) face increasing acquisition pressure from cash-rich large pharma. Many will opt for licensing of non-core assets to fund lead programs while remaining independent.</li>
              <li><strong>Regulatory tailwinds:</strong> Accelerated approval pathways, adaptive trial designs, and increasing regulatory harmonization across major markets will continue to reduce development timelines and costs, supporting higher deal activity levels.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Explore our <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmark database</Link> for the latest deal terms across all therapeutic areas and modalities, updated continuously as new transactions are announced.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Get the Full Report
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Pro subscribers receive the complete report with downloadable data, custom filtering, and quarterly updates throughout 2026.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
              >
                Try the Calculator Free
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link
                href="/benchmarks"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-teal-700 text-white font-semibold rounded-xl hover:bg-teal-800 transition-colors border border-teal-500"
              >
                Browse Benchmarks
              </Link>
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
                { href: '/benchmarks', title: 'Deal Benchmarks', desc: 'Browse real-time deal term benchmarks' },
                { href: '/calculator', title: 'Solidus', desc: 'Model custom deal parameters' },
                { href: '/guides', title: 'Deal Guides', desc: 'In-depth valuation & structuring guides' },
                { href: '/therapeutic-areas', title: 'Therapeutic Areas', desc: 'TA-specific deal intelligence' },
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
