import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));
export const metadata: Metadata = {
  title: 'How Much Is My Biotech Asset Worth? Phase-by-Phase Valuation Guide | Ambrosia Ventures',
  description: `Biotech asset valuation benchmarks from ${DEAL_STATS.TOTAL_DEALS} real transactions. Phase-by-phase deal values for licensing, upfront payments, milestones, and royalties across 12 therapeutic areas.`,
  keywords: [
    'how much is my biotech asset worth',
    'biotech asset valuation',
    'what is my drug worth',
    'biotech licensing valuation',
    'drug asset valuation calculator',
    'biotech out-licensing value',
    'phase 2 asset valuation',
    'biotech deal value calculator',
  ],
  openGraph: {
    title: `How Much Is My Biotech Asset Worth? — Data from ${DEAL_STATS.TOTAL_DEALS} Deals`,
    description: 'A Phase 2 oncology asset is worth $800M-$2.5B in total deal value. See phase-by-phase benchmarks from real transactions.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/how-much-is-my-biotech-asset-worth',
    images: [{ url: '/api/og?title=How%20Much%20Is%20My%20Biotech%20Asset%20Worth%3F&subtitle=Phase-by-Phase%20Valuation%20Guide&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How Much Is My Biotech Asset Worth?',
    description: `Phase-by-phase biotech asset valuation benchmarks from ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/how-much-is-my-biotech-asset-worth',
  },
};

function HorizontalBarChart({ data, maxValue, color = '#0d9488' }: {
  data: { label: string; value: number; displayValue: string }[];
  maxValue: number;
  color?: string;
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 text-right text-sm font-medium text-slate-600 flex-shrink-0">{item.label}</div>
          <div className="flex-1 h-8 bg-slate-100 rounded-md overflow-hidden relative">
            <div
              className="h-full rounded-md flex items-center justify-end px-2"
              style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: color, opacity: 0.85 }}
            >
              <span className="text-xs font-bold text-white">{item.displayValue}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonCard({ left, right, label }: {
  left: { title: string; value: string; sub?: string };
  right: { title: string; value: string; sub?: string };
  label: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 my-6">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">{label}</p>
      <div className="grid grid-cols-2 gap-6">
        <div className="text-center p-4 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-700">{left.value}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">{left.title}</div>
          {left.sub && <div className="text-xs text-slate-400 mt-1">{left.sub}</div>}
        </div>
        <div className="text-center p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
          <div className="text-2xl font-bold text-teal-700">{right.value}</div>
          <div className="text-sm font-medium text-teal-600 mt-1">{right.title}</div>
          {right.sub && <div className="text-xs text-teal-500 mt-1">{right.sub}</div>}
        </div>
      </div>
    </div>
  );
}

function VisualStatRow({ stats }: { stats: { value: string; label: string; color?: string }[] }) {
  return (
    <div className="grid gap-4 my-8" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
      {stats.map((s, i) => (
        <div key={i} className="text-center py-6 px-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
          <div className={`text-3xl sm:text-4xl font-extrabold ${s.color || 'text-slate-900'}`}>{s.value}</div>
          <div className="text-sm text-slate-500 mt-2 font-medium">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 text-center">
      <div className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}


export default function HowMuchIsBiotechAssetWorthPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'How Much Is My Biotech Asset Worth?', item: 'https://solidus.ambrosiaventures.co/insights/how-much-is-my-biotech-asset-worth' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How Much Is My Biotech Asset Worth? Phase-by-Phase Valuation Guide',
    description: `Biotech asset valuation benchmarks from ${DEAL_STATS.TOTAL_DEALS} real transactions. Phase-by-phase deal values, the 5 factors that determine value, and how to increase your asset price before partnering.`,
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/how-much-is-my-biotech-asset-worth',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much is a Phase 2 biotech asset worth?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A Phase 2 biotech asset is worth $500M-$3.5B in total deal value depending on therapeutic area, modality, and data quality. Oncology Phase 2 assets command $800M-$2.5B, while immunology Phase 2 assets range from $600M-$2.0B. The single biggest value driver is proof-of-concept data quality — assets with biomarker-validated endpoints command 40-60% premiums over assets with standard clinical endpoints.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is my preclinical biotech asset worth?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Preclinical assets are worth $50M-$500M in total deal value, with median upfronts of $15-40M. The range is wide because preclinical valuation depends heavily on target validation, modality platform potential, and competitive landscape. ADC and cell therapy platforms command the highest preclinical valuations ($200M-$500M TDV) due to platform scalability.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I increase my biotech asset valuation before licensing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Five strategies increase asset value before licensing: (1) biomarker validation that enables patient selection, (2) breakthrough therapy or fast track designation from FDA, (3) combination study data showing additive or synergistic benefit, (4) manufacturing de-risking through CMC optimization, and (5) competitive positioning through differentiated endpoints or populations.',
        },
      },
      {
        '@type': 'Question',
        name: 'What upfront payment should I expect for my biotech asset?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Upfront payments typically range from 10-18% of total deal value. For a Phase 2 oncology asset worth $1.5B TDV, expect $150M-$270M upfront. Upfront ratios are higher for later-stage assets (15-20% at Phase 3) and lower for preclinical (8-12%). Competitive auction dynamics can increase upfronts by 20-40% above median benchmarks.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does therapeutic area affect biotech asset valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, significantly. Oncology commands the highest deal values (median TDV $1.8B across all phases), followed by immunology ($1.4B), neurology ($1.2B), and metabolic ($1.1B). Within TAs, specific indications matter — an oncology asset in NSCLC is worth more than one in pancreatic cancer due to market size and competitive dynamics.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="how-much-is-my-biotech-asset-worth" />
      <StickyTOC sections={[
        { id: 'phase-by-phase', label: 'Phase Benchmarks', number: 1 },
        { id: 'five-factors', label: 'Five Value Factors', number: 2 },
        { id: 'increase-value', label: 'Increase Your Value', number: 3 },
        { id: 'model-your-deal', label: 'Model Your Deal', number: 4 },
        { id: 'faq', label: 'FAQ', number: 5 },
      ]} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

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
              <span className="text-slate-200">Asset Valuation Guide</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-6">
              Valuation Guide
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              How Much Is My{' '}
              <span className="text-teal-400">Biotech Asset Worth?</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              A Phase 2 oncology asset is worth $800M-$2.5B in total deal value depending on modality, competitive position, and data quality. Here are the benchmarks from {DEAL_STATS.TOTAL_DEALS} real transactions.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$800M-$2.5B</div>
                <div className="text-xs text-slate-400">Phase 2 oncology TDV</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">10-18%</div>
                <div className="text-xs text-slate-400">Upfront as % of TDV</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">40-60%</div>
                <div className="text-xs text-slate-400">Biomarker premium</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 3, 2026" />

          <KeyTakeaways takeaways={[
            'Phase 2 oncology assets are worth $800M-$2.5B in total deal value, with upfronts of $80M-$450M. Immunology and neurology Phase 2 assets range from $600M-$2.0B.',
            'Five factors determine 90% of your asset valuation: therapeutic area, modality, development phase, competitive position, and data quality.',
            'Biomarker-validated assets command 40-60% premiums over assets with standard endpoints — the single highest-leverage way to increase your valuation.',
            'Competitive auction dynamics (multiple interested buyers) increase upfronts by 20-40% above median benchmarks. Partner identification is a valuation lever.',
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 id="phase-by-phase">Phase-by-Phase Asset Valuation Benchmarks</h2>

            <p>
              The value of your biotech asset is primarily determined by its development phase. Each phase transition represents a de-risking event that increases both the probability of success and the total deal value a buyer will pay. These benchmarks are derived from {DEAL_STATS.TOTAL_DEALS} real transactions across 12 therapeutic areas.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Biotech Asset Valuation by Development Phase</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'Median TDV', 'Upfront Range', 'Upfront % of TDV', 'Royalty Range']}
            rows={[
              ['Preclinical', '$150-$500M', '$15-$40M', '8-12%', '4-8%'],
              ['Phase 1', '$300M-$1.2B', '$30-$120M', '10-14%', '6-12%'],
              ['Phase 2', '$500M-$3.5B', '$80-$450M', '12-16%', '8-15%'],
              ['Phase 3', '$1.0B-$5.0B', '$200M-$1.0B', '15-20%', '12-20%'],
              ['Approved / Filed', '$2.0B-$10B+', '$500M-$4.0B', '20-40%', '15-25%'],
            ]}
            freeRows={5}
            footnote={`All TAs combined. Oncology skews to upper ranges. Source: Ambrosia Ventures analysis of ${DEAL_STATS.TOTAL_DEALS} transactions.`}
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Median Total Deal Value by Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Each phase transition approximately doubles total deal value. The Phase 1 to Phase 2 jump is the largest single value inflection in biopharma deal economics.</p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <HorizontalBarChart
              data={[
                { label: 'Preclinical', value: 325, displayValue: '$150-500M' },
                { label: 'Phase 1', value: 750, displayValue: '$300M-1.2B' },
                { label: 'Phase 2', value: 2000, displayValue: '$500M-3.5B' },
                { label: 'Phase 3', value: 3000, displayValue: '$1.0-5.0B' },
                { label: 'Approved', value: 6000, displayValue: '$2.0-10B+' },
              ]}
              maxValue={6000}
              color="#0d9488"
            />
            <p className="text-xs text-slate-400 mt-3">All TAs combined. Oncology skews to upper ranges. Source: Ambrosia Ventures analysis of {DEAL_STATS.TOTAL_DEALS} transactions.</p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Each phase transition approximately doubles total deal value, but the largest single jump occurs at proof-of-concept (Phase 2a data readout), where assets with positive PoC data see 2&ndash;4x valuation increases. For single-asset biotechs, Phase 2 proof-of-concept is the risk-adjusted optimal exit point &mdash; Phase 3 upside must be weighed against $200&ndash;500M trial costs and 40&ndash;50% failure rates.
            </p>
          </div>

          <VisualStatRow stats={[
            { value: '$1.5B', label: 'Median Phase 2 TDV (Oncology)', color: 'text-teal-700' },
            { value: '40-60%', label: 'Biomarker Premium', color: 'text-blue-700' },
            { value: '25-35%', label: 'BTD Premium', color: 'text-indigo-700' },
          ]} />

          <div className="my-8 grid sm:grid-cols-3 gap-4">
            <StatCard value="$1.5B" label="Median Phase 2 TDV" sub="Oncology, all modalities" />
            <StatCard value="$180M" label="Median Phase 2 Upfront" sub="Oncology, all modalities" />
            <StatCard value="12%" label="Median Royalty Rate" sub="Phase 2, tiered" />
          </div>

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-0 sm:rounded-xl my-12">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;A Phase 2 oncology asset is worth $800M&ndash;$2.5B in total deal value &mdash; but the difference between the low and high end is positioning, not data.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Analysis of {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions (2020&ndash;2026)</p>
            </div>
          </section>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 id="five-factors">The 5 Factors That Determine Your Asset&apos;s Value</h2>

            <p>
              Five factors account for approximately 90% of the variance in biotech asset valuations. Understanding each factor — and where your asset sits — is the foundation for setting realistic deal expectations and identifying value-creation opportunities before going to market.
            </p>

            <h3>1. Therapeutic Area</h3>
            <p>
              Oncology commands the highest deal values, with median total deal values 30-50% above the all-TA average. This premium reflects larger addressable markets, faster regulatory pathways, and deeper buyer pools. Immunology and neurology rank second and third, while rare disease commands above-average upfront ratios (15-20% of TDV) due to accelerated approval pathways and pricing power.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Asset Valuation by Therapeutic Area (Phase 2)</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Median TDV', 'Median Upfront', 'Premium vs. Average']}
            rows={[
              ['Oncology', '$1.5B', '$180M', '+35%'],
              ['Immunology', '$1.2B', '$140M', '+15%'],
              ['Hematology', '$1.1B', '$125M', '+10%'],
              ['Neurology', '$1.0B', '$110M', 'Baseline'],
              ['Metabolic', '$950M', '$100M', '-5%'],
              ['Rare Disease', '$800M', '$130M', 'Higher upfront ratio'],
              ['Cardiovascular', '$750M', '$85M', '-15%'],
            ]}
            freeRows={5}
            footnote={`Phase 2 assets, all modalities. Source: Ambrosia Ventures analysis of ${DEAL_STATS.TOTAL_DEALS} transactions.`}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Oncology commands a 35% premium over the all-TA average, but rare disease assets show disproportionately high upfront ratios (16% of TDV vs. 12% average) due to accelerated regulatory pathways and pricing power. When benchmarking your asset, start with the therapeutic area median, then layer in modality premiums and competitive positioning.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>2. Modality</h3>
            <p>
              Your modality — small molecule, antibody, ADC, cell therapy, gene therapy, or RNA — significantly affects valuation. ADCs command the highest median upfronts ($361M across all phases) due to platform scalability and commercial validation. Small molecules remain the highest-volume deal category but have lower median values unless targeting novel mechanisms. See our <Link href="/insights/adc-vs-bispecific-deal-benchmarks-2026" className="text-teal-600 font-medium hover:text-teal-700">ADC vs bispecific benchmarks</Link> for modality-specific data.
            </p>

            <h3>3. Development Phase</h3>
            <p>
              Each phase transition approximately doubles total deal value. The largest single jump occurs at proof-of-concept (Phase 2a data readout), where assets with positive PoC data see 2-4x valuation increases. Phase 3 initiation adds another 1.5-2x, and regulatory filing adds 1.3-1.5x. See our <Link href="/insights/phase-2-vs-phase-3-deal-economics" className="text-teal-600 font-medium hover:text-teal-700">Phase 2 vs Phase 3 deal economics</Link> analysis for detailed stage-gate data.
            </p>

            <h3>4. Competitive Position</h3>
            <p>
              First-in-class assets command 20-35% premiums over best-in-class assets in the same indication. However, best-in-class assets in validated target classes can also command strong valuations if differentiation is clear (better safety, superior efficacy, oral vs. IV). Crowded competitive landscapes compress valuations by 15-25% regardless of data quality.
            </p>

            <h3>5. Data Quality</h3>
            <p>
              The quality and maturity of your clinical data is the single most negotiable factor in valuation. Assets with biomarker-validated patient selection strategies, objective response endpoints, and durable follow-up data command 40-60% premiums over assets with less mature data packages. This is the highest-leverage area for value creation before going to market.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Biomarker validation is the single highest-ROI lever for increasing asset value before licensing. A companion diagnostic strategy or biomarker-enriched trial design signals efficient development in a defined patient population, reducing Phase 3 risk for buyers. Assets with biomarker-validated endpoints command 40&ndash;60% premiums &mdash; equivalent to advancing an entire development phase without the associated cost and timeline.
            </p>
          </div>

          <InsightEmailCapture slug="how-much-is-my-biotech-asset-worth" />

          <InsightCTA
            variant="mid"
            heading="Get Your Asset's Exact Valuation"
            description={`Model upfronts, milestones, royalties, and total deal value for your specific asset — calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions. Board-ready report in 60 seconds.`}
            calculatorHref="/report"
          />

          {/* ── PULL QUOTE 2 ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-0 sm:rounded-xl my-12">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;The difference between a $500M deal and a $1.5B deal often comes down to positioning, not clinical data.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Five strategies can increase your asset&apos;s value by 30&ndash;80% without additional clinical investment</p>
            </div>
          </section>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 id="increase-value">How to Increase Your Asset&apos;s Value Before Licensing</h2>

            <p>
              The difference between a $500M deal and a $1.5B deal often comes down to positioning, not clinical data. These five strategies can increase your asset&apos;s value by 30-80% without additional clinical investment.
            </p>

            <p>
              <strong>Biomarker validation.</strong> Assets with companion diagnostic strategies or biomarker-enriched trial designs command the largest premiums (40-60%). This signals to buyers that the asset can be developed efficiently in a defined patient population, reducing Phase 3 risk and accelerating time to market. If you have biomarker data, lead with it in every partnering conversation.
            </p>

            <p>
              <strong>Regulatory designation.</strong> Breakthrough therapy designation (BTD) increases median deal value by 25-35%. Fast track designation adds 10-15%. These designations signal FDA alignment on the development path and reduce regulatory risk — a key concern for large pharma buyers who model 2-3 year regulatory timelines into their rNPV calculations.
            </p>

            <p>
              <strong>Combination potential.</strong> Data showing additive or synergistic benefit in combination with standard-of-care or approved checkpoint inhibitors increases valuation by 20-30%. Buyers model combination revenues as incremental to monotherapy, effectively doubling the addressable market without proportional risk.
            </p>

            <p>
              <strong>Manufacturing readiness.</strong> CMC de-risking — GMP-compliant process, validated analytical methods, identified CDMO partners — reduces perceived risk for buyers. Manufacturing-ready assets close 30-40% faster and avoid the 10-15% discount that buyers apply to assets with CMC uncertainty.
            </p>

            <p>
              <strong>Competitive process.</strong> Running a structured partnering process with multiple interested buyers is the single fastest way to increase upfront payments. Assets marketed to 3+ serious buyers see 20-40% higher upfronts than bilateral negotiations. The <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Partner Matching engine</Link> identifies which of {DEAL_STATS.TOTAL_COMPANIES} companies are most likely to bid.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Value Impact of Regulatory Designation</h3>
            <p className="text-xs text-slate-400 mb-4">Breakthrough therapy designation (BTD) adds 25&ndash;35% to median deal value. The premium reflects FDA alignment and reduced regulatory risk for buyers.</p>
          </div>

          <ComparisonCard
            label="Impact of Breakthrough Therapy Designation on Deal Value"
            left={{ title: 'Without BTD', value: '$1.0B', sub: 'Phase 2 oncology, standard pathway' }}
            right={{ title: 'With BTD', value: '$1.3B', sub: '+25-35% premium, accelerated review' }}
          />

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-teal-900 mb-1">The competitive process premium</p>
            <p className="text-sm text-teal-800 leading-relaxed">
              In our database of {DEAL_STATS.TOTAL_DEALS} transactions, deals that involved competitive processes (3+ bidders) had median upfronts 32% higher than bilateral negotiations for comparable assets. Identifying the right partners — companies with pipeline gaps, patent cliffs, and active BD mandates in your space — is as important as clinical data in determining your final deal value.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The five value-creation strategies above are additive. An asset with biomarker validation (+40&ndash;60%), BTD designation (+25&ndash;35%), and a competitive process (+20&ndash;40%) can command 2&ndash;3x the valuation of an identical asset positioned without these advantages. The most successful out-licensing processes invest 6&ndash;12 months in value-creation activities before engaging buyers.
            </p>
          </div>

          {/* ── INTERACTIVE CALCULATOR ── */}
          <section className="my-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4 &middot; Interactive</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" id="model-your-deal">Model Your Own Deal</h2>
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of {DEAL_STATS.TOTAL_DEALS} verified transactions.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </section>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>How much is a Phase 2 biotech asset worth?</h3>
            <p>
              A Phase 2 biotech asset is worth $500M-$3.5B in total deal value depending on therapeutic area, modality, and data quality. Oncology Phase 2 assets command the highest values ($800M-$2.5B), followed by immunology ($600M-$2.0B) and neurology ($500M-$1.8B). Upfront payments typically represent 12-16% of total deal value at Phase 2. Use the <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> ({PRICING.REPORT_PRICE}) for asset-specific benchmarks.
            </p>

            <h3>What is my preclinical biotech asset worth?</h3>
            <p>
              Preclinical assets range from $50M-$500M in total deal value, with median upfronts of $15-40M. Platform technologies (ADCs, RNA) command the upper range due to multi-target scalability. Single-target preclinical assets in validated mechanisms trade at $100-250M TDV. The key valuation driver at preclinical stage is target validation and competitive differentiation.
            </p>

            <h3>How do I increase my biotech asset valuation before licensing?</h3>
            <p>
              Five strategies increase asset value: biomarker validation (40-60% premium), regulatory designation like BTD (25-35% premium), combination data (20-30% premium), manufacturing readiness (avoids 10-15% discount), and running a competitive process with multiple buyers (20-40% higher upfronts). Biomarker validation delivers the highest ROI.
            </p>

            <h3>What upfront payment should I expect?</h3>
            <p>
              Upfronts typically range from 10-18% of total deal value. For a Phase 2 oncology asset worth $1.5B TDV, expect $150M-$270M upfront. Later-stage assets command higher ratios (15-20% at Phase 3, 20-40% at approval). Competitive auction dynamics can push upfronts 20-40% above median benchmarks.
            </p>

            <h3>Does therapeutic area affect valuation?</h3>
            <p>
              Significantly. Oncology commands the highest deal values (35% above average), followed by immunology (+15%), hematology (+10%), and neurology (baseline). Within TAs, indication matters — an oncology asset in NSCLC is worth more than one in pancreatic cancer due to market size. See our <Link href="/insights/deal-terms-by-therapeutic-area" className="text-teal-600 font-medium hover:text-teal-700">deal terms by TA</Link> analysis.
            </p>
          </div>

          {/* ── EMAIL CAPTURE ── */}
          <section className="my-12">
            <InlineEmailCapture
              heading="Get Valuation Benchmarks First"
              description={`Join 2,000+ BD professionals who receive our quarterly benchmarks the day they publish — plus weekly deal intelligence from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`}
              source="how-much-is-my-biotech-asset-worth"
            />
          </section>

          {/* ── CITE THIS DATA ── */}
          <section className="my-12">
            <CiteThisData
              title="How Much Is My Biotech Asset Worth? Phase-by-Phase Valuation Guide"
              pageUrl="/insights/how-much-is-my-biotech-asset-worth"
            />
          </section>

          <RelatedInsights articles={[
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'When to deal at each stage and the proof-of-concept inflection point.',
              badge: 'Comparison',
            },
            {
              href: '/insights/oncology-upfront-payment-benchmarks',
              title: 'Oncology Upfront Payment Benchmarks',
              description: 'Phase-by-phase upfront data across all oncology modalities.',
              badge: 'Benchmarks',
            },
            {
              href: '/insights/pharma-partner-identification-guide',
              title: 'Pharma Partner Identification Guide',
              description: 'How to find the right licensing partner for your asset.',
              badge: 'Strategy',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Get Your Asset's Exact Valuation"
          description={`Generate a board-ready deal report with comparable transactions, rNPV valuation, partner matching, and negotiation playbook — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions. ${PRICING.REPORT_PRICE} one-time.`}
          calculatorHref="/report"
        />
      </main>
      <SiteFooter />
    </>
  );
}
