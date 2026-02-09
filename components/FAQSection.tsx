'use client';

const faqs = [
  {
    question: "How does the calculator work?",
    answer: "Enter your asset's key details — modality, development phase, indication, and territory — and our calculator analyzes 500+ real biopharma licensing deals to generate benchmark ranges for upfront payments, milestones, and royalty rates. You get a data-driven starting point for any deal conversation in seconds."
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
    answer: "We currently cover oncology and neurology/CNS — the two most active therapeutic areas in biopharma licensing. Oncology benchmarks draw from 500+ deals, while our neurology module is calibrated against 88 R&D partnerships totaling $45.9B (2024-2025), covering indications from Alzheimer's to rare neurological diseases. Additional therapeutic areas including immunology and cardiometabolic are in development."
  },
  {
    question: "Is my data kept confidential?",
    answer: "Yes. We don't store or sell your data. Your inputs and asset details remain completely private."
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
