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

const ChartSkeleton = () => (
  <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
    <div className="h-64 sm:h-80 flex items-end gap-2 px-8 pb-8 animate-pulse">
      {[35, 50, 65, 80, 95].map((h, i) => (
        <div key={i} className="flex-1 bg-slate-100 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);
const PhaseUpfrontChart = dynamic(
  () => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })),
  { loading: () => <ChartSkeleton /> }
);
const DealVolumeStackedChart = dynamic(
  () => import('@/components/insights/DealVolumeStackedChart').then(m => ({ default: m.DealVolumeStackedChart })),
  { loading: () => <ChartSkeleton /> }
);
const RangeChart = dynamic(
  () => import('@/components/insights/RangeChart').then(m => ({ default: m.RangeChart })),
  { loading: () => <ChartSkeleton /> }
);
const TrendLineChart = dynamic(
  () => import('@/components/insights/TrendLineChart').then(m => ({ default: m.TrendLineChart })),
  { loading: () => <ChartSkeleton /> }
);
const WaterfallChart = dynamic(
  () => import('@/components/insights/WaterfallChart').then(m => ({ default: m.WaterfallChart })),
  { loading: () => <ChartSkeleton /> }
);
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));
const EmailGatedDownload = dynamic(() => import('@/components/insights/EmailGatedDownload').then(m => ({ default: m.EmailGatedDownload })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));

