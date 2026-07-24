import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

// Stripe Customer Portal API
// Allows customers to manage their subscriptions, update payment methods, and view invoices
// SECURITY: userId is derived from auth session, never from request body

export async function POST(request: NextRequest) {
  // Rate limiting — 10 portal requests per hour
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'billing-portal', { limit: 10, windowSeconds: 3600 });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // SECURITY: Derive userId from auth session
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser?.id || null;
    const email = authUser?.email || null;

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const supabase = createServiceClient();

    // Get Stripe customer ID from database
    let stripeCustomerId: string | null = null;

    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id, email')
        .eq('id', userId)
        .single();

      stripeCustomerId = profile?.stripe_customer_id || null;

      // If no customer ID but we have email, try to find customer in Stripe
      if (!stripeCustomerId && profile?.email) {
        const customers = await stripe.customers.list({
          email: profile.email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
          // Update the profile with the found customer ID
          await supabase
            .from('user_profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', userId);
        }
      }
    } else if (email) {
      // Look up by email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('email', email)
        .single();

      stripeCustomerId = profile?.stripe_customer_id || null;

      // If no customer ID, try to find customer in Stripe
      if (!stripeCustomerId) {
        const customers = await stripe.customers.list({
          email: email,
          limit: 1,
        });
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id;
        }
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No subscription found for this account' },
        { status: 404 }
      );
    }

    // Create a portal configuration with cancellation enabled
    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Ambrosia Ventures, LLC — Manage Your Subscription',
      },
      features: {
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
          },
        },
        subscription_update: {
          enabled: false,
        },
        payment_method_update: {
          enabled: true,
        },
        invoice_history: {
          enabled: true,
        },
        customer_update: {
          enabled: true,
          allowed_updates: ['email', 'name'],
        },
      },
    });

    // Create a billing portal session with explicit configuration
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard`,
      configuration: portalConfig.id,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error:', error.message);
      return NextResponse.json(
        { error: 'Billing portal request failed. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
// Trigger rebuild 1770013907

// Force deployment trigger
