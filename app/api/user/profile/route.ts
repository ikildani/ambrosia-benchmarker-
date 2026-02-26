import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { profileUpdateSchema, formatZodErrors } from '@/lib/api-validation';
import { captureApiError } from '@/lib/sentry-api';

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // SECURITY: Use middleware-managed session instead of raw token
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const rawBody = await request.json();

    // Validate with Zod schema
    const parsed = profileUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const updateData = parsed.data;

    if (Object.keys(updateData).length === 0) {
      return apiError('No fields to update', 400);
    }

    // Use service client for the update (bypasses RLS for profile writes)
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      captureApiError(updateError, 'profile-update');
      return apiError('Failed to save profile', 500);
    }

    return apiSuccess({});
  } catch (error) {
    captureApiError(error, 'profile-patch');
    return apiError('Internal server error', 500);
  }
}
