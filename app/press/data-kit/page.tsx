import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { InsightCTA } from '@/components/insights/InsightCTA';

const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));

export const metadata: Metadata = {
  title: 'Press Data Kit — Biopharma Deal Benchmarks | Ambrosia Ventures',
  description: 'Citation-ready statistics, embeddable charts, and brand assets for journalists and analysts covering biopharma deal economics.',
  openGraph: {
    title: 'Press Data Kit — Biopharma Deal Benchmarks',
    description: 'Citation-ready data, embeddable charts, and brand assets for journalists and analysts covering biopharma deal economics.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/press/data-kit',
    images: [{ url: '/api/og?title=Press%20Data%20Kit&subtitle=Citation-Ready%20Biopharma%20Deal%20Data&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Press Data Kit — Biopharma Deal Benchmarks',
    description: 'Citation-ready statistics, embeddable charts, and brand assets for journalists and analysts.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/press/data-kit',
  },
};

const stats = [
  {
    value: '2,600+',
    label: 'Verified Deals Analyzed',
    citation: 'Ambrosia Ventures has analyzed over 2,600 verified biopharma licensing and M&A transactions from 2020 to 2026. Source: Ambrosia Ventures Deal Intelligence Platform.',
  },
  {
    value: '$95M',
    label: 'Phase 2 Oncology Median Upfront',
    citation: 'Phase 2 oncology licensing deals average $95M upfront (median, 2020-2026). Source: Ambrosia Ventures.',
  },
  {
    value: '$1.1B',
    label: 'Phase 2 Oncology Median Total Deal Value',
    citation: 'Phase 2 oncology licensing deals have a median total deal value of $1.1 billion, including upfront, milestones, and royalties (2020-2026). Source: Ambrosia Ventures.',
  },
  {
    value: '1.50x',
    label: 'ADC Modality Premium Over Small Molecules',
    citation: 'Antibody-drug conjugate (ADC) licensing deals command a 1.50x premium over small molecule baselines across all phases (2020-2026). Source: Ambrosia Ventures.',
  },
  {
    value: '4:1',
    label: 'Immunology vs Oncology Phase 2 Upfront Ratio',
    citation: 'Immunology Phase 2 upfront payments ($120M median) now exceed oncology ($95M) by approximately 26%, reflecting a roughly 4:1 immunology-to-oncology upfront ratio when adjusted for deal volume (2024-2026). Source: Ambrosia Ventures.',
  },
  {
    value: '$150M',
    label: 'Phase 2 Metabolic/Obesity Median Upfront',
    citation: 'Phase 2 metabolic and obesity licensing deals command the highest median upfront of any therapeutic area at $150M (2020-2026). Source: Ambrosia Ventures.',
  },
  {
    value: '12',
    label: 'Therapeutic Areas Covered',
    citation: 'Ambrosia Ventures benchmarks cover 12 therapeutic areas including oncology, immunology, neurology, metabolic, cardiovascular, hematology, ophthalmology, infectious disease, rare disease, dermatology, gastroenterology, and women\'s health. Source: Ambrosia Ventures.',
  },
  {
    value: '850+',
    label: 'Company Profiles Tracked',
    citation: 'The platform tracks over 850 biopharma company profiles with pipeline, deal history, and partnership data updated weekly. Source: Ambrosia Ventures.',
  },
];

const embedCharts = [
  {
    title: 'Phase Upfront Staircase (Oncology)',
    type: 'phase-upfront',
    description: 'Median upfront payments across 7 development phases for oncology licensing deals.',
  },
  {
    title: 'Therapeutic Area Comparison (Phase 2 Upfronts)',
    type: 'ta-comparison',
    description: 'Side-by-side Phase 2 median upfronts across 12 therapeutic areas.',
  },
  {
    title: 'Modality Premiums',
    type: 'modality-premiums',
    description: 'Multiplier premiums by modality relative to small molecule baselines.',
  },
  {
    title: 'Territory Value Split',
    type: 'territory-split',
    description: 'Deal value distribution across global, US-only, ex-US, and regional licensing structures.',
  },
];

export default function PressDataKitPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Press', item: 'https://calculator.ambrosiaventures.co/press' },
      { '@type': 'ListItem', position: 3, name: 'Data Kit', item: 'https://calculator.ambrosiaventures.co/press/data-kit' },
    ],
  };

  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Ambrosia Ventures Biopharma Deal Benchmarks',
    description: 'Comprehensive benchmarks for biopharma licensing deal economics across 12 therapeutic areas, 7 development phases, and 8 modalities. Covers upfront payments, milestone structures, royalty rates, and total deal values from 2,600+ verified transactions (2020-2026).',
    creator: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    temporalCoverage: '2020/2026',
    variableMeasured: ['Upfront Payment', 'Total Deal Value', 'Royalty Rate', 'Milestone Structure'],
    keywords: ['biopharma', 'licensing deals', 'deal benchmarks', 'upfront payments', 'oncology deals'],
    license: 'https://calculator.ambrosiaventures.co/terms',
    url: 'https://calculator.ambrosiaventures.co/press/data-kit',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />

      {/* Header */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,165,0.08),transparent)]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <nav className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-8">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/press" className="hover:text-white transition-colors">Press</Link>
            <span>/</span>
            <span className="text-slate-200">Data Kit</span>
          </nav>

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full">
              Press Resources
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
            Press Data Kit
          </h1>

          <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Citation-ready data, embeddable charts, and brand assets for journalists and analysts
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Key Statistics */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Key Statistics</h2>
          <p className="text-slate-600 mb-8">
            Each statistic below includes a citation-ready sentence. Copy and use directly in articles, reports, or presentations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-3xl font-bold text-slate-900 tabular-nums">{stat.value}</span>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-3">{stat.label}</p>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 leading-relaxed italic">{stat.citation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Embeddable Charts */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Embeddable Charts</h2>
          <p className="text-slate-600 mb-8">
            Embed interactive charts directly into your publication. Each chart is responsive, auto-updates with new data, and links back to the full dataset.
          </p>

          <div className="space-y-8">
            {embedCharts.map((chart) => {
              const embedCode = `<iframe src="https://calculator.ambrosiaventures.co/api/embed/chart?type=${chart.type}&theme=light" width="100%" height="400" style="border:1px solid #e2e8f0;border-radius:12px;" title="${chart.title}" loading="lazy"></iframe>`;
              return (
                <div key={chart.type} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900 mb-1">{chart.title}</h3>
                    <p className="text-sm text-slate-500">{chart.description}</p>
                  </div>

                  <div className="p-5 bg-slate-50">
                    <iframe
                      src={`/api/embed/chart?type=${chart.type}&theme=light`}
                      width="100%"
                      height="400"
                      style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}
                      title={chart.title}
                      loading="lazy"
                    />
                  </div>

                  <div className="p-5 border-t border-slate-100">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Embed Code</p>
                    <pre className="bg-slate-900 text-slate-300 text-xs p-4 rounded-lg overflow-x-auto">
                      <code>{embedCode}</code>
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Methodology */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Methodology</h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed mb-4">
              All benchmarks are derived from a proprietary database of 2,600+ verified biopharma licensing and M&amp;A
              transactions executed between 2020 and 2026. Primary sources include SEC filings (8-K, 10-K, 10-Q), company
              press releases, investor presentations, and regulatory databases. Every deal record includes upfront payment,
              milestone structure, royalty terms, development phase, therapeutic area, modality, and territory scope.
            </p>
            <p className="text-slate-700 leading-relaxed mb-4">
              Deal values are reported as median figures to minimize distortion from mega-deals. Modality premiums are
              calculated as multipliers relative to small molecule baselines at matched phases and therapeutic areas. New
              transactions are ingested weekly via automated SEC EDGAR monitoring and manual verification. For full
              methodology details, data sourcing criteria, and statistical methods, see the{' '}
              <Link href="/methodology" className="text-teal-700 underline hover:text-teal-900 font-medium">
                complete methodology page
              </Link>.
            </p>
          </div>
        </section>

        {/* Brand Assets */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Brand Assets</h2>
          <p className="text-slate-600 mb-8">
            Use these assets when referencing Ambrosia Ventures in publications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {/* Logo */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Logo</h3>
              <div className="bg-slate-50 rounded-lg p-6 flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">AV</span>
                </div>
              </div>
              <Link href="/logo.png" className="text-sm text-teal-700 underline hover:text-teal-900">
                Download PNG
              </Link>
            </div>

            {/* Colors */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Brand Colors</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0EA5A5]" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Teal</p>
                    <p className="text-xs text-slate-500 font-mono">#0EA5A5</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#141831]" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Navy</p>
                    <p className="text-xs text-slate-500 font-mono">#141831</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Slate</p>
                    <p className="text-xs text-slate-500 font-mono">#64748B</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Usage Guidelines</h3>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">&#10003;</span>
                  <span>Use &quot;Ambrosia Ventures&quot; in full</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">&#10003;</span>
                  <span>Link to calculator.ambrosiaventures.co</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">&#10003;</span>
                  <span>Cite source when quoting data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">&#10007;</span>
                  <span>Do not alter logo colors</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Boilerplate Copy */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Boilerplate Copy</h3>

            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">50-Word Version</p>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Ambrosia Ventures provides data-driven deal intelligence for biopharma licensing professionals. The
                    platform analyzes 2,600+ verified transactions across 12 therapeutic areas, offering real-time
                    benchmarks for upfront payments, milestones, and royalties. Used by BD teams, investors, and
                    consultants to benchmark and structure biopharma partnerships.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">100-Word Version</p>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Ambrosia Ventures is a life sciences deal intelligence platform that helps biotech founders, BD teams,
                    investors, and consultants benchmark and structure biopharma licensing deals. Drawing from 2,600+
                    verified transactions across 12 therapeutic areas, the platform provides real-time benchmarks for
                    upfront payments, milestone structures, royalty rates, and total deal values. Features include
                    comparable transaction analysis, risk-adjusted NPV modeling, Monte Carlo simulation, partner matching,
                    and AI-generated negotiation playbooks. The platform tracks 850+ company profiles and ingests new deal
                    data weekly from SEC filings, press releases, and regulatory databases.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Press Contact */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-slate-50 to-teal-50 border border-teal-200 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-3">Press Contact</h2>
            <p className="text-slate-700 mb-4">
              For data requests, expert commentary, or partnership inquiries:
            </p>
            <a
              href="mailto:press@ambrosiaventures.co"
              className="inline-flex items-center gap-2 text-lg font-semibold text-teal-700 hover:text-teal-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              press@ambrosiaventures.co
            </a>
            <p className="text-sm text-slate-500 mt-3">We respond within 4 hours.</p>
          </div>
        </section>

        {/* CTA */}
        <InsightCTA variant="bottom" />
      </main>

      <SiteFooter />
    </>
  );
}
