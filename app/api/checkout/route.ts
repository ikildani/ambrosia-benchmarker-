import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe Checkout Session API
// To enable Stripe payments:
// 1. Add your Stripe keys to .env.local:
//    STRIPE_SECRET_KEY=sk_...
//    STRIPE_PRICE_ID=price_... (create a $99/month recurring price in Stripe Dashboard)
//    NEXT_PUBLIC_APP_URL=https://calculator.ambrosiaventures.co
// 2. Enable "Email customers for successful payments" in Stripe Dashboard > Settings > Customer emails

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';

    if (!stripeSecretKey || !priceId) {
      // Stripe not configured - return demo mode response
      return NextResponse.json({
        demo: true,
        message: 'Stripe not configured. Running in demo mode.',
        hasKey: !!stripeSecretKey,
        hasPrice: !!priceId,
      });
    }

    // Verify key format
    if (!stripeSecretKey.startsWith('sk_')) {
      return NextResponse.json({
        error: 'Invalid Stripe key format',
        keyPrefix: stripeSecretKey.substring(0, 10),
      }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey);

    // Get customer info from request body (optional)
    let customerEmail: string | undefined;
    let userId: string | undefined;
    try {
      const body = await request.json();
      customerEmail = body.email;
      userId = body.userId;
    } catch {
      // No body provided, will collect email in checkout
    }

    // Create Checkout Session with enhanced options
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${appUrl}?canceled=true`,
      // Collect billing address for invoices
      billing_address_collection: 'required',
      // Allow promotion codes
      allow_promotion_codes: true,
      // Tax ID collection for business customers
      tax_id_collection: { enabled: true },
      subscription_data: {
        metadata: {
          product: 'deal-calculator-pro',
          user_id: userId || '',
        },
      },
      metadata: {
        product: 'deal-calculator-pro',
        user_id: userId || '',
      },
    };

    // Pre-fill email if provided
    if (customerEmail) {
      sessionOptions.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    // Log detailed error server-side but return generic message to client
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error type:', error.type, 'message:', error.message);
    }
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}
