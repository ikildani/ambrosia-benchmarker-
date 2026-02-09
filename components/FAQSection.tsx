'use client';

const faqs = [
  {
    question: "How does the calculator work?",
    answer: "Our proprietary algorithm benchmarks your asset against a curated dataset of 500+ publicly disclosed biopharma licensing transactions. It matches on modality, development phase, indication, and territory to generate percentile-based ranges for upfront payments, development and commercial milestones, and royalty rates — giving you a data-driven starting point for any deal conversation."
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
    answer: "We launched with oncology — the most active and data-rich therapeutic area in biopharma licensing — giving you the deepest benchmarking dataset available. Additional therapeutic areas including immunology, neurology, rare diseases, and more are actively in development and will be released soon."
  },
  {
    question: "Is my data kept confidential?",
    answer: "Absolutely. Your inputs are never stored, shared, or used to train any models. All calculations are processed in a secure environment, your asset details remain completely private, and no third party ever has access to your data."
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
    <section id="faq" className="py-16 sm:py-20 lg:py-24 px-4 bg-slate-50 dark:bg-slate-800/50">
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
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
              className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
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
              <div className="px-5 pb-5">
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
