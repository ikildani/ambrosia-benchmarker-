/**
 * Brief alerts — signed, expiring opt-out tokens.
 *
 * Brief owners have no user account: the benchmark request's email and
 * brief_token are the identity. Every alert email carries a link to
 * /api/brief/alerts/opt-out?token=<token>; the token names the request and
 * an expiry, HMAC-SHA256 signed. Format: base64url(payload) "." base64url(sig).
 *
 * Same secret as the outcome report links (lib/outcomes/report-token.ts):
 * OUTCOME_TOKEN_SECRET, falling back to CRON_SECRET.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { outcomeTokenSecret } from '@/lib/outcomes/report-token';

/** Opt-out links stay valid for 180 days; a later alert issues a fresh one. */
export const BRIEF_ALERT_TOKEN_TTL_MS = 180 * 86_400_000;

export interface BriefAlertTokenPayload {
  requestId: string;
  /** Unix seconds. */
  exp: number;
}

export type BriefAlertTokenVerification =
  | { ok: true; payload: BriefAlertTokenPayload }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'signature' | 'expired' };

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest());
}

export interface SignBriefAlertOptions {
  now?: Date;
  ttlMs?: number;
  /** Tests only — production reads the env. */
  secret?: string;
}

/** Throws when no secret is configured (callers decide whether that is fatal). */
export function signBriefAlertToken(input: { requestId: string }, opts: SignBriefAlertOptions = {}): string {
  const secret = opts.secret ?? outcomeTokenSecret();
  if (!secret) throw new Error('OUTCOME_TOKEN_SECRET (or CRON_SECRET) is not configured');
  const now = opts.now ?? new Date();
  const exp = Math.floor((now.getTime() + (opts.ttlMs ?? BRIEF_ALERT_TOKEN_TTL_MS)) / 1000);
  const p = b64url(JSON.stringify({ r: input.requestId, e: exp }));
  return `${p}.${sign(p, secret)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyBriefAlertToken(token: string | null | undefined, opts: { now?: Date; secret?: string } = {}): BriefAlertTokenVerification {
  const secret = opts.secret ?? outcomeTokenSecret();
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (!token || typeof token !== 'string' || token.length > 512) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [p, sig] = parts;

  const expected = Buffer.from(sign(p, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' };

  let decoded: { r?: unknown; e?: unknown };
  try {
    decoded = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { r?: unknown; e?: unknown };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const requestId = typeof decoded.r === 'string' && UUID.test(decoded.r) ? decoded.r : null;
  const exp = typeof decoded.e === 'number' && Number.isFinite(decoded.e) ? decoded.e : null;
  if (!requestId || exp == null) return { ok: false, reason: 'malformed' };

  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (exp <= nowSec) return { ok: false, reason: 'expired' };

  return { ok: true, payload: { requestId, exp } };
}
