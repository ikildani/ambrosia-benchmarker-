/**
 * Checkout: prices, a real Checkout Session per price (then expired), and the webhook.
 *
 * Nothing here charges a card or creates a customer: a Checkout Session in
 * subscription mode creates the customer only on completion, the session is
 * expired immediately (and carries a 30-minute expires_at as a backstop), and
 * no report_purchases row is written, so the abandoned-checkout drip never sees it.
 */

import type Stripe from 'stripe';
import { PRICING } from '@/lib/config/constants';
import { type MonitorCheck, type CheckOutcome, ok, warn, fail, worst, errMsg } from '../types';

export interface PriceSpec {
  env: string;
  required: boolean;
  type: 'recurring' | 'one_time';
  interval?: 'month' | 'year';
  /** Expected unit amount in dollars, from the prices shown on the site. */
  dollars: number;
}

/** Mirrors app/api/checkout/route.ts. */
export const PRICE_SPECS: PriceSpec[] = [
  { env: 'STRIPE_PRICE_ID', required: true, type: 'recurring', interval: 'month', dollars: PRICING.PRO_PRICE_NUM },
  { env: 'STRIPE_ANNUAL_PRICE_ID', required: false, type: 'recurring', interval: 'year', dollars: PRICING.PRO_ANNUAL_PRICE_NUM },
  { env: 'STRIPE_STARTER_PRICE_ID', required: false, type: 'recurring', interval: 'month', dollars: PRICING.STARTER_PRICE_NUM },
  { env: 'STRIPE_STARTER_ANNUAL_PRICE_ID', required: false, type: 'recurring', interval: 'year', dollars: PRICING.STARTER_ANNUAL_PRICE_NUM },
  { env: 'STRIPE_REPORT_PRICE_ID', required: true, type: 'one_time', dollars: PRICING.REPORT_PRICE_NUM },
];

/** Event types app/api/webhook/route.ts acts on. */
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
];

/** metadata.product values our checkout sets; other products may share the Stripe account. */
const OUR_PRODUCTS = new Set(['deal-calculator-pro', 'deal-calculator-starter', 'deal-report']);

/** Events younger than this may still be in flight. */
const DELIVERY_GRACE_MS = 15 * 60_000;
const EVENT_LOOKBACK_MS = 7 * 24 * 3_600_000;

function configuredPrices(env: Record<string, string | undefined>) {
  return PRICE_SPECS.map(spec => ({ spec, id: env[spec.env]?.trim() || null }));
}

export async function checkPrice(stripe: Stripe, spec: PriceSpec, id: string): Promise<CheckOutcome> {
  let price: Stripe.Price;
  try {
    price = await stripe.prices.retrieve(id, { expand: ['product'] });
  } catch (e) {
    return fail(`${spec.env} ${errMsg(e)}`);
  }
  if (!price.active) return fail(`${spec.env} is archived in Stripe`);
  const product = price.product as Stripe.Product | Stripe.DeletedProduct | string;
  if (typeof product === 'object' && ('deleted' in product && product.deleted)) return fail(`${spec.env} product deleted`);
  if (typeof product === 'object' && 'active' in product && !product.active) return fail(`${spec.env} product archived`);
  if (price.type !== spec.type) return fail(`${spec.env} is ${price.type}, checkout needs ${spec.type}`);
  if (spec.interval && price.recurring?.interval !== spec.interval) {
    return fail(`${spec.env} bills every ${price.recurring?.interval ?? '?'}, expected ${spec.interval}`);
  }
  if (price.unit_amount !== spec.dollars * 100) {
    return warn(`${spec.env} charges $${((price.unit_amount ?? 0) / 100).toFixed(0)}, site says $${spec.dollars}`);
  }
  return ok(`${spec.env} ok`);
}

export const stripePricesCheck: MonitorCheck = {
  id: 'stripe_prices',
  label: 'Checkout prices',
  cadence: 'hourly',
  async run(ctx) {
    const stripe = ctx.stripe();
    if (!stripe) return fail('STRIPE_SECRET_KEY missing or invalid: checkout shows "temporarily unavailable"');
    const parts: CheckOutcome[] = [];
    let checked = 0;
    for (const { spec, id } of configuredPrices(ctx.env)) {
      if (!id) {
        if (spec.required) parts.push(fail(`${spec.env} not set`));
        continue;
      }
      checked++;
      parts.push(await checkPrice(stripe, spec, id));
    }
    return worst(parts, `${checked} prices active with the amounts the site shows`);
  },
};

