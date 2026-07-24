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
  title: 'Best Biopharma Deal Benchmarking Tools in 2026 — Platform Comparison | Ambrosia Ventures',
  description: `Compare biopharma deal benchmarking tools and pharma licensing intelligence platforms in 2026. How ${DEAL_STATS.TOTAL_DEALS} transactions, 8 calculation engines, and predictive analytics change BD outcomes.`,
  keywords: [
    'biopharma deal benchmarking tool',
    'pharma deal intelligence platform',
    'biotech licensing data',
    'deal benchmarking software',
    'pharma BD tools 2026',
    'biopharma deal database',
    'licensing deal analytics',
    'pharma deal comparison platform',
  ],
  openGraph: {
    title: 'Best Biopharma Deal Benchmarking Tools in 2026',
    description: 'How modern deal intelligence platforms compare to consultants and manual research. Feature comparison and selection guide.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/biopharma-deal-benchmarking-tools-2026',
    images: [{ url: '/api/og?title=Biopharma%20Deal%20Benchmarking%20Tools&subtitle=2026%20Platform%20Comparison&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Biopharma Deal Benchmarking Tools 2026',
    description: 'Platform comparison: data freshness, TA coverage, valuation models, and predictive analytics.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/biopharma-deal-benchmarking-tools-2026',
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

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}

export default function BiopharmaDealBenchmarkingToolsPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Biopharma Deal Benchmarking Tools 2026', item: 'https://solidus.ambrosiaventures.co/insights/biopharma-deal-benchmarking-tools-2026' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Best Biopharma Deal Benchmarking Tools in 2026 — Platform Comparison',
    description: 'How modern deal intelligence platforms compare to consultants and manual research for biopharma BD teams.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/biopharma-deal-benchmarking-tools-2026',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the best biopharma deal benchmarking tool in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The best biopharma deal benchmarking tools in 2026 combine real transaction data with predictive analytics. Key criteria include deal database size (2,000+ verified transactions minimum), therapeutic area coverage (10+ TAs), valuation model diversity (rNPV, Monte Carlo, sensitivity), and data freshness (weekly updates from SEC/FTC filings). Ambrosia Ventures provides all of these with ${DEAL_STATS.TOTAL_DEALS} deals, 12 TAs, 8 calculation engines, and weekly data updates.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How much do pharma deal intelligence platforms cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pharma deal intelligence platforms range from $299/month for specialized benchmarking tools to $50,000-$200,000/year for enterprise platforms like GlobalData, Evaluate, or Citeline. Boutique consulting benchmarking projects typically cost $50,000-$150,000 per engagement. The cost-performance ratio favors platforms that combine transaction data with valuation models, eliminating the need for separate analyst work.',
        },
      },
      {
        '@type': 'Question',
        name: 'What should I look for in a deal benchmarking tool?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Five critical features: (1) verified deal data from primary sources like SEC 8-K filings, not just press releases, (2) at least 2,000 transactions for statistical significance, (3) multiple valuation methodologies (rNPV, comparable transactions, Monte Carlo), (4) partner identification capabilities that go beyond simple directory listings, and (5) scenario analysis for negotiation preparation.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I benchmark deals without an enterprise platform?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. While enterprise platforms offer comprehensive datasets, specialized tools like Solidus provide targeted deal benchmarking at a fraction of the cost. A single deal report ($499) delivers comparable transactions, rNPV valuation, partner matching, and negotiation playbook. Pro subscriptions ($299/month) provide ongoing access to all 8 calculation engines for teams running multiple evaluations.',
        },
      },
      {
        '@type': 'Question',
        name: 'How often should deal benchmarking data be updated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Deal benchmarking data should be updated at least weekly. Biopharma deal terms shift quarterly based on market conditions, competitive dynamics, and recent mega-deals. Platforms using monthly or quarterly updates risk providing stale benchmarks that don\'t reflect current market pricing. Solidus updates data weekly from SEC EDGAR 8-K filings, FTC premerger notifications, and verified press releases.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="biopharma-deal-benchmarking-tools-2026" />
      <StickyTOC sections={[
        { id: 'approaches', label: 'Three Approaches', number: 1 },
        { id: 'what-to-look-for', label: 'What to Look For', number: 2 },
        { id: 'feature-comparison', label: 'Feature Comparison', number: 3 },
        { id: 'why-dataset-size', label: 'Dataset Size', number: 4 },
        { id: 'pricing', label: 'Pricing Context', number: 5 },
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
              <span className="text-slate-200">Deal Benchmarking Tools 2026</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-violet-500/20 text-violet-300 text-sm font-medium rounded-full mb-6">
              Platform Comparison
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Best Biopharma Deal{' '}
              <span className="text-violet-400">Benchmarking Tools</span> in 2026
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              The best biopharma deal benchmarking tools in 2026 combine real transaction data with predictive analytics. Here is what to look for and how platforms compare.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{DEAL_STATS.TOTAL_DEALS}</div>
                <div className="text-xs text-slate-400">Verified deals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">8</div>
                <div className="text-xs text-slate-400">Calculation engines</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">12</div>
                <div className="text-xs text-slate-400">Therapeutic areas</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 3, 2026" />

          <KeyTakeaways takeaways={[
            'Modern deal benchmarking platforms deliver in minutes what consultants charge $50K-$150K to produce over 4-8 weeks — with fresher data and more scenarios.',
            'The minimum viable deal database is 2,000+ verified transactions. Below that threshold, benchmarks lack statistical significance for niche TA/modality/phase combinations.',
            'Predictive analytics (partner intent scoring, deal probability modeling) separate modern platforms from simple data repositories.',
            `Ambrosia Ventures provides ${DEAL_STATS.TOTAL_DEALS} deals, 8 engines, 12 TAs, and weekly updates at ${PRICING.PRO_MONTHLY} — 95% less than enterprise alternatives.`,
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 id="approaches">Three Approaches to Deal Benchmarking</h2>

            <p>
              BD teams have three approaches to deal benchmarking, each with distinct trade-offs in cost, speed, and depth. The right approach depends on your deal volume, internal capabilities, and time constraints.
            </p>

          </div>

          <ComparisonCard
            label="Time & Cost to First Benchmark"
            left={{ title: 'Manual Research', value: '$0 + 40hrs', sub: 'Internal analyst time, 2-4 weeks' }}
            right={{ title: 'Solidus', value: `${PRICING.PRO_MONTHLY} + 30s`, sub: 'Instant results, weekly updates' }}
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>Manual Research: Lowest Cost, Highest Risk</h3>
            <p>
              Many BD teams still benchmark deals by manually searching SEC filings, press releases, and industry reports. This approach is free but produces incomplete datasets (typically 10-30 comparable deals), takes 2-4 weeks per analysis, and introduces selection bias — analysts tend to find deals that confirm their existing expectations. Manual research is viable for teams doing 1-2 deals per year with generous timelines.
            </p>

            <h3>Consulting Engagements: Highest Cost, Deepest Context</h3>
            <p>
              Boutique advisory firms (L.E.K., Bain, McKinsey life sciences practices) charge $50,000-$150,000 per deal benchmarking engagement. They deliver deep analysis with strategic context, but the 4-8 week turnaround creates problems when deal timelines compress. The data underlying consultant reports is often the same public information available through platforms — the premium pays for interpretation and strategic framing.
            </p>

            <h3>Deal Intelligence Platforms: Best Balance</h3>
            <p>
              Platforms that combine large transaction databases with analytical engines deliver benchmarks in minutes, not weeks. The best platforms provide {DEAL_STATS.TOTAL_DEALS}+ verified transactions, multiple valuation methodologies, partner identification, and scenario analysis at 90-95% lower cost than consulting engagements.
            </p>
          </div>

          {/* Exhibit 1A: Approaches Compared */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Deal Benchmarking Approaches Compared</h3>
          </div>

          <GatedBenchmarkTable
            headers={['Dimension', 'Manual Research', 'Consulting', 'Platform (Ambrosia)']}
            rows={[
              ['Cost', 'Internal time only', '$50K-$150K per deal', `${PRICING.PRO_MONTHLY} or ${PRICING.REPORT_PRICE}/report`],
              ['Turnaround', '2-4 weeks', '4-8 weeks', 'Minutes'],
              ['Deal Database', '10-30 comps', '50-100 comps', `${DEAL_STATS.TOTAL_DEALS} verified`],
              ['Data Freshness', 'Point-in-time', 'Point-in-time', 'Weekly updates'],
              ['Valuation Models', 'Spreadsheet', 'Custom models', '8 engines (rNPV, Monte Carlo, etc.)'],
              ['Partner Matching', 'Manual', 'Limited', `${DEAL_STATS.TOTAL_COMPANIES} scored`],
              ['Scenario Analysis', 'Ad hoc', 'Bear/base/bull', 'Tornado + Monte Carlo'],
              ['Repeatability', 'Low', 'Low', 'Unlimited analyses'],
            ]}
            freeRows={8}
            footnote={`Source: Solidus analysis. Pricing reflects 2026 market rates across enterprise platforms, boutique advisory, and specialized benchmarking tools.`}
          />

          <div className="my-8 grid sm:grid-cols-3 gap-4">
            <StatCard value="95%" label="Cost Savings" sub="vs. consulting engagement" />
            <StatCard value="60 sec" label="Time to Report" sub="vs. 4-8 weeks" />
            <StatCard value="50x" label="More Comparables" sub="vs. manual research" />
          </div>

          {/* Key Insight: Approaches */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The consulting engagement model was designed for an era when deal data was genuinely scarce. Today, the same SEC filings and FTC notifications that feed consultant analyses are available through automated platforms in real time. The remaining value of consulting is strategic interpretation — but platforms that pair data with scenario engines and sensitivity analysis are closing that gap at 95% lower cost.
            </p>
          </div>

          {/* Pull Quote 1 */}
          <section className="bg-slate-900 rounded-xl my-10">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold text-white leading-snug tracking-tight">
                &ldquo;A platform that delivers benchmarks in 60 seconds with {DEAL_STATS.TOTAL_DEALS} comparables has fundamentally different economics than a consultant who delivers in 6 weeks with 50.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Cost-performance analysis across 3 benchmarking approaches</p>
            </div>
          </section>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 id="what-to-look-for">What to Look for in a Deal Benchmarking Tool</h2>

            <p>
              Not all deal benchmarking tools are created equal. These five capabilities separate platforms that change deal outcomes from those that just store data.
            </p>

            <p>
              <strong>1. Data verification and sourcing.</strong> The best platforms source data from primary filings (SEC 8-K, FTC premerger notifications) rather than relying solely on press releases. Press releases omit critical deal terms — milestone structures, royalty tiers, option exercise prices — that are disclosed in regulatory filings. Solidus sources from SEC EDGAR, FTC filings, OpenFDA, and verified press releases, with AI-assisted extraction and human verification.
            </p>

            <p>
              <strong>2. Database depth.</strong> Statistical significance matters. A database of 200 deals cannot produce reliable benchmarks for a Phase 2 ADC in oncology — there may be only 3-5 comparable transactions. You need 2,000+ deals to have sufficient density across TA/modality/phase combinations. Ambrosia Ventures maintains {DEAL_STATS.TOTAL_DEALS} verified transactions across 12 therapeutic areas.
            </p>

            <p>
              <strong>3. Multiple valuation methodologies.</strong> No single valuation method is sufficient. Comparable transactions provide market context, rNPV provides risk-adjusted fair value, Monte Carlo provides probability distributions, and sensitivity analysis identifies which assumptions matter most. The best platforms offer all four in a single workflow.
            </p>

            <p>
              <strong>4. Partner intelligence.</strong> Deal benchmarking without partner identification is incomplete. Knowing what your asset is worth is only useful if you know who will pay that price. Look for platforms that score potential partners on pipeline gaps, deal history, therapeutic alignment, financial capacity, and acquisition intent.
            </p>

            <p>
              <strong>5. Predictive analytics.</strong> The most advanced platforms go beyond historical data to predict which companies are most likely to do deals in your space. Ambrosia Ventures&apos; <Link href="/insights/pharma-partner-identification-guide" className="text-teal-600 font-medium hover:text-teal-700">Pharma Intent Score</Link> is an 8-factor predictive model that forecasts deal likelihood based on pipeline gaps, patent cliffs, competitive pressure, deal velocity, and other signals.
            </p>
          </div>

          {/* Key Insight: Database threshold */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The 2,000-deal threshold is not arbitrary. When you filter by therapeutic area (12 options), development phase (5 stages), modality (7+ types), and deal structure (licensing vs. acquisition vs. collaboration), a 200-deal database fractures into cohorts of 1-3 transactions. Statistical benchmarking requires density — and density requires scale. Below 2,000 deals, your &ldquo;benchmark&rdquo; is really just an anecdote.
            </p>
          </div>

          <InsightEmailCapture slug="biopharma-deal-benchmarking-tools-2026" />

          <InsightCTA
            variant="mid"
            heading="See the Platform in Action"
            description={`Model deal terms across 12 therapeutic areas with ${DEAL_STATS.TOTAL_DEALS} transactions, 8 calculation engines, and ${DEAL_STATS.TOTAL_COMPANIES} partner profiles. Start free, upgrade to Pro for full access.`}
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 id="feature-comparison">Feature Comparison: Ambrosia Ventures vs. Alternatives</h2>

            <p>
              Here is how the Solidus platform compares to enterprise alternatives and traditional approaches across the capabilities that matter most to BD teams.
            </p>
          </div>

          {/* Exhibit 1B: Feature Comparison */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Platform Feature Comparison</h3>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="py-3 px-4 font-semibold text-slate-700 text-left">Feature</th>
                    <th className="py-3 px-4 font-semibold text-teal-700 text-center">Ambrosia Ventures</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-center">Enterprise Platforms</th>
                    <th className="py-3 px-4 font-semibold text-slate-700 text-center">Consultants</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Deal Database', `${DEAL_STATS.TOTAL_DEALS} verified`, '5,000-50,000', '50-100 per project'],
                    ['rNPV Valuation Engine', true, 'Some', 'Custom builds'],
                    ['Monte Carlo Simulation', true, 'Rare', 'Sometimes'],
                    ['Tornado Sensitivity', true, false, 'Sometimes'],
                    ['Partner Matching (AI-scored)', true, false, 'Manual'],
                    ['Pharma Intent Score', true, false, false],
                    ['Comparable Deal Matching', true, true, true],
                    ['Market Sizing', true, true, true],
                    ['SEC Filing Sourcing', true, 'Some', false],
                    ['Weekly Data Updates', true, 'Monthly/Quarterly', 'N/A'],
                    ['Self-Service Access', true, true, false],
                    ['Board-Ready Reports', true, false, true],
                  ].map(([feature, ambrosia, enterprise, consultant], i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-slate-800">{feature}</td>
                      <td className="py-3 px-4 text-center">
                        {ambrosia === true ? <span className="flex justify-center"><CheckIcon /></span> : <span className="text-teal-700 font-medium">{ambrosia}</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {enterprise === true ? <span className="flex justify-center"><CheckIcon /></span> : enterprise === false ? <span className="flex justify-center"><XIcon /></span> : <span className="text-slate-500">{enterprise}</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {consultant === true ? <span className="flex justify-center"><CheckIcon /></span> : consultant === false ? <span className="flex justify-center"><XIcon /></span> : <span className="text-slate-500">{consultant}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Exhibit 2A: Annual Cost Comparison */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Annual Cost Comparison</h3>
            <p className="text-xs text-slate-400 mb-4">Ambrosia Pro delivers 8 engines + {DEAL_STATS.TOTAL_DEALS} deals at 95% less than enterprise alternatives.</p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <HorizontalBarChart
              maxValue={500}
              color="#6366f1"
              data={[
                { label: 'Advisory Firm', value: 500, displayValue: '$500K+/yr' },
                { label: 'Consulting (1 deal)', value: 100, displayValue: '$50-150K' },
                { label: 'Evaluate Pharma', value: 50, displayValue: '$25-50K/yr' },
                { label: 'GlobalData', value: 100, displayValue: '$50-200K/yr' },
                { label: 'Ambrosia Pro', value: 3.6, displayValue: '$3.6K/yr' },
              ]}
            />
          </div>

          {/* Exhibit 2B: Key Differentiators */}
          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">At-a-Glance: Key Differentiators</h3>
          </div>

          {/* Visual feature comparison with check/X marks */}
          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <div className="space-y-3">
              {[
                { feature: 'Real-time deal data (weekly updates)', ambrosia: true, enterprise: false, consultant: false },
                { feature: 'Monte Carlo + Tornado sensitivity', ambrosia: true, enterprise: false, consultant: false },
                { feature: 'AI-scored partner matching', ambrosia: true, enterprise: false, consultant: false },
                { feature: 'Pharma Intent Score (predictive)', ambrosia: true, enterprise: false, consultant: false },
                { feature: 'Board-ready reports in 60 seconds', ambrosia: true, enterprise: false, consultant: false },
                { feature: 'Self-service (no analyst required)', ambrosia: true, enterprise: true, consultant: false },
                { feature: 'Deep strategic context', ambrosia: false, enterprise: false, consultant: true },
                { feature: 'Broad market intelligence', ambrosia: false, enterprise: true, consultant: false },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="flex-1 text-sm text-slate-700">{row.feature}</div>
                  <div className="w-20 flex justify-center">
                    {row.ambrosia ? (
                      <svg className="w-5 h-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <div className="w-20 flex justify-center">
                    {row.enterprise ? (
                      <svg className="w-5 h-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <div className="w-20 flex justify-center">
                    {row.consultant ? (
                      <svg className="w-5 h-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-200">
              <div className="flex-1" />
              <div className="w-20 text-center text-xs font-bold text-teal-700">Ambrosia</div>
              <div className="w-20 text-center text-xs font-medium text-slate-500">Enterprise</div>
              <div className="w-20 text-center text-xs font-medium text-slate-500">Consulting</div>
            </div>
          </div>

          {/* Key Insight: Feature gap */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Enterprise platforms excel at breadth — broad market intelligence across thousands of companies and indications. But for the specific use case of deal benchmarking and negotiation preparation, specialized platforms outperform on the dimensions that matter: valuation engines, partner scoring, and scenario analysis. The feature gap is widest in predictive analytics, where no enterprise platform offers partner intent scoring or deal probability modeling.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 id="why-dataset-size">Why {DEAL_STATS.TOTAL_DEALS} Deals Matters</h2>

            <p>
              Dataset size directly affects benchmark reliability. With a 200-deal database, a query for &ldquo;Phase 2, ADC, oncology, licensing&rdquo; might return 2-3 transactions — not enough to establish a reliable range. With {DEAL_STATS.TOTAL_DEALS} deals, the same query returns 15-25 transactions, enabling statistically meaningful P25/median/P75 ranges and identification of outlier patterns.
            </p>

            <p>
              The density advantage compounds across dimensions. When you add modality-specific filters (ADC vs. bispecific vs. small molecule), geography filters (US rights vs. ex-US vs. global), and deal structure filters (licensing vs. co-development vs. option), a small database quickly runs out of comparables. The minimum viable dataset for multi-dimensional benchmarking is approximately 2,000 verified transactions.
            </p>

            <p>
              Data verification matters as much as volume. Ambrosia Ventures sources deal data from SEC EDGAR 8-K filings, FTC premerger notifications, FDA databases, and verified press releases. Each deal is extracted using AI-assisted parsing with structured validation against 143 quality checks across 75 parameter combinations.
            </p>

            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 id="pricing">Platform Pricing Context</h2>

            <p>
              For BD teams evaluating tools, here is the pricing landscape in 2026:
            </p>

            <ul>
              <li><strong>Enterprise platforms</strong> (GlobalData Pharma Intelligence, Evaluate Pharma, Citeline): $50,000-$200,000/year. Comprehensive datasets but limited analytical tools — you export data and build your own models.</li>
              <li><strong>Boutique consulting</strong> (per engagement): $50,000-$150,000 per deal analysis. Deep strategic context but slow turnaround (4-8 weeks) and non-repeatable.</li>
              <li><strong>Ambrosia Ventures Pro</strong>: {PRICING.PRO_MONTHLY}. Full access to all 8 engines, {DEAL_STATS.TOTAL_DEALS} deals, {DEAL_STATS.TOTAL_COMPANIES} partner profiles, unlimited analyses. Or {PRICING.REPORT_PRICE} for a single deal report.</li>
            </ul>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">

            <p>
              The ROI calculation is straightforward: if a platform helps you negotiate even 1% higher upfront on a $100M deal, it has paid for itself for the next 28 years at {PRICING.PRO_MONTHLY}.
            </p>
          </div>

          {/* Pull Quote 2 */}
          <section className="bg-slate-900 rounded-xl my-10">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold text-white leading-snug tracking-tight">
                &ldquo;If a platform helps you negotiate 1% higher upfront on a $100M deal, it has paid for itself for 28 years.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">ROI analysis at {PRICING.PRO_MONTHLY} annual subscription cost</p>
            </div>
          </section>

          {/* Interactive Calculator */}
          <div className="my-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Model Your Own Deal</h3>
            <p className="text-slate-500 text-sm mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of {DEAL_STATS.TOTAL_DEALS} verified transactions.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>What is the best biopharma deal benchmarking tool?</h3>
            <p>
              The best tool depends on your needs. For enterprise teams needing broad market intelligence, platforms like GlobalData or Evaluate offer comprehensive datasets. For BD teams focused on deal execution — benchmarking, valuation, partner identification, and negotiation preparation — <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> provides {DEAL_STATS.TOTAL_DEALS} deals, 8 calculation engines, and predictive partner scoring at {PRICING.PRO_MONTHLY}.
            </p>

            <h3>How much do pharma deal intelligence platforms cost?</h3>
            <p>
              Enterprise platforms range from $50,000-$200,000/year. Consulting engagements cost $50,000-$150,000 per deal. Specialized benchmarking platforms like Solidus costs {PRICING.PRO_MONTHLY} for full access or {PRICING.REPORT_PRICE} for a single deal report. The cost-performance ratio strongly favors platforms that combine data with analytical engines.
            </p>

            <h3>What should I look for in a deal benchmarking tool?</h3>
            <p>
              Five essentials: verified deal data from primary sources (SEC filings, not just press releases), 2,000+ transactions for statistical significance, multiple valuation methodologies (rNPV, Monte Carlo, sensitivity), partner identification with scoring, and weekly data updates. Tools lacking any of these create blind spots in deal preparation.
            </p>

            <h3>Can I benchmark deals without an enterprise subscription?</h3>
            <p>
              Yes. A single <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> ({PRICING.REPORT_PRICE}) delivers comparable transactions, rNPV valuation, partner matching, sensitivity analysis, and a negotiation playbook. For teams running multiple analyses, Pro access ({PRICING.PRO_MONTHLY}) provides unlimited benchmarking across all 8 engines.
            </p>

            <h3>How often should deal benchmarking data be updated?</h3>
            <p>
              At minimum weekly. Deal terms shift based on recent mega-deals, market sentiment, and competitive dynamics. A database updated quarterly may miss significant market repricing events. Ambrosia Ventures updates weekly from SEC EDGAR, FTC filings, and verified press releases, with daily quality validation across 143 checks.
            </p>
          </div>

          {/* Inline Email Capture */}
          <div className="my-12">
            <InlineEmailCapture
              heading="Get Weekly Deal Intelligence"
              description={`Join 2,000+ BD professionals who receive our weekly analysis of biopharma licensing trends, new deal benchmarks, and negotiation insights from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`}
              source="biopharma-deal-benchmarking-tools-2026"
            />
          </div>

          {/* Cite This Data */}
          <div className="my-12">
            <CiteThisData
              title="Best Biopharma Deal Benchmarking Tools in 2026 — Platform Comparison"
              pageUrl="/insights/biopharma-deal-benchmarking-tools-2026"
            />
          </div>

          <RelatedInsights articles={[
            {
              href: '/insights/biopharma-deal-benchmarks-2026',
              title: '3 Data Insights from 3,447 Deals',
              description: 'ADC normalization, Phase 2 inflection, and immunology premium.',
              badge: 'Data Report',
            },
            {
              href: '/insights/pharma-partner-identification-guide',
              title: 'Pharma Partner Identification Guide',
              description: 'How to find the right licensing partner using data-driven scoring.',
              badge: 'Strategy',
            },
            {
              href: '/insights/rnpv-vs-dcf-biotech-valuation',
              title: 'rNPV vs DCF for Biotech Valuation',
              description: 'When to use each methodology and why rNPV dominates BD.',
              badge: 'Methodology',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Start Benchmarking With Real Data"
          description={`Access ${DEAL_STATS.TOTAL_DEALS} verified transactions, 8 calculation engines, and ${DEAL_STATS.TOTAL_COMPANIES} partner profiles. Free calculator or Pro at ${PRICING.PRO_MONTHLY}.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
