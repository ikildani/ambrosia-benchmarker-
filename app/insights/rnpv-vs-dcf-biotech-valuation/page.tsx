import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { DEAL_STATS } from '@/lib/config/constants';
import { KeyTakeaways } from '@/components/insights/KeyTakeaways';
import { TrustBar } from '@/components/insights/TrustBar';
import { AuthorByline } from '@/components/insights/AuthorByline';
import { InsightCTA } from '@/components/insights/InsightCTA';
import { RelatedInsights } from '@/components/insights/RelatedInsights';

export const metadata: Metadata = {
  title: 'rNPV vs DCF for Biotech Valuation — When to Use Each | Ambrosia Ventures',
  description: `Analysis of ${DEAL_STATS.TOTAL_DEALS} biopharma deals shows how rNPV and DCF valuation methods diverge by 5-20x for clinical-stage assets. Learn when each model applies and how probability-of-success adjustment changes asset value.`,
  keywords: [
    'rNPV vs DCF',
    'biotech valuation methods',
    'risk-adjusted NPV',
    'pharma asset valuation',
    'rNPV biotech',
    'DCF pharma valuation',
    'probability of success biotech',
    'clinical stage asset valuation',
  ],
  openGraph: {
    title: 'rNPV vs DCF for Biotech Valuation — When to Use Each',
    description: 'How PoS adjustment changes asset value by 5-20x, and which model to use at each development stage.',
    type: 'article',
    url: 'https://calculator.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
    images: [{ url: '/api/og?title=rNPV%20vs%20DCF%20Valuation&subtitle=When%20to%20Use%20Each&type=insight', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'rNPV vs DCF for Biotech Valuation',
    description: 'PoS adjustment changes asset value by 5-20x. Data from 2,500+ deals shows which model to use when.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
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

export default function RnpvVsDcfPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://calculator.ambrosiaventures.co' },
      { '@type': 'ListItem', position: 2, name: 'Insights', item: 'https://calculator.ambrosiaventures.co/insights' },
      { '@type': 'ListItem', position: 3, name: 'rNPV vs DCF Biotech Valuation', item: 'https://calculator.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation' },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'rNPV vs DCF for Biotech Valuation — When to Use Each',
    description: 'How probability-of-success adjustment changes clinical-stage asset valuation by 5-20x, with data from 2,500+ deals.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://calculator.ambrosiaventures.co' },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: 'https://calculator.ambrosiaventures.co/logo.png' } },
    datePublished: '2026-04-02',
    dateModified: '2026-04-02',
    mainEntityOfPage: 'https://calculator.ambrosiaventures.co/insights/rnpv-vs-dcf-biotech-valuation',
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is rNPV and how does it differ from DCF?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Risk-adjusted NPV (rNPV) applies phase-specific probability-of-success (PoS) adjustments to each future cash flow, while standard DCF discounts all cash flows at a single risk-adjusted rate. rNPV explicitly models clinical attrition — a Phase 1 oncology asset with 5% cumulative PoS will have an rNPV roughly 20x lower than its unadjusted DCF value. rNPV is the industry standard for clinical-stage biotech assets.',
        },
      },
      {
        '@type': 'Question',
        name: 'When should I use DCF instead of rNPV for biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'DCF is appropriate for approved drugs with established commercial revenue, where clinical risk has been eliminated and the primary uncertainties are commercial (market share, pricing, competition). For any asset still in clinical development — from preclinical through NDA filing — rNPV is the standard because it explicitly captures the probability that the drug never reaches market.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much does PoS adjustment change asset value?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The impact depends on development phase and therapeutic area. A preclinical oncology asset (cumulative PoS ~5%) will see its rNPV at roughly 1/20th of the unadjusted DCF value. A Phase 3 asset (cumulative PoS ~50-60%) will see its rNPV at roughly 1/2 of DCF. The difference narrows as clinical risk is retired, which is why proof-of-concept (Phase 2) is the largest single inflection point for deal value.',
        },
      },
      {
        '@type': 'Question',
        name: 'What discount rates are standard for biotech rNPV models?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Because rNPV already adjusts for clinical risk via PoS, the discount rate should reflect only time-value and commercial risk — typically 8-12% for large-cap pharma acquirers and 10-15% for mid-cap biotech. Using a risk-adjusted discount rate on top of PoS adjustments double-counts risk and systematically undervalues clinical-stage assets. Standard DCF models for approved drugs typically use 10-15% discount rates.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do pharma companies use rNPV in deal negotiations?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Large pharma BD teams run rNPV models as their primary valuation tool for in-licensing and acquisition targets. They typically model base, upside, and downside scenarios using different PoS assumptions and peak sales estimates. The rNPV output sets the ceiling for total deal value (upfront + milestones + royalties). Biotech licensors should build their own rNPV models to understand the buyer\'s likely valuation range before entering negotiations.',
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
              <span className="text-slate-200">rNPV vs DCF Valuation</span>
            </nav>

            <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full mb-6">
              Valuation Guide
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
              rNPV vs DCF for Biotech Valuation:{' '}
              <span className="text-blue-400">When to Use Each</span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              How probability-of-success adjustment changes clinical-stage asset value by 5-20x — and why choosing the wrong model can cost you hundreds of millions in deal negotiations.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{DEAL_STATS.TOTAL_DEALS}</div>
                <div className="text-xs text-slate-400">Deals analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">5-20x</div>
                <div className="text-xs text-slate-400">Value divergence</div>
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
          <AuthorByline date="April 2, 2026" />

          <KeyTakeaways takeaways={[
            'rNPV is the industry standard for clinical-stage assets; DCF is appropriate only for approved drugs with commercial revenue.',
            'PoS adjustment reduces preclinical asset value by ~20x vs unadjusted DCF, but only ~2x for Phase 3 assets — the gap narrows as risk retires.',
            'Using a high discount rate on top of PoS adjustments double-counts risk and systematically undervalues early-stage assets by 30-50%.',
            'The Ambrosia Benchmarker runs both rNPV and DCF models simultaneously so you can see how your asset value changes under each framework.',
          ]} />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="the-core-difference">The Core Difference: Risk in the Cash Flows vs Risk in the Rate</h2>

            <p>
              The fundamental difference between rNPV and DCF comes down to <em>where</em> you account for clinical risk. In a standard DCF model, you project peak sales, apply a discount rate (typically 10-15%), and arrive at a present value that implicitly assumes the drug reaches market. In rNPV, you apply phase-specific probability-of-success (PoS) multipliers to each future cash flow <em>before</em> discounting, explicitly modeling the likelihood that the drug never generates revenue.
            </p>

            <p>
              For an approved drug with $2B peak sales, both methods produce similar valuations. But for a Phase 1 oncology asset targeting the same peak sales, the difference is stark: a DCF at 12% discount rate might value the asset at $4-6B, while rNPV with a 5-8% cumulative PoS produces $250-500M. That 10-20x gap is not a modeling error — it is the market price of clinical risk.
            </p>
          </div>

          <div className="my-8 grid sm:grid-cols-2 gap-4">
            <StatCard value="$4.8B" label="DCF Value (Phase 1 Onc.)" sub="$2B peak sales, 12% WACC" />
            <StatCard value="$310M" label="rNPV Value (Phase 1 Onc.)" sub="Same asset, 6.5% cumulative PoS" />
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="pos-by-phase">Probability of Success by Phase and Therapeutic Area</h2>

            <p>
              The PoS assumptions you use are the single most important input in any rNPV model. They vary significantly by phase, therapeutic area, and modality. The table below shows cumulative PoS from each phase to approval, derived from our analysis of {DEAL_STATS.TOTAL_DEALS} deals and cross-referenced with published clinical attrition data.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Phase', 'Oncology', 'Neurology', 'Immunology', 'Metabolic']}
              rows={[
                ['Preclinical', '3-5%', '5-7%', '6-8%', '8-11%'],
                ['Phase 1', '6-10%', '10-14%', '12-16%', '15-19%'],
                ['Phase 2', '15-22%', '18-25%', '25-32%', '28-38%'],
                [<strong key="p3" className="text-blue-700">Phase 3</strong>, <strong key="p3o">48-58%</strong>, <strong key="p3n">50-60%</strong>, <strong key="p3i">55-65%</strong>, <strong key="p3m">60-72%</strong>],
                ['NDA Filed', '85-92%', '82-90%', '88-94%', '90-95%'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Cumulative PoS from phase to approval. Ranges reflect historical attrition data across indications within each TA.</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
            <p className="text-sm font-semibold text-blue-900 mb-1">Why oncology PoS is lowest</p>
            <p className="text-sm text-blue-800 leading-relaxed">
              Oncology&apos;s lower cumulative PoS reflects higher Phase 2 and Phase 3 attrition rates, driven by heterogeneous tumor biology, evolving standard-of-care, and stringent endpoint requirements (OS vs PFS). Despite lower PoS, oncology assets command premium deal values because of larger addressable markets and premium pricing.
            </p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="when-to-use-rnpv">When to Use rNPV</h2>

            <p>
              rNPV is the correct model for any asset that has not yet received regulatory approval. This includes:
            </p>

            <ul>
              <li><strong>Preclinical through Phase 3 assets</strong> — the primary use case. Clinical attrition is the dominant risk, and PoS captures it explicitly.</li>
              <li><strong>In-licensing and acquisition due diligence</strong> — pharma BD teams universally use rNPV to set their walk-away price and structure milestone triggers.</li>
              <li><strong>Portfolio valuation</strong> — for biotechs with multiple clinical-stage programs, rNPV provides a consistent, risk-adjusted framework for comparing assets at different stages.</li>
              <li><strong>Deal negotiation</strong> — understanding the buyer&apos;s rNPV range lets you negotiate upfronts, milestones, and royalties against their likely internal valuation.</li>
            </ul>

            <h2 id="when-to-use-dcf">When to Use DCF</h2>

            <p>
              Standard DCF is appropriate when clinical risk has been eliminated and the primary uncertainties are commercial:
            </p>

            <ul>
              <li><strong>Approved drugs</strong> — the asset has cleared all clinical and regulatory hurdles. Remaining risks are market adoption, competition, and pricing.</li>
              <li><strong>Late-stage assets with near-certain approval</strong> — Phase 3 assets with overwhelming efficacy data and a clear regulatory path (e.g., breakthrough therapy designation with positive advisory committee vote).</li>
              <li><strong>Commercial-stage company valuation</strong> — for companies with revenue-generating products, DCF on the commercial portfolio plus rNPV on the clinical pipeline is the standard framework.</li>
            </ul>

            <h2 id="the-double-counting-trap">The Double-Counting Trap: Discount Rate + PoS</h2>

            <p>
              The most common modeling error in biotech valuation is applying a high risk-adjusted discount rate (15-20%) <em>on top of</em> PoS adjustments. This double-counts clinical risk and systematically undervalues early-stage assets by 30-50%.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Approach', 'Phase 1 Asset Value', 'Phase 3 Asset Value', 'Error']}
              rows={[
                [<strong key="c" className="text-blue-700">Correct: rNPV + 10% WACC</strong>, '$310M', '$1,850M', 'Baseline'],
                ['Wrong: rNPV + 18% WACC', '$185M', '$1,320M', '-35% to -40%'],
                ['Wrong: DCF only at 12%', '$4,800M', '$3,200M', '+10-15x overvalued (Ph1)'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Illustrative: oncology small molecule, $2B peak sales, 12-year patent life.</p>
          </div>

          <div className="prose prose-slate prose-lg max-w-none">
            <p>
              In rNPV, the discount rate should reflect only the time-value of money and commercial execution risk — typically 8-12% for large pharma and 10-15% for mid-cap biotech. All clinical risk is already captured in the PoS multipliers. If you are using a 15%+ discount rate in an rNPV model, you are likely destroying value in negotiations by anchoring to an artificially low number.
            </p>

            <h2 id="rnpv-in-deal-negotiations">How rNPV Drives Deal Economics</h2>

            <p>
              Understanding the relationship between rNPV and deal terms is critical for both licensors and licensees. In our dataset of {DEAL_STATS.TOTAL_DEALS} deals, upfront payments typically represent 25-40% of the acquirer&apos;s internal rNPV for the asset. The rest is structured as milestones (tied to clinical, regulatory, and commercial triggers) and royalties.
            </p>

            <p>
              This means that if you can credibly demonstrate a higher rNPV — through better PoS assumptions, larger addressable market, or premium pricing — you directly increase every component of the deal. A 2x increase in rNPV typically translates to a 1.5-2x increase in upfront and a 1.3-1.5x increase in total deal value, because the milestone structure provides partial downside protection for the buyer.
            </p>
          </div>

          <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
            <DataTable
              headers={['Scenario', 'rNPV', 'Expected Upfront', 'Expected TDV']}
              rows={[
                ['Base case (Phase 2 oncology)', '$800M', '$200-280M', '$1.2-1.8B'],
                ['Higher PoS (+10 pts)', '$1,200M', '$320-420M', '$1.8-2.5B'],
                ['Larger market (+$500M peak)', '$1,100M', '$290-380M', '$1.6-2.2B'],
                ['Both combined', '$1,600M', '$420-560M', '$2.4-3.2B'],
              ]}
            />
            <p className="text-xs text-slate-400 mt-3">Illustrative ranges based on licensing deal structures in the Ambrosia dataset.</p>
          </div>

          <InsightCTA
            variant="mid"
            heading="Run Both Models on Your Asset"
            description={`The Ambrosia Benchmarker runs rNPV and DCF simultaneously across ${DEAL_STATS.TOTAL_DEALS} deals — see how your asset's value changes under each framework.`}
          />

          <div className="prose prose-slate prose-lg max-w-none">
            <h2 id="practical-guidance">Practical Guidance for BD Teams</h2>

            <p>
              For biotech licensors preparing for a deal, we recommend building three rNPV scenarios:
            </p>

            <ol>
              <li><strong>Conservative</strong> — use the lower bound of PoS ranges and consensus peak sales. This is likely the buyer&apos;s internal base case.</li>
              <li><strong>Base</strong> — use midpoint PoS and your internal peak sales estimate. This should approximate the buyer&apos;s &quot;management case.&quot;</li>
              <li><strong>Upside</strong> — model additional indications, geographic expansion, and best-in-class PoS. This sets your aspirational deal target.</li>
            </ol>

            <p>
              The spread between conservative and upside scenarios defines your negotiation range. If that spread is less than 2x, your valuation is relatively tight and negotiations will center on deal structure. If the spread exceeds 5x, there is significant disagreement potential, and you should expect more complex deal structures with milestone-heavy economics.
            </p>

            <h2 id="faq">Frequently Asked Questions</h2>

            <h3>What is rNPV and how does it differ from DCF?</h3>
            <p>
              Risk-adjusted NPV (rNPV) applies phase-specific probability-of-success (PoS) adjustments to each future cash flow, while standard DCF discounts all cash flows at a single risk-adjusted rate. rNPV explicitly models clinical attrition — a Phase 1 oncology asset with 5% cumulative PoS will have an rNPV roughly 20x lower than its unadjusted DCF value.
            </p>

            <h3>When should I use DCF instead of rNPV?</h3>
            <p>
              DCF is appropriate for approved drugs with established commercial revenue, where clinical risk has been eliminated and the primary uncertainties are commercial (market share, pricing, competition). For any asset still in clinical development, rNPV is the standard.
            </p>

            <h3>How much does PoS adjustment change asset value?</h3>
            <p>
              A preclinical oncology asset (cumulative PoS ~5%) will see its rNPV at roughly 1/20th of the unadjusted DCF value. A Phase 3 asset (cumulative PoS ~50-60%) will see its rNPV at roughly 1/2 of DCF. The difference narrows as clinical risk retires.
            </p>

            <h3>What discount rates are standard for biotech rNPV models?</h3>
            <p>
              Because rNPV already adjusts for clinical risk via PoS, the discount rate should reflect only time-value and commercial risk — typically 8-12% for large pharma and 10-15% for mid-cap biotech. Using a higher rate double-counts risk.
            </p>

            <h3>How do pharma companies use rNPV in deal negotiations?</h3>
            <p>
              Large pharma BD teams run rNPV models as their primary valuation tool. They model base, upside, and downside scenarios using different PoS and peak sales assumptions. The rNPV output sets the ceiling for total deal value. Biotech licensors should build their own rNPV models to understand the buyer&apos;s likely valuation range before entering negotiations.
            </p>
          </div>
        </article>

        {/* Related Insights */}
        <div className="max-w-3xl mx-auto px-4">
          <RelatedInsights articles={[
            {
              href: '/insights/phase-2-vs-phase-3-deal-economics',
              title: 'Phase 2 vs Phase 3 Deal Economics',
              description: 'How deal value inflects at proof-of-concept and the risk/reward tradeoff of timing your out-license.',
              badge: 'New',
            },
            {
              href: '/insights/biopharma-deal-valuation-methods',
              title: 'Biopharma Deal Valuation Methods',
              description: 'Complete guide to valuation frameworks used in biopharma licensing and M&A.',
              badge: 'Guide',
            },
            {
              href: '/insights/biotech-out-licensing-deal-terms-2025-2026',
              title: 'Out-Licensing Deal Terms 2025-2026',
              description: 'Benchmark terms for licensing, acquisition, co-dev, option, and collaboration structures.',
              badge: 'Data Report',
            },
          ]} />
        </div>

        {/* Bottom CTA */}
        <InsightCTA
          variant="bottom"
          heading="Run Both Models on Your Asset"
          description={`Model rNPV and DCF for any phase, modality, and therapeutic area — powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
