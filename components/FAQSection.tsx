'use client';

import { DEAL_STATS } from '@/lib/config/constants';

const faqs = [
  {
    question: "How does the calculator work?",
    answer: `Enter your asset's key details — modality, development phase, indication, and territory — and our calculator analyzes ${DEAL_STATS.TOTAL_DEALS} real biopharma licensing deals to generate benchmark ranges for upfront payments, milestones, and royalty rates. Pro users also get risk-adjusted NPV (rNPV) analysis with Monte Carlo simulation (10,000 iterations), AI-generated deal memos, negotiation playbooks, and partner matching. You get a data-driven starting point for any deal conversation in seconds.`
  },
  {
    question: "What data sources power the benchmarks?",
    answer: "Every benchmark is grounded in real transaction data drawn from SEC filings (10-K, 10-Q, 8-K), public deal announcements, and verified industry sources. Our dataset is continuously updated as new deals are disclosed, so you're always working with the most current market intelligence available."
  },
  {
    question: "How accurate are the deal estimates?",
    answer: "The ranges we surface represent the 25th–75th percentile of where comparable deals actually transacted — this is deal intelligence, not a prediction. Final terms will always depend on asset differentiation, competitive dynamics, and negotiation leverage. Think of our estimates as a strategic starting point grounded in market reality."
  },
  {
    question: "What therapeutic areas are covered?",
    answer: `We cover 12 therapeutic areas: oncology, neurology/CNS, immunology/autoimmune, metabolic/obesity, rare disease, cardiovascular, infectious disease, ophthalmology, women's health, dermatology, pulmonology, and gastroenterology. Our ${DEAL_STATS.TOTAL_DEALS} deal database spans modalities from ADCs and CAR-T to anti-TL1A and FcRn antagonists, with indications covering solid tumors, hematologic malignancies, Alzheimer's, Parkinson's, lupus, IBD, myasthenia gravis, GLP-1 analogs, and more.`
  },
  {
    question: "Is my data kept confidential?",
    answer: "Yes. All API endpoints are authenticated and rate-limited. Your inputs and asset details remain completely private. We are fully GDPR-compliant — you can export or delete all your data at any time from your dashboard settings. Payments are processed securely through Stripe."
  },
  {
    question: "What's the difference between Free and Pro?",
    answer: "The free tier gives you unlimited calculations with headline metrics, 3 comparable deals, and top sensitivity parameters. Pro ($99/mo) unlocks the full platform — rNPV analysis with Monte Carlo simulation, Market Pulse intelligence dashboard, unlimited AI deal memos, negotiation playbooks, scenario comparison, watchlist with market alerts, 120+ company profiles with pipeline tracking and patent cliff timelines, AI partner matching, outreach email generation, branded PDF and Excel exports, and priority support. Individual Deal Reports ($149 each) are also available for one-time analysis."
  },
  {
    question: "How often is the data updated?",
    answer: "Continuously. Our dataset is refreshed as new deals are publicly disclosed through SEC filings and deal announcements. You're always benchmarking against the most current market data available."
  },
  {
    question: "Can I share my results with my team?",
    answer: "Yes. Pro users can export branded PDF and Excel reports, generate shareable links with configurable expiration, and compare saved scenarios across team members. We just ask that you don't redistribute the underlying benchmark data externally."
  },
  {
    question: "Is this available for academic or research use?",
    answer: "Yes. The free tier is available to academic researchers and students. For institutional access or bulk research needs, reach out to us at info@ambrosiaventures.co."
  },
];

export default function FAQSection() {
  // JSON-LD for FAQ schema
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
      {/* JSON-LD Schema */}
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
