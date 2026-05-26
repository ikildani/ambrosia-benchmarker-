import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';
import { captureApiError } from '@/lib/sentry-api';
import { apiSuccess, apiError } from '@/lib/api-response';
import { shareSchema, formatZodErrors } from '@/lib/api-validation';
import type { UserTier } from '@/types/tier';

export const dynamic = 'force-dynamic';

// POST - Create a share link
export async function POST(request: NextRequest) {
  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;
    // SECURITY: Require authenticated session — never trust email from body
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const supabase = createServiceClient();
    const body = await request.json();

    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { inputs, results, labels, expiresIn, financialSummary } = parsed.data;

    // R24: Merge the headline rNPV + MC CI + PoS summary into the results JSON payload
    // so the share page can render a valuation card without widening the table schema.
    const resultsWithSummary = financialSummary
      ? { ...results, financialSummary }
      : results;

    // Verify Pro tier from authenticated user's profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const userTier = (profile?.tier as UserTier) || 'free';

    if (userTier !== 'pro' && userTier !== 'report') {
      return apiError('Pro subscription required to share calculations', 403);
    }

    // Generate unique share token
    const shareToken = nanoid(12);

    // Calculate expiration if specified
    let expiresAt: string | null = null;
    if (expiresIn) {
      const expDate = new Date();
      if (expiresIn === '7d') expDate.setDate(expDate.getDate() + 7);
      else if (expiresIn === '30d') expDate.setDate(expDate.getDate() + 30);
      else if (expiresIn === '90d') expDate.setDate(expDate.getDate() + 90);
      expiresAt = expDate.toISOString();
    }

    // Create shared calculation using authenticated user
    const { data: shared, error } = await supabase
      .from('shared_calculations')
      .insert({
        share_token: shareToken,
        user_id: user.id,
        email: user.email,
        inputs,
        results: resultsWithSummary,
        labels: labels || {},
        is_public: true,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating share:', error);
      return apiError('Failed to create share link', 500);
    }

    const shareUrl = `https://calculator.ambrosiaventures.co/share/${shareToken}`;

    return apiSuccess({
      shareToken,
      shareUrl,
      expiresAt,
    });
  } catch (error) {
    captureApiError(error, 'share-post');
    return apiError('Internal server error', 500);
  }
}
