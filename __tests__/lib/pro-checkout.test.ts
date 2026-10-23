import { buildSubscriptionCheckoutParams, getTrialEligibility, TRIAL_DAYS } from '@/lib/billing/pro-checkout';
import { buildCardTrialStartedEmail, buildTrialEndingEmail, formatPlanAmount } from '@/lib/email/card-trial';

const base = {
  plan: 'pro' as const,
  interval: 'monthly' as const,
  priceId: 'price_123',
  appUrl: 'https://solidus.test',
  userId: 'user-1',
  email: 'a@b.co',
};

describe('buildSubscriptionCheckoutParams', () => {
  it('makes a card-required trial: trial days, card always collected, cancel if the card is removed', () => {
    const p = buildSubscriptionCheckoutParams({ ...base, trial: true, source: 'pricing' });
    expect(p.mode).toBe('subscription');
    expect(p.payment_method_collection).toBe('always');
    expect(p.subscription_data?.trial_period_days).toBe(TRIAL_DAYS);
    expect(p.subscription_data?.trial_settings?.end_behavior?.missing_payment_method).toBe('cancel');
    expect(p.subscription_data?.metadata).toMatchObject({ product: 'deal-calculator-pro', user_id: 'user-1', trial: 'card', source: 'pricing' });
    expect(p.custom_text?.submit?.message).toMatch(/won't be charged today/);
    expect(p.customer_email).toBe('a@b.co');
  });

  it('has no trial fields on a straight subscription', () => {
    const p = buildSubscriptionCheckoutParams({ ...base, trial: false });
    expect(p.subscription_data?.trial_period_days).toBeUndefined();
    expect(p.subscription_data?.trial_settings).toBeUndefined();
    expect(p.custom_text).toBeUndefined();
  });

  it('lets people type a promo code in Checkout unless one is already applied', () => {
    expect(buildSubscriptionCheckoutParams({ ...base, trial: false }).allow_promotion_codes).toBe(true);
    const withCode = buildSubscriptionCheckoutParams({ ...base, trial: false, promotionCodeId: 'promo_9' });
    expect(withCode.discounts).toEqual([{ promotion_code: 'promo_9' }]);
    // Stripe rejects discounts together with allow_promotion_codes.
    expect(withCode.allow_promotion_codes).toBeUndefined();
  });

  it('labels Starter as its own product', () => {
    const p = buildSubscriptionCheckoutParams({ ...base, plan: 'starter', trial: false });
    expect(p.metadata?.product).toBe('deal-calculator-starter');
  });

  it('returns a canceled checkout to a page that exists', () => {
    expect(buildSubscriptionCheckoutParams({ ...base, trial: true }).cancel_url).toBe('https://solidus.test/pro?canceled=true');
  });
});

describe('getTrialEligibility', () => {
  function supabaseWith(profile: Record<string, unknown> | null) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: profile }),
    };
    return { from: () => chain } as never;
  }
  function stripeWith(subCount: number) {
    return {
      customers: { list: async () => ({ data: subCount >= 0 ? [{ id: 'cus_1' }] : [] }) },
      subscriptions: { list: async () => ({ data: Array.from({ length: Math.max(subCount, 0) }, () => ({ id: 'sub' })) }) },
    } as never;
  }

  it('is eligible for a user who only had the old no-card trial', async () => {
    const r = await getTrialEligibility(stripeWith(0), supabaseWith({ stripe_subscription_id: null, subscription_status: 'expired' }), { userId: 'u', email: 'x@y.z' });
    expect(r.eligible).toBe(true);
  });

  it('is not eligible once the profile has held a Stripe subscription', async () => {
    const r = await getTrialEligibility(stripeWith(0), supabaseWith({ stripe_subscription_id: 'sub_1', subscription_status: 'cancelled' }), { userId: 'u', email: 'x@y.z' });
    expect(r.eligible).toBe(false);
  });

  it('is not eligible when the email already has a Stripe subscription (new account, same person)', async () => {
    const r = await getTrialEligibility(stripeWith(1), supabaseWith({ stripe_subscription_id: null, subscription_status: 'none' }), { userId: 'u', email: 'x@y.z' });
    expect(r.eligible).toBe(false);
  });
});

describe('card trial emails', () => {
  const chargesOn = new Date('2026-10-06T12:00:00Z');

  it('formats the plan price', () => {
    expect(formatPlanAmount(29900, 'month')).toBe('$299.00 per month');
    expect(formatPlanAmount(238800, 'year')).toBe('$2,388.00 per year');
    expect(formatPlanAmount(null, 'month')).toBe('the Pro plan price');
  });

  it('states $0 today, the charge date and the amount, and how to cancel', () => {
    const { subject, html } = buildCardTrialStartedEmail({ name: 'Jane Doe', chargesOn, amountLabel: '$299.00 per month' });
    expect(subject).toBe('Your Solidus Pro trial is on');
    expect(html).toContain('Hi Jane,');
    expect(html).toContain('$0.00');
    expect(html).toContain('October 6, 2026');
    expect(html).toContain('$299.00 per month');
    expect(html).toContain('/dashboard?tab=settings');
  });

  it('reminds of the charge and the way out', () => {
    const { subject, html } = buildTrialEndingEmail({ name: null, chargesOn, amountLabel: '$299.00 per month' });
    expect(subject).toContain('October 6, 2026');
    expect(html).toContain('Hi there,');
    expect(html).toContain('will not be charged');
  });

  it('escapes names', () => {
    const { html } = buildCardTrialStartedEmail({ name: '<script>x', chargesOn, amountLabel: '$1' });
    expect(html).not.toContain('<script>x');
  });
});
