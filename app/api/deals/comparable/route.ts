import { NextRequest, NextResponse } from 'next/server';
import { findComparableDealsWithDB } from '@/lib/comparableDeals.server';
import { captureApiError } from '@/lib/sentry-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
