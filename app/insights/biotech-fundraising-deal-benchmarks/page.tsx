import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
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
  title: 'Biotech Fundraising vs Licensing — Deal Benchmarks & Decision Framework | Ambrosia Ventures',
  description: `Should you raise capital or out-license? Fundraising vs licensing value comparison by phase, with decision frameworks and deal benchmarks from ${DEAL_STATS.TOTAL_DEALS} transactions.`,
  keywords: [
    'biotech fundraising benchmarks',
    'Series B biotech valuation',
    'biotech licensing before IPO',
    'biotech fundraising vs licensing',
    'biotech out-licensing timing',
    'Series C biotech raise',
    'biotech capital strategy',
    'biotech IPO vs licensing deal',
  ],
  openGraph: {
    title: 'Biotech Fundraising vs Licensing — Deal Benchmarks & Decision Framework',
    description: 'A Phase 2 biotech can raise $200M Series C or sign a $1.5B licensing deal with $200M upfront. How to choose the right path.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/biotech-fundraising-deal-benchmarks',
    images: [{ url: '/api/og?title=Biotech%20Fundraising%20vs%20Licensing&subtitle=Deal%20Benchmarks%20%26%20Decision%20Framework&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Fundraising vs Licensing Benchmarks',
    description: 'Raise capital or out-license? Phase-by-phase value comparison and decision framework.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/biotech-fundraising-deal-benchmarks',
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

export default function BiotechFundraisingDealBenchmarksPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Biotech Fundraising vs Licensing Benchmarks', item: 'https://solidus.ambrosiaventures.co/insights/biotech-fundraising-deal-benchmarks' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Biotech Fundraising vs Licensing — Deal Benchmarks & Decision Framework',
    description: 'Should you raise a Series C or sign a licensing deal? Phase-by-phase value comparison, dilution analysis, and decision frameworks.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/biotech-fundraising-deal-benchmarks',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Should my biotech raise capital or out-license?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The decision depends on three factors: (1) your probability of success at the current phase — if PoS is below 30%, licensing transfers risk to a partner with more resources, (2) your dilution trajectory — if the next raise would dilute founders below 10%, licensing preserves ownership while providing non-dilutive capital, and (3) your timeline to value inflection — if you need 3+ years and $300M+ to reach the next value inflection, a partner with development infrastructure may get there faster.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is a Phase 2 biotech worth in a licensing deal vs fundraising?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A Phase 2 biotech with positive PoC data can either raise a $150-300M Series C at a $600M-$1.2B pre-money valuation, or sign a licensing deal worth $500M-$3.5B total deal value with $80-450M upfront. The licensing path provides immediate non-dilutive cash, milestone-linked upside, and risk transfer to a partner. The fundraising path preserves full ownership but requires the company to fund Phase 3 ($100-300M) from its own capital.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do licensing benchmarks strengthen a fundraising pitch?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Including licensing comparables in a fundraising pitch deck signals optionality — investors see that the asset has a quantifiable floor value in a licensing transaction. Presenting deal benchmarks from verified transactions (median upfronts, total deal values, royalty ranges for your TA/phase/modality) gives VCs confidence that their investment has a de-risked exit path even if the IPO market closes. This typically increases valuation by 10-20% in fundraising negotiations.',
        },
      },
      {
        '@type': 'Question',
        name: 'When is the best time to out-license before an IPO?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The optimal licensing window is at proof-of-concept (Phase 2a data readout), which represents the largest single valuation inflection in drug development. At this stage, the asset has been de-risked enough to command meaningful upfronts ($80-450M) while retaining significant upside through milestones and royalties. Licensing after Phase 2a also creates a narrative for IPO: non-dilutive validation from a pharma partner, near-term milestone catalysts, and retained economics on the asset.',
        },
      },
      {
        '@type': 'Question',
        name: 'What deal benchmarks should I include in a biotech pitch deck?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Include four types of benchmarks: (1) comparable licensing transactions in your TA/phase showing total deal values and upfronts, (2) valuation multiples for public companies with similar assets, (3) probability-adjusted rNPV showing expected value at each development stage, and (4) potential partner universe showing the number of companies actively doing deals in your space. These benchmarks demonstrate that your asset has quantifiable market value and multiple exit paths.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="biotech-fundraising-benchmarks" />
      <StickyTOC sections={[
        { id: 'value-comparison', label: 'Value Comparison', number: 1 },
        { id: 'when-to-license', label: 'When to License', number: 2 },
        { id: 'licensing-strengthens-fundraising', label: 'Licensing + Fundraising', number: 3 },
        { id: 'pitch-deck-benchmarks', label: 'Pitch Deck', number: 4 },
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
              <span className="text-slate-200">Fundraising vs Licensing</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 text-sm font-medium rounded-full mb-6">
              Capital Strategy
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Biotech Fundraising vs{' '}
              <span className="text-emerald-400">Licensing Deal Benchmarks</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              A Phase 2 biotech can either raise a $200M Series C or sign a $1.5B licensing deal with $200M upfront. The math on which path creates more value depends on your PoS and dilution.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$200M</div>
                <div className="text-xs text-slate-400">Median Series C raise</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">$180M</div>
                <div className="text-xs text-slate-400">Median Phase 2 upfront</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">0%</div>
                <div className="text-xs text-slate-400">Dilution from licensing</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 3, 2026" />

          <KeyTakeaways takeaways={[
            'A Phase 2 licensing deal ($80-450M upfront, $500M-$3.5B TDV) provides comparable near-term cash to a Series C ($150-300M) without dilution. The trade-off is sharing future upside through milestones and royalties.',
            'Licensing at proof-of-concept is the single highest-value inflection point. Post-PoC assets command 2-4x the deal value of pre-PoC assets, and the data de-risks both licensing and fundraising simultaneously.',
            'Including licensing benchmarks in fundraising decks increases investor confidence by demonstrating a quantifiable floor value and multiple exit paths. This typically improves fundraising valuations by 10-20%.',
            'The decision framework hinges on three variables: probability of success, dilution trajectory, and time-to-value-inflection. Low PoS + high dilution + long timeline = license. High PoS + low dilution + near-term catalyst = raise.',
          ]} />

          {/* ── SECTION 1: VALUE COMPARISON ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 id="value-comparison">Fundraising vs. Licensing: Value Comparison by Phase</h2>

            <p>
              The fundamental question every biotech founder faces: does raising another round of equity or signing a licensing deal create more value for shareholders? The answer depends on phase, probability of success, and how much dilution the cap table can absorb. Here are the benchmarks from {DEAL_STATS.TOTAL_DEALS} licensing transactions mapped against venture funding data.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Fundraising vs. Licensing Economics by Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Side-by-side comparison of equity fundraising and licensing deal economics at each development stage. Phase 2 is the crossover point where licensing upfronts match typical raise sizes with zero dilution.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'Typical Raise', 'Pre-Money Valuation', 'Licensing Upfront', 'Licensing TDV', 'Dilution (Raise)']}
            rows={[
              ['Preclinical / Series A', '$30-80M', '$80-250M', '$15-40M', '$150-500M', '25-40%'],
              ['Phase 1 / Series B', '$80-200M', '$300-600M', '$30-120M', '$300M-$1.2B', '20-35%'],
              ['Phase 2 / Series C', '$150-300M', '$600M-$1.2B', '$80-450M', '$500M-$3.5B', '15-25%'],
              ['Phase 3 / Pre-IPO', '$200-500M', '$1.0B-$3.0B', '$200M-$1.0B', '$1.0B-$5.0B', '10-20%'],
              ['Filed / IPO', 'IPO: $200-400M', '$2.0B-$8.0B', '$500M-$4.0B', '$2.0B-$10B+', '10-15% (IPO)'],
            ]}
            freeRows={5}
            footnote={`Fundraising ranges reflect oncology/immunology. Licensing from Solidus, ${DEAL_STATS.TOTAL_DEALS} transactions.`}
          />

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              At Phase 2, licensing upfronts ($80-450M) match or exceed a typical Series C raise ($150-300M) while preserving 100% of founder equity. This is the only stage where the non-dilutive path delivers comparable near-term capital to the equity path. Before Phase 2, licensing upfronts are too small; after Phase 2, both paths deliver large sums but licensing still avoids dilution.
            </p>
          </div>

          <ComparisonCard
            label="Phase 2 Biotech: Two Paths to $200M"
            left={{ title: 'Series C ($200M raise)', value: '30% dilution', sub: 'Founders go from 20% to 14% ownership' }}
            right={{ title: 'Licensing ($200M upfront)', value: '0% dilution', sub: 'Plus milestones + 12-18% royalties' }}
          />

          <div className="my-8 grid sm:grid-cols-3 gap-4">
            <StatCard value="$180M" label="Phase 2 Licensing Upfront" sub="Median, oncology" />
            <StatCard value="20-25%" label="Series C Dilution" sub="Typical equity round" />
            <StatCard value="2-4x" label="PoC Value Inflection" sub="Pre- to post-PoC data" />
          </div>

          {/* ── SECTION 2: WHEN TO LICENSE ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 id="when-to-license">When to Out-License vs. Develop Internally</h2>

            <p>
              The licensing-vs-fundraising decision is not binary. Many biotechs license ex-US rights while retaining US development, or license one asset while funding another internally. The decision framework focuses on three variables that determine which path creates more value for existing shareholders.
            </p>

            <h3>Variable 1: Probability of Success</h3>
            <p>
              If your current-phase probability of technical and regulatory success (PTS) is below 30%, licensing transfers risk to a partner with deeper pockets, more clinical infrastructure, and greater tolerance for failure. A Phase 2 asset with 30% PoS and a $1.5B licensing TDV has an expected risk-adjusted value of $450M to the licensor (upfront + risk-adjusted milestones + royalties). The same asset funded internally requires $150-300M in capital with a 70% chance of returning zero. The expected value math favors licensing at low PoS.
            </p>

            <p>
              If PoS is above 50% (strong Phase 2 data, validated biomarker, breakthrough designation), the economics shift toward internal development. The full value of a successful commercial product ($3-10B+ in cumulative revenue) vastly exceeds the total deal value in a licensing arrangement.
            </p>

            <h3>Variable 2: Dilution Trajectory</h3>
            <p>
              Phase 3 trials cost $100-300M in most therapeutic areas. If funding Phase 3 requires a raise that dilutes founders below 10% ownership, the economic incentive to complete development internally diminishes — founders are working for diminishing returns. In this scenario, a licensing deal that provides $200M+ upfront with 12-18% royalties on commercial sales often creates more founder value than an additional dilutive round.
            </p>

            <h3>Variable 3: Time to Value Inflection</h3>
            <p>
              If your next value inflection (Phase 3 data readout, regulatory filing, approval) is 3+ years away and requires $300M+ in capital, a large pharma partner with existing clinical operations, regulatory expertise, and commercial infrastructure may reach that inflection faster. Time is the most expensive resource in drug development — 12-18 months of delay in a peak-sales ramp is worth hundreds of millions in lost revenue.
            </p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The three variables are multiplicative, not additive. A biotech with low PoS (below 30%), high dilution (founders below 15%), AND a long timeline (3+ years to inflection) should almost certainly license. If only one factor is unfavorable, the decision is less clear and depends on competitive dynamics and management conviction.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Founder Value Created by Path (Phase 2 Oncology Asset)</h3>
            <p className="text-xs text-slate-400 mb-4">Risk-adjusted founder value after dilution. Licensing cumulative = upfront + milestones + royalty NPV. Source: Ambrosia Ventures modeling.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Path', 'Expected Founder Value', 'Risk Profile']}
            rows={[
              ['IPO Path', '$2.5B (if successful)', 'Highest upside, highest risk'],
              ['License (high PoS)', '$1.8B cumulative', 'Strong upside, moderate risk'],
              ['Series C + Phase 3', '$1.2B (risk-adj.)', 'Dilutive, trial risk'],
              ['License (med PoS)', '$900M cumulative', 'Balanced risk/return'],
              ['License (low PoS)', '$450M cumulative', 'Risk transfer, certain value'],
            ]}
            freeRows={5}
            footnote="Risk-adjusted founder value after dilution. Licensing cumulative = upfront + milestones + royalty NPV. Source: Ambrosia Ventures modeling."
          />

          {/* Visual Decision Framework */}
          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-6">3-Factor Decision Framework</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  factor: 'Probability of Success',
                  icon: (
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ),
                  license: 'Below 30%',
                  raise: 'Above 50%',
                },
                {
                  factor: 'Founder Dilution',
                  icon: (
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  license: 'Below 15% ownership',
                  raise: 'Above 25% ownership',
                },
                {
                  factor: 'Time to Inflection',
                  icon: (
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  license: '3+ years, $300M+',
                  raise: 'Under 18 months',
                },
              ].map((item, i) => (
                <div key={i} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-center mb-3">{item.icon}</div>
                  <div className="text-sm font-bold text-slate-800 mb-3">{item.factor}</div>
                  <div className="space-y-2">
                    <div className="text-xs bg-emerald-100 text-emerald-800 rounded-full px-3 py-1 font-medium">
                      License: {item.license}
                    </div>
                    <div className="text-xs bg-slate-200 text-slate-700 rounded-full px-3 py-1 font-medium">
                      Raise: {item.raise}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Decision Framework: License or Raise?</h3>
            <p className="text-xs text-slate-400 mb-4">Seven factors that determine whether licensing or fundraising creates more shareholder value at each decision point.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Factor', 'Favors Licensing', 'Favors Fundraising']}
            rows={[
              ['Probability of Success', 'Below 30%', 'Above 50%'],
              ['Founder Dilution', 'Already below 15%', 'Above 25%'],
              ['Capital Required', '$300M+ for next inflection', 'Under $150M'],
              ['Time to Inflection', '3+ years', 'Under 18 months'],
              ['Commercial Complexity', 'Global launch, specialty + primary', 'US orphan/specialty'],
              ['Competitive Risk', 'Multiple competitors in Phase 2-3', 'First-in-class with BTD'],
              ['IPO Market', 'Closed or adverse', 'Open and favorable'],
            ]}
            freeRows={7}
            footnote="Framework based on analysis of founder outcomes across licensing vs. fundraising cohorts. Source: Ambrosia Ventures."
          />

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-0 sm:rounded-xl my-12">
            <div className="max-w-2xl mx-auto px-6 py-12 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                &ldquo;A Phase 2 biotech founder choosing between a $200M Series C and a $200M licensing upfront is choosing between 30% dilution and 0% dilution for the same near-term cash.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Decision framework analysis from {DEAL_STATS.TOTAL_DEALS} verified transactions</p>
            </div>
          </section>

          <InsightEmailCapture slug="biotech-fundraising-deal-benchmarks" />

          <InsightCTA
            variant="mid"
            heading="See What Your Asset Is Worth to Partners"
            description={`Model licensing economics — upfronts, milestones, royalties, and total deal value — for your specific asset. Calibrated against ${DEAL_STATS.TOTAL_DEALS} real transactions. ${PRICING.REPORT_PRICE} one-time.`}
            calculatorHref="/report"
          />

          {/* ── MINI CALCULATOR ── */}
          <div className="my-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-4">Interactive Tool</p>
            <MiniCalculator />
          </div>

          {/* ── SECTION 3: LICENSING STRENGTHENS FUNDRAISING ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 id="licensing-strengthens-fundraising">How Licensing Data Strengthens Fundraising</h2>

            <p>
              Even if you decide to raise capital rather than license, licensing benchmarks are a powerful tool in fundraising conversations. Investors want to know that their investment has a quantifiable floor value — and licensing data provides exactly that.
            </p>

            <p>
              <strong>Licensing comps establish a floor.</strong> When your pitch deck shows that comparable assets in your TA/phase/modality have been licensed for $1.0-2.5B in total deal value with $100-300M upfronts, investors see a tangible downside scenario. Even if the IPO market closes, even if Phase 3 fails partially, the asset has demonstrated market value in a licensing transaction. This floor value reduces perceived risk and increases investor willingness to pay a premium valuation.
            </p>

            <p>
              <strong>Partner interest validates the science.</strong> If you can demonstrate that 3-5 pharma companies have expressed interest (CDAs signed, data packages shared, meetings conducted), it signals third-party validation of your scientific thesis. This is worth 10-20% in fundraising valuation premium — investors pay more for assets that multiple sophisticated buyers want to acquire.
            </p>

            <p>
              <strong>Milestone catalysts de-risk the investment.</strong> Including a licensing timeline in your fundraising narrative gives investors near-term catalysts beyond clinical data readouts. &ldquo;We expect to initiate a partnering process in Q3, with potential term sheets in Q4&rdquo; provides visibility on value realization that pure-play development timelines cannot.
            </p>

            <p>
              <strong>Retained economics after licensing.</strong> In a well-structured licensing deal, the biotech retains 10-18% royalties on commercial sales plus milestone payments. For a blockbuster asset, this retained economics can be worth $500M-$2B+ in cumulative payments over the product lifecycle — a significant portion of the asset&apos;s total value, received without dilution. Presenting this framework to investors shows sophisticated capital strategy.
            </p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Biotechs that present licensing comparables in fundraising decks typically achieve 10-20% higher valuations. The floor value established by comparable deal data reduces the perceived risk of total loss, which is the primary concern for late-stage biotech investors. This is not theoretical — it is a quantifiable pricing effect across hundreds of fundraising rounds.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-emerald-900 mb-1">The hybrid approach: License ex-US, fund US development</p>
            <p className="text-sm text-emerald-800 leading-relaxed">
              A growing number of biotechs are using ex-US licensing to fund US development. By licensing ex-US rights (Europe, Asia) for $50-200M upfront while retaining US commercial rights, founders access non-dilutive capital for Phase 3 without giving up the most valuable market. In our database, ex-US licensing deals provide 25-40% of global TDV in upfront + milestones while preserving 60-75% of total asset value for the licensor. This approach is particularly attractive for oncology and immunology assets where the US represents 50-60% of global revenue.
            </p>
          </div>

          {/* ── PULL QUOTE ── */}
          <section className="bg-slate-900 text-white -mx-4 sm:-mx-0 sm:rounded-xl my-12">
            <div className="max-w-2xl mx-auto px-6 py-12 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                &ldquo;Proof-of-concept is the single highest-value inflection point in drug development. Post-PoC assets command 2-4x the deal value of pre-PoC assets.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Phase-by-phase analysis from {DEAL_STATS.TOTAL_DEALS} biopharma transactions (2020&ndash;2026)</p>
            </div>
          </section>

          {/* ── SECTION 4: PITCH DECK BENCHMARKS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 id="pitch-deck-benchmarks">What Deal Benchmarks to Include in Your Pitch Deck</h2>

            <p>
              Four types of licensing benchmarks belong in every biotech fundraising deck. Each serves a specific purpose in the investor conversation.
            </p>

            <p>
              <strong>1. Comparable licensing transactions.</strong> Show 3-5 recent deals in your TA and phase with upfronts, total deal values, and deal types. This establishes the market price for assets like yours. Source from the <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> for verified transaction data.
            </p>

            <p>
              <strong>2. Risk-adjusted deal value.</strong> Present the probability-weighted expected value of a licensing deal at your current phase. This gives investors a quantified downside scenario — &ldquo;even in a bear case, a licensing deal at current phase would return $X to investors.&rdquo;
            </p>

            <p>
              <strong>3. Partner universe size.</strong> Show how many companies are actively doing deals in your space. A partner universe of 15-20+ companies with pipeline gaps in your TA signals strong demand and multiple exit paths. The <Link href="/insights/pharma-partner-identification-guide" className="text-teal-600 font-medium hover:text-teal-700">Partner Matching engine</Link> screens {DEAL_STATS.TOTAL_COMPANIES} companies.
            </p>

            <p>
              <strong>4. Valuation premium from partnering optionality.</strong> Cite data showing that biotechs with demonstrated licensing interest trade at 10-20% premiums in fundraising rounds. The option value of a licensing exit path is quantifiable and should be reflected in your ask.
            </p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The most effective fundraising decks present licensing data as optionality, not as a fallback. Framing it as &ldquo;our asset has a quantifiable floor value of $X in a licensing transaction, and we are choosing to capture the full upside through internal development&rdquo; positions the raise as the preferred path while demonstrating downside protection. This reframing is worth the effort — it changes the investor conversation from &ldquo;what if this fails?&rdquo; to &ldquo;how much more can we capture?&rdquo;
            </p>
          </div>

          {/* ── INLINE EMAIL CAPTURE ── */}
          <div className="my-12">
            <InlineEmailCapture
              heading="Get Weekly Deal Intelligence"
              description="Join BD professionals who receive our weekly analysis of biopharma licensing trends, deal benchmarks, and capital strategy insights."
              source="biotech-fundraising-benchmarks"
            />
          </div>

          {/* ── SECTION 5: FAQ ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>Should my biotech raise capital or out-license?</h3>
            <p>
              It depends on three variables: probability of success (below 30% favors licensing), dilution trajectory (below 15% founder ownership favors licensing), and time to value inflection (3+ years favors licensing). Many biotechs use a hybrid approach — licensing ex-US rights to fund US development.
            </p>

            <h3>What is a Phase 2 biotech worth in a licensing deal?</h3>
            <p>
              Phase 2 assets are worth $500M-$3.5B in total deal value, with $80-450M upfronts. Oncology Phase 2 assets command the highest values. Compare this to Series C fundraising at $600M-$1.2B pre-money with 15-25% dilution. Use the <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> ({PRICING.REPORT_PRICE}) for asset-specific benchmarks.
            </p>

            <h3>How do licensing benchmarks help fundraising?</h3>
            <p>
              Licensing comparables establish a floor value (reducing investor risk perception), demonstrate third-party scientific validation (pharma companies want the asset), and provide near-term catalysts beyond clinical readouts. This typically improves fundraising valuation by 10-20%.
            </p>

            <h3>When is the best time to out-license before an IPO?</h3>
            <p>
              At proof-of-concept (Phase 2a data readout) — the largest single valuation inflection in drug development. Post-PoC assets command 2-4x the deal value of pre-PoC assets. Licensing at this point also creates a strong IPO narrative: validated by a pharma partner with near-term milestone catalysts.
            </p>

            <h3>What deal benchmarks should I include in a pitch deck?</h3>
            <p>
              Four types: comparable licensing transactions (3-5 recent deals in your TA/phase), risk-adjusted deal value (probability-weighted expected licensing value), partner universe size (how many companies are actively acquiring in your space), and the valuation premium from demonstrated partnering optionality. See our <Link href="/insights/how-much-is-my-biotech-asset-worth" className="text-teal-600 font-medium hover:text-teal-700">asset valuation guide</Link> for phase-by-phase data.
            </p>
          </div>

          <RelatedInsights articles={[
            {
              href: '/insights/how-much-is-my-biotech-asset-worth',
              title: 'How Much Is My Biotech Asset Worth?',
              description: 'Phase-by-phase valuation benchmarks and the 5 factors that determine deal value.',
              badge: 'Valuation',
            },
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'The PoC inflection point and when to deal at each stage.',
              badge: 'Benchmarks',
            },
            {
              href: '/insights/pharma-partner-identification-guide',
              title: 'Pharma Partner Identification Guide',
              description: 'Data-driven framework for finding the right licensing partner.',
              badge: 'Strategy',
            },
          ]} />

          {/* ── CITE THIS DATA ── */}
          <div className="my-12">
            <CiteThisData
              title="Biotech Fundraising vs Licensing — Deal Benchmarks & Decision Framework"
              pageUrl="/insights/biotech-fundraising-deal-benchmarks"
            />
          </div>
        </article>

        <InsightCTA
          variant="bottom"
          heading="See What Your Asset Is Worth to Partners"
          description={`Generate a full deal valuation with comparable transactions, rNPV scenarios, and partner matching — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions. ${PRICING.REPORT_PRICE} one-time.`}
          calculatorHref="/report"
        />
      </main>
    </>
  );
}
