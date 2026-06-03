#!/usr/bin/env npx tsx
/**
 * One-time reconciliation for orphaned Pro subscriptions.
 *
 * Background: a visitor could subscribe via /api/checkout before creating an
 * account. At payment time the Stripe webhook had no user_profiles row to
 * upgrade (its email fallback updated 0 rows), so the paid Pro entitlement
 * was never attached. The auth/callback fix now self-heals these accounts on
 * the user's next login — but accounts that paid and never returned (or whose
 * profile row predated the Stripe customer) stay stuck on the 'free' tier.
 *
 * This script walks every active/trialing Stripe subscription, matches it to a
 * user_profiles row by email, and upgrades any that aren't already Pro.
 *
 * Safety: DRY-RUN by default. It prints exactly what it would change and
 * writes nothing. Pass --apply to perform the updates.
 *
 * Usage:
 *   npx tsx scripts/reconcile-orphaned-subscriptions.ts            # dry run
 *   npx tsx scripts/reconcile-orphaned-subscriptions.ts --apply    # write
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('Missing or invalid STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY);

type Outcome = 'upgraded' | 'already-pro' | 'no-account' | 'no-email' | 'skipped-non-active';

const summary: Record<Outcome, number> = {
  'upgraded': 0,
  'already-pro': 0,
  'no-account': 0,
  'no-email': 0,
  'skipped-non-active': 0,
};

const noAccountEmails: string[] = [];

async function emailForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  // customer is expanded to the full object via the list call below.
  const customer = sub.customer;
  if (customer && typeof customer === 'object' && !('deleted' in customer && customer.deleted)) {
    const email = (customer as Stripe.Customer).email;
    if (email) return email.trim().toLowerCase();
  }
  // Fallback: latest invoice / subscription-level email
  if (typeof customer === 'string') {
    const fetched = await stripe.customers.retrieve(customer);
    if (!('deleted' in fetched) && fetched.email) return fetched.email.trim().toLowerCase();
  }
  return null;
}

async function reconcileSub(sub: Stripe.Subscription) {
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    summary['skipped-non-active']++;
    return;
  }

  const email = await emailForSubscription(sub);
  if (!email) {
    summary['no-email']++;
    console.log(`  [no-email] subscription ${sub.id} has no resolvable customer email`);
    return;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, tier, stripe_customer_id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    summary['no-account']++;
    noAccountEmails.push(email);
    console.log(`  [no-account] ${email} — paid (${sub.status}) but no profile; self-heals on next login`);
    return;
  }

  if (profile.tier === 'pro') {
    summary['already-pro']++;
    return;
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  console.log(`  [upgrade] ${email} — tier '${profile.tier}' → 'pro' (sub ${sub.id}, ${sub.status})${APPLY ? '' : '  [dry-run]'}`);

  if (APPLY) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        tier: 'pro',
        tier_change_authorized: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      console.error(`    write failed for ${email}: ${error.message}`);
      return;
    }
  }
  summary['upgraded']++;
}

async function main() {
  console.log(`\nReconciling orphaned Pro subscriptions — ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}\n`);

  for (const status of ['active', 'trialing'] as const) {
    console.log(`Scanning ${status} subscriptions...`);
    const params: Stripe.SubscriptionListParams = {
      status,
      limit: 100,
      expand: ['data.customer'],
    };
    for await (const sub of stripe.subscriptions.list(params)) {
      await reconcileSub(sub);
    }
  }

  console.log('\n──────── Summary ────────');
  console.log(`Upgraded to Pro:       ${summary['upgraded']}${APPLY ? '' : ' (would upgrade)'}`);
  console.log(`Already Pro:           ${summary['already-pro']}`);
  console.log(`Paid, no account yet:  ${summary['no-account']}`);
  console.log(`No resolvable email:   ${summary['no-email']}`);

  if (noAccountEmails.length > 0) {
    console.log('\nPaid customers with no account (decide manually — refund, or invite to sign up):');
    noAccountEmails.forEach(e => console.log(`  - ${e}`));
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to perform the upgrades.');
  } else {
    console.log('\nDone.');
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