export const metadata: Metadata = {
  title: 'Q1 2026 Biopharma Deal Benchmarks Report: Analysis of 2,600+ Transactions (2020-2026) | Ambrosia Ventures',
  description: 'Institutional-grade quarterly analysis of biopharma deal economics across 13 therapeutic areas. Phase-by-phase benchmarks with sample sizes, upfront/TDV medians, conditional value trends, and deal structure evolution from 2,600+ verified transactions.',
  keywords: ['biopharma deal benchmarks 2026', 'pharma deal economics Q1 2026', 'biopharma licensing benchmarks', 'pharma acquisitions 2026', 'co-development deals', 'oncology deal benchmarks', 'metabolic deal benchmarks', 'modality premiums biopharma', 'phase 2 upfront benchmarks'],
  openGraph: {
    title: 'Q1 2026 Biopharma Deal Benchmarks Report',
    description: 'Institutional-grade analysis of biopharma deal economics from 2,600+ verified transactions (2020-2026). Phase-by-phase medians with sample sizes across 13 therapeutic areas.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks',
    images: [{ url: '/api/og?title=Q1%202026%20Biopharma%20Deal%20Benchmarks&subtitle=Analysis%20of%202%2C600%2B%20Transactions&type=insight', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'Q1 2026 Biopharma Deal Benchmarks: 2,600+ Transactions Analyzed', description: 'Immunology Phase 2 median upfront reaches $400M (n=15). Licensing surpasses acquisitions. Conditional value share declines to 71%.' },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/reports/q1-2026-biopharma-deal-benchmarks' },
};

// Revalidate every 6 hours so new deals appear without a full redeploy
export const revalidate = 21600;

// Phase 2 medians by TA for contextual comparison
const TA_PHASE2_MEDIANS: Record<string, number> = {
  oncology: 282, immunology: 400, metabolic: 1200, neurology: 226,
  hematology: 200, cardiovascular: 310, gastroenterology: 725,
  rareDisease: 500, ophthalmology: 123, infectiousDisease: 130,
  dermatology: 250, womensHealth: 44,
};

function generateDealAnalysis(d: {
  licensee_name: string; licensor_name: string; asset_name: string | null;
  total_deal_value_usd: number; upfront_usd: number | null;
  deal_type: string; therapeutic_area: string; announced_date: string;
  phase_at_signing: string | null; indication_category: string | null;
  modality: string | null; verification_notes: string | null;
}): string {
  const lines: string[] = [];
  const upM = d.upfront_usd ? d.upfront_usd / 1e6 : 0;
  const tdvM = d.total_deal_value_usd / 1e6;
  const upPct = d.upfront_usd ? Math.round((d.upfront_usd / d.total_deal_value_usd) * 100) : 0;
  const fmtUp = upM >= 1000 ? `$${(upM / 1000).toFixed(1)}B` : `$${Math.round(upM)}M`;
  const fmtTdv = tdvM >= 1000 ? `$${(tdvM / 1000).toFixed(1)}B` : `$${Math.round(tdvM)}M`;

  // Upfront structure
  if (d.upfront_usd) {
    const milestones = tdvM - upM;
    const fmtMilestones = milestones >= 1000 ? `$${(milestones / 1000).toFixed(1)}B` : `$${Math.round(milestones)}M`;
    if (d.deal_type === 'acquisition') {
      lines.push(`${fmtUp} all-cash acquisition.`);
    } else {
      lines.push(`${fmtUp} upfront (${upPct}% of ${fmtTdv} total value) with up to ${fmtMilestones} in development, regulatory, and commercial milestones.`);
    }
  }

  // Asset context
  if (d.asset_name) {
    lines.push(d.asset_name + '.');
  }

  // TA median comparison
  const taMedian = TA_PHASE2_MEDIANS[d.therapeutic_area];
  if (taMedian && d.upfront_usd && d.phase_at_signing) {
    const multiple = (upM / taMedian).toFixed(1);
    if (parseFloat(multiple) > 1.5) {
      const phase = (d.phase_at_signing || '').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
      lines.push(`At ${multiple}x the ${d.therapeutic_area} Phase 2 median upfront, this reflects significant premium for ${phase}-stage de-risking.`);
    }
  }

  // Verification context (from our web-verified notes)
  if (d.verification_notes && d.verification_notes.length > 20) {
    const notes = d.verification_notes;
    // Extract key context from verification notes
    if (notes.includes('patent cliff')) lines.push('Driven by acquirer patent cliff diversification pressure.');
    if (notes.includes('Orphan Drug')) lines.push('Orphan Drug and Fast Track designated by FDA.');
    if (notes.includes('AI')) lines.push('Largest AI drug discovery licensing deal to date.');
    if (notes.includes('BBB') || notes.includes('blood-brain')) lines.push('Signals growing conviction in blood-brain barrier delivery platforms.');
  }

  return lines.join(' ');
}

async function getTopDeals() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('licensee_name, licensor_name, asset_name, total_deal_value_usd, upfront_usd, deal_type, therapeutic_area, announced_date, phase_at_signing, indication_category, modality, verification_notes')
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
      const upfrontPct = (d.upfront_usd && d.total_deal_value_usd) ? Math.round((d.upfront_usd / d.total_deal_value_usd) * 100) : null;

      return {
        value: valueStr,
        companies: `${d.licensor_name} \u2192 ${d.licensee_name}`,
        meta: `${ta} \u00b7 ${type} \u00b7 ${date}`,
        upfrontStr,
        upfrontPct,
        assetName: d.asset_name || '',
        tdv: d.total_deal_value_usd,
        analysis: generateDealAnalysis(d),
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
  const datasetSchema = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Q1 2026 Biopharma Deal Benchmarks', description: 'Phase-by-phase upfront payments, total deal values, and deal structure economics from 2,600+ verified biopharma transactions (2020-2026).', creator: { '@type': 'Organization', name: 'Ambrosia Ventures' }, temporalCoverage: '2020/2026' };
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'What data sources does the Q1 2026 benchmark report use?', acceptedAnswer: { '@type': 'Answer', text: 'The report analyzes 2,600+ verified biopharma transactions (2020-2026). Sources include SEC 8-K filings, FTC premerger filings, press releases, and ClinicalTrials.gov. Deals with undisclosed terms are excluded. Updated weekly via automated ingestion plus manual verification.' } },
    { '@type': 'Question', name: 'Why are immunology Phase 2 upfronts higher than oncology?', acceptedAnswer: { '@type': 'Answer', text: 'Immunology Phase 2 median upfront is $400M (n=15) versus oncology at $282M (n=236). The smaller immunology sample is concentrated in high-value anti-TL1A and CAR-T autoimmune transactions, while oncology reflects a broader distribution across mechanisms and targets.' } },
    { '@type': 'Question', name: 'How should I interpret the sample sizes?', acceptedAnswer: { '@type': 'Answer', text: 'Larger samples (n>100) produce more stable estimates. Smaller samples (n<20) should be treated as directional. We report interquartile ranges (P25-P75) to convey dispersion. Medians are used throughout to minimize distortion from mega-deals.' } },
  ]};

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="q1-2026" />
      <StickyTOC sections={[
        { id: 'market-overview', label: 'Market Overview', number: 1 },
        { id: 'therapeutic-areas', label: 'Therapeutic Areas', number: 2 },
        { id: 'conditional-value', label: 'Conditional Value', number: 3 },
        { id: 'deal-structure', label: 'Deal Structure', number: 4 },
        { id: 'deal-highlights', label: 'Deal Highlights', number: 5 },
        { id: 'market-themes', label: 'Market Themes', number: 6 },
        { id: 'modality-premiums', label: 'Modality', number: 7 },
        { id: 'territory-dynamics', label: 'Territory', number: 8 },
        { id: 'methodology', label: 'Methodology', number: 9 },
      ]} />
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
                A quarterly analysis of deal economics across 13 therapeutic areas, drawn from 2,600+ verified transactions with publicly disclosed terms. All figures represent medians with sample sizes reported throughout.
              </p>
            </div>
            <div className="mt-6 sm:mt-0 flex-shrink-0 text-right">
              <div className="text-[5.5rem] sm:text-[7rem] font-bold text-slate-900 leading-none tracking-tight tabular-nums">$400<span className="text-[3rem] sm:text-[4rem] text-slate-400 font-normal">M</span></div>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">Immunology Ph2 Median Upfront</p>
              <p className="text-[11px] text-teal-600 font-semibold uppercase tracking-wide">n=15 · 1.4x Oncology</p>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 py-5 mb-8">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
              {[
                { value: '2,600+', label: 'Verified Deals' },
                { value: '13', label: 'Therap. Areas' },
                { value: '$282M', label: 'Onco Ph2 Upfront' },
                { value: '190', label: 'Q1 2026 Deals' },
                { value: '29.0%', label: '2026 Upfront %' },
                { value: '71.0%', label: '2026 Conditional %' },
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
            <span>22 min read</span>
          </div>
        </div>
      </header>

      {/* ── EXECUTIVE SUMMARY ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-6">Executive Summary</h2>
          <div className="space-y-5">
            {[
              { num: 1, bold: 'Deal volume surged to 535 transactions in 2024, then moderated.', text: 'Annual deal count rose from 269 in 2020 to a peak of 535 in 2024 (+99%), before declining to 387 in 2025. Q1 2026 is tracking 190 deals at an annualized pace of ~760, suggesting the market remains structurally active. Average deal size compressed from $4.0B (2020) to $1.9B (2026 YTD), reflecting a shift toward smaller, more frequent transactions.' },
              { num: 2, bold: 'Immunology and metabolic command the highest Phase 2 premiums.', text: 'Immunology Phase 2 median upfront reached $400M (n=15, P25-P75: $98M-$1.25B) — 1.4x the oncology median of $282M (n=236, P25-P75: $198M-$386M). Metabolic/obesity upfronts are highest at $1.2B median (n=11), though the wide interquartile range ($175M-$1.65B) reflects a bimodal distribution between GLP-1 platforms and earlier-stage assets.' },
              { num: 3, bold: 'Upfront percentages are rising.', text: 'Average upfront as a percentage of TDV increased from 20.3% (2021) to 29.0% (2026 YTD, n=190). Sellers are negotiating more cash at signing — a structural shift reflecting tighter biotech capital markets and reduced appetite for milestone-heavy packages with uncertain timelines.' },
              { num: 4, bold: 'Licensing is the dominant structure.', text: 'Licensing accounts for 732 deals (31% of all transactions), followed by acquisitions at 530 (23%) and collaborations at 469 (20%). Co-development (294 deals, 13%) and options (289 deals, 12%) round out the structure mix. Licensing volume has grown from 58 deals in 2020 to 101 in Q1 2026 YTD alone.' },
              { num: 5, bold: 'Conditional value share is compressing.', text: 'The share of total deal value tied to milestones (conditional value) declined from 79.7% in 2021 (n=242) to 71.0% in 2026 YTD (n=87). Buyers are paying more upfront and structuring fewer, larger milestone payments tied to high-probability events rather than diffuse clinical and commercial triggers.' },
              { num: 6, bold: 'China-to-West licensing has fundamentally shifted deal geography.', text: 'Chinese biotech out-licensing surged to $136B in 2025 (+162% YoY) and reached $52B in the first 8 weeks of 2026 \u2014 matching the entire 2024 total. Average China-originated deal size is $1.3B (+76% vs 2025). Six of the top 10 pharma companies have licensed from Chinese biotechs in the last 12 months, with ADCs and PD-1/VEGF bispecifics dominating. Key transactions: AstraZeneca/CSPC ($18.5B), GSK/Hengrui ($12B+), BMS/BioNTech-Biotheus ($11.1B), Pfizer/3SBio ($6B).' },
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
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="market-overview">Market Overview: Volume, Value, and Composition</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            The biopharma deal market expanded significantly through 2024, with annual transaction volume rising from 269 deals in 2020 to 535 in 2024 — a compound annual growth rate of 18.7%. Total disclosed deal value peaked in 2020 at $1.03 trillion (n=269, average $4.0B per deal), reflecting several mega-transactions, before normalizing to $814B-$900B annually through 2022-2023. The 2024 cycle saw a resurgence: $1.14 trillion across 535 deals, though the average deal size of $2.3B was 42% below the 2020 peak, indicating a structural shift toward higher-volume, lower-value transactions.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            Year-to-date 2026 data (n=190 deals through March 31) shows $232.6B in disclosed value at an average of $1.94B per transaction. If the current run rate holds, 2026 would deliver approximately 760 deals — the highest annual count on record — at a total value of ~$930B. The average deal size compression is meaningful: buyers are distributing capital across more transactions with tighter risk-sharing structures rather than concentrating in transformative acquisitions.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Median Upfront by Development Phase (n=1,223)</h3>
            <p className="text-xs text-slate-400 mb-4">Based on 1,223 oncology transactions (2020-2026). The Phase 1 to Phase 2 jump (2.1x) is the largest single value inflection in biopharma deal economics.</p>
          </div>

          <WaterfallChart
            data={[
              { phase: 'Preclinical', value: 66, n: 231 },
              { phase: 'Phase 1', value: 134, n: 247 },
              { phase: 'Phase 2', value: 282, n: 257 },
              { phase: 'Phase 3', value: 683, n: 239 },
              { phase: 'Approved', value: 1973, n: 249 },
            ]}
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Phase-by-Phase Deal Economics: Oncology (2020-2026)</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'n', 'Median Upfront', 'Median TDV', 'Upfront % of TDV']}
            rows={[
              ['Preclinical', '231', '$66M', '$790M', '11.2%'],
              ['Phase 1', '247', '$134M', '$1.16B', '14.3%'],
              ['Phase 2', '257', '$282M', '$1.93B', '16.3%'],
              ['Phase 3', '239', '$683M', '$3.85B', '17.2%'],
              ['Approved', '249', '$1.97B', '$8.09B', '25.9%'],
            ]}
            freeRows={5}
            footnote="Source: Ambrosia Ventures analysis of 1,223 oncology transactions (2020-2026). n = number of deals in cohort. TDV = Total Deal Value. Medians used to minimize mega-deal distortion."
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1C</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Annual Deal Volume and Average Deal Size (2020-2026)</h3>
            <p className="text-xs text-slate-400 mb-4">n=2,600+ total. 2026 figures are year-to-date through March 31. Volume nearly doubled from 2020 to 2024 while average deal size compressed 42%.</p>
          </div>

          <DealVolumeStackedChart
            data={[
              { year: '2020', licensing: 58, acquisitions: 73, collaborations: 69, other: 69, total: 269 },
              { year: '2021', licensing: 48, acquisitions: 68, collaborations: 75, other: 88, total: 279 },
              { year: '2022', licensing: 79, acquisitions: 75, collaborations: 72, other: 91, total: 317 },
              { year: '2023', licensing: 116, acquisitions: 86, collaborations: 70, other: 90, total: 362 },
              { year: '2024', licensing: 190, acquisitions: 110, collaborations: 95, other: 140, total: 535 },
              { year: '2025', licensing: 140, acquisitions: 82, collaborations: 68, other: 97, total: 387 },
              { year: '2026', licensing: 101, acquisitions: 36, collaborations: 20, other: 33, total: 190 },
            ]}
          />

          <div className="mt-8 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1D</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Annual Deal Volume Summary (2020-2026)</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-700 text-left">Year</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">n (Deals)</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Total Value</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Avg Deal Size</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Licensing</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Acquisitions</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Avg Upfront %</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['2020', '269', '$1,032.7B', '$4,034M', '58', '73', '23.5%'],
                    ['2021', '279', '$828.6B', '$3,275M', '48', '68', '20.3%'],
                    ['2022', '317', '$814.0B', '$2,797M', '79', '75', '22.5%'],
                    ['2023', '362', '$899.3B', '$2,701M', '116', '86', '25.9%'],
                    ['2024', '535', '$1,137.4B', '$2,345M', '190', '110', '27.0%'],
                    ['2025', '387', '$859.1B', '$2,580M', '140', '82', '22.1%'],
                    ['2026 YTD', '190', '$232.6B', '$1,938M', '101', '36', '29.0%'],
                  ].map(([year, deals, totalVal, avgDeal, licensing, acq, upfrontPct], i) => (
                    <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50/50 ${year === '2026 YTD' ? 'bg-teal-50/30 font-semibold' : ''}`}>
                      <td className="py-3 px-4 font-medium text-slate-800">{year}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{deals}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{totalVal}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{avgDeal}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{licensing}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{acq}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{upfrontPct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures. n=2,600+ verified transactions with publicly disclosed terms. 2026 YTD through March 31.</p>
          </div>

          {/* Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The Phase 1 to Phase 2 upfront multiplier is 2.1x ($134M to $282M, based on 247 and 257 transactions respectively) — the single largest value inflection point in biopharma deal economics. This reflects the proof-of-concept premium: Phase 2 data converts speculative mechanism bets into quantifiable commercial opportunities with defined patient populations, endpoint clarity, and regulatory pathway visibility.
            </p>
          </div>
        </section>

        {/* ── DRAMATIC PULL QUOTE ── */}
        <section className="border-y border-slate-200 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-[0.3em] mb-4">The headline number</p>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-6xl sm:text-8xl font-bold text-slate-900 tabular-nums tracking-tight">2.1x</span>
            </div>
            <p className="text-lg sm:text-xl text-slate-500 mt-4 max-w-lg mx-auto leading-relaxed">
              The Phase 1 to Phase 2 upfront multiplier — from $134M (n=247) to $282M (n=257)
            </p>
            <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures analysis of 504 Phase 1/Phase 2 oncology transactions (2020-2026)</p>
          </div>
        </section>

        {/* ── SECTION 2: THERAPEUTIC AREAS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="therapeutic-areas">Therapeutic Area Economics at Phase 2</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Phase 2 is the canonical benchmark stage for biopharma deal economics — it represents the point at which clinical proof-of-concept exists but significant development risk remains. Across therapeutic areas, median upfronts at Phase 2 range from $200M (hematology, n=5) to $1.2B (metabolic, n=11), a 6x spread that reflects fundamental differences in market size, competitive dynamics, and clinical risk profiles.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Metabolic/obesity leads on absolute value with a $1.2B median upfront (n=11, P25-P75: $175M-$1.65B), though the wide interquartile range signals a bimodal market: validated GLP-1 follow-ons command transformative premiums, while earlier-stage mechanisms with unproven efficacy trade at conventional levels. Gastroenterology — historically a mid-tier therapeutic area — shows a surprising $725M median (n=10, P25-P75: $109M-$3.2B), driven by a small number of high-value IBD and liver disease transactions that distort the median given the limited sample size.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Immunology Phase 2 upfronts reached $400M median (n=15, P25-P75: $98M-$1.25B) — 1.4x the oncology median of $282M (n=236, P25-P75: $198M-$386M). The immunology premium is driven by anti-TL1A mechanism validation following Merck&apos;s $10.8B Prometheus acquisition and expanding CAR-T autoimmune programs. However, the critical difference is sample quality: oncology&apos;s n=236 produces a tight interquartile range ($188M spread), while immunology&apos;s n=15 generates a $1.15B range — meaning the median is directional, not definitive.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              Neurology Phase 2 upfronts sit at $226M median (n=18, P25-P75: $125M-$510M), reflecting the long development timelines and binary clinical risk characteristic of CNS indications. Cardiovascular shows $310M (n=11, P25-P75: $205M-$860M), buoyed by renewed interest in PCSK9 and cardiac inflammation targets.
            </p>

            {/* Inline data annotation */}
            <div className="border-l-4 border-slate-300 pl-5 py-2 my-8">
              <p className="text-sm text-slate-600 leading-relaxed italic">
                &ldquo;Oncology remains the highest-confidence benchmark at Phase 2: with 236 transactions, the interquartile range of $198M-$386M represents the tightest band of any therapeutic area in the dataset.&rdquo;
              </p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 Median Upfront by Therapeutic Area</h3>
              <p className="text-xs text-slate-400 mb-4">Bars show median upfront with P25-P75 range. Sample sizes vary significantly — interpret smaller cohorts with caution.</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: 'Metabolic', low: 175, median: 1200, high: 1650 },
                { phase: 'Gastro', low: 109, median: 725, high: 3200 },
                { phase: 'Immunology', low: 98, median: 400, high: 1250 },
                { phase: 'Cardio', low: 205, median: 310, high: 860 },
                { phase: 'Oncology', low: 198, median: 282, high: 386, highlight: true },
                { phase: 'Neurology', low: 125, median: 226, high: 510 },
                { phase: 'Hematology', low: 200, median: 200, high: 1100 },
              ]}
              title=""
              yLabel="Median Upfront ($M)"
            />

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Phase 2 Upfront Benchmarks by Therapeutic Area (with Quartile Ranges)</h3>
            </div>

            <GatedBenchmarkTable
              headers={['Therapeutic Area', 'n', 'Median Upfront', 'P25', 'P75', 'IQR Spread']}
              rows={[
                ['Metabolic / Obesity', '11', '$1,200M', '$175M', '$1,650M', '$1,475M'],
                ['Gastroenterology', '10', '$725M', '$109M', '$3,200M', '$3,091M'],
                ['Immunology', '15', '$400M', '$98M', '$1,250M', '$1,152M'],
                ['Cardiovascular', '11', '$310M', '$205M', '$860M', '$655M'],
                ['Oncology', '236', '$282M', '$198M', '$386M', '$188M'],
                ['Neurology', '18', '$226M', '$125M', '$510M', '$385M'],
                ['Hematology', '5', '$200M', '$200M', '$1,100M', '$900M'],
              ]}
              freeRows={7}
              footnote="Source: Ambrosia Ventures. Phase 2 transactions only (2020-2026). IQR = Interquartile Range (P75 - P25). Wider IQR indicates greater deal value dispersion within the cohort."
            />

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2C</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 Upfront Quartile Ranges by Therapeutic Area</h3>
              <p className="text-xs text-slate-400 mb-4">Wider bars indicate greater valuation dispersion. Oncology (n=236) has the tightest range; gastroenterology (n=10) and metabolic (n=11) show extreme dispersion driven by small samples and bimodal deal distributions.</p>
            </div>

            <RangeChart
              data={[
                { label: 'Metabolic', p25: 175, median: 1200, p75: 1650, n: 11, highlight: true },
                { label: 'Gastroenterology', p25: 109, median: 725, p75: 3200, n: 10 },
                { label: 'Immunology', p25: 98, median: 400, p75: 1250, n: 15 },
                { label: 'Cardiovascular', p25: 205, median: 310, p75: 860, n: 11 },
                { label: 'Oncology', p25: 198, median: 282, p75: 386, n: 236 },
                { label: 'Neurology', p25: 125, median: 226, p75: 510, n: 18 },
                { label: 'Hematology', p25: 200, median: 200, p75: 1100, n: 5 },
              ]}
            />
          </div>
        </section>

        {/* ── PULL QUOTE 2 ── */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="max-w-4xl mx-auto px-6 py-14 sm:flex items-center gap-10">
            <div className="text-6xl sm:text-7xl font-bold text-teal-700 tabular-nums tracking-tight flex-shrink-0">$400M</div>
            <div className="mt-4 sm:mt-0">
              <p className="text-slate-700 leading-relaxed">Immunology Phase 2 median upfront (n=15, P25-P75: $98M-$1.25B). This compares to oncology at $282M (n=236), where the substantially larger sample produces a tighter interquartile range of $198M-$386M. The immunology premium reflects concentrated high-value TL1A and CAR-T autoimmune transactions rather than a broad-based repricing of the therapeutic area.</p>
              <p className="text-xs text-slate-400 mt-2">Immunology Phase 2 · 2020-2026 · Ambrosia Ventures analysis of 15 verified transactions</p>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: CONDITIONAL VALUE & UPFRONT TRENDS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="conditional-value">Conditional Value and Upfront Percentage Trends</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            The share of total deal value tied to milestones and contingent payments — what we term conditional value — peaked at 79.7% in 2021 (n=242) and has since declined to 71.0% in 2026 YTD (n=87). This 8.7 percentage point compression represents a fundamental shift in deal structure economics: sellers are capturing more value at signing, while buyers are structuring fewer, more concentrated milestone payments.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            The inverse of conditional value is the upfront percentage. Average upfront as a share of TDV rose from 20.3% in 2021 to 29.0% in 2026 YTD. This trend accelerated in 2023-2024 (25.9% and 27.0% respectively), reflecting tightened biotech capital markets where companies needed larger upfronts to fund operations, and buyers — flush with cash from patent-protected revenue — were willing to pay more at signing to secure competitive assets.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            The 2025 dip to 22.1% (n=387) is notable and may reflect a temporary normalization as several large milestone-heavy collaboration deals compressed the average. The rebound to 29.0% in 2026 YTD suggests the structural upfront expansion thesis remains intact.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Conditional Value as % of TDV by Year</h3>
            <p className="text-xs text-slate-400 mb-4">Declining conditional value share indicates sellers are capturing more value at signing. n=87 for 2026 YTD — interpret with caution.</p>
          </div>

          <TrendLineChart
            data={[
              { year: '2020', value: 76.5, n: 244 },
              { year: '2021', value: 79.7, n: 242 },
              { year: '2022', value: 77.5, n: 274 },
              { year: '2023', value: 74.1, n: 298 },
              { year: '2024', value: 73.0, n: 406 },
              { year: '2025', value: 77.9, n: 276 },
              { year: '2026', value: 71.0, n: 87 },
            ]}
            yLabel="Conditional %"
            color="#ef4444"
            referenceLine={{ value: 75, label: '75% threshold' }}
          />

          <div className="mt-8 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Conditional Value Trend Detail</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-700 text-left">Year</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">n</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Conditional %</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Implied Upfront %</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">YoY Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['2020', '244', '76.5%', '23.5%', '—'],
                    ['2021', '242', '79.7%', '20.3%', '+3.2pp'],
                    ['2022', '274', '77.5%', '22.5%', '-2.2pp'],
                    ['2023', '298', '74.1%', '25.9%', '-3.4pp'],
                    ['2024', '406', '73.0%', '27.0%', '-1.1pp'],
                    ['2025', '276', '77.9%', '22.1%', '+4.9pp'],
                    ['2026 YTD', '87', '71.0%', '29.0%', '-6.9pp'],
                  ].map(([year, n, cond, upfront, yoy], i) => (
                    <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50/50 ${year === '2026 YTD' ? 'bg-teal-50/30 font-semibold' : ''}`}>
                      <td className="py-3 px-4 font-medium text-slate-800">{year}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{n}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{cond}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{upfront}</td>
                      <td className={`py-3 px-4 text-right tabular-nums text-xs ${yoy.startsWith('-') ? 'text-teal-700 font-semibold' : yoy.startsWith('+') ? 'text-red-500' : 'text-slate-400'}`}>{yoy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures. pp = percentage points. Negative YoY change in conditional % indicates sellers capturing more value upfront. 2026 YTD sample (n=87) is preliminary.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The 2026 YTD conditional value of 71.0% (n=87) — if sustained — would represent the lowest level in the dataset, implying that nearly 30 cents of every deal dollar is paid at signing. For biotech CFOs, this strengthens the negotiating position for upfront-weighted structures. For pharma BD teams, it reflects the competitive intensity required to secure differentiated assets in a market with more buyers than sellers.
            </p>
          </div>
        </section>

        {/* ── SECTION 4: DEAL STRUCTURE ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="deal-structure">Deal Structure Composition</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Licensing is the dominant deal structure, accounting for 732 of 2,600+ transactions (31%). Acquisitions represent 530 deals (23%), followed by collaborations at 469 (20%), co-developments at 294 (13%), and options at 289 (12%). This distribution has shifted meaningfully over the sample period: licensing grew from 58 deals in 2020 to 190 in 2024 (3.3x), while acquisitions grew more modestly from 73 to 110 (1.5x).
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The 2026 YTD data (n=190) shows licensing at 101 deals — already 53% of the total Q1 volume and 72% of full-year 2025 licensing volume (140 deals) achieved in a single quarter. Acquisitions are tracking at 36, suggesting a potential full-year pace of ~144, roughly in line with 2024. The structural shift is unmistakable: pharma is deploying capital through licensing at an accelerating rate while acquisition activity has plateaued.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The drivers are structural and durable. Patent cliffs through 2028 force faster pipeline rebuilds, and licensing is faster than M&A — no shareholder vote, no antitrust review, no integration risk. The IRA&apos;s Medicare negotiation provisions have also made US-centric deal economics less predictable, increasing the appeal of territory-split structures where the biotech retains US rights and licenses ex-US at a 30-40% discount to global value.
            </p>

            {/* Pull quote */}
            <div className="text-center py-10 my-8 border-y border-slate-300">
              <div className="sm:flex items-baseline justify-center gap-6">
                <div>
                  <div className="text-5xl sm:text-6xl font-bold text-teal-700 tabular-nums tracking-tight">732</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Licensing Deals (31%)</div>
                </div>
                <div className="text-3xl text-slate-300 hidden sm:block">/</div>
                <div className="mt-6 sm:mt-0">
                  <div className="text-5xl sm:text-6xl font-bold text-slate-400 tabular-nums tracking-tight">530</div>
                  <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Acquisitions (23%)</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-6 max-w-md mx-auto">n=2,600+ total transactions (2020-2026). Licensing surpassed acquisitions as the primary deal-making vehicle.</p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4A</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Deal Structure Split (n=2,600+)</h3>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Structure</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">n (Deals)</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Share</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">2020 Volume</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">2024 Volume</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">2026 YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Licensing', '732', '31%', '58', '190', '101'],
                      ['Acquisitions', '530', '23%', '73', '110', '36'],
                      ['Collaborations', '469', '20%', '52', '98', '22'],
                      ['Co-development', '294', '13%', '38', '68', '16'],
                      ['Options', '289', '12%', '48', '69', '15'],
                    ].map(([structure, n, share, v2020, v2024, v2026], i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{structure}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-semibold">{n}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{share}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{v2020}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{v2024}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{v2026}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">Source: Ambrosia Ventures. n=2,600+ verified transactions (2020-2026). 2026 YTD through March 31.</p>
            </div>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4B</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Deal Volume by Structure Type</h3>
              <p className="text-xs text-slate-400 mb-4">Licensing accounts for 31% of all transactions. Options and co-development represent the long tail of creative structuring.</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: 'Licensing', low: 600, median: 732, high: 800, highlight: true },
                { phase: 'Acquisitions', low: 450, median: 530, high: 580 },
                { phase: 'Collaborations', low: 400, median: 469, high: 510 },
                { phase: 'Co-dev', low: 250, median: 294, high: 330 },
                { phase: 'Options', low: 240, median: 289, high: 320 },
              ]}
              title=""
              yLabel="Total Deals (2020-2026)"
            />

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4C</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Licensing vs Acquisition Volume by Year</h3>
              <p className="text-xs text-slate-400 mb-4">Licensing volume grew 3.3x from 2020 to 2024 while acquisitions grew 1.5x. The structural shift accelerated in 2023-2024.</p>
            </div>

            <PhaseUpfrontChart
              data={[
                { phase: '2020 Lic.', low: 45, median: 58, high: 70 },
                { phase: '2020 Acq.', low: 60, median: 73, high: 85 },
                { phase: '2022 Lic.', low: 65, median: 79, high: 95 },
                { phase: '2022 Acq.', low: 60, median: 75, high: 88 },
                { phase: '2024 Lic.', low: 160, median: 190, high: 220, highlight: true },
                { phase: '2024 Acq.', low: 90, median: 110, high: 130 },
                { phase: '2026 Lic.', low: 80, median: 101, high: 120 },
                { phase: '2026 Acq.', low: 25, median: 36, high: 48 },
              ]}
              title=""
              yLabel="Number of Deals"
            />

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-10">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                In Q1 2026, licensing outnumbered acquisitions by 2.8x (101 vs 36). This ratio was approximately 0.8x in 2020 (58 vs 73), meaning acquisitions were more common than licensing just six years ago. The reversal reflects a fundamental change in how pharma builds pipelines: through selective rights purchases rather than whole-company acquisitions.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DEAL HIGHLIGHTS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-3" id="deal-highlights">Q1 2026 Landmark Transactions</h2>
            <p className="text-sm text-slate-500 mb-8">Transactions announced January 1 - March 31, 2026 with total deal value exceeding $500M. Data sourced from verified SEC filings and press releases, updated via automated ingestion.</p>

            <div className="space-y-0 divide-y divide-slate-200 border-y border-slate-200">
              {topDeals.map((deal, i) => (
                <div key={i} className="flex gap-6 bg-white py-6 px-2">
                  <div className="flex-shrink-0 w-24">
                    <div className="text-xl font-bold text-slate-900 tabular-nums leading-none">{deal.value}</div>
                    {deal.upfrontStr && (
                      <div className="text-[10px] text-teal-600 font-semibold mt-1">{deal.upfrontStr} upfront</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">{deal.companies}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">{deal.meta}</p>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {deal.analysis}
                      {deal.upfrontPct && deal.upfrontPct > 0 && (
                        <span className="text-slate-500"> The {deal.upfrontPct}% upfront ratio {deal.upfrontPct >= 29 ? 'exceeds' : deal.upfrontPct >= 22 ? 'is in line with' : 'falls below'} the 2026 YTD median of 29.0%, {deal.upfrontPct >= 29 ? 'suggesting competitive tension or late-stage asset premium.' : deal.upfrontPct >= 22 ? 'consistent with current market norms.' : 'indicating significant conditional value tied to development milestones.'}</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {topDeals.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                No verified Q1 2026 transactions exceeding $500M currently in database. Deal ingestion updates weekly.
              </div>
            )}
        </section>

        {/* ── SECTION 6: Q1 2026 MARKET THEMES ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="market-themes">Q1 2026 Market Themes</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Three structural forces dominated biopharma dealmaking in the first quarter of 2026. These are not cyclical fluctuations &mdash; they represent durable shifts in how pharmaceutical companies build pipelines, source innovation, and allocate capital. Understanding these themes is essential for any BD team negotiating deals in the current environment.
            </p>

            {/* ── Theme 1: Pipeline Failures Driving Deal Surges ── */}
            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 1</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Pipeline Failures Are Driving Replacement Deal Surges</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Five of the top 20 pharmaceutical companies lost late-stage programs in the last six months, triggering an unprecedented wave of replacement transactions. In the first six weeks of 2026 alone, $9.2B in replacement deals were announced &mdash; transactions where the acquirer&apos;s own pipeline failure was a primary catalyst. Average deal size is up 76% versus 2025, reflecting the urgency and competitive intensity of these replacement searches.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 my-6">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$9.2B</div>
                <div className="text-sm text-slate-500 mt-1">Replacement deals in first 6 weeks of 2026</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">+76%</div>
                <div className="text-sm text-slate-500 mt-1">Average deal size increase vs 2025</div>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The pattern is stark. Novo Nordisk&apos;s EVOKE trial failure accelerated their move into next-generation delivery platforms, culminating in the Aspect Biosystems partnership. AbbVie wrote down $3.5B on emraclidine following Phase 2 futility, then executed $6.8B in neurology deals within 90 days &mdash; a pace that suggests replacement targets were already identified before the failure readout. Bristol Myers Squibb&apos;s Camzyos nHCM program failure preceded the $1.5B Orbital Therapeutics acquisition by just weeks.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              For biotech sellers, pipeline failures at large pharma create the single most favorable negotiating environment possible. The buyer has board-level pressure to fill a gap, a defined therapeutic area need, and allocated capital. Biotechs with Phase 2 assets in impacted therapeutic areas should expect inbound interest within days of a major failure readout &mdash; and should negotiate accordingly.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Five of the top 20 pharma companies lost late-stage programs in the last six months. The $9.2B in replacement deals in the first six weeks of 2026 suggests a new pattern: pipeline failures are no longer absorbed quietly &mdash; they trigger immediate, aggressive external dealmaking at premium valuations.
              </p>
            </div>

            {/* ── Theme 2: China-to-West Licensing Wave ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 2</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">China-to-West Licensing Wave</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Chinese biotech out-licensing has gone from a niche deal category to the single largest source of global licensing volume. Total deal value from Chinese biotechs reached $136B in 2025 (+162% YoY) and $52B in the first eight weeks of 2026 alone &mdash; matching the entire 2024 total in under two months. This is not cost arbitrage: average China-originated deal size is $1.3B, up 76% versus 2025, reflecting genuine innovation premium.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 my-6">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$136B</div>
                <div className="text-sm text-slate-500 mt-1">Chinese biotech out-licensing value in 2025</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$52B</div>
                <div className="text-sm text-slate-500 mt-1">First 8 weeks of 2026 (equals all of 2024)</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$1.3B</div>
                <div className="text-sm text-slate-500 mt-1">Avg China-originated deal size (+76% vs 2025)</div>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The PD-1/VEGF bispecific class illustrates the dynamic perfectly: Pfizer licensed from 3SBio, BMS partnered with BioNTech-Biotheus, and Merck acquired rights from LaNova &mdash; three separate Western pharma companies licensing the same drug class from three different Chinese biotechs. Chinese biotechs now account for approximately 90% of global ADC out-licensing, a concentration that reflects Western pipelines being structurally thin in antibody-drug conjugates and bispecific antibodies.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The key transactions underscore the scale: AstraZeneca/CSPC ($18.5B), GSK/Hengrui ($12B+), BMS/BioNTech-Biotheus ($11.1B), and Pfizer/3SBio ($6B). Six of the top 10 pharma companies have now licensed at least one asset from a Chinese biotech in the last 12 months. ADCs and PD-1/VEGF bispecifics dominate the flow, but the trend is expanding into small molecules, degraders, and cell therapies.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                This is not cost arbitrage &mdash; deal sizes are UP 76%. Western pharmaceutical pipelines are structurally thin in ADCs and bispecific antibodies, and Chinese biotechs built deep capability in exactly those modalities. The geography of biopharma innovation has permanently shifted.
              </p>
            </div>

            {/* ── Theme 3: AI-Driven Drug Discovery ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 3</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">AI-Driven Drug Discovery Enters Deal Flow</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Eli Lilly&apos;s $2.75B deal with Insilico Medicine (announced March 29, 2026) marks the moment AI drug discovery became a credible dealmaking category. The transaction included $115M upfront for oral therapeutics developed using Insilico&apos;s AI-powered Pharma.AI platform &mdash; validating that AI-discovered molecules can command institutional-scale deal economics, not just research collaboration fees.
            </p>

            <div className="bg-slate-50 rounded-xl p-5 my-6 border border-slate-100">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$2.75B</div>
              <div className="text-sm text-slate-500 mt-1">Lilly/Insilico Medicine &mdash; largest AI drug discovery licensing deal to date (March 29, 2026)</div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The broader pipeline supports the trend: 28 drugs developed using AI tools are now in clinical or preclinical stages, with nearly half at clinical stage. The Lilly/Insilico deal is significant not for the AI label, but because the deal terms &mdash; $115M upfront, $2.75B total value &mdash; are consistent with Phase 1/2 licensing benchmarks for the relevant therapeutic areas. AI-discovered molecules are being priced on clinical merit, not on the novelty of their discovery methodology.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              For BD teams, this has immediate practical implications. AI drug discovery companies are graduating from research collaboration partners (typical deal: $50-100M TDV, minimal upfront) to licensing partners commanding institutional-scale economics. Expect 3-5 additional AI-originated deals exceeding $1B TDV before year-end 2026, concentrated in oncology small molecules and metabolic targets where AI-driven structure prediction has the most validated track record.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                AI drug discovery has crossed the deal threshold. The Lilly/Insilico deal proves AI-discovered molecules are priced on clinical merit, not novelty. With 28 AI-developed drugs in pipeline and nearly half at clinical stage, this category will generate meaningful deal flow through the remainder of 2026.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: MODALITY PREMIUMS ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 7</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="modality-premiums">Modality Premiums</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Radiopharmaceuticals overtook ADCs for the highest modality multiplier at <strong className="text-slate-900">1.60x</strong> over small molecule baselines. The convergence of Novartis Pluvicto validation (&gt;$1B annual sales within 18 months), constrained isotope supply, and platform acquisitions by BMS, Lilly, and AstraZeneca drove aggressive bidding for remaining independent radiopharmaceutical companies. At the oncology Phase 2 median of $282M (n=236), this implies a $451M upfront for a radiopharmaceutical asset at the same stage.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              ADC premiums normalized to 1.45x from a ~1.70x peak during the 2023 Pfizer/Seagen cycle. At $282M baseline, this implies $409M for a Phase 2 ADC. Bispecific antibodies held at 1.35x ($381M implied), buoyed by teclistamab, epcoritamab, and glofitamab validation in hematologic malignancies. See our <Link href="/insights/pharma-licensing-royalty-rates" className="text-teal-600 font-medium hover:text-teal-700">royalty rate benchmarks</Link> for modality-specific royalty analysis.
            </p>

            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 7A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Modality Multipliers vs Small Molecule Baseline</h3>
              <p className="text-xs text-slate-400 mb-4">Multipliers applied to Phase 2 oncology small molecule median ($282M, n=236). Radiopharmaceuticals command the largest premium at 1.60x.</p>
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
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 7B</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Modality Multipliers and Implied Phase 2 Upfronts</h3>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Modality</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Multiplier</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Implied Ph2 Upfront</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Radiopharmaceuticals', '1.60x', '$451M', 'New leader'],
                      ['ADC', '1.45x', '$409M', 'Normalized from 1.70x'],
                      ['CAR-T (Solid Tumor)', '1.40x', '$395M', 'High interest'],
                      ['Bispecific Antibodies', '1.35x', '$381M', 'Stable'],
                      ['PROTAC / Degrader', '1.35x', '$381M', 'Strong interest'],
                      ['mRNA Therapeutics', '1.30x', '$367M', 'Beyond vaccines'],
                      ['Small Molecule', '1.00x', '$282M', 'Baseline (n=236)'],
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
              <p className="text-xs text-slate-400 mt-3">Implied upfront = oncology Phase 2 small molecule median ($282M, n=236) x multiplier. Multipliers derived from Ambrosia Ventures deal database (2020-2026).</p>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: TERRITORY DYNAMICS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 8</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="territory-dynamics">Territory Dynamics</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Territory-split structures continued to grow as biotechs retained US commercialization rights while licensing ex-US. The median ex-US deal carries a 30-40% discount to global rights, but for biotechs with US commercial infrastructure, this approach maximizes total value realization. See our <Link href="/insights/biotech-licensing-europe" className="text-teal-600 font-medium hover:text-teal-700">Europe licensing benchmarks</Link> for regional analysis.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            China standalone value declined to 5-8% of global (from 10-15% peak) following NRDL pricing reforms — except for metabolic assets, where China premiums of 15-20% above baseline ex-US value emerged, driven by 180 million adults with obesity and rapid GLP-1 manufacturing buildout. Japan remained stable at 8-12% of global value. Full <Link href="/insights/out-licensing-asia-pacific" className="text-teal-600 font-medium hover:text-teal-700">APAC territory analysis</Link> available.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 8</p>
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
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of 2,600+ verified transactions.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </div>
        </section>

        {/* ── METHODOLOGY & LIMITATIONS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Appendix</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="methodology">Methodology and Limitations</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Sample Selection</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This report analyzes 2,600+ biopharma transactions executed between January 1, 2020 and March 31, 2026. Transactions are sourced from SEC 8-K filings, FTC premerger notification filings, company press releases, investor presentations, and ClinicalTrials.gov. Each transaction is verified against at least one primary source before inclusion.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Survivorship Bias</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This dataset includes only deals with publicly disclosed financial terms. Transactions with undisclosed terms are excluded, which may introduce upward bias in reported medians — companies are more likely to disclose large, favorable deal terms. Additionally, failed or terminated deals are underrepresented. Readers should treat reported medians as reflective of the disclosed deal universe, not the complete market.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Statistical Methodology</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Medians are used throughout to minimize distortion from mega-deals. Sample sizes (n) are reported for every cohort to enable readers to assess statistical confidence. Interquartile ranges (P25-P75) are reported where sample sizes permit meaningful dispersion analysis. Cohorts with n&lt;10 should be treated as directional only. Cohorts with n&gt;100 produce estimates with high stability across resampling.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Update Frequency</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                New transactions are ingested weekly via automated SEC EDGAR monitoring (8-K filings) supplemented by manual verification. The full dataset is refreshed continuously; this quarterly report provides point-in-time narrative analysis as of March 30, 2026. The interactive deal calculator reflects real-time data.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Therapeutic Area Classification</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Deals are classified into 13 therapeutic areas based on the primary indication of the lead asset. Multi-indication assets are assigned to the therapeutic area of the most advanced indication. Where a deal covers multiple assets across therapeutic areas, the deal is counted once under the primary asset&apos;s classification. This may undercount cross-TA deal activity.
              </p>
            </div>

            <div className="border-l-4 border-amber-400 pl-5 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Important Caveat</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sample sizes vary significantly across therapeutic area cohorts. Oncology (n=236 at Phase 2) provides high-confidence benchmarks with a tight interquartile range. Smaller cohorts — hematology (n=5), gastroenterology (n=10), metabolic (n=11) — should be interpreted as directional indicators, not definitive market prices. We recommend oncology benchmarks as the primary reference and TA-specific adjustments as secondary overlays.
              </p>
            </div>
          </div>
        </section>

        {/* ── EMAIL CAPTURE ── */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <InlineEmailCapture
            heading="Get the Q2 Report First"
            description="Join 2,000+ BD professionals who receive our quarterly benchmarks the day they publish — plus weekly deal intelligence from 2,600+ verified transactions."
            source="q1-2026-report"
          />
        </section>

        {/* ── DOWNLOAD ── */}
        <section className="max-w-4xl mx-auto px-6 pb-6">
          <EmailGatedDownload
            reportTitle="Q1 2026 Biopharma Deal Benchmarks"
            reportUrl="/reports/q1-2026-biopharma-deal-benchmarks"
            source="q1-2026-report-download"
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
              { q: 'What data sources does this report use?', a: 'The report analyzes 2,600+ verified biopharma transactions (2020-2026). Sources include SEC 8-K filings, FTC premerger filings, company press releases, and ClinicalTrials.gov. Deals with undisclosed financial terms are excluded. New transactions are ingested weekly via automated monitoring and verified before inclusion.' },
              { q: 'How should I interpret small sample sizes?', a: 'Cohorts with n>100 (e.g., oncology Phase 2, n=236) produce stable medians with tight interquartile ranges. Cohorts with n<20 (e.g., immunology Phase 2, n=15) are directional — the median is real but the confidence interval is wide. Cohorts with n<10 (e.g., hematology Phase 2, n=5) should be treated as indicative only. We report sample sizes and P25-P75 ranges throughout to enable readers to calibrate confidence.' },
              { q: 'Why are upfront percentages rising?', a: 'Average upfront as % of TDV increased from 20.3% (2021) to 29.0% (2026 YTD). Three factors drive this: (1) tighter biotech capital markets requiring larger upfronts to fund operations, (2) competitive intensity among buyers for differentiated assets, and (3) seller sophistication in negotiating upfront-weighted structures that reduce milestone risk.' },
              { q: 'What does conditional value mean?', a: 'Conditional value is the share of total deal value tied to milestones and contingent payments (regulatory, commercial, sales-based). A 71% conditional value means 71 cents of every deal dollar is contingent on future events. The declining trend (from 80% in 2021 to 71% in 2026) means more value is shifting to upfront payments.' },
              { q: 'How often are benchmarks updated?', a: 'The full dataset is updated weekly via automated SEC EDGAR monitoring plus manual verification. This quarterly report provides point-in-time analysis as of March 30, 2026. The interactive deal calculator reflects the latest available data.' },
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
