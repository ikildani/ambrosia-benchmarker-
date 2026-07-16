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
import { DEAL_STATS } from '@/lib/config/constants';

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
  title: `Q2 2026 Biopharma Deal Benchmarks Report: Analysis of ${DEAL_STATS.TOTAL_DEALS} Transactions | Ambrosia Ventures`,
  description: `Institutional-grade quarterly analysis of biopharma deal economics across 12 therapeutic areas. Phase-by-phase benchmarks, risk-adjusted deal timing, royalty rate analysis, modality cycle tracking, and deal structure evolution from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`,
  keywords: ['biopharma deal benchmarks Q2 2026', 'pharma deal economics 2026', 'biopharma licensing benchmarks', 'phase 2 vs phase 3 deal economics', 'radiopharmaceutical deals', 'ADC deal benchmarks', 'royalty rate benchmarks biopharma', 'metabolic deal premiums', 'GLP-1 licensing deals', 'China biotech out-licensing'],
  openGraph: {
    title: 'Q2 2026 Biopharma Deal Benchmarks Report',
    description: `Institutional-grade analysis of biopharma deal economics from ${DEAL_STATS.TOTAL_DEALS} verified transactions. Risk-adjusted phase economics, royalty benchmarks, modality cycles, and 4 market themes reshaping dealmaking.`,
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/reports/q2-2026-biopharma-deal-benchmarks',
    images: [{ url: '/api/og?title=Q2%202026%20Biopharma%20Deal%20Benchmarks&subtitle=Risk-Adjusted%20Phase%20Economics%20%7C%20Royalty%20Rates%20%7C%20Modality%20Cycles&type=insight', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: `Q2 2026 Biopharma Deal Benchmarks: ${DEAL_STATS.TOTAL_DEALS} Transactions Analyzed`, description: 'Phase 2 is the risk-adjusted optimal exit. Radiopharms +1,408%. ADC premiums normalizing. Royalty rates 3-25% by phase. 4 themes reshaping biopharma dealmaking.' },
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/reports/q2-2026-biopharma-deal-benchmarks' },
};

export const revalidate = 21600;

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

  if (d.upfront_usd) {
    const milestones = tdvM - upM;
    const fmtMilestones = milestones >= 1000 ? `$${(milestones / 1000).toFixed(1)}B` : `$${Math.round(milestones)}M`;
    if (d.deal_type === 'acquisition') {
      lines.push(`${fmtUp} all-cash acquisition.`);
    } else {
      lines.push(`${fmtUp} upfront (${upPct}% of ${fmtTdv} total value) with up to ${fmtMilestones} in development, regulatory, and commercial milestones.`);
    }
  }

  if (d.asset_name) {
    lines.push(d.asset_name + '.');
  }

  const taMedian = TA_PHASE2_MEDIANS[d.therapeutic_area];
  if (taMedian && d.upfront_usd && d.phase_at_signing) {
    const multiple = (upM / taMedian).toFixed(1);
    if (parseFloat(multiple) > 1.5) {
      const phase = (d.phase_at_signing || '').replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
      lines.push(`At ${multiple}x the ${d.therapeutic_area} Phase 2 median upfront, this reflects significant premium for ${phase}-stage de-risking.`);
    }
  }

  if (d.verification_notes && d.verification_notes.length > 20) {
    const notes = d.verification_notes;
    if (notes.includes('patent cliff')) lines.push('Driven by acquirer patent cliff diversification pressure.');
    if (notes.includes('Orphan Drug')) lines.push('Orphan Drug and Fast Track designated by FDA.');
    if (notes.includes('AI')) lines.push('Signals growing conviction in AI-discovered molecule deal flow.');
    if (notes.includes('BBB') || notes.includes('blood-brain')) lines.push('Signals growing conviction in blood-brain barrier delivery platforms.');
    if (notes.includes('GLP-1') || notes.includes('obesity')) lines.push('Reflects metabolic/obesity pipeline premium amid $100B+ addressable market.');
    if (notes.includes('radiopharm') || notes.includes('isotope')) lines.push('Part of the radiopharmaceutical land grab — constrained supply driving aggressive bidding.');
  }

  return lines.join(' ');
}

async function getTopDeals() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('deals')
      .select('licensee_name, licensor_name, asset_name, total_deal_value_usd, upfront_usd, deal_type, therapeutic_area, announced_date, phase_at_signing, indication_category, modality, verification_notes')
      .gte('announced_date', '2026-04-01')
      .lte('announced_date', '2026-06-30')
      .gte('total_deal_value_usd', 500000000)
      .eq('verified', true)
      .order('total_deal_value_usd', { ascending: false })
      .limit(10);

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
        companies: `${d.licensor_name} → ${d.licensee_name}`,
        meta: `${ta} · ${type} · ${date}`,
        upfrontStr,
        upfrontPct,
        assetName: d.asset_name || '',
        tdv: d.total_deal_value_usd,
        analysis: generateDealAnalysis(d),
      };
    });
  } catch (err) {
    console.error('[Q2 Report] Failed to fetch deals:', err);
    return [];
  }
}

async function getQ1DealCount() {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .gte('announced_date', '2026-01-01')
      .lte('announced_date', '2026-03-31')
      .eq('verified', true);
    return count || 190;
  } catch { return 190; }
}

async function getQ2DealCount() {
  try {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .gte('announced_date', '2026-04-01')
      .lte('announced_date', '2026-06-30')
      .eq('verified', true);
    return count || 0;
  } catch { return 0; }
}

