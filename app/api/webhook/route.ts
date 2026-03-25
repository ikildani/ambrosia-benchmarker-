import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError, maskEmail } from '@/lib/sentry-api';
import { sendAdminSubscriptionNotification, sendUpgradeConfirmation } from '@/lib/email/client';
import { notifyProSubscription, notifyTrialStarted, notifyReportPurchase } from '@/lib/slack/notify';

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
      console.error('Webhook: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
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

    // Idempotency: insert-first with unique constraint to prevent race conditions.
    // If two concurrent requests try to insert the same event ID, only one succeeds.
    const { error: idempotencyError } = await supabase
      .from('processed_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
      });

    if (idempotencyError) {
      // Unique constraint violation (23505) = duplicate event, safe to skip
      if (idempotencyError.code === '23505') {
        console.log('Webhook: Duplicate event, skipping:', event.id);
        return NextResponse.json({ received: true, duplicate: true });
      }
      // Other insert errors — log but continue processing to avoid losing events
      console.error('Webhook: Idempotency insert error (continuing):', idempotencyError);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', session.id);

        // --- ONE-TIME DEAL REPORT PURCHASE ---
        if (session.metadata?.product === 'deal-report') {
          const reportPurchaseId = session.metadata.report_purchase_id;
          const reportUserId = session.metadata.user_id;

          if (reportPurchaseId) {
            const { error: reportError } = await supabase
              .from('report_purchases')
              .update({
                status: 'completed',
                stripe_session_id: session.id,
                stripe_payment_intent_id: session.payment_intent as string,
                purchased_at: new Date().toISOString(),
              })
              .eq('id', reportPurchaseId);

            if (reportError) {
              console.error('Failed to update report purchase:', reportError);
            } else {
              console.log('Report purchase completed:', reportPurchaseId);
            }

            // Upgrade user to 'report' tier (unless already 'pro')
            if (reportUserId) {
              const { data: existingProfile } = await supabase
                .from('user_profiles')
                .select('tier')
                .eq('id', reportUserId)
                .single();

              if (existingProfile && existingProfile.tier !== 'pro') {
                await supabase
                  .from('user_profiles')
                  .update({ tier: 'report', updated_at: new Date().toISOString() })
                  .eq('id', reportUserId);
                console.log('User upgraded to report tier:', reportUserId);
              }
            }

            // Track purchase event
            await supabase.from('events').insert({
              user_id: reportUserId || null,
              event_type: 'report_purchased',
              event_data: {
                stripe_event_id: event.id,
                report_purchase_id: reportPurchaseId,
                amount_total: session.amount_total,
                currency: session.currency,
              },
              user_tier: 'report',
            });

            // Notify admin of report purchase
            const reportEmail = session.customer_email || session.customer_details?.email;
            sendAdminSubscriptionNotification({
              email: reportEmail || 'unknown',
              type: 'report_purchase',
              amount: session.amount_total || undefined,
            }).catch(err => console.error('Webhook: Admin report notification error:', err));
            notifyReportPurchase({
              email: reportEmail || 'unknown',
              amount: session.amount_total || undefined,
            }).catch(err => console.error('Webhook: Slack report notification error:', err));
          }
          break;
        }

        // --- SUBSCRIPTION PURCHASE ---
        // SECURITY: Use auth-verified userId from metadata first, then email as fallback.
        // This prevents user impersonation via email overlap.
        const customerEmail = session.customer_email || session.customer_details?.email;
        const userId = session.metadata?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        const updatePayload = {
          tier: 'pro' as const,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        };

        let upgraded = false;

        // 1. Primary: lookup by auth-verified userId from checkout metadata
        if (userId) {
          const { error: userIdError } = await supabase
            .from('user_profiles')
            .update(updatePayload)
            .eq('id', userId);

          if (!userIdError) {
            upgraded = true;
            console.log('User upgraded to pro via userId:', userId);
          } else {
            console.warn('userId lookup failed, trying email fallback:', userId, userIdError.message);
          }
        }

        // 2. Fallback: lookup by email (with warning)
        if (!upgraded && customerEmail) {
          console.warn('Using email fallback for subscription upgrade:', customerEmail ? maskEmail(customerEmail) : 'none');
          const { error: emailError } = await supabase
            .from('user_profiles')
            .update(updatePayload)
            .eq('email', customerEmail);

          if (!emailError) {
            upgraded = true;
            console.log('User upgraded to pro via email fallback:', customerEmail ? maskEmail(customerEmail) : 'none');
          } else {
            console.error('Failed to upgrade user by email:', emailError);
          }
        }

        if (!upgraded) {
          console.error('Failed to upgrade any user for checkout session:', session.id);
        }

        await supabase.from('events').insert({
          user_id: userId || null,
          event_type: 'subscription_created',
          event_data: {
            stripe_event_id: event.id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            amount_total: session.amount_total,
            currency: session.currency,
            promo_code: session.metadata?.promo_code || null,
            discount_applied: (session.total_details?.amount_discount || 0) > 0,
            discount_amount: session.total_details?.amount_discount || 0,
          },
          user_tier: 'pro',
        });

        // Notify admin of new subscription
        const promoUsed = session.metadata?.promo_code;
        const isTrial = promoUsed === 'AMBROSIA';
        sendAdminSubscriptionNotification({
          email: customerEmail || 'unknown',
          type: isTrial ? 'trial_started' : 'pro_subscription',
          amount: session.amount_total || undefined,
          promoCode: promoUsed || undefined,
        }).catch(err => console.error('Webhook: Admin subscription notification error:', err));
        const slackNotify = isTrial ? notifyTrialStarted : notifyProSubscription;
        slackNotify({
          email: customerEmail || 'unknown',
          amount: session.amount_total || undefined,
          promoCode: promoUsed || undefined,
        }).catch(err => console.error('Webhook: Slack subscription notification error:', err));

        // Send upgrade confirmation to user
        if (customerEmail) {
          sendUpgradeConfirmation(customerEmail, session.customer_details?.name || 'there')
            .catch(err => console.error('Webhook: Upgrade confirmation email error:', err));
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);

        const customerId = subscription.customer as string;
        const status = subscription.status;

        // Map Stripe status to our tier — but preserve 'report' tier for non-active
        // (report tier comes from one-time purchase, independent of subscription)
        const isActive = ['active', 'trialing'].includes(status);
        let tier: 'pro' | 'report' | 'free' = isActive ? 'pro' : 'free';

        if (!isActive) {
          // Check if user has report tier from a one-time purchase — don't downgrade them
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('tier')
            .eq('stripe_customer_id', customerId)
            .single();
          if (profile?.tier === 'report') {
            tier = 'report';
          }
        }

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
          console.log('Subscription status updated:', customerId, status, '→ tier:', tier);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);

        const customerId = subscription.customer as string;

        // Preserve 'report' tier if user purchased a one-time report
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('stripe_customer_id', customerId)
          .single();
        const downgradeToTier = existingProfile?.tier === 'report' ? 'report' : 'free';

        const { error } = await supabase
          .from('user_profiles')
          .update({
            tier: downgradeToTier,
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

        const invoiceCustomerId = invoice.customer as string;
        const invoiceEmail = invoice.customer_email;
        const invoiceSubId = (invoice as unknown as { subscription: string | null }).subscription;

        // Safety net: ensure paying users are Pro regardless of how the subscription was created.
        // This catches cases where checkout.session.completed was missed or the sub was created in Stripe Dashboard.
        if (invoiceSubId && invoiceEmail) {
          // Try to find and upgrade user by email
          const { data: invoiceProfile } = await supabase
            .from('user_profiles')
            .select('id, tier, stripe_customer_id')
            .eq('email', invoiceEmail)
            .single();

          if (invoiceProfile && invoiceProfile.tier !== 'pro') {
            await supabase
              .from('user_profiles')
              .update({
                tier: 'pro',
                stripe_customer_id: invoiceCustomerId,
                stripe_subscription_id: invoiceSubId,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceProfile.id);
            console.log('User upgraded to pro via invoice payment:', invoiceEmail);

            // Notify admin via Slack
            notifyProSubscription({
              email: invoiceEmail,
            }).catch(err => console.error('Webhook: Slack invoice upgrade notification error:', err));
          } else if (invoiceProfile && !invoiceProfile.stripe_customer_id) {
            // User is already Pro but missing Stripe IDs — backfill them
            await supabase
              .from('user_profiles')
              .update({
                stripe_customer_id: invoiceCustomerId,
                stripe_subscription_id: invoiceSubId,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceProfile.id);
            console.log('Backfilled Stripe IDs for:', invoiceEmail);
          }
        }

        // Track successful payment
        if (invoice.billing_reason === 'subscription_cycle') {
          await supabase.from('events').insert({
            event_type: 'subscription_renewed',
            event_data: {
              stripe_customer_id: invoiceCustomerId,
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
    captureApiError(error, 'webhook');
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
