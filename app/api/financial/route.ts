import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { analyzeCompetitiveLandscape } from '@/lib/services/pipeline-intelligence';
import { forecastDealFlow } from '@/lib/services/deal-flow-forecast';
import { requireAuth } from '@/lib/auth-helpers';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { apiError, apiErrorWithHeaders } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/** Allowed therapeutic area values for input validation */
const VALID_THERAPEUTIC_AREAS = [
  'oncology',
  'neurology',
  'immunology',
  'metabolic',
  'cardiovascular',
  'infectiousDisease',
  'ophthalmology',
  'womensHealth',
];

/**
 * GET /api/financial?therapeuticArea=oncology&indication=lung_nsclc&modality=adc
 *
 * Returns server-side financial intelligence:
 * - Competitive landscape analysis (requires DB for company_trials)
 * - Deal flow forecast (historical data + DB enrichment)
 */
export async function GET(request: NextRequest) {
  // Authentication
  const [user, authError] = await requireAuth(request);
  if (authError) return authError;

  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'financial', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests. Please try again later.', 429, getRateLimitHeaders(rateLimitResult), 'RATE_LIMITED');
  }

  try {
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea');
    const indication = params.get('indication');
    const modality = params.get('modality') || undefined;

    if (!therapeuticArea || !indication) {
      return apiError('therapeuticArea and indication parameters required', 400);
    }

    // Validate therapeuticArea against known values
    if (!VALID_THERAPEUTIC_AREAS.includes(therapeuticArea)) {
      return apiError(
        `Invalid therapeuticArea. Must be one of: ${VALID_THERAPEUTIC_AREAS.join(', ')}`,
        400,
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
      forecastDealFlow(therapeuticArea, supabase, indication)
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
    return apiError('Internal server error', 500);
  }
}
