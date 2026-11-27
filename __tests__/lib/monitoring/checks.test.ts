/**
 * @jest-environment node
 */
import { fakeDb, fakeFetch, json, html, makeCtx, hoursAgo, NOW, APP } from './fakes';

const verifyOtp = jest.fn();
const resetPasswordForEmail = jest.fn();
jest.mock('@supabase/supabase-js', () => {
  const actual = jest.requireActual('@supabase/supabase-js');
  return { ...actual, createClient: jest.fn(() => ({ auth: { verifyOtp, resetPasswordForEmail } })) };
});

import { authConfigCheck, passwordResetCheck, monitorAccountEmail, RESET_PAGE_TEXT } from '@/lib/monitoring/checks/auth';
import { stripePricesCheck, checkoutSessionCheck, stripeWebhookCheck } from '@/lib/monitoring/checks/checkout';
import { calculatorDataCheck } from '@/lib/monitoring/checks/calculator';
import { ingestionFreshnessCheck, aiKeysCheck } from '@/lib/monitoring/checks/ingestion';
import { publicPagesCheck, PUBLIC_PAGES } from '@/lib/monitoring/checks/public-pages';
import { databaseCheck } from '@/lib/monitoring/checks/database';
import { emailSenderCheck } from '@/lib/monitoring/checks/email';
import type { CalculationResult } from '@/lib/calculations';

const SUPA = 'https://mnzoulengniofgkwtfbo.supabase.co';

beforeEach(() => {
  verifyOtp.mockReset();
  resetPasswordForEmail.mockReset();
});

// ─── 1. Sign-up & login ─────────────────────────────────────────────────────
describe('auth_config', () => {
  const routes = (settings: unknown, healthStatus = 200) => fakeFetch([
    [`${SUPA}/auth/v1/health`, () => json({}, healthStatus)],
    [`${SUPA}/auth/v1/settings`, () => json(settings)],
  ]);

  it('ok when auth is up and email sign-up is on', async () => {
    const r = await authConfigCheck.run(makeCtx({ fetch: routes({ disable_signup: false, external: { email: true } }).fetch }));
    expect(r.status).toBe('ok');
    expect(r.reason).toMatch(/SUPABASE_ACCESS_TOKEN/);
  });

  it('fails when auth health is down', async () => {
    const r = await authConfigCheck.run(makeCtx({ fetch: routes({}, 503).fetch }));
    expect(r).toEqual({ status: 'fail', reason: 'Supabase auth health returned 503' });
  });

  it('fails when sign-ups are disabled', async () => {
    const r = await authConfigCheck.run(makeCtx({ fetch: routes({ disable_signup: true, external: { email: true } }).fetch }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/sign-ups are disabled/);
  });

  it('with a management token, fails on a wrong site URL, a missing redirect and a template that lost token_hash', async () => {
    const { fetch } = fakeFetch([
      [`${SUPA}/auth/v1/health`, () => json({})],
      [`${SUPA}/auth/v1/settings`, () => json({ external: { email: true } })],
      ['https://api.supabase.com/v1/projects/mnzoulengniofgkwtfbo/config/auth', () => json({
        site_url: 'http://localhost:3000',
        uri_allow_list: `${APP}/auth/callback`,
        mailer_templates_recovery_content: '<a href="{{ .ConfirmationURL }}">Reset</a>',
        smtp_host: 'smtp.sendgrid.net',
      })],
    ]);
    const ctx = makeCtx({ fetch });
    ctx.env.SUPABASE_ACCESS_TOKEN = 'sbp_x';
    const r = await authConfigCheck.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/site_url is http:\/\/localhost:3000/);
    expect(r.reason).toMatch(/\/auth\/reset-password not in the redirect allow-list/);
    expect(r.reason).not.toMatch(/\/auth\/callback not/);
    expect(r.reason).toMatch(/template/);
  });

  it('accepts a wildcard allow-list entry and the token_hash template', async () => {
    const { fetch } = fakeFetch([
      [`${SUPA}/auth/v1/health`, () => json({})],
      [`${SUPA}/auth/v1/settings`, () => json({ external: { email: true } })],
      ['https://api.supabase.com/', () => json({
        site_url: APP,
        uri_allow_list: `${APP}/**`,
        mailer_templates_recovery_content: `<a href="${APP}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery">`,
        smtp_host: 'smtp.sendgrid.net',
      })],
    ]);
    const ctx = makeCtx({ fetch });
    ctx.env.SUPABASE_ACCESS_TOKEN = 'sbp_x';
    expect((await authConfigCheck.run(ctx)).status).toBe('ok');
  });
});

