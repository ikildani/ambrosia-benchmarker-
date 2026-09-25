/**
 * lib/auth/session-cookie.ts — per-user identity for the middleware rate
 * limiter, read from the @supabase/ssr cookie without a network call.
 */

import { accessTokenFromCookies, subjectFromJwt, userIdFromCookies } from '@/lib/auth/session-cookie';

const SUB = '0f5b2a4e-6c3d-4b1a-9e8f-1234567890ab';

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function jwt(payload: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.sig`;
}

function ssrCookieValue(session: Record<string, unknown>): string {
  return `base64-${b64url(JSON.stringify(session))}`;
}

describe('subjectFromJwt', () => {
  it('reads sub from a well-formed JWT', () => {
    expect(subjectFromJwt(jwt({ sub: SUB, role: 'authenticated' }))).toBe(SUB);
  });
  it('returns null for junk', () => {
    expect(subjectFromJwt('not.a.jwt.at.all')).toBeNull();
    expect(subjectFromJwt('a.b')).toBeNull();
    expect(subjectFromJwt(`x.${b64url('{"nosub":1}')}.y`)).toBeNull();
    expect(subjectFromJwt(null)).toBeNull();
  });
});

describe('accessTokenFromCookies / userIdFromCookies', () => {
  const token = jwt({ sub: SUB, exp: 9999999999 });

  it('single @supabase/ssr cookie', () => {
    const cookies = [{ name: 'sb-abcdefgh-auth-token', value: ssrCookieValue({ access_token: token, refresh_token: 'r' }) }];
    expect(accessTokenFromCookies(cookies)).toBe(token);
    expect(userIdFromCookies(cookies)).toBe(SUB);
  });

  it('chunked cookie (.0, .1, .2) is reassembled in order even when listed out of order', () => {
    const whole = ssrCookieValue({ access_token: token, refresh_token: 'r'.repeat(4000), user: { id: SUB } });
    const size = Math.ceil(whole.length / 3);
    const parts = [whole.slice(0, size), whole.slice(size, 2 * size), whole.slice(2 * size)];
    const cookies = [
      { name: 'sb-abcdefgh-auth-token.2', value: parts[2] },
      { name: 'sb-abcdefgh-auth-token.0', value: parts[0] },
      { name: 'some-other-cookie', value: 'x' },
      { name: 'sb-abcdefgh-auth-token.1', value: parts[1] },
    ];
    expect(userIdFromCookies(cookies)).toBe(SUB);
  });

  it('legacy raw JWT cookie and raw JSON session', () => {
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: token }])).toBe(SUB);
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: JSON.stringify({ access_token: token }) }])).toBe(SUB);
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: JSON.stringify([token, 'refresh']) }])).toBe(SUB);
  });

  it('malformed or absent cookies yield null, never throw', () => {
    expect(userIdFromCookies([])).toBeNull();
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: 'base64-!!!notbase64!!!' }])).toBeNull();
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: ssrCookieValue({ access_token: 'garbage' }) }])).toBeNull();
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token-code-verifier', value: token }])).toBeNull();
  });

  it('rejects a sub that is not a uuid (defence against forged cookies feeding the limiter key)', () => {
    const forged = jwt({ sub: 'admin' });
    expect(userIdFromCookies([{ name: 'sb-abcdefgh-auth-token', value: forged }])).toBeNull();
  });
});
