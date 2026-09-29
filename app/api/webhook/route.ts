import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError, maskEmail } from '@/lib/sentry-api';
import { sendAdminSubscriptionNotification, sendUpgradeConfirmation, sendEmail } from '@/lib/email/client';
import { notifyProSubscription, notifyTrialStarted, notifyTrialConverted, notifyReportPurchase, notifyPaymentFailed } from '@/lib/slack/notify';
import { buildCardTrialStartedEmail, buildTrialEndingEmail, formatPlanAmount } from '@/lib/email/card-trial';
import { markBriefInvoicePaid, BRIEF_INVOICE_METADATA_KEY } from '@/lib/brief/invoice';

// Stripe Webhook Handler
// To enable webhooks:
// 1. Set STRIPE_WEBHOOK_SECRET in .env.local
// 2. Configure webhook in Stripe Dashboard pointing to /api/webhook
// 3. Select events: checkout.session.completed, customer.subscription.updated,
//    customer.subscription.deleted, customer.subscription.trial_will_end,
//    invoice.payment_succeeded, invoice.payment_failed

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
          // Stripe always collects email at checkout — capture it (normalized to lowercase
          // so the .eq('email', …) lookup below matches our stored email convention).
          const customerEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase() || null;

          if (reportPurchaseId) {
            const { error: reportError } = await supabase
              .from('report_purchases')
              .update({
                status: 'completed',
                email: customerEmail,
                stripe_session_id: session.id,
                stripe_payment_intent_id: session.payment_intent as string,
                purchased_at: new Date().toISOString(),
              })
              .eq('id', reportPurchaseId);

            if (reportError) {
              console.error('Failed to update report purchase:', reportError);
            } else {
              console.log('Report purchase completed:', reportPurchaseId, 'email:', customerEmail);
            }

            // Upgrade user to 'report' tier (unless already 'pro')
            // Try by user_id first, then fall back to email match
            let upgradedUserId = reportUserId;
            if (!upgradedUserId && customerEmail) {
              const { data: profileByEmail } = await supabase
                .from('user_profiles')
                .select('id, tier')
                .eq('email', customerEmail)
                .single();
              if (profileByEmail) upgradedUserId = profileByEmail.id;
            }

            if (upgradedUserId) {
              const { data: existingProfile } = await supabase
                .from('user_profiles')
                .select('tier')
                .eq('id', upgradedUserId)
                .single();

              if (existingProfile && existingProfile.tier !== 'pro') {
                await supabase
                  .from('user_profiles')
                  .update({ tier: 'report', tier_change_authorized: true, updated_at: new Date().toISOString() })
                  .eq('id', upgradedUserId);
                console.log('User upgraded to report tier:', upgradedUserId);
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
              user_tier: 'report', tier_change_authorized: true,
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

            // Mark lead as converted (stops drip emails)
            if (customerEmail) {
              await supabase.from('leads')
                .update({ converted_at: new Date().toISOString() })
                .eq('email', customerEmail.toLowerCase().trim());
            }
          }
          break;
        }

        // --- SUBSCRIPTION PURCHASE ---
        // SECURITY: Use auth-verified userId from metadata first, then email as fallback.
        // This prevents user impersonation via email overlap.
        // Email normalized to lowercase so the fallback .eq('email', …) lookup matches.
        const customerEmail = (session.customer_email || session.customer_details?.email || '').trim().toLowerCase() || null;
        const userId = session.metadata?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        const subscriptionTier = session.metadata?.product === 'deal-calculator-starter' ? 'starter' as const : 'pro' as const;

        // Card trials (2026-09-29) come back as a `trialing` subscription.
        // Read the real status rather than assuming 'active'.
        let subscription: Stripe.Subscription | null = null;
        if (subscriptionId) {
          try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
          } catch (subErr) {
            console.error('Webhook: subscription retrieve failed:', subErr instanceof Error ? subErr.message : subErr);
          }
        }
        const isCardTrial = subscription?.status === 'trialing';
        const trialEndsAt = subscription?.trial_end ? new Date(subscription.trial_end * 1000) : null;
        const nowIso = new Date().toISOString();
        const updatePayload = {
          tier: subscriptionTier, tier_change_authorized: true,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: subscription?.status ?? 'active',
          pro_activated_at: nowIso,
          // Stripe now owns this subscription's end date. A leftover
          // pro_expires_at from an earlier no-card trial would make the
          // pro-expiration cron downgrade a paying customer.
          pro_expires_at: null,
          pro_engagement_type: 'stripe',
          updated_at: nowIso,
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

        // 2. Fallback: lookup by email (case-insensitive)
        if (!upgraded && customerEmail) {
          console.warn('Using email fallback for subscription upgrade:', customerEmail ? maskEmail(customerEmail) : 'none');
          const { error: emailError } = await supabase
            .from('user_profiles')
            .update(updatePayload)
            .ilike('email', customerEmail);

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
          user_tier: 'pro', tier_change_authorized: true,
        });

        if (isCardTrial) {
          await supabase.from('events').insert({
            user_id: userId || null,
            event_type: 'trial_activated',
            event_data: {
              source: 'card-trial',
              checkout_source: session.metadata?.source || null,
              stripe_subscription_id: subscriptionId,
              expires_at: trialEndsAt?.toISOString() ?? null,
            },
            user_tier: 'pro',
          });
        }

        // Notify admin of new subscription or trial
        const promoUsed = session.metadata?.promo_code;
        sendAdminSubscriptionNotification({
          email: customerEmail || 'unknown',
          type: isCardTrial ? 'trial_started' : 'pro_subscription',
          amount: session.amount_total || undefined,
          promoCode: promoUsed || undefined,
        }).catch(err => console.error('Webhook: Admin subscription notification error:', err));
        const slackNotify = isCardTrial
          ? notifyTrialStarted({ email: customerEmail || 'unknown', promoCode: promoUsed || undefined, chargesOn: trialEndsAt ?? undefined })
          : notifyProSubscription({ email: customerEmail || 'unknown', amount: session.amount_total || undefined, promoCode: promoUsed || undefined });
        slackNotify.catch(err => console.error('Webhook: Slack subscription notification error:', err));

        // Tell the user what they have and, for a trial, exactly when and how
        // much the card is charged.
        if (customerEmail) {
          const customerName = session.customer_details?.name || null;
          if (isCardTrial && trialEndsAt) {
            const price = subscription?.items.data[0]?.price;
            const { subject, html } = buildCardTrialStartedEmail({
              name: customerName,
              chargesOn: trialEndsAt,
              amountLabel: formatPlanAmount(price?.unit_amount, price?.recurring?.interval, price?.currency),
            });
            sendEmail({ to: customerEmail, subject, html, replyTo: 'ikildani@ambrosiaventures.co' })
              .catch(err => console.error('Webhook: Trial started email error:', err));
          } else {
            sendUpgradeConfirmation(customerEmail, customerName || 'there')
              .catch(err => console.error('Webhook: Upgrade confirmation email error:', err));
          }
        }

        // Mark lead as converted (stops drip emails)
        if (customerEmail) {
          await supabase.from('leads')
            .update({ converted_at: new Date().toISOString() })
            .eq('email', customerEmail.toLowerCase().trim());
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
        const subProduct = subscription.metadata?.product;
        const activeTier = subProduct === 'deal-calculator-starter' ? 'starter' as const : 'pro' as const;
        let tier: 'starter' | 'pro' | 'report' | 'free' = isActive ? activeTier : 'free';

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

        // Trial -> paid: the first charge went through.
        const previousStatus = (event.data.previous_attributes as Partial<Stripe.Subscription> | undefined)?.status;
        if (previousStatus === 'trialing' && status === 'active') {
          const { data: convertedProfile } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          const price = subscription.items.data[0]?.price;
          await supabase.from('events').insert({
            user_id: convertedProfile?.id ?? null,
            event_type: 'trial_converted',
            event_data: {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              amount: price?.unit_amount ?? null,
              interval: price?.recurring?.interval ?? null,
            },
            user_tier: 'pro',
          });
          notifyTrialConverted({
            email: convertedProfile?.email || 'unknown',
            amount: price?.unit_amount ?? undefined,
          }).catch(err => console.error('Webhook: Slack trial converted error:', err));
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe sends this 3 days before a trial ends. The trial-started
        // email promised this reminder.
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.status !== 'trialing' || !subscription.trial_end) break;
        const customerId = subscription.customer as string;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        if (!profile?.email) {
          console.warn('Webhook: trial_will_end with no matching profile:', customerId);
          break;
        }
        const price = subscription.items.data[0]?.price;
        const { subject, html } = buildTrialEndingEmail({
          name: profile.full_name,
          chargesOn: new Date(subscription.trial_end * 1000),
          amountLabel: formatPlanAmount(price?.unit_amount, price?.recurring?.interval, price?.currency),
        });
        const result = await sendEmail({ to: profile.email, subject, html, replyTo: 'ikildani@ambrosiaventures.co' });
        if (result.success) {
          await supabase.from('events').insert({
            user_id: profile.id,
            event_type: 'trial_ending_reminder_sent',
            event_data: { stripe_subscription_id: subscription.id, trial_end: subscription.trial_end },
            user_tier: 'pro',
          });
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
          .select('id, email, full_name, tier')
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

        // Send win-back email with 50% off reactivation offer
        if (existingProfile?.email) {
          try {
            const { buildSubscriptionWinbackEmail } = await import('@/lib/email/winback');
            const { sendEmail } = await import('@/lib/email/client');
            const { subject, html } = buildSubscriptionWinbackEmail(existingProfile.full_name || existingProfile.email);
            const result = await sendEmail({ to: existingProfile.email, subject, html });
            if (result.success) {
              await supabase.from('events').insert({
                user_id: existingProfile.id,
                event_type: 'subscription_winback_email_sent',
                event_data: { email: existingProfile.email, stripe_customer_id: customerId },
              });
            }
          } catch (emailErr) {
            console.error('Win-back email failed:', emailErr);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);

        const invoiceCustomerId = invoice.customer as string;
        const invoiceEmail = invoice.customer_email ? invoice.customer_email.trim().toLowerCase() : null;
        const invoiceSubId = (invoice as unknown as { subscription: string | null }).subscription;

        // ─── Deal Intelligence Brief invoice (lib/brief/invoice.ts) ───
        if (invoice.metadata?.[BRIEF_INVOICE_METADATA_KEY]) {
          try {
            const briefRequestId = await markBriefInvoicePaid(supabase, invoice);
            console.log(`Brief invoice paid: ${invoice.id} → request ${briefRequestId}`);
            await sendEmail({
              to: 'ikildani@ambrosiaventures.co',
              subject: `Brief invoice paid: ${invoice.number ?? invoice.id} — $${(invoice.amount_paid / 100).toLocaleString()}`,
              html: `<p>Invoice <strong>${invoice.number ?? invoice.id}</strong> for the Deal Intelligence Brief was paid (${invoiceEmail ?? 'unknown payer'}, $${(invoice.amount_paid / 100).toLocaleString()}). The request is marked paid in <a href="https://solidus.ambrosiaventures.co/admin/briefs">/admin/briefs</a>; schedule the 15-minute call.</p>`,
            }).catch(() => undefined);
          } catch (e) {
            console.error('[webhook] brief invoice mark-paid failed:', e instanceof Error ? e.message : e);
          }
          break; // ours — not a Pro engagement or a subscription
        }

        // ─── R72: One-time invoice Pro activation (3-month engagements) ───
        // If this is a non-subscription invoice (no sub ID) with engagement
        // metadata, activate Pro with a 3-month expiration and send
        // confirmation email. This handles Mehdi-style custom engagements
        // where payment is via invoice, not subscription.
        const engagementType = invoice.metadata?.engagement;
        if (!invoiceSubId && engagementType && invoiceEmail) {
          const { data: engProfile } = await supabase
            .from('user_profiles')
            .select('id, full_name, tier')
            .eq('email', invoiceEmail)
            .single();

          if (engProfile) {
            const now = new Date();
            // Default 3 months; parse from metadata if present
            const months = engagementType.includes('6-month') ? 6 : engagementType.includes('12-month') ? 12 : 3;
            const expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + months);

            await supabase
              .from('user_profiles')
              .update({
                tier: 'pro', tier_change_authorized: true,
                subscription_status: 'active',
                stripe_customer_id: invoiceCustomerId,
                pro_activated_at: now.toISOString(),
                pro_expires_at: expiresAt.toISOString(),
                pro_engagement_type: engagementType,
                updated_at: now.toISOString(),
              })
              .eq('id', engProfile.id);
            console.log(`Pro activated via invoice for ${invoiceEmail}: expires ${expiresAt.toISOString()}`);

            // Send confirmation email
            try {
              const { sendProEngagementConfirmation } = await import('@/lib/email/pro-engagement');
              await sendProEngagementConfirmation({
                to: invoiceEmail,
                name: engProfile.full_name || '',
                expiresAt,
                months,
              });
              console.log(`Pro confirmation email sent to ${invoiceEmail}`);
            } catch (emailErr) {
              console.error('Pro confirmation email failed:', emailErr);
            }

            // Notify admin via Slack
            notifyProSubscription({
              email: invoiceEmail,
            }).catch(err => console.error('Webhook: Slack engagement notification error:', err));

            // Track engagement activation
            await supabase.from('events').insert({
              event_type: 'pro_engagement_activated',
              event_data: {
                stripe_customer_id: invoiceCustomerId,
                invoice_id: invoice.id,
                amount_paid: invoice.amount_paid,
                currency: invoice.currency,
                engagement_type: engagementType,
                months,
                expires_at: expiresAt.toISOString(),
              },
              user_id: engProfile.id,
              user_tier: 'pro', tier_change_authorized: true,
            });

            // Mark lead as converted (stops drip emails)
            await supabase.from('leads')
              .update({ converted_at: new Date().toISOString() })
              .eq('email', invoiceEmail);
          }
          break; // handled — skip the subscription path
        }

        // ─── Subscription invoice path (existing logic) ───
        if (invoiceSubId && invoiceEmail) {
          const { data: invoiceProfile } = await supabase
            .from('user_profiles')
            .select('id, tier, stripe_customer_id')
            .eq('email', invoiceEmail)
            .single();

          // The $0 invoice that opens a card trial arrives here too; keep
          // the profile's status in step with Stripe's.
          let invoiceSubStatus: string = 'active';
          try {
            invoiceSubStatus = (await stripe.subscriptions.retrieve(invoiceSubId)).status;
          } catch { /* keep 'active' */ }

          if (invoiceProfile && invoiceProfile.tier !== 'pro') {
            await supabase
              .from('user_profiles')
              .update({
                tier: 'pro', tier_change_authorized: true,
                stripe_customer_id: invoiceCustomerId,
                stripe_subscription_id: invoiceSubId,
                subscription_status: invoiceSubStatus,
                pro_expires_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', invoiceProfile.id);
            console.log('User upgraded to pro via invoice payment:', invoiceEmail);

            notifyProSubscription({
              email: invoiceEmail,
            }).catch(err => console.error('Webhook: Slack invoice upgrade notification error:', err));
          } else if (invoiceProfile && !invoiceProfile.stripe_customer_id) {
            await supabase
              .from('user_profiles')
              .update({
                stripe_customer_id: invoiceCustomerId,
                stripe_subscription_id: invoiceSubId,
                subscription_status: invoiceSubStatus,
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
            user_tier: 'pro', tier_change_authorized: true,
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
          user_tier: 'pro', tier_change_authorized: true,
        });

        // Notify Slack of payment failure
        notifyPaymentFailed({
          email: invoice.customer_email || 'unknown',
          type: 'pro',
          amount: invoice.amount_due,
          reason: `Attempt ${invoice.attempt_count} failed`,
        }).catch(() => {});
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
