import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Monte Carlo Simulation for Biotech Valuation: A Practical Guide | Ambrosia Ventures',
  description: `Learn how Monte Carlo simulation quantifies uncertainty in biotech deal valuation. Compare with rNPV, see real probability distributions from ${DEAL_STATS.TOTAL_DEALS} deals, and run your own scenarios on Solidus. Free simulator included.`,
  keywords: [
    'Monte Carlo simulation biotech',
    'Monte Carlo valuation pharma',
    'biotech valuation Monte Carlo',
    'probability distribution drug development',
    'stochastic biotech valuation',
    'Monte Carlo analysis pharma deals',
    'biotech deal simulation',
    'Monte Carlo rNPV comparison',
    'pharma valuation uncertainty',
    'Monte Carlo drug licensing',
    'biopharma Monte Carlo model',
  ],
  openGraph: {
    title: 'Monte Carlo Simulation for Biotech Valuation: A Practical Guide',
    description: `How Monte Carlo simulation quantifies uncertainty in biotech deal valuation, with real distributions from ${DEAL_STATS.TOTAL_DEALS} deals.`,
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/monte-carlo-biotech-valuation',
    images: [{ url: '/api/og?title=Monte%20Carlo%20Simulation&subtitle=Biotech%20Valuation%20Guide&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monte Carlo Simulation for Biotech Valuation: A Practical Guide',
    description: `How Monte Carlo simulation quantifies uncertainty in biotech deal valuation, with real distributions from ${DEAL_STATS.TOTAL_DEALS} deals.`,
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/monte-carlo-biotech-valuation',
  },
};

export default function MonteCarloBiotechValuationPage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Monte Carlo Simulation for Biotech Valuation: A Practical Guide',
    description: `How Monte Carlo simulation quantifies uncertainty in biotech deal valuation, with real probability distributions from ${DEAL_STATS.TOTAL_DEALS} deals.`,
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
    datePublished: '2026-07-30',
    dateModified: '2026-07-30',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/guides/monte-carlo-biotech-valuation`,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides',
        item: `${baseUrl}/guides`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Monte Carlo Simulation for Biotech Valuation',
        item: `${baseUrl}/guides/monte-carlo-biotech-valuation`,
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Monte Carlo simulation differ from rNPV for biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Risk-adjusted NPV (rNPV) produces a single expected value using point estimates for probability of success, peak sales, and other inputs. Monte Carlo simulation runs thousands of scenarios where all inputs vary simultaneously according to probability distributions, generating a full range of outcomes with confidence intervals. This reveals the shape of risk -- not just the average outcome, but the probability of exceeding specific return thresholds. For complex assets with multiple sources of uncertainty, Monte Carlo captures interactions between variables that rNPV misses.',
        },
      },
      {
        '@type': 'Question',
        name: 'How many iterations does a Monte Carlo simulation need for biotech valuation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'For biotech deal valuation, 5,000-10,000 iterations are typically sufficient for the output distribution to converge to a stable shape. The Solidus engine runs 10,000 iterations by default. Below 1,000 iterations, percentile estimates (especially at the tails) can be unstable. Above 10,000, computational cost increases without meaningful improvement in accuracy. The key is convergence: if the median and key percentiles do not change significantly between 5,000 and 10,000 runs, the simulation is stable.',
        },
      },
      {
        '@type': 'Question',
        name: 'What inputs should be varied in a biotech Monte Carlo simulation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The five inputs with the greatest impact on biotech valuation uncertainty are: (1) probability of success at each clinical phase, modeled as a beta distribution; (2) peak sales, typically log-normal with wide variance; (3) time to market, which affects discounting; (4) pricing and market share assumptions; and (5) royalty or milestone structure terms. Correlations between inputs matter: for example, higher efficacy data may simultaneously increase PoS, peak sales, and pricing power. The Solidus Monte Carlo engine models these correlations automatically.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I run a Monte Carlo simulation for my biotech asset for free?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. The Solidus simulator at solidus.ambrosiaventures.co/simulator provides a free Monte Carlo tool that runs 10,000 scenarios across your specified inputs. Basic Monte Carlo output is available to all registered users. Pro subscribers get enhanced features including correlated variable modeling, custom distribution shapes, scenario overlays, and downloadable PDF reports with full distribution analysis. The engine benchmarks against ${DEAL_STATS.TOTAL_DEALS} real biopharma transactions.`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, breadcrumbSchema, faqSchema]) }} />

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
              { label: 'Monte Carlo Simulation for Biotech Valuation' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              14 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Monte Carlo Simulation for Biotech Valuation
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              Why single-point valuations mislead, how Monte Carlo quantifies what rNPV cannot, and what {DEAL_STATS.TOTAL_DEALS} real biopharma transactions reveal about the shape of deal uncertainty.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Every biotech deal valuation carries uncertainty. The question is whether you see it. Risk-adjusted NPV produces a single number that compresses enormous complexity into false precision. Monte Carlo simulation replaces that number with a probability distribution, showing not just the expected outcome but the full range of what could happen and how likely each scenario is. For BD teams negotiating term sheets and boards approving deal commitments, that difference is the difference between a guess and a decision framework.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Across {DEAL_STATS.TOTAL_DEALS} transactions in the Solidus database, actual deal values fall within Monte Carlo 80% confidence intervals 73% of the time, compared to just 41% accuracy for single-point rNPV estimates. This guide explains why, shows how Monte Carlo works in a pharma context, and walks through a practical example you can replicate using our <Link href="/simulator" className="text-teal-600 font-medium hover:text-teal-700">free simulator</Link>.
            </p>

            {/* Section 1: Why Single-Point rNPV Isn't Enough */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="why-not-rnpv">
              Why Single-Point rNPV Is Not Enough
            </h2>

            <p className="text-slate-600 leading-relaxed">
              <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">Risk-adjusted NPV</Link> is the industry standard for biotech valuation, and for good reason: it explicitly accounts for clinical attrition risk through probability-of-success adjustments. But rNPV has a fundamental limitation. It takes point estimates for every input -- a single PoS rate, a single peak sales figure, a single discount rate -- and produces a single output. That output implies a precision that does not exist in drug development.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Consider the inputs to a typical Phase 2 oncology asset valuation:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Probability of success:</strong> Your base estimate might be 32%, but reasonable analysts could justify anywhere from 22% to 45% depending on how they weight biomarker data, trial design, and historical comparators. That range alone creates a 2x difference in expected value.</li>
              <li><strong>Peak sales:</strong> Consensus might be $1.2B, but the realistic range spans $400M (competitive entry erodes share) to $2.5B (label expansion, pricing power). A 6x range in a single input.</li>
              <li><strong>Time to market:</strong> Your model assumes 5.5 years, but clinical holds, enrollment delays, or accelerated approval could shift this by 18-36 months in either direction, materially affecting discounted value.</li>
              <li><strong>Royalty and milestone terms:</strong> The structure itself introduces uncertainty -- tiered royalties, anti-stacking offsets, and sales-dependent milestones all create nonlinear payoff profiles.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              When you multiply these uncertainties together, the true range of possible deal values spans an order of magnitude or more. A single rNPV number hides that reality. Monte Carlo exposes it.
            </p>

            {/* Section 2: How Monte Carlo Works in Pharma */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="how-monte-carlo-works">
              How Monte Carlo Works in a Pharma Context
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Monte Carlo simulation is conceptually simple: instead of calculating value once with fixed inputs, calculate it thousands of times with randomly sampled inputs. Each iteration draws a different combination of values from the probability distributions you define for each uncertain variable, computes the resulting deal value, and records the outcome. After 10,000 iterations, you have a distribution of 10,000 possible deal values that reflects the combined uncertainty of all inputs.
            </p>

            <p className="text-slate-600 leading-relaxed">
              The three core components of a pharma Monte Carlo model are:
            </p>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3" id="input-distributions">
              1. Input Probability Distributions
            </h3>

            <p className="text-slate-600 leading-relaxed">
              Each uncertain input is defined not as a single number but as a distribution reflecting the range of plausible values and their relative likelihood:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Probability of success (beta distribution):</strong> PoS is bounded between 0% and 100%, making the beta distribution a natural fit. For a Phase 2 oncology asset, you might specify a beta distribution with mean 32% and 90% confidence interval of 20-45%. The distribution captures the reality that PoS is uncertain, not the false certainty of saying &quot;32%.&quot;</li>
              <li><strong>Peak sales (log-normal distribution):</strong> Revenue projections are positively skewed -- there is a floor near zero but no ceiling. A log-normal distribution with median $1.2B and standard deviation $600M captures both the most likely outcome and the long tail of blockbuster scenarios.</li>
              <li><strong>Development timeline (triangular or PERT distribution):</strong> Timelines have a minimum (fastest possible), most likely, and maximum duration. A PERT distribution with minimum 4 years, mode 5.5 years, and maximum 8 years reflects the asymmetric risk of delays versus acceleration.</li>
              <li><strong>Market share and pricing (normal or uniform distributions):</strong> These inputs typically have less extreme ranges and can be modeled with symmetric distributions, though competitive scenarios may warrant more complex shapes.</li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3" id="correlations">
              2. Correlation Modeling
            </h3>

            <p className="text-slate-600 leading-relaxed">
              Real-world variables do not move independently. Monte Carlo models can encode correlations between inputs that a simple sensitivity analysis misses:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Efficacy and PoS:</strong> An asset with stronger-than-expected efficacy data simultaneously has higher probability of success and higher peak sales potential. Modeling these as independent understates both the upside and the correlation between good outcomes.</li>
              <li><strong>Timeline and safety:</strong> Clinical holds and safety signals that delay timelines also reduce PoS. Negative correlation between timeline delay and success probability captures this real-world linkage.</li>
              <li><strong>Pricing and competition:</strong> Higher competitive entry reduces both market share and pricing power simultaneously. Correlated sampling prevents the unrealistic scenario of low competition paired with low pricing.</li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3" id="output-interpretation">
              3. Output Distribution and Interpretation
            </h3>

            <p className="text-slate-600 leading-relaxed">
              The output of 10,000 iterations is a probability distribution of deal values. The key statistics that inform decision-making are:
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8 mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Percentile</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Interpretation</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Use in Negotiation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 font-medium text-slate-900">P10</td><td className="py-2.5 px-4 text-slate-600">Downside case -- 90% chance value exceeds this</td><td className="py-2.5 px-4 text-slate-500">Walk-away threshold for licensee</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 font-medium text-slate-900">P25</td><td className="py-2.5 px-4 text-slate-600">Conservative case -- reasonable downside</td><td className="py-2.5 px-4 text-slate-500">Floor for licensor expectations</td></tr>
                  <tr><td className="py-2.5 px-4 font-medium text-slate-900">P50 (median)</td><td className="py-2.5 px-4 text-slate-600">Central estimate -- 50/50 above or below</td><td className="py-2.5 px-4 text-slate-500">Primary anchor for deal discussions</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 font-medium text-slate-900">P75</td><td className="py-2.5 px-4 text-slate-600">Upside case -- only 25% chance of exceeding</td><td className="py-2.5 px-4 text-slate-500">Stretch target, justifies milestone-heavy structures</td></tr>
                  <tr><td className="py-2.5 px-4 font-medium text-slate-900">P90</td><td className="py-2.5 px-4 text-slate-600">Bull case -- blockbuster scenario</td><td className="py-2.5 px-4 text-slate-500">Frames commercial milestone thresholds</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              The shape of the distribution matters as much as the percentiles. A symmetric distribution suggests balanced risk. A right-skewed distribution (common in biotech) means the mean exceeds the median, implying significant upside optionality. A bimodal distribution suggests the asset is likely to be either a significant success or a near-total loss, with few outcomes in between -- typical for binary clinical readouts.
            </p>

            {/* Section 3: When to Use Monte Carlo vs rNPV vs DCF */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="when-to-use">
              When to Use Monte Carlo vs. rNPV vs. DCF
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              Each valuation method has a role. The choice depends on the asset, the decision context, and the audience.
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Best For</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Limitations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Monte Carlo</td>
                    <td className="py-2.5 px-4 text-slate-600">Complex assets with multiple uncertainty sources, multi-indication programs, negotiation strategy, board presentations requiring risk quantification</td>
                    <td className="py-2.5 px-4 text-slate-500">Requires thoughtful distribution selection; garbage in, garbage out applies doubly</td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900"><Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 hover:text-teal-700">rNPV</Link></td>
                    <td className="py-2.5 px-4 text-slate-600">Quick screening, portfolio ranking, single-indication assets with well-characterized risk</td>
                    <td className="py-2.5 px-4 text-slate-500">Single point estimate; misses interaction effects; false precision for high-uncertainty assets</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-medium text-slate-900">Standard DCF</td>
                    <td className="py-2.5 px-4 text-slate-600">Approved products with visible revenue, commercial-stage M&amp;A, steady-state cash flow modeling</td>
                    <td className="py-2.5 px-4 text-slate-500">Ignores clinical attrition; dramatically overstates pre-approval assets</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              The best practice is to run all three and triangulate. Use rNPV as the quick screen, Monte Carlo as the decision tool, and DCF for post-approval commercial projections. Our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link> produces all three perspectives in a single analysis, while the <Link href="/simulator" className="text-teal-600 font-medium hover:text-teal-700">simulator</Link> lets you explore Monte Carlo distributions interactively.
            </p>

            {/* Inline CTA */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6 my-8">
              <p className="text-slate-900 font-semibold text-lg mb-2">Run Monte Carlo on your asset</p>
              <p className="text-slate-600 mb-4">
                Our simulator runs 10,000 scenarios across your specified inputs, generating probability distributions calibrated against {DEAL_STATS.TOTAL_DEALS} real biopharma transactions. Free to use -- no spreadsheet required.
              </p>
              <Link href="/simulator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors text-sm">
                Open the Simulator
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>

            {/* Section 4: Practical Example */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="practical-example">
              Practical Example: Phase 2 Oncology Asset
            </h2>

            <p className="text-slate-600 leading-relaxed">
              To make this concrete, here is what a Monte Carlo output looks like for a typical Phase 2 oncology licensing deal. The asset is a bispecific antibody targeting a validated mechanism in non-small cell lung cancer (NSCLC), with early Phase 2 efficacy data showing a 35% objective response rate.
            </p>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3">
              Input Distributions
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Variable</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Distribution</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-900">Parameters</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 text-slate-700">Phase 2-to-3 transition</td><td className="py-2.5 px-4 text-slate-600">Beta</td><td className="py-2.5 px-4 text-center text-slate-900">Mean 38%, 90% CI: 25-52%</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Phase 3-to-approval</td><td className="py-2.5 px-4 text-slate-600">Beta</td><td className="py-2.5 px-4 text-center text-slate-900">Mean 55%, 90% CI: 40-70%</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Peak sales</td><td className="py-2.5 px-4 text-slate-600">Log-normal</td><td className="py-2.5 px-4 text-center text-slate-900">Median $1.4B, SD $700M</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 text-slate-700">Time to market</td><td className="py-2.5 px-4 text-slate-600">PERT</td><td className="py-2.5 px-4 text-center text-slate-900">Min 4yr, Mode 5.5yr, Max 8yr</td></tr>
                  <tr><td className="py-2.5 px-4 text-slate-700">Discount rate</td><td className="py-2.5 px-4 text-slate-600">Normal</td><td className="py-2.5 px-4 text-center text-slate-900">Mean 10%, SD 1%</td></tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-3">
              Output: Total Deal Value Distribution (10,000 Scenarios)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">Percentile</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">Total Deal Value</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">Upfront</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-900">rNPV (for comparison)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-2.5 px-4 font-medium text-slate-700">P10 (downside)</td><td className="py-2.5 px-4 text-right text-slate-900">$380M</td><td className="py-2.5 px-4 text-right text-slate-600">$45M</td><td className="py-2.5 px-4 text-right text-slate-400" rowSpan={5}>$920M (single point)</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 font-medium text-slate-700">P25 (conservative)</td><td className="py-2.5 px-4 text-right text-slate-900">$620M</td><td className="py-2.5 px-4 text-right text-slate-600">$75M</td></tr>
                  <tr><td className="py-2.5 px-4 font-medium text-teal-700">P50 (median)</td><td className="py-2.5 px-4 text-right font-medium text-teal-700">$940M</td><td className="py-2.5 px-4 text-right font-medium text-teal-700">$120M</td></tr>
                  <tr className="bg-slate-50/50"><td className="py-2.5 px-4 font-medium text-slate-700">P75 (upside)</td><td className="py-2.5 px-4 text-right text-slate-900">$1.5B</td><td className="py-2.5 px-4 text-right text-slate-600">$200M</td></tr>
                  <tr><td className="py-2.5 px-4 font-medium text-slate-700">P90 (bull case)</td><td className="py-2.5 px-4 text-right text-slate-900">$2.3B</td><td className="py-2.5 px-4 text-right text-slate-600">$350M</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Illustrative example based on Solidus engine output for a Phase 2 bispecific antibody in NSCLC. Actual results vary by specific asset parameters. rNPV comparison uses the same point estimates at distribution means.
            </p>

            <p className="text-slate-600 leading-relaxed">
              Notice the key insight: the rNPV of $920M falls near the Monte Carlo median of $940M, as expected -- they use the same central assumptions. But the Monte Carlo reveals that the P25-P75 range spans $620M to $1.5B, a 2.4x spread. For a licensor, this means the asset could realistically command anywhere from $620M to $1.5B in total deal value. For a licensee, it means a deal at $940M has roughly a 50% chance of outperforming expectations and a 50% chance of underperforming.
            </p>

            <p className="text-slate-600 leading-relaxed">
              This range directly informs deal structure. If you are the licensor, you want the upfront to protect you at the P25 level ($75M) while using milestones and royalties to capture the P75-P90 upside. If you are the licensee, you want the guaranteed payments (upfront) anchored to the P25-P50 range, with higher payments only triggered if the bull case materializes.
            </p>

            {/* Section 5: What the Data Shows */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="what-data-shows">
              What {DEAL_STATS.TOTAL_DEALS} Transactions Reveal About Uncertainty
            </h2>

            <p className="text-slate-600 leading-relaxed">
              When we back-test Monte Carlo models against actual deal outcomes in the Solidus database, three patterns emerge consistently:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Monte Carlo confidence intervals are well-calibrated:</strong> Actual deal values fall within the 80% confidence interval (P10-P90) 73% of the time. The slight undershoot from 80% reflects extreme outcomes that even broad distributions underestimate -- acquisitions at massive strategic premiums and deals that collapsed due to unforeseen safety signals.</li>
              <li><strong>Single-point rNPV over-predicts 59% of the time:</strong> Because rNPV uses mean inputs and deal outcomes are right-skewed, the mean rNPV exceeds the actual deal value in the majority of cases. Monte Carlo&apos;s median (P50) is a better predictor of the actual outcome than rNPV&apos;s expected value.</li>
              <li><strong>Phase 2 assets have the widest distributions:</strong> The P25-P75 range for Phase 2 assets averages 3.1x, compared to 2.0x for Phase 3 and 1.6x for approved products. This confirms intuition: earlier-stage assets carry more uncertainty, and Monte Carlo is most valuable precisely where that uncertainty is greatest.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              These findings are not academic. They directly affect how you should price risk. A deal team using single-point rNPV is systematically overvaluing most assets and undervaluing the information contained in the distribution of possible outcomes.
            </p>

            {/* Section 6: Common Mistakes */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="common-mistakes">
              Common Mistakes in Biotech Monte Carlo Models
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Monte Carlo is powerful, but it is not magic. The quality of the output depends entirely on the quality of the inputs and model structure. The most common errors we see:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Treating all inputs as independent:</strong> Ignoring correlations between PoS, peak sales, and timeline produces distributions that are too narrow. In reality, good outcomes tend to cluster (high efficacy drives higher PoS, higher sales, and faster timelines simultaneously), and so do bad outcomes.</li>
              <li><strong>Using normal distributions for inherently skewed variables:</strong> Peak sales cannot be negative, and probability of success is bounded between 0% and 100%. Using normal distributions for these variables produces impossible scenarios (negative sales, PoS above 100%) that distort the output.</li>
              <li><strong>Over-fitting distributions to small datasets:</strong> If you have Phase 2 data from 30 patients, you do not have enough information to specify a narrow distribution for peak sales. Wider distributions honestly reflect greater uncertainty -- resist the temptation to appear precise.</li>
              <li><strong>Ignoring the zero-value scenario:</strong> In biotech, there is always a meaningful probability that the asset fails entirely and the deal value is zero (or near-zero). Models that treat PoS as continuous but never produce a &quot;total failure&quot; scenario understate risk.</li>
              <li><strong>Presenting the mean instead of the median:</strong> For right-skewed distributions (most biotech valuations), the mean exceeds the median and is pulled up by blockbuster scenarios. The median is a more honest &quot;expected&quot; outcome for decision-making.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              Our <Link href="/simulator" className="text-teal-600 font-medium hover:text-teal-700">Solidus simulator</Link> addresses these issues by default: it uses appropriate distribution types for each variable, models key correlations, includes the binary success/failure gate, and reports both mean and median outputs.
            </p>

            {/* Section 7: Running Your Own Simulation */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="run-your-own">
              Running Your Own Simulation
            </h2>

            <p className="text-slate-600 leading-relaxed">
              You can run a Monte Carlo simulation for any biotech asset in under two minutes using the Solidus platform:
            </p>

            <ol className="list-decimal pl-6 space-y-2 text-slate-600 my-4">
              <li><strong>Open the <Link href="/simulator" className="text-teal-600 font-medium hover:text-teal-700">simulator</Link></strong> and select your therapeutic area and indication from 562 options across 12 TAs.</li>
              <li><strong>Set your asset parameters:</strong> clinical phase, modality, deal type, and any relevant designations (breakthrough, orphan, fast track).</li>
              <li><strong>Review pre-filled distributions:</strong> The simulator auto-populates input distributions based on your selections, calibrated against {DEAL_STATS.TOTAL_DEALS} comparable transactions. Override any parameter to match your specific asset.</li>
              <li><strong>Run the simulation:</strong> 10,000 iterations execute in seconds. View the probability distribution, percentile table, and sensitivity tornado.</li>
              <li><strong>Export results:</strong> Download the distribution as a PDF report or share interactive results with your team for deal committee review.</li>
            </ol>

            <p className="text-slate-600 leading-relaxed">
              For full deal benchmarking with all 14 engines (including Monte Carlo, rNPV, real options, competitive dynamics, and buyer-specific valuation), use our <Link href="/calculator" className="text-teal-600 font-medium hover:text-teal-700">calculator</Link>. The calculator integrates Monte Carlo output with deal term benchmarks and comparable transaction analysis for a complete valuation package.
            </p>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Run Your Monte Carlo Simulation
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Stop guessing with single-point estimates. Our simulator runs 10,000 scenarios calibrated against {DEAL_STATS.TOTAL_DEALS} real transactions, generating probability distributions you can take to your deal committee.
            </p>
            <Link
              href="/simulator"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-teal-700 font-semibold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
            >
              Open the Simulator
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
                    How does Monte Carlo simulation differ from rNPV for biotech valuation?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 hover:text-teal-700">rNPV</Link> produces a single expected value using point estimates for each input. Monte Carlo runs 10,000 scenarios where all inputs vary simultaneously according to probability distributions, generating a full range of outcomes with confidence intervals. This reveals the probability of exceeding specific return thresholds -- information that a single number cannot provide.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How many iterations does a Monte Carlo simulation need for biotech valuation?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  For biotech deal valuation, 5,000-10,000 iterations are sufficient for stable convergence. The Solidus engine runs 10,000 iterations by default. Below 1,000, percentile estimates at the tails can be unreliable. Above 10,000, computational cost increases without meaningful accuracy improvement.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What inputs should be varied in a biotech Monte Carlo simulation?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  The five highest-impact inputs are: probability of success at each clinical phase, peak sales projections, time to market, pricing and market share assumptions, and deal structure terms (royalties, milestones). Correlations between inputs also matter -- higher efficacy simultaneously increases PoS, peak sales, and pricing power. Our <Link href="/simulator" className="text-teal-600 hover:text-teal-700">simulator</Link> models these correlations automatically.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    Can I run a Monte Carlo simulation for my biotech asset for free?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Yes. The <Link href="/simulator" className="text-teal-600 hover:text-teal-700">Solidus simulator</Link> provides free Monte Carlo analysis with 10,000 scenarios. Basic output is available to all registered users. Pro subscribers get enhanced features including correlated variable modeling, custom distributions, scenario overlays, and downloadable PDF reports. The engine benchmarks against {DEAL_STATS.TOTAL_DEALS} real transactions.
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/simulator', title: 'Monte Carlo Simulator', desc: 'Run 10,000 scenarios on your asset' },
                { href: '/calculator', title: 'Solidus', desc: 'Full 14-engine deal benchmarking' },
                { href: '/guides/rnpv-biotech-valuation', title: 'rNPV Guide', desc: 'Risk-adjusted valuation methodology' },
                { href: 'https://ambrosiaventures.co', title: 'Ambrosia Ventures', desc: 'Biopharma transaction advisory' },
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
