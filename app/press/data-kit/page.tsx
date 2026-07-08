import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { InsightCTA } from '@/components/insights/InsightCTA';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Press Data Kit — Biopharma Deal Benchmarks | Ambrosia Ventures',
  description: 'Citation-ready statistics, embeddable charts, and brand assets for journalists and analysts covering biopharma deal economics.',
  openGraph: {
    title: 'Press Data Kit — Biopharma Deal Benchmarks',
    description: 'Citation-ready data, embeddable charts, and brand assets for journalists and analysts.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/press/data-kit',
    images: [{ url: '/api/og?title=Press%20Data%20Kit&subtitle=Citation-Ready%20Biopharma%20Deal%20Data&type=insight', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'Press Data Kit — Biopharma Deal Benchmarks' },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/press/data-kit' },
};

const stats = [
  { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals Analyzed', citation: `Ambrosia Ventures has analyzed over ${DEAL_STATS.TOTAL_DEALS_RAW.toLocaleString()} verified biopharma licensing and M&A transactions from 2020 to 2026. Source: Ambrosia Ventures Deal Intelligence Platform.` },
  { value: '$120M', label: 'Phase 2 Oncology Median Upfront', citation: 'Phase 2 oncology licensing deals average $120M upfront (median, 2020-2026). Source: Ambrosia Ventures.' },
  { value: '$350M', label: 'Phase 2 Immunology Median Upfront', citation: 'Phase 2 immunology licensing deals average $350M upfront — nearly 3x oncology (median, 2020-2026). Source: Ambrosia Ventures.' },
  { value: '1.60x', label: 'Radiopharmaceutical Modality Premium', citation: 'Radiopharmaceutical licensing deals command a 1.60x premium over small molecule baselines — the highest of any modality (2020-2026). Source: Ambrosia Ventures.' },
  { value: '1.45x', label: 'ADC Modality Premium', citation: 'Antibody-drug conjugate (ADC) licensing deals command a 1.45x premium over small molecule baselines, the second-highest modality premium (2020-2026). Source: Ambrosia Ventures.' },
  { value: '$255M', label: 'Phase 2 Metabolic/Obesity Median Upfront', citation: 'Phase 2 metabolic and obesity licensing deals command $255M median upfront with $1.7B total deal value (2020-2026). Source: Ambrosia Ventures.' },
  { value: '12', label: 'Therapeutic Areas Covered', citation: 'Ambrosia Ventures benchmarks cover 12 therapeutic areas: oncology, immunology, neurology, metabolic, cardiovascular, hematology, ophthalmology, infectious disease, rare disease, dermatology, gastroenterology, and women\'s health. Source: Ambrosia Ventures.' },
  { value: '850+', label: 'Company Profiles Tracked', citation: 'The platform tracks over 850 biopharma company profiles with pipeline, deal history, and partnership data updated weekly. Source: Ambrosia Ventures.' },
];

const embedCharts = [
  { title: 'Phase Upfront Staircase (Oncology)', type: 'phase-upfront', description: 'Median upfront payments across development phases for oncology licensing deals.' },
  { title: 'Therapeutic Area Comparison (Phase 2)', type: 'ta-comparison', description: 'Phase 2 median upfronts across 12 therapeutic areas.' },
  { title: 'Modality Premiums', type: 'modality-premium', description: 'Multiplier premiums by modality relative to small molecule baselines.' },
  { title: 'Territory Value Split', type: 'territory-split', description: 'Deal value distribution across global, US-only, ex-US, and regional structures.' },
];

export default function PressDataKitPage() {
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
    { '@type': 'ListItem', position: 2, name: 'Press', item: 'https://calculator.ambrosiaventures.co/press' },
    { '@type': 'ListItem', position: 3, name: 'Data Kit' },
  ]};

  const datasetSchema = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Ambrosia Ventures Biopharma Deal Benchmarks', description: `Benchmarks for biopharma licensing deal economics across 12 TAs from ${DEAL_STATS.TOTAL_DEALS} verified transactions (2020-2026).`, creator: { '@type': 'Organization', name: 'Ambrosia Ventures' }, temporalCoverage: '2020/2026' };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />

      {/* Masthead */}
      <div className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/"><AmbrosiaLogo variant="reversed" height={32} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/calculator" className="text-xs text-slate-400 hover:text-white transition-colors">Calculator</Link>
            <Link href="/press" className="text-xs text-slate-400 hover:text-white transition-colors">Press</Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <header className="bg-white border-b border-slate-200">
        <div className="h-[3px] bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600" />
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-14">
          <nav className="flex items-center gap-2 text-[11px] text-slate-400 mb-10 uppercase tracking-widest">
            <Link href="/" className="hover:text-slate-600">Home</Link>
            <span className="text-slate-300">/</span>
            <Link href="/press" className="hover:text-slate-600">Press</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Data Kit</span>
          </nav>
          <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-[0.25em] mb-6">Press Resources</p>
          <h1 className="text-4xl sm:text-[3.5rem] font-bold text-slate-900 leading-[1.05] tracking-tight mb-4">
            Press Data Kit
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
            Citation-ready statistics, embeddable charts, and brand assets for journalists and analysts covering biopharma deal economics.
          </p>
        </div>
      </header>

      <main className="bg-white">
        {/* Key Statistics */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Key Statistics</h2>
          <p className="text-slate-500 text-sm mb-8">
            Each statistic includes a citation-ready sentence. Copy and use directly in articles, reports, or presentations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {stats.map((stat, i) => (
              <div key={i} className="bg-white p-6">
                <div className="text-2xl font-bold text-slate-900 tabular-nums mb-1">{stat.value}</div>
                <p className="text-sm font-medium text-slate-700 mb-3">{stat.label}</p>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 leading-relaxed">{stat.citation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Embeddable Charts */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Embeddable Charts</h2>
            <p className="text-slate-500 text-sm mb-8">
              Embed interactive charts directly into your publication. Each chart is responsive, auto-updates with new data, and includes an attribution link.
            </p>

            <div className="space-y-8">
              {embedCharts.map((chart) => {
                const embedCode = `<iframe src="https://calculator.ambrosiaventures.co/api/embed/chart?type=${chart.type}&theme=light" width="100%" height="400" style="border:1px solid #e2e8f0;border-radius:12px;" title="${chart.title}" loading="lazy"></iframe>`;
                return (
                  <div key={chart.type} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-900 mb-1">{chart.title}</h3>
                      <p className="text-sm text-slate-500">{chart.description}</p>
                    </div>
                    <div className="p-5">
                      <iframe
                        src={`/api/embed/chart?type=${chart.type}&theme=light`}
                        width="100%"
                        height="400"
                        style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}
                        title={chart.title}
                        loading="lazy"
                      />
                    </div>
                    <div className="p-5 border-t border-slate-100 bg-slate-50">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Embed Code</p>
                      <pre className="bg-slate-900 text-slate-300 text-xs p-4 rounded-lg overflow-x-auto">
                        <code>{embedCode}</code>
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Methodology</h2>
          <p className="text-slate-700 leading-relaxed mb-4">
            All benchmarks are derived from a proprietary database of {DEAL_STATS.TOTAL_DEALS} verified biopharma licensing and M&amp;A
            transactions executed between 2020 and 2026. Primary sources include SEC filings (8-K, 10-K, 10-Q), FTC premerger filings, company
            press releases, investor presentations, and regulatory databases. Every deal record includes upfront payment,
            milestone structure, royalty terms, development phase, therapeutic area, modality, and territory scope.
          </p>
          <p className="text-slate-700 leading-relaxed">
            Deal values are reported as median figures to minimize distortion from mega-deals. Modality premiums are
            calculated as multipliers relative to small molecule baselines at matched phases and therapeutic areas. New
            transactions are ingested weekly via automated SEC EDGAR monitoring and manual verification. For full
            methodology details, see the{' '}
            <Link href="/methodology" className="text-teal-600 font-medium hover:text-teal-700">
              complete methodology page
            </Link>.
          </p>
        </section>

        {/* Brand Assets */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Brand Assets</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-200 rounded-lg overflow-hidden mb-10">
              <div className="bg-white p-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Logo</h3>
                <div className="bg-slate-50 rounded-lg p-6 flex items-center justify-center mb-3">
                  <AmbrosiaLogo variant="color" height={36} />
                </div>
                <div className="flex gap-3">
                  <Link href="/logo-color.png" className="text-xs text-teal-600 hover:text-teal-700">Color PNG</Link>
                  <Link href="/logo-white.png" className="text-xs text-teal-600 hover:text-teal-700">White PNG</Link>
                </div>
              </div>

              <div className="bg-white p-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Brand Colors</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#0EA5A5]" />
                    <div><p className="text-sm font-medium text-slate-800">Teal</p><p className="text-xs text-slate-400 font-mono">#0EA5A5</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#141831]" />
                    <div><p className="text-sm font-medium text-slate-800">Navy</p><p className="text-xs text-slate-400 font-mono">#141831</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-500" />
                    <div><p className="text-sm font-medium text-slate-800">Slate</p><p className="text-xs text-slate-400 font-mono">#64748B</p></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Usage</h3>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2"><span className="text-teal-600 mt-0.5">&#10003;</span><span>Use &quot;Ambrosia Ventures&quot; in full</span></li>
                  <li className="flex items-start gap-2"><span className="text-teal-600 mt-0.5">&#10003;</span><span>Link to calculator.ambrosiaventures.co</span></li>
                  <li className="flex items-start gap-2"><span className="text-teal-600 mt-0.5">&#10003;</span><span>Cite source when quoting data</span></li>
                  <li className="flex items-start gap-2"><span className="text-red-500 mt-0.5">&#10007;</span><span>Do not alter logo colors or proportions</span></li>
                </ul>
              </div>
            </div>

            {/* Boilerplate */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Boilerplate Copy</h3>
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">50-Word Version</p>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Ambrosia Ventures provides data-driven deal intelligence for biopharma licensing professionals. The platform analyzes 1,500+ verified transactions across 12 therapeutic areas, offering real-time benchmarks for upfront payments, milestones, and royalties. Used by BD teams, investors, and consultants to benchmark and structure biopharma partnerships.
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">100-Word Version</p>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Ambrosia Ventures is a life sciences deal intelligence platform that helps biotech founders, BD teams, investors, and consultants benchmark and structure biopharma licensing deals. Drawing from 1,500+ verified transactions across 12 therapeutic areas, the platform provides real-time benchmarks for upfront payments, milestone structures, royalty rates, and total deal values. Features include comparable transaction analysis, risk-adjusted NPV modeling, Monte Carlo simulation, partner matching, and AI-generated negotiation playbooks. The platform tracks 850+ company profiles and ingests new deal data weekly from SEC filings, FTC premerger filings, press releases, and regulatory databases.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="border border-slate-200 rounded-lg p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-3">Press Contact</h2>
            <p className="text-slate-600 mb-4">
              For data requests, expert commentary, or partnership inquiries:
            </p>
            <a
              href="mailto:info@ambrosiaventures.co"
              className="inline-flex items-center gap-2 text-lg font-semibold text-teal-700 hover:text-teal-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              info@ambrosiaventures.co
            </a>
            <p className="text-sm text-slate-400 mt-3">We respond within 4 hours.</p>
          </div>
        </section>

        <InsightCTA variant="bottom" />
      </main>

      <SiteFooter />
    </>
  );
}
