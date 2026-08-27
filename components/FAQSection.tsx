'use client';

import { DEAL_STATS } from '@/lib/config/constants';

const faqs = [
  {
    question: "How does Solidus work?",
    answer: `Enter your asset's details — modality, development phase, indication, and deal type — and our engine analyzes ${DEAL_STATS.TOTAL_DEALS} verified biopharma transactions to generate benchmark ranges for upfront payments, milestones, royalties, and total deal value. Pro subscribers also get risk-adjusted NPV (rNPV) with Monte Carlo simulation, AI-generated deal memos, negotiation playbooks, partner matching, and branded exports. Results are generated in under 30 seconds.`
  },
  {
    question: "What data sources power the benchmarks?",
    answer: "Every benchmark is derived from real transaction data sourced from SEC filings (10-K, 10-Q, 8-K), FTC premerger filings, public deal announcements, press releases, and verified industry databases. Our dataset covers licensing, acquisitions, collaborations, option agreements, and co-development deals from 2017 to present. Data is continuously refreshed as new transactions are disclosed — including weekly automated scraping of SEC EDGAR 8-K filings and FTC Hart-Scott-Rodino filings."
  },
  {
    question: "How accurate are the deal estimates?",
    answer: "The ranges represent the 25th–75th percentile of where comparable deals actually transacted. This is market intelligence grounded in real data, not a prediction. Final terms depend on asset differentiation, competitive dynamics, data strength, and negotiation leverage. Our estimates give you a data-driven starting point that would take an analyst 2-3 weeks to assemble manually."
  },
  {
    question: "What therapeutic areas and modalities are covered?",
    answer: `We cover all major life sciences sectors including oncology, neurology/CNS, immunology/autoimmune, metabolic/obesity, rare disease, cardiovascular, infectious disease, ophthalmology, women's health, dermatology, hematology, and gastroenterology. Our ${DEAL_STATS.TOTAL_DEALS} deal database spans modalities from antibody-drug conjugates (ADCs) and CAR-T to bispecifics, RNAi, gene therapy, small molecules, GLP-1 analogs, and more — covering solid tumors, hematologic malignancies, Alzheimer's, Parkinson's, lupus, IBD, and hundreds of other indications.`
  },
  {
    question: "What's included in the Pro plan?",
    answer: "Pro ($299/month, or $199/month billed annually) unlocks the complete platform: rNPV analysis with 10,000-iteration Monte Carlo simulation, deal valuation modeling, Market Pulse intelligence dashboard, unlimited AI deal memos and negotiation playbooks, scenario comparison tools, watchlist with market alerts, 700+ company profiles with pipeline tracking, patent cliff timelines, and Pharma Intent Score, AI-powered partner matching with outreach email generation, branded PDF and Excel exports, and priority support. Free users get unlimited calculations with headline metrics and 3 comparable deals."
  },
  {
    question: "Is my data kept confidential?",
    answer: "Absolutely. All API endpoints are authenticated and rate-limited. Your inputs and asset details are never shared, stored beyond your session, or used to train any models. We are fully GDPR-compliant — you can export or delete all your data at any time from your dashboard. Payments are processed securely through Stripe with no card data touching our servers."
  },
  {
    question: "How often is the data updated?",
    answer: "Continuously. Our automated pipeline scrapes SEC EDGAR filings weekly, and we manually verify and add major transactions as they're announced. Clinical trial data is synced from ClinicalTrials.gov, and FDA regulatory events are tracked in real-time. You're always benchmarking against the most current market data available."
  },
  {
    question: "Can I export and share results?",
    answer: "Pro users can export institutional-quality branded PDF reports and Excel workbooks, generate shareable links with configurable expiration, and compare saved scenarios. Reports include full methodology, comparable deals, sensitivity analysis, and executive summaries — ready for board presentations, investor meetings, or deal team discussions."
  },
  {
    question: "Who built this?",
    answer: "Solidus is built by Ambrosia Ventures, a life sciences strategy and M&A advisory firm. Our deal experience across biotech licensing, M&A, partnerships, and fundraising is embedded in every calculation. We built the tool we wished existed when advising on real transactions."
  },
];

export default function FAQSection() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <section id="faq" className="py-16 sm:py-20 lg:py-24 xl:py-28 px-4 xl:px-6 bg-slate-50 dark:bg-slate-800/50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold font-display text-slate-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Everything you need to know about our deal benchmarking platform
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-teal-200 dark:hover:border-teal-500/50 hover:shadow-soft transition-all duration-200"
            >
              <summary className="flex items-center justify-between p-5 xl:p-6 cursor-pointer list-none">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white pr-4">
                  {faq.question}
                </h3>
                <svg
                  className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-5 xl:px-6 xl:pb-6">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
