/**
 * GET /api/deals/verified-comps
 *
 * The closest real, primary-sourced comparable deals for a calculator query,
 * read from `deals_verified` (lib/comps/verified-comps.server.ts). Feeds the
 * "Deals like yours" block at the top of the results page.
 *
 * Query params: therapeuticArea (required) · phase · modality · indication · dealType · territory
 *
 * Response 200:
 *   {
 *     summary: { n, medianUpfrontM, p25UpfrontM, p75UpfrontM, medianTotalM, nTotal },
 *     comps: VerifiedComp[],     // free tier: the top FREE_COMPS only
 *     totalComps: number,        // pool size before tier gating
 *     closeCount, rungIndex, rung, relaxed,
 *     tier, limited
 *   }
 *
 * Summary stats are computed on the whole pool for every tier (they are
 * aggregates); free users get the top FREE_COMPS rows with sources.
 */

import { requireSingleSession } from '@/lib/auth/require-single-session';
import { NextRequest, NextResponse } from 'next/server';
import { findVerifiedComps } from '@/lib/comps/verified-comps.server';
import { getRequestUserTier, hasFullCompsAccess } from '@/lib/auth/request-tier';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const FREE_COMPS = 3;

const ALLOWED_TAS = new Set([
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular', 'infectiousDisease',
  'ophthalmology', 'womensHealth', 'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
]);

const clean = (v: string | null) => (v ?? '').trim().slice(0, 80) || undefined;

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals-verified-comps', RATE_LIMIT_CONFIGS.deals);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) },
    );
  }

  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;

    const params = request.nextUrl.searchParams;
    const therapeuticArea = (params.get('therapeuticArea') || '').trim();
    if (!ALLOWED_TAS.has(therapeuticArea)) {
      return NextResponse.json({ error: 'valid therapeuticArea parameter required' }, { status: 400 });
    }

    const [selection, tier] = await Promise.all([
      findVerifiedComps({
        therapeuticArea,
        phase: clean(params.get('phase')),
        modality: clean(params.get('modality')),
        indication: clean(params.get('indication')),
        dealType: clean(params.get('dealType')),
        territory: clean(params.get('territory')),
      }),
      getRequestUserTier(),
    ]);

    const full = hasFullCompsAccess(tier);
    return NextResponse.json(
      {
        summary: selection.summary,
        comps: full ? selection.comps : selection.comps.slice(0, FREE_COMPS),
        totalComps: selection.comps.length,
        closeCount: selection.closeCount,
        rungIndex: selection.rungIndex,
        rung: selection.rung,
        relaxed: selection.relaxed,
        tier,
        limited: !full,
      },
      { headers: { 'Cache-Control': 'private, max-age=600' } },
    );
  } catch (error) {
    captureApiError(error, 'deals-verified-comps');
    return NextResponse.json({ error: 'Failed to load comparable deals' }, { status: 500 });
  }
}
