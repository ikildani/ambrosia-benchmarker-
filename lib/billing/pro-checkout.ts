import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

// Pro subscription checkout, shared by /api/checkout and /api/trial/start.
//
// Trials are card-required (2026-09-29): a trial is a Stripe subscription in
// `trialing` status. Stripe collects the card up front, charges it when the
// 7 days end, and cancels the subscription if the card is removed. Nothing in
// our crons expires these trials; Stripe's webhooks drive the profile.

export const TRIAL_DAYS = 7;

export type BillingInterval = 'monthly' | 'annual';
export type SubscriptionPlan = 'pro' | 'starter';

export interface TrialEligibility {
  eligible: boolean;
  /** Why not, in words a user can read. Only set when not eligible. */
  reason?: string;
}

interface ProfileForEligibility {
  stripe_subscription_id: string | null;
  subscription_status: string | null;
}

/**
 * One card trial per person. A previous no-card trial (the pre-2026-09-29
 * auto-trial at signup) does not count: those users never gave a card, so they
 * get one card trial. Anyone who has held a Stripe subscription, trial or
 * paid, under this profile or this email does not.
 */
export async function getTrialEligibility(
  stripe: Stripe,
  supabase: SupabaseClient,
  { userId, email }: { userId: string | null; email: string | null | undefined },
): Promise<TrialEligibility> {
  if (userId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .maybeSingle<ProfileForEligibility>();

    if (profile?.stripe_subscription_id) {
      return { eligible: false, reason: 'Your account has already used its free trial.' };
    }
    if (profile?.subscription_status && ['trialing', 'past_due', 'cancelled'].includes(profile.subscription_status)) {
      return { eligible: false, reason: 'Your account has already used its free trial.' };
    }
  }

  if (email) {
    const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 3 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 1 });
      if (subs.data.length > 0) {
        return { eligible: false, reason: 'This email has already used its free trial.' };
      }
    }
  }

  return { eligible: true };
}

export function resolveSubscriptionPriceId(plan: SubscriptionPlan, interval: BillingInterval): string | undefined {
  if (plan === 'starter') {
    return interval === 'annual'
      ? (process.env.STRIPE_STARTER_ANNUAL_PRICE_ID?.trim() || process.env.STRIPE_STARTER_PRICE_ID?.trim())
      : process.env.STRIPE_STARTER_PRICE_ID?.trim();
  }
  return interval === 'annual'
    ? (process.env.STRIPE_ANNUAL_PRICE_ID?.trim() || process.env.STRIPE_PRICE_ID?.trim())
    : process.env.STRIPE_PRICE_ID?.trim();
}

export interface SubscriptionCheckoutOptions {
  plan: SubscriptionPlan;
  interval: BillingInterval;
  priceId: string;
  appUrl: string;
  userId: string | null;
  email: string | undefined;
  /** Start with a card-required TRIAL_DAYS trial. Caller checks eligibility. */
  trial: boolean;
  /** A Stripe promotion code id (promo_...) applied up front, e.g. from a campaign link. */
  promotionCodeId?: string;
  /** Where the user clicked, for attribution (pricing, paywall, trial_page, ...). */
  source?: string;
}

export function buildSubscriptionCheckoutParams(opts: SubscriptionCheckoutOptions): Stripe.Checkout.SessionCreateParams {
  const product = opts.plan === 'starter' ? 'deal-calculator-starter' : 'deal-calculator-pro';
  const metadata: Record<string, string> = {
    product,
    user_id: opts.userId ?? '',
    billing_interval: opts.interval,
    trial: opts.trial ? 'card' : '',
    source: opts.source ?? '',
    promo_code: opts.promotionCodeId ?? '',
  };

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = { metadata };
  if (opts.trial) {
    subscriptionData.trial_period_days = TRIAL_DAYS;
    // If the card is removed before the trial ends, end the subscription
    // rather than leaving an unpaid invoice.
    subscriptionData.trial_settings = { end_behavior: { missing_payment_method: 'cancel' } };
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: opts.priceId, quantity: 1 }],
    // A trial must still collect a card: that is the whole point of it.
    payment_method_collection: 'always',
    success_url: `${opts.appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.appUrl}/pro?canceled=true`,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    subscription_data: subscriptionData,
    metadata,
  };

  if (opts.trial) {
    params.custom_text = {
      submit: {
        message: `You won't be charged today. Your ${TRIAL_DAYS}-day trial starts now; we'll email you 3 days before it ends, and you can cancel in two clicks from your account.`,
      },
    };
  }

  // Stripe does not allow `discounts` and `allow_promotion_codes` together.
  if (opts.promotionCodeId) {
    params.discounts = [{ promotion_code: opts.promotionCodeId }];
  } else {
    params.allow_promotion_codes = true;
  }

  if (opts.email) params.customer_email = opts.email;

  return params;
}
