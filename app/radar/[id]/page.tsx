/**
 * /radar/[id] — one-page deal brief for a clinical asset.
 *
 * Server component shell: Pro gate (resolveUserTier, same as the API routes),
 * UUID validation, notFound() on a missing asset, and the full brief loaded
 * once on the server (components/radar/asset/brief-loader.ts, all sub-queries
 * parallel). Interactive islands (narrative, notes, watchlist, alerts, export)
 * hydrate client-side and call /api/radar/*.
 *
 * noindex: inherited from app/radar/layout.tsx and restated here so a page-
 * level metadata override never re-enables indexing of Pro content.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { createServiceClient } from '@/lib/supabase/server';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { loadAssetBrief } from '@/components/radar/asset/brief-loader';
import { AssetBriefPage } from '@/components/radar/asset/AssetBriefPage';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { radarBacktested } from '@/lib/radar/backtested';
import type { BriefViewer } from '@/components/radar/asset/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const base: Metadata = { robots: { index: false, follow: false } };
  if (!isUuid(id)) return { ...base, title: 'Asset brief | Solidus Asset Radar' };
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) return { ...base, title: 'Asset brief | Solidus Asset Radar' };
  const supabase = createServiceClient();
  const { data } = await supabase.from('clinical_assets').select('asset_name, company_name').eq('id', id).maybeSingle();
  if (!data) return { ...base, title: 'Asset brief | Solidus Asset Radar' };
  return {
    ...base,
    title: `${data.asset_name} (${data.company_name}) — Asset Radar | Solidus`,
    description: `Licensing intent, predicted terms with comparables, trials, acquirers and analyst brief for ${data.asset_name} by ${data.company_name}.`,
  };
}

export default async function AssetBriefRoute({ params }: Props) {
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

  const supabase = createServiceClient();
  const [brief, membership] = await Promise.all([
    loadAssetBrief(supabase, id),
    auth.userId
      ? supabase.from('team_members').select('team_id, teams(name)').eq('user_id', auth.userId).eq('status', 'active').limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!brief) notFound();

  const teamRow = membership.data as { team_id?: string; teams?: { name?: string } | { name?: string }[] | null } | null;
  const teamName = Array.isArray(teamRow?.teams) ? teamRow?.teams[0]?.name : teamRow?.teams?.name;
  const viewer: BriefViewer = {
    user_id: auth.userId,
    has_team: !!teamRow?.team_id,
    team_name: teamName ?? null,
  };

  return <AssetBriefPage brief={brief} viewer={viewer} />;
}
