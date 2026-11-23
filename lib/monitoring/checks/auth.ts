/**
 * Sign-up, login and password reset.
 *
 * Incident this guards: password reset was broken from May to October 2026 and
 * a customer found it (5 of 8 recovery flows never completed).
 *
 * authConfig (hourly): GoTrue reachable, email sign-up enabled, and, when a
 * Supabase management token is set, the site URL, redirect allow-list,
 * recovery template (token_hash link to /auth/reset-password) and custom SMTP.
 *
 * passwordReset (daily): for a dedicated monitor account only (never a
 * customer), generate a recovery link with the admin API (no email is sent),
 * check the redirect is allow-listed, load the exact URL the email template
 * produces, redeem the token the way the reset page does, then revoke the
 * session it minted. The password is never changed.
 */

import { createClient } from '@supabase/supabase-js';
import { type MonitorCheck, type MonitorContext, type CheckOutcome, ok, warn, fail, worst, errMsg } from '../types';

/** Text the reset page renders server-side (app/auth/reset-password/page.tsx). */
export const RESET_PAGE_TEXT = 'Enter your new password';

export function monitorAccountEmail(env: MonitorContext['env']): string | null {
  const explicit = env.MONITOR_ACCOUNT_EMAIL?.trim();
  if (explicit) return explicit;
  const admin = env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!admin || !admin.includes('@')) return null;
  const [local, domain] = admin.split('@');
  return `${local.split('+')[0]}+monitor@${domain}`;
}

function supabaseUrl(env: MonitorContext['env']): string | null {
  return env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || null;
}

/** Optional checks against the Supabase Management API (needs SUPABASE_ACCESS_TOKEN). */
export async function checkAuthManagementConfig(ctx: MonitorContext): Promise<CheckOutcome | null> {
  const token = ctx.env.SUPABASE_ACCESS_TOKEN?.trim();
  const url = supabaseUrl(ctx.env);
  if (!token || !url) return null;
  const ref = new URL(url).hostname.split('.')[0];
  const res = await ctx.fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return warn(`management API ${res.status}; auth config not checked`);
  const cfg = (await res.json()) as Record<string, unknown>;
  const parts: CheckOutcome[] = [];
  const site = String(cfg.site_url ?? '');
  if (!site.startsWith(ctx.appUrl)) parts.push(fail(`site_url is ${site || 'empty'}, not ${ctx.appUrl}`));
  const allow = String(cfg.uri_allow_list ?? '');
  for (const path of ['/auth/callback', '/auth/reset-password']) {
    const target = `${ctx.appUrl}${path}`;
    const allowed = allow.split(',').map(s => s.trim()).some(p => p === target || (p.endsWith('*') && target.startsWith(p.replace(/\*+$/, ''))));
    if (!allowed) parts.push(fail(`${path} not in the redirect allow-list`));
  }
  const tpl = String(cfg.mailer_templates_recovery_content ?? '');
  if (tpl && !(tpl.includes('token_hash') && tpl.includes('/auth/reset-password'))) {
    parts.push(fail('recovery email template no longer links to /auth/reset-password?token_hash='));
  }
  if (!cfg.smtp_host) parts.push(warn('no custom SMTP: Supabase default mailer is rate-limited to a few emails/hour'));
  return worst(parts, 'management config ok');
}

export const authConfigCheck: MonitorCheck = {
  id: 'auth_config',
  label: 'Sign-up & login',
  cadence: 'hourly',
  async run(ctx) {
    const url = supabaseUrl(ctx.env);
    const anonKey = ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return fail('NEXT_PUBLIC_SUPABASE_URL or anon key not set');
    const headers = { apikey: anonKey };

    const health = await ctx.fetch(`${url}/auth/v1/health`, { headers });
    if (!health.ok) return fail(`Supabase auth health returned ${health.status}`);

    const settingsRes = await ctx.fetch(`${url}/auth/v1/settings`, { headers });
    if (!settingsRes.ok) return fail(`Supabase auth settings returned ${settingsRes.status}`);
    const settings = (await settingsRes.json()) as { disable_signup?: boolean; external?: Record<string, boolean> };
    const parts: CheckOutcome[] = [];
    if (settings.disable_signup) parts.push(fail('sign-ups are disabled in Supabase'));
    if (settings.external && settings.external.email === false) parts.push(fail('email provider is disabled in Supabase'));

    const mgmt = await checkAuthManagementConfig(ctx).catch(e => warn(`management API error: ${errMsg(e)}`));
    if (mgmt) parts.push(mgmt);
    const suffix = mgmt ? '' : ' (set SUPABASE_ACCESS_TOKEN to also check redirect allow-list and email template)';
    return worst(parts, `auth reachable, email sign-up on${suffix}`);
  },
};

