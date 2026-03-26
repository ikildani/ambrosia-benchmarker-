import Link from 'next/link';

interface InsightCTAProps {
  variant: 'mid' | 'bottom';
  calculatorHref?: string;
  heading?: string;
  description?: string;
}

export function InsightCTA({
  variant,
  calculatorHref = '/calculator',
  heading,
  description,
}: InsightCTAProps) {
  if (variant === 'mid') {
    return (
      <section className="my-12 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-8 sm:p-10 text-center">
        <h3 className="text-2xl font-bold text-white mb-3">
          {heading || 'Run Your Own Benchmark'}
        </h3>
        <p className="text-slate-300 mb-6 max-w-xl mx-auto">
          {description || 'Model upfronts, milestones, and royalties for your specific asset — powered by 2,500+ real transactions.'}
        </p>
        <Link
          href={calculatorHref}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
        >
          Open the Calculator — Free
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          {heading || 'Run Your Own Deal Benchmark'}
        </h2>
        <p className="text-lg text-slate-300 mb-8 leading-relaxed">
          {description || 'Model upfronts, milestones, and royalties for any phase, modality, and therapeutic area — powered by 2,500+ real transactions.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={calculatorHref}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors shadow-lg w-full sm:w-auto"
          >
            Open the Calculator — Free
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            href="/benchmarks"
            className="inline-flex items-center justify-center px-8 py-4 border border-slate-600 text-slate-300 font-medium rounded-xl hover:border-slate-400 hover:text-white transition-colors w-full sm:w-auto"
          >
            Browse All Benchmarks
          </Link>
        </div>
        <p className="text-sm text-slate-500 mt-6">
          Data updated daily from SEC filings, press releases, and verified sources.
        </p>
      </div>
    </section>
  );
}