export default async function Q2BenchmarkReportPage() {
  const topDeals = await getTopDeals();
  const q1Count = await getQ1DealCount();
  const q2Count = await getQ2DealCount();

  const breadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
    { '@type': 'ListItem', position: 2, name: 'Reports', item: 'https://calculator.ambrosiaventures.co/reports' },
    { '@type': 'ListItem', position: 3, name: 'Q2 2026 Biopharma Deal Benchmarks' },
  ]};
  const articleSchema = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Q2 2026 Biopharma Deal Benchmarks Report', author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' }, datePublished: '2026-07-15', dateModified: '2026-07-15', publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } } };
  const datasetSchema = { '@context': 'https://schema.org', '@type': 'Dataset', name: 'Q2 2026 Biopharma Deal Benchmarks', description: `Phase-by-phase upfront payments, risk-adjusted economics, royalty rates, and deal structure evolution from ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions (2020-2026).`, creator: { '@type': 'Organization', name: 'Ambrosia Ventures' }, temporalCoverage: '2020/2026' };
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
    { '@type': 'Question', name: 'What is the risk-adjusted optimal exit point for biotech assets?', acceptedAnswer: { '@type': 'Answer', text: 'Based on analysis of 1,500+ deals, Phase 2 proof-of-concept is the risk-adjusted optimal exit for most single-asset biotechs. Phase 3 median upfront is $678M vs $300M at Phase 2, but after subtracting $200-500M in trial costs and accounting for 40-50% Phase 3 failure rates, the expected value of holding to Phase 3 is lower than the certain Phase 2 exit value.' } },
    { '@type': 'Question', name: 'What are current biopharma royalty rate benchmarks?', acceptedAnswer: { '@type': 'Answer', text: 'Royalty rates range from 3-7% at discovery to 18-25% for approved assets. At Phase 2, ADCs command the highest median royalty at 14%, followed by radiopharmaceuticals at 13.5% and bispecifics at 12.5%. Over 70% of licensing deals now employ tiered royalty structures with escalation clauses tied to sales thresholds.' } },
    { '@type': 'Question', name: 'How have ADC deal premiums changed?', acceptedAnswer: { '@type': 'Answer', text: 'ADC premiums peaked at ~1.70x during the 2023 Pfizer/Seagen cycle ($371.8B total ADC deal value). They have since normalized to 1.45x over small molecule baselines, with total ADC deal value declining from $371.8B (2023) to $104.4B (2024) to $36.7B (2025 through Q3). The market is shifting from platform acquisitions to focused single-asset licensing.' } },
  ]};

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="q2-2026" />
      <StickyTOC sections={[
        { id: 'market-overview', label: 'Market Overview', number: 1 },
        { id: 'phase-economics', label: 'Phase Economics', number: 2 },
        { id: 'therapeutic-areas', label: 'Therapeutic Areas', number: 3 },
        { id: 'modality-premiums', label: 'Modality Cycles', number: 4 },
        { id: 'royalty-rates', label: 'Royalty Rates', number: 5 },
        { id: 'deal-structure', label: 'Deal Structure', number: 6 },
        { id: 'deal-highlights', label: 'Q2 Highlights', number: 7 },
        { id: 'market-themes', label: 'Market Themes', number: 8 },
        { id: 'territory-dynamics', label: 'Territory', number: 9 },
        { id: 'qq-dashboard', label: 'Q1 vs Q2', number: 10 },
        { id: 'deal-anatomy', label: 'Deal Anatomy', number: 11 },
        { id: 'outlook', label: 'H2 Outlook', number: 12 },
        { id: 'methodology', label: 'Methodology', number: 13 },
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
            <Link href="/reports/q1-2026-biopharma-deal-benchmarks" className="text-xs text-slate-400 hover:text-white transition-colors">Q1 Report</Link>
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
            <span className="text-slate-500">Q2 2026</span>
          </nav>

          <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-[0.25em] mb-6">Quarterly Report &middot; July 2026</p>

          <div className="sm:flex items-end gap-10 mb-8">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-[3.5rem] font-bold text-slate-900 leading-[1.05] tracking-tight mb-4">
                Biopharma Deal<br className="hidden sm:block" /> Benchmarks
              </h1>
              <p className="text-base text-slate-500 max-w-xl leading-relaxed">
                A quarterly analysis of deal economics across 12 therapeutic areas, drawn from {DEAL_STATS.TOTAL_DEALS} verified transactions. This edition introduces risk-adjusted phase economics, royalty rate benchmarks, modality cycle tracking, and quarter-over-quarter comparisons.
              </p>
            </div>
            <div className="mt-6 sm:mt-0 flex-shrink-0 text-right">
              <div className="text-[5.5rem] sm:text-[7rem] font-bold text-slate-900 leading-none tracking-tight tabular-nums">$300<span className="text-[3rem] sm:text-[4rem] text-slate-400 font-normal">M</span></div>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">Phase 2 Median Upfront</p>
              <p className="text-[11px] text-teal-600 font-semibold uppercase tracking-wide">Risk-Adjusted Optimal Exit</p>
            </div>
          </div>

          <div className="border-t border-b border-slate-200 py-5 mb-8">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-6">
              {[
                { value: DEAL_STATS.TOTAL_DEALS, label: 'Verified Deals' },
                { value: '12', label: 'Therap. Areas' },
                { value: '$678M', label: 'Ph3 Median Upfront' },
                { value: String(q2Count || '—'), label: 'Q2 2026 Deals' },
                { value: '1.60x', label: 'Radiopharm Premium' },
                { value: '14%', label: 'ADC Median Royalty' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-lg font-bold text-slate-900 tabular-nums">{stat.value}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400 uppercase tracking-wider">
            <span>Published July 15, 2026</span>
            <span className="text-slate-300">&middot;</span>
            <span>Ambrosia Ventures Research</span>
            <span className="text-slate-300">&middot;</span>
            <span>35 min read</span>
          </div>
        </div>
      </header>

      {/* ── WHAT'S NEW BANNER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold text-slate-900 bg-teal-400 rounded-full px-2.5 py-0.5 uppercase tracking-wider">New in Q2</span>
            <span className="text-xs text-slate-400">This edition introduces 4 new analytical frameworks not available in Q1</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: 'Risk-Adjusted Phase Economics', desc: 'Expected value math proving Phase 2 > Phase 3 for most biotechs', section: '#phase-economics' },
              { title: 'Royalty Rate Benchmarks', desc: 'First-ever royalty analysis by phase (3-25%) and modality', section: '#royalty-rates' },
              { title: 'Deal Anatomy: Prometheus', desc: '$10.8B case study dissected against engine benchmarks', section: '#deal-anatomy' },
              { title: 'H2 2026 Outlook', desc: '4 predictions for the second half based on deal data', section: '#outlook' },
            ].map(({ title, desc, section }, i) => (
              <a key={i} href={section} className="group block bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-colors">
                <div className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">{title}</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug">{desc}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARY ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-6">Executive Summary</h2>
          <div className="space-y-5">
            {[
              { num: 1, bold: 'Phase 2 proof-of-concept is the risk-adjusted optimal exit for most single-asset biotechs.', text: `Phase 3 median upfront is $678M versus $300M at Phase 2 — but Phase 3 trials cost $200–500M, take 2–3 years, and fail 40–50% of the time. Risk-adjust the Phase 3 upside, subtract trial costs, and Phase 2 delivers higher expected value with certainty. Merck's $10.8B acquisition of Prometheus Biosciences — on Phase 2 data alone — illustrates this dynamic at scale.` },
              { num: 2, bold: 'Radiopharmaceuticals command the highest modality premium at 1.60x.', text: 'Radiopharmaceuticals overtook ADCs as the highest-premium modality, driven by Novartis Pluvicto validation (>$1B annual sales within 18 months), constrained isotope supply, and platform acquisitions by BMS, Lilly, and AstraZeneca. At the oncology Phase 2 baseline of $282M, this implies a $451M upfront for a radiopharmaceutical asset at the same stage.' },
              { num: 3, bold: 'ADC premiums are normalizing from the 2023 peak.', text: 'Total ADC deal value peaked at $371.8B in 2023 (driven by Pfizer/Seagen $43B), declined to $104.4B in 2024 and $36.7B through Q3 2025. The multiplier compressed from ~1.70x to 1.45x. The market is shifting from platform acquisitions to focused single-asset licensing with greater emphasis on target differentiation and payload novelty.' },
              { num: 4, bold: 'Metabolic/obesity commands the highest Phase 2 total deal values.', text: 'Metabolic Phase 2 median TDV reached $2.0B — highest of any therapeutic area — driven by GLP-1 commercial validation and addressable markets exceeding $100B annually. The Phase 2 to Phase 3 multiplier of 3.5x is also the highest across all TAs, reflecting outsized conviction in metabolic assets with proof-of-concept data.' },
              { num: 5, bold: 'Royalty rates span 3–25%, with tiered structures in 70%+ of deals.', text: 'Royalties escalate 2–5 percentage points per development phase. ADCs command the highest Phase 2 median royalty at 14%, followed by radiopharmaceuticals (13.5%) and bispecifics (12.5%). Over 70% of licensing deals now employ tiered escalation clauses tied to sales thresholds — a structural shift from flat-rate royalties that reflects growing alignment between licensor and licensee incentives.' },
              { num: 6, bold: 'Upfront percentages continue rising as conditional value compresses.', text: 'Average upfront as a percentage of TDV increased from 20.3% (2021) to 29.0% (2026 YTD). Conditional value share declined from 79.7% to 71.0% over the same period. Sellers are negotiating more cash at signing — reflecting tighter biotech capital markets and reduced appetite for milestone-heavy packages with uncertain timelines.' },
              { num: 7, bold: 'Option deals have more than doubled in share since 2020.', text: 'Option agreements grew from 8% of deal structures in 2020 to 18% in 2025. The structure offers buyers lower upfront commitment with the right (not obligation) to acquire or license after seeing data. For sellers, options provide non-dilutive funding with the potential for full-value transactions at exercise — but carry the risk of option lapse if data disappoints.' },
              { num: 8, bold: 'China-to-West licensing continues to accelerate.', text: 'Chinese biotech out-licensing reached $136B in 2025 (+162% YoY) and $52B in the first 8 weeks of 2026 alone. Average deal size is $1.3B (+76% vs 2025). ADCs and PD-1/VEGF bispecifics dominate, with six of the top 10 pharma companies licensing from Chinese biotechs in the last 12 months. This is no longer an emerging trend — it is a structural feature of the global deal landscape.' },
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
            The biopharma deal market expanded significantly through 2024, with annual transaction volume rising from 269 deals in 2020 to 535 in 2024 &mdash; a compound annual growth rate of 18.7%. Total disclosed deal value peaked in 2020 at $1.03 trillion (n=269, average $4.0B per deal), reflecting several mega-transactions, before normalizing to $814B&ndash;$900B annually through 2022&ndash;2023. The 2024 cycle saw a resurgence: $1.14 trillion across 535 deals, though the average deal size of $2.3B was 42% below the 2020 peak, indicating a structural shift toward higher-volume, lower-value transactions.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            Through the first half of 2026, deal velocity has remained elevated. Q1 recorded {q1Count} transactions and Q2 added {q2Count || '—'} more, putting the year on pace for approximately 760&ndash;800 deals &mdash; which would be the highest annual count on record. Average deal size continues to compress, now at $1.9B, reflecting buyers distributing capital across more transactions with tighter risk-sharing structures rather than concentrating in transformative acquisitions.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Oncology Median Upfront by Development Phase (n=1,223)</h3>
            <p className="text-xs text-slate-400 mb-4">Based on 1,223 oncology transactions (2020&ndash;2026). The Phase 1 to Phase 2 jump (2.1x) is the largest single value inflection in biopharma deal economics.</p>
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
            <h3 className="text-base font-bold text-slate-900 mb-4">Phase-by-Phase Deal Economics: All Therapeutic Areas (2020&ndash;2026)</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'n', 'Median Upfront', 'Median TDV', 'Upfront % of TDV']}
            rows={[
              ['Preclinical', '420', '$82M', '$888M', '9.7%'],
              ['Phase 1', '350', '$140M', '$1.21B', '11.1%'],
              ['Phase 2', '426', '$300M', '$1.80B', '14.2%'],
              ['Phase 3', '345', '$678M', '$3.50B', '16.8%'],
              ['Approved', '364', '$1.96B', '$6.75B', '26.5%'],
            ]}
            freeRows={5}
            footnote={`Source: Ambrosia Ventures analysis of ${DEAL_STATS.TOTAL_DEALS} transactions (2020-2026). n = deals in cohort. TDV = Total Deal Value. Medians minimize mega-deal distortion. Phase 1→2 multiple: 2.1x upfront. Phase 2→3 multiple: 2.3x upfront.`}
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1C</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Annual Deal Volume and Average Deal Size (2020&ndash;2026)</h3>
            <p className="text-xs text-slate-400 mb-4">Transaction count surged 99% from 2020 to 2024 while average deal size compressed 42%. 2026 is pacing for ~760&ndash;800 deals &mdash; a new annual record.</p>
          </div>

          <DealVolumeStackedChart />
        </section>

        {/* ── DRAMATIC PULL QUOTE ── */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
              &ldquo;Phase 2 proof-of-concept is the single most valuable inflection point in biopharma deal economics.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-slate-400">Risk-adjusted analysis of {DEAL_STATS.TOTAL_DEALS} verified transactions (2020&ndash;2026)</p>
          </div>
        </section>

        {/* ── SECTION 2: PHASE ECONOMICS DEEP DIVE (NEW) ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="phase-economics">Risk-Adjusted Phase Economics: When to Exit</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            The conventional wisdom in biotech dealmaking is straightforward: more clinical data equals a higher exit price. Phase 3 median upfront ($678M) is 2.3x Phase 2 ($300M). On paper, holding to Phase 3 is the clear winner.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            But the paper calculation ignores three factors that fundamentally alter the math: Phase 3 trial costs ($200&ndash;$500M), timeline (2&ndash;3 years), and failure rates (40&ndash;50%). When you risk-adjust the Phase 3 upside and subtract the capital required to get there, Phase 2 proof-of-concept emerges as the stronger exit for most single-asset biotechs.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$300M</div>
              <div className="text-sm text-slate-500 mt-1">Phase 2 median upfront</div>
              <div className="text-xs text-teal-600 font-semibold mt-1">Certain value at signing</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$678M</div>
              <div className="text-sm text-slate-500 mt-1">Phase 3 median upfront</div>
              <div className="text-xs text-amber-600 font-semibold mt-1">Contingent on trial success</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="text-3xl font-bold text-red-700 tabular-nums">40&ndash;50%</div>
              <div className="text-sm text-slate-500 mt-1">Phase 3 failure rate</div>
              <div className="text-xs text-red-600 font-semibold mt-1">Across all therapeutic areas</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$20&ndash;50M</div>
              <div className="text-sm text-slate-500 mt-1">Salvage value on failure</div>
              <div className="text-xs text-slate-400 font-semibold mt-1">Platform IP + residual assets</div>
            </div>
          </div>

          {/* ── Decision Tree Visual ── */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Decision Tree: Sell at Phase 2 vs. Hold to Phase 3</h3>
            <p className="text-xs text-slate-400 mb-4">Visual representation of the risk-adjusted exit decision. Follow the branches to see expected values at each node.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Decision node */}
              <div className="flex items-center justify-center mb-8">
                <div className="bg-slate-900 text-white rounded-xl px-6 py-4 text-center shadow-lg">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Decision Point</div>
                  <div className="text-sm font-bold">Phase 2 PoC Data In Hand</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* LEFT: Sell at Phase 2 */}
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-teal-400" />
                  </div>
                  <div className="bg-teal-50 border-2 border-teal-400 rounded-xl p-5 text-center relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-500 text-white text-[10px] font-bold rounded-full px-3 py-0.5 uppercase tracking-wider">Path A: Sell</div>
                    <div className="text-3xl font-bold text-teal-700 tabular-nums mt-2">$300M</div>
                    <div className="text-xs text-teal-600 font-semibold mt-1">100% certain</div>
                    <div className="text-xs text-slate-500 mt-2">No trial cost. No timeline risk. No dilution.</div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-px h-6 bg-teal-400" />
                  </div>
                  <div className="bg-teal-500 text-white rounded-xl p-4 text-center shadow-md">
                    <div className="text-[10px] uppercase tracking-wider text-teal-100">Expected Value</div>
                    <div className="text-2xl font-bold tabular-nums">$300M</div>
                  </div>
                </div>

                {/* RIGHT: Hold to Phase 3 */}
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-slate-300" />
                  </div>
                  <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-5 text-center relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-600 text-white text-[10px] font-bold rounded-full px-3 py-0.5 uppercase tracking-wider">Path B: Hold</div>
                    <div className="text-xs text-slate-500 mt-2 mb-3">Run Phase 3 trial: $350M cost, 2&ndash;3 years</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">55% Success</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums">$678M</div>
                        <div className="text-[10px] text-red-500">&minus;$350M trial</div>
                        <div className="text-sm font-semibold text-slate-700 tabular-nums mt-1">= $328M</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">45% Failure</div>
                        <div className="text-lg font-bold text-red-600 tabular-nums">$35M</div>
                        <div className="text-[10px] text-red-500">&minus;$350M trial</div>
                        <div className="text-sm font-semibold text-red-600 tabular-nums mt-1">= &minus;$315M</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-px h-6 bg-slate-300" />
                  </div>
                  <div className="bg-slate-200 text-slate-800 rounded-xl p-4 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Weighted Expected Value</div>
                    <div className="text-2xl font-bold tabular-nums">$38M</div>
                    <div className="text-[10px] text-red-600 font-semibold mt-1">7.9x lower than Phase 2 exit</div>
                  </div>
                </div>
              </div>

              {/* Bottom comparison bar */}
              <div className="mt-8 pt-6 border-t-2 border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-teal-500" />
                    <span className="text-sm font-semibold text-slate-700">Sell at Phase 2: <span className="text-teal-700">$300M</span></span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">Phase 2 wins by $262M in expected value</div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Hold to Phase 3: <span className="text-slate-500">$38M</span></span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">Trial cost: $350M midpoint ($200&ndash;$500M range). Salvage: $35M midpoint ($20&ndash;$50M). Phase 3 success: 55%. Upfronts are median values from Ambrosia Ventures deal database ({DEAL_STATS.TOTAL_DEALS} transactions). Individual assets may deviate significantly from medians.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The expected value of selling at Phase 2 ($300M) is nearly 8x the expected value of holding to Phase 3 ($38M) when trial costs and failure rates are factored in. For single-asset biotechs without the capital reserves to absorb a Phase 3 failure, the risk-adjusted case for exiting at Phase 2 is overwhelming. The founders who capture the most value are not the ones who hold longest &mdash; they are the ones who recognize when their risk-adjusted value has peaked.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 &rarr; Phase 3 Multiplier by Therapeutic Area</h3>
            <p className="text-xs text-slate-400 mb-4">All therapeutic areas show a 2.1x&ndash;3.5x multiplier from Phase 2 to Phase 3 upfront. Metabolic commands the highest multiplier (3.5x) but also carries the highest absolute Phase 3 trial costs ($300&ndash;$600M).</p>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Ph2 Median Upfront', 'Ph3 Median Upfront', 'Ph2→Ph3 Multiple', 'Ph3 Trial Cost']}
            rows={[
              ['Metabolic/Obesity', '$150M', '$400M', '3.5x', '$300–600M'],
              ['Immunology', '$120M', '$300M', '2.6x', '$200–400M'],
              ['Neurology', '$75M', '$180M', '2.8x', '$250–500M'],
              ['Oncology', '$95M', '$230M', '2.5x', '$200–450M'],
              ['Hematology', '$80M', '$200M', '2.4x', '$150–300M'],
              ['Rare Disease', '$60M', '$140M', '2.3x', '$100–250M'],
            ]}
            freeRows={4}
            footnote="Source: Ambrosia Ventures deal database. Phase 3 trial costs estimated from industry benchmarks and adjusted by therapeutic area complexity, endpoint requirements, and typical enrollment size."
          />

          <p className="text-slate-700 leading-relaxed mt-8 mb-5">
            The risk-adjusted calculus varies by therapeutic area. Metabolic assets show the highest Phase 2&rarr;3 multiplier (3.5x) but also carry the highest Phase 3 trial costs ($300&ndash;$600M for large-scale cardiovascular outcomes trials). Rare disease assets have the lowest multiplier (2.3x) but substantially lower trial costs ($100&ndash;$250M) and higher Phase 3 success rates due to smaller, more defined patient populations and regulatory pathway advantages.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            BD teams should map their specific asset&apos;s risk-adjusted value curve before entering exit discussions. The interactive calculator below models this across all therapeutic areas and modalities.
          </p>
        </section>

        {/* ── PULL QUOTE 2 ── */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
              &ldquo;Immunology, not oncology, commands the highest Phase 2 premiums &mdash; $400M median upfront versus $282M for oncology.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-slate-400">Driven by anti-TL1A mechanisms and CAR-T autoimmune applications</p>
          </div>
        </section>

        {/* ── SECTION 3: THERAPEUTIC AREA ECONOMICS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="therapeutic-areas">Therapeutic Area Economics at Phase 2</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Therapeutic area drives valuation more than any other single variable in biopharma dealmaking. Phase 2 median upfronts range from $40M (women&apos;s health) to $150M (metabolic/obesity) &mdash; a 3.8x spread. This is not noise: it reflects genuine differences in addressable market size, competitive intensity, and commercial model validation. When benchmarking your asset, start with the therapeutic area median, then layer in modality premiums and phase-specific adjustments.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Phase 2 Deal Economics by Therapeutic Area</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Ph2 Median Upfront', 'Ph2 Median TDV', 'Upfront/TDV', 'Ph2→Ph3 Multiple']}
            rows={[
              ['Metabolic/Obesity', '$150M', '$2.0B', '7.5%', '3.5x'],
              ['Immunology', '$120M', '$1.5B', '8.0%', '2.6x'],
              ['Oncology', '$95M', '$1.1B', '8.6%', '2.5x'],
              ['Hematology', '$80M', '$950M', '8.4%', '2.4x'],
              ['Neurology', '$75M', '$900M', '8.3%', '2.8x'],
              ['Gastroenterology', '$70M', '$850M', '8.2%', '2.2x'],
              ['Cardiovascular', '$65M', '$800M', '8.1%', '2.3x'],
              ['Rare Disease', '$60M', '$750M', '8.0%', '2.3x'],
              ['Ophthalmology', '$55M', '$650M', '8.5%', '2.3x'],
              ['Infectious Disease', '$50M', '$600M', '8.3%', '2.3x'],
              ['Dermatology', '$45M', '$550M', '8.2%', '2.2x'],
              ['Women\'s Health', '$40M', '$500M', '8.0%', '2.2x'],
            ]}
            freeRows={5}
            footnote={`Source: Ambrosia Ventures analysis of ${DEAL_STATS.TOTAL_DEALS} transactions. Medians used throughout. TDV = Total Deal Value including milestones. Upfront/TDV ratio reflects share of value delivered at signing.`}
          />

          {/* ── TA x Phase Heatmap ── */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Median Upfront Heatmap: Therapeutic Area &times; Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Color intensity reflects relative deal value. Metabolic and immunology assets at later phases command the most aggressive valuations.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 overflow-x-auto">
            {(() => {
              const maxVal = 1200;
              const heatmapData = [
                { ta: 'Metabolic', vals: [35, 70, 150, 400, 1200] },
                { ta: 'Immunology', vals: [28, 56, 120, 300, 950] },
                { ta: 'Oncology', vals: [22, 42, 95, 230, 680] },
                { ta: 'Hematology', vals: [19, 38, 80, 200, 600] },
                { ta: 'Neurology', vals: [18, 36, 75, 180, 520] },
                { ta: 'GI', vals: [16, 32, 70, 170, 480] },
                { ta: 'CV', vals: [15, 30, 65, 160, 450] },
                { ta: 'Rare Disease', vals: [14, 28, 60, 140, 400] },
                { ta: 'Ophthalm.', vals: [13, 26, 55, 130, 370] },
                { ta: 'Inf. Disease', vals: [12, 24, 50, 120, 350] },
                { ta: 'Derm.', vals: [11, 22, 45, 100, 300] },
                { ta: "Women's", vals: [9, 18, 40, 90, 260] },
              ];
              const getColor = (v: number) => {
                const intensity = Math.min(v / maxVal, 1);
                if (intensity < 0.05) return { bg: 'rgb(241, 245, 249)', text: 'rgb(51, 65, 85)' };
                const r = Math.round(240 - intensity * 200);
                const g = Math.round(249 - intensity * 100);
                const b = Math.round(255 - intensity * 120);
                const textColor = intensity > 0.4 ? 'rgb(255,255,255)' : 'rgb(15, 23, 42)';
                return { bg: `rgb(${Math.max(r, 13)}, ${Math.max(g, 148)}, ${Math.max(b, 136)})`, text: textColor };
              };
              return (
                <table className="w-full text-xs border-separate" style={{ borderSpacing: '3px' }}>
                  <thead>
                    <tr>
                      <th className="py-2 px-3 font-semibold text-slate-700 text-left" />
                      {['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3', 'Approved'].map(h => (
                        <th key={h} className="py-2 px-3 font-semibold text-slate-700 text-center text-[10px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map(({ ta, vals }, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap text-[11px]">{ta}</td>
                        {vals.map((v, j) => {
                          const c = getColor(v);
                          return (
                            <td
                              key={j}
                              className="py-3 px-2 text-center tabular-nums font-bold rounded-md transition-all"
                              style={{ backgroundColor: c.bg, color: c.text, fontSize: '11px' }}
                            >
                              ${v >= 1000 ? `${(v / 1000).toFixed(1)}B` : `${v}M`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] text-slate-400">Low</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgb(241,245,249), rgb(204,251,241), rgb(94,234,212), rgb(20,184,166), rgb(13,148,136))' }} />
              <span className="text-[10px] text-slate-400">High</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Median upfront payments ($M). Continuous color gradient scaled to $1.2B maximum. Source: Ambrosia Ventures deal database.</p>
          </div>

          <p className="text-slate-700 leading-relaxed mt-8 mb-5">
            The heatmap reveals a critical insight: therapeutic area premiums compound at later stages. The spread between metabolic and women&apos;s health is 3.8x at Phase 2 ($150M vs $40M) but widens to 4.6x at the approved stage ($1.2B vs $260M). BD teams with multi-indication assets should time their exit based on the indication with the highest TA premium, not necessarily the most clinically advanced program.
          </p>
        </section>

        {/* ── SECTION 4: MODALITY PREMIUMS & CYCLES ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="modality-premiums">Modality Premiums and Market Cycles</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Modality premiums are not static. They follow market cycles driven by clinical validation events, platform acquisitions, and supply dynamics. Understanding where a modality sits in its cycle is as important as understanding the premium itself. Buying at peak enthusiasm overpays; licensing at cycle trough undervalues genuine innovation.
            </p>

            {/* ── ADC Market Cycle ── */}
            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">ADC Market Cycle: Deal Volume and Total Value (2019&ndash;2025)</h3>
              <p className="text-xs text-slate-400 mb-4">The 2023 Pfizer/Seagen acquisition ($43B) created a once-in-a-generation peak. Premiums have since normalized from ~1.70x to 1.45x as the market shifts from platform acquisitions to single-asset licensing.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Year</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">ADC Deals</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Median TDV</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Total Value</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Cycle Phase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['2019', '17', '$1.3B', '$46.2B', 'Early growth', ''],
                      ['2020', '20', '$2.7B', '$136.8B', 'Expansion', ''],
                      ['2021', '18', '$1.7B', '$76.8B', 'Consolidation', ''],
                      ['2022', '25', '$3.3B', '$105.1B', 'Acceleration', ''],
                      ['2023', '32', '$5.9B', '$371.8B', 'Peak', 'bg-amber-50'],
                      ['2024', '35', '$1.8B', '$104.4B', 'Normalization', ''],
                      ['2025*', '17', '$1.6B', '$36.7B', 'Post-peak', ''],
                    ].map(([year, deals, tdv, total, cycle, bg], i) => (
                      <tr key={i} className={`border-b border-slate-100 ${bg}`}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{year}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{deals}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{tdv}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-semibold">{total}</td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500">{cycle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">*2025 data through Q3. Source: Ambrosia Ventures ADC deal tracking (~165 transactions documented).</p>
            </div>

            <TrendLineChart
              data={[
                { year: '2019', value: 46.2 },
                { year: '2020', value: 136.8 },
                { year: '2021', value: 76.8 },
                { year: '2022', value: 105.1 },
                { year: '2023', value: 371.8 },
                { year: '2024', value: 104.4 },
                { year: '2025', value: 36.7 },
              ]}
              yLabel="Total ADC Deal Value ($B)"
              formatY={(v: number) => `$${v.toFixed(0)}B`}
              referenceLine={{ value: 104, label: 'Post-peak normalization' }}
            />

            {/* ── Current Modality Rankings ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4B</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Modality Multipliers vs Small Molecule Baseline</h3>
              <p className="text-xs text-slate-400 mb-4">Multipliers applied to Phase 2 oncology small molecule median ($282M, n=236). Radiopharmaceuticals have displaced ADCs as the highest-premium modality.</p>
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
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 4C</p>
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
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Cycle Phase</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Radiopharmaceuticals', '1.60x', '$451M', 'Peak', '↑ +1,408% in 2 years'],
                      ['ADC', '1.45x', '$409M', 'Post-peak', '↓ from 1.70x (2023)'],
                      ['CAR-T (Solid Tumor)', '1.40x', '$395M', 'Growth', '↑ High interest'],
                      ['Bispecific Antibodies', '1.35x', '$381M', 'Stable', '→ Validated'],
                      ['PROTAC / Degrader', '1.35x', '$381M', 'Growth', '↑ Strong interest'],
                      ['mRNA Therapeutics', '1.30x', '$367M', 'Expansion', '↑ Beyond vaccines'],
                      ['Small Molecule', '1.00x', '$282M', 'Baseline', '→ n=236'],
                    ].map(([mod, mult, implied, cycle, trend], i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-medium text-slate-800">{mod}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums font-semibold">{mult}</td>
                        <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{implied}</td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500">{cycle}</td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500">{trend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">Implied upfront = oncology Phase 2 small molecule median ($282M) &times; multiplier. Source: Ambrosia Ventures deal database (2020&ndash;2026).</p>
            </div>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Radiopharmaceuticals are in peak-cycle territory. Novartis Pluvicto validation (&gt;$1B annual sales within 18 months), constrained isotope supply, and platform acquisitions by BMS, Lilly, and AstraZeneca have driven aggressive bidding. ADCs are normalizing &mdash; the shift from platform to single-asset deals means premiums now require target differentiation, payload novelty, and Phase 2 data quality. Bispecifics are stable with validated commercial models (teclistamab, epcoritamab, glofitamab). PROTAC/degraders and mRNA are in early-growth phase with rising interest but fewer large data points.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: ROYALTY RATE BENCHMARKS (NEW) ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="royalty-rates">Royalty Rate Benchmarks</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Royalty rates are the most opaque element of biopharma deal economics. Unlike upfront payments and total deal values, which are frequently disclosed in press releases, royalty rates are buried in SEC filings and often redacted. This section presents benchmarks derived from deals where royalty terms were disclosed, covering the full spectrum from discovery to approved assets.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 5A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Royalty Rates by Development Phase</h3>
          </div>

          <RangeChart
            data={[
              { label: 'Discovery', p25: 3, median: 5, p75: 7, n: 45 },
              { label: 'Preclinical', p25: 5, median: 7.5, p75: 10, n: 82 },
              { label: 'Phase 1', p25: 6, median: 9, p75: 12, n: 68 },
              { label: 'Phase 2', p25: 8, median: 11.5, p75: 15, n: 95, highlight: true },
              { label: 'Phase 3', p25: 12, median: 16, p75: 20, n: 71 },
              { label: 'NDA/Filed', p25: 15, median: 18.5, p75: 22, n: 38 },
              { label: 'Approved', p25: 18, median: 21.5, p75: 25, n: 52 },
            ]}
            title=""
            valuePrefix=""
            valueSuffix="%"
          />

          <p className="text-slate-700 leading-relaxed mt-6 mb-5">
            Royalties escalate 2&ndash;5 percentage points per development phase. The Phase 2 to Phase 3 step-up (11.5% &rarr; 16%) is the largest single-phase increase in royalty terms, mirroring the upfront payment pattern. At the approved stage, royalties of 18&ndash;25% are standard, reflecting the near-elimination of clinical risk.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 5B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Phase 2 Royalty Rates by Modality</h3>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-700 text-left">Modality</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Low</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">Median</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">High</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-right">NPV per 1%pt ($2B peak sales)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['ADC', '10%', '14%', '18%', '$30–80M'],
                    ['Radiopharmaceutical', '10%', '13.5%', '17%', '$30–80M'],
                    ['Bispecific Antibody', '9%', '12.5%', '16%', '$30–80M'],
                    ['mRNA Therapeutics', '9%', '12.5%', '16%', '$30–80M'],
                    ['Small Molecule', '8%', '11.5%', '15%', '$30–80M'],
                    ['CAR-T Cell Therapy', '8%', '11%', '14%', '$30–80M'],
                    ['Gene Therapy', '7%', '10%', '13%', '$30–80M'],
                  ].map(([mod, low, med, high, npv], i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-medium text-slate-800">{mod}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{low}</td>
                      <td className="py-3 px-4 text-right text-slate-900 tabular-nums font-bold">{med}</td>
                      <td className="py-3 px-4 text-right text-slate-600 tabular-nums">{high}</td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500">{npv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">NPV per 1 percentage point based on $2B peak sales, 10-year commercial life, 12% discount rate. A single percentage point of royalty represents $30&ndash;80M in NPV for a blockbuster asset. Source: Ambrosia Ventures deal database.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Over 70% of licensing deals now employ tiered royalty structures with escalation clauses tied to sales thresholds &mdash; for example, 10% up to $1B, 12% to $3B, 15% above. This represents a structural shift from flat-rate royalties and creates alignment between licensor and licensee: both parties benefit more as commercial performance exceeds expectations. A single percentage point of royalty represents $30&ndash;80M in net present value for a $2B peak-sales asset &mdash; making royalty negotiation one of the highest-leverage elements of deal structuring.
            </p>
          </div>
        </section>

        {/* ── SECTION 6: DEAL STRUCTURE EVOLUTION ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="deal-structure">Deal Structure Evolution</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              The biopharma deal market is undergoing a structural transformation. Three simultaneous shifts are reshaping how transactions are structured: rising upfront percentages, growing option deal share, and the emergence of a bimodal deal-size distribution.
            </p>

            {/* ── Upfront % Trend ── */}
            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 6A</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Upfront as Percentage of Total Deal Value (2020&ndash;2026)</h3>
              <p className="text-xs text-slate-400 mb-4">Upfront share has risen from 20.3% in 2021 to 29.0% in 2026 YTD, reflecting sellers&apos; growing negotiating power and tighter biotech capital markets.</p>
            </div>

            <TrendLineChart
              data={[
                { year: '2020', value: 22.1, n: 269 },
                { year: '2021', value: 20.3, n: 378 },
                { year: '2022', value: 24.7, n: 420 },
                { year: '2023', value: 26.2, n: 445 },
                { year: '2024', value: 27.8, n: 535 },
                { year: '2025', value: 28.5, n: 387 },
                { year: '2026', value: 29.0, n: q1Count + q2Count },
              ]}
              yLabel="Upfront % of TDV"
              referenceLine={{ value: 25, label: '25% threshold' }}
            />

            {/* ── Deal Type Composition ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 6B</p>
              <h3 className="text-base font-bold text-slate-900 mb-4">Deal Structure Composition</h3>
            </div>

            <GatedBenchmarkTable
              headers={['Structure', 'Count', 'Share', 'Avg Upfront % of TDV', 'Trend']}
              rows={[
                ['Licensing', '~31%', 'Dominant', '15–20%', 'Stable'],
                ['Acquisition', '~23%', 'Second', '100%', 'Stable'],
                ['Collaboration', '~20%', 'Growing', '22%', 'Stable'],
                ['Co-Development', '~13%', 'Established', '10–14%', 'Stable'],
                ['Option', '~13%', 'Fastest-growing', '5–10%', '8% → 18% (2020→2025)'],
              ]}
              freeRows={5}
              footnote="Source: Ambrosia Ventures deal database. Shares based on cumulative deal count (2020-2026). Option deal growth from 8% in 2020 to 18% in 2025 is the most significant structural shift in the period."
            />

            <p className="text-slate-700 leading-relaxed mt-8 mb-5">
              The option deal surge (8% &rarr; 18%) deserves attention. For buyers, options offer lower upfront commitment with the right to acquire after seeing data &mdash; a put option on clinical risk. For sellers, options provide non-dilutive funding with the potential for full-value transactions at exercise. The risk is asymmetric: if data disappoints, the option lapses and the seller retains the asset but loses the partner. If data exceeds expectations, the option exercise price may undervalue the asset relative to a competitive auction.
            </p>

            {/* ── Bimodal Distribution ── */}
            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 6C</p>
              <h3 className="text-base font-bold text-slate-900 mb-1">Bimodal Deal Distribution</h3>
              <p className="text-xs text-slate-400 mb-4">The mid-market ($200M&ndash;$800M) is thinning as deal volume concentrates at the extremes: mega-deals exceeding $5B and discovery-stage transactions under $200M.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 my-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">&lt;$200M</div>
                <div className="text-sm text-slate-500 mt-1">Discovery-stage deals</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">&uarr; Growing share</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-amber-600 tabular-nums">$200M&ndash;$800M</div>
                <div className="text-sm text-slate-500 mt-1">Mid-market Phase 1&ndash;2</div>
                <div className="text-xs text-amber-600 font-semibold mt-1">&darr; Intensified competition</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">&gt;$5B</div>
                <div className="text-sm text-slate-500 mt-1">Mega-deals / acquisitions</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">&uarr; Growing share</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: Q2 2026 DEAL HIGHLIGHTS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 7</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="deal-highlights">Q2 2026 Landmark Transactions</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            The following transactions represent the highest-value deals announced between April 1 and June 30, 2026, with total deal values exceeding $500M and verified financial terms. Each entry includes an automated analysis comparing the deal to therapeutic area and phase-specific benchmarks from our database.
          </p>

          {topDeals.length > 0 ? (
            <div className="space-y-6">
              {topDeals.map((deal, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-slate-900 tabular-nums">{deal.value}</span>
                        {deal.upfrontStr && deal.upfrontPct && (
                          <span className="text-xs font-semibold text-teal-600 bg-teal-50 rounded-full px-3 py-1">
                            {deal.upfrontStr} upfront ({deal.upfrontPct}%)
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mb-1">{deal.companies}</p>
                      <p className="text-xs text-slate-400 mb-2">{deal.meta}</p>
                      {deal.assetName && <p className="text-xs text-slate-500 mb-2">Asset: {deal.assetName}</p>}
                      {deal.analysis && <p className="text-xs text-slate-600 leading-relaxed">{deal.analysis}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500 text-sm">Q2 2026 landmark transactions will populate as verified deals enter the database. Check back as filings are processed.</p>
              <p className="text-xs text-slate-400 mt-2">Deals are ingested weekly from SEC 8-K filings and verified before inclusion.</p>
            </div>
          )}
        </section>

        {/* ── SECTION 8: Q2 2026 MARKET THEMES ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 8</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="market-themes">Q2 2026 Market Themes</h2>

            <p className="text-slate-700 leading-relaxed mb-5">
              Four structural forces are reshaping biopharma dealmaking in mid-2026. These themes build on Q1 trends but represent distinct market dynamics that will define the second-half deal environment. BD teams should evaluate their portfolio positioning against each theme.
            </p>

            {/* ── Theme 1: Metabolic/Obesity Repricing ── */}
            <div className="mt-10 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 1</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Metabolic/Obesity Assets Are Repricing the Entire Deal Market</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Metabolic/obesity now commands the highest Phase 2 total deal values ($2.0B median) of any therapeutic area &mdash; surpassing oncology for the first time in our dataset. The 3.5x Phase 2&rarr;Phase 3 multiplier is the highest across all TAs, reflecting outsized buyer conviction in assets with GLP-1 commercial validation and addressable markets exceeding $100B annually.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 my-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$2.0B</div>
                <div className="text-sm text-slate-500 mt-1">Metabolic Phase 2 median TDV</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">Highest of any TA</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">3.5x</div>
                <div className="text-sm text-slate-500 mt-1">Ph2&rarr;Ph3 multiplier</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">Highest of any TA</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$100B+</div>
                <div className="text-sm text-slate-500 mt-1">Addressable market</div>
                <div className="text-xs text-slate-400 font-semibold mt-1">Global obesity + metabolic</div>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The repricing extends beyond GLP-1 agonists. Oral GLP-1s, GIPR/GLP-1R dual agonists, and next-generation delivery platforms are all commanding premiums previously reserved for late-stage validated oncology assets. The Novo Nordisk/Catalent acquisition ($16.5B) illustrates the scale of capital deployment in this space &mdash; a manufacturing infrastructure deal valued at multiples historically reserved for pipeline acquisitions.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Metabolic/obesity has fundamentally altered the deal hierarchy. For the first time, a non-oncology therapeutic area commands the highest Phase 2 valuations. BD teams with metabolic assets should benchmark against metabolic-specific medians, not cross-TA averages &mdash; cross-TA benchmarking undervalues metabolic assets by 40&ndash;60%.
              </p>
            </div>

            {/* ── Theme 2: Radiopharmaceutical Land Grab ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 2</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">The Radiopharmaceutical Land Grab</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Radiopharmaceutical deal premiums surged +1,408% in upfront valuations over the last two years, displacing ADCs as the highest-premium oncology modality. Three forces converge: Novartis Pluvicto&apos;s commercial validation (exceeding $1B in annual sales within 18 months of launch), constrained isotope supply (Actinium-225, Lutetium-177), and aggressive platform acquisitions by BMS, Lilly, and AstraZeneca.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 my-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">+1,408%</div>
                <div className="text-sm text-slate-500 mt-1">Radiopharm upfront valuation surge</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">Over 2 years</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">1.60x</div>
                <div className="text-sm text-slate-500 mt-1">Multiplier vs small molecule baseline</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">New modality leader</div>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The supply constraint is structural: Actinium-225 production is limited to a handful of global facilities, and new capacity takes 3&ndash;5 years to build. This creates a land-grab dynamic where acquirers are paying premiums not just for the molecule but for access to isotope supply chains. The remaining independent radiopharmaceutical companies with validated targets and manufacturing partnerships are trading at multiples that reflect scarcity, not just clinical merit.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Radiopharmaceutical premiums are supply-driven, not just science-driven. The 1.60x multiplier may compress once new isotope production comes online (2028&ndash;2029), but near-term scarcity ensures elevated valuations through 2027. BD teams with radiopharmaceutical assets have a narrowing window to capture peak-cycle premiums.
              </p>
            </div>

            {/* ── Theme 3: China-to-West Acceleration ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 3</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">China-to-West Licensing: From Emerging Trend to Market Structure</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              Chinese biotech out-licensing has crossed the threshold from emerging trend to permanent market structure. Total deal value from Chinese biotechs reached $136B in 2025 (+162% YoY) and $52B in the first eight weeks of 2026 alone &mdash; matching the entire 2024 total in under two months. Average deal size is $1.3B (+76% vs 2025), confirming this is not cost arbitrage but genuine innovation premium.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 my-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$136B</div>
                <div className="text-sm text-slate-500 mt-1">Chinese biotech out-licensing (2025)</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">+162% YoY</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$52B</div>
                <div className="text-sm text-slate-500 mt-1">First 8 weeks of 2026</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">Equals all of 2024</div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-3xl font-bold text-slate-900 tabular-nums">$1.3B</div>
                <div className="text-sm text-slate-500 mt-1">Avg deal size</div>
                <div className="text-xs text-teal-600 font-semibold mt-1">+76% vs 2025</div>
              </div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The PD-1/VEGF bispecific class illustrates the scale: Pfizer licensed from 3SBio, BMS partnered with BioNTech-Biotheus, and Merck acquired rights from LaNova &mdash; three separate Western pharma companies licensing the same drug class from three different Chinese biotechs. Chinese biotechs now account for approximately 90% of global ADC out-licensing. Key transactions: AstraZeneca/CSPC ($18.5B), GSK/Hengrui ($12B+), BMS/BioNTech-Biotheus ($11.1B), Pfizer/3SBio ($6B).
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                Western pharmaceutical pipelines are structurally thin in ADCs and bispecific antibodies. Chinese biotechs built deep capability in exactly those modalities. The geography of biopharma innovation has permanently shifted. Six of the top 10 pharma companies have licensed from Chinese biotechs in the last 12 months. Non-Chinese biotechs developing ADCs and bispecifics are now competing against a price baseline set by Chinese out-licensing economics.
              </p>
            </div>

            {/* ── Theme 4: Phase 2 as the New Exit Window ── */}
            <div className="mt-14 mb-2">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Theme 4</p>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Phase 2 Proof-of-Concept as the Optimal Exit Window</h3>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              A growing number of high-profile acquisitions are occurring at Phase 2 rather than Phase 3 &mdash; and the data supports this as the rational strategy. Merck&apos;s $10.8B acquisition of Prometheus Biosciences (anti-TL1A, ulcerative colitis) on Phase 2 data alone is the most visible example, but the pattern extends across therapeutic areas.
            </p>

            <div className="bg-white rounded-xl p-5 my-6 border border-slate-200">
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$10.8B</div>
              <div className="text-sm text-slate-500 mt-1">Merck/Prometheus Biosciences &mdash; acquired on Phase 2 data alone</div>
              <div className="text-xs text-teal-600 font-semibold mt-1">No Phase 3 data. No pivotal trial. Just proof-of-concept.</div>
            </div>

            <p className="text-slate-700 leading-relaxed mb-5">
              The risk-adjusted math favors Phase 2 exits (see Section 2). When Phase 3 costs ($200&ndash;$500M), timelines (2&ndash;3 years), and failure rates (40&ndash;50%) are factored in, the expected value of selling at Phase 2 exceeds the expected value of holding to Phase 3 for most single-asset biotechs. This is not a new phenomenon &mdash; it has always been true in the numbers &mdash; but founder and board awareness of this dynamic is increasing, driven by high-profile Phase 3 failures at companies that could have exited at Phase 2.
            </p>

            <p className="text-slate-700 leading-relaxed mb-5">
              The practical implication: biotechs should build their capital strategy around reaching Phase 2 proof-of-concept with 18+ months of runway. The $30M bridge round to reach PoC may be the highest-ROI capital a founder ever raises. The alternative &mdash; running out of cash six months before a data readout that could have changed the trajectory &mdash; is the most expensive mistake in biotech, and it happens more often than any board would admit.
            </p>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
              <p className="text-slate-700 leading-relaxed">
                The Phase 3 trial Prometheus never ran was worth nothing. The Phase 2 data they already had was worth $10.8 billion. BD teams should model risk-adjusted exit values at every clinical milestone, not just at the end of the development timeline. The founders who capture the most value are not the ones who hold longest &mdash; they are the ones who recognize when their risk-adjusted value has peaked.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 9: TERRITORY DYNAMICS ── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 9</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-6" id="territory-dynamics">Territory and Cross-Border Dynamics</h2>

          <p className="text-slate-700 leading-relaxed mb-5">
            Territory-split structures continued to grow as biotechs retained US commercialization rights while licensing ex-US. The median ex-US deal carries a 30&ndash;40% discount to global rights, but for biotechs with US commercial infrastructure, this approach maximizes total value realization. Japan commands a 15&ndash;25% premium on a per-market basis versus comparable European territories, driven by regulatory predictability and favorable pricing.
          </p>

          <p className="text-slate-700 leading-relaxed mb-5">
            China standalone value declined to 5&ndash;8% of global (from a 10&ndash;15% peak) following NRDL pricing reforms and Volume-Based Procurement pressures. The exception is metabolic assets, where China premiums of 15&ndash;20% above baseline ex-US value have emerged, driven by 180 million adults with obesity and rapid GLP-1 manufacturing buildout.
          </p>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 9</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Territory Value as % of Global Deal Economics</h3>
            <p className="text-xs text-slate-400 mb-4">US-only deals capture 65&ndash;70% of global value. Japan maintains a per-market premium. China standalone has declined to 5&ndash;8% except for metabolic assets.</p>
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

          <p className="text-slate-700 leading-relaxed mt-8 mb-5">
            Greater APAC (Japan + China + SEA + ANZ) accounts for 20&ndash;30% of global biopharma deal value, with Japan alone representing 12&ndash;18%. Chinese deal structures show distinctive characteristics: upfronts represent 10&ndash;20% of total deal value (versus 20&ndash;30% for Japan), milestones are weighted heavily at 50&ndash;60% of total value, and deal timelines of 6&ndash;12 months reflect regulatory complexity. Growing use of escrow arrangements for milestones exceeding $50M signals increasing deal sophistication in the region. See our <Link href="/insights/biotech-licensing-europe" className="text-teal-600 font-medium hover:text-teal-700">Europe licensing benchmarks</Link> and <Link href="/insights/out-licensing-asia-pacific" className="text-teal-600 font-medium hover:text-teal-700">APAC territory analysis</Link> for detailed regional data.
          </p>
        </section>

        {/* ── SECTION 10: QUARTER-OVER-QUARTER DASHBOARD (NEW) ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 10</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="qq-dashboard">Quarter-over-Quarter: Q1 vs Q2 2026</h2>

            <p className="text-slate-700 leading-relaxed mb-8">
              A side-by-side comparison of key deal metrics between Q1 and Q2 2026. Arrows indicate directional change; significance should be interpreted in context of deal volume and mix.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Deal Count', q1: String(q1Count), q2: String(q2Count || '—'), trend: q2Count > q1Count ? 'up' : q2Count < q1Count ? 'down' : 'flat' },
                { label: 'Corpus Total', q1: '~1,400', q2: DEAL_STATS.TOTAL_DEALS, trend: 'up' },
                { label: 'Onco Ph2 Median Upfront', q1: '$282M', q2: '$282M', trend: 'flat' },
                { label: 'Immuno Ph2 Median Upfront', q1: '$400M', q2: '$400M', trend: 'flat' },
                { label: 'Upfront % of TDV', q1: '29.0%', q2: '29.0%', trend: 'flat' },
                { label: 'Conditional Value %', q1: '71.0%', q2: '71.0%', trend: 'flat' },
                { label: 'Top Modality Premium', q1: 'Radiopharm (1.60x)', q2: 'Radiopharm (1.60x)', trend: 'flat' },
                { label: 'ADC Premium', q1: '1.45x', q2: '1.45x', trend: 'flat' },
                { label: 'Report Sections', q1: '9', q2: '11', trend: 'up' },
              ].map(({ label, q1, q2, trend }, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">{label}</div>
                  <div className="flex items-baseline gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-slate-400 mb-0.5">Q1</div>
                      <div className="text-sm font-semibold text-slate-600 tabular-nums">{q1}</div>
                    </div>
                    <div className="text-lg text-slate-300">
                      {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-xs text-slate-400 mb-0.5">Q2</div>
                      <div className="text-sm font-bold text-slate-900 tabular-nums">{q2}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 mt-6">Q/Q comparisons are based on cumulative deal database metrics. Many medians remain stable quarter-to-quarter due to the growing corpus size; meaningful shifts typically emerge over 2&ndash;4 quarters. This dashboard will track directional changes across all metrics in future reports.</p>
          </div>
        </section>

        {/* ── DEAL ANATOMY: PROMETHEUS (NEW) ── */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Deal Anatomy</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" id="deal-anatomy">Merck / Prometheus Biosciences: $10.8B on Phase 2 Data</h2>
            <p className="text-slate-500 mb-8">A line-by-line dissection of the deal that defines the Phase 2 exit thesis, benchmarked against the Ambrosia Ventures deal database.</p>

            {/* Deal header card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white mb-8 shadow-xl">
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Acquirer</div>
                  <div className="text-xl font-bold">Merck &amp; Co.</div>
                  <div className="text-xs text-slate-400 mt-1">NYSE: MRK &middot; Revenue $60B+ &middot; Top-5 Pharma</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Target</div>
                  <div className="text-xl font-bold">Prometheus Biosciences</div>
                  <div className="text-xs text-slate-400 mt-1">NASDAQ: RXDX &middot; Founded 2019 &middot; IPO June 2021</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-700">
                <div>
                  <div className="text-3xl font-bold tabular-nums">$10.8B</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Acquisition Price</div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">$200</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Per Share</div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums text-teal-400">Phase 2</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Stage at Acquisition</div>
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">Apr 2023</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Announced</div>
                </div>
              </div>
            </div>

            {/* Deal analysis */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">The Asset</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  PRA023 (now duvakitug), a first-in-class anti-TL1A monoclonal antibody for inflammatory bowel disease (ulcerative colitis and Crohn&apos;s disease). TL1A is a TNF superfamily cytokine implicated in mucosal inflammation &mdash; a novel mechanism distinct from existing anti-TNF and anti-IL-23 therapies.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">The Data</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Phase 2 results in ulcerative colitis showed statistically significant clinical remission rates versus placebo, with a differentiated safety profile. The data was presented prior to the acquisition announcement. No Phase 3 data existed at the time of the deal.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">How It Benchmarks</h3>
              </div>
            </div>

            {/* Benchmark comparison grid */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 px-4 font-semibold text-slate-700 text-left">Metric</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Prometheus Deal</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Immunology Ph2 Median</th>
                      <th className="py-3 px-4 font-semibold text-slate-700 text-right">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Acquisition Price', '$10.8B', '$1.5B (TDV)', '7.2x'],
                      ['Upfront (100% at close)', '$10.8B', '$120M', '90x'],
                      ['Stage', 'Phase 2', 'Phase 2', '—'],
                      ['Mechanism', 'First-in-class', 'Various', '—'],
                      ['Indication', 'UC / Crohn\'s', 'Various', '—'],
                      ['Time: IPO to acquisition', '~22 months', 'N/A', '—'],
                    ].map(([metric, deal, median, premium], i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-3 px-4 font-medium text-slate-800">{metric}</td>
                        <td className="py-3 px-4 text-right text-slate-900 tabular-nums font-bold">{deal}</td>
                        <td className="py-3 px-4 text-right text-slate-500 tabular-nums">{median}</td>
                        <td className="py-3 px-4 text-right text-teal-700 tabular-nums font-semibold">{premium}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Why This Deal Matters</p>
              <p className="text-slate-700 leading-relaxed">
                Prometheus traded at 7.2x the immunology Phase 2 median TDV and 90x the median upfront. This is not simply a premium &mdash; it is a different category of transaction. Three factors drove the multiple: (1) first-in-class mechanism with no direct competitor in TL1A, (2) IBD market exceeding $25B annually with unmet need for non-TNF mechanisms, and (3) clean Phase 2 efficacy data that de-risked the biology, if not the pivotal trial. The deal proves that exceptional Phase 2 data in a validated commercial market can command acquisition economics typically reserved for Phase 3 or approved assets. BD teams should not benchmark exceptional assets against median deal economics &mdash; they should benchmark against the acquisition premiums that first-in-class mechanisms with blockbuster market potential command.
              </p>
            </div>
          </div>
        </section>

        {/* ── H2 2026 OUTLOOK (NEW) ── */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-400 uppercase tracking-[0.2em] mb-2">Forward Look</p>
            <h2 className="text-2xl font-bold text-white mb-2" id="outlook">H2 2026 Outlook: What the Data Says Is Coming</h2>
            <p className="text-slate-400 mb-10">Four predictions for the second half of 2026, derived from deal flow patterns, modality cycles, and structural shifts in the {DEAL_STATS.TOTAL_DEALS} transaction dataset.</p>

            <div className="grid sm:grid-cols-2 gap-6">
              {[
                {
                  num: 1,
                  title: 'Radiopharmaceutical premiums will peak and plateau',
                  body: 'The 1.60x multiplier is supply-driven and supply is being built. BMS, Lilly, and AstraZeneca have all made platform acquisitions. The remaining independent radiopharmaceutical companies will face either acquisition offers at peak premiums or a gradual compression as isotope capacity expands (2028-2029 timeline). H2 2026 is the window for maximum value capture.',
                  signal: 'Watch for: Isotope supply announcements, DOE production contracts',
                },
                {
                  num: 2,
                  title: 'Metabolic deal volume will accelerate into 2027',
                  body: 'Oral GLP-1s, dual agonists, and next-gen delivery platforms are in Phase 2 across 15+ companies. The $100B+ addressable market and 3.5x Phase 2→3 multiplier will attract capital and buyers at a pace that outstrips current deal flow. Expect 3-5 metabolic transactions exceeding $5B TDV before year-end.',
                  signal: 'Watch for: Oral GLP-1 Phase 2 readouts, amylin/GLP-1 combinations',
                },
                {
                  num: 3,
                  title: 'Option deal structures will cross 20% share',
                  body: 'The option deal trajectory (8% → 18% over 5 years) shows no signs of slowing. Buyers prefer the structure in high-uncertainty therapeutic areas (neurology, CNS) where Phase 2 data is directional but not definitive. Sellers accept options when the alternative is no deal or a heavily milestone-weighted license. The 20% threshold will likely be crossed by Q4 2026.',
                  signal: 'Watch for: Option exercise decisions on Phase 2 assets signed in 2024-2025',
                },
                {
                  num: 4,
                  title: 'AI-discovered molecules will generate $10B+ in licensing value',
                  body: 'The Lilly/Insilico deal ($2.75B) validated AI-originated deal flow at institutional scale. With 28 AI-developed drugs in pipeline and nearly half at clinical stage, the next 6 months will see 3-5 additional deals. Cumulative 2026 AI-originated deal value will exceed $10B, concentrated in oncology small molecules and metabolic targets where AI-driven structure prediction has the strongest track record.',
                  signal: 'Watch for: Phase 2 readouts from Recursion, Relay, Exscientia pipeline assets',
                },
              ].map(({ num, title, body, signal }) => (
                <div key={num} className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">{num}</div>
                    <h3 className="text-base font-bold text-white leading-snug">{title}</h3>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">{body}</p>
                  <div className="bg-white/5 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold mb-0.5">Leading Indicator</p>
                    <p className="text-xs text-slate-400">{signal}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 pt-6 border-t border-white/10">
              <p className="text-xs text-slate-500">
                These predictions are derived from deal flow patterns and structural analysis, not clinical trial outcomes. Accuracy depends on continuation of current market dynamics. Ambrosia Ventures will track these predictions in the Q3 2026 report and score them against actual deal activity.
              </p>
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE CALCULATOR ── */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Model Your Own Deal</h2>
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of {DEAL_STATS.TOTAL_DEALS} verified transactions.</p>
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
                This report analyzes {DEAL_STATS.TOTAL_DEALS} biopharma transactions executed between January 1, 2020 and June 30, 2026. Transactions are sourced from SEC 8-K filings, FTC premerger notification filings, company press releases, investor presentations, and ClinicalTrials.gov. Each transaction is verified against at least one primary source before inclusion. New deals are ingested weekly (approximately 38 per week) via automated SEC EDGAR monitoring plus manual verification.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Survivorship Bias</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This dataset includes only deals with publicly disclosed financial terms. Transactions with undisclosed terms are excluded, which may introduce upward bias in reported medians. Additionally, failed or terminated deals are underrepresented. Readers should treat reported medians as reflective of the disclosed deal universe, not the complete market.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Statistical Methodology</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Medians are used throughout to minimize distortion from mega-deals. Sample sizes (n) are reported for every cohort. Interquartile ranges (P25&ndash;P75) are reported where sample sizes permit meaningful dispersion analysis. Cohorts with n&lt;10 should be treated as directional only. Cohorts with n&gt;100 produce highly stable estimates.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Risk-Adjusted Calculations</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The Phase 2 vs Phase 3 risk-adjusted analysis (Section 2) uses median values from the deal database, industry-standard Phase 3 failure rates (40&ndash;50%), and estimated trial costs ($200&ndash;$500M) derived from published literature and company disclosures. Individual asset risk profiles may vary significantly from these medians. The analysis is intended as a framework for thinking about exit timing, not as asset-specific financial advice.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Royalty Rate Data</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Royalty rates are derived from deals where terms were publicly disclosed in SEC filings or press releases. This represents a subset of total deals, as royalty rates are frequently redacted. Reported ranges should be treated as indicative of disclosed-deal economics, which may skew toward higher-profile transactions.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Therapeutic Area Classification</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Deals are classified into 12 therapeutic areas based on the primary indication of the lead asset. Multi-indication assets are assigned to the therapeutic area of the most advanced indication. Where a deal covers multiple assets, the deal is counted once under the primary asset&apos;s classification.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Update Frequency</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The full dataset is refreshed continuously; this quarterly report provides point-in-time narrative analysis as of July 15, 2026. The interactive deal calculator reflects real-time data. This page revalidates every 6 hours via ISR.
              </p>
            </div>

            <div className="border-l-4 border-amber-400 pl-5 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Important Caveat</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sample sizes vary significantly across therapeutic area and modality cohorts. Oncology (n=257 at Phase 2) provides high-confidence benchmarks. Smaller cohorts &mdash; metabolic (n=11), hematology (n=5) &mdash; should be interpreted as directional. We recommend oncology benchmarks as the primary reference and TA-specific adjustments as secondary overlays. Modality cycle analysis reflects historical patterns and should not be extrapolated as predictive.
              </p>
            </div>
          </div>
        </section>

        {/* ── EMAIL CAPTURE ── */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <InlineEmailCapture
            heading="Get the Q3 Report First"
            description={`Join 2,000+ BD professionals who receive our quarterly benchmarks the day they publish — plus weekly deal intelligence from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`}
            source="q2-2026-report"
          />
        </section>

        {/* ── DOWNLOAD ── */}
        <section className="max-w-4xl mx-auto px-6 pb-6">
          <EmailGatedDownload
            reportTitle="Q2 2026 Biopharma Deal Benchmarks"
            reportUrl="/reports/q2-2026-biopharma-deal-benchmarks"
            source="q2-2026-report-download"
          />
        </section>

        {/* ── CITE THIS DATA ── */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <CiteThisData
            title="Q2 2026 Biopharma Deal Benchmarks Report"
            pageUrl="/reports/q2-2026-biopharma-deal-benchmarks"
          />
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-lg font-bold text-slate-900 mb-4" id="faq">Frequently Asked Questions</h2>
          <div className="divide-y divide-slate-200">
            {[
              { q: 'What data sources does this report use?', a: `The report analyzes ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions (2020-2026). Sources include SEC 8-K filings, FTC premerger filings, company press releases, and ClinicalTrials.gov. New transactions are ingested weekly (~38/week) via automated monitoring and verified before inclusion.` },
              { q: 'How should I interpret small sample sizes?', a: 'Cohorts with n>100 (e.g., oncology Phase 2, n=257) produce stable medians. Cohorts with n<20 are directional — the median is real but the confidence interval is wide. Cohorts with n<10 should be treated as indicative only. We report sample sizes and P25-P75 ranges throughout.' },
              { q: 'Why is Phase 2 the risk-adjusted optimal exit?', a: 'Phase 3 median upfront ($678M) is 2.3x Phase 2 ($300M), but Phase 3 costs $200-500M, takes 2-3 years, and fails 40-50% of the time. Risk-adjusting the Phase 3 upside and subtracting trial costs yields an expected value lower than the certain Phase 2 exit. See Section 2 for the full calculation.' },
              { q: 'What are current royalty rate benchmarks?', a: 'Royalty rates range from 3-7% at discovery to 18-25% for approved assets. At Phase 2, ADCs command the highest median (14%), followed by radiopharmaceuticals (13.5%) and bispecifics (12.5%). Over 70% of deals now use tiered royalty structures. See Section 5 for full analysis.' },
              { q: 'Why are upfront percentages rising?', a: 'Average upfront as % of TDV increased from 20.3% (2021) to 29.0% (2026 YTD). Three factors: tighter biotech capital markets requiring larger upfronts, competitive intensity among buyers for differentiated assets, and seller sophistication in negotiating upfront-weighted structures.' },
              { q: 'How have ADC premiums changed?', a: 'ADC premiums peaked at ~1.70x during the 2023 Pfizer/Seagen cycle ($371.8B total value). They have since normalized to 1.45x as the market shifts from platform acquisitions to single-asset licensing. Radiopharmaceuticals have displaced ADCs as the highest-premium oncology modality at 1.60x.' },
              { q: 'What is the conditional value trend?', a: 'Conditional value (milestone share of TDV) declined from 79.7% (2021) to 71.0% (2026 YTD). More value is shifting to upfront payments. Milestones are increasingly tied to high-probability events rather than diffuse triggers.' },
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
