/**
 * /radar/mandates/[id] — every asset that matched one mandate, with
 * save / dismiss; opening it marks matches read (clears the "N new" badge).
 * Pro-only; the API 404s mandates the caller does not own.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { radarBacktested } from '@/lib/radar/backtested';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { MandateMatchesPage } from '@/components/radar/mandates/MandateMatchesPage';

export const metadata: Metadata = {
  title: 'Mandate matches | Search & Evaluation | Solidus',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RadarMandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    const backtested = await radarBacktested();
    return (
      <RadarPageFrame>
        <RadarUpgradeGate isAuthenticated={auth.isAuthenticated} backtested={backtested} />
      </RadarPageFrame>
    );
  }
  return <MandateMatchesPage mandateId={id} />;
}