// ─── 2. Password reset end to end ───────────────────────────────────────────
describe('password_reset', () => {
  const link = (redirect: string, hashed = 'hash123') => ({
    data: { properties: { action_link: `${SUPA}/auth/v1/verify?token=${hashed}&type=recovery&redirect_to=${encodeURIComponent(redirect)}`, hashed_token: hashed } },
    error: null,
  });

  function setup(opts: { generate?: jest.Mock; page?: Response } = {}) {
    const generateLink = opts.generate ?? jest.fn()
      .mockResolvedValueOnce(link(`${APP}/auth/callback`))
      .mockResolvedValueOnce(link(`${APP}/auth/reset-password`));
    const signOut = jest.fn().mockResolvedValue({ error: null });
    const { client } = fakeDb({}, { admin: { generateLink, signOut } });
    const { fetch, seen } = fakeFetch([[`${APP}/auth/reset-password`, () => opts.page ?? html(`<p>${RESET_PAGE_TEXT} below</p>`)]]);
    const ctx = makeCtx({ service: () => client as never, fetch });
    return { ctx, generateLink, signOut, seen };
  }

  it('derives a +monitor alias of the admin address, never the address itself', () => {
    expect(monitorAccountEmail({ ADMIN_NOTIFICATION_EMAIL: 'owner@example.com' })).toBe('owner+monitor@example.com');
    expect(monitorAccountEmail({ ADMIN_NOTIFICATION_EMAIL: 'owner+x@example.com' })).toBe('owner+monitor@example.com');
    expect(monitorAccountEmail({ MONITOR_ACCOUNT_EMAIL: 'm@example.com', ADMIN_NOTIFICATION_EMAIL: 'owner@example.com' })).toBe('m@example.com');
  });

  it('ok: link lands on the reset page, token redeems, session is revoked, no email sent', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    const { ctx, generateLink, signOut, seen } = setup();
    const r = await passwordResetCheck.run(ctx);
    expect(r.status).toBe('ok');
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: 'recovery', email: 'owner+monitor@example.com' }));
    expect(seen[0].url).toBe(`${APP}/auth/reset-password?token_hash=hash123&type=recovery`);
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'hash123' });
    expect(signOut).toHaveBeenCalledWith('jwt');
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('warns (does not create anything) when the monitor account does not exist', async () => {
    const generate = jest.fn().mockResolvedValue({ data: null, error: { message: 'User not found' } });
    const { ctx } = setup({ generate });
    const r = await passwordResetCheck.run(ctx);
    expect(r.status).toBe('warn');
    expect(r.reason).toMatch(/does not exist yet/);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('fails when GoTrue swaps the reset redirect for the site URL (not allow-listed)', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    const generate = jest.fn()
      .mockResolvedValueOnce(link(`${APP}/auth/callback`))
      .mockResolvedValueOnce(link('http://localhost:3000'));
    const r = await passwordResetCheck.run(setup({ generate }).ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/reset-password not allow-listed/);
  });

  it('fails when the reset page lost its form (the May-October 2026 bug class)', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    const r = await passwordResetCheck.run(setup({ page: html('<p>Something went wrong</p>') }).ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/without the new-password form/);
  });

  it('fails when the token is rejected', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } });
    const r = await passwordResetCheck.run(setup().ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/recovery token rejected: Token has expired/);
  });

  it('sends the real email only when opted in, and only to the monitor address', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    resetPasswordForEmail.mockResolvedValue({ error: { message: 'Error sending recovery email' } });
    const { ctx } = setup();
    ctx.env.MONITOR_RESET_EMAIL_SEND = 'true';
    const r = await passwordResetCheck.run(ctx);
    expect(resetPasswordForEmail).toHaveBeenCalledWith('owner+monitor@example.com', { redirectTo: `${APP}/auth/reset-password` });
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/reset email send failed/);
  });
});

