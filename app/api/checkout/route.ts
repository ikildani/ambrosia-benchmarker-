import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { checkoutSchema, formatZodErrors } from '@/lib/api-validation';
import { apiSuccess, apiError } from '@/lib/api-response';

// Stripe Checkout Session API
// Supports two purchase types:
// 1. 'subscription' — $99/month Pro plan (default)
// 2. 'report' — $149 one-time Deal Report
// SECURITY: userId is derived from auth session, never from request body

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';

    if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
      return NextResponse.json({
        demo: true,
        message: 'Stripe not configured. Running in demo mode.',
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

    // --- ONE-TIME DEAL REPORT ($149) ---
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

      return apiSuccess({ url: session.url, reportId: reportPurchase.id });
    }

    // --- SUBSCRIPTION (Pro plan — monthly or annual) ---
    const billingInterval = body.billingInterval || 'monthly';
    const priceId = billingInterval === 'annual'
      ? (process.env.STRIPE_ANNUAL_PRICE_ID?.trim() || process.env.STRIPE_PRICE_ID?.trim())
      : process.env.STRIPE_PRICE_ID?.trim();
    if (!priceId) {
      return NextResponse.json({
        demo: true,
        message: 'Stripe subscription not configured.',
      });
    }

    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${appUrl}?canceled=true`,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      subscription_data: {
        metadata: {
          product: 'deal-calculator-pro',
          user_id: userId ?? '',
          promo_code: promoCode || '',
        },
      },
      metadata: {
        product: 'deal-calculator-pro',
        user_id: userId ?? '',
        promo_code: promoCode || '',
      },
    };

    // Promo code handling (subscription only)
    if (promoCode) {
      const normalizedCode = promoCode.trim().toUpperCase();

      // AMBROSIA code: 7-day free trial — one use per user
      if (normalizedCode === 'AMBROSIA') {
        // Check if this user/email has already used the AMBROSIA code
        const supabase = createServiceClient();
        const checkEmail = customerEmail?.toLowerCase();
        let alreadyUsed = false;

        if (userId) {
          const { data: existing } = await supabase
            .from('sessions')
            .select('id')
            .eq('user_id', userId)
            .like('metadata->>promo_code', 'AMBROSIA')
            .limit(1);
          if (existing && existing.length > 0) alreadyUsed = true;
        }

        // Also check Stripe for any previous trials on this email
        if (!alreadyUsed && checkEmail) {
          const customers = await stripe.customers.list({ email: checkEmail, limit: 1 });
          if (customers.data.length > 0) {
            const subs = await stripe.subscriptions.list({
              customer: customers.data[0].id,
              limit: 10,
            });
            const hadTrial = subs.data.some(
              s => s.metadata?.promo_code === 'AMBROSIA' || s.trial_end !== null
            );
            if (hadTrial) alreadyUsed = true;
          }
        }

        if (alreadyUsed) {
          return apiError('This promo code has already been used on your account.', 400);
        }

        sessionOptions.subscription_data = {
          ...sessionOptions.subscription_data,
          trial_period_days: 7,
        };
      } else {
        let promoId = promoCode;
        if (!promoCode.startsWith('promo_')) {
          const promoCodes = await stripe.promotionCodes.list({
            code: normalizedCode,
            active: true,
            limit: 1,
          });
          if (promoCodes.data.length === 0) {
            return apiError('Invalid or expired promo code. Please try again without the code.', 400);
          }
          promoId = promoCodes.data[0].id;
        }
        sessionOptions.discounts = [{ promotion_code: promoId }];
      }
    } else {
      sessionOptions.allow_promotion_codes = true;
    }

    if (customerEmail) {
      sessionOptions.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);
    return apiSuccess({ url: session.url });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error type:', error.type, 'message:', error.message);
    }
    return apiError('Failed to create checkout session. Please try again.', 500);
  }
}
