import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { computeEstimate } from '@/lib/services/trend-aggregation';

export const dynamic = 'force-dynamic';

const VALID_TAS = new Set([
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
]);

const VALID_PHASES = new Set([
  'discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3',
  'phase3', 'nda_filed', 'approved', 'phase_1', 'phase_2', 'phase_3',
]);

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'estimate', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const ta = searchParams.get('ta');
    const phase = searchParams.get('phase');
    const modality = searchParams.get('modality');
    const territory = searchParams.get('territory') || 'global';

    if (!ta || !VALID_TAS.has(ta)) {
      return NextResponse.json({ success: false, error: 'Valid therapeutic area required' }, { status: 400 });
    }
    if (!phase || !VALID_PHASES.has(phase)) {
      return NextResponse.json({ success: false, error: 'Valid phase required' }, { status: 400 });
    }
    if (!modality || modality.length < 2) {
      return NextResponse.json({ success: false, error: 'Modality required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const estimate = await computeEstimate(supabase, ta, phase, modality, territory);

    return NextResponse.json(
      {
        success: true,
        ...estimate,
        params: { ta, phase, modality, territory },
        meta: { timestamp: new Date().toISOString() },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (err) {
    console.error('[estimate] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
