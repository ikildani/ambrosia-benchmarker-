import { Metadata } from 'next';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { GatedBenchmarkTable } from '@/components/insights/GatedBenchmarkTable';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
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
const WaterfallChart = dynamic(
  () => import('@/components/insights/WaterfallChart').then(m => ({ default: m.WaterfallChart })),
  { loading: () => <ChartSkeleton /> }
);
const PhaseUpfrontChart = dynamic(
  () => import('@/components/insights/PhaseUpfrontChart').then(m => ({ default: m.PhaseUpfrontChart })),
  { loading: () => <ChartSkeleton /> }
);
const ScrollProgress = dynamic(() => import('@/components/insights/ScrollProgress').then(m => ({ default: m.ScrollProgress })));
const StickyTOC = dynamic(() => import('@/components/insights/StickyTOC').then(m => ({ default: m.StickyTOC })));
const MiniCalculator = dynamic(() => import('@/components/insights/MiniCalculator').then(m => ({ default: m.MiniCalculator })));
const InlineEmailCapture = dynamic(() => import('@/components/insights/InlineEmailCapture').then(m => ({ default: m.InlineEmailCapture })));
const CiteThisData = dynamic(() => import('@/components/insights/CiteThisData').then(m => ({ default: m.CiteThisData })));
const ReportViewTracker = dynamic(() => import('@/components/insights/ReportViewTracker').then(m => ({ default: m.ReportViewTracker })));