export const checkoutSessionCheck: MonitorCheck = {
  id: 'checkout_session',
  label: 'Checkout session create/expire',
  cadence: 'daily',
  async run(ctx) {
    const stripe = ctx.stripe();
    if (!stripe) return fail('STRIPE_SECRET_KEY missing or invalid');
    const parts: CheckOutcome[] = [];
    const seen = new Set<string>();
    let created = 0;
    for (const { spec, id } of configuredPrices(ctx.env)) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const subscription = spec.type === 'recurring';
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
          mode: subscription ? 'subscription' : 'payment',
          payment_method_types: ['card'],
          line_items: [{ price: id, quantity: 1 }],
          success_url: `${ctx.appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${ctx.appUrl}?canceled=true`,
          ...(subscription ? { billing_address_collection: 'required' as const, tax_id_collection: { enabled: true } } : {}),
          expires_at: Math.floor(ctx.now.getTime() / 1000) + 30 * 60,
          metadata: { product: 'synthetic-monitor', monitor: 'true' },
        });
      } catch (e) {
        parts.push(fail(`${spec.env}: session create failed: ${errMsg(e)}`));
        continue;
      }
      created++;
      if (!session.url) parts.push(fail(`${spec.env}: session has no checkout URL`));
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (e) {
        parts.push(warn(`${spec.env}: session not expired (${errMsg(e)}); it lapses in 30 min`));
      }
    }
    if (created === 0 && parts.length === 0) return fail('no price IDs configured');
    return worst(parts, `${created} checkout sessions created and expired`);
  },
};

export const stripeWebhookCheck: MonitorCheck = {
  id: 'stripe_webhook',
  label: 'Stripe webhook',
  cadence: 'hourly',
  async run(ctx) {
    const stripe = ctx.stripe();
    if (!stripe) return fail('STRIPE_SECRET_KEY missing or invalid');
    if (!ctx.env.STRIPE_WEBHOOK_SECRET) return fail('STRIPE_WEBHOOK_SECRET not set: /api/webhook returns 503 and paid users never get Pro');

    const host = new URL(ctx.appUrl).host;
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const ours = endpoints.data.filter(e => {
      try {
        const u = new URL(e.url);
        return u.host === host && u.pathname.replace(/\/$/, '') === '/api/webhook';
      } catch {
        return false;
      }
    });
    if (ours.length === 0) return fail(`no Stripe webhook endpoint for ${ctx.appUrl}/api/webhook`);
    const enabled = ours.find(e => e.status === 'enabled');
    if (!enabled) return fail('Stripe webhook endpoint is disabled');
    const events = new Set(enabled.enabled_events);
    const missing = events.has('*') ? [] : HANDLED_EVENTS.filter(t => !events.has(t));
    const parts: CheckOutcome[] = [];
    if (missing.length) parts.push(fail(`webhook not subscribed to ${missing.join(', ')}`));

    // Every revenue event Stripe sent us in the last week must be in processed_webhook_events.
    const since = Math.floor((ctx.now.getTime() - EVENT_LOOKBACK_MS) / 1000);
    const recent = await stripe.events.list({ types: HANDLED_EVENTS, created: { gte: since }, limit: 50 });
    const cutoff = (ctx.now.getTime() - DELIVERY_GRACE_MS) / 1000;
    const relevant = recent.data.filter(ev => {
      if (ev.created > cutoff) return false;
      // Only events we can attribute to Solidus: other products may share the
      // Stripe account, and invoices carry no product metadata.
      const product = (ev.data.object as { metadata?: Record<string, string> | null }).metadata?.product;
      return product ? OUR_PRODUCTS.has(product) : false;
    });
    if (relevant.length > 0) {
      const { data: rows, error } = await ctx
        .service()
        .from('processed_webhook_events')
        .select('stripe_event_id')
        .in('stripe_event_id', relevant.map(e => e.id));
      if (error) {
        parts.push(warn(`processed_webhook_events unreadable: ${errMsg(error.message)}`));
      } else {
        const done = new Set((rows ?? []).map((r: { stripe_event_id: string }) => r.stripe_event_id));
        const lost = relevant.filter(e => !done.has(e.id));
        if (lost.length) {
          const newest = new Date(Math.max(...lost.map(e => e.created)) * 1000).toISOString().slice(0, 16);
          parts.push(fail(`${lost.length} of ${relevant.length} Stripe events never processed by /api/webhook (newest ${newest} UTC, ${lost[0].type})`));
        }
      }
    }

    const failed = await stripe.events.list({ delivery_success: false, created: { gte: since }, limit: 20 });
    const failedOurs = failed.data.filter(e => HANDLED_EVENTS.includes(e.type) && e.created <= cutoff);
    if (failedOurs.length) parts.push(warn(`${failedOurs.length} revenue events with failed deliveries this week (Stripe retries for 3 days)`));

    return worst(parts, `endpoint enabled; ${relevant.length} revenue events this week, all processed`);
  },
};
