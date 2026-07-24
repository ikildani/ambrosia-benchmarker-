'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function CalculatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-neutral-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Calculator Error</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Something went wrong with the Solidus. Your inputs have been preserved — try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-sm"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