export const metadata: Metadata = {
  title: 'Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection | Ambrosia Ventures',
  description: `How deal value inflects at proof-of-concept: Phase 2 upfronts jump 2.1x from Phase 1 while Phase 3 delivers another 2.3x. Analysis of ${DEAL_STATS.TOTAL_DEALS} deals shows when to out-license at each stage.`,
  keywords: [
    'phase 2 vs phase 3 deal',
    'proof of concept deal value',
    'clinical stage deal economics',
    'phase 2 out-licensing',
    'biotech deal timing',
    'phase 2 inflection point',
    'clinical milestone valuation',
    'when to out-license biotech',
  ],
  openGraph: {
    title: 'Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection',
    description: 'Phase 2 upfronts jump 2.1x from Phase 1. Phase 3 adds another 2.3x. When to deal at each stage.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics',
    images: [{ url: '/api/og?title=Phase%202%20vs%20Phase%203%20Deal%20Economics&subtitle=The%20PoC%20Inflection%20Point&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phase 2 vs Phase 3 Deal Economics',
    description: 'The PoC inflection: 2.1x upfront jump at Phase 2, 2.3x more at Phase 3. When to deal.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics',
  },
};


export default function Phase2VsPhase3Page() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://calculator.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Phase 2 vs Phase 3 Deal Economics', item: 'https://calculator.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection',
    description: 'How deal value inflects at proof-of-concept and the risk/reward tradeoff of timing your out-license at Phase 2 vs Phase 3.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://calculator.ambrosiaventures.co/insights/phase-2-vs-phase-3-deal-economics',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does deal value increase from Phase 2 to Phase 3?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Median upfront payments increase approximately 2.3x from Phase 2 to Phase 3 across all therapeutic areas. Median total deal value increases 1.9x. In oncology, Phase 2 median upfronts are $281M vs $714M at Phase 3 (2.5x). In immunology, the jump is $1,250M to $3,200M (2.6x). However, this increase must be weighed against the $200-500M+ cost and 2-3 years required to run a Phase 3 trial.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it better to out-license at Phase 2 or Phase 3?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'It depends on three factors: (1) your cash runway and ability to fund Phase 3, (2) the strength of your Phase 2 data, and (3) competitive dynamics. Phase 2 is the optimal timing if you lack Phase 3 capital, your PoC data is strong but Phase 3 outcomes are uncertain, or competitors are approaching similar readouts. Phase 3 is better if you can self-fund, data quality is exceptional, and waiting will not compromise your competitive position.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why is Phase 2 considered the most important inflection point?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Phase 2 proof-of-concept is where clinical risk compresses most dramatically. Cumulative probability of success jumps from 5-8% (Phase 1) to 15-25% (Phase 2), a 3x increase in a single stage. This PoS compression drives the 2.1x median upfront increase from Phase 1 to Phase 2 — the largest single-phase multiplier in the development lifecycle. No subsequent phase transition delivers as much proportional de-risking.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the risk of waiting for Phase 3 to out-license?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The primary risks are: (1) Phase 3 failure — approximately 40-50% of Phase 3 trials fail, destroying most of the asset value, (2) capital consumption — Phase 3 trials cost $200-500M+ and take 2-3 years, (3) competitive erosion — a competitor readout during your Phase 3 can compress your negotiating leverage, and (4) market timing — macro conditions (interest rates, pharma M&A cycles) may be less favorable in 2-3 years.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do upfront ratios differ between Phase 2 and Phase 3 deals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Phase 2 deals allocate 14-18% of total deal value as upfront payment, reflecting the remaining clinical risk. Phase 3 deals allocate 16-20% upfront, as more risk has been resolved. The absolute upfront increase from Phase 2 to Phase 3 is driven primarily by the expansion of total deal value (higher TDV with a slightly higher upfront percentage), not solely by the upfront ratio itself.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="phase-2-vs-phase-3" />
      <StickyTOC sections={[
        { id: 'the-inflection', label: 'The PoC Inflection', number: 1 },
        { id: 'by-therapeutic-area', label: 'By Therapeutic Area', number: 2 },
        { id: 'risk-reward', label: 'Risk/Reward Calculus', number: 3 },
        { id: 'upfront-ratios', label: 'Upfront Ratios', number: 4 },
        { id: 'the-option-alternative', label: 'Option Structure', number: 5 },
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
              <span className="text-slate-200">Phase 2 vs Phase 3</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Deal Timing Analysis
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Phase 2 vs Phase 3:{' '}
              <span className="text-blue-400">The PoC Inflection</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              How deal value inflects at proof-of-concept, why upfronts jump 2.1x at Phase 2, and the risk/reward calculus of waiting for Phase 3.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">2.1x</div>
                <div className="text-xs text-slate-400">Ph1 to Ph2 upfront jump</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">2.3x</div>
                <div className="text-xs text-slate-400">Ph2 to Ph3 upfront jump</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">40-50%</div>
                <div className="text-xs text-slate-400">Phase 3 failure rate</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 2, 2026" />

          <KeyTakeaways takeaways={[
            'Phase 2 PoC is the single most valuable inflection point: upfronts jump 2.1x from Phase 1 (the largest single-phase multiplier in the lifecycle).',
            'Phase 3 adds another 2.3x in median upfront, but costs $200-500M+ and 2-3 years — with a 40-50% failure rate.',
            'The optimal timing depends on cash runway, data quality, competitive dynamics, and whether the Phase 3 value increment justifies the capital and risk.',
            'Immunology and metabolic TAs show the largest Phase 2 premiums ($1,250M and $1,300M respectively), making Phase 2 deals particularly attractive in these areas.',
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="the-inflection">The Proof-of-Concept Inflection</h2>

            <p>
              Every biopharma BD professional understands that Phase 2 proof-of-concept is the most important data readout in a drug&apos;s lifecycle. But the deal economics data quantifies exactly how much value that readout creates — and reveals why the Phase 2 to Phase 3 decision is the most consequential timing choice in out-licensing strategy.
            </p>

            <p>
              Across {DEAL_STATS.TOTAL_DEALS} transactions in our database, the Phase 1 to Phase 2 transition delivers a <strong>2.1x increase in median upfront payment</strong> — the largest single-phase multiplier. This reflects the dramatic compression in clinical risk: cumulative probability of success jumps from 5-8% at Phase 1 to 15-25% at Phase 2, a 3x improvement in a single stage.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Deal Economics by Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Phase-by-phase upfronts, TDV, and multiples across all therapeutic areas. The Phase 1 to Phase 2 jump (2.1x) is the largest single value inflection.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Phase', 'Median Upfront', 'Median TDV', 'Upfront % of TDV', 'Phase-over-Phase Multiple']}
            rows={[
              ['Preclinical', '$82M', '$888M', '9.7%', '--'],
              ['Phase 1', '$140M', '$1.21B', '11.1%', '1.7x'],
              ['Phase 2', '$300M', '$1.80B', '14.2%', '2.1x'],
              ['Phase 3', '$678M', '$3.50B', '16.8%', '2.3x'],
              ['Approved', '$1.96B', '$6.75B', '26.5%', '2.9x'],
            ]}
            freeRows={5}
            footnote={`Source: Ambrosia Ventures analysis of ${DEAL_STATS.TOTAL_DEALS} transactions (2020-2026). All therapeutic areas. TDV = Total Deal Value. Medians minimize mega-deal distortion.`}
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The Phase 1 to Phase 2 transition delivers the largest single-phase multiplier in the entire development lifecycle (2.1x). No subsequent phase transition &mdash; including Phase 2 to Phase 3 &mdash; delivers as much proportional de-risking per dollar of clinical investment. This is why Phase 2 PoC data is the single most valuable inflection point in biopharma deal economics.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Median Upfront Payment by Development Phase</h3>
            <p className="text-xs text-slate-400 mb-4">Waterfall visualization showing the compounding value at each clinical stage. Based on {DEAL_STATS.TOTAL_DEALS} transactions across all therapeutic areas.</p>
          </div>

          <WaterfallChart
            data={[
              { phase: 'Preclinical', value: 82, n: 420 },
              { phase: 'Phase 1', value: 140, n: 350 },
              { phase: 'Phase 2', value: 300, n: 426 },
              { phase: 'Phase 3', value: 678, n: 345 },
              { phase: 'Approved', value: 1964, n: 364 },
            ]}
          />

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
              <div className="text-3xl font-bold text-slate-900 tabular-nums">$378M</div>
              <div className="text-sm text-slate-500 mt-1">Incremental upfront</div>
              <div className="text-xs text-slate-400 font-semibold mt-1">Ph3 minus Ph2</div>
            </div>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">The Core Question</p>
            <p className="text-slate-700 leading-relaxed">
              Is the $378M incremental upfront at Phase 3 worth the $200&ndash;500M+ Phase 3 trial cost, 2&ndash;3 years of additional development time, and 40&ndash;50% probability of complete failure? For most single-asset biotechs without Phase 3 capital, the answer is no &mdash; Phase 2 is the optimal deal point.
            </p>
          </div>

        </article>

        {/* Pull Quote */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
              &ldquo;Phase 2 proof-of-concept is the single most valuable inflection point in biopharma deal economics.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-slate-400">Risk-adjusted analysis of {DEAL_STATS.TOTAL_DEALS} verified transactions (2020&ndash;2026)</p>
          </div>
        </section>

        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="by-therapeutic-area">Phase 2 vs Phase 3 by Therapeutic Area</h2>

            <p>
              The Phase 2-to-Phase 3 value increment varies dramatically by therapeutic area. In areas with large, well-characterized patient populations (oncology, immunology), Phase 3 de-risking commands a significant premium. In areas with smaller trials and faster timelines (rare disease, hematology), the Phase 3 increment is more modest because the incremental cost and time are lower.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 vs Phase 3 Upfront by Therapeutic Area</h3>
            <p className="text-xs text-slate-400 mb-4">All therapeutic areas show a 2.3x&ndash;3.5x multiplier from Phase 2 to Phase 3 upfront. Metabolic commands the highest multiplier (3.5x) but also carries the highest absolute Phase 3 trial costs.</p>
          </div>

          <GatedBenchmarkTable
            headers={['Therapeutic Area', 'Ph2 Median Upfront', 'Ph3 Median Upfront', 'Ph2-to-Ph3 Multiple', 'Ph3 Trial Cost']}
            rows={[
              ['Metabolic', '$1,300M', '$4,500M', '3.5x', '$300-600M'],
              ['Immunology', '$1,250M', '$3,200M', '2.6x', '$200-400M'],
              ['Neurology', '$302M', '$838M', '2.8x', '$250-500M'],
              ['Oncology', '$281M', '$714M', '2.5x', '$200-450M'],
              ['Hematology', '$175M', '$420M', '2.4x', '$150-300M'],
              ['Rare Disease', '$150M', '$340M', '2.3x', '$100-250M'],
            ]}
            freeRows={4}
            footnote="Source: Ambrosia Ventures deal database. Trial cost ranges reflect pivotal Phase 3 in the relevant indication. Rare disease costs are lower due to smaller trial sizes."
          />

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Immunology and metabolic TAs show Phase 2 upfronts ($1,250M and $1,300M respectively) that already exceed Phase 3 oncology upfronts ($714M). If your asset is in one of these high-premium therapeutic areas, the case for dealing at Phase 2 is even stronger &mdash; you capture outsized value without Phase 3 risk.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2B</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Phase 2 Upfront Ranges by Therapeutic Area</h3>
            <p className="text-xs text-slate-400 mb-4">P25&ndash;P75 interquartile ranges showing the spread of Phase 2 upfront payments. Metabolic and immunology show the widest ranges, reflecting deal-to-deal variability in these high-premium TAs.</p>
          </div>

          <PhaseUpfrontChart
            data={[
              { phase: 'Metabolic', low: 800, median: 1300, high: 2100 },
              { phase: 'Immunology', low: 750, median: 1250, high: 1900 },
              { phase: 'Neurology', low: 150, median: 302, high: 520 },
              { phase: 'Oncology', low: 140, median: 281, high: 480, highlight: true },
              { phase: 'Hematology', low: 90, median: 175, high: 310 },
              { phase: 'Rare Disease', low: 75, median: 150, high: 280 },
            ]}
            title=""
            yLabel="Phase 2 Median Upfront ($M)"
          />

          {/* ── SECTION 3: RISK/REWARD CALCULUS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2 mt-16">Section 3</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="risk-reward">The Risk/Reward Calculus</h2>

            <p>
              The decision to deal at Phase 2 vs wait for Phase 3 is a risk/reward calculation with four variables: the incremental value from Phase 3 data, the cost of running the trial, the probability of Phase 3 success, and the time value of money.
            </p>

            <h3>Expected value analysis</h3>

            <p>
              Consider an oncology asset with $281M median Phase 2 upfront and $714M median Phase 3 upfront. The incremental value of Phase 3 is $433M in upfront. But the expected value of waiting must account for Phase 3 failure:
            </p>

            <ul>
              <li><strong>Phase 3 success (55% probability):</strong> $714M upfront = $393M expected value</li>
              <li><strong>Phase 3 failure (45% probability):</strong> $20-50M salvage value = $9-23M expected value</li>
              <li><strong>Weighted expected upfront:</strong> $402-416M</li>
              <li><strong>Minus Phase 3 cost:</strong> $200-450M</li>
              <li><strong>Net expected incremental value:</strong> -$34M to +$216M</li>
            </ul>

            <p>
              The math is often marginal. For oncology, waiting for Phase 3 has a positive expected value only if Phase 3 costs are below ~$350M and your asset-specific PoS is above 55%. For many biotechs — especially those facing competitive pressure or capital constraints — Phase 2 is the rational deal point.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              The net expected incremental value of holding to Phase 3 ranges from &minus;$34M to +$216M for an oncology asset &mdash; a calculation that is positive only under favorable assumptions. For single-asset biotechs, the risk-adjusted case for exiting at Phase 2 is overwhelming: $300M certain value versus a gamble with downside exposure.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h3>When Phase 2 is the clear winner</h3>

            <ul>
              <li><strong>Cash runway under 18 months.</strong> You cannot self-fund Phase 3, and the dilution from a Phase 3 financing erodes more value than the deal premium.</li>
              <li><strong>Competitive pressure.</strong> If 2+ competitors are in Phase 2/3, your Phase 2 data is a wasting asset — deal now before a competitor readout changes the landscape.</li>
              <li><strong>Strong Phase 2 data in a hot TA.</strong> Immunology and metabolic Phase 2 upfronts ($1,250M and $1,300M) already exceed Phase 3 oncology upfronts ($714M). The Phase 2 premium in these TAs is extraordinary.</li>
              <li><strong>First-in-class mechanism.</strong> Buyers pay a premium for mechanism novelty at Phase 2 before the competitive set is established.</li>
            </ul>

            <h3>When Phase 3 is worth the wait</h3>

            <ul>
              <li><strong>You can self-fund Phase 3.</strong> If you have the capital, the 2.3x upfront multiple compensates for the risk and cost.</li>
              <li><strong>Exceptional Phase 2 data.</strong> If your Phase 2 data is unambiguously positive (clear dose-response, strong effect size, clean safety), your asset-specific Phase 3 PoS is likely 65-75%, well above average.</li>
              <li><strong>No near-term competition.</strong> If your asset is the only one in its class approaching Phase 3, waiting does not risk competitive erosion.</li>
              <li><strong>Regulatory tailwinds.</strong> Breakthrough designation, Fast Track, or orphan status reduces Phase 3 cost and timeline, improving the expected value calculation.</li>
            </ul>
          </div>

          <InsightEmailCapture slug="phase-2-vs-phase-3-deal-economics" />
        </article>

        {/* ── PULL QUOTE 2 ── */}
        <section className="bg-slate-900 text-white">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <blockquote className="text-2xl sm:text-3xl font-bold leading-snug tracking-tight">
              &ldquo;The founders who capture the most value are not the ones who hold longest &mdash; they are the ones who recognize when their risk-adjusted value has peaked.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-slate-400">Phase 2 delivers $300M certain value vs. $38M expected value from holding to Phase 3</p>
          </div>
        </section>

        {/* ── INTERACTIVE CALCULATOR ── */}
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Model Your Own Deal</h2>
            <p className="text-slate-500 mb-6">Select your therapeutic area, phase, and modality to see live benchmarks from our database of {DEAL_STATS.TOTAL_DEALS} verified transactions.</p>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </div>
        </section>

        <article className="max-w-3xl mx-auto px-4 py-12">
          <InsightCTA
            variant="mid"
            heading="See Your Asset's Value at Each Phase"
            description="Model upfronts, milestones, and total deal value at Phase 2 and Phase 3 side-by-side — for your specific TA, modality, and indication."
          />

          {/* ── SECTION 4: UPFRONT RATIOS ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="upfront-ratios">Upfront Ratios: What the Percentages Mean</h2>

            <p>
              A subtle but important distinction: the Phase 2-to-Phase 3 upfront jump is driven by <em>both</em> a higher upfront percentage and a larger total deal value. At Phase 2, upfronts represent 14-18% of TDV. At Phase 3, they represent 16-20%. The absolute increase comes from the compounding effect: a larger TDV multiplied by a higher upfront ratio.
            </p>

            <p>
              This matters for negotiation. If a buyer offers you 12% upfront on a Phase 2 deal, you have data showing the market median is 14-18%. That 2-6 percentage point gap on a $1.8B TDV represents $36-108M in additional upfront value. For specific TA-level data on upfront ratios, see our <Link href="/insights/biopharma-deal-benchmarks-2026" className="text-teal-600 font-medium hover:text-teal-700">deal benchmarks analysis</Link>.
            </p>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              A 2&ndash;6 percentage point gap in upfront ratio on a $1.8B Phase 2 TDV represents $36&ndash;108M in additional upfront value. BD teams with benchmark data can identify and close this gap in term sheet negotiations &mdash; this is where deal intelligence translates directly to captured value.
            </p>
          </div>

          {/* ── SECTION 5: OPTION STRUCTURE ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="the-option-alternative">The Option Structure Alternative</h2>

            <p>
              For biotechs caught between Phase 2 and Phase 3, option deals offer a hybrid path. Structure a deal with a 5-10% option fee at Phase 2, an exercise payment of 15-25% triggered by Phase 3 initiation or data, and full licensing economics post-exercise. This locks in a partner (and cash) at Phase 2 while capturing Phase 3 upside if the data supports it. For more on this structure, see our <Link href="/insights/licensing-vs-acquisition-deal-terms" className="text-teal-600 font-medium hover:text-teal-700">licensing vs acquisition comparison</Link>.
            </p>
          </div>

          <div className="mt-10 mb-2">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 3A</p>
            <h3 className="text-base font-bold text-slate-900 mb-1">Option Deal Structure: Phase 2 Entry with Phase 3 Upside</h3>
            <p className="text-xs text-slate-400 mb-4">Option agreements grew from 8% of deal structures in 2020 to 18% in 2025 &mdash; a hybrid path that captures Phase 2 certainty with Phase 3 upside potential.</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 my-8">
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-teal-50 rounded-lg border border-teal-200">
                <div className="text-[10px] text-teal-600 uppercase tracking-wider font-semibold mb-2">At Phase 2</div>
                <div className="text-2xl font-bold text-teal-700">5&ndash;10%</div>
                <div className="text-xs text-teal-600 mt-1">Option fee</div>
                <div className="text-[10px] text-slate-500 mt-2">Non-refundable payment at signing</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-[10px] text-blue-600 uppercase tracking-wider font-semibold mb-2">At Phase 3 Data</div>
                <div className="text-2xl font-bold text-blue-700">15&ndash;25%</div>
                <div className="text-xs text-blue-600 mt-1">Exercise payment</div>
                <div className="text-[10px] text-slate-500 mt-2">Triggered by data readout</div>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Post-Exercise</div>
                <div className="text-2xl font-bold text-slate-700">Full</div>
                <div className="text-xs text-slate-600 mt-1">Licensing economics</div>
                <div className="text-[10px] text-slate-500 mt-2">Milestones + royalties</div>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-slate-700 leading-relaxed">
              Option deals are the fastest-growing deal structure in biopharma &mdash; up from 8% (2020) to 18% (2025). For biotechs with strong Phase 2 data but capital constraints, this structure provides non-dilutive funding while preserving Phase 3 upside. The risk of option lapse is the trade-off: if Phase 3 data disappoints, the buyer walks with only the option fee paid.
            </p>
          </div>

          {/* ── SECTION 6: FAQ ── */}
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 className="text-2xl font-bold text-slate-900 mb-6" id="faq">Frequently Asked Questions</h2>

            <h3>How much does deal value increase from Phase 2 to Phase 3?</h3>
            <p>
              Median upfront payments increase approximately 2.3x from Phase 2 to Phase 3 across all therapeutic areas. In oncology, the jump is from $281M to $714M (2.5x). In immunology, from $1,250M to $3,200M (2.6x). Total deal value increases approximately 1.9x on average.
            </p>

            <h3>Is it better to out-license at Phase 2 or Phase 3?</h3>
            <p>
              It depends on cash runway, data strength, competitive dynamics, and whether the Phase 3 value increment justifies the $200-500M+ cost and 40-50% failure risk. For most capital-constrained biotechs, Phase 2 is the optimal timing. Self-funded biotechs with exceptional data and no competitive pressure benefit from waiting.
            </p>

            <h3>Why is Phase 2 the most important inflection point?</h3>
            <p>
              Phase 2 proof-of-concept is where cumulative PoS jumps from 5-8% to 15-25% — a 3x improvement in a single stage. This risk compression drives the 2.1x upfront multiple from Phase 1 to Phase 2, the largest single-phase increase in the lifecycle.
            </p>

            <h3>What is the risk of waiting for Phase 3?</h3>
            <p>
              The primary risks are Phase 3 failure (40-50%), capital consumption ($200-500M+), competitive erosion from rival readouts, and unfavorable market timing. The expected value of waiting is positive only when asset-specific Phase 3 PoS exceeds 55% and trial costs are below $350M.
            </p>

            <h3>How do upfront ratios differ between Phase 2 and Phase 3?</h3>
            <p>
              Phase 2 deals allocate 14-18% of TDV as upfront. Phase 3 deals allocate 16-20%. The absolute upfront increase is driven by both a higher percentage and a larger TDV base — the compounding effect.
            </p>
          </div>

          {/* ── INLINE EMAIL CAPTURE ── */}
          <div className="my-12">
            <InlineEmailCapture
              heading="Get Deal Intelligence Weekly"
              description={`Join 2,000+ BD professionals who receive phase-by-phase benchmarks and deal timing analysis from ${DEAL_STATS.TOTAL_DEALS} verified transactions.`}
              source="phase-2-vs-phase-3-insight"
            />
          </div>

          {/* ── CITE THIS DATA ── */}
          <div className="my-12">
            <CiteThisData
              title="Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection"
              pageUrl="/insights/phase-2-vs-phase-3-deal-economics"
            />
          </div>

          <RelatedInsights articles={[
            {
              href: '/insights/biopharma-deal-benchmarks-2026',
              title: '3 Data Insights from 3,447 Deals',
              description: 'The Phase 2 inflection, immunology premium, and ADC normalization.',
              badge: 'Data Report',
            },
            {
              href: '/insights/rnpv-vs-dcf-biotech-valuation',
              title: 'rNPV vs DCF for Biotech Valuation',
              description: 'How PoS adjustment changes asset value by 5-20x at each development stage.',
              badge: 'Methods',
            },
            {
              href: '/insights/licensing-vs-acquisition-deal-terms',
              title: 'Licensing vs Acquisition Deal Terms',
              description: 'Side-by-side comparison of deal structures with 2026 market data.',
              badge: 'Comparison',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="See Your Asset's Value at Each Phase"
          description={`Model deal economics at Phase 2 and Phase 3 for any TA, modality, and indication — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
