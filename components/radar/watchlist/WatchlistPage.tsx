'use client';

import Link from 'next/link';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSubNav } from '@/components/radar/RadarSubNav';
import { SectionCard } from '@/components/radar/asset/ui';
import { TeamWatchlist } from '@/components/radar/team/TeamWatchlist';
import { UpcomingCatalysts } from './UpcomingCatalysts';

/**
 * /radar/watchlist — the caller's watched assets (and the org watchlist on
 * a team), score moves, in-app alerts and the next 90 days of primary
 * completions. Auth-only: the watchlist is the free-tier hook into Radar.
 */
export function WatchlistPage({ hasProAccess }: { hasProAccess: boolean }) {
  return (
    <RadarPageFrame>
      <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <RadarSubNav current="watchlist" />
          <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Watchlist</h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                Assets you are tracking, with the score change since you added them and what is coming up.
                {!hasProAccess && (
                  <> Briefs and the feed need <Link href="/pro" className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100">Pro</Link>.</>
                )}
              </p>
            </div>
            <Link href="/radar/alerts" className="text-xs font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100">
              Manage alert rules
            </Link>
          </header>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <TeamWatchlist />
            </div>
            <SectionCard title="Next 90 days" meta="Primary completions">
              <UpcomingCatalysts />
            </SectionCard>
          </div>
        </div>
      </main>
    </RadarPageFrame>
  );
}