// ─── 3. Checkout ────────────────────────────────────────────────────────────
function price(over: Record<string, unknown> = {}) {
  return { id: 'price_x', active: true, type: 'recurring', recurring: { interval: 'month' }, unit_amount: 29900, product: { active: true }, ...over };
}

describe('stripe_prices', () => {
  const env = { STRIPE_PRICE_ID: 'price_pro', STRIPE_REPORT_PRICE_ID: 'price_report', STRIPE_ANNUAL_PRICE_ID: 'price_annual' };
  const stripeWith = (prices: Record<string, unknown>) => ({
    prices: { retrieve: jest.fn(async (id: string) => { if (!prices[id]) throw new Error(`No such price: '${id}'`); return prices[id]; }) },
  });

  it('ok when every configured price is active with the site amount', async () => {
    const stripe = stripeWith({
      price_pro: price(),
      price_annual: price({ recurring: { interval: 'year' }, unit_amount: 238800 }),
      price_report: price({ type: 'one_time', recurring: null, unit_amount: 49900 }),
    });
    const ctx = makeCtx({ stripe: () => stripe as never });
    Object.assign(ctx.env, env);
    const r = await stripePricesCheck.run(ctx);
    expect(r).toEqual({ status: 'ok', reason: '3 prices active with the amounts the site shows' });
  });

  it('fails on an archived price, a missing required var, and a deleted price; warns on an amount mismatch', async () => {
    const stripe = stripeWith({
      price_pro: price({ active: false }),
      price_annual: price({ recurring: { interval: 'year' }, unit_amount: 199900 }),
    });
    const ctx = makeCtx({ stripe: () => stripe as never });
    Object.assign(ctx.env, { STRIPE_PRICE_ID: 'price_pro', STRIPE_ANNUAL_PRICE_ID: 'price_annual', STRIPE_STARTER_PRICE_ID: 'price_gone' });
    const r = await stripePricesCheck.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/STRIPE_PRICE_ID is archived/);
    expect(r.reason).toMatch(/STRIPE_REPORT_PRICE_ID not set/);
    expect(r.reason).toMatch(/STRIPE_STARTER_PRICE_ID No such price/);
    expect(r.reason).toMatch(/STRIPE_ANNUAL_PRICE_ID charges \$1999, site says \$2388/);
  });

  it('fails without a Stripe key', async () => {
    expect((await stripePricesCheck.run(makeCtx())).status).toBe('fail');
  });
});

