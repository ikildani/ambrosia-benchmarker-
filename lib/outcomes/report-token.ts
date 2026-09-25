/**
 * Outcome ledger — signed, expiring link tokens for the client outcome form.
 *
 * A token carries the prediction it refers to (and the benchmark request it
 * came from), an expiry, and an HMAC-SHA256 over both. The follow-up email
 * embeds it in /outcomes/report/<token>; POST /api/outcomes/report accepts it
 * in place of owner auth. Format: base64url(payload) "." base64url(signature).
 *
 * Secret: OUTCOME_TOKEN_SECRET, falling back to CRON_SECRET so the feature
 * works before the new variable is set. Rotating the secret invalidates every
 * outstanding link (the next follow-up email issues a fresh one).
 */

import { createHmac, timingSafeEqual } from 'crypto';

/** Links stay valid for 180 days so the day-120 email has ~two months of runway. */
export const OUTCOME_TOKEN_TTL_MS = 180 * 86_400_000;

export interface OutcomeTokenPayload {
  predictionId: string;
  requestId: string | null;
  /** Unix seconds. */
  exp: number;
}

export type OutcomeTokenVerification =
  | { ok: true; payload: OutcomeTokenPayload }
  | { ok: false; reason: 'no_secret' | 'malformed' | 'signature' | 'expired' };

export function outcomeTokenSecret(): string | null {
  const s = process.env.OUTCOME_TOKEN_SECRET || process.env.CRON_SECRET;
  return s && s.trim() ? s : null;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payloadB64).digest());
}

export interface SignOptions {
  now?: Date;
  ttlMs?: number;
  /** Tests only — production reads the env. */
  secret?: string;
}

/** Throws when no secret is configured (callers decide whether that is fatal). */
export function signOutcomeReportToken(input: { predictionId: string; requestId?: string | null }, opts: SignOptions = {}): string {
  const secret = opts.secret ?? outcomeTokenSecret();
  if (!secret) throw new Error('OUTCOME_TOKEN_SECRET (or CRON_SECRET) is not configured');
  const now = opts.now ?? new Date();
  const payload: OutcomeTokenPayload = {
    predictionId: input.predictionId,
    requestId: input.requestId ?? null,
    exp: Math.floor((now.getTime() + (opts.ttlMs ?? OUTCOME_TOKEN_TTL_MS)) / 1000),
  };
  const p = b64url(JSON.stringify({ p: payload.predictionId, r: payload.requestId, e: payload.exp }));
  return `${p}.${sign(p, secret)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyOutcomeReportToken(token: string | null | undefined, opts: { now?: Date; secret?: string } = {}): OutcomeTokenVerification {
  const secret = opts.secret ?? outcomeTokenSecret();
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (!token || typeof token !== 'string' || token.length > 512) return { ok: false, reason: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };
  const [p, sig] = parts;

  const expected = Buffer.from(sign(p, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' };

  let decoded: { p?: unknown; r?: unknown; e?: unknown };
  try {
    decoded = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { p?: unknown; r?: unknown; e?: unknown };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const predictionId = typeof decoded.p === 'string' && UUID.test(decoded.p) ? decoded.p : null;
  const requestId = typeof decoded.r === 'string' && UUID.test(decoded.r) ? decoded.r : decoded.r == null ? null : undefined;
  const exp = typeof decoded.e === 'number' && Number.isFinite(decoded.e) ? decoded.e : null;
  if (!predictionId || requestId === undefined || exp == null) return { ok: false, reason: 'malformed' };

  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (exp <= nowSec) return { ok: false, reason: 'expired' };

  return { ok: true, payload: { predictionId, requestId, exp } };
}
