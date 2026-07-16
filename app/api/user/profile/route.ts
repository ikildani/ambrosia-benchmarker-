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

    const { weekly_digest, platform_updates, ...profileFields } = parsed.data;

    const hasProfileFields = Object.keys(profileFields).length > 0;
    const hasEmailPrefs = weekly_digest !== undefined || platform_updates !== undefined;

    if (!hasProfileFields && !hasEmailPrefs) {
      return apiError('No fields to update', 400);
    }

    const supabase = createServiceClient();

    if (hasProfileFields) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileFields)
        .eq('id', user.id);

      if (updateError) {
        captureApiError(updateError, 'profile-update');
        return apiError('Failed to save profile', 500);
      }
    }

    if (hasEmailPrefs) {
      const prefData: Record<string, unknown> = { user_id: user.id };
      if (weekly_digest !== undefined) prefData.weekly_digest = weekly_digest;
      if (platform_updates !== undefined) prefData.platform_updates = platform_updates;

      const { error: prefError } = await supabase
        .from('email_preferences')
        .upsert(prefData, { onConflict: 'user_id' });

      if (prefError) {
        captureApiError(prefError, 'email-preferences-update');
        return apiError('Failed to save email preferences', 500);
      }
    }

    return apiSuccess({});
  } catch (error) {
    captureApiError(error, 'profile-patch');
    return apiError('Internal server error', 500);
  }
}
