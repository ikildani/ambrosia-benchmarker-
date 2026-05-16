import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyTrialToken } from '@/lib/trial-token';
import { notifyTrialStarted } from '@/lib/slack/notify';

export const dynamic = 'force-dynamic';

// Email-trial activation. The 7-day Pro window starts WHEN THE USER CLICKS,
// not when the email was sent. Idempotent: re-clicking does not extend or
// restart an already-active trial.
const TRIAL_DAYS = 7;

function redirect(url: string, base: string) {
  return NextResponse.redirect(new URL(url, base));
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
  const token = request.nextUrl.searchParams.get('token') || '';

  const verified = verifyTrialToken(token);
  if (!verified) {
    return redirect('/?trial=invalid', appUrl);
  }

  const email = verified.email;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, tier, pro_expires_at, pro_engagement_type')
    .eq('email', email)
    .single();

  if (!profile) {
    // Signed for a real recipient but no profile — send them to sign in/up,
    // they can re-trigger from the same still-valid link afterward.
    return redirect(`/?trial=signup&email=${encodeURIComponent(email)}`, appUrl);
  }

  // Already on a paid plan, or already inside this email trial — just let them in.
  const alreadyActive =
    profile.tier === 'pro' &&
    profile.pro_expires_at &&
    new Date(profile.pro_expires_at).getTime() > Date.now();
  if (alreadyActive) {
    return redirect('/calculator?trial=already', appUrl);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      tier: 'pro',
      tier_change_authorized: true,
      subscription_status: 'active',
      pro_activated_at: now.toISOString(),
      pro_expires_at: expiresAt.toISOString(),
      pro_engagement_type: 'email-trial-may2026',
      updated_at: now.toISOString(),
    })
    .eq('id', profile.id);

  if (error) {
    console.error('[trial/activate] update failed:', error.message);
    return redirect('/?trial=error', appUrl);
  }

  await supabase.from('events').insert({
    user_id: profile.id,
    event_type: 'trial_activated',
    event_data: { source: 'email-trial-may2026', expires_at: expiresAt.toISOString() },
    user_tier: 'pro',
    tier_change_authorized: true,
  });

  notifyTrialStarted({ email }).catch(() => {});

  return redirect('/calculator?trial=activated', appUrl);
}