describe('checkout_session', () => {
  it('creates one session per distinct price, then expires it, with no customer and synthetic metadata', async () => {
    const create = jest.fn(async (p: { line_items: Array<{ price: string }> }) => ({ id: `cs_${p.line_items[0].price}`, url: 'https://checkout.stripe.com/x' }));
    const expire = jest.fn(async () => ({}));
    const ctx = makeCtx({ stripe: () => ({ checkout: { sessions: { create, expire } } }) as never });
    Object.assign(ctx.env, { STRIPE_PRICE_ID: 'price_pro', STRIPE_ANNUAL_PRICE_ID: 'price_pro', STRIPE_REPORT_PRICE_ID: 'price_report' });
    const r = await checkoutSessionCheck.run(ctx);
    expect(r).toEqual({ status: 'ok', reason: '2 checkout sessions created and expired' });
    expect(create).toHaveBeenCalledTimes(2);
    const [sub, pay] = create.mock.calls.map(c => c[0] as unknown as Record<string, unknown>);
    expect(sub.mode).toBe('subscription');
    expect(pay.mode).toBe('payment');
    for (const p of [sub, pay]) {
      expect(p.customer).toBeUndefined();
      expect(p.customer_email).toBeUndefined();
      expect(p.metadata).toEqual({ product: 'synthetic-monitor', monitor: 'true' });
      expect(p.expires_at).toBe(Math.floor(NOW.getTime() / 1000) + 1800);
    }
    expect(expire.mock.calls.map(c => (c as unknown[])[0])).toEqual(['cs_price_pro', 'cs_price_report']);
  });

  it('fails when Stripe refuses to create a session', async () => {
    const create = jest.fn(async () => { throw new Error('No such price'); });
    const ctx = makeCtx({ stripe: () => ({ checkout: { sessions: { create, expire: jest.fn() } } }) as never });
    ctx.env.STRIPE_PRICE_ID = 'price_pro';
    const r = await checkoutSessionCheck.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/session create failed: No such price/);
  });

  it('only warns when expiry fails (the 30-minute expires_at cleans up)', async () => {
    const ctx = makeCtx({ stripe: () => ({ checkout: { sessions: {
      create: async () => ({ id: 'cs_1', url: 'u' }),
      expire: async () => { throw new Error('already expired'); },
    } } }) as never });
    ctx.env.STRIPE_PRICE_ID = 'price_pro';
    expect((await checkoutSessionCheck.run(ctx)).status).toBe('warn');
  });
});

