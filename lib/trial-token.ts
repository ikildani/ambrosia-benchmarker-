import { createHmac, timingSafeEqual } from 'crypto';

// Signed, expiring activation token for the email-trial funnel.
// Format: base64url(payloadJSON) + "." + base64url(hmac)
// Signed with CRON_SECRET (already a deployed, high-entropy secret).

const SECRET = () => process.env.CRON_SECRET || '';

interface TrialTokenPayload {
  email: string;
  /** Unix ms after which the LINK is dead (not the trial — the trial is 7d from click). */
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signTrialToken(email: string, linkValidDays = 21): string {
  const payload: TrialTokenPayload = {
    email: email.toLowerCase().trim(),
    exp: Date.now() + linkValidDays * 24 * 60 * 60 * 1000,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', SECRET()).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

export function verifyTrialToken(token: string): { email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  const expected = b64url(createHmac('sha256', SECRET()).update(payloadB64).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf-8')) as TrialTokenPayload;
    if (!payload.email || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
