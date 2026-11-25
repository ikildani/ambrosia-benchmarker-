#!/usr/bin/env npx tsx
/**
 * Solidus Team: up to 5 Pro seats for $7,500 a year, plus one analyst-checked comp set per quarter.
 * Sold by invoice; seats are set up by hand until the plan is in checkout.
 *
 * Dry run by default: prints what it would do and changes nothing.
 *
 *   npx tsx scripts/solidus-team.ts --company "VMG Health" --billing-email ap@example.com \
 *     --seats chance@example.com,colleague@example.com [--invoice] [--apply]
 *
 *   --invoice   also create and send the $7,500 Stripe invoice (card or US bank debit, due in 14 days)
 *   --apply     actually write: seats get tier 'pro', engagement 'team', for one year from today
 *
 * Seats for emails without a Solidus account are listed so they can sign up first (or be created with
 * scripts/provision-pro-users.ts, which sends a magic link). Seat holders are also excluded from the
 * lifecycle drip crons for the term (drip_suppressed_until).
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const TEAM_PLAN = { priceUsd: 7500, maxSeats: 5, termDays: 365, engagement: 'team' } as const;

export function parseArgs(argv: string[]): { company: string; billingEmail: string; seats: string[]; invoice: boolean; apply: boolean } {
  const get = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const company = get('--company')?.trim();
  const billingEmail = get('--billing-email')?.trim().toLowerCase();
  const seats = (get('--seats') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!company || !billingEmail || seats.length === 0) {
    throw new Error('Usage: --company "<name>" --billing-email <email> --seats a@x,b@x [--invoice] [--apply]');
  }
  if (new Set(seats).size !== seats.length) throw new Error('Duplicate seat emails');
  if (seats.length > TEAM_PLAN.maxSeats) throw new Error(`Solidus Team covers up to ${TEAM_PLAN.maxSeats} seats; got ${seats.length}`);
  const bad = [billingEmail, ...seats].filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (bad.length) throw new Error(`Invalid email(s): ${bad.join(', ')}`);
  return { company, billingEmail, seats, invoice: argv.includes('--invoice'), apply: argv.includes('--apply') };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.apply ? 'APPLY' : 'DRY RUN';
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const now = new Date();
  const expires = new Date(now.getTime() + TEAM_PLAN.termDays * 86_400_000);

  console.log(`[${mode}] Solidus Team for ${args.company}: ${args.seats.length} seat(s), $${TEAM_PLAN.priceUsd}, through ${expires.toISOString().slice(0, 10)}`);

  const { data: profiles, error } = await db.from('user_profiles').select('id, email, tier, subscription_status').in('email', args.seats);
  if (error) throw new Error(error.message);
  const found = new Map((profiles ?? []).map((p) => [String(p.email).toLowerCase(), p]));
  const missing = args.seats.filter((e) => !found.has(e));
  for (const e of args.seats) {
    const p = found.get(e);
    console.log(`  seat ${e}: ${p ? `account found (tier ${p.tier}, ${p.subscription_status ?? 'no status'})` : 'NO ACCOUNT: ask them to sign up, or run scripts/provision-pro-users.ts'}`);
  }

  if (args.apply && found.size > 0) {
    const { error: upErr } = await db.from('user_profiles').update({
      tier: 'pro',
      tier_change_authorized: true,
      subscription_status: 'active',
      pro_engagement_type: TEAM_PLAN.engagement,
      pro_activated_at: now.toISOString(),
      pro_expires_at: expires.toISOString(),
      drip_suppressed_until: expires.toISOString(),
      updated_at: now.toISOString(),
    }).in('id', [...found.values()].map((p) => p.id));
    if (upErr) throw new Error(`seat update failed: ${upErr.message}`);
    const { error: evErr } = await db.from('events').insert([...found.values()].map((p) => ({
      user_id: p.id,
      event_type: 'team_seat_granted',
      event_data: { company: args.company, billing_email: args.billingEmail, expires_at: expires.toISOString() },
    })));
    if (evErr) console.warn(`  (seats granted; event log failed: ${evErr.message})`);
    console.log(`  granted ${found.size} seat(s)`);
  }

  if (args.invoice) {
    if (!args.apply) {
      console.log(`  would create and send a $${TEAM_PLAN.priceUsd} invoice to ${args.billingEmail}`);
    } else {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const existing = await stripe.customers.list({ email: args.billingEmail, limit: 1 });
      const customer = existing.data[0] ?? await stripe.customers.create({ email: args.billingEmail, name: args.company, metadata: { source: 'solidus_team' } });
      const inv = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 14,
        description: `Solidus Team: up to ${TEAM_PLAN.maxSeats} seats for one year, plus one analyst-checked comp set per quarter.`,
        metadata: { engagement: 'solidus_team', company: args.company, seats: args.seats.join(',') },
        payment_settings: { payment_method_types: ['card', 'us_bank_account'] },
        auto_advance: false,
      });
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: inv.id,
        currency: 'usd',
        amount: TEAM_PLAN.priceUsd * 100,
        description: `Solidus Team, ${args.company}: ${now.toISOString().slice(0, 10)} to ${expires.toISOString().slice(0, 10)}`,
      });
      const finalized = await stripe.invoices.finalizeInvoice(inv.id);
      const sent = await stripe.invoices.sendInvoice(finalized.id);
      console.log(`  invoice ${sent.number ?? sent.id} sent to ${args.billingEmail}: ${sent.hosted_invoice_url}`);
    }
  }

  if (missing.length) console.log(`\n${missing.length} seat(s) need an account first. Re-run with the same arguments once they sign up.`);
  if (!args.apply) console.log('\nDry run: nothing changed. Add --apply to write.');
}

if (require.main === module) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
