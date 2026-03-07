import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

// GET - Get shared calculation by token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = createServiceClient();
    const { token } = await params;

    if (!token) {
      return apiError('Token required', 400);
    }

    // Fetch shared calculation
    const { data: shared, error } = await supabase
      .from('shared_calculations')
      .select('*')
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (error || !shared) {
      return apiError('Shared calculation not found or expired', 404);
    }

    // Check expiration
    if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
      return apiError('This shared link has expired', 410);
    }

    // Increment view count
    await supabase.rpc('increment_share_views', { p_token: token });

    return apiSuccess({
      inputs: shared.inputs,
      results: shared.results,
      labels: shared.labels,
      viewCount: (shared.view_count || 0) + 1,
      createdAt: shared.created_at,
      expiresAt: shared.expires_at,
    });
  } catch (error) {
    captureApiError(error, 'share-get');
    return apiError('Internal server error', 500);
  }
}
