import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe Checkout Session API
// To enable Stripe payments:
// 1. Add your Stripe keys to .env.local:
//    STRIPE_SECRET_KEY=sk_...
//    STRIPE_PRICE_ID=price_... (create a $150/month recurring price in Stripe Dashboard)
//    NEXT_PUBLIC_APP_URL=https://your-domain.com

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

    const stripe = new Stripe(stripeSecretKey);

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
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
