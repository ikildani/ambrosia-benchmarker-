'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/** Route-level error boundary for /radar. Keeps the header out (it may be the thing that failed). */
export default function RadarError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[radar] route error:', error.message, error.digest ?? '');
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 pt-16 dark:bg-neutral-950 sm:pt-20">
      <div role="alert" className="max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Search & Evaluation hit an error</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          The page could not render. Trying again usually works; if it keeps happening, the link in your address bar
          is enough for us to reproduce it.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-neutral-500">ref {error.digest}</p>}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
          >
            Try again
          </button>
          <Link
            href="/radar"
            className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:ring-offset-neutral-950"
          >
            Reset the view
          </Link>
        </div>
      </div>
    </div>
  );
}
