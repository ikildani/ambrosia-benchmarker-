/**
 * /radar/acquirers — the acquirer view: pick a buyer, see the programs that
 * fit its portfolio gaps with predicted terms. Pro-only, like the feed.
 * The pre-launch 404 gate lives in app/radar/layout.tsx.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { radarBacktested } from '@/lib/radar/backtested';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { AcquirersPage } from '@/components/radar/acquirers/AcquirersPage';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Acquirer View | Search & Evaluation | Solidus',
  description: 'See Search & Evaluation from a buyer\'s side: the clinical-stage programs that fit a company\'s patent cliffs, therapeutic gaps and modality gaps, with predicted deal terms.',
  alternates: { canonical: `${BASE_URL}/radar/acquirers` },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RadarAcquirersPage() {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    const backtested = await radarBacktested();
    return (
      <RadarPageFrame>
        <RadarUpgradeGate isAuthenticated={auth.isAuthenticated} backtested={backtested} />
      </RadarPageFrame>
    );
  }
  // useSearchParams inside AcquirersPage needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AcquirersPage />
    </Suspense>
  );
}
