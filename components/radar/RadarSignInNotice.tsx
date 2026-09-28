'use client';

import { useAuth } from '@/contexts/AuthContext';
import { RadarSubNav, type RadarSection } from './RadarSubNav';

/**
 * Signed-out state for the auth-only Radar surfaces (watchlist, alerts).
 * Opens the sign-in modal in place rather than bouncing to the feed.
 */
export function RadarSignInNotice({ section, title, detail }: { section: RadarSection; title: string; detail: string }) {
  const auth = useAuth();
  return (
    <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <RadarSubNav current={section} />
        <div className="mx-auto max-w-2xl py-20 text-center">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{detail}</p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => auth.openAuthModal('signin')}
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => auth.openAuthModal('signup')}
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Create an account
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
