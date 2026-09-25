/**
 * Signed outcome-report tokens: round trip, expiry, tampering, malformed
 * input and the secret fallback.
 */

import {
  OUTCOME_TOKEN_TTL_MS,
  outcomeTokenSecret,
  signOutcomeReportToken,
  verifyOutcomeReportToken,
} from '@/lib/outcomes/report-token';

const SECRET = 'test-secret-0123456789';
const PREDICTION = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const REQUEST = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOW = new Date('2026-09-25T12:00:00Z');

describe('sign / verify', () => {
  it('round-trips the prediction, request and expiry', () => {
    const token = signOutcomeReportToken({ predictionId: PREDICTION, requestId: REQUEST }, { now: NOW, secret: SECRET });
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const v = verifyOutcomeReportToken(token, { now: NOW, secret: SECRET });
    expect(v).toEqual({ ok: true, payload: { predictionId: PREDICTION, requestId: REQUEST, exp: Math.floor((NOW.getTime() + OUTCOME_TOKEN_TTL_MS) / 1000) } });
  });

  it('accepts a token with no request id', () => {
    const token = signOutcomeReportToken({ predictionId: PREDICTION }, { now: NOW, secret: SECRET });
    const v = verifyOutcomeReportToken(token, { now: NOW, secret: SECRET });
    expect(v.ok && v.payload.requestId).toBeNull();
  });

  it('is URL-safe (no dots inside either part, no padding)', () => {
    const token = signOutcomeReportToken({ predictionId: PREDICTION, requestId: REQUEST }, { now: NOW, secret: SECRET });
    expect(token.split('.')).toHaveLength(2);
    expect(token).not.toMatch(/[=+/]/);
    expect(encodeURIComponent(token)).toBe(token);
  });
});

describe('expiry', () => {
  it('is valid just before expiry and rejected at / after it', () => {
    const token = signOutcomeReportToken({ predictionId: PREDICTION }, { now: NOW, secret: SECRET, ttlMs: 60_000 });
    expect(verifyOutcomeReportToken(token, { now: new Date(NOW.getTime() + 59_000), secret: SECRET }).ok).toBe(true);
    const at = verifyOutcomeReportToken(token, { now: new Date(NOW.getTime() + 60_000), secret: SECRET });
    expect(at).toEqual({ ok: false, reason: 'expired' });
    const after = verifyOutcomeReportToken(token, { now: new Date(NOW.getTime() + 181 * 86_400_000), secret: SECRET });
    expect(after).toEqual({ ok: false, reason: 'expired' });
  });

  it('defaults to a 180-day life', () => {
    expect(OUTCOME_TOKEN_TTL_MS).toBe(180 * 86_400_000);
    const token = signOutcomeReportToken({ predictionId: PREDICTION }, { now: NOW, secret: SECRET });
    expect(verifyOutcomeReportToken(token, { now: new Date(NOW.getTime() + 179 * 86_400_000), secret: SECRET }).ok).toBe(true);
    expect(verifyOutcomeReportToken(token, { now: new Date(NOW.getTime() + 181 * 86_400_000), secret: SECRET }).ok).toBe(false);
  });
});

describe('tampering', () => {
  const token = signOutcomeReportToken({ predictionId: PREDICTION, requestId: REQUEST }, { now: NOW, secret: SECRET });
  const [payload, sig] = token.split('.');

  it('rejects a changed payload (different prediction) with the old signature', () => {
    const other = Buffer.from(JSON.stringify({ p: REQUEST, r: null, e: 4_000_000_000 })).toString('base64url');
    expect(verifyOutcomeReportToken(`${other}.${sig}`, { now: NOW, secret: SECRET })).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a changed expiry', () => {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p: string; r: string; e: number };
    const extended = Buffer.from(JSON.stringify({ ...decoded, e: decoded.e + 86_400 * 365 })).toString('base64url');
    expect(verifyOutcomeReportToken(`${extended}.${sig}`, { now: NOW, secret: SECRET }).ok).toBe(false);
  });

  it('rejects a flipped signature byte and a wrong secret', () => {
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
    expect(verifyOutcomeReportToken(`${payload}.${flipped}`, { now: NOW, secret: SECRET })).toEqual({ ok: false, reason: 'signature' });
    expect(verifyOutcomeReportToken(token, { now: NOW, secret: 'another-secret' })).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a well-signed payload whose fields are not a uuid / number', () => {
    // Sign a bad payload with the real secret to isolate the shape check.
    const { createHmac } = jest.requireActual<typeof import('crypto')>('crypto');
    const bad = Buffer.from(JSON.stringify({ p: 'not-a-uuid', r: null, e: 4_000_000_000 })).toString('base64url');
    const badSig = createHmac('sha256', SECRET).update(bad).digest('base64url');
    expect(verifyOutcomeReportToken(`${bad}.${badSig}`, { now: NOW, secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    const noExp = Buffer.from(JSON.stringify({ p: PREDICTION, r: null })).toString('base64url');
    const noExpSig = createHmac('sha256', SECRET).update(noExp).digest('base64url');
    expect(verifyOutcomeReportToken(`${noExp}.${noExpSig}`, { now: NOW, secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('malformed input and secrets', () => {
  it('rejects empty, undotted, over-long and non-JSON tokens', () => {
    expect(verifyOutcomeReportToken('', { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyOutcomeReportToken(undefined, { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyOutcomeReportToken('abc', { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyOutcomeReportToken('a.b.c', { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyOutcomeReportToken('x'.repeat(600), { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
    // valid signature over a non-JSON payload
    const { createHmac } = jest.requireActual<typeof import('crypto')>('crypto');
    const p = Buffer.from('not json').toString('base64url');
    const s = createHmac('sha256', SECRET).update(p).digest('base64url');
    expect(verifyOutcomeReportToken(`${p}.${s}`, { secret: SECRET })).toEqual({ ok: false, reason: 'malformed' });
  });

  it('reads OUTCOME_TOKEN_SECRET first and falls back to CRON_SECRET', () => {
    const prev = { o: process.env.OUTCOME_TOKEN_SECRET, c: process.env.CRON_SECRET };
    try {
      delete process.env.OUTCOME_TOKEN_SECRET;
      delete process.env.CRON_SECRET;
      expect(outcomeTokenSecret()).toBeNull();
      expect(() => signOutcomeReportToken({ predictionId: PREDICTION })).toThrow(/not configured/);
      expect(verifyOutcomeReportToken('a.b')).toEqual({ ok: false, reason: 'no_secret' });

      process.env.CRON_SECRET = 'cron-secret';
      expect(outcomeTokenSecret()).toBe('cron-secret');
      const t = signOutcomeReportToken({ predictionId: PREDICTION }, { now: NOW });
      expect(verifyOutcomeReportToken(t, { now: NOW }).ok).toBe(true);

      process.env.OUTCOME_TOKEN_SECRET = 'outcome-secret';
      expect(outcomeTokenSecret()).toBe('outcome-secret');
      // a token signed under the fallback no longer verifies once the dedicated secret is set
      expect(verifyOutcomeReportToken(t, { now: NOW })).toEqual({ ok: false, reason: 'signature' });
    } finally {
      if (prev.o === undefined) delete process.env.OUTCOME_TOKEN_SECRET; else process.env.OUTCOME_TOKEN_SECRET = prev.o;
      if (prev.c === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev.c;
    }
  });
});
