import { requireSingleSession } from "@/lib/auth/require-single-session";
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOutreachGenerator } from '@/lib/services/outreach-generator';
import { OutreachGenerationRequest } from '@/types/partner-breakdown';
import { isProEmail } from '@/lib/config/authorized-emails';
import { captureApiError } from '@/lib/sentry-api';
import type { UserTier } from '@/types/tier';

// Rate limiting constants
const DAILY_EMAIL_LIMIT = 10;

export async function POST(request: NextRequest) {
  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;
    const supabase = createServiceClient();
    const body = await request.json() as OutreachGenerationRequest & {
      user_id?: string;
      user_email?: string;
      session_id?: string;
      tier?: UserTier; // Client-side tier for localStorage auth
    };

    const {
      company_id,
      company_name,
      match_context,
      user_asset,
      tone = 'formal',
      recipient_role,
      sender_name,
      sender_company,
      user_id,
      user_email,
      session_id,
      tier: clientTier,
    } = body;

    // Validate required fields
    if (!company_id || !company_name || !match_context || !user_asset) {
      return NextResponse.json(
        { error: 'company_id, company_name, match_context, and user_asset are required' },
        { status: 400 }
      );
    }

    // Check user tier - must be Pro or Report
    let userTier: UserTier = 'free';
    let authenticatedUserId: string | null = null;

    // Method 0 (R72): Server-side cookie auth — authoritative, doesn't depend
    // on client-sent user_id. Catches cases where client auth context is stale.
    try {
      const { getAuthenticatedUser } = await import('@/lib/auth-helpers');
      const authUser = await getAuthenticatedUser(request);
      if (authUser?.id) {
        const { data: cookieProfile } = await supabase
          .from('user_profiles')
          .select('id, tier, email')
          .eq('id', authUser.id)
          .single();
        if (cookieProfile) {
          authenticatedUserId = cookieProfile.id;
          userTier = (cookieProfile.tier as UserTier) || 'free';
          if (userTier === 'free' && cookieProfile.email && isProEmail(cookieProfile.email)) {
            userTier = 'pro';
          }
        }
      }
    } catch {} // non-blocking — fall through to client-sent user_id

    // Method 1: Fallback — check by client-sent user_id (original path)
    if (userTier === 'free' && user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier')
        .eq('id', user_id)
        .single();

      if (profile) {
        authenticatedUserId = profile.id;
        userTier = (profile.tier as UserTier) || 'free';
      }
    }

    // Method 2: Check PRO_EMAILS list using verified email from database profile
    if (userTier === 'free' && (authenticatedUserId || user_id)) {
      const lookupId = authenticatedUserId || user_id;
      const { data: emailProfile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', lookupId)
        .single();
      if (emailProfile?.email && isProEmail(emailProfile.email)) {
        userTier = 'pro';
      }
    }

    // SECURITY: Server-side cookie auth is primary. Client user_id is fallback only.

    // Only Pro/Report users can generate outreach emails
    if (userTier !== 'pro' && userTier !== 'report') {
      return NextResponse.json(
        {
          error: 'Outreach email generation is a Pro feature',
          upgrade_required: true,
          upgrade_message: 'Upgrade to Pro to generate personalized outreach emails for partner outreach.',
        },
        { status: 403 }
      );
    }

    // Rate limit check and increment atomically to prevent race conditions
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let currentCount = 0;

    if (authenticatedUserId) {
      // Rate limit check - read current count and pre-increment atomically
      // First, get current count
      const { data: usageData } = await supabase
        .from('outreach_email_usage')
        .select('email_count')
        .eq('user_id', authenticatedUserId)
        .eq('date', today)
        .single();

      currentCount = usageData?.email_count || 0;

      if (currentCount >= DAILY_EMAIL_LIMIT) {
        return NextResponse.json(
          {
            error: 'Daily email generation limit reached',
            rate_limited: true,
            usage: {
              emails_generated_today: currentCount,
              daily_limit: DAILY_EMAIL_LIMIT,
              resets_at: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
            },
          },
          { status: 429 }
        );
      }

      // Pre-increment the count before generation to reserve the slot
      // This reduces but doesn't eliminate race conditions without database-level locking
      const { error: upsertError } = await supabase
        .from('outreach_email_usage')
        .upsert(
          {
            user_id: authenticatedUserId,
            date: today,
            email_count: currentCount + 1,
          },
          { onConflict: 'user_id,date' }
        );

      if (upsertError) {
        console.error('Failed to reserve usage slot:', upsertError);
      }
    }

    // Generate outreach email
    const generator = getOutreachGenerator();

    const result = await generator.generateOutreachEmail({
      company_id,
      company_name,
      match_context,
      user_asset,
      tone,
      recipient_role,
      sender_name,
      sender_company,
    });

    // Track event
    await supabase.from('events').insert({
      user_id: authenticatedUserId,
      session_id: session_id || null,
      event_type: 'outreach_email_generated',
      event_data: {
        company_id,
        company_name,
        tone,
        recipient_role: recipient_role || null,
        match_score: match_context.score,
      },
      user_tier: userTier,
    });

    // Return response
    return NextResponse.json({
      success: true,
      email: result.email,
      approach_strategy: result.approach_strategy,
      usage: {
        emails_generated_today: currentCount + 1,
        daily_limit: DAILY_EMAIL_LIMIT,
      },
    });

  } catch (error) {
    captureApiError(error, 'partners-outreach');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return more specific error for debugging
    if (errorMessage.includes('No JSON found')) {
      return NextResponse.json(
        { error: 'AI response format error. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Generation failed: ${errorMessage.slice(0, 100)}` },
      { status: 500 }
    );
  }
}
