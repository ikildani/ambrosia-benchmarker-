import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'How to Calculate rNPV for Biotech: Risk-Adjusted NPV Guide With PoS Rates by TA | Ambrosia Ventures',
  description: `Phase 1 oncology PoS: ~8%. Rare disease: ~15%. Learn rNPV calculation step by step with PoS rates across 12 TAs, calibrated against ${DEAL_STATS.TOTAL_DEALS} real deals. Free rNPV calculator included.`,
  keywords: [
    'rNPV calculation',
    'risk-adjusted NPV pharma',
    'biotech rNPV',
    'rNPV biotech valuation',
    'risk-adjusted NPV',
    'biotech valuation model',
    'rNPV calculation pharma',
    'phase transition probabilities',
    'Monte Carlo biotech',
    'drug development NPV',
    'rNPV calculator',
    'risk adjusted NPV pharma',
    'biotech drug valuation model',
    'probability of success pharma',
    'rNPV formula biotech',
    'biotech rNPV calculator',
  ],
  openGraph: {
    title: 'How to Calculate rNPV for Biotech: Risk-Adjusted NPV Guide With PoS Rates by TA',
    description: `Phase 1 oncology PoS: ~8%. Rare disease: ~15%. Step-by-step rNPV calculation with PoS rates across 12 TAs from ${DEAL_STATS.TOTAL_DEALS} real deals.`,
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/rnpv-biotech-valuation',
    images: [{ url: '/api/og?title=rNPV%20Biotech%20Valuation&subtitle=Complete%20Guide&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Calculate rNPV for Biotech: Risk-Adjusted NPV Guide With PoS Rates by TA',
    description: `Phase 1 oncology PoS: ~8%. Rare disease: ~15%. Step-by-step rNPV calculation from ${DEAL_STATS.TOTAL_DEALS} real deals.`,
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/rnpv-biotech-valuation',
  },
};

export default function RnpvBiotechValuationPage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Risk-Adjusted NPV (rNPV) for Biotech Valuation: Complete Guide',
    description: 'Master the industry-standard rNPV methodology for valuing biotech assets and licensing deals.',
    author: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
    },
    datePublished: '2026-03-20',
    dateModified: '2026-04-07',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/guides/rnpv-biotech-valuation`,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is the difference between NPV and rNPV in biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Standard NPV discounts future cash flows by a time-based discount rate only, assuming the product will reach market. Risk-adjusted NPV (rNPV) additionally applies probability-of-success (PoS) adjustments at each development stage, reflecting the substantial attrition risk in drug development. For example, a Phase 2 oncology asset has only a 28-35% cumulative probability of reaching approval, which dramatically reduces its rNPV relative to unadjusted NPV. rNPV is the industry standard for biotech valuation because it explicitly accounts for clinical and regulatory risk.',
        },
      },
      {
        '@type': 'Question',
        name: 'What discount rate should I use for rNPV biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The appropriate discount rate for rNPV biotech valuation typically ranges from 8-12% for development-stage assets, reflecting the risk premium over risk-free rates. Because rNPV already accounts for clinical attrition risk through probability adjustments, the discount rate should NOT double-count development risk. Use 8-9% for large-cap pharma licensees, 10-11% for mid-cap biotechs, and 11-12% for small-cap or pre-revenue companies. Some practitioners use the licensee\'s weighted average cost of capital (WACC) as the starting point.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Monte Carlo simulation improve on basic rNPV?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Basic rNPV produces a single expected value using point estimates for each input. Monte Carlo simulation runs thousands of scenarios where multiple inputs (PoS, peak sales, market share, pricing, timeline) are simultaneously varied according to probability distributions. This generates a full range of possible outcomes with confidence intervals, revealing the probability of achieving specific return thresholds. Monte Carlo is particularly valuable for complex assets with multiple indications, competitive uncertainty, or novel mechanisms where point estimates carry high uncertainty.',
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, faqSchema]) }} />

      <main className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-16 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,165,0.12),rgba(255,255,255,0))]" />
          </div>
          <div className="relative max-w-3xl mx-auto">
            <Breadcrumbs items={[
              { label: 'Home', href: '/' },
              { label: 'Guides', href: '/guides' },
              { label: 'rNPV Biotech Valuation' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              16 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Risk-Adjusted NPV (rNPV) for Biotech Valuation
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              The complete guide to the industry-standard methodology for valuing drug candidates, from phase transition probabilities to Monte Carlo enhancement.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Risk-adjusted net present value (rNPV) is the gold standard for valuing biotech assets, licensing deals, and development-stage drug programs. Unlike standard DCF analysis, rNPV explicitly accounts for the high probability of clinical failure that defines drug development, producing valuations that reflect both the upside potential and the substantial development risk of pharmaceutical assets.
            </p>

            <p className="text-slate-600 leading-relaxed">
              This guide walks through the complete rNPV methodology from first principles, covering probability-of-success estimation, cash flow modeling, discount rate selection, and Monte Carlo enhancement. Whether you are building a model for internal investment decisions or benchmarking a licensing deal, these frameworks will produce defensible, transparent valuations.
            </p>

            {/* Section 1 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="what-is-rnpv">
              What is rNPV?
            </h2>

            <p className="text-slate-600 leading-relaxed">
              <Link href="/glossary/risk-adjusted-npv" className="text-teal-600 font-medium hover:text-teal-700">Risk-adjusted NPV</Link> modifies the standard net present value calculation by incorporating the probability that a drug candidate will successfully navigate each stage of development and reach the market. The formula multiplies each future cash flow by two adjustment factors:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Time value of money:</strong> Standard discounting at the appropriate rate (typically 8-12% for biotech assets), reflecting the opportunity cost of capital deployed over the development timeline.</li>
              <li><strong>Probability of success (PoS):</strong> The cumulative probability that the asset will progress from its current stage through all remaining development phases to regulatory approval and commercialization. This is the defining feature of rNPV and what distinguishes it from standard NPV.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              The mathematical formulation is straightforward: rNPV = Sum of [Cash Flow(t) x Cumulative PoS(t) / (1 + r)^t] for all periods t. However, the power of rNPV lies not in the formula but in the rigor of the inputs, particularly the probability-of-success estimates and peak sales projections.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Standard NPV overstates value by assuming the drug will reach market. For a Phase 1 oncology asset with roughly 8% cumulative PoS, standard NPV could overvalue the asset by 10-12x compared to rNPV. This makes rNPV essential for any serious biotech valuation exercise.
            </p>

            {/* Section 2 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="phase-transition">
              Phase Transition Probabilities
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The most critical input to any rNPV model is the set of phase transition probabilities. These represent the historical likelihood that a drug candidate advances from one clinical phase to the next. Industry-wide averages, refined by therapeutic area and modality, provide the foundation:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Phase 1 to Phase 2:</strong> ~65% overall, ranging from 55% in oncology to 75% in infectious disease. Phase 1 primarily assesses safety and tolerability, so transition rates are relatively high across most TAs.</li>
              <li><strong>Phase 2 to Phase 3:</strong> ~35% overall, the lowest transition rate and the primary driver of clinical attrition. This &quot;Phase 2 cliff&quot; reflects the challenge of demonstrating efficacy in controlled trials. Oncology Phase 2-to-3 transitions average 28-32%, while rare disease can reach 45-55%.</li>
              <li><strong>Phase 3 to NDA/BLA filing:</strong> ~60% overall. Phase 3 failures are particularly costly given the investment already deployed. Well-designed Phase 3 programs based on strong Phase 2 signals can achieve 70-80% transition rates.</li>
              <li><strong>NDA/BLA to approval:</strong> ~85-90% overall. The FDA approves the majority of applications that reach review, though Complete Response Letters (CRLs) can delay approval by 1-3 years and significantly impact NPV.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Cumulative probability of success from each phase to approval is the product of all remaining transition probabilities. A Phase 1 asset has roughly 8-12% cumulative PoS, while a Phase 3 asset has approximately 50-55%. Our <Link href="/methodology" className="text-teal-600 font-medium hover:text-teal-700">methodology page</Link> details the specific PoS rates used in the Ambrosia Ventures engine across all 18 therapeutic areas and major modalities.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Adjustment factors can increase or decrease base PoS rates. Biomarker-selected populations, breakthrough therapy designation, prior positive Phase 2 data, and experienced sponsor teams all support upward adjustments. Novel targets without biological validation, complex trial designs, and prior failures in the indication warrant downward adjustments.
            </p>

            {/* PoS Data Table by Therapeutic Area */}
            <h3 className="text-xl font-bold text-slate-900 mt-10 mb-4" id="pos-by-therapeutic-area">
              Cumulative Probability of Success by Therapeutic Area (Phase 1 to Approval)
            </h3>

            <p className="text-slate-600 leading-relaxed mb-4">
              The table below shows cumulative PoS rates from Phase 1 through approval, drawn from our engine&apos;s calibration against {DEAL_STATS.TOTAL_DEALS} real biopharma transactions. These rates reflect the compounding effect of all phase transitions and are the inputs that drive our rNPV calculations.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Therapeutic Area</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Cumulative PoS</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Key Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 text-slate-700">Oncology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~8%</td><td className="py-2.5 px-4 text-slate-500">High Phase 2 attrition, complex endpoints</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Neurology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~6%</td><td className="py-2.5 px-4 text-slate-500">CNS penetration, subjective endpoints</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Immunology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~12%</td><td className="py-2.5 px-4 text-slate-500">Validated targets, biomarker-driven trials</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Rare Disease</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~15%</td><td className="py-2.5 px-4 text-slate-500">Orphan incentives, smaller trials, unmet need</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Cardiovascular</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~9%</td><td className="py-2.5 px-4 text-slate-500">Large outcome trials, high Phase 3 cost</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Metabolic</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~11%</td><td className="py-2.5 px-4 text-slate-500">Clear biomarkers (HbA1c, LDL), established pathways</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Infectious Disease</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~14%</td><td className="py-2.5 px-4 text-slate-500">Objective endpoints, shorter trials</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Hematology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~13%</td><td className="py-2.5 px-4 text-slate-500">Measurable blood markers, accelerated pathways</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Ophthalmology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~11%</td><td className="py-2.5 px-4 text-slate-500">Functional endpoints, local delivery challenges</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Dermatology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~13%</td><td className="py-2.5 px-4 text-slate-500">Visible endpoints, topical delivery advantages</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Gastroenterology</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~10%</td><td className="py-2.5 px-4 text-slate-500">Heterogeneous patient populations</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Women&apos;s Health</td><td className="py-2.5 px-4 text-center font-medium text-slate-900">~12%</td><td className="py-2.5 px-4 text-slate-500">Underserved indications, regulatory tailwinds</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Source: Ambrosia Ventures engine calibration, {DEAL_STATS.TOTAL_DEALS} transactions analyzed as of April 2026. Rates represent all-comers averages; individual asset PoS varies by modality, biomarker selection, and sponsor experience.
            </p>

            {/* Inline CTA after PoS section */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">Run rNPV analysis on your asset</p>
              <p className="text-slate-600 mb-4">
                Our engine covers 12 therapeutic areas and 23+ modalities, calibrated against {DEAL_STATS.TOTAL_DEALS} real transactions. Get probability-weighted valuations, Monte Carlo distributions, and deal benchmarks in seconds.
              </p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors text-sm">
                Start rNPV Analysis
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>

            {/* How our rNPV engine works */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="how-our-engine-works">
              How Our rNPV Engine Works
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Unlike spreadsheet-based rNPV models that require hours of manual setup, our engine processes 10 sequential analytical models in under 400ms to produce institutional-grade valuations:
            </p>

            <ol className="list-decimal pl-6 space-y-2 text-slate-600 my-4">
              <li><strong>Market sizing</strong> -- epidemiology-driven TAM/SAM/SOM with S-curve adoption modeling</li>
              <li><strong>rNPV calculation</strong> -- phase-specific PoS rates calibrated by TA, modality, and biomarker status</li>
              <li><strong>Monte Carlo simulation</strong> -- 10,000 iterations sampling peak sales, PoS, pricing, and timeline distributions</li>
              <li><strong>Scenario planning</strong> -- base, upside, and downside cases with probability weighting</li>
              <li><strong>Deal waterfall</strong> -- upfront, milestones, and royalty allocation benchmarked against comparable transactions</li>
              <li><strong>Competitive dynamics</strong> -- pipeline analysis and market share impact modeling</li>
              <li><strong>Real options valuation</strong> -- CRR lattice model capturing indication expansion and strategic optionality</li>
              <li><strong>Lifecycle extensions</strong> -- formulation changes, new indications, and pediatric exclusivity</li>
              <li><strong>Buyer-specific valuation</strong> -- adjusted for acquirer synergies, portfolio fit, and strategic premium</li>
              <li><strong>Tornado sensitivity</strong> -- identifies the 2-3 variables driving 80%+ of valuation variance</li>
            </ol>

            <p className="text-slate-600 leading-relaxed">
              Each model feeds into the next, producing a comprehensive valuation package that would take an analyst 2-3 days to build manually. The output includes downloadable PDF reports and Excel models for board presentations and partner discussions.
            </p>

            {/* rNPV vs DCF vs Comparable Transactions */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="rnpv-vs-dcf-vs-comps">
              rNPV vs. DCF vs. Comparable Transactions
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Each valuation method has a role in biopharma. The choice depends on the asset&apos;s stage, data availability, and the decision context.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Best For</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Limitations</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">When to Use</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">rNPV</td>
                    <td className="py-2.5 px-4 text-slate-600">Development-stage assets with quantifiable clinical risk</td>
                    <td className="py-2.5 px-4 text-slate-500">Requires PoS estimates; single point output without Monte Carlo</td>
                    <td className="py-2.5 px-4 text-slate-600">Licensing deals, Phase 1-3 assets, portfolio prioritization</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">Standard DCF</td>
                    <td className="py-2.5 px-4 text-slate-600">Approved products with visible revenue streams</td>
                    <td className="py-2.5 px-4 text-slate-500">Overstates pre-approval assets by ignoring clinical attrition</td>
                    <td className="py-2.5 px-4 text-slate-600">Commercial-stage M&A, approved product acquisitions</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Comparable Transactions</td>
                    <td className="py-2.5 px-4 text-slate-600">Quick benchmarking and sanity-checking modeled values</td>
                    <td className="py-2.5 px-4 text-slate-500">Depends on finding truly comparable deals; backward-looking</td>
                    <td className="py-2.5 px-4 text-slate-600">Deal term validation, board-level framing, negotiation anchoring</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Best practice is to triangulate: use rNPV as the primary valuation framework, validate against comparable transactions from our <Link href="/benchmarks" className="text-teal-600 font-medium hover:text-teal-700">benchmark database</Link> of {DEAL_STATS.TOTAL_DEALS} deals, and supplement with DCF for commercial-stage assets. Our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link> produces all three perspectives in a single analysis.
            </p>

            {/* Section 3 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="cash-flow-model">
              Building the Cash Flow Model
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The cash flow model is the revenue and cost engine that rNPV then adjusts for risk. Building a robust model requires estimates across four key dimensions:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Peak sales estimation:</strong> Start with the addressable patient population, apply diagnosis rates, treatment rates, and expected market share to derive patient volume. Multiply by annual cost of therapy to project revenue. Peak sales are typically reached 4-7 years after launch, with the ramp profile depending on indication and competitive dynamics.</li>
              <li><strong>Revenue curve (S-curve modeling):</strong> Drug launches follow a characteristic S-curve: slow initial uptake as physicians gain experience, rapid adoption phase, plateau at peak sales, and gradual decline after loss of exclusivity. The shape parameters vary by therapeutic area and modality.</li>
              <li><strong>Development costs:</strong> Remaining development costs from the asset&apos;s current phase through approval must be modeled as negative cash flows. Phase 3 oncology trials can cost $100M-$500M+, while rare disease Phase 3 programs may be $20M-$80M. Include regulatory submission costs, post-marketing commitments, and manufacturing scale-up.</li>
              <li><strong>COGS and commercialization:</strong> Cost of goods sold (typically 5-15% for biologics, 15-30% for small molecules) and commercial spending (sales force, marketing, medical affairs) reduce net cash flows. Commercial infrastructure costs are front-loaded in the first 2-3 years post-launch.</li>
              <li><strong>Terminal value and generic erosion:</strong> After patent expiry, model revenue decline of 70-90% for small molecules (rapid generic erosion) and 30-50% for biologics (slower biosimilar uptake). The terminal period typically spans 2-5 years of declining revenue.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">Solidus</Link> automates much of this modeling with pre-built assumptions by therapeutic area and modality, while allowing you to override any parameter for custom analysis.
            </p>

            {/* Section 4 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="monte-carlo">
              Monte Carlo Enhancement
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Basic rNPV produces a single expected value, which can create false precision for inherently uncertain drug development outcomes. Monte Carlo simulation addresses this by running thousands of randomized scenarios, generating a probability distribution of outcomes rather than a point estimate:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Input distributions:</strong> Instead of point estimates, each model input is defined as a probability distribution. Peak sales might follow a log-normal distribution with median $800M and standard deviation $400M. PoS might be modeled as a beta distribution with 95% confidence interval of 25-45%.</li>
              <li><strong>Correlated variables:</strong> Monte Carlo allows modeling of correlations between inputs. Peak sales and market share are often positively correlated (a highly effective drug captures both larger share and higher pricing). Timeline delays may correlate with lower PoS if caused by safety signals.</li>
              <li><strong>Scenario generation:</strong> The simulation randomly samples from each input distribution and calculates rNPV for each scenario. With 10,000+ iterations, the output converges to a stable probability distribution of deal values.</li>
              <li><strong>Output interpretation:</strong> The resulting distribution shows the 10th percentile (downside case), 25th percentile (conservative), 50th percentile (median expected value), 75th percentile (upside), and 90th percentile (bull case). This range directly informs negotiation strategy and risk management.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Monte Carlo is particularly valuable for complex assets with multiple sources of uncertainty, platform programs with indication expansion potential, and situations where the difference between the upside and downside case spans an order of magnitude.
            </p>

            {/* Section 5 */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="interpreting-results">
              Interpreting Results
            </h2>

            <p className="text-slate-600 leading-relaxed">
              An rNPV number is only useful if properly interpreted and contextualized. Key principles for translating model output into actionable decisions:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>rNPV vs. deal price:</strong> An asset&apos;s rNPV does not directly equal what a licensee should pay. The deal price should reflect the value split between licensor and licensee, typically 20-40% to the licensor and 60-80% to the licensee. Competitive dynamics, strategic premium, and alternative options affect the split.</li>
              <li><strong>Sensitivity analysis:</strong> Identify which inputs drive the most variation in rNPV output. Typically, peak sales and PoS dominate. If rNPV is highly sensitive to a single assumption (e.g., competitive entry timing), that variable deserves additional diligence and scenario planning.</li>
              <li><strong>Comparison across assets:</strong> Use rNPV to rank and compare assets within a portfolio or across potential licensing opportunities. Normalize by investment required (rNPV/investment = risk-adjusted return on investment) for capital allocation decisions.</li>
              <li><strong>Communication with stakeholders:</strong> Present rNPV results as ranges, not point estimates. Board-level presentations should show the 25th-75th percentile range with key sensitivity drivers, not a single &quot;most likely&quot; outcome.</li>
              <li><strong>Model limitations:</strong> rNPV assumes rational markets and historical PoS rates. Black swan events (pandemic-driven demand, unexpected safety signals, competitor withdrawal) are not captured. Supplement rNPV with qualitative strategic assessment for a complete picture.</li>
            </ul>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Run Your rNPV Analysis
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Our calculator applies rNPV methodology with built-in PoS rates across 18 therapeutic areas, generating probability-weighted deal benchmarks instantly.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
            >
              Open the Calculator
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What is the difference between NPV and rNPV in biotech valuation?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Standard NPV discounts cash flows by time only, assuming the drug reaches market. <Link href="/glossary/risk-adjusted-npv" className="text-teal-600 hover:text-teal-700">Risk-adjusted NPV (rNPV)</Link> additionally applies probability-of-success adjustments at each development stage, reflecting the substantial clinical attrition risk. For a Phase 1 oncology asset with ~8% cumulative PoS, NPV could overvalue the asset by 10-12x vs. rNPV.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What discount rate should I use for rNPV biotech valuation?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  The discount rate for rNPV typically ranges from 8-12%. Since rNPV already accounts for clinical attrition through PoS adjustments, the discount rate should NOT double-count development risk. Use 8-9% for large-cap pharma, 10-11% for mid-cap biotechs, and 11-12% for small-cap or pre-revenue companies. See our <Link href="/methodology" className="text-teal-600 hover:text-teal-700">methodology</Link> for details.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How does Monte Carlo simulation improve on basic rNPV?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Basic rNPV produces a single expected value using point estimates. Monte Carlo runs thousands of scenarios varying multiple inputs simultaneously (PoS, peak sales, pricing, timeline) to generate a full probability distribution with confidence intervals. This is especially valuable for complex assets with multiple indications or high uncertainty. Our <Link href="/calculator" className="text-teal-600 hover:text-teal-700">calculator</Link> provides these ranges automatically.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Related Resources */}
        <section className="py-16 px-4 bg-slate-50 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Related Resources
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: '/calculator', title: 'Solidus', desc: 'Run rNPV-based deal benchmarks' },
                { href: '/methodology', title: 'Methodology', desc: 'PoS rates and model assumptions' },
                { href: '/glossary/risk-adjusted-npv', title: 'rNPV Glossary', desc: 'Definition and industry context' },
              ].map((resource) => (
                <Link
                  key={resource.href}
                  href={resource.href}
                  className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-teal-300 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors mb-2">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-slate-500">{resource.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
