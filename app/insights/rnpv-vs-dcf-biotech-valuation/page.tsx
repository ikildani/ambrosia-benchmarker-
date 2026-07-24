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
  title: 'rNPV vs DCF for Biotech Valuation — When to Use Each | Ambrosia Ventures',
  description: `Analysis of ${DEAL_STATS.TOTAL_DEALS} biopharma deals shows when rNPV vs DCF valuation applies, how probability-of-success adjustment changes asset value by 5-20x, and why leading BD teams use both methods.`,
  keywords: [
    'rNPV vs DCF',
    'biotech valuation methods',
    'risk-adjusted NPV',
    'pharma asset valuation',
    'rNPV biotech',
    'DCF pharma valuation',
    'clinical asset valuation',
    'probability of success valuation',
  ],
  openGraph: {
    title: 'rNPV vs DCF for Biotech Valuation — When to Use Each',
    description: 'How PoS adjustment changes asset value by 5-20x, and why the best BD teams run both models.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
    images: [{ url: '/api/og?title=rNPV%20vs%20DCF%20for%20Biotech%20Valuation&subtitle=When%20to%20Use%20Each&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'rNPV vs DCF for Biotech Valuation',
    description: 'PoS adjustment changes asset value by 5-20x. When to use each method — backed by real deal data.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
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

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-6 text-center">
      <div className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</div>
      <div className="text-sm font-medium text-slate-600 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function RNPVvsDCFPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://solidus.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://solidus.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'rNPV vs DCF for Biotech Valuation', item: 'https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'rNPV vs DCF for Biotech Valuation — When to Use Each',
    description: 'Analysis of how probability-of-success adjustment changes biotech asset value by 5-20x, and when each valuation method applies.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://solidus.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://solidus.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://solidus.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the difference between rNPV and DCF for biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'rNPV (risk-adjusted net present value) discounts each future cash flow by both the time value of money AND the probability of reaching that stage. DCF (discounted cash flow) applies only a time-value discount, assuming the asset will reach market. For a Phase 1 oncology asset, rNPV might yield $120M while DCF yields $1.8B — a 15x gap driven entirely by the ~7% cumulative probability of approval from Phase 1.',
        },
      },
      {
        '@type': 'Question',
        name: 'When should I use rNPV vs DCF for a biotech asset?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use rNPV for any asset that has not yet received regulatory approval — it properly reflects clinical risk. Use DCF for approved products where the primary uncertainty is commercial (peak sales, market share, competition). Many sophisticated BD teams run both models: rNPV for the base-case negotiation anchor and DCF to understand the upside scenario the buyer is pricing.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does probability of success affect biotech asset valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Probability of success (PoS) is the dominant variable in clinical-stage asset valuation. A Phase 1 oncology asset has roughly 5-8% cumulative PoS to approval, meaning rNPV is 12-20x lower than DCF. At Phase 2 (PoS ~15-25%), the gap narrows to 4-7x. By Phase 3 (PoS ~50-65%), rNPV converges to within 1.5-2x of DCF. This PoS compression is why Phase 2 proof-of-concept is the single most valuable inflection point in deal economics.',
        },
      },
      {
        '@type': 'Question',
        name: 'What discount rate should I use for biotech rNPV models?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The standard discount rate for biotech rNPV models is 8-12%, reflecting the cost of capital for biopharma companies. Because clinical risk is already captured by the PoS adjustments, the discount rate in rNPV should reflect only systematic (market) risk and time value — not project-specific clinical risk. Using a higher rate (e.g., 15-20%) double-counts risk and systematically undervalues assets.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I run both rNPV and DCF on the same biotech asset?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes — running both models is best practice. Solidus calculates rNPV and DCF simultaneously, allowing you to see the risk-adjusted base case (rNPV) alongside the success-case valuation (DCF). The ratio between the two tells you how much clinical de-risking value remains. If rNPV is $200M and DCF is $2B, there is 10x upside from clinical success — which informs milestone structuring and royalty negotiation.',
        },
      },
    ],
  };

  return (
    <>
      <ScrollProgress />
      <ReportViewTracker report="rnpv-vs-dcf" />
      <StickyTOC sections={[
        { id: 'what-is-rnpv', label: 'What Is rNPV', number: 1 },
        { id: 'what-is-dcf', label: 'What Is DCF', number: 2 },
        { id: 'the-gap', label: 'The 5-20x Gap', number: 3 },
        { id: 'when-to-use-each', label: 'When to Use Each', number: 4 },
        { id: 'common-mistakes', label: 'Common Mistakes', number: 5 },
        { id: 'the-phase-2-inflection', label: 'Phase 2 Inflection', number: 6 },
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
              <span className="text-slate-200">rNPV vs DCF</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Valuation Methods
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              rNPV vs DCF for Biotech Valuation:{' '}
              <span className="text-blue-400">When to Use Each</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              How probability-of-success adjustment changes asset value by 5-20x, and why the best BD teams run both models on every deal.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{DEAL_STATS.TOTAL_DEALS}</div>
                <div className="text-xs text-slate-400">Deals analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">5-20x</div>
                <div className="text-xs text-slate-400">rNPV vs DCF gap</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">8-12%</div>
                <div className="text-xs text-slate-400">Standard discount rate</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 2, 2026" />

          <KeyTakeaways takeaways={[
            'rNPV applies probability-of-success at each stage, yielding 5-20x lower valuations than DCF for preclinical and Phase 1 assets.',
            'DCF is appropriate for approved products where commercial risk — not clinical risk — is the dominant uncertainty.',
            'The rNPV-to-DCF ratio compresses from ~15x at Phase 1 to ~1.5x at NDA filing, making Phase 2 PoC the highest-leverage inflection point.',
            'Running both models simultaneously reveals the de-risking premium embedded in milestones and informs negotiation strategy.',
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 1</p>
            <h2 id="what-is-rnpv">What Is rNPV (Risk-Adjusted NPV)?</h2>

            <p>
              Risk-adjusted net present value (rNPV) is the standard valuation methodology for clinical-stage biopharma assets. Unlike a traditional DCF, which discounts future cash flows only for the time value of money, rNPV applies an additional discount at each development stage to reflect the probability that the asset will successfully advance.
            </p>

            <p>
              The formula is straightforward: each projected cash flow is multiplied by the cumulative probability of success (PoS) to that stage, then discounted back at the cost of capital. For a Phase 1 oncology small molecule with ~7% cumulative PoS to approval, this means the rNPV is roughly 1/14th of the unadjusted DCF. That single adjustment — accounting for clinical attrition — is what separates a defensible valuation from a headline number.
            </p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              For a Phase 1 oncology asset, the PoS adjustment alone reduces valuation by ~14x. This is not a modeling choice — it is a reflection of the 93% historical attrition rate from Phase 1 to approval for oncology small molecules.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 2</p>
            <h2 id="what-is-dcf">What Is DCF (Discounted Cash Flow)?</h2>

            <p>
              Discounted cash flow analysis projects future revenues and costs, then discounts them back to present value at a rate reflecting the cost of capital. DCF assumes the asset will reach market and generate the projected revenue stream. It is the standard methodology for approved products and late-stage assets where the primary risk is commercial execution rather than clinical failure.
            </p>

            <p>
              For an approved drug, DCF captures the relevant uncertainties: peak sales trajectory, competitive dynamics, patent expiry, and biosimilar/generic erosion. These commercial risks are reflected in the discount rate (typically 8-12% for large pharma, 12-15% for small-cap biotech) rather than in probability adjustments.
            </p>

            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 3</p>
            <h2 id="the-gap">The 5-20x Gap: How PoS Changes Everything</h2>

            <p>
              The divergence between rNPV and DCF is the single most important concept in biopharma deal economics. It determines how much value the buyer is pricing for clinical risk — and, by extension, how much of that risk premium should be reflected in milestone payments tied to clinical success.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1A</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Cumulative Probability of Success by Phase (Oncology)</h3>
            <HorizontalBarChart
              data={[
                { label: 'Preclinical', value: 4, displayValue: '3-5%' },
                { label: 'Phase 1', value: 7, displayValue: '5-8%' },
                { label: 'Phase 2', value: 22, displayValue: '15-25%' },
                { label: 'Phase 3', value: 57, displayValue: '50-65%' },
                { label: 'NDA Filed', value: 89, displayValue: '85-92%' },
                { label: 'Approved', value: 100, displayValue: '~100%' },
              ]}
              maxValue={100}
              color="#3b82f6"
            />
            <p className="text-xs text-slate-400 mt-3">Oncology small molecule. PoS ranges from BioMedTracker/FDA historical data.</p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The PoS jump from Phase 1 (5-8%) to Phase 2 (15-25%) represents a 3x increase in cumulative success probability — the largest single-phase jump in the development lifecycle. This is why Phase 2 proof-of-concept data is the single most valuable inflection point for deal economics.
            </p>
          </div>

          <ComparisonCard
            label="Phase 1 Oncology Asset — $2B Peak Sales Assumption"
            left={{ title: 'DCF Valuation', value: '$1,800M', sub: 'Assumes 100% success' }}
            right={{ title: 'rNPV Valuation', value: '$126M', sub: '7% cumulative PoS applied' }}
          />

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 1B</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">rNPV vs DCF by Development Phase (Oncology Small Molecule, $2B Peak Sales)</h3>
            <GatedBenchmarkTable
              headers={['Phase', 'Cumulative PoS', 'rNPV', 'DCF', 'DCF / rNPV Ratio']}
              rows={[
                ['Preclinical', '3-5%', '$55-90M', '$1,800M', '20-33x'],
                ['Phase 1', '5-8%', '$90-145M', '$1,800M', '12-20x'],
                ['Phase 2 (PoC)', '15-25%', '$270-450M', '$1,800M', '4-7x'],
                ['Phase 3', '50-65%', '$900-1,170M', '$1,800M', '1.5-2x'],
                ['NDA Filed', '85-92%', '$1,530-1,656M', '$1,800M', '1.1-1.2x'],
                ['Approved', '~100%', '$1,800M', '$1,800M', '1x'],
              ]}
              freeRows={6}
              footnote="Illustrative. Assumes 10% discount rate, 12-year revenue horizon. PoS ranges from BioMedTracker/FDA historical data."
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">Why this matters for deal terms</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              When a pharma buyer offers $150M upfront for a Phase 1 asset with $1.8B DCF potential, they are implicitly pricing ~8% PoS. If your internal PoS estimate is 12% (based on mechanism validation or biomarker enrichment), you have a quantifiable basis for negotiating $225M+ upfront or enhanced milestone triggers.
            </p>
          </div>

          {/* Pull Quote 1 */}
          <section className="bg-slate-900 text-white rounded-xl my-12">
            <div className="max-w-2xl mx-auto px-6 py-12 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                &ldquo;The difference between rNPV and DCF is not a modeling preference — it is the difference between a defensible valuation and a headline number.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Based on analysis of {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions</p>
            </div>
          </section>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 4</p>
            <h2 id="when-to-use-each">When to Use Each Method</h2>

            <h3>Use rNPV when:</h3>
            <ul>
              <li><strong>The asset is in clinical development</strong> (preclinical through Phase 3). Clinical attrition is the dominant risk, and ignoring it produces inflated valuations that no sophisticated buyer will accept.</li>
              <li><strong>You are negotiating a licensing deal.</strong> Both parties will run rNPV models; the negotiation is about PoS assumptions, peak sales estimates, and discount rates — not about whether to risk-adjust.</li>
              <li><strong>You need a defensible anchor for milestone structuring.</strong> The difference between rNPV at Phase 2 and rNPV at Phase 3 tells you exactly how much value each clinical milestone should unlock.</li>
            </ul>

            <h3>Use DCF when:</h3>
            <ul>
              <li><strong>The product is approved and commercially launched.</strong> Clinical risk is resolved; the remaining uncertainty is commercial execution, which is better captured in the discount rate and revenue assumptions.</li>
              <li><strong>You are evaluating an acquisition of an approved product.</strong> The buyer is paying for a revenue stream, not a probability-weighted option.</li>
              <li><strong>You need to model the success scenario.</strong> DCF shows what the asset is worth if everything works — useful for understanding the buyer&apos;s upside and calibrating royalty rates.</li>
            </ul>

            <h3>Run both when:</h3>
            <ul>
              <li><strong>You are negotiating any clinical-stage deal.</strong> rNPV gives you the risk-adjusted base; DCF shows the buyer&apos;s upside. The ratio between them reveals how much de-risking premium is embedded in milestones.</li>
              <li><strong>You need to justify milestone values to your board.</strong> Showing that Phase 3 initiation moves rNPV from $270M to $900M (a 3.3x jump) provides concrete justification for a $200M+ Phase 3 milestone.</li>
              <li><strong>You are running Monte Carlo sensitivity analysis.</strong> Simulating PoS as a distribution (rather than a point estimate) bridges the two methods and produces a range of outcomes that captures both clinical and commercial uncertainty.</li>
            </ul>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              The most sophisticated BD teams do not debate whether to use rNPV or DCF — they run both on every deal. The rNPV anchors the negotiation; the DCF reveals the buyer&apos;s upside. The ratio between them quantifies the de-risking premium that should be reflected in milestone payments.
            </p>
          </div>

          <InsightEmailCapture slug="rnpv-vs-dcf-biotech-valuation" />

          <InsightCTA
            variant="mid"
            heading="Run Both Models on Your Asset"
            description="Solidus calculates rNPV and DCF simultaneously, with Monte Carlo simulation across 10,000 scenarios."
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 5</p>
            <h2 id="common-mistakes">Common Valuation Mistakes</h2>

            <p>
              <strong>1. Double-counting risk in rNPV.</strong> If you apply PoS adjustments AND use a 15-20% discount rate, you are discounting clinical risk twice. The rNPV discount rate should reflect only systematic risk and time value (8-12%), not project-specific clinical risk.
            </p>

            <p>
              <strong>2. Using DCF for preclinical assets.</strong> A DCF model that shows a preclinical asset is &quot;worth $2B&quot; is technically correct under the assumption of 100% success, but it is not a valuation — it is a scenario analysis. No buyer will price a preclinical asset at DCF.
            </p>

            <p>
              <strong>3. Using static PoS tables.</strong> Phase-level PoS averages (e.g., &quot;Phase 2 oncology = 25%&quot;) are useful starting points, but the best valuations adjust for asset-specific factors: mechanism validation, biomarker selection, competitive landscape, and regulatory pathway. An asset with a validated biomarker and breakthrough designation may have 2-3x the average PoS.
            </p>

            <p>
              <strong>4. Ignoring the terminal value gap.</strong> In DCF models, terminal value (post-patent revenue) often accounts for 30-50% of total value. In rNPV, that same terminal value is heavily discounted by cumulative PoS. Ensure your rNPV model explicitly includes genericization assumptions and does not inadvertently assume perpetual branded pricing.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-1">Exhibit 2A</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">The Double-Counting Trap: Phase 2 Oncology Asset ($2B Peak Sales)</h3>
            <HorizontalBarChart
              data={[
                { label: 'DCF (no PoS)', value: 1800, displayValue: '$1,800M' },
                { label: 'Wrong: PoS + 18%', value: 180, displayValue: '$180M' },
                { label: 'Correct rNPV', value: 396, displayValue: '$396M' },
              ]}
              maxValue={1800}
              color="#ef4444"
            />
            <p className="text-xs text-slate-400 mt-3">Wrong approach applies PoS AND a 15-18% discount rate, double-counting clinical risk. Correct rNPV uses 10% discount rate with PoS adjustments only.</p>
          </div>

          {/* Key Insight callout */}
          <div className="border-l-4 border-teal-500 pl-5 py-3 my-8">
            <p className="text-sm font-semibold text-slate-900 mb-1">Key Insight</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              Double-counting risk by combining PoS adjustments with an elevated discount rate (15-18%) destroys $216M of value in this example — a 55% haircut below the correct rNPV. This is the most common valuation error in biotech BD and systematically advantages buyers in negotiations.
            </p>
          </div>

          <div className="my-8 grid sm:grid-cols-2 gap-4">
            <StatCard value="5-8%" label="Phase 1 Cumulative PoS" sub="Oncology, small molecule" />
            <StatCard value="50-65%" label="Phase 3 Cumulative PoS" sub="With prior Phase 2 efficacy" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 6</p>
            <h2 id="the-phase-2-inflection">The Phase 2 Inflection in rNPV Terms</h2>

            <p>
              Phase 2 proof-of-concept is where rNPV and DCF begin to converge. At Phase 1, the rNPV-to-DCF ratio is 12-20x. At Phase 2, it compresses to 4-7x. This single-phase compression — the largest in the entire development lifecycle — is why Phase 2 data is the most valuable inflection point in deal economics. For a deeper analysis of how this inflection affects specific deal terms, see our <Link href="/insights/phase-2-vs-phase-3-deal-economics" className="text-teal-600 font-medium hover:text-teal-700">Phase 2 vs Phase 3 deal economics</Link> comparison.
            </p>

            <p>
              In practical terms, a Phase 1 asset with $1.8B DCF and 7% PoS has an rNPV of ~$126M. After positive Phase 2 data, the same asset with 22% PoS has an rNPV of ~$396M — a 3.1x increase from a single data readout. This is why <Link href="/insights/biopharma-deal-benchmarks-2026" className="text-teal-600 font-medium hover:text-teal-700">median upfronts jump 2.1x from Phase 1 to Phase 2</Link> across our {DEAL_STATS.TOTAL_DEALS} deal database.
            </p>
          </div>

          {/* Pull Quote 2 */}
          <section className="bg-slate-900 text-white rounded-xl my-12">
            <div className="max-w-2xl mx-auto px-6 py-12 text-center">
              <blockquote className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                &ldquo;Phase 2 proof-of-concept delivers a 3.1x rNPV increase from a single data readout — the largest value inflection in the entire development lifecycle.&rdquo;
              </blockquote>
              <p className="mt-4 text-sm text-slate-400">Phase 1 rNPV $126M to Phase 2 rNPV $396M (oncology small molecule, $2B peak sales)</p>
            </div>
          </section>

          {/* MiniCalculator */}
          <div className="my-12">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Interactive</p>
            <h3 className="text-base font-bold text-slate-900 mb-4">Try It: Run Your Own rNPV vs DCF Comparison</h3>
            <MiniCalculator defaultTA="oncology" defaultPhase="phase2" defaultModality="smallMolecule" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-[0.2em] mb-2">Section 7</p>
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>What is the difference between rNPV and DCF for biotech valuation?</h3>
            <p>
              rNPV discounts each future cash flow by both the time value of money and the probability of reaching that development stage. DCF applies only a time-value discount, assuming the asset will reach market. For a Phase 1 oncology asset, rNPV might yield $120M while DCF yields $1.8B — a 15x gap driven by the ~7% cumulative probability of approval.
            </p>

            <h3>When should I use rNPV vs DCF?</h3>
            <p>
              Use rNPV for any asset that has not yet received regulatory approval. Use DCF for approved products where the primary uncertainty is commercial. Many sophisticated BD teams run both: rNPV for the base-case negotiation anchor and DCF to understand the upside scenario the buyer is pricing.
            </p>

            <h3>What discount rate should I use for biotech rNPV?</h3>
            <p>
              The standard discount rate for biotech rNPV models is 8-12%. Because clinical risk is captured by PoS adjustments, the discount rate should reflect only systematic risk and time value. Using 15-20% double-counts risk and systematically undervalues assets.
            </p>

            <h3>How does probability of success affect valuation?</h3>
            <p>
              PoS is the dominant variable in clinical-stage valuation. Phase 1 cumulative PoS of 5-8% means rNPV is 12-20x lower than DCF. At Phase 2 (15-25% PoS), the gap narrows to 4-7x. By Phase 3 (50-65% PoS), rNPV converges to within 1.5-2x of DCF.
            </p>

            <h3>Can I run both rNPV and DCF on the same asset?</h3>
            <p>
              Yes — this is best practice. The ratio between DCF and rNPV tells you how much clinical de-risking value remains. If rNPV is $200M and DCF is $2B, there is 10x upside from clinical success, which informs milestone structuring and royalty negotiation. The <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> calculates both simultaneously.
            </p>
          </div>

          {/* InlineEmailCapture near bottom */}
          <div className="my-12">
            <InlineEmailCapture
              heading="Get Weekly Valuation Intelligence"
              description="Join 2,000+ BD professionals who receive our weekly analysis of rNPV benchmarks, deal economics, and negotiation insights."
              source="rnpv-vs-dcf-insight"
            />
          </div>

          <RelatedInsights articles={[
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'How deal value inflects at proof-of-concept and the risk/reward tradeoff of timing your out-license.',
              badge: 'Comparison',
            },
            {
              href: '/insights/biopharma-deal-benchmarks-2026',
              title: '3 Data Insights from 3,447 Deals',
              description: 'Phase premiums, TA pricing, and modality trends across the full dataset.',
              badge: 'Data Report',
            },
            {
              href: '/insights/biotech-out-licensing-deal-terms-2025-2026',
              title: 'Out-Licensing Deal Terms 2025-2026',
              description: 'Benchmark terms for licensing, acquisition, co-dev, option, and collaboration structures.',
              badge: 'Guide',
            },
          ]} />

          {/* CiteThisData at bottom */}
          <div className="my-12">
            <CiteThisData
              title="rNPV vs DCF for Biotech Valuation — When to Use Each"
              pageUrl="/insights/rnpv-vs-dcf-biotech-valuation"
            />
          </div>
        </article>

        <InsightCTA
          variant="bottom"
          heading="Run Both Models on Your Asset"
          description={`Model rNPV and DCF simultaneously for any phase, modality, and therapeutic area — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
