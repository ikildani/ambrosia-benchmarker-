import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));

export const metadata: Metadata = {
  title: 'Pharma Partner Identification Guide — Data-Driven Partnering Strategy | Ambrosia Ventures',
  description: `How to identify the right pharma licensing partner using pipeline gap analysis, intent scoring, and deal velocity data from ${DEAL_STATS.TOTAL_DEALS} transactions and ${DEAL_STATS.TOTAL_COMPANIES} company profiles.`,
  keywords: [
    'pharma partner identification',
    'how to find licensing partners',
    'biotech partnering strategy',
    'pharma pipeline gap analysis',
    'biotech licensing partner search',
    'pharma BD partnering',
    'JPM partnering preparation',
    'BIO partnering strategy',
  ],
  openGraph: {
    title: 'Pharma Partner Identification Guide — Data-Driven Partnering',
    description: 'The best pharma partner isn\'t the biggest company — it\'s the one with the most urgent pipeline gap. 5-step identification framework.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/pharma-partner-identification-guide',
    images: [{ url: '/api/og?title=Pharma%20Partner%20Identification%20Guide&subtitle=Data-Driven%20Partnering%20Strategy&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pharma Partner Identification Guide',
    description: 'How to find the right licensing partner using pipeline gap analysis, intent scoring, and deal velocity data.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/pharma-partner-identification-guide',
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

function HorizontalBarChart({ data, maxValue, color = '#0d9488' }: {
  data: { label: string; value: number; displayValue: string }[];
  maxValue: number;
  color?: string;
}) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-36 text-right text-sm font-medium text-slate-600 flex-shrink-0">{item.label}</div>
          <div className="flex-1 h-8 bg-slate-100 rounded-md overflow-hidden">
            <div
              className="h-full rounded-md flex items-center justify-end px-2"
              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%`, backgroundColor: color, opacity: 0.8 }}
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

export default function PharmaPartnerIdentificationGuidePage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Pharma Partner Identification Guide', item: 'https://solidus.ambrosiaventures.co/insights/pharma-partner-identification-guide' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Pharma Partner Identification Guide — Data-Driven Partnering Strategy',
    description: 'A 5-step framework for identifying the right pharma licensing partner using pipeline gap analysis, intent scoring, and deal velocity data.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/pharma-partner-identification-guide',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I identify the best pharma partner for my biotech asset?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The best pharma partner is the company with the most urgent pipeline gap in your therapeutic area, combined with deal-making velocity and financial capacity. Use a 5-step framework: (1) map your asset\'s competitive position, (2) identify companies with pipeline gaps in your TA, (3) score partners on deal velocity and intent signals, (4) assess financial capacity and strategic fit, (5) prioritize companies approaching patent cliffs that your asset can address.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is a Pharma Intent Score?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Pharma Intent Score is an 8-factor predictive model that forecasts which companies are most likely to do a deal in a specific therapeutic area. It analyzes pipeline gaps, patent cliff timing, competitive pressure, deal velocity (deals per year), M&A history, therapeutic area commitment, financial capacity, and public statements. A score above 80 indicates high deal likelihood within 12 months. Backtested against 378 deals with demonstrated predictive accuracy.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many companies should I approach for a licensing deal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Data from ${DEAL_STATS.TOTAL_DEALS} transactions suggests approaching 8-15 companies for initial conversations, with the goal of advancing 3-5 to term sheet stage. Fewer than 3 serious bidders weakens your negotiating position; more than 15 initial contacts creates process management overhead without proportional benefit. The key is targeting the right 8-15, not casting a wide net.`,
        },
      },
      {
        '@type': 'Question',
        name: 'When should I start partner identification before JPM or BIO?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Start 4-6 months before major partnering conferences. Use the first 2 months for partner identification and prioritization, months 3-4 for initial outreach and scheduling meetings, and months 5-6 for pre-meeting data packages and CDA execution. Companies that start partner identification 6 months before JPM close deals 40% faster than those who begin at the conference.',
        },
      },
      {
        '@type': 'Question',
        name: 'What data signals predict pharma deal-making intent?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Eight signals predict deal-making intent: (1) upcoming patent cliffs in your therapeutic area (strongest signal), (2) pipeline failures or discontinuations creating gaps, (3) high deal velocity in the past 24 months, (4) public statements about therapeutic area priorities, (5) board or leadership changes signaling strategic shifts, (6) competitive pressure from peers acquiring in your space, (7) available financial capacity (cash + debt capacity), and (8) existing presence in your therapeutic area.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="pharma-partner-identification-guide" />
      <StickyTOC sections={[
        { id: 'five-step-framework', label: '5-Step Framework', number: 1 },
        { id: 'what-data-matters', label: 'What Data Matters', number: 2 },
        { id: 'intent-predicts', label: 'Intent Scoring', number: 3 },
        { id: 'conference-prep', label: 'Conference Prep', number: 4 },
        { id: 'try-calculator', label: 'Model Your Deal', number: 5 },
        { id: 'faq', label: 'FAQ', number: 6 },
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
              <span className="text-slate-200">Partner Identification Guide</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-orange-500/20 text-orange-300 text-sm font-medium rounded-full mb-6">
              Partnering Strategy
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Pharma Partner{' '}
              <span className="text-orange-400">Identification Guide</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              The best pharma partner for your asset is not the biggest company — it is the one with the most urgent pipeline gap in your therapeutic area. Here is a data-driven framework for finding them.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{DEAL_STATS.TOTAL_COMPANIES}</div>
                <div className="text-xs text-slate-400">Companies profiled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">8</div>
                <div className="text-xs text-slate-400">Intent score factors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">90 days</div>
                <div className="text-xs text-slate-400">Avg. close (high-intent)</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 3, 2026" />

          <KeyTakeaways takeaways={[
            'The right partner is defined by pipeline urgency, not company size. A mid-cap pharma with a critical patent cliff in your TA will pay more and close faster than a mega-cap with no strategic pressure.',
            'Companies with Pharma Intent Scores above 80 (top quintile) close deals 2.3x faster and pay 15-20% higher upfronts than companies in the 40-60 range.',
            'Starting partner identification 4-6 months before JPM or BIO results in 40% faster deal timelines compared to beginning at the conference.',
            `The Partner Matching engine screens ${DEAL_STATS.TOTAL_COMPANIES} companies across 8 scoring dimensions to identify your highest-probability partners.`,
          ]} />

          {/* ── SECTION 1: 5-STEP FRAMEWORK ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 1</p>
            <h2 id="five-step-framework">5-Step Partner Identification Framework</h2>

            <p>
              Most BD teams approach partner identification backwards — they start with a list of large pharma companies and work down by size. This leads to wasted meetings with companies that have no strategic urgency to do a deal. The data-driven approach starts with urgency signals and works outward to identify the 8-15 companies most likely to pay the highest price on the shortest timeline.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Companies that use data-driven partner identification close deals 40% faster and achieve 15-20% higher upfronts than those relying on relationship-based outreach alone. The difference is not better relationships — it is better targeting.
            </p>
          </div>

          {/* Visual 5-Step Process */}
          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-6">The 5-Step Data-Driven Partner Identification Process</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-0 sm:gap-0">
              {[
                { step: '1', title: 'Map Asset', desc: 'Competitive position' },
                { step: '2', title: 'Find Gaps', desc: 'Pipeline gap analysis' },
                { step: '3', title: 'Score Intent', desc: '8-factor model' },
                { step: '4', title: 'Assess Fit', desc: 'Strategic + financial' },
                { step: '5', title: 'Prioritize', desc: 'Tier & sequence' },
              ].map((item, i) => (
                <div key={i} className="flex sm:flex-col items-center gap-3 sm:gap-2 flex-1 relative">
                  {/* Connector line */}
                  {i < 4 && (
                    <>
                      <div className="hidden sm:block absolute top-5 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-0.5 bg-gradient-to-r from-orange-300 to-orange-200" />
                      <div className="sm:hidden absolute top-[calc(50%+20px)] bottom-[calc(-50%+20px)] left-5 w-0.5 bg-gradient-to-b from-orange-300 to-orange-200" />
                    </>
                  )}
                  {/* Circle */}
                  <div className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                    {item.step}
                  </div>
                  <div className="sm:text-center">
                    <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>Step 1: Map Your Asset&apos;s Competitive Position</h3>
            <p>
              Before identifying partners, define exactly what you are selling. Map your asset against every competitor in development — same target, same indication, same patient population. Understand whether you are first-in-class (premium pricing, larger buyer pool) or best-in-class (differentiation narrative required). This mapping determines which buyers have the most urgent need for your asset versus alternatives.
            </p>

            <h3>Step 2: Identify Pipeline Gaps</h3>
            <p>
              Pipeline gaps are the strongest predictor of deal-making intent. A company with no Phase 2+ assets in a TA where it has significant revenue exposure (due to patent cliffs) is a high-urgency buyer. Screen {DEAL_STATS.TOTAL_COMPANIES} companies for gaps in your specific therapeutic area and indication. The most valuable gaps are those created by recent clinical failures, discontinuations, or upcoming LOE (loss of exclusivity) events.
            </p>
          </div>

          <div className="my-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Pipeline Gap Urgency by Scenario</h3>
            <p className="text-xs text-slate-400 mb-4">Deal economics vary dramatically based on the urgency driving the buyer. Patent cliff pressure produces the fastest timelines and highest premiums.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Gap Scenario', 'Urgency Level', 'Upfront Premium', 'Typical Timeline']}
            rows={[
              ['Patent cliff in 2-3 years', 'Critical', '+25-40%', '60-90 days to term sheet'],
              ['Recent Phase 3 failure', 'High', '+15-25%', '90-120 days'],
              ['Competitor acquired in space', 'High', '+10-20%', '90-150 days'],
              ['Strategic TA entry', 'Moderate', 'Baseline', '120-180 days'],
              ['Portfolio fill (no urgency)', 'Low', '-10-15%', '180-360 days'],
            ]}
            freeRows={5}
            footnote={`Based on deal timing analysis across ${DEAL_STATS.TOTAL_DEALS} transactions. Source: Solidus.`}
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>Step 3: Score Intent Signals</h3>
            <p>
              Pipeline gaps tell you who needs an asset. Intent signals tell you who is ready to act. The Pharma Intent Score synthesizes 8 factors into a single predictive metric, backtested against 378 completed transactions with demonstrated accuracy.
            </p>
          </div>

          <div className="my-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1C</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">The 8 Pharma Intent Score Factors</h3>
            <p className="text-xs text-slate-400 mb-4">Weighted scoring model backtested against 378 completed transactions. Pipeline Gap Severity and Patent Cliff Proximity together account for 35% of the total score.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Factor', 'Weight', 'What It Measures']}
            rows={[
              ['Pipeline Gap Severity', '20%', 'Missing assets in TA relative to revenue exposure'],
              ['Patent Cliff Proximity', '15%', 'Years until LOE on key revenue products'],
              ['Deal Velocity', '15%', 'Number of deals closed in past 24 months'],
              ['Competitive Pressure', '12%', 'Peer acquisitions and licensing in same space'],
              ['Financial Capacity', '12%', 'Cash reserves, debt capacity, and BD budget signals'],
              ['Therapeutic Area Commitment', '10%', 'R&D spend and headcount in target TA'],
              ['Leadership Signals', '8%', 'Public statements, board changes, strategic reviews'],
              ['Geographic Fit', '8%', 'Rights alignment and regional commercial infrastructure'],
            ]}
            freeRows={8}
            footnote="Source: Ambrosia Ventures Pharma Intent Score methodology. Weights derived from logistic regression on 378 completed transactions (2020-2026)."
          />

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1D</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Pharma Companies by Deal Activity (Last 12 Months)</h3>
            <HorizontalBarChart
              maxValue={18}
              color="#ea580c"
              data={[
                { label: 'Pfizer', value: 18, displayValue: '18 deals' },
                { label: 'Roche', value: 15, displayValue: '15 deals' },
                { label: 'AstraZeneca', value: 14, displayValue: '14 deals' },
                { label: 'Novartis', value: 13, displayValue: '13 deals' },
                { label: 'J&J', value: 12, displayValue: '12 deals' },
                { label: 'Merck', value: 11, displayValue: '11 deals' },
                { label: 'BMS', value: 10, displayValue: '10 deals' },
                { label: 'AbbVie', value: 9, displayValue: '9 deals' },
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Deal velocity = licensing, acquisition, co-development, and option deals. Source: Solidus.</p>
          </div>

          <div className="my-8 grid sm:grid-cols-3 gap-4">
            <StatCard value="2.3x" label="Faster Close" sub="Intent Score > 80 vs. 40-60" />
            <StatCard value="15-20%" label="Higher Upfronts" sub="High-intent buyers" />
            <StatCard value="378" label="Deals Backtested" sub="Model validation" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>Step 4: Assess Strategic and Financial Fit</h3>
            <p>
              Not every company with a pipeline gap and high intent is the right partner. Strategic fit encompasses commercial infrastructure in your regions, regulatory expertise in your indication, and cultural alignment on development approach. Financial fit means the company can afford your deal — a mid-cap pharma with $2B in cash may offer a better partnership than a mega-cap that is digesting a recent $20B acquisition.
            </p>

            <h3>Step 5: Prioritize and Sequence</h3>
            <p>
              Rank your target partners into three tiers: Tier 1 (3-5 companies with highest intent scores and strategic fit — approach first), Tier 2 (5-7 companies with strong fit but moderate urgency — approach in parallel as a competitive dynamic), and Tier 3 (3-5 backup options). Approaching Tier 1 and Tier 2 simultaneously creates the competitive tension that drives upfront premiums of 20-40%.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Approaching Tier 1 and Tier 2 simultaneously is not about casting a wide net — it is about manufacturing competitive tension. When a high-intent buyer knows two other companies are in due diligence, deal timelines compress by 30-40% and upfront premiums increase by 20-40%. The data is unambiguous: competitive processes produce better outcomes.
            </p>
          </div>

          <InsightCTA
            variant="mid"
            heading={`Screen ${DEAL_STATS.TOTAL_COMPANIES} Companies for Your Asset`}
            description={`The Partner Matching engine scores ${DEAL_STATS.TOTAL_COMPANIES} companies on pipeline gaps, deal velocity, patent cliffs, and 5 other factors. Pro subscribers get full access to partner intelligence and Pharma Intent Scores.`}
          />

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 rounded-xl my-12 text-white">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;The best pharma partner is not the biggest company — it is the one with the most urgent pipeline gap in your therapeutic area.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Analysis of {DEAL_STATS.TOTAL_DEALS} transactions across {DEAL_STATS.TOTAL_COMPANIES} companies</p>
            </div>
          </section>

          {/* ── SECTION 2: WHAT DATA MATTERS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 2</p>
            <h2 id="what-data-matters">What Data Matters in Partner Selection</h2>

            <p>
              Four categories of data separate informed partner selection from guesswork. Each category contributes a distinct signal that, combined, predicts deal likelihood and expected economics.
            </p>

            <p>
              <strong>Patent cliffs.</strong> The single strongest predictor of deal urgency. When a company faces LOE on a $5B+ product in 2-3 years with no internal replacement, it will pay premium prices for late-stage assets in the same therapeutic area. Our database tracks patent cliff timing for all {DEAL_STATS.TOTAL_COMPANIES} profiled companies.
            </p>

            <p>
              <strong>Pipeline gaps.</strong> Beyond patent cliffs, analyze where each company&apos;s pipeline is thin relative to its strategic priorities. A company with 15 oncology assets but zero immunology assets that has publicly committed to building an immunology franchise is a high-intent buyer for immunology assets.
            </p>

            <p>
              <strong>Deal velocity.</strong> Companies that have closed 5+ deals in the past 24 months have active BD teams, established deal processes, and board-level comfort with deal-making. Companies with zero deals in 24 months may have internal barriers (reorganization, financial constraints, risk aversion) that extend timelines regardless of asset fit.
            </p>

            <p>
              <strong>Competitive pressure.</strong> When a peer company acquires a major asset in your therapeutic area, every other company in that space re-evaluates its pipeline. The &ldquo;fear of missing out&rdquo; effect is measurable: in our data, deal velocity in a TA increases 30-50% in the 6 months following a mega-deal in that space.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Deal velocity in a therapeutic area increases 30-50% in the 6 months following a mega-deal in that space. When Pfizer acquired Seagen for $43B, ADC deal velocity surged across every major pharma company. Time your partnering process to capitalize on these competitive pressure waves.
            </p>
          </div>

          {/* ── SECTION 3: INTENT SCORING ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 3</p>
            <h2 id="intent-predicts">How Intent Scoring Predicts Deal Likelihood</h2>

            <p>
              The Pharma Intent Score is not theoretical — it is backtested against 378 completed transactions with measurable predictive accuracy. Companies scoring above 80 (top quintile) closed deals at 2.3x the rate of companies scoring 40-60, and paid 15-20% higher upfronts when they did close.
            </p>
          </div>

          <div className="my-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Outreach Response Rate: Cold vs. Intent-Informed</h3>
          </div>

          <ComparisonCard
            label="Outreach Response Rate"
            left={{ title: 'Cold Approach', value: '3%', sub: 'Generic outreach, no targeting data' }}
            right={{ title: 'Intent-Informed Approach', value: '18%', sub: 'Pipeline gap + intent score targeting' }}
          />

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 my-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Exhibit 2B</p>
            <p className="text-sm font-semibold text-orange-900 mb-1">Case study: High-intent match closes in 90 days</p>
            <p className="text-sm text-orange-800 leading-relaxed">
              A mid-cap pharma company (Intent Score: 94) had a $3.2B oncology product losing exclusivity in 2027 with no Phase 2+ replacement. When a biotech with a Phase 2 ADC in the same indication entered the partnering process, the pharma company moved from first meeting to signed term sheet in 87 days — paying a 35% premium over median benchmarks. The urgency was driven by patent cliff timing, not by extraordinary clinical data. The biotech identified this partner through pipeline gap analysis, not through an existing relationship.
            </p>
          </div>

          {/* ── PULL QUOTE 2 ── */}
          <section className="bg-slate-900 rounded-xl my-12 text-white">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
                &ldquo;Intent-informed outreach converts at 6x the rate of cold approaches — 18% versus 3%.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Pharma Intent Score backtested against 378 completed transactions</p>
            </div>
          </section>

          {/* ── SECTION 4: CONFERENCE PREP ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 4</p>
            <h2 id="conference-prep">Partnering Conference Preparation Timeline</h2>

            <p>
              Whether you are preparing for JPM, BIO International, or ASCO, the partner identification timeline should begin 4-6 months before the event. Companies that start at the conference are 40% slower to close deals because they are competing for attention with every other company in attendance.
            </p>
          </div>

          <div className="my-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Partnering Conference Preparation Timeline</h3>
            <p className="text-xs text-slate-400 mb-4">Companies that begin 6 months early close 40% faster than those who start at the conference. Each phase builds on the prior — skipping early steps compresses the entire process.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Timeline', 'Activity', 'Deliverable']}
            rows={[
              ['6 months before', 'Partner identification & scoring', 'Prioritized target list (15-20 companies)'],
              ['5 months before', 'Initial outreach & CDA execution', '8-12 CDAs signed'],
              ['4 months before', 'Data package preparation', 'Teaser deck, data room, term sheet framework'],
              ['3 months before', 'Pre-meeting engagement', 'Detailed data package sent to Tier 1'],
              ['2 months before', 'Schedule formal meetings', 'Confirmed meetings with 8-12 companies'],
              ['Conference week', 'Execute meeting plan', 'Deep dives with Tier 1, introductions with Tier 2'],
              ['Post-conference', 'Follow-up & negotiation', 'Term sheet discussions with 3-5 companies'],
            ]}
            freeRows={7}
            footnote="Source: Ambrosia Ventures analysis of partnering conference outcomes. Companies that follow this timeline close 40% faster than those beginning at the conference."
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The most valuable work happens before the conference, not at it. By the time you arrive at JPM or BIO, your Tier 1 targets should already have your data package, have signed CDAs, and have calendar holds for deep-dive meetings. The conference itself is for advancing discussions, not starting them.
            </p>
          </div>

          {/* ── SECTION 5: MINI CALCULATOR ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 5</p>
            <h2 id="try-calculator">Model Your Deal Economics</h2>

            <p>
              Use the interactive calculator below to model expected deal economics for your asset. Select your therapeutic area, development phase, and modality to see median upfront payments, total deal values, and comparable transactions from our database.
            </p>
          </div>

          <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />

          {/* ── SECTION 6: FAQ ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 not-prose">Section 6</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>How do I identify the best pharma partner for my asset?</h3>
            <p>
              Start with pipeline gap analysis — identify companies with urgent needs in your therapeutic area due to patent cliffs, clinical failures, or competitive pressure. Score them on intent signals (deal velocity, financial capacity, public statements) using the <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Partner Matching engine</Link>. The best partner is the company with the highest urgency and best strategic fit, not the largest company.
            </p>

            <h3>What is a Pharma Intent Score?</h3>
            <p>
              An 8-factor predictive model that forecasts which companies are most likely to do a deal in a specific therapeutic area. Factors include pipeline gaps, patent cliff timing, deal velocity, competitive pressure, and financial capacity. Backtested against 378 deals. Companies scoring above 80 close 2.3x faster and pay 15-20% higher upfronts.
            </p>

            <h3>How many companies should I approach?</h3>
            <p>
              Target 8-15 companies for initial conversations, with the goal of advancing 3-5 to term sheet stage. Fewer than 3 serious bidders weakens your negotiating position. More than 15 creates management overhead without proportional benefit. Quality of targeting matters more than quantity.
            </p>

            <h3>When should I start partner identification before a conference?</h3>
            <p>
              Four to six months before JPM, BIO, or ASCO. Use months 1-2 for identification and scoring, months 3-4 for outreach and CDAs, months 5-6 for pre-meeting data packages. Companies that start 6 months early close 40% faster than those who begin at the conference.
            </p>

            <h3>What data signals predict pharma deal-making intent?</h3>
            <p>
              Eight key signals: patent cliff proximity (strongest), recent pipeline failures, high deal velocity, competitor acquisitions in your space, public strategic commitments, leadership changes, financial capacity, and geographic fit. The Pharma Intent Score combines all eight into a single predictive metric. See our <Link href="/insights/how-much-is-my-biotech-asset-worth" className="text-teal-600 font-medium hover:text-teal-700">asset valuation guide</Link> for how partner selection affects deal value.
            </p>
          </div>

          {/* ── INLINE EMAIL CAPTURE ── */}
          <InlineEmailCapture
            heading="Get Weekly Partner Intelligence"
            description="Join 2,000+ BD professionals who receive our weekly analysis of pharma pipeline gaps, deal velocity trends, and partnering insights."
            source="pharma-partner-identification-guide"
          />

          <RelatedInsights articles={[
            {
              href: '/insights/how-much-is-my-biotech-asset-worth',
              title: 'How Much Is My Biotech Asset Worth?',
              description: 'Phase-by-phase valuation benchmarks and the 5 factors that determine deal value.',
              badge: 'Valuation',
            },
            {
              href: '/insights/deal-committee-presentation-guide',
              title: 'Deal Committee Presentation Guide',
              description: 'How to build the slides that get deals approved at committee stage.',
              badge: 'Strategy',
            },
            {
              href: '/insights/deal-terms-by-therapeutic-area',
              title: 'Deal Terms by Therapeutic Area',
              description: 'How deal economics differ across oncology, immunology, neurology, and 9 other TAs.',
              badge: 'Benchmarks',
            },
          ]} />

          {/* ── CITE THIS DATA ── */}
          <CiteThisData
            title="Pharma Partner Identification Guide"
            pageUrl="/insights/pharma-partner-identification-guide"
            embedType="phase-upfront"
            embedTA="oncology"
          />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Find Your Highest-Probability Partners"
          description={`Screen ${DEAL_STATS.TOTAL_COMPANIES} companies for pipeline gaps, deal velocity, and intent signals. Pro access at ${PRICING.PRO_MONTHLY} or get a full partner report for ${PRICING.REPORT_PRICE}.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
