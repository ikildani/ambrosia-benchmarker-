import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { RelatedInsights } from '@/components/insights/RelatedInsights';
import { DEAL_STATS, PRICING } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Deal Committee Presentation Guide — How to Get BD Deals Approved | Ambrosia Ventures',
  description: `How to build a deal committee presentation that gets approved. Comparable transactions, rNPV scenarios, and negotiation playbooks from ${DEAL_STATS.TOTAL_DEALS} biopharma deals.`,
  keywords: [
    'deal committee presentation',
    'BD committee deck',
    'pharma deal approval presentation',
    'deal committee slides',
    'biopharma deal approval process',
    'licensing deal presentation',
    'BD deal committee template',
    'pharma investment committee deck',
  ],
  openGraph: {
    title: 'Deal Committee Presentation Guide — How to Get BD Deals Approved',
    description: 'Comparable transactions, rNPV scenarios, and the negotiation playbook framework that gets deals through committee.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/insights/deal-committee-presentation-guide',
    images: [{ url: '/api/og?title=Deal%20Committee%20Presentation%20Guide&subtitle=How%20to%20Get%20BD%20Deals%20Approved&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Committee Presentation Guide',
    description: 'The 3 things every deal committee needs: comparable transactions, risk-adjusted valuation, and a negotiation playbook.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/deal-committee-presentation-guide',
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

function DataTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-200">
            {headers.map((h, i) => (
              <th key={i} className={`py-3 px-4 font-semibold text-slate-700 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
              {row.map((cell, j) => (
                <td key={j} className={`py-3 px-4 ${j === 0 ? 'text-left font-medium text-slate-800' : 'text-right text-slate-600 tabular-nums'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DealCommitteePresentationGuidePage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://calculator.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'Deal Committee Presentation Guide', item: 'https://calculator.ambrosiaventures.co/insights/deal-committee-presentation-guide' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Deal Committee Presentation Guide — How to Get BD Deals Approved',
    description: 'How to build a deal committee presentation with comparable transactions, rNPV scenarios, and negotiation playbooks that get deals approved.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-03',
    dateModified: '2026-04-03',
    mainEntityOfPage: 'https://calculator.ambrosiaventures.co/insights/deal-committee-presentation-guide',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What should a deal committee presentation include?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A deal committee presentation needs three core elements: (1) comparable transactions showing where the proposed deal sits relative to recent precedents in the same TA/modality/phase, (2) risk-adjusted valuation with bear/base/bull scenarios using rNPV or Monte Carlo methodology, and (3) a negotiation playbook showing walk-away points, key trade-offs, and a recommended negotiation strategy. Supporting elements include competitive landscape, market sizing, and partner strategic fit analysis.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many comparable transactions should I include?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Include 5-8 comparable transactions in the main presentation, with 15-20 available in the appendix. The 5-8 primary comps should be closely matched on therapeutic area, modality, development phase, and deal timing (within 3 years). Include at least one outlier on each end (high and low) to demonstrate the full range, and explain why the proposed deal should fall at a specific point within that range.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I present rNPV to a deal committee?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Present rNPV in three scenarios: bear case (conservative assumptions — lower market share, slower uptake, higher attrition), base case (median assumptions from comparable benchmarks), and bull case (optimistic but defensible — accelerated approval, combination potential, expanded indication). Show the sensitivity tornado chart identifying which 3-4 assumptions drive 80% of the valuation range. Committees want to see that you understand the downside, not just the upside.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are common mistakes in deal committee presentations?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Five common mistakes: (1) cherry-picking comparables that support a predetermined valuation instead of showing the full range, (2) presenting a single-scenario rNPV without sensitivity analysis, (3) ignoring competitive pipeline risk — failing to model what happens if 2-3 competitors reach market first, (4) not having a clear walk-away point that the committee can reference during negotiations, and (5) presenting market sizing without bottoms-up validation.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I build a negotiation playbook for deal committee?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A negotiation playbook has four components: (1) walk-away economics — the maximum upfront, total deal value, and royalty rates you can accept while maintaining positive NPV, (2) trade-off matrix — what you will concede on milestones to gain on upfront, or vice versa, (3) competitive leverage points — other interested parties and their likely timelines, and (4) sequencing strategy — which terms to negotiate first and which to hold for later. The playbook should be pre-approved by the committee so the BD team has clear authority during negotiations.',
        },
      },
    ],
  };

  return (
    <>
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
              <span className="text-slate-200">Deal Committee Guide</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-rose-500/20 text-rose-300 text-sm font-medium rounded-full mb-6">
              Deal Execution
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              Deal Committee{' '}
              <span className="text-rose-400">Presentation Guide</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              A deal committee presentation needs three things: comparable transactions, risk-adjusted valuation, and a negotiation playbook. Here is how to build each one with data that gets deals approved.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">5-8</div>
                <div className="text-xs text-slate-400">Primary comparables</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">3</div>
                <div className="text-xs text-slate-400">rNPV scenarios</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">4</div>
                <div className="text-xs text-slate-400">Playbook components</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <TrustBar />
          <AuthorByline date="April 3, 2026" />

          <KeyTakeaways takeaways={[
            'Deal committees evaluate five things: comparable transactions, risk-adjusted valuation, competitive landscape, strategic rationale, and negotiation parameters. Missing any one can delay or kill a deal.',
            'The most common reason deals fail at committee is cherry-picked comparables. Present the full range with 5-8 primary comps and explain where the proposed deal should fall and why.',
            'Bear/base/bull rNPV scenarios with a tornado sensitivity chart demonstrate rigor. Committees distrust single-point valuations.',
            `A board-ready deal report with all five elements can be generated in 60 seconds from the Ambrosia Benchmarker for ${PRICING.REPORT_PRICE}.`,
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="five-areas">What Deal Committees Actually Evaluate</h2>

            <p>
              Deal committees — whether at large pharma, mid-cap biotech, or PE/VC firms — evaluate five areas when reviewing a proposed transaction. Each area must be addressed with data, not assertions. The strength of your presentation determines whether the committee approves, requests revisions, or rejects.
            </p>

            <h3>1. Comparable Transactions</h3>
            <p>
              Comparables are the foundation of every deal committee presentation. The committee needs to see where the proposed deal terms sit relative to recent market precedents. Without comparables, every number is an assertion — with comparables, every number is a data point. The quality of your comparables determines the committee&apos;s confidence in your proposed terms.
            </p>

            <h3>2. Risk-Adjusted Valuation</h3>
            <p>
              The committee needs an rNPV or Monte Carlo valuation that translates clinical probability, market assumptions, and deal economics into a risk-adjusted return. Single-point valuations are insufficient — committees want to see how sensitive the valuation is to key assumptions and what the downside scenario looks like.
            </p>

            <h3>3. Competitive Landscape</h3>
            <p>
              Every deal exists in competitive context. The committee will ask: what happens if 2-3 competitors reach market before this asset? What if a superior modality emerges? Competitive analysis must be current (updated within 30 days) and honest about risks. See our <Link href="/insights/adc-vs-bispecific-deal-benchmarks-2026" className="text-teal-600 font-medium hover:text-teal-700">modality comparison benchmarks</Link> for competitive context.
            </p>

            <h3>4. Strategic Rationale</h3>
            <p>
              Why this deal, why now, why this partner? Strategic rationale connects the deal to the company&apos;s broader pipeline strategy, revenue goals, and competitive positioning. The strongest rationale addresses a specific pipeline gap or strategic need that has board-level visibility.
            </p>

            <h3>5. Negotiation Parameters</h3>
            <p>
              The committee must approve not just the deal concept but the negotiation authority. This means clear walk-away points, trade-off frameworks, and competitive leverage positions. BD teams that go to committee without pre-approved negotiation parameters lose time going back for re-approval on every term change.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Deal Committee Presentation Structure</h3>
            <DataTable
              headers={['Section', 'Slides', 'Key Content', 'Data Source']}
              rows={[
                ['Executive Summary', '1-2', 'Deal terms, strategic rationale, recommendation', 'Internal + benchmarks'],
                ['Comparable Transactions', '2-3', '5-8 primary comps, range analysis, where this deal sits', `${DEAL_STATS.TOTAL_DEALS} deal database`],
                ['Risk-Adjusted Valuation', '3-4', 'Bear/base/bull rNPV, tornado sensitivity, Monte Carlo', 'rNPV + Monte Carlo engines'],
                ['Competitive Landscape', '2-3', 'Pipeline map, differentiation, risk scenarios', 'Competitive intelligence'],
                ['Market Sizing', '1-2', 'TAM, patient segments, pricing assumptions', 'Market sizing engine'],
                ['Partner Analysis', '1-2', 'Strategic fit, capability assessment, intent signals', `${DEAL_STATS.TOTAL_COMPANIES} profiles`],
                ['Negotiation Playbook', '2-3', 'Walk-away points, trade-offs, sequencing', 'Comparable deal structures'],
                ['Appendix', '5-10', 'Full comp set, detailed assumptions, backup analyses', 'Full data export'],
              ]}
            />
          </div>

          <InsightCTA
            variant="mid"
            heading="Generate a Board-Ready Deal Report"
            description={`Comparable transactions, rNPV valuation, sensitivity analysis, partner matching, and negotiation playbook — in 60 seconds. ${PRICING.REPORT_PRICE} one-time.`}
            calculatorHref="/report"
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="comparable-deals">How to Present Comparable Deals</h2>

            <p>
              Comparable deals are the most scrutinized element of any deal committee presentation. A well-constructed comp set builds confidence; a poorly constructed one destroys credibility. Here is how to do it right.
            </p>

            <p>
              <strong>Select 5-8 primary comparables.</strong> Match on four dimensions in order of importance: therapeutic area, development phase, modality, and deal timing (within 3 years). Perfect matches are rare — prioritize TA and phase, then explain adjustments for modality and timing differences.
            </p>

            <p>
              <strong>Show the full range.</strong> Include at least one comparable at the high end and one at the low end. Committees distrust comp sets where every transaction supports the proposed valuation — it signals cherry-picking. Present the range honestly, then argue for where the proposed deal should fall within that range.
            </p>

            <p>
              <strong>Normalize for deal structure.</strong> Not all &ldquo;$1B deals&rdquo; are equal. A deal with $300M upfront and $700M in milestones is very different from one with $100M upfront and $900M in milestones. Present comparables with consistent metrics: upfront, total deal value, upfront ratio, milestone structure, royalty range, and deal type (licensing vs. co-development vs. option).
            </p>

            <p>
              <strong>Explain outliers.</strong> If a comparable is significantly above or below the range, explain why. Was it a competitive auction (higher price)? A distressed seller (lower price)? A platform deal vs. single-asset (different structure)? Outlier explanations demonstrate analytical rigor.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Example: Phase 2 Oncology Comparables (ADC)</h3>
            <DataTable
              headers={['Deal', 'Year', 'Upfront', 'TDV', 'Upfront %', 'Notes']}
              rows={[
                ['Company A - Pharma X', '2025', '$280M', '$1.8B', '15.6%', 'Single target, Phase 2a'],
                ['Company B - Pharma Y', '2025', '$350M', '$2.2B', '15.9%', 'Biomarker-validated, BTD'],
                ['Company C - Pharma Z', '2024', '$180M', '$1.4B', '12.9%', 'Competitive landscape, no BTD'],
                ['Company D - Pharma W', '2024', '$420M', '$2.8B', '15.0%', 'Platform deal, 2 targets'],
                ['Company E - Pharma V', '2024', '$150M', '$1.1B', '13.6%', 'China-origin, Phase 1/2'],
                [<strong key="med" className="text-rose-700">Median</strong>, '', <strong key="med-u">$280M</strong>, <strong key="med-t">$1.8B</strong>, <strong key="med-p">15.0%</strong>, ''],
                [<em key="prop" className="text-slate-500">Proposed Deal</em>, '2026', <em key="prop-u">$300M</em>, <em key="prop-t">$2.0B</em>, <em key="prop-p">15.0%</em>, 'At median — defensible'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Illustrative example. Real comparables available through Ambrosia Benchmarker.</p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="rnpv-scenarios">How to Present rNPV With Scenarios</h2>

            <p>
              Risk-adjusted net present value is the standard methodology for biopharma deal valuation. The key to a convincing rNPV presentation is not the base case number — it is the framework around it. Committees approve frameworks, not numbers.
            </p>

            <p>
              <strong>Bear case.</strong> Use conservative assumptions: lower market share (25th percentile of comparables), slower uptake, higher attrition rates (published LOA tables + 10%), and compressed pricing. The bear case should still show positive value — if it does not, the deal has insufficient margin of safety.
            </p>

            <p>
              <strong>Base case.</strong> Use median assumptions from comparable benchmarks: median market share, median uptake curve, published probability of success by phase, and benchmark pricing. The base case is your primary recommendation.
            </p>

            <p>
              <strong>Bull case.</strong> Use optimistic but defensible assumptions: accelerated approval pathway, combination opportunity adding 30-50% to addressable market, best-in-class efficacy scenario. The bull case should be achievable, not theoretical.
            </p>
          </div>

          <div className="my-8 grid sm:grid-cols-3 gap-4">
            <StatCard value="$800M" label="Bear Case rNPV" sub="Conservative assumptions" />
            <StatCard value="$1.5B" label="Base Case rNPV" sub="Median benchmarks" />
            <StatCard value="$2.4B" label="Bull Case rNPV" sub="Optimistic, defensible" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p>
              <strong>Tornado sensitivity chart.</strong> Show which 3-4 assumptions drive 80% of the valuation range. Typical high-sensitivity variables include: probability of technical success at current phase, peak revenue market share, pricing assumptions, and time to peak sales. The tornado chart communicates to the committee exactly where the risk lives — and where monitoring should focus post-deal.
            </p>

            <h2 id="common-mistakes">Common Mistakes That Kill Deals at Committee</h2>

            <p>
              Five mistakes cause deal committee rejections or delays more than any other factors. Each is avoidable with proper preparation.
            </p>

            <p>
              <strong>1. Cherry-picked comparables.</strong> The number one credibility killer. If the committee discovers that you omitted a directly comparable deal that traded at lower terms, they will question every other number in your presentation. Always present the full range and argue your position within it.
            </p>

            <p>
              <strong>2. Single-scenario valuation.</strong> A single rNPV number without sensitivity analysis tells the committee nothing about risk. They cannot evaluate the margin of safety, identify key assumptions to monitor, or define walk-away conditions. Always present bear/base/bull with a tornado chart.
            </p>

            <p>
              <strong>3. Ignoring competitive pipeline risk.</strong> Committees will ask &ldquo;what if a competitor gets there first?&rdquo; If your presentation does not address this scenario with specific competitive assets and modeled impact on market share, the committee will either reject the deal or add a significant discount that may kill the economics.
            </p>

            <p>
              <strong>4. No walk-away point.</strong> Without a clear walk-away point (maximum upfront, minimum milestones, royalty ceiling), the committee has no framework for evaluating counter-offers during negotiation. This leads to repeated committee meetings for every term change, slowing the deal and frustrating the counterparty.
            </p>

            <p>
              <strong>5. Market sizing without bottoms-up validation.</strong> Top-down market sizing (incidence x treatment rate x price) overstates addressable markets by 30-50%. Committees expect bottoms-up validation: specific patient segments, realistic treatment sequencing, payer coverage assumptions, and competitive share. Use the <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Market Sizing engine</Link> for validated estimates.
            </p>
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-rose-900 mb-1">Time-sensitive: Deal committee deadlines</p>
            <p className="text-sm text-rose-800 leading-relaxed">
              If you are preparing a deal committee presentation with a deadline, the <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> ({PRICING.REPORT_PRICE}) generates comparable transactions, rNPV valuation, sensitivity analysis, market sizing, partner intelligence, and negotiation playbook in 60 seconds. It is the fastest path from &ldquo;I need deal committee data&rdquo; to &ldquo;I have a board-ready presentation.&rdquo;
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>What should a deal committee presentation include?</h3>
            <p>
              Three core elements: comparable transactions (5-8 primary comps showing the deal range), risk-adjusted valuation (bear/base/bull rNPV with sensitivity), and negotiation parameters (walk-away points, trade-off matrix, competitive leverage). Supporting sections include competitive landscape, market sizing, strategic rationale, and partner analysis.
            </p>

            <h3>How many comparable transactions should I include?</h3>
            <p>
              Five to eight in the main presentation, 15-20 in the appendix. Match on TA, phase, modality, and recency. Include outliers on both ends and explain them. The <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> automatically matches comparable transactions from {DEAL_STATS.TOTAL_DEALS} verified deals.
            </p>

            <h3>How do I present rNPV to a deal committee?</h3>
            <p>
              Always present three scenarios (bear/base/bull) with a tornado sensitivity chart showing which 3-4 assumptions drive 80% of the range. The base case uses median benchmarks; the bear case uses conservative assumptions; the bull case is optimistic but defensible. See our <Link href="/insights/rnpv-vs-dcf-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">rNPV vs DCF guide</Link> for methodology details.
            </p>

            <h3>What are common mistakes in deal committee presentations?</h3>
            <p>
              Five killers: cherry-picked comparables, single-scenario valuation, ignoring competitive risk, no defined walk-away point, and unvalidated market sizing. Each is avoidable with proper data preparation. The <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Ambrosia Deal Report</Link> addresses all five automatically.
            </p>

            <h3>How long does it take to prepare a deal committee presentation?</h3>
            <p>
              Traditional preparation takes 2-4 weeks of analyst time for comparable deal research, valuation modeling, and competitive analysis. With the <Link href="/report" className="text-teal-600 font-medium hover:text-teal-700">Deal Report</Link> ({PRICING.REPORT_PRICE}), the data foundation is generated in 60 seconds — leaving your team to focus on strategic narrative and internal stakeholder management rather than data compilation.
            </p>
          </div>

          <RelatedInsights articles={[
            {
              href: '/insights/how-much-is-my-biotech-asset-worth',
              title: 'How Much Is My Biotech Asset Worth?',
              description: 'Phase-by-phase valuation benchmarks for committee presentations.',
              badge: 'Valuation',
            },
            {
              href: '/insights/rnpv-vs-dcf-biotech-valuation',
              title: 'rNPV vs DCF for Biotech Valuation',
              description: 'Which methodology to present to committee and when.',
              badge: 'Methodology',
            },
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'Stage-gate data for committee valuation frameworks.',
              badge: 'Benchmarks',
            },
          ]} />
        </article>

        <InsightCTA
          variant="bottom"
          heading="Generate a Board-Ready Deal Report"
          description={`Comparable transactions, rNPV scenarios, sensitivity analysis, partner intelligence, and negotiation playbook — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions. ${PRICING.REPORT_PRICE} one-time.`}
          calculatorHref="/report"
        />
      </main>
      <SiteFooter />
    </>
  );
}
