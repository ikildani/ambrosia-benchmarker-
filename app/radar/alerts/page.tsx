/**
 * /radar/alerts — account-wide alert rules and the inbox of delivered
 * alerts. Auth-only; email and Slack channels need Pro (enforced by the
 * API). The pre-launch 404 gate lives in app/radar/layout.tsx.
 */

import type { Metadata } from 'next';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSignInNotice } from '@/components/radar/RadarSignInNotice';
import { AlertsPage } from '@/components/radar/alerts/AlertsPage';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Alerts | Search & Evaluation | Solidus',
  description: 'Alert rules for watched assets and mandates in Search & Evaluation: score thresholds, partnership changes, upcoming catalysts and mandate digests.',
  alternates: { canonical: `${BASE_URL}/radar/alerts` },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RadarAlertsPage() {
  const auth = await resolveUserTier();
  if (!auth.isAuthenticated) {
    return (
      <RadarPageFrame>
        <RadarSignInNotice section="alerts" title="Alerts" detail="Sign in to set score, partnership, catalyst and digest alerts on the assets and mandates you follow." />
      </RadarPageFrame>
    );
  }
  return <AlertsPage hasProAccess={auth.hasProAccess} />;
}
