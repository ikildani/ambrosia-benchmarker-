'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Hero CTA: no viewport prefetch (the calculator carries the deal engine), prefetch on intent instead. */
export default function CalculatorCta() {
  const router = useRouter();
  const prefetch = () => router.prefetch('/calculator');
  return (
    <Link
      href="/calculator"
      prefetch={false}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      onFocus={prefetch}
      className="group relative inline-flex items-center justify-center gap-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold px-10 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto text-base"
    >
      <span>Benchmark Your Deal — Free</span>
      <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </Link>
  );
}
