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
import { DEAL_STATS } from '@/lib/config/constants';

const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));

export const metadata: Metadata = {
  title: 'Licensing vs Acquisition Deal Terms Compared — 2026 Data | Ambrosia Ventures',
  description: `Side-by-side comparison of licensing vs acquisition deal structures from ${DEAL_STATS.TOTAL_DEALS} biopharma transactions. Upfront percentages, milestone allocation, royalties, timelines, and when to pursue each path.`,
  keywords: [
    'licensing vs acquisition',
    'pharma deal structure comparison',
    'licensing deal terms vs acquisition',
    'biotech licensing or sell',
    'pharma acquisition premium',
    'biopharma deal structure 2026',
    'out-licensing vs M&A',
    'biotech exit strategy',
  ],
  openGraph: {
    title: 'Licensing vs Acquisition Deal Terms Compared — 2026 Data',
    description: `Side-by-side comparison from ${DEAL_STATS.TOTAL_DEALS} biopharma transactions. When to license vs sell.`,
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms',
    images: [{ url: '/api/og?title=Licensing%20vs%20Acquisition%20Deal%20Terms&subtitle=2026%20Market%20Data&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Licensing vs Acquisition Deal Terms — 2026 Data',
    description: `Upfront %, milestones, royalties, timelines. Side-by-side from ${DEAL_STATS.TOTAL_DEALS} real deals.`,
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms',
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

export default function LicensingVsAcquisitionPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Licensing vs Acquisition Deal Terms', item: 'https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Licensing vs Acquisition Deal Terms Compared — 2026 Data',
    description: 'Side-by-side comparison of licensing vs acquisition deal structures across upfront, milestones, royalties, timelines, and risk allocation.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/licensing-vs-acquisition-deal-terms',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the typical upfront payment in a biotech licensing deal vs an acquisition?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'In licensing deals, upfront payments represent 15-20% of total deal value (TDV), with the median upfront ranging from $50M at preclinical to $300M at Phase 2. In acquisitions, the upfront is 100% of the purchase price, typically at a 45-60% premium to the unaffected market cap. Licensing preserves long-term upside through milestones and royalties; acquisitions deliver immediate, certain value.',
        },
      },
      {
        '@type': 'Question',
        name: 'When should a biotech pursue licensing vs selling the company?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pursue licensing when: you have a multi-asset pipeline (licensing one asset funds development of others), the asset has significant remaining upside from milestones and royalties, or you want to retain commercial rights in certain geographies. Pursue acquisition when: the company is a single-asset story, you need to provide liquidity to investors, the acquisition premium exceeds the risk-adjusted value of licensing economics, or you lack the infrastructure for a licensing partnership.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do milestone payments compare between licensing and acquisition deals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Licensing deals allocate 55-65% of total deal value to milestones, split between clinical (35-45%), regulatory (20-30%), and commercial (30-40%) triggers. Acquisitions have no milestones in the traditional sense, though contingent value rights (CVRs) are used in approximately 15-20% of acquisitions to bridge valuation gaps, paying an additional $2-10 per share on clinical or regulatory milestones.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are typical royalty rates in pharma licensing deals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Royalty rates in licensing deals typically range from 8-15% of net sales, tiered by revenue thresholds. Earlier-stage deals command lower royalties (6-10% at Phase 1) while later-stage deals command higher rates (12-20% at Phase 3). Acquisitions do not include royalties — the buyer captures 100% of commercial upside. This is one reason total economic value from licensing can exceed acquisition value for blockbuster products.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does a biotech licensing deal take vs an acquisition?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Licensing deals typically take 4-8 months from term sheet to close, involving due diligence, contract negotiation, and IP review. Acquisitions take 3-6 months from announcement to close, but the total process including banker engagement, auction dynamics, and regulatory clearance (HSR/FTC) can extend to 9-12 months. Acquisitions above $200M in deal value are increasingly subject to FTC premerger filing requirements, adding 30-45 days minimum.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="licensing-vs-acquisition" />
      <StickyTOC sections={[
        { id: 'head-to-head', label: 'Head-to-Head', number: 1 },
        { id: 'licensing-economics', label: 'Licensing Economics', number: 2 },
        { id: 'acquisition-economics', label: 'Acquisition Economics', number: 3 },
        { id: 'when-to-license', label: 'When to License', number: 4 },
        { id: 'when-to-sell', label: 'When to Sell', number: 5 },
        { id: 'real-examples', label: 'Market Examples', number: 6 },
        { id: 'faq', label: 'FAQ', number: 7 },
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
              <span className="text-slate-200">Licensing vs Acquisition</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Deal Structure Comparison
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Licensing vs Acquisition:{' '}
              <span className="text-blue-400">Deal Terms Compared</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              Side-by-side economics from {DEAL_STATS.TOTAL_DEALS} real biopharma transactions. When each structure maximizes value and what the data shows about upfronts, milestones, and long-term economics.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{DEAL_STATS.TOTAL_DEALS}</div>
                <div className="text-xs text-slate-400">Deals analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">5</div>
                <div className="text-xs text-slate-400">Deal types</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">45-60%</div>
                <div className="text-xs text-slate-400">Median acq. premium</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 2, 2026" />

          <KeyTakeaways takeaways={[
            'Licensing deals allocate 15-20% upfront and preserve long-term economics through milestones (55-65%) and royalties (8-15%). Acquisitions deliver 100% at close.',
            'For blockbuster assets ($2B+ peak sales), total licensing economics can exceed acquisition value by 1.5-3x — but only if the product succeeds commercially.',
            'Acquisitions provide certainty and liquidity. The median premium is 45-60% to unaffected market cap, with Phase 3 assets commanding premiums above 80%.',
            'The decision is not purely financial: pipeline breadth, investor pressure, team retention, and commercial ambition all factor into the optimal structure.',
          ]} />

          {/* ── SECTION 1: HEAD-TO-HEAD ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 id="head-to-head">Head-to-Head: Licensing vs Acquisition Economics</h2>

            <p>
              The licensing vs acquisition decision is the most consequential structural choice in biopharma deal-making. It determines not only how much value you capture at close, but the entire trajectory of your company&apos;s economics over the next decade. Here is how the two structures compare across every major dimension.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Side-by-Side: Licensing vs Acquisition Deal Terms</h3>
            <p className="text-xs text-slate-400 mb-4">Comprehensive comparison across 10 dimensions from {DEAL_STATS.TOTAL_DEALS} transactions (2020&ndash;2026).</p>
          </div>

          <GatedBenchmarkTable
            headers={['Dimension', 'Licensing', 'Acquisition']}
            rows={[
              ['Upfront (% of TDV)', '15-20%', '100%'],
              ['Milestones', '55-65% of TDV', 'CVRs in ~15-20% of deals'],
              ['Royalties', '8-15% of net sales', 'N/A (buyer captures 100%)'],
              ['Timeline to close', '4-8 months', '3-6 months (9-12 with FTC)'],
              ['Risk allocation', 'Shared: licensor retains milestone/royalty risk', 'Transferred: buyer assumes all risk'],
              ['Control retention', 'Partial (co-development, territory splits)', 'None (full transfer)'],
              ['Pipeline impact', 'Fund other programs with upfront', 'Company ceases to exist'],
              ['Investor liquidity', 'Partial (upfront cash)', 'Full exit'],
              ['Median deal value (Ph2)', '$1.2-1.8B TDV', '$1.5-3.5B purchase price'],
              ['Upside capture', 'Royalties on $2B+ blockbusters', 'Premium at close, no further upside'],
            ]}
            freeRows={5}
            footnote={`Source: Solidus, ${DEAL_STATS.TOTAL_DEALS} transactions 2020-2026.`}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The fundamental tradeoff is certainty vs magnitude. Acquisitions deliver 100% of value at close with zero execution risk. Licensing delivers 15-20% at close but can generate 1.5-3x total value for blockbuster assets through milestones and royalties over 8-15 years. The right choice depends on your asset&apos;s commercial trajectory and your organization&apos;s risk tolerance.
            </p>
          </div>

          <ComparisonCard
            label="Upfront Economics at Close"
            left={{ title: 'Licensing Deal', value: '14-20%', sub: 'Upfront as % of total deal value' }}
            right={{ title: 'Acquisition', value: '100%', sub: 'Full purchase price at close' }}
          />

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Upfront Payment as % of Total Deal Value by Deal Type</h3>
            <p className="text-xs text-slate-400 mb-4">Median upfront as percentage of total deal value across 5 deal structures.</p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <HorizontalBarChart
              data={[
                { label: 'Acquisition', value: 100, displayValue: '100%' },
                { label: 'Collaboration', value: 22, displayValue: '22%' },
                { label: 'Licensing', value: 17, displayValue: '14-20%' },
                { label: 'Co-Development', value: 12, displayValue: '10-14%' },
                { label: 'Option', value: 8, displayValue: '5-10%' },
              ]}
              maxValue={100}
              color="#0d9488"
            />
            <p className="text-xs text-slate-400 mt-3">Source: Solidus, {DEAL_STATS.TOTAL_DEALS} transactions.</p>
          </div>

          <VisualStatRow stats={[
            { value: '15-20%', label: 'Licensing Upfront Ratio', color: 'text-slate-900' },
            { value: '45-60%', label: 'Acquisition Premium', color: 'text-teal-700' },
            { value: '8-15%', label: 'Royalty Rate Range', color: 'text-blue-700' },
          ]} />

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:rounded-xl sm:mx-0 my-12">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;For a drug that achieves $3B+ in peak annual sales, licensing economics can deliver $4-6B in total value &mdash; potentially exceeding a $3B acquisition price.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Risk-adjusted analysis of {DEAL_STATS.TOTAL_DEALS} verified transactions (2020&ndash;2026)</p>
            </div>
          </section>

          {/* ── SECTION 2: LICENSING ECONOMICS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 id="licensing-economics">Licensing Economics in Detail</h2>

            <p>
              In a standard licensing structure, economics are distributed across three components: upfront payment (15-20% of TDV), milestones (55-65%), and royalties (8-15% of net sales). This creates a waterfall of value realization that stretches over 8-15 years from signing to peak commercial sales.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Licensing Deal Economics by Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Median upfront, total deal value, upfront percentage, and royalty range across all development stages.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Phase at Signing', 'Median Upfront', 'Median TDV', 'Upfront %', 'Royalty Range']}
            rows={[
              ['Preclinical', '$50-80M', '$500-900M', '9-11%', '3-8%'],
              ['Phase 1', '$100-180M', '$800-1,400M', '11-13%', '6-12%'],
              ['Phase 2', '$200-400M', '$1.2-2.5B', '14-18%', '8-15%'],
              ['Phase 3', '$400-900M', '$2.0-5.0B', '16-20%', '12-20%'],
              ['Approved', '$1.0-3.0B', '$3.0-8.0B', '25-35%', '18-25%'],
            ]}
            freeRows={3}
            footnote="Ranges reflect 25th-75th percentile. Oncology, immunology, neurology, metabolic TAs."
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The Phase 1 to Phase 2 inflection is the single largest value jump in licensing economics. Median upfront doubles from $100-180M to $200-400M, and royalty rates step up from 6-12% to 8-15%. This reflects the market&apos;s premium for proof-of-concept data &mdash; the moment clinical risk is meaningfully de-risked.
            </p>
          </div>

          {/* ── SECTION 3: ACQUISITION ECONOMICS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 id="acquisition-economics">Acquisition Economics in Detail</h2>

            <p>
              Acquisitions deliver the entire purchase price at close (or shortly after regulatory approval of the transaction). The key metric is the premium to unaffected market cap &mdash; the price target before any deal speculation began to influence the stock.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Acquisition Premiums by Clinical Stage</h3>
            <p className="text-xs text-slate-400 mb-4">Median premium, deal size, and CVR frequency across development stages.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Stage', 'Median Premium', 'Median Deal Size', 'CVR Frequency']}
            rows={[
              ['Preclinical / Platform', '35-50%', '$500M-$2B', '~25%'],
              ['Phase 1', '40-55%', '$800M-$3B', '~20%'],
              ['Phase 2 (PoC+)', '50-75%', '$1.5-$5B', '~15%'],
              ['Phase 3', '60-100%+', '$3-$15B', '~10%'],
              ['Approved / Commercial', '25-45%', '$5-$50B+', '<5%'],
            ]}
            freeRows={3}
            footnote="Approved assets show lower premiums because market cap already reflects commercial value."
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              CVR (Contingent Value Rights) usage declines sharply with stage: ~25% at preclinical vs &lt;5% for approved assets. This reflects the diminishing uncertainty in later-stage deals. When the data is clear, buyers are willing to pay the full premium upfront rather than deferring value to uncertain contingencies.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">The blockbuster crossover</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              For a drug that achieves $3B+ in peak annual sales, licensing economics (upfront + milestones + 12% royalties over 12 years) can deliver $4-6B in total value &mdash; potentially exceeding a $3B acquisition price. But this requires commercial success, which is never guaranteed. The licensing vs acquisition decision is fundamentally a bet on your asset&apos;s commercial trajectory.
            </p>
          </div>

          <InsightEmailCapture slug="licensing-vs-acquisition-deal-terms" />

          <InsightCTA
            variant="mid"
            heading="Benchmark Your Deal Type"
            description="Model licensing, acquisition, co-dev, option, and collaboration structures side-by-side for your specific asset."
          />

          {/* ── MINI CALCULATOR ── */}
          <MiniCalculator />

          {/* ── SECTION 4: WHEN TO LICENSE ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 id="when-to-license">When to License</h2>

            <ul>
              <li><strong>Multi-asset pipeline.</strong> If you have 3+ programs, licensing your lead asset funds the development of your pipeline without diluting equity or losing the company.</li>
              <li><strong>Blockbuster potential.</strong> For assets with $2B+ peak sales potential, the royalty stream alone can exceed the incremental value of an acquisition premium.</li>
              <li><strong>Geographic optionality.</strong> License ex-US rights while retaining US commercial rights (or vice versa). This is increasingly common in oncology, where the US market alone can support a $1B+ revenue asset.</li>
              <li><strong>Early stage with upcoming catalysts.</strong> If positive Phase 2 data could 2-3x your valuation, licensing at Phase 1 (preserving upside through milestones) may outperform a Phase 1 acquisition.</li>
            </ul>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Geographic splits are increasingly the &ldquo;best of both worlds&rdquo; strategy. By licensing ex-US rights while retaining US commercial rights, a biotech can capture a $200-400M upfront plus royalties on 40-50% of the global market &mdash; while building commercial infrastructure for the US launch. This structure is now seen in approximately 30% of Phase 2+ oncology licensing deals.
            </p>
          </div>

          {/* ── SECTION 5: WHEN TO SELL ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 id="when-to-sell">When to Sell</h2>

            <ul>
              <li><strong>Single-asset company.</strong> If the company&apos;s entire value is one program, an acquisition eliminates execution risk and provides clean investor liquidity.</li>
              <li><strong>Investor pressure.</strong> VC-backed biotechs with 7-10 year fund cycles may need to provide exits. An acquisition at 50-75% premium is often preferred over a licensing deal that distributes value over a decade.</li>
              <li><strong>Competitive risk.</strong> If 3+ competing programs are in similar stages, an acquisition locks in value before a competitor readout could compress your premium.</li>
              <li><strong>Valuation peak.</strong> If your stock is at an all-time high following positive data and you believe the market is fully pricing the opportunity, selling captures maximum value with certainty.</li>
            </ul>
          </div>

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:rounded-xl sm:mx-0 my-12">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;The licensing vs acquisition decision is not purely financial &mdash; pipeline breadth, investor pressure, team retention, and commercial ambition all factor into the optimal structure.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Based on structural analysis of {DEAL_STATS.TOTAL_DEALS} biopharma transactions</p>
            </div>
          </section>

          {/* ── SECTION 6: RECENT EXAMPLES ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 id="real-examples">Recent Market Examples</h2>

            <p>
              The distinction between licensing and acquisition economics is best illustrated through recent deals. In 2024-2025, several transactions highlighted the tradeoffs:
            </p>

            <ul>
              <li><strong>Licensing: AbbVie/Celsius (TL1A, immunology)</strong> &mdash; $250M upfront, $3.2B TDV at Phase 2. AbbVie acquired rights while Celsius retained royalty upside on what could be a $5B+ franchise. If the drug succeeds, Celsius captures more value than an outright sale.</li>
              <li><strong>Acquisition: AbbVie/Cerevel (neuroscience)</strong> &mdash; $8.7B, 73% premium. Single-asset neuroscience company with Phase 3 schizophrenia data. Clean exit, full liquidity, no execution risk for Cerevel shareholders.</li>
              <li><strong>Hybrid: Merck/Daiichi Sankyo (ADC collaboration)</strong> &mdash; $4B upfront, $22B TDV. Structured as a collaboration rather than acquisition, allowing Daiichi to retain 50% economics on one of the most valuable ADC platforms in development.</li>
            </ul>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The Merck/Daiichi Sankyo deal ($4B upfront, $22B TDV) illustrates why collaboration structures are growing: Daiichi retained 50% of economics on a platform worth potentially $40B+ over its lifecycle. Had Daiichi sold outright at $22B, they would have left substantial value on the table. The collaboration structure let both parties share in the upside.
            </p>
          </div>

          {/* ── SECTION 7: FAQ ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 7</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>What is the typical upfront in a licensing deal vs an acquisition?</h3>
            <p>
              Licensing upfronts represent 15-20% of total deal value ($200-400M at Phase 2). Acquisitions deliver 100% at close, at a 45-60% premium to unaffected market cap ($1.5-5B at Phase 2). The key difference is certainty vs long-term upside.
            </p>

            <h3>When should a biotech license vs sell?</h3>
            <p>
              License when you have a multi-asset pipeline, blockbuster potential warrants royalty capture, or upcoming catalysts will increase value. Sell when you are a single-asset company, investors need liquidity, or competitive dynamics threaten current valuation. See our <Link href="/insights/biotech-out-licensing-deal-terms-2025-2026" className="text-teal-600 font-medium hover:text-teal-700">out-licensing deal terms guide</Link> for detailed structure economics.
            </p>

            <h3>How do milestones compare between structures?</h3>
            <p>
              Licensing milestones account for 55-65% of TDV across clinical, regulatory, and commercial triggers. Acquisitions rarely include milestones, though ~15-20% use contingent value rights (CVRs) to bridge valuation gaps on specific clinical or regulatory events.
            </p>

            <h3>What are typical royalty rates in pharma licensing deals?</h3>
            <p>
              Royalties range from 8-15% of net sales in standard licensing structures, tiered by revenue thresholds. Earlier-stage deals command lower royalties (6-10%) while later-stage or approved assets command 18-25%. Acquisitions have no royalty component.
            </p>

            <h3>How long does each deal type take?</h3>
            <p>
              Licensing deals close in 4-8 months. Acquisitions take 3-6 months from announcement, but the full process (banker engagement, auction, FTC review) can extend to 9-12 months. Deals above $200M face FTC premerger filing requirements adding 30-45 days.
            </p>
          </div>

          {/* ── INLINE EMAIL CAPTURE ── */}
          <InlineEmailCapture
            heading="Get Weekly Deal Intelligence"
            description="Join 2,000+ BD professionals who receive our weekly analysis of biopharma licensing trends, deal benchmarks, and negotiation insights."
            source="licensing-vs-acquisition-insight"
          />

          {/* ── CITE THIS DATA ── */}
          <CiteThisData
            title="Licensing vs Acquisition Deal Terms Compared — 2026 Data"
            pageUrl="/insights/licensing-vs-acquisition-deal-terms"
          />

          <RelatedInsights articles={[
            {
              href: '/insights/biotech-out-licensing-deal-terms-2025-2026',
              title: 'Out-Licensing Deal Terms 2025-2026',
              description: 'Complete benchmark data across 5 deal types, 12 TAs, and all development phases.',
              badge: 'Guide',
            },
            {
              href: '/insights/rnpv-vs-dcf-biotech-valuation',
              title: 'rNPV vs DCF for Biotech Valuation',
              description: 'When to use each model and how PoS adjustment changes value by 5-20x.',
              badge: 'Methods',
            },
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'The proof-of-concept inflection and optimal timing for your deal.',
              badge: 'Comparison',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Benchmark Your Specific Deal Type"
          description={`Model licensing, acquisition, co-dev, option, and collaboration structures — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
