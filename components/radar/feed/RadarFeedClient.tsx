'use client';

import { Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { hasProAccess } from '@/types/tier';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarShell } from '@/components/radar/feed/RadarShell';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { TableSkeleton } from '@/components/radar/feed/FeedStates';

function FeedFallback() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-16 dark:bg-neutral-950 sm:pt-20">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Loading assets</p>
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <TableSkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Client half of /radar. `backtested` comes from the server page (the active
 * model's backtest), so the upgrade gate never claims a backtest that has not
 * happened.
 */
export function RadarFeedClient({ backtested }: { backtested: boolean }) {
  const { isAuthenticated, tier, isLoading, openAuthModal } = useAuth();

  if (isLoading) {
    return (
      <RadarPageFrame>
        <FeedFallback />
      </RadarPageFrame>
    );
  }

  if (!hasProAccess(tier)) {
    return (
      <RadarPageFrame>
        <RadarUpgradeGate isAuthenticated={isAuthenticated} backtested={backtested} onSignUp={() => openAuthModal('signup')} />
      </RadarPageFrame>
    );
  }

  return (
    <RadarPageFrame>
      {/* useSearchParams inside RadarShell requires a Suspense boundary for static prerender. */}
      <Suspense fallback={<FeedFallback />}>
        <RadarShell />
      </Suspense>
    </RadarPageFrame>
  );
}
