import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

// Stripe Webhook Handler
// To enable webhooks:
// 1. Set STRIPE_WEBHOOK_SECRET in .env.local
// 2. Configure webhook in Stripe Dashboard pointing to /api/webhook
// 3. Select events: checkout.session.completed, customer.subscription.updated,
//    customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      console.log('Webhook: Stripe not configured, demo mode');
      return NextResponse.json({ received: true, demo: true });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', session.id);

        // Get customer email from session
        const customerEmail = session.customer_email || session.customer_details?.email;
        const userId = session.metadata?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (customerEmail) {
          // Update user tier in database
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              tier: 'pro',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('email', customerEmail);

          if (updateError) {
            console.error('Failed to update user tier:', updateError);
            // Try by user_id if email lookup failed
            if (userId) {
              await supabase
                .from('user_profiles')
                .update({
                  tier: 'pro',
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  subscription_status: 'active',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
            }
          } else {
            console.log('User upgraded to pro:', customerEmail);
          }

          // Track upgrade event
          await supabase.from('events').insert({
            user_id: userId || null,
            event_type: 'subscription_created',
            event_data: {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              email: customerEmail,
              amount_total: session.amount_total,
              currency: session.currency,
            },
            user_tier: 'pro',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);

        const customerId = subscription.customer as string;
        const status = subscription.status;

        // Map Stripe status to our tier
        const isActive = ['active', 'trialing'].includes(status);
        const tier = isActive ? 'pro' : 'free';

        const { error } = await supabase
          .from('user_profiles')
          .update({
            tier,
            subscription_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Failed to update subscription status:', error);
        } else {
          console.log('Subscription status updated:', customerId, status);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);

        const customerId = subscription.customer as string;

        // Downgrade user to free tier
        const { error } = await supabase
          .from('user_profiles')
          .update({
            tier: 'free',
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Failed to downgrade user:', error);
        } else {
          console.log('User downgraded to free:', customerId);
        }

        // Track cancellation event
        await supabase.from('events').insert({
          event_type: 'subscription_cancelled',
          event_data: {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            cancel_reason: subscription.cancellation_details?.reason,
          },
          user_tier: 'free',
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);

        // Track successful payment (useful for renewals)
        if (invoice.billing_reason === 'subscription_cycle') {
          const customerId = invoice.customer as string;

          await supabase.from('events').insert({
            event_type: 'subscription_renewed',
            event_data: {
              stripe_customer_id: customerId,
              invoice_id: invoice.id,
              amount_paid: invoice.amount_paid,
              currency: invoice.currency,
            },
            user_tier: 'pro',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);

        const customerId = invoice.customer as string;

        // Update subscription status but don't immediately downgrade
        // Stripe will retry and eventually cancel if all retries fail
        await supabase
          .from('user_profiles')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        // Track payment failure
        await supabase.from('events').insert({
          event_type: 'payment_failed',
          event_data: {
            stripe_customer_id: customerId,
            invoice_id: invoice.id,
            attempt_count: invoice.attempt_count,
          },
          user_tier: 'pro',
        });
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
