'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AssetBriefError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[radar/[id]] render error:', error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-16 sm:pt-20 lg:pt-24">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Asset Radar</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">This brief could not be loaded</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          The asset data or one of its intelligence layers failed to load. Retry, or go back to the feed.
          {error.digest && <span className="block mt-1 font-mono text-xs text-neutral-500">Ref {error.digest}</span>}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white dark:focus-visible:ring-offset-neutral-950"
          >
            Retry
          </button>
          <Link
            href="/radar"
            className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900 dark:focus-visible:ring-offset-neutral-950"
          >
            Back to Radar
          </Link>
        </div>
      </div>
    </div>
  );
}
