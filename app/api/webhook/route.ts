import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe Webhook Handler
// To enable webhooks:
// 1. Set STRIPE_WEBHOOK_SECRET in .env.local
// 2. Configure webhook in Stripe Dashboard pointing to /api/webhook
// 3. Select events: checkout.session.completed, customer.subscription.deleted

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return NextResponse.json({ received: true, demo: true });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Handle successful subscription
        console.log('Subscription created:', session.id);
        // TODO: Update user's subscription status in your database
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        // Handle subscription cancellation
        console.log('Subscription cancelled:', subscription.id);
        // TODO: Update user's subscription status in your database
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
