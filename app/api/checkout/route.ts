import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { checkoutSchema, formatZodErrors } from '@/lib/api-validation';
import { apiSuccess, apiError } from '@/lib/api-response';
import { notifyCheckoutStarted } from '@/lib/slack/notify';
import { buildSubscriptionCheckoutParams, getTrialEligibility, resolveSubscriptionPriceId } from '@/lib/billing/pro-checkout';

// Stripe Checkout Session API
// Supports three purchase types:
// 1. 'subscription' — Pro plan (default), optionally as a card-required 7-day trial
// 2. 'starter' — Starter plan
// 3. 'report' — $499 one-time Deal Report
// SECURITY: userId is derived from auth session, never from request body

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';

    if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
      console.error('[checkout] STRIPE_SECRET_KEY not configured or invalid');
      return NextResponse.json({
        error: 'Checkout is temporarily unavailable. Please contact support@ambrosiaventures.co.',
        demo: true,
      });
    }

    const stripe = new Stripe(stripeSecretKey);

    let rawBody: Record<string, unknown> = {};
    try {
      rawBody = await request.json();
    } catch {
      // No body provided
    }
    const parsed = checkoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }
    const body = parsed.data;

    // SECURITY: Derive userId from auth session, not from request body
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser?.id || null;
    const customerEmail = body.email || authUser?.email || undefined;
    const promoCode = body.promoCode;
    const purchaseType = body.purchaseType;

    // --- ONE-TIME DEAL REPORT ($499) ---
    if (purchaseType === 'report') {
      const reportPriceId = process.env.STRIPE_REPORT_PRICE_ID?.trim();
      if (!reportPriceId) {
        return apiError('Report pricing not configured', 500);
      }

      const calculationData = body.calculationData!; // Zod refine guarantees this exists for report

      // Create report_purchase record
      const supabase = createServiceClient();
      const { data: reportPurchase, error: insertError } = await supabase
        .from('report_purchases')
        .insert({
          user_id: userId || null,
          email: customerEmail || null,
          calculation_inputs: calculationData.inputs,
          calculation_results: calculationData.results,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !reportPurchase) {
        console.error('Failed to create report purchase:', insertError);
        return apiError('Failed to initiate report purchase', 500);
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: reportPriceId, quantity: 1 }],
        success_url: `${appUrl}/calculator?report=${reportPurchase.id}&success=true${body.shareToken ? `&token=${body.shareToken}` : ''}`,
        cancel_url: `${appUrl}/calculator?canceled=true`,
        metadata: {
          product: 'deal-report',
          report_purchase_id: reportPurchase.id,
          user_id: userId ?? '',
        },
        ...(customerEmail ? { customer_email: customerEmail } : {}),
      });

      // Notify Slack that checkout started (payment pending)
      notifyCheckoutStarted({
        email: customerEmail || 'anonymous',
        type: 'report',
      }).catch(() => {});

      return apiSuccess({ url: session.url, reportId: reportPurchase.id });
    }

    // --- SUBSCRIPTION (Pro or Starter plan — monthly or annual) ---
    const billingInterval = body.billingInterval || 'monthly';
    const plan = body.purchaseType === 'starter' ? 'starter' as const : 'pro' as const;
    const priceId = resolveSubscriptionPriceId(plan, billingInterval);
    if (!priceId) {
      console.error('[checkout] STRIPE_PRICE_ID not configured for billing interval:', billingInterval);
      return NextResponse.json({
        error: 'Checkout is temporarily unavailable. Please contact support@ambrosiaventures.co.',
        demo: true,
      });
    }

    // A promo code arrives either as a Stripe promotion-code id (validated by
    // /api/promo/validate) or as the customer-facing code. Anything else is
    // typed straight into Stripe Checkout, which accepts promotion codes.
    let promotionCodeId: string | undefined;
    if (promoCode) {
      if (promoCode.startsWith('promo_')) {
        promotionCodeId = promoCode;
      } else {
        const promoCodes = await stripe.promotionCodes.list({
          code: promoCode.trim().toUpperCase(),
          active: true,
          limit: 1,
        });
        if (promoCodes.data.length === 0) {
          return apiError('That promo code is invalid or has expired. You can also enter a code on the checkout page.', 400);
        }
        promotionCodeId = promoCodes.data[0].id;
      }
    }

    // Card-required trial: only when asked for and only once per person.
    // Not eligible falls through to a normal subscription checkout rather than
    // an error, so the button still leads somewhere.
    let trial = false;
    if (body.trial && plan === 'pro') {
      const eligibility = await getTrialEligibility(stripe, createServiceClient(), { userId, email: customerEmail });
      trial = eligibility.eligible;
    }

    const session = await stripe.checkout.sessions.create(buildSubscriptionCheckoutParams({
      plan,
      interval: billingInterval,
      priceId,
      appUrl,
      userId,
      email: customerEmail,
      trial,
      promotionCodeId,
      source: body.source,
    }));

    notifyCheckoutStarted({
      email: customerEmail || 'anonymous',
      type: trial ? 'trial' : billingInterval === 'annual' ? 'annual' : 'pro',
    }).catch(() => {});

    return apiSuccess({ url: session.url, trial });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error type:', error.type, 'message:', error.message);
    }
    return apiError('Failed to create checkout session. Please try again.', 500);
  }
}
