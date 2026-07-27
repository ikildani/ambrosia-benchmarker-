import { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { DEAL_STATS } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Solidus: Benchmark Upfronts, Milestones & Royalties | Ambrosia Ventures',
  description: 'Free life sciences deal calculator benchmarking tool. Model upfronts, milestones, royalties, rNPV, and Monte Carlo analysis across 12 therapeutic areas and 23+ modalities.',
  keywords: [
    'life sciences deal calculator',
    'biotech deal calculator',
    'pharma deal calculator',
    'drug licensing calculator',
    'biopharma deal benchmarking tool',
    'pharma deal valuation tool',
    'biotech licensing calculator',
    'drug deal benchmark calculator',
    'life sciences deal modeling',
    'pharma transaction calculator',
  ],
  openGraph: {
    title: 'Solidus: Benchmark Upfronts, Milestones & Royalties',
    description: 'Model upfronts, milestones, royalties, rNPV, and Monte Carlo analysis across 12 therapeutic areas and 23+ modalities.',
    type: 'article',
    url: 'https://solidus.ambrosiaventures.co/guides/life-sciences-deal-calculator-guide',
    images: [{ url: '/api/og?title=Life%20Sciences%20Deal%20Calculator&subtitle=Benchmark%20Tool%20Guide&type=landing', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solidus: Benchmark Upfronts, Milestones & Royalties',
    description: 'Model deal terms, rNPV, and Monte Carlo analysis across 12 therapeutic areas.',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/guides/life-sciences-deal-calculator-guide',
  },
};

export default function LifeSciencesDealCalculatorGuidePage() {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Solidus: Benchmark Upfronts, Milestones & Royalties',
    description: 'Complete guide to Solidus covering all 14 engines, step-by-step usage, and methodology.',
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
    datePublished: '2026-04-06',
    dateModified: '2026-04-06',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/guides/life-sciences-deal-calculator-guide`,
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is the life sciences deal calculator free to use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The calculator requires a free account to run deal benchmarks. Basic deal term benchmarking is available to all registered users. Advanced engines including Monte Carlo simulation, real options valuation, competitive dynamics, and buyer-specific valuation require a Pro subscription ($299/month or $199/month billed annually). All users receive instant deal term comparisons against ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
        },
      },
      {
        '@type': 'Question',
        name: 'How many deals does the calculator benchmark against?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The calculator benchmarks against ${DEAL_STATS.TOTAL_DEALS} disclosed biopharma transactions spanning 12 therapeutic areas, 23+ modalities, and all clinical phases from discovery through approved products. The dataset is continuously updated through automated ingestion from SEC EDGAR filings, press releases, and regulatory documents. This is the largest proprietary deal benchmarking dataset available for life sciences professionals.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What therapeutic areas does the deal calculator cover?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The calculator covers 12 therapeutic areas with 562 specific indications: oncology (77 indications), immunology (64), neurology (59), rare disease (50), metabolic (50), hematology (43), infectious disease (40), dermatology (40), gastroenterology (39), women\'s health (35), cardiovascular (33), and ophthalmology (32). Each therapeutic area has calibrated benchmarks based on real deal data.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is the deal calculator different from a DCF model or spreadsheet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Unlike a static DCF spreadsheet, the deal calculator combines 14 specialized engines: deal term benchmarking, rNPV, Monte Carlo simulation, tornado sensitivity analysis, partner matching (850+ companies), competitive landscape, market sizing, Pharma Intent Score, deal waterfall, scenario comparison, real options (CRR lattice), competitive dynamics, lifecycle extensions, and buyer-specific valuation. It benchmarks against ${DEAL_STATS.TOTAL_DEALS} real transactions rather than relying on assumptions, and generates institutional-quality PDF reports.`,
        },
      },
    ],
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Solidus',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${baseUrl}/calculator`,
    description: `Life sciences deal benchmarking tool with 14 calculation engines, ${DEAL_STATS.TOTAL_DEALS} comparable transactions, and institutional-quality reporting.`,
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free account with basic deal benchmarking',
      },
      {
        '@type': 'Offer',
        price: '299',
        priceCurrency: 'USD',
        description: 'Pro subscription with all 14 engines',
        billingIncrement: 'P1M',
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, faqSchema, softwareSchema]) }} />

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
              { label: 'Solidus Guide' },
            ]} />

            <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 text-sm font-medium rounded-full mb-4">
              10 min read
            </span>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Solidus
            </h1>

            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              Powered by {DEAL_STATS.TOTAL_DEALS} real biopharma transactions. Benchmark upfronts, milestones, royalties, rNPV, and Monte Carlo analysis across 12 therapeutic areas and 562 indications.
            </p>
          </div>
        </header>

        {/* Article Content */}
        <article className="max-w-3xl mx-auto px-4 py-12">
          <div className="prose prose-slate prose-lg max-w-none">
            <p className="text-xl text-slate-700 leading-relaxed">
              Every biopharma deal negotiation starts with the same question: what are fair terms? Business development teams spend weeks assembling comparable transactions, building bespoke models, and debating assumptions with finance. Solidus compresses that process into seconds, delivering institutional-quality benchmarks and valuations backed by the largest proprietary dataset of disclosed biopharma transactions available.
            </p>

            <p className="text-slate-600 leading-relaxed">
              This guide explains what the calculator does, how to use it, what powers it under the hood, and who it is built for. Whether you are a BD lead preparing a term sheet, a CFO validating a deal committee memo, or an investor sizing an opportunity, this page will help you get the most from the tool.
            </p>

            {/* Section 1: What the Calculator Does */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="what-it-does">
              What the Calculator Does
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The calculator is not a single tool but a suite of 14 specialized engines, each addressing a different dimension of biopharma deal analysis. Together, they provide a 360-degree view of any transaction:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Deal Terms Engine:</strong> Benchmarks upfront payments, milestone structures, and royalty rates against comparable transactions filtered by phase, modality, therapeutic area, and deal type.</li>
              <li><strong>rNPV Engine:</strong> Calculates <Link href="/guides/rnpv-biotech-valuation" className="text-teal-600 font-medium hover:text-teal-700">risk-adjusted net present value</Link> using calibrated probability-of-success rates across all clinical phases and therapeutic areas.</li>
              <li><strong>Monte Carlo Engine:</strong> Runs 10,000 randomized scenarios to generate probability distributions and confidence intervals, replacing false precision with actionable ranges.</li>
              <li><strong>Tornado Sensitivity Engine:</strong> Identifies which variables drive the most variation in deal value, focusing diligence and negotiation strategy on what matters most.</li>
              <li><strong>Partner Matching Engine:</strong> Scores 850+ pharma and biotech companies on strategic fit, pipeline gaps, financial capacity, and historical deal preferences.</li>
              <li><strong>Competitive Landscape Engine:</strong> Maps competing programs by phase, mechanism, and timeline to contextualize competitive risk and differentiation.</li>
              <li><strong>Market Sizing Engine:</strong> Projects addressable market size by indication, patient population, pricing assumptions, and market share scenarios.</li>
              <li><strong>Pharma Intent Score:</strong> A proprietary 10-factor predictive model scoring buyer interest based on pipeline gaps, M&amp;A activity, therapeutic focus, financial signals, and press/research signals.</li>
              <li><strong>Deal Waterfall Engine:</strong> Visualizes how value flows from total deal value through milestones, royalties, and exit scenarios over the deal lifecycle.</li>
              <li><strong>Scenario Comparison Engine:</strong> Side-by-side comparison of multiple deal structures (licensing vs. acquisition vs. co-development) to optimize structure selection.</li>
              <li><strong>Real Options Engine:</strong> CRR lattice-based valuation capturing the option value of staged investment decisions, particularly relevant for platform assets and indication expansion.</li>
              <li><strong>Competitive Dynamics Engine:</strong> Models how competitor entry, withdrawal, and data readouts impact your asset&apos;s value over time.</li>
              <li><strong>Lifecycle Extensions Engine:</strong> Projects value from line extensions, geographic expansion, formulation changes, and pediatric exclusivity.</li>
              <li><strong>Buyer-Specific Valuation Engine:</strong> Customizes valuation for specific potential acquirers based on their cost of capital, commercial infrastructure, and strategic premium.</li>
            </ul>

            {/* Section 2: Step-by-Step */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="how-to-use">
              Step-by-Step: How to Run a Deal Benchmark
            </h2>

            <p className="text-slate-600 leading-relaxed">
              Running a benchmark takes under two minutes. Here is the process from start to finish:
            </p>

            <ul className="list-disc pl-6 space-y-3 text-slate-600">
              <li><strong>Step 1 — Select your therapeutic area:</strong> Choose from 12 therapeutic areas (oncology, neurology, immunology, rare disease, metabolic, cardiovascular, infectious disease, ophthalmology, hematology, dermatology, gastroenterology, women&apos;s health). Each TA loads calibrated benchmarks specific to that space.</li>
              <li><strong>Step 2 — Choose your indication:</strong> Select from 562 specific indications, each mapped to modality-specific multipliers and prevalence data. The calculator auto-populates market sizing inputs based on your selection.</li>
              <li><strong>Step 3 — Set your asset parameters:</strong> Specify clinical phase, modality (small molecule, antibody, ADC, cell therapy, gene therapy, etc.), deal type (licensing, acquisition, co-development, option, collaboration), and any relevant designations (breakthrough, orphan, fast track).</li>
              <li><strong>Step 4 — Review and adjust inputs:</strong> The calculator pre-fills all valuation inputs based on your selections. Override any parameter to match your specific asset: peak sales estimates, development timeline, probability of success, discount rate, and commercialization assumptions.</li>
              <li><strong>Step 5 — Generate results:</strong> Click calculate to run all engines simultaneously. Results appear in seconds with deal term benchmarks, rNPV, Monte Carlo distributions, sensitivity analysis, partner matches, and competitive landscape.</li>
            </ul>

            {/* Mid-article CTA */}
            <div className="my-10 p-6 bg-gradient-to-r from-slate-50 to-teal-50 rounded-xl border border-teal-100">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to benchmark your deal?</h3>
              <p className="text-slate-600 mb-4">Create a free account and run your first deal benchmark in under 2 minutes.</p>
              <Link href="/calculator" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors">
                Open the Calculator
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Section 3: What You Get */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="what-you-get">
              What You Get
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The calculator generates a comprehensive results package designed for both internal analysis and external presentation. Key outputs include:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Deal term benchmarks:</strong> Median, 25th, and 75th percentile values for upfront payments, development milestones, regulatory milestones, commercial milestones, and royalty rates, filtered to your exact asset profile.</li>
              <li><strong>rNPV valuation:</strong> Risk-adjusted net present value with phase-specific probability-of-success rates, showing the expected value of the asset under current development assumptions.</li>
              <li><strong>Monte Carlo distribution:</strong> 10,000-scenario simulation showing P10, P25, P50, P75, and P90 outcomes with a visual probability distribution chart.</li>
              <li><strong>Sensitivity tornado:</strong> Ranked chart showing which input variables drive the most variation in output value, guiding where to focus diligence and negotiation.</li>
              <li><strong>Partner match scores:</strong> Top-ranked potential partners from a database of 850+ companies, scored on strategic fit, pipeline complementarity, deal history, and financial capacity.</li>
              <li><strong>Buyer-specific valuations:</strong> Customized valuation for specific potential acquirers reflecting their WACC, commercial capabilities, and strategic premium.</li>
              <li><strong>PDF report:</strong> A ~20-page institutional-quality report covering all engines, suitable for board presentations, deal committee memos, and investor updates. Available for $499 one-time or included with Pro.</li>
            </ul>

            {/* Section 4: Data Sources */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="data-sources">
              Data Sources and Methodology
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The calculator&apos;s benchmarks are only as good as the data behind them. Our dataset of {DEAL_STATS.TOTAL_DEALS} transactions is built from multiple primary sources with rigorous validation:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>SEC EDGAR filings:</strong> Automated scanning of 8-K and 10-K filings for disclosed deal terms, with AI-powered extraction of financial details from licensing agreement exhibits.</li>
              <li><strong>Press releases and announcements:</strong> Comprehensive coverage of deal announcements with cross-referencing against SEC filings for validation.</li>
              <li><strong>ClinicalTrials.gov:</strong> Weekly automated scanning for trial registrations, status updates, and sponsor changes that signal deal activity and competitive dynamics.</li>
              <li><strong>Regulatory filings:</strong> FDA approval actions, breakthrough designations, and Complete Response Letters tracked through OpenFDA and direct monitoring.</li>
              <li><strong>Curated expert review:</strong> Every deal in the core comparable set is reviewed for accuracy, with standardized tagging across therapeutic area, modality, phase, and deal type.</li>
            </ul>

            <p className="text-slate-600 leading-relaxed">
              The <Link href="/methodology" className="text-teal-600 font-medium hover:text-teal-700">methodology page</Link> provides full details on data collection, normalization, and the statistical models underlying each engine.
            </p>

            {/* Section 5: Who Uses This */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="who-uses-this">
              Who Uses This
            </h2>

            <p className="text-slate-600 leading-relaxed">
              The calculator is built for professionals who need defensible, data-backed deal analysis without the time and cost of building models from scratch:
            </p>

            <ul className="list-disc pl-6 space-y-2 text-slate-600">
              <li><strong>Business development teams:</strong> Prepare term sheets, evaluate inbound offers, and benchmark proposed deal terms against market comparables before entering negotiations.</li>
              <li><strong>Deal committees and boards:</strong> Validate proposed transaction terms with independent, data-backed benchmarks. Generate presentation-ready reports for governance review.</li>
              <li><strong>CFOs and finance teams:</strong> Model the financial impact of deal structures on P&amp;L, cash flow, and portfolio value. Compare licensing vs. acquisition economics for the same asset.</li>
              <li><strong>Venture capital and crossover investors:</strong> Size potential exit values, assess management projections, and identify assets with deal terms below market benchmarks (potential value creation).</li>
              <li><strong>Licensing consultants and advisors:</strong> Provide clients with institutional-quality analysis without maintaining proprietary databases or building bespoke models for each engagement.</li>
              <li><strong>Academic researchers:</strong> Access structured deal data for research on biopharma transaction trends, pricing dynamics, and market evolution.</li>
            </ul>

            {/* Section 6: Comparison Table */}
            <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4" id="comparison">
              Calculator vs. Traditional Valuation Methods
            </h2>

            <p className="text-slate-600 leading-relaxed">
              How does the calculator compare to the traditional approaches used by most BD and finance teams today?
            </p>

            <div className="overflow-x-auto my-8">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Dimension</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Traditional (Spreadsheets)</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-900 border-b border-slate-200">Ambrosia Calculator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Comparable deals</td><td className="px-4 py-3 text-slate-600">5-15 manually sourced</td><td className="px-4 py-3 text-slate-600">{DEAL_STATS.TOTAL_DEALS} auto-filtered</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Time to benchmark</td><td className="px-4 py-3 text-slate-600">2-4 weeks</td><td className="px-4 py-3 text-slate-600">Under 2 minutes</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Valuation engines</td><td className="px-4 py-3 text-slate-600">1-2 (DCF, comps)</td><td className="px-4 py-3 text-slate-600">14 specialized engines</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Monte Carlo</td><td className="px-4 py-3 text-slate-600">Rare, requires add-ins</td><td className="px-4 py-3 text-slate-600">Built-in, 10,000 scenarios</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Partner matching</td><td className="px-4 py-3 text-slate-600">Manual research</td><td className="px-4 py-3 text-slate-600">850+ companies scored</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Therapeutic areas</td><td className="px-4 py-3 text-slate-600">TA-agnostic assumptions</td><td className="px-4 py-3 text-slate-600">12 TAs, 562 indications</td></tr>
                  <tr><td className="px-4 py-3 text-slate-700 font-medium">Output format</td><td className="px-4 py-3 text-slate-600">Raw spreadsheet</td><td className="px-4 py-3 text-slate-600">Interactive + PDF report</td></tr>
                  <tr className="bg-slate-50/50"><td className="px-4 py-3 text-slate-700 font-medium">Data freshness</td><td className="px-4 py-3 text-slate-600">Point-in-time snapshot</td><td className="px-4 py-3 text-slate-600">Continuously updated</td></tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-600 leading-relaxed">
              The calculator does not replace strategic judgment or deep asset-level diligence. It replaces the weeks of mechanical data gathering, model building, and comparable sourcing that precede the strategic analysis. Teams that use the calculator report spending more time on the decisions that matter and less time on the data assembly that used to consume the first half of every deal evaluation.
            </p>
          </div>
        </article>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-teal-600 to-cyan-600">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Start Benchmarking Your Deals
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Join BD teams, investors, and deal advisors using the calculator to benchmark transactions against {DEAL_STATS.TOTAL_DEALS} real biopharma deals. Create a free account and run your first benchmark in minutes.
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
                    Is the life sciences deal calculator free to use?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  The calculator requires a free account to run benchmarks. Basic deal term benchmarking is available to all registered users. Advanced engines including Monte Carlo, real options, competitive dynamics, and buyer-specific valuation require a <Link href="/#pricing" className="text-teal-600 hover:text-teal-700">Pro subscription</Link> ($299/month or $199/month billed annually).
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How many deals does the calculator benchmark against?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  The calculator benchmarks against {DEAL_STATS.TOTAL_DEALS} disclosed biopharma transactions spanning 12 therapeutic areas, 23+ modalities, and all clinical phases. The dataset is continuously updated through automated ingestion from SEC EDGAR, press releases, ClinicalTrials.gov, and regulatory filings.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    What therapeutic areas does the deal calculator cover?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  The calculator covers 12 therapeutic areas with 562 specific indications: oncology (77), immunology (64), neurology (59), rare disease (50), metabolic (50), hematology (43), infectious disease (40), dermatology (40), gastroenterology (39), women&apos;s health (35), cardiovascular (33), and ophthalmology (32). See our <Link href="/methodology" className="text-teal-600 hover:text-teal-700">methodology</Link> for details on each TA.
                </div>
              </details>

              <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                  <span className="font-medium text-slate-900 pr-4">
                    How is the deal calculator different from a DCF model or spreadsheet?
                  </span>
                  <svg className="w-5 h-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Unlike a static DCF spreadsheet, the calculator combines 14 specialized engines with a continuously updated dataset of {DEAL_STATS.TOTAL_DEALS} real transactions. It benchmarks against actual market data rather than assumptions, runs Monte Carlo simulations with 10,000 scenarios, matches against 850+ potential partners, and generates institutional-quality <Link href="/calculator" className="text-teal-600 hover:text-teal-700">PDF reports</Link> in seconds rather than weeks.
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
                { href: '/calculator', title: 'Solidus', desc: 'Run your first benchmark now' },
                { href: '/guides/biopharma-licensing-benchmarks', title: 'Licensing Benchmarks', desc: '2026 deal terms by phase and modality' },
                { href: '/guides/rnpv-biotech-valuation', title: 'rNPV Guide', desc: 'Risk-adjusted valuation methodology' },
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
