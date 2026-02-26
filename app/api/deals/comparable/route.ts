import { NextRequest, NextResponse } from 'next/server';
import { findComparableDealsWithDB } from '@/lib/comparableDeals.server';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals-comparable', RATE_LIMIT_CONFIGS.deals);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { deals: [], error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea') || 'oncology';
    const modality = params.get('modality') || '';
    const indication = params.get('indication') || '';
    const phase = params.get('phase') || undefined;

    const deals = await findComparableDealsWithDB(
      { therapeuticArea, modality, indication, phase },
      10
    );

    return NextResponse.json({ deals });
  } catch (error) {
    captureApiError(error, 'deals-comparable');
    return NextResponse.json(
      { deals: [], error: 'Failed to fetch comparable deals' },
      { status: 500 }
    );
  }
}
