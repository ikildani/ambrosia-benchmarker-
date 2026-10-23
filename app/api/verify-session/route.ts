import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return apiError('Missing session_id parameter', 400);
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
      return apiError('Payment verification unavailable', 503);
    }

    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return apiError('Payment not completed', 402);
    }

    const customerEmail =
      session.customer_email ||
      (session.customer && typeof session.customer === 'object'
        ? (session.customer as Stripe.Customer).email
        : null) ||
      '';

    const plan =
      session.metadata?.product === 'deal-calculator-pro' ? 'pro'
        : session.metadata?.product === 'deal-calculator-starter' ? 'starter'
        : 'unknown';

    // Card trial: what the welcome page needs to say "nothing charged until X"
    // and to report the conversion to analytics.
    const subscription = session.subscription && typeof session.subscription === 'object'
      ? (session.subscription as Stripe.Subscription)
      : null;
    const trialing = subscription?.status === 'trialing';
    const price = subscription?.items.data[0]?.price;

    return apiSuccess({
      valid: true,
      email: customerEmail,
      plan,
      trialing,
      trialEndsAt: trialing && subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      /** Recurring price in dollars (not what was charged today). */
      planAmount: price?.unit_amount != null ? price.unit_amount / 100 : null,
      planInterval: price?.recurring?.interval ?? null,
      customerName:
        typeof session.customer === 'object' && session.customer
          ? (session.customer as Stripe.Customer).name || ''
          : '',
    });
  } catch (error: unknown) {
    console.error('Session verification error:', error);
    if (error instanceof Stripe.errors.StripeError) {
      if (error.code === 'resource_missing') {
        return apiError('Invalid session', 404);
      }
    }
    return apiError('Failed to verify session', 500);
  }
}
