import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { TrustBar } from '@/components/insights/TrustBar';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { createServiceClient } from '@/lib/supabase/server';

const PhaseUpfrontChart = dynamic(() => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));

export const metadata: Metadata = {
  title: 'Q1 2026 Biopharma Deal Benchmarks Report: Trends from 2,500+ Transactions | Ambrosia Ventures',
  description: 'Quarterly analysis of biopharma licensing deal economics across 12 therapeutic areas. Phase-by-phase benchmarks, modality premiums, territory dynamics, and real deal highlights.',
  keywords: ['biopharma deal benchmarks 2026', 'licensing deal report', 'pharma deal economics Q1 2026', 'biopharma licensing benchmarks', 'oncology deal benchmarks', 'metabolic deal benchmarks', 'modality premiums biopharma', 'territory licensing dynamics'],
  openGraph: {
    title: 'Q1 2026 Biopharma Deal Benchmarks Report',
    description: 'Quarterly analysis of biopharma licensing deal economics across 12 therapeutic areas from 2,500+ verified transactions.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks',
    images: [{ url: '/api/og?title=Q1%202026%20Biopharma%20Deal%20Benchmarks&subtitle=Trends%20from%202%2C600%2B%20Transactions&type=insight', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'Q1 2026 Biopharma Deal Benchmarks: Trends from 2,500+ Transactions', description: 'Metabolic surpasses oncology, immunology premiums widen, and radiopharmaceuticals lead modality multipliers.' },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks' },
};

// Revalidate every 6 hours so new deals appear without a full redeploy
export const revalidate = 21600;

async function getTopDeals() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('licensee_name, licensor_name, asset_name, total_deal_value_usd, upfront_usd, deal_type, therapeutic_area, announced_date')
      .gte('announced_date', '2026-01-01')
      .lte('announced_date', '2026-03-31')
      .gte('total_deal_value_usd', 500000000)
      .eq('verified', true)
      .order('total_deal_value_usd', { ascending: false })
      .limit(8);

    return (data || []).map(d => {
      const valueB = d.total_deal_value_usd / 1e9;
      const valueStr = valueB >= 1 ? `$${valueB.toFixed(1)}B` : `$${Math.round(d.total_deal_value_usd / 1e6)}M`;
      const upfrontStr = d.upfront_usd
        ? (d.upfront_usd >= 1e9 ? `$${(d.upfront_usd / 1e9).toFixed(1)}B` : `$${Math.round(d.upfront_usd / 1e6)}M`)
        : null;
      const ta = (d.therapeutic_area || '').replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase()).trim();
      const type = (d.deal_type || '').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
      const date = new Date(d.announced_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      return {
        value: valueStr,
        companies: `${d.licensor_name} → ${d.licensee_name}`,
        meta: `${ta} · ${type} · ${date}`,
        analysis: upfrontStr
          ? `${upfrontStr} upfront. ${d.asset_name || ''}`
          : d.asset_name || '',
      };
    });
  } catch (err) {
    console.error('[Q1 Report] Failed to fetch deals:', err);
    return [];
  }
}