describe('stripe_webhook', () => {
  const t = (minsAgo: number) => Math.floor(NOW.getTime() / 1000) - minsAgo * 60;
  const endpoint = (over: Record<string, unknown> = {}) => ({
    url: `${APP}/api/webhook`, status: 'enabled',
    enabled_events: ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.payment_succeeded', 'invoice.payment_failed'],
    ...over,
  });
  function setup(opts: { endpoints?: unknown[]; events?: unknown[]; failed?: unknown[]; processed?: string[] }) {
    const list = jest.fn(async (p: { delivery_success?: boolean }) => ({ data: p.delivery_success === false ? (opts.failed ?? []) : (opts.events ?? []) }));
    const stripe = { webhookEndpoints: { list: async () => ({ data: opts.endpoints ?? [endpoint()] }) }, events: { list } };
    const { client } = fakeDb({ processed_webhook_events: { data: (opts.processed ?? []).map(id => ({ stripe_event_id: id })) } });
    const ctx = makeCtx({ stripe: () => stripe as never, service: () => client as never });
    ctx.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    return ctx;
  }
  const ev = (id: string, minsAgo: number, product = 'deal-calculator-pro', type = 'checkout.session.completed') =>
    ({ id, type, created: t(minsAgo), data: { object: { metadata: { product } } } });

  it('ok when the endpoint is enabled and every Solidus event was processed', async () => {
    const r = await stripeWebhookCheck.run(setup({ events: [ev('evt_1', 60), ev('evt_2', 5)], processed: ['evt_1'] }));
    expect(r.status).toBe('ok');
    expect(r.reason).toMatch(/1 revenue events this week, all processed/);
  });

  it('fails when Stripe sent a Solidus event the app never processed', async () => {
    const r = await stripeWebhookCheck.run(setup({ events: [ev('evt_1', 120), ev('evt_2', 90, 'deal-report')], processed: ['evt_1'] }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/1 of 2 Stripe events never processed/);
  });

  it('ignores events of other products sharing the Stripe account', async () => {
    const r = await stripeWebhookCheck.run(setup({ events: [ev('evt_9', 120, 'terrain-pro')], processed: [] }));
    expect(r.status).toBe('ok');
  });

  it('fails when no endpoint points at production, or it is disabled, or misses an event type', async () => {
    expect((await stripeWebhookCheck.run(setup({ endpoints: [endpoint({ url: 'https://old.example.com/api/webhook' })] }))).reason).toMatch(/no Stripe webhook endpoint/);
    expect((await stripeWebhookCheck.run(setup({ endpoints: [endpoint({ status: 'disabled' })] }))).reason).toMatch(/disabled/);
    const r = await stripeWebhookCheck.run(setup({ endpoints: [endpoint({ enabled_events: ['checkout.session.completed'] })] }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/not subscribed to customer.subscription.updated/);
  });

  it('fails when STRIPE_WEBHOOK_SECRET is missing', async () => {
    const ctx = setup({});
    delete ctx.env.STRIPE_WEBHOOK_SECRET;
    expect((await stripeWebhookCheck.run(ctx)).reason).toMatch(/STRIPE_WEBHOOK_SECRET not set/);
  });

  it('warns on failed deliveries', async () => {
    const r = await stripeWebhookCheck.run(setup({ failed: [ev('evt_f', 120)] }));
    expect(r.status).toBe('warn');
  });
});

// ─── 4. Calculator data ─────────────────────────────────────────────────────
describe('calculator_data', () => {
  const anonWith = (count: number | null, calibratedAt: string | null, error: { message: string } | null = null) =>
    fakeDb({ benchmark_calibrations: ops => (ops.some(o => o[0] === 'maybeSingle') ? { data: { calibrated_at: calibratedAt } } : { count, error }) }).client;

  it('ok with active calibrations and a sane canary (real engine)', async () => {
    const r = await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(116, hoursAgo(6 * 24)) as never }));
    expect(r.status).toBe('ok');
    expect(r.reason).toMatch(/^116 active calibrations; canary Ph2 onc upfront \$\d+M/);
  });

  it('fails when the anon read fails (calculator silently on static numbers)', async () => {
    const r = await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(null, null, { message: 'permission denied' }) as never }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/unreadable with the anon key/);
  });

  it('fails with zero active rows', async () => {
    expect((await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(0, null) as never }))).status).toBe('fail');
  });

  it('warns when the weekly calibration missed a run, fails when it stopped', async () => {
    expect((await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(5, hoursAgo(10 * 24)) as never }))).status).toBe('warn');
    expect((await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(5, hoursAgo(20 * 24)) as never }))).status).toBe('fail');
  });

  it('fails on a non-finite or inverted canary', async () => {
    const bad = (up: number, total: number) => () => ({ terms: { upfront: { low: up, median: up, high: up }, totalDealValue: { low: total, median: total, high: total } } }) as unknown as CalculationResult;
    const nan = await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(5, hoursAgo(1)) as never, calculate: bad(NaN, 100) }));
    expect(nan.reason).toMatch(/upfront not finite/);
    const inv = await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(5, hoursAgo(1)) as never, calculate: bad(500, 400) }));
    expect(inv.reason).toMatch(/total \$400M below upfront \$500M/);
    const thrown = await calculatorDataCheck.run(makeCtx({ anon: () => anonWith(5, hoursAgo(1)) as never, calculate: () => { throw new Error('boom'); } }));
    expect(thrown.reason).toMatch(/canary calculation threw: boom/);
  });
});

// ─── 5. Ingestion freshness & AI keys ───────────────────────────────────────
describe('ingestion_freshness', () => {
  const db = (deal: string | null, verified: string | null) => fakeDb({
    deals: { data: deal ? { created_at: deal } : null },
    deals_verified: { data: verified ? { created_at: verified } : null },
  }).client;

  it('ok when both are fresh', async () => {
    const r = await ingestionFreshnessCheck.run(makeCtx({ service: () => db(hoursAgo(2), hoursAgo(30)) as never }));
    expect(r).toEqual({ status: 'ok', reason: 'newest deal row 2 h ago; newest verified deal 30 h ago' });
  });

  it('warns at 36 h without inserts, fails at 72 h', async () => {
    expect((await ingestionFreshnessCheck.run(makeCtx({ service: () => db(hoursAgo(40), hoursAgo(1)) as never }))).status).toBe('warn');
    const r = await ingestionFreshnessCheck.run(makeCtx({ service: () => db(hoursAgo(14 * 24), hoursAgo(1)) as never }));
    expect(r).toEqual({ status: 'fail', reason: 'newest deal row is 14 days old' });
  });

  it('fails when nothing has been verified for over a week', async () => {
    const r = await ingestionFreshnessCheck.run(makeCtx({ service: () => db(hoursAgo(1), hoursAgo(54 * 24)) as never }));
    expect(r.status).toBe('fail');
    expect(r.reason).toBe('newest verified deal is 54 days old');
  });
});

