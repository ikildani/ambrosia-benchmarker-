import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { notifyTrialStarted } from '@/lib/slack/notify';

export const dynamic = 'force-dynamic';

const TRIAL_DAYS = 7;

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser?.id) {
    return NextResponse.json({ error: 'Please sign in to start your trial.' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, tier, pro_expires_at, subscription_status, stripe_customer_id')
    .eq('id', authUser.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  if (profile.tier === 'pro' && profile.subscription_status === 'active' && profile.stripe_customer_id) {
    return NextResponse.json({ error: 'You already have an active Pro subscription.' }, { status: 400 });
  }

  if (profile.tier === 'pro' && profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() > Date.now()) {
    return NextResponse.json({ error: 'You already have an active trial.', alreadyActive: true }, { status: 400 });
  }

  const hadPriorTrial = profile.pro_expires_at && new Date(profile.pro_expires_at).getTime() < Date.now();
  if (hadPriorTrial) {
    return NextResponse.json({ error: 'Your free trial has ended. Subscribe to continue with Pro.', expired: true }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      tier: 'pro',
      tier_change_authorized: true,
      subscription_status: 'active',
      pro_activated_at: now.toISOString(),
      pro_expires_at: expiresAt.toISOString(),
      pro_engagement_type: 'self-serve-trial',
      updated_at: now.toISOString(),
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[trial/start] update failed:', updateError.message);
    return NextResponse.json({ error: 'Failed to start trial. Please try again.' }, { status: 500 });
  }

  await supabase.from('events').insert({
    user_id: profile.id,
    event_type: 'trial_activated',
    event_data: { source: 'self-serve-trial', expires_at: expiresAt.toISOString() },
    user_tier: 'pro',
    tier_change_authorized: true,
  });

  notifyTrialStarted({ email: profile.email || authUser.email || 'unknown' }).catch(() => {});

  return NextResponse.json({
    success: true,
    expiresAt: expiresAt.toISOString(),
    message: `Your 7-day Pro trial is now active. Expires ${expiresAt.toLocaleDateString()}.`,
  });
}