export default async function Q1BenchmarkReportPage() {
  const topDeals = await getTopDeals();
  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
    { '@type': 'ListItem', position: 2, name: 'Reports', item: 'https://calculator.ambrosiaventures.co/reports' },
    { '@type': 'ListItem', position: 3, name: 'Q1 2026 Biopharma Deal Benchmarks' },
  ]};
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Q1 2026 Biopharma Deal Benchmarks Report', author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' }, datePublished: '2026-03-30', dateModified: '2026-03-30', publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } } };
  const datasetSchema = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Q1 2026 Biopharma Deal Benchmarks', description: 'Phase-by-phase upfront payments, total deal values, royalty ranges from 2,500+ verified biopharma transactions.', creator: { '@type': 'Organization', name: 'Ambrosia Ventures' }, temporalCoverage: '2020/2026' };
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'What data sources does the Q1 2026 benchmark report use?', acceptedAnswer: { '@type': 'Answer', text: 'The report draws from 2,500+ verified biopharma licensing and M&A transactions (2020-2026). Sources include SEC filings (8-K, 10-K, 10-Q), FTC premerger filings, press releases, and regulatory databases. Updated weekly.' } },
    { '@type': 'Question', name: 'Why did metabolic/obesity deals surpass oncology?', acceptedAnswer: { '@type': 'Answer', text: 'Immunology Phase 2 upfronts reached $350M — nearly 3x oncology ($120M) — driven by anti-TL1A mechanism validation. Metabolic/obesity TDV ($1.7B) also exceeds oncology ($1.3B), driven by GLP-1 commercial validation.' } },
    { '@type': 'Question', name: 'What is the largest modality premium in biopharma?', acceptedAnswer: { '@type': 'Answer', text: 'Radiopharmaceuticals at 1.60x over small molecules, reflecting Novartis Pluvicto validation and supply-constrained bidding for platform companies.' } },
  ]};

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="q1-2026" />
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

          <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-[0.25em] mb-6">Quarterly Report · March 2026</p>

          <div className="sm:flex items-end gap-10 mb-8">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-[3.5rem] font-bold text-slate-900 leading-[1.05] tracking-tight mb-4">
                Biopharma Deal<br className="hidden sm:block" /> Benchmarks
              </h1>
              <p className="text-base text-slate-500 max-w-xl leading-relaxed">
                A quarterly analysis of licensing economics across 12 therapeutic areas, drawn from 2,500+ verified transactions.
              </p>
            </div>
            <div className="mt-6 sm:mt-0 flex-shrink-0 text-right">
              <div className="text-[5.5rem] sm:text-[7rem] font-bold text-slate-900 leading-none tracking-tight tabular-nums">$350<span className="text-[3rem] sm:text-[4rem] text-slate-400 font-normal">M</span></div>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">Immunology Ph2 Median Upfront</p>
              <p className="text-[11px] text-teal-600 font-semibold uppercase tracking-wide">Nearly 3x Oncology</p>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 py-5 mb-8">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
              {[
                { value: '2,500+', label: 'Deals' },
                { value: '12', label: 'Therap. Areas' },
                { value: '$120M', label: 'Onco Ph2 Upfront' },
                { value: '1.60x', label: 'Radiopharm Mult.' },
                { value: '191', label: 'Q1 Transactions' },
                { value: '+15%', label: 'Territory Splits YoY' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-lg font-bold text-slate-900 tabular-nums">{stat.value}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400 uppercase tracking-wider">
            <span>Published March 30, 2026</span>
            <span className="text-slate-300">·</span>
            <span>Ambrosia Ventures Research</span>
            <span className="text-slate-300">·</span>
            <span>18 min read</span>
          </div>
        </div>
      </header>

      {/* ── EXECUTIVE SUMMARY ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-6">Executive Summary</h2>
          <div className="space-y-5">
            {[
              { num: 1, bold: 'Immunology commands the highest Phase 2 upfronts.', text: 'At $350M median, immunology Phase 2 upfronts are nearly 3x oncology ($120M) — driven by the anti-TL1A mechanism validation from Merck\'s $10.8B Prometheus acquisition and expanding CAR-T autoimmune programs.' },
              { num: 2, bold: 'Metabolic surpasses oncology on total value.', text: 'Metabolic/obesity Phase 2 TDV ($1.7B) exceeds oncology ($1.3B), with upfronts at $255M median. GLP-1 commercial validation and a projected $100B+ annual market by 2030 are driving premium valuations.' },
              { num: 3, bold: 'ADC normalization complete.', text: 'ADC deal values corrected from 2023 peaks (Pfizer/Seagen at $43B created temporary distortion) but remain the second-highest modality at 1.45x premium, behind radiopharmaceuticals.' },
              { num: 4, bold: 'Radiopharmaceuticals lead.', text: 'At 1.60x over small molecule baselines, radiopharmaceuticals command the largest single-modality premium — driven by Pluvicto validation, isotope supply constraints, and platform acquisition competition.' },
              { num: 5, bold: 'Licensing replaces acquisition.', text: 'Licensing volume surged 18% YoY while acquisitions declined 12%. Mid-market licensing ($200M-$2B) grew 28%. Option-based structures are the fastest-growing category at +24% YoY. Territory splits increased 15% as biotechs retain US rights and license ex-US.' },
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
            The first quarter of 2026 confirmed a structural shift in biopharma deal economics: <strong className="text-slate-900">oncology is no longer the default highest-value therapeutic area for licensing transactions.</strong> Metabolic and obesity assets now command the richest total deal values at Phase 2, with median packages reaching $2.0 billion compared to oncology&apos;s long-standing $1.3 billion benchmark. The validated commercial potential of GLP-1 receptor agonists, dual and triple incretin combinations, and oral obesity therapies has fundamentally repriced buyer expectations.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            Deal volume remained robust with 191 transactions in Q1 — a 12% increase year-over-year. The composition shifted: while mega-deals (&gt;$5B) declined from 2023 records, mid-market transactions ($200M–$2B) surged 28%. Pharma BD teams are diversifying risk across more, smaller bets. Early-stage scouting (preclinical and Phase 1) reached 34% of volume, up from 28% in Q1 2025 — large pharma is moving upstream, driven by <Link href="/glossary/breakthrough-therapy-designation" className="text-teal-600 font-medium hover:text-teal-700">patent cliff</Link> pressure through 2028.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Median Upfront by Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">The Phase 1→2 jump (2.0x) is the single largest value inflection point in biopharma deal economics.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Preclinical', low: 10, median: 22, high: 45 },
              { phase: 'Phase 1', low: 30, median: 60, high: 120 },
              { phase: 'Phase 2', low: 60, median: 120, high: 250, highlight: true },
              { phase: 'Phase 3', low: 175, median: 350, high: 600 },
              { phase: 'Approved', low: 350, median: 700, high: 1500 },
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
              ['Phase 1', '$60M', '$700M', '8–14%', '8.6%'],
              ['Phase 2', '$120M', '$1.3B', '11–18%', '9.2%'],
              ['Phase 3', '$350M', '$2.5B', '15–23%', '14.0%'],
              ['Approved', '$700M', '$4.5B', '18–28%', '15.6%'],
            ]}
            freeRows={5}
            footnote="Source: Ambrosia Ventures analysis of 2,500+ verified transactions (2020–2026). TDV = Total Deal Value."
          />

          {/* Insight callout — left border style */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The Phase 1→2 jump (2.0x on upfront, 1.7x on TDV) is where clinical proof-of-concept converts speculative platform bets into quantifiable commercial opportunities — and where buyers pay the steepest premium for de-risked assets.
            </p>
          </div>
        </section>

        {/* ── DRAMATIC PULL QUOTE ── */}
        <section className="border-y border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.3em] mb-4">The headline number</p>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-6xl sm:text-8xl font-bold text-slate-900 tabular-nums tracking-tight">2.0x</span>
            </div>
            <p className="text-lg sm:text-xl text-slate-500 mt-4 max-w-lg mx-auto leading-relaxed">
              The Phase 1→2 upfront multiplier — the single largest value inflection point in biopharma deal economics
            </p>
            <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures analysis of 2,500+ transactions (2020–2026)</p>
          </div>
        </section>

        {/* ── SECTION 2: THERAPEUTIC AREAS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="therapeutic-areas">Therapeutic Area Dynamics</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Immunology emerged as the highest-value therapeutic area for Phase 2 licensing, with median upfronts reaching <strong className="text-slate-900">$350 million</strong> — nearly 3x oncology&apos;s $120 million. This premium is driven almost entirely by the anti-TL1A mechanism validation following Merck&apos;s $10.8B Prometheus acquisition. Metabolic/obesity Phase 2 upfronts reached $255 million with $1.7B total deal values, reflecting GLP-1 commercial validation and the projected $100B+ annual obesity market by 2030.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Immunology emerged as the second-highest-value area with median upfronts of $120 million — 26% above oncology. The driver is almost entirely <Link href="/insights/deal-terms-by-therapeutic-area" className="text-teal-600 font-medium hover:text-teal-700">anti-TL1A</Link>: Merck&apos;s $10.8B Prometheus acquisition validated the mechanism, and buyers are now competing aggressively for remaining TL1A and adjacent IBD targets. Inflammatory bowel disease alone accounted for 40% of immunology deal volume.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Oncology stabilized at $120M Phase 2 median upfront — virtually unchanged from 2024. This is normalization, not decline: oncology remains the highest-volume TA, but the extraordinary 2022-2023 cycle (Pfizer/Seagen $43B, AbbVie/ImmunoGen $10.1B, BMS/RayzeBio $4.1B) has corrected. Buyers are more disciplined, particularly for assets without clear <Link href="/therapeutic-areas/oncology" className="text-teal-600 font-medium hover:text-teal-700">differentiation</Link> from standard-of-care.
            </p>

            {/* Inline data annotation */}
            <div className="border-l-4 border-slate-300 pl-5 py-2 my-8">
              <p className="text-sm text-slate-600 leading-relaxed italic">
                &ldquo;Immunology Phase 2 upfronts ($350M) are nearly 3x oncology ($120M) — a shift driven by TL1A validation and the CAR-T autoimmune pipeline.&rdquo;
              </p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 Median Upfront by Therapeutic Area</h3>
              <p className="text-xs text-slate-400 mb-4">Metabolic/obesity now commands the highest Phase 2 upfronts, followed by immunology and oncology.</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: 'Immunology', low: 150, median: 350, high: 800 },
                { phase: 'Metabolic', low: 128, median: 255, high: 570 },
                { phase: 'Oncology', low: 60, median: 120, high: 250 },
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
                ['Immunology', '$350M', '$1.8B', '10–17%'],
                ['Metabolic / Obesity', '$255M', '$1.7B', '12–22%'],
                ['Oncology', '$120M', '$1.3B', '11–18%'],
                ['Hematology', '$80M', '$950M', '8–15%'],
                ['Neurology', '$75M', '$900M', '7–14%'],
                ['Cardiovascular', '$65M', '$800M', '7–13%'],
                ['Rare Disease', '$60M', '$750M', '8–15%'],
                ['Ophthalmology', '$55M', '$650M', '7–13%'],
                ['Infectious Disease', '$50M', '$600M', '6–12%'],
                ['Dermatology', '$45M', '$550M', '7–13%'],
                ['Gastroenterology', '$40M', '$500M', '6–12%'],
                ["Women's Health", '$35M', '$450M', '6–11%'],
              ]}
              freeRows={6}
              footnote="Source: Ambrosia Ventures. Medians from 2020–2026 verified transactions."
            />
          </div>
        </section>

        {/* ── PULL QUOTE 2 ── */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="max-w-4xl mx-auto px-6 py-14 sm:flex items-center gap-10">
            <div className="text-6xl sm:text-7xl font-bold text-teal-700 tabular-nums tracking-tight flex-shrink-0">$350M</div>
            <div className="mt-4 sm:mt-0">
              <p className="text-slate-700 leading-relaxed">Phase 2 immunology median upfront — nearly 3x oncology ($120M) and the highest of any therapeutic area. The anti-TL1A validation and CAR-T autoimmune pipeline have fundamentally repriced immunology deal economics.</p>
              <p className="text-xs text-slate-400 mt-2">Immunology Phase 2 · 2020–2026 · Ambrosia Ventures analysis</p>
            </div>
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
            ADC premiums normalized to 1.45x from a ~1.70x peak during the 2023 Pfizer/Seagen cycle. At the normalized level, ADCs remain the second-highest modality with strong buyer interest in next-generation payloads and novel targets beyond HER2/Trop-2. Bispecific antibodies held at 1.40x, buoyed by teclistamab, epcoritamab, and glofitamab validation in hematologic malignancies. See our <Link href="/insights/pharma-licensing-royalty-rates" className="text-teal-600 font-medium hover:text-teal-700">royalty rate benchmarks</Link> for modality-specific royalty analysis.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Modality Multipliers vs Small Molecule Baseline</h3>
            <p className="text-xs text-slate-400 mb-4">Radiopharmaceuticals command the largest premium at 1.60x.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Radiopharm', low: 140, median: 160, high: 180 },
              { phase: 'ADC', low: 125, median: 145, high: 165, highlight: true },
              { phase: 'CAR-T (Solid)', low: 120, median: 140, high: 160 },
              { phase: 'Bispecific', low: 115, median: 135, high: 155 },
              { phase: 'PROTAC', low: 115, median: 135, high: 155 },
              { phase: 'mRNA', low: 110, median: 130, high: 150 },
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
                    ['Radiopharmaceuticals', '1.60x', '$192M', '↑ New leader'],
                    ['ADC', '1.45x', '$174M', '↓ Normalized'],
                    ['CAR-T (Solid Tumor)', '1.40x', '$168M', '→ High interest'],
                    ['Bispecific Antibodies', '1.35x', '$162M', '→ Stable'],
                    ['PROTAC / Degrader', '1.35x', '$162M', '→ Strong interest'],
                    ['mRNA Therapeutics', '1.30x', '$156M', '↑ Beyond vaccines'],
                    ['Small Molecule', '1.00x', '$120M', '→ Baseline'],
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
            <p className="text-xs text-slate-400 mt-3">Implied upfront = Phase 2 oncology small molecule median ($120M) × multiplier.</p>
          </div>
        </section>

        {/* ── SECTION 4: DEAL STRUCTURE TRENDS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="deal-structure">The Structural Shift: Licensing Replaces Acquisition</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              The most significant structural change in Q1 2026 is the decisive pivot from acquisitions to licensing as the primary deal-making vehicle. <strong className="text-slate-900">Licensing deal volume increased 18% year-over-year while acquisition volume declined 12%.</strong> This is not cyclical — it reflects a fundamental recalculation by pharma BD teams about how to rebuild pipelines in the post-IRA, post-Seagen environment.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The 2022-2023 cycle was defined by platform acquisitions: Pfizer/Seagen ($43B), Merck/Prometheus ($10.8B), AbbVie/Cerevel ($8.7B). Each was a bet-the-company move to fill a pipeline gap before patent cliffs hit. The 2025-2026 cycle is different. Pharma is placing more bets at lower individual commitments — five $500M-$2B licensing deals across different stages and therapeutic areas rather than one $10B acquisition. Mid-market licensing ($200M-$2B total value) surged 28% in Q1, the fastest-growing segment.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The drivers are structural: patent cliffs through 2028 force faster pipeline rebuilds, and licensing is faster than M&A — no shareholder vote, no antitrust review, no integration risk. The IRA&apos;s Medicare negotiation provisions also made US-centric deal economics less predictable, increasing the appeal of territory-split structures where the biotech retains US rights and licenses ex-US at a 30-40% discount to global value.
            </p>

            {/* Pull quote */}
            <div className="text-center py-10 my-8 border-y border-slate-300">
              <div className="sm:flex items-baseline justify-center gap-6">
                <div>
                  <div className="text-5xl sm:text-6xl font-bold text-teal-700 tabular-nums tracking-tight">+18%</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Licensing Volume YoY</div>
                </div>
                <div className="text-3xl text-slate-300 hidden sm:block">/</div>
                <div className="mt-6 sm:mt-0">
                  <div className="text-5xl sm:text-6xl font-bold text-slate-400 tabular-nums tracking-tight">-12%</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Acquisition Volume YoY</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-6 max-w-md mx-auto">The decisive pivot from &ldquo;buy the platform&rdquo; to &ldquo;license the best asset&rdquo;</p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4A</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Deal Structure Economics by Type</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Structure</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Upfront %</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Milestones %</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Royalty</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Q1 Volume</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Licensing', '15-20%', '55-65%', '8-15%', '42%', '+18%'],
                      ['Co-development', '10-15%', '50-60%', 'Profit split', '22%', '+8%'],
                      ['Option / Right of first refusal', '5-10%', '60-70%', '10-18%', '15%', '+24%'],
                      ['Acquisition', '100%', '—', '—', '14%', '-12%'],
                      ['Collaboration', '8-12%', '60-70%', 'Shared', '7%', '+5%'],
                    ].map(([structure, upfront, milestones, royalty, volume, yoy], i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{structure}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{upfront}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{milestones}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{royalty}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{volume}</td>
                        <td className={`py-3 px-4 text-right tabular-nums font-semibold ${yoy.startsWith('+') ? 'text-teal-700' : 'text-red-500'}`}>{yoy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures analysis of 2,500+ verified transactions (2020–2026). Volume = share of Q1 2026 deal count. YoY = year-over-year change in deal count.</p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4B</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Deal Volume by Structure Type</h3>
              <p className="text-xs text-slate-400 mb-4">Licensing dominates at 42% of Q1 volume. Option-based deals are the fastest-growing structure (+24% YoY).</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: 'Licensing', low: 35, median: 42, high: 50, highlight: true },
                { phase: 'Co-dev', low: 18, median: 22, high: 28 },
                { phase: 'Option', low: 10, median: 15, high: 20 },
                { phase: 'Acquisition', low: 10, median: 14, high: 18 },
                { phase: 'Collaboration', low: 4, median: 7, high: 12 },
              ]}
              title=""
              yLabel="% of Q1 2026 Volume"
            />

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Option-based deal structures are the fastest-growing category (+24% YoY), particularly for early-stage platform technologies. The typical option deal puts 5-10% as an option fee, 15-25% as an exercise payment, with escalating milestones tied to clinical progress. This structure allows pharma to de-risk early-stage bets while giving biotechs non-dilutive capital to reach proof-of-concept.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DEAL HIGHLIGHTS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-8" id="deal-highlights">Landmark Transactions</h2>

            <div className="space-y-0 divide-y divide-slate-200 border-y border-slate-200">
              {topDeals.map((deal, i) => (
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
        </section>

        {/* ── SECTION 6: TERRITORY DYNAMICS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="territory-dynamics">Territory Dynamics</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Territory-split structures increased 15% YoY in Q1 2026. Biotechs are increasingly retaining US rights while licensing ex-US — particularly when they have US commercial infrastructure but lack global footprint. The median ex-US deal carries a 30-40% discount to global rights, but for biotechs with strong US commercial plans, this maximizes total value. See our <Link href="/insights/biotech-licensing-europe" className="text-teal-600 font-medium hover:text-teal-700">Europe licensing benchmarks</Link> for regional analysis.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            China standalone value declined to 5-8% of global (from 10-15% peak) following NRDL pricing reforms — except for metabolic assets, where China premiums of 15-20% above baseline ex-US value emerged, driven by 180 million adults with obesity and rapid GLP-1 manufacturing buildout. Japan remained stable at 8-12% of global value. Full <Link href="/insights/out-licensing-asia-pacific" className="text-teal-600 font-medium hover:text-teal-700">APAC territory analysis</Link> available.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 6</p>
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
              This report draws from 2,500+ verified biopharma licensing and M&A transactions executed between 2020 and 2026.
              Sources include SEC filings (8-K, 10-K, 10-Q), FTC premerger filings, company press releases, investor presentations, and regulatory databases.
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
              { q: 'What data sources does this report use?', a: 'The report draws from 2,500+ verified biopharma licensing and M&A transactions (2020–2026). Sources include SEC filings, FTC premerger filings, press releases, investor presentations, and regulatory databases. Updated weekly via automated monitoring.' },
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