describe('ai_keys', () => {
  const routes = (anthropic: number, perplexity: number, body = '') => fakeFetch([
    ['https://api.anthropic.com/v1/models', () => json({}, anthropic)],
    ['https://api.perplexity.ai/', () => new Response(body, { status: perplexity })],
  ]);
  const ctxWith = (f: typeof fetch) => {
    const ctx = makeCtx({ fetch: f });
    Object.assign(ctx.env, { ANTHROPIC_API_KEY: 'sk-ant-x', PERPLEXITY_API_KEY: 'pplx-x' });
    return ctx;
  };

  it('ok when Anthropic lists models and Perplexity rejects the empty request as invalid (400)', async () => {
    const { fetch, seen } = routes(200, 400);
    const r = await aiKeysCheck.run(ctxWith(fetch));
    expect(r.status).toBe('ok');
    // No generation: a GET to Anthropic and an empty message list to Perplexity.
    expect(seen.find(s => s.url.includes('anthropic'))?.init?.method).toBe('GET');
    expect(JSON.parse(String(seen.find(s => s.url.includes('perplexity'))?.init?.body)).messages).toEqual([]);
  });

  it('fails on an invalid Anthropic key (the Oct 26 2026 incident)', async () => {
    const r = await aiKeysCheck.run(ctxWith(routes(401, 400).fetch));
    expect(r).toEqual({ status: 'fail', reason: 'Anthropic key rejected (401)' });
  });

  it('fails on an invalid or out-of-credit Perplexity key', async () => {
    expect((await aiKeysCheck.run(ctxWith(routes(200, 401).fetch))).reason).toMatch(/Perplexity key rejected/);
    expect((await aiKeysCheck.run(ctxWith(routes(200, 429, 'insufficient_quota').fetch))).reason).toMatch(/out of credit/);
  });

  it('fails when a key is missing', async () => {
    expect((await aiKeysCheck.run(makeCtx({ fetch: routes(200, 400).fetch }))).status).toBe('fail');
  });
});