/** Reads `redirect_to` from a GoTrue action link. */
export function redirectOf(actionLink: string): string | null {
  try {
    return new URL(actionLink).searchParams.get('redirect_to');
  } catch {
    return null;
  }
}

export const passwordResetCheck: MonitorCheck = {
  id: 'password_reset',
  label: 'Password reset end to end',
  cadence: 'daily',
  async run(ctx) {
    const email = monitorAccountEmail(ctx.env);
    if (!email) return warn('no monitor account: set MONITOR_ACCOUNT_EMAIL or ADMIN_NOTIFICATION_EMAIL');
    const service = ctx.service();
    const callback = `${ctx.appUrl}/auth/callback`;
    const resetUrl = `${ctx.appUrl}/auth/reset-password`;

    // 1. Sign-up/OAuth callback redirect is allow-listed (GoTrue silently swaps
    //    a non-allow-listed redirect for the site URL).
    const first = await service.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: callback } });
    if (first.error) {
      if (/not found|no user/i.test(first.error.message)) {
        return warn(`monitor account ${email.replace(/^[^@+]+/, '…')} does not exist yet; create it once (see the PR for the one-time setup)`);
      }
      return fail(`generateLink failed: ${errMsg(first.error.message)}`);
    }
    const parts: CheckOutcome[] = [];
    const cbRedirect = redirectOf(first.data.properties.action_link);
    if (cbRedirect !== callback) parts.push(fail(`/auth/callback not allow-listed (GoTrue redirects to ${cbRedirect ?? 'nothing'})`));

    // 2. Recovery link for the reset page. This overwrites the first token.
    const link = await service.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: resetUrl } });
    if (link.error) return fail(`recovery generateLink failed: ${errMsg(link.error.message)}`);
    const rsRedirect = redirectOf(link.data.properties.action_link);
    if (rsRedirect !== resetUrl) parts.push(fail(`/auth/reset-password not allow-listed (GoTrue redirects to ${rsRedirect ?? 'nothing'})`));
    const tokenHash = link.data.properties.hashed_token;

    // 3. The URL the email template sends lands on the reset page. The page only
    //    verifies on submit, so loading it does not burn the token.
    const page = await ctx.fetch(`${resetUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`, { redirect: 'follow' });
    const html = page.ok ? await page.text() : '';
    if (!page.ok) parts.push(fail(`reset page returned ${page.status}`));
    else if (!html.includes(RESET_PAGE_TEXT)) parts.push(fail('reset page loaded without the new-password form'));

    // 4. Redeem the token exactly as the page's submit does, then revoke the session.
    const url = supabaseUrl(ctx.env);
    const anonKey = ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return fail('anon key not set');
    const browserLike = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await browserLike.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (verified.error || !verified.data.session) {
      parts.push(fail(`recovery token rejected: ${errMsg(verified.error?.message ?? 'no session')}`));
    } else {
      const out = await service.auth.admin.signOut(verified.data.session.access_token);
      if (out.error) parts.push(warn(`monitor session not revoked: ${errMsg(out.error.message)}`));
    }

    // 5. Optional, opt-in: send the real reset email to the monitor inbox once a
    //    day. Proves Supabase's SMTP hop, which nothing above touches.
    if (ctx.env.MONITOR_RESET_EMAIL_SEND === 'true') {
      const sent = await browserLike.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
      if (sent.error) parts.push(fail(`reset email send failed: ${errMsg(sent.error.message)}`));
    }

    return worst(parts, 'reset link generated, lands on the reset page, token accepted, session revoked');
  },
};
