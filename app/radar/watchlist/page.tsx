/**
 * /radar/watchlist — watched assets, score moves, upcoming primary
 * completions. Auth-only (the watchlist is the free-tier hook into Search &
 * Evaluation). The pre-launch 404 gate lives in app/radar/layout.tsx.
 */

import type { Metadata } from 'next';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSignInNotice } from '@/components/radar/RadarSignInNotice';
import { WatchlistPage } from '@/components/radar/watchlist/WatchlistPage';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Watchlist | Search & Evaluation | Solidus',
  description: 'Assets you are tracking in Search & Evaluation, with score changes since you added them and the next 90 days of primary completions.',
  alternates: { canonical: `${BASE_URL}/radar/watchlist` },
  // Personal page; mirrors app/radar/layout.tsx.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RadarWatchlistPage() {
  const auth = await resolveUserTier();
  if (!auth.isAuthenticated) {
    return (
      <RadarPageFrame>
        <RadarSignInNotice section="watchlist" title="Watchlist" detail="Sign in to track assets, see score moves since you added them, and get the next 90 days of primary completions." />
      </RadarPageFrame>
    );
  }
  return <WatchlistPage hasProAccess={auth.hasProAccess} />;
}
