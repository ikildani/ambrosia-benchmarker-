import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe Checkout Session API
// To enable Stripe payments:
// 1. Add your Stripe keys to .env.local:
//    STRIPE_SECRET_KEY=sk_...
//    STRIPE_PRICE_ID=price_... (create a $99/month recurring price in Stripe Dashboard)
//    NEXT_PUBLIC_APP_URL=https://calculator.ambrosiaventures.co

export async function POST() {
  try {
    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!stripeSecretKey || !priceId) {
      // Stripe not configured - return demo mode response
      return NextResponse.json({
        demo: true,
        message: 'Stripe not configured. Running in demo mode.',
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-01-28.clover',
    });

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
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
      metadata: {
        product: 'deal-calculator-pro',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Checkout error:', error);
    let errorMessage = 'Unknown error';
    let errorType = 'unknown';

    if (error instanceof Stripe.errors.StripeError) {
      errorMessage = error.message;
      errorType = error.type;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session', details: errorMessage, type: errorType },
      { status: 500 }
    );
  }
}