// ─── 6. Public pages & admin gate ───────────────────────────────────────────
describe('public_pages', () => {
  const pageBody: Record<string, string> = Object.fromEntries(PUBLIC_PAGES.map(p => [p.path, `<html>${p.expect}</html>`]));
  const site = (over: Record<string, () => Response> = {}) => fakeFetch([
    [/.*/, (url: string) => {
      const path = new URL(url).pathname;
      if (over[path]) return over[path]();
      if (path.startsWith('/admin')) return html('not found', 404);
      return html(pageBody[path] ?? 'x');
    }],
  ]);

  it('ok when pages are up and /admin 404s for anonymous users', async () => {
    const r = await publicPagesCheck.run(makeCtx({ fetch: site().fetch }));
    expect(r.status).toBe('ok');
  });

  it('fails when /admin serves a page to an anonymous visitor (Nov 2026 leak)', async () => {
    const r = await publicPagesCheck.run(makeCtx({ fetch: site({ '/admin/briefs': () => html('<table>briefs</table>') }).fetch }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/\/admin\/briefs returned 200 to an anonymous visitor/);
  });

  it('accepts a redirect to sign-in but not to another admin page', async () => {
    const toLogin = await publicPagesCheck.run(makeCtx({ fetch: site({ '/admin': () => html('', 307, { location: '/?signin=1' }) }).fetch }));
    expect(toLogin.status).toBe('ok');
    const toAdmin = await publicPagesCheck.run(makeCtx({ fetch: site({ '/admin': () => html('', 307, { location: '/admin/ops' }) }).fetch }));
    expect(toAdmin.status).toBe('fail');
  });

  it('fails on a 500 (after one retry) and on missing text', async () => {
    let calls = 0;
    const r = await publicPagesCheck.run(makeCtx({ fetch: site({ '/pro': () => { calls++; return html('err', 500); }, '/calculator': () => html('<html>blank</html>') }).fetch }));
    expect(calls).toBe(2);
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/\/pro returned 500/);
    expect(r.reason).toMatch(/\/calculator is missing "Deal Calculator"/);
  });

  it('a single blip that recovers on retry is ok', async () => {
    let calls = 0;
    const r = await publicPagesCheck.run(makeCtx({ fetch: site({ '/accuracy': () => (++calls === 1 ? html('', 502) : html(pageBody['/accuracy'])) }).fetch }));
    expect(r.status).toBe('ok');
  });
});

// ─── 7. Database ────────────────────────────────────────────────────────────
describe('database', () => {
  it('ok on a fast query, fail on an error', async () => {
    expect((await databaseCheck.run(makeCtx({ service: () => fakeDb({ deals: { data: [{ id: 1 }] } }).client as never }))).status).toBe('ok');
    const r = await databaseCheck.run(makeCtx({ service: () => fakeDb({ deals: { error: { message: '<html>504 Gateway Time-out</html>' } } }).client as never }));
    expect(r.status).toBe('fail');
    expect(r.reason).toMatch(/504 Gateway Time-out/);
    expect(r.reason).not.toMatch(/</);
  });

  it('warns on a slow query', async () => {
    const spy = jest.spyOn(Date, 'now');
    spy.mockReturnValueOnce(0).mockReturnValueOnce(2_000);
    const r = await databaseCheck.run(makeCtx({ service: () => fakeDb({ deals: { data: [] } }).client as never }));
    spy.mockRestore();
    expect(r).toEqual({ status: 'warn', reason: 'simple query took 2000 ms' });
  });
});

// ─── Email sender ───────────────────────────────────────────────────────────
describe('email_sender', () => {
  const stats = (m: Record<string, number>) => [{ date: '2026-11-22', stats: [{ metrics: m }] }];
  const ctxWith = (status: number, body: unknown) => {
    const ctx = makeCtx({ fetch: fakeFetch([['https://api.sendgrid.com/v3/stats', () => json(body, status)]]).fetch });
    ctx.env.SENDGRID_API_KEY = 'SG.x';
    return ctx;
  };

  it('ok on healthy delivery', async () => {
    const r = await emailSenderCheck.run(ctxWith(200, stats({ requests: 40, delivered: 39, bounces: 1 })));
    expect(r).toEqual({ status: 'ok', reason: '39/40 delivered, 1 bounced/blocked in 2 days' });
  });

  it('fails when nothing is delivered or the key is rejected', async () => {
    expect((await emailSenderCheck.run(ctxWith(200, stats({ requests: 20, delivered: 0, blocks: 20 })))).status).toBe('fail');
    expect((await emailSenderCheck.run(ctxWith(401, {}))).reason).toMatch(/key rejected/);
  });

  it('warns on a high bounce/block rate and on a key without stats scope', async () => {
    expect((await emailSenderCheck.run(ctxWith(200, stats({ requests: 20, delivered: 17, blocks: 3 })))).status).toBe('warn');
    expect((await emailSenderCheck.run(ctxWith(403, {}))).status).toBe('warn');
  });

  it('fails without a key', async () => {
    expect((await emailSenderCheck.run(makeCtx())).status).toBe('fail');
  });
});
