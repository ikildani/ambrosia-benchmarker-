import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { analyzeCompetitiveLandscape } from '@/lib/services/pipeline-intelligence';
import { forecastDealFlow } from '@/lib/services/deal-flow-forecast';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financial?therapeuticArea=oncology&indication=lung_nsclc&modality=adc
 *
 * Returns server-side financial intelligence:
 * - Competitive landscape analysis (requires DB for company_trials)
 * - Deal flow forecast (historical data + DB enrichment)
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea');
    const indication = params.get('indication');
    const modality = params.get('modality') || undefined;

    if (!therapeuticArea || !indication) {
      return NextResponse.json(
        { error: 'therapeuticArea and indication parameters required' },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Run both analyses in parallel
    const [competitiveLandscape, dealFlowForecast] = await Promise.all([
      analyzeCompetitiveLandscape(supabase, indication, therapeuticArea, modality)
        .catch((err) => {
          console.warn('Competitive landscape analysis failed:', err);
          return null;
        }),
      forecastDealFlow(therapeuticArea, supabase)
        .catch((err) => {
          console.warn('Deal flow forecast failed:', err);
          return null;
        }),
    ]);

    return NextResponse.json({
      competitiveLandscape,
      dealFlowForecast,
    });
  } catch (error) {
    captureApiError(error, '/api/financial');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
