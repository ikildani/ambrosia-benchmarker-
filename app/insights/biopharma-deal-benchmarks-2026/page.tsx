import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

export const metadata: Metadata = {
  title: 'Biopharma Deal Benchmarks 2026: 3 Data Insights from 3,447 Deals | Ambrosia Ventures',
  description: 'Analysis of 3,447 biopharma licensing deals reveals the Phase 2 upfront inflection, immunology\'s 4x oncology premium, and ADC deal normalization. Free data report.',
  keywords: [
    'biopharma deal benchmarks 2026',
    'biotech licensing data',
    'phase 2 upfront payment',
    'immunology deal premium',
    'ADC licensing deals',
    'biopharma deal intelligence',
  ],
  openGraph: {
    title: '3 Data Insights from 3,447 Biopharma Deals (2020-2026)',
    description: 'The Phase 2 inflection, immunology\'s hidden premium, and ADC normalization — backed by real deal data.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/insights/biopharma-deal-benchmarks-2026',
    images: [{ url: '/api/og?title=3%20Deal%20Insights%20from%203%2C447%20Transactions&subtitle=Biopharma%20Benchmarks%202026&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '3 Data Insights from 3,447 Biopharma Deals',
    description: 'Phase 2 upfronts jump 2.1x. Immunology beats oncology 4:1. ADCs normalize post-2023.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/biopharma-deal-benchmarks-2026',
  },
};

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 text-center">
      <div className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className={`py-3 px-4 font-semibold text-slate-700 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className={`py-3 px-4 ${j === 0 ? 'text-left font-medium text-slate-800' : 'text-right text-slate-600 tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DealInsightsReport() {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '3 Data-Backed Insights from 3,447 Biopharma Deals (2020-2026)',
    description: 'Analysis of biopharma licensing deal economics across phase, therapeutic area, and modality.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-03-23',
    mainEntityOfPage: 'https://calculator.ambrosiaventures.co/insights/biopharma-deal-benchmarks-2026',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)]" />
          <div className="relative max-w-3xl mx-auto text-center">
            <nav className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-8">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/insights" className="hover:text-white transition-colors">Insights</Link>
              <span>/</span>
              <span className="text-slate-200">Deal Benchmarks 2026</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Data Report
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              3 Data-Backed Insights from{' '}
              <span className="text-blue-400">3,447</span> Biopharma Deals
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              What the largest analysis of biopharma licensing economics reveals about phase premiums, therapeutic area pricing, and modality trends.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">3,447</div>
                <div className="text-xs text-slate-400">Deals analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">12</div>
                <div className="text-xs text-slate-400">Therapeutic areas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">2020-26</div>
                <div className="text-xs text-slate-400">Time period</div>
              </div>
            </div>
          </div>
        </header>

        {/* Insight 1 */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">1</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              The Phase 2 Inflection Point
            </h2>
          </div>

          <p className="text-lg text-slate-600 leading-relaxed mb-4">
            Phase 2 proof-of-concept is the single most valuable inflection point in biopharma deal economics. The Phase 1 to Phase 2 jump delivers a <strong className="text-slate-900">2.1x increase in median upfront</strong> — the largest single-phase multiplier in the entire development lifecycle.
          </p>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Phase at Signing', 'Median Upfront', 'Median TDV', 'Upfront % of TDV', 'n']}
              rows={[
                ['Preclinical', '$82M', '$888M', '9.7%', '420'],
                ['Phase 1', '$140M', '$1,209M', '11.1%', '350'],
                [<strong key="p2" className="text-blue-700">Phase 2</strong>, <strong key="p2v">$300M</strong>, <strong key="p2t">$1,801M</strong>, <strong key="p2p">14.2%</strong>, '426'],
                ['Phase 3', '$678M', '$3,500M', '16.8%', '345'],
                ['Approved', '$1,964M', '$6,750M', '26.5%', '364'],
              ]}
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">Implication for BD teams</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              If you&apos;re negotiating a Phase 1 out-license and the asset has near-term Phase 2 data, a 6-12 month delay could unlock &gt;$150M in additional upfront value. The risk premium compresses sharply at proof-of-concept.
            </p>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-slate-200" />

        {/* Insight 2 */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">2</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Immunology Commands 4x the Oncology Upfront at Phase 2
            </h2>
          </div>

          <p className="text-lg text-slate-600 leading-relaxed mb-4">
            The conventional wisdom that oncology commands the highest deal premiums is wrong — at least at Phase 2. Immunology and metabolic deals are being repriced in real-time by TL1A antibodies, oral GLP-1s, and validated $10B+ commercial models.
          </p>

          <div className="my-8 grid sm:grid-cols-2 gap-4">
            <StatCard value="$1,250M" label="Immunology Phase 2 Upfront" sub="Median, n=29" />
            <StatCard value="$281M" label="Oncology Phase 2 Upfront" sub="Median, n=255" />
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Therapeutic Area', 'Phase 2 Upfront', 'Phase 3 Upfront', 'Ph2 → Ph3 Multiple']}
              rows={[
                [<strong key="met" className="text-blue-700">Metabolic</strong>, '$1,300M', '$4,500M', '3.5x'],
                [<strong key="imm" className="text-blue-700">Immunology</strong>, '$1,250M', '$3,200M', '2.6x'],
                ['Neurology', '$302M', '$838M', '2.8x'],
                ['Oncology', '$281M', '$714M', '2.5x'],
              ]}
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">Why this matters</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              If your pipeline spans multiple TAs, your deal timing strategy should account for these TA-specific premiums. A Phase 2 immunology asset may out-value a Phase 3 oncology asset on upfront alone.
            </p>
          </div>
        </section>

        <hr className="max-w-3xl mx-auto border-slate-200" />

        {/* Insight 3 */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">3</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              ADC Deals Peaked at $372B in 2023 — Then Normalized
            </h2>
          </div>

          <p className="text-lg text-slate-600 leading-relaxed mb-4">
            2023 was a once-in-a-generation moment for ADC deal-making, driven by the $43B Pfizer-Seagen acquisition. Deal volume continues to grow, but the era of platform-level mega-deals has given way to focused single-asset licensing.
          </p>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Year', 'ADC Deals', 'Median TDV', 'Total Value']}
              rows={[
                ['2019', '17', '$1,339M', '$46.2B'],
                ['2020', '20', '$2,663M', '$136.8B'],
                ['2021', '18', '$1,686M', '$76.8B'],
                ['2022', '25', '$3,302M', '$105.1B'],
                [<strong key="23" className="text-blue-700">2023</strong>, <strong key="23n">32</strong>, <strong key="23t">$5,932M</strong>, <strong key="23v">$371.8B</strong>],
                ['2024', '35', '$1,824M', '$104.4B'],
                ['2025*', '17', '$1,598M', '$36.7B'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">*2025 data through Q3</p>
          </div>

          <p className="text-slate-600 leading-relaxed mb-4">
            Despite normalization, ADCs remain the highest-valued modality on upfront:
          </p>

          <div className="my-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value="$361M" label="ADC" />
            <StatCard value="$281M" label="Bispecific" />
            <StatCard value="$156M" label="mRNA" />
            <StatCard value="$100M" label="Gene Therapy" />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">For ADC licensors</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              The market has shifted from &quot;acquire the platform&quot; to &quot;license the best asset.&quot; Focus positioning on target differentiation, payload novelty, and Phase 2 data quality — that&apos;s where the upfront premium lives now.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Run Your Own Deal Benchmark
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              Model upfronts, milestones, and royalties for any phase, modality, and therapeutic area — powered by 3,447 real transactions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/calculator"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors shadow-lg w-full sm:w-auto"
              >
                Open the Calculator — Free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link
                href="/benchmarks"
                className="inline-flex items-center justify-center px-8 py-4 border border-slate-600 text-slate-300 font-medium rounded-xl hover:border-slate-400 hover:text-white transition-colors w-full sm:w-auto"
              >
                Browse All Benchmarks
              </Link>
            </div>
            <p className="text-sm text-slate-500 mt-6">
              Data updated daily from SEC filings, press releases, and verified sources.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
