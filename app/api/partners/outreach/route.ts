import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getOutreachGenerator } from '@/lib/services/outreach-generator';
import { OutreachGenerationRequest } from '@/types/partner-breakdown';

// Rate limiting constants
const DAILY_EMAIL_LIMIT = 10;

// Pro user emails (synced with AuthContext)
const PRO_EMAILS = ['ikildani@ambrosiaventures.co', 'czuckerman@ambrosiaventures.co'];

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json() as OutreachGenerationRequest & {
      user_id?: string;
      user_email?: string;
      session_id?: string;
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
    } = body;

    // Validate required fields
    if (!company_id || !company_name || !match_context || !user_asset) {
      return NextResponse.json(
        { error: 'company_id, company_name, match_context, and user_asset are required' },
        { status: 400 }
      );
    }

    // Check user tier - must be Pro
    let userTier: 'free' | 'pro' = 'free';
    let authenticatedUserId: string | null = null;

    if (user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier')
        .eq('id', user_id)
        .single();

      if (profile) {
        authenticatedUserId = profile.id;
        userTier = (profile.tier as 'free' | 'pro') || 'free';
      }
    }

    // Check PRO_EMAILS list for localStorage auth users (synced with AuthContext)
    if (userTier === 'free' && user_email) {
      const emailLower = user_email.toLowerCase().trim();
      if (PRO_EMAILS.some(e => e.toLowerCase() === emailLower)) {
        userTier = 'pro';
      }
    }

    // Only Pro users can generate outreach emails
    if (userTier !== 'pro') {
      return NextResponse.json(
        {
          error: 'Outreach email generation is a Pro feature',
          upgrade_required: true,
          upgrade_message: 'Upgrade to Pro to generate personalized outreach emails for partner outreach.',
        },
        { status: 403 }
      );
    }

    // Check rate limit
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { data: usageData } = await supabase
      .from('outreach_email_usage')
      .select('email_count')
      .eq('user_id', authenticatedUserId)
      .eq('date', today)
      .single();

    const currentCount = usageData?.email_count || 0;

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

    // Update usage count
    if (authenticatedUserId) {
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
        console.error('Failed to update usage count:', upsertError);
      }
    }

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
    console.error('Outreach generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate outreach email' },
      { status: 500 }
    );
  }
}
