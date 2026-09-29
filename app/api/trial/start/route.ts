import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { notifyCheckoutStarted } from '@/lib/slack/notify';
import {
  TRIAL_DAYS,
  buildSubscriptionCheckoutParams,
  getTrialEligibility,
  resolveSubscriptionPriceId,
  type BillingInterval,
} from '@/lib/billing/pro-checkout';

export const dynamic = 'force-dynamic';

// Pro trials are card-required (2026-09-29). This route no longer switches a
// profile to Pro by itself: POST opens a Stripe Checkout session with a
// TRIAL_DAYS trial, and the Stripe webhook turns Pro on once the card is
// saved. GET tells the UI whether to label the button "Start free trial" or
// "Start Pro".

function stripeOrNull(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key && key.startsWith('sk_') ? new Stripe(key) : null;
}

export async function GET(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  const stripe = stripeOrNull();
  // Signed-out visitors are eligible until proven otherwise: they have no account yet.
  if (!authUser?.id || !stripe) {
    return NextResponse.json({ eligible: true, trialDays: TRIAL_DAYS });
  }
  try {
    const eligibility = await getTrialEligibility(stripe, createServiceClient(), {
      userId: authUser.id,
      email: authUser.email,
    });
    return NextResponse.json({ ...eligibility, trialDays: TRIAL_DAYS });
  } catch (err) {
    console.error('[trial/start] eligibility check failed:', err instanceof Error ? err.message : err);
    // Fail open on the label only; POST re-checks before granting a trial.
    return NextResponse.json({ eligible: true, trialDays: TRIAL_DAYS });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthenticatedUser(request);
  if (!authUser?.id) {
    return NextResponse.json({ error: 'Please sign in to start your trial.' }, { status: 401 });
  }

  const stripe = stripeOrNull();
  if (!stripe) {
    console.error('[trial/start] STRIPE_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please contact support@ambrosiaventures.co.' }, { status: 503 });
  }

  let body: { billingInterval?: string; source?: string } = {};
  try { body = await request.json(); } catch { /* no body */ }
  const interval: BillingInterval = body.billingInterval === 'annual' ? 'annual' : 'monthly';
  const source = typeof body.source === 'string' ? body.source.slice(0, 40) : undefined;

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, tier, subscription_status, stripe_subscription_id')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.stripe_subscription_id && ['active', 'trialing'].includes(profile.subscription_status ?? '')) {
    return NextResponse.json({ alreadyActive: true, message: 'You already have Pro.' });
  }

  const priceId = resolveSubscriptionPriceId('pro', interval);
  if (!priceId) {
    console.error('[trial/start] STRIPE_PRICE_ID not configured for', interval);
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please contact support@ambrosiaventures.co.' }, { status: 503 });
  }

  const email = profile?.email || authUser.email || undefined;
  try {
    const eligibility = await getTrialEligibility(stripe, supabase, { userId: authUser.id, email });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';
    const session = await stripe.checkout.sessions.create(buildSubscriptionCheckoutParams({
      plan: 'pro',
      interval,
      priceId,
      appUrl,
      userId: authUser.id,
      email,
      trial: eligibility.eligible,
      source,
    }));

    notifyCheckoutStarted({
      email: email || 'unknown',
      type: eligibility.eligible ? 'trial' : interval === 'annual' ? 'annual' : 'pro',
    }).catch(() => {});

    return NextResponse.json({ url: session.url, trial: eligibility.eligible, reason: eligibility.reason });
  } catch (err) {
    console.error('[trial/start] checkout session failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not open checkout. Please try again.' }, { status: 500 });
  }
}
