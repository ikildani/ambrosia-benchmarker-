import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { TrustBar } from '@/components/insights/TrustBar';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';

const PhaseUpfrontChart = dynamic(() => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));

export const metadata: Metadata = {
  title: 'Q1 2026 Biopharma Deal Benchmarks Report: Trends from 2,600+ Transactions | Ambrosia Ventures',
  description: 'Quarterly analysis of biopharma licensing deal economics across 12 therapeutic areas. Phase-by-phase benchmarks, modality premiums, territory dynamics, and real deal highlights.',
  keywords: ['biopharma deal benchmarks 2026', 'licensing deal report', 'pharma deal economics Q1 2026', 'biopharma licensing benchmarks', 'oncology deal benchmarks', 'metabolic deal benchmarks', 'modality premiums biopharma', 'territory licensing dynamics'],
  openGraph: {
    title: 'Q1 2026 Biopharma Deal Benchmarks Report',
    description: 'Quarterly analysis of biopharma licensing deal economics across 12 therapeutic areas from 2,600+ verified transactions.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks',
    images: [{ url: '/api/og?title=Q1%202026%20Biopharma%20Deal%20Benchmarks&subtitle=Trends%20from%202%2C600%2B%20Transactions&type=insight', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'Q1 2026 Biopharma Deal Benchmarks: Trends from 2,600+ Transactions', description: 'Metabolic surpasses oncology, immunology premiums widen, and radiopharmaceuticals lead modality multipliers.' },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks' },
};

export default function Q1BenchmarkReportPage() {
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
    { '@type': 'ListItem', position: 2, name: 'Reports', item: 'https://calculator.ambrosiaventures.co/reports' },
    { '@type': 'ListItem', position: 3, name: 'Q1 2026 Biopharma Deal Benchmarks' },
  ]};
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Q1 2026 Biopharma Deal Benchmarks Report', author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' }, datePublished: '2026-03-25', dateModified: '2026-03-25', publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } } };
  const datasetSchema = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Q1 2026 Biopharma Deal Benchmarks', description: 'Phase-by-phase upfront payments, total deal values, royalty ranges from 2,600+ verified biopharma transactions.', creator: { '@type': 'Organization', name: 'Ambrosia Ventures' }, temporalCoverage: '2020/2026' };
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'What data sources does the Q1 2026 benchmark report use?', acceptedAnswer: { '@type': 'Answer', text: 'The report draws from 2,600+ verified biopharma licensing and M&A transactions (2020-2026). Sources include SEC filings (8-K, 10-K, 10-Q), press releases, and regulatory databases. Updated weekly.' } },
    { '@type': 'Question', name: 'Why did metabolic/obesity deals surpass oncology?', acceptedAnswer: { '@type': 'Answer', text: 'Metabolic Phase 2 TDV reached $2.0B vs oncology\'s $1.1B, driven by GLP-1 commercial validation and a projected $100B+ annual market by 2030.' } },
    { '@type': 'Question', name: 'What is the largest modality premium in biopharma?', acceptedAnswer: { '@type': 'Answer', text: 'Radiopharmaceuticals at 1.60x over small molecules, reflecting Novartis Pluvicto validation and supply-constrained bidding for platform companies.' } },
  ]};

  return (
    <>
      <ScrollProgress />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── MASTHEAD ── */}
      <div className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <AmbrosiaLogo variant="reversed" height={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/calculator" className="text-xs text-slate-400 hover:text-white transition-colors">Calculator</Link>
            <Link href="/benchmarks" className="text-xs text-slate-400 hover:text-white transition-colors">Benchmarks</Link>
          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="h-[3px] bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600" />
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-14">
          <nav className="flex items-center gap-2 text-[11px] text-slate-400 mb-10 uppercase tracking-widest">
            <Link href="/" className="hover:text-slate-600">Home</Link>
            <span className="text-slate-300">/</span>
            <Link href="/reports" className="hover:text-slate-600">Reports</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Q1 2026</span>
          </nav>

          <div className="flex items-start gap-5 mb-3">
            <div className="hidden sm:block w-px h-16 bg-teal-500 mt-1" />
            <div>
              <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-[0.25em] mb-2">Quarterly Report · March 2026</p>
              <h1 className="text-4xl sm:text-[3.25rem] font-bold text-slate-900 leading-[1.1] tracking-tight">
                Biopharma Deal Benchmarks
              </h1>
            </div>
          </div>

          <p className="text-lg text-slate-500 max-w-2xl leading-relaxed mt-6 mb-10">
            A quarterly analysis of biopharma licensing economics across 12 therapeutic areas, drawn from 2,600+ verified transactions. Published by Ambrosia Ventures.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 rounded-lg overflow-hidden mb-10">
            {[
              { value: '2,600+', label: 'Verified Transactions' },
              { value: '$2.0B', label: 'Metabolic Ph2 TDV' },
              { value: '1.60x', label: 'Radiopharm Premium' },
              { value: '12', label: 'Therapeutic Areas' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-5 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">{stat.value}</div>
                <div className="text-[11px] text-slate-400 mt-1.5 uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400 uppercase tracking-wide">
            <span>Published March 25, 2026</span>
            <span className="text-slate-300">|</span>
            <span>Ambrosia Ventures Research</span>
            <span className="text-slate-300">|</span>
            <span>Data current through March 2026</span>
          </div>
        </div>
      </header>

      {/* ── EXECUTIVE SUMMARY ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-6">Executive Summary</h2>
          <div className="space-y-5">
            {[
              { num: 1, bold: 'Metabolic surpasses oncology.', text: 'Phase 2 metabolic/obesity total deal values ($2.0B median) now exceed oncology ($1.1B) for the first time, driven by validated GLP-1 commercial potential and a projected $100B+ annual market by 2030.' },
              { num: 2, bold: 'Immunology premiums widen.', text: 'Phase 2 immunology upfronts ($120M) exceed oncology ($95M) by 26%, fueled by the anti-TL1A validation from Merck\'s $10.8B Prometheus acquisition and the expanding CAR-T autoimmune pipeline.' },
              { num: 3, bold: 'ADC normalization complete.', text: 'ADC deal values corrected from 2023 peaks (Pfizer/Seagen at $43B created temporary distortion) but remain the second-highest modality at 1.50x premium, behind radiopharmaceuticals.' },
              { num: 4, bold: 'Radiopharmaceuticals lead.', text: 'At 1.60x over small molecule baselines, radiopharmaceuticals command the largest single-modality premium — driven by Pluvicto validation, isotope supply constraints, and platform acquisition competition.' },
              { num: 5, bold: 'Territory splits accelerate.', text: 'Territory-split deals increased 15% YoY as biotechs retain US rights while licensing ex-US. China standalone value declined to 5-8% of global (from 10-15% peak), except in metabolic assets.' },
            ].map(({ num, bold, text }) => (
              <div key={num} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">{num}</div>
                <p className="text-slate-700 leading-relaxed text-sm"><span className="font-bold text-slate-900">{bold}</span> {text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="bg-white">

        {/* ── SECTION 1: MARKET OVERVIEW ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="market-overview">The New Hierarchy of Deal Value</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            The first quarter of 2026 confirmed a structural shift in biopharma deal economics: <strong className="text-slate-900">oncology is no longer the default highest-value therapeutic area for licensing transactions.</strong> Metabolic and obesity assets now command the richest total deal values at Phase 2, with median packages reaching $2.0 billion compared to oncology&apos;s long-standing $1.1 billion benchmark. The validated commercial potential of GLP-1 receptor agonists, dual and triple incretin combinations, and oral obesity therapies has fundamentally repriced buyer expectations.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            Deal volume remained robust with approximately 180 transactions in Q1 — a 12% increase year-over-year. The composition shifted: while mega-deals (&gt;$5B) declined from 2023 records, mid-market transactions ($200M–$2B) surged 28%. Pharma BD teams are diversifying risk across more, smaller bets. Early-stage scouting (preclinical and Phase 1) reached 34% of volume, up from 28% in Q1 2025 — large pharma is moving upstream, driven by <Link href="/glossary/breakthrough-therapy-designation" className="text-teal-600 font-medium hover:text-teal-700">patent cliff</Link> pressure through 2028.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Median Upfront by Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">The Phase 1→2 jump (2.3x) is the single largest value inflection point in biopharma deal economics.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Preclinical', low: 10, median: 22, high: 45 },
              { phase: 'Phase 1', low: 20, median: 42, high: 85 },
              { phase: 'Phase 2', low: 45, median: 95, high: 200, highlight: true },
              { phase: 'Phase 3', low: 110, median: 230, high: 500 },
              { phase: 'Approved', low: 400, median: 800, high: 1600 },
            ]}
            title=""
            yLabel="Median Upfront ($M)"
            accentPhase="Phase 2"
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Phase-by-Phase Deal Economics (Oncology, 2020–2026)</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'Median Upfront', 'Median TDV', 'Royalty Range', 'Upfront % of TDV']}
            rows={[
              ['Preclinical', '$22M', '$400M', '5–10%', '5.5%'],
              ['Phase 1', '$42M', '$650M', '6–12%', '6.5%'],
              ['Phase 2', '$95M', '$1.1B', '8–15%', '8.6%'],
              ['Phase 3', '$230M', '$2.5B', '12–20%', '9.2%'],
              ['Approved', '$800M', '$6.0B', '18–25%', '13.3%'],
            ]}
            freeRows={5}
            footnote="Source: Ambrosia Ventures analysis of 2,600+ verified transactions (2020–2026). TDV = Total Deal Value."
          />

          {/* Insight callout — left border style */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The Phase 1→2 jump (2.3x on upfront, 1.7x on TDV) is where clinical proof-of-concept converts speculative platform bets into quantifiable commercial opportunities — and where buyers pay the steepest premium for de-risked assets.
            </p>
          </div>
        </section>

        {/* ── SECTION 2: THERAPEUTIC AREAS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="therapeutic-areas">Therapeutic Area Dynamics</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Metabolic/obesity completed its ascent to the top of the deal hierarchy. Median Phase 2 upfronts reached <strong className="text-slate-900">$150 million</strong> — 58% above oncology&apos;s $95 million. Total deal values hit $2.0 billion, reflecting buyer confidence in next-generation GLP-1 oral formulations, combination therapies, and the projected $100B+ annual obesity market by 2030.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Immunology emerged as the second-highest-value area with median upfronts of $120 million — 26% above oncology. The driver is almost entirely <Link href="/insights/deal-terms-by-therapeutic-area" className="text-teal-600 font-medium hover:text-teal-700">anti-TL1A</Link>: Merck&apos;s $10.8B Prometheus acquisition validated the mechanism, and buyers are now competing aggressively for remaining TL1A and adjacent IBD targets. Inflammatory bowel disease alone accounted for 40% of immunology deal volume.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Oncology stabilized at $95M Phase 2 median upfront — virtually unchanged from 2024. This is normalization, not decline: oncology remains the highest-volume TA, but the extraordinary 2022-2023 cycle (Pfizer/Seagen $43B, AbbVie/ImmunoGen $10.1B, BMS/RayzeBio $4.1B) has corrected. Buyers are more disciplined, particularly for assets without clear <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">differentiation</Link> from standard-of-care.
            </p>

            {/* Pull quote */}
            <div className="text-center py-10 my-8 border-y border-slate-300">
              <div className="text-5xl font-bold text-teal-700 tabular-nums">$150M</div>
              <div className="text-base text-slate-500 mt-2">Metabolic Phase 2 Median Upfront — Highest of Any Therapeutic Area</div>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 Median Upfront by Therapeutic Area</h3>
              <p className="text-xs text-slate-400 mb-4">Metabolic/obesity now commands the highest Phase 2 upfronts, followed by immunology and oncology.</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: 'Metabolic', low: 75, median: 150, high: 300 },
                { phase: 'Immunology', low: 60, median: 120, high: 250 },
                { phase: 'Oncology', low: 45, median: 95, high: 200 },
                { phase: 'Hematology', low: 40, median: 80, high: 170 },
                { phase: 'Neurology', low: 35, median: 75, high: 160 },
                { phase: 'Cardio', low: 30, median: 65, high: 135 },
                { phase: 'Rare Dis.', low: 30, median: 60, high: 130 },
                { phase: 'Ophthal.', low: 25, median: 55, high: 115 },
              ]}
              title=""
              yLabel="Median Upfront ($M)"
            />

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Phase 2 Licensing Benchmarks by Therapeutic Area</h3>
            </div>

            <GatedBenchmarkTable
              headers={['Therapeutic Area', 'Median Upfront', 'Median TDV', 'Base Royalty']}
              rows={[
                ['Metabolic / Obesity', '$150M', '$2.0B', '10%'],
                ['Immunology', '$120M', '$1.5B', '9%'],
                ['Oncology', '$95M', '$1.1B', '8%'],
                ['Hematology', '$80M', '$950M', '8%'],
                ['Neurology', '$75M', '$900M', '7%'],
                ['Cardiovascular', '$65M', '$800M', '7%'],
                ['Rare Disease', '$60M', '$750M', '9%'],
                ['Ophthalmology', '$55M', '$650M', '7%'],
                ['Infectious Disease', '$50M', '$600M', '6%'],
                ['Dermatology', '$45M', '$550M', '7%'],
                ['Gastroenterology', '$40M', '$500M', '6%'],
                ["Women's Health", '$35M', '$450M', '6%'],
              ]}
              freeRows={6}
              footnote="Source: Ambrosia Ventures. Medians from 2020–2026 verified transactions."
            />
          </div>
        </section>

        {/* ── SECTION 3: MODALITY PREMIUMS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="modality-premiums">Modality Premiums</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Radiopharmaceuticals overtook ADCs for the highest modality multiplier at <strong className="text-slate-900">1.60x</strong> over small molecule baselines. The convergence of Novartis Pluvicto validation (&gt;$1B annual sales within 18 months), constrained isotope supply, and a wave of platform acquisitions by BMS, Lilly, and AstraZeneca drove aggressive bidding for remaining independent radiopharmaceutical companies.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            ADC premiums normalized to 1.50x from a ~1.70x peak during the 2023 Pfizer/Seagen cycle. At the normalized level, ADCs remain the second-highest modality with strong buyer interest in next-generation payloads and novel targets beyond HER2/Trop-2. Bispecific antibodies held at 1.40x, buoyed by teclistamab, epcoritamab, and glofitamab validation in hematologic malignancies. See our <Link href="/insights/pharma-licensing-royalty-rates" className="text-teal-600 font-medium hover:text-teal-700">royalty rate benchmarks</Link> for modality-specific royalty analysis.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Modality Multipliers vs Small Molecule Baseline</h3>
            <p className="text-xs text-slate-400 mb-4">Radiopharmaceuticals command the largest premium at 1.60x.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Radiopharm', low: 140, median: 160, high: 180 },
              { phase: 'ADC', low: 130, median: 150, high: 170, highlight: true },
              { phase: 'Bispecific', low: 120, median: 140, high: 160 },
              { phase: 'CAR-T', low: 115, median: 135, high: 155 },
              { phase: 'mRNA', low: 115, median: 135, high: 155 },
              { phase: 'Sm. Mol.', low: 90, median: 100, high: 110 },
            ]}
            title=""
            yLabel="Multiplier (x100)"
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Modality Multipliers — Detailed</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-700 text-left">Modality</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Multiplier</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Ph2 Implied Upfront</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Radiopharmaceuticals', '1.60x', '$152M', '↑ New leader'],
                    ['ADC', '1.50x', '$142M', '↓ Normalized from 1.70x'],
                    ['Bispecific Antibodies', '1.40x', '$133M', '→ Stable'],
                    ['CAR-T / Cell Therapy', '1.35x', '$128M', '→ Stable'],
                    ['mRNA Therapeutics', '1.35x', '$128M', '↑ Beyond vaccines'],
                    ['Small Molecule', '1.00x', '$95M', '→ Baseline'],
                  ].map(([mod, mult, implied, trend], i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">{mod}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-semibold">{mult}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{implied}</td>
                      <td className="py-3 px-4 text-right text-slate-500 text-xs">{trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">Implied upfront = Phase 2 oncology small molecule median ($95M) × multiplier.</p>
          </div>
        </section>

        {/* ── SECTION 4: DEAL HIGHLIGHTS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-8" id="deal-highlights">Landmark Transactions</h2>

            <div className="space-y-0 divide-y divide-slate-200 border-y border-slate-200">
              {[
                { value: '$16.5B', companies: 'Novo Nordisk / Catalent', meta: 'Metabolic · Manufacturing Acquisition · 2024', analysis: 'Largest manufacturing deal in biopharma history. Secured GLP-1 fill-finish capacity to address chronic semaglutide supply shortages. Signaled that manufacturing infrastructure is now a strategic asset worth acquisition premiums.' },
                { value: '$10.8B', companies: 'Merck / Prometheus Biosciences', meta: 'Immunology · Anti-TL1A · Crohn\'s · 2023', analysis: 'Validated anti-TL1A as a blockbuster mechanism. At 7.2x the median Phase 2 immunology TDV, the premium reflects first-in-class data, precision diagnostics, and Merck\'s Keytruda patent cliff diversification.' },
                { value: '$8.7B', companies: 'AbbVie / Cerevel Therapeutics', meta: 'Neuroscience · Pipeline Acquisition · 2024', analysis: 'All-cash at 52% premium for a multi-asset neuroscience pipeline (schizophrenia, Parkinson\'s, epilepsy). Repriced neurology platform valuations and signaled AbbVie\'s urgency post-Botox growth slowdown.' },
                { value: '$7.1B', companies: 'Roche / Telavant', meta: 'Immunology · Anti-TL1A · IBD · 2024', analysis: 'Confirmed Merck/Prometheus was not an outlier but a new valuation tier for TL1A. Earlier-stage asset, yet only 34% lower deal value — demonstrating how validated mechanism data lifts the entire class.' },
                { value: '$4.9B', companies: 'Vertex / Alpine Immune Sciences', meta: 'Renal / Immunology · IgAN · 2024', analysis: 'Vertex\'s expansion beyond CF and pain into IgA nephropathy. Reflects the growing convergence of immunology and nephrology deal economics following sparsentan approval.' },
              ].map((deal, i) => (
                <div key={i} className="flex gap-6 bg-white py-6 px-2">
                  <div className="flex-shrink-0 w-20">
                    <div className="text-xl font-bold text-slate-900 tabular-nums leading-none">{deal.value}</div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">{deal.companies}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">{deal.meta}</p>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{deal.analysis}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 5: TERRITORY DYNAMICS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="territory-dynamics">Territory Dynamics</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Territory-split structures increased 15% YoY in Q1 2026. Biotechs are increasingly retaining US rights while licensing ex-US — particularly when they have US commercial infrastructure but lack global footprint. The median ex-US deal carries a 30-40% discount to global rights, but for biotechs with strong US commercial plans, this maximizes total value. See our <Link href="/insights/biotech-licensing-europe" className="text-teal-600 font-medium hover:text-teal-700">Europe licensing benchmarks</Link> for regional analysis.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            China standalone value declined to 5-8% of global (from 10-15% peak) following NRDL pricing reforms — except for metabolic assets, where China premiums of 15-20% above baseline ex-US value emerged, driven by 180 million adults with obesity and rapid GLP-1 manufacturing buildout. Japan remained stable at 8-12% of global value. Full <Link href="/insights/out-licensing-asia-pacific" className="text-teal-600 font-medium hover:text-teal-700">APAC territory analysis</Link> available.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 5</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Territory Value as % of Global Deal Economics</h3>
            <p className="text-xs text-slate-400 mb-4">US-only deals capture 65-70% of global value; China standalone has declined to 5-8%.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Global', low: 90, median: 100, high: 110, highlight: true },
              { phase: 'US Only', low: 60, median: 68, high: 75 },
              { phase: 'Ex-US', low: 50, median: 60, high: 70 },
              { phase: 'EU Only', low: 22, median: 30, high: 38 },
              { phase: 'Japan', low: 10, median: 15, high: 20 },
              { phase: 'China', low: 5, median: 8, high: 12 },
            ]}
            title=""
            yLabel="% of Global Value"
          />
        </section>

        {/* ── INTERACTIVE CALCULATOR ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Model Your Own Deal</h2>
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </div>
        </section>

        {/* ── METHODOLOGY ── */}
        <section className="max-w-4xl mx-auto px-6 py-12">
          <div className="border-l-4 border-slate-300 pl-5 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Methodology</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              This report draws from 2,600+ verified biopharma licensing and M&A transactions executed between 2020 and 2026.
              Sources include SEC filings (8-K, 10-K, 10-Q), company press releases, investor presentations, and regulatory databases.
              New deals are ingested weekly via automated SEC EDGAR monitoring and verified before inclusion.
              Full methodology: <Link href="/methodology" className="text-teal-600 hover:text-teal-700">ambrosiaventures.co/methodology</Link>.
            </p>
          </div>
        </section>

        {/* ── EMAIL CAPTURE ── */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <InlineEmailCapture
            heading="Get the Q2 Report First"
            description="Join 2,000+ BD professionals who receive our quarterly benchmarks the day they publish — plus weekly deal intelligence."
            source="q1-2026-report"
          />
        </section>

        {/* ── CITE THIS DATA ── */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <CiteThisData
            title="Q1 2026 Biopharma Deal Benchmarks Report"
            pageUrl="/reports/q1-2026-biopharma-deal-benchmarks"
          />
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-lg font-bold text-slate-900 mb-4" id="faq">Frequently Asked Questions</h2>
          <div className="divide-y divide-slate-200">
            {[
              { q: 'What data sources does this report use?', a: 'The report draws from 2,600+ verified biopharma licensing and M&A transactions (2020–2026). Sources include SEC filings, press releases, investor presentations, and regulatory databases. Updated weekly via automated monitoring.' },
              { q: 'Why did metabolic/obesity deals surpass oncology?', a: 'The GLP-1 revolution created a buyer\'s race for next-generation metabolic assets. Validated commercial success of semaglutide/tirzepatide, plus a projected $100B+ annual obesity market by 2030, supports premium valuations for differentiated pipeline assets.' },
              { q: 'What is the largest modality premium?', a: 'Radiopharmaceuticals at 1.60x over small molecules. Driven by Novartis Pluvicto validation (>$1B annual sales in 18 months), constrained isotope supply, and platform acquisition competition among BMS, Lilly, and AstraZeneca.' },
              { q: 'How often are benchmarks updated?', a: 'The full dataset is updated weekly. Quarterly reports provide point-in-time narrative analysis. The deal calculator reflects real-time data.' },
            ].map(({ q, a }, i) => (
              <details key={i} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-slate-800 hover:text-teal-700">
                  <span>{q}</span>
                  <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <InsightCTA variant="bottom" />
      <SiteFooter />
    </>
  );
}
