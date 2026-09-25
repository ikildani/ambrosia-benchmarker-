/**
 * Read the signed-in user's id straight from the Supabase session cookie,
 * without a network call. Used by the middleware rate limiter so limits are
 * per user rather than per IP (a five-person BD team behind one office NAT
 * used to share one budget, and every Vercel request from the same region
 * looked like one client).
 *
 * `@supabase/ssr` stores the session as `sb-<ref>-auth-token`, value
 * `base64-<base64url(JSON session)>`, split into `.0`, `.1`, … chunks when it
 * exceeds ~3 KB. The JSON carries `access_token`, a JWT whose payload has
 * `sub`. Older builds stored the raw JWT in a single cookie; both shapes are
 * handled. Edge-safe: no Buffer, no Node APIs.
 */

export interface CookieLike {
  name: string;
  value: string;
}

const AUTH_COOKIE_RE = /^sb-[a-z0-9-]+-auth-token(?:\.(\d+))?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64UrlDecode(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    // atob yields a binary string; decode UTF-8 bytes properly.
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** `sub` from a JWT, or null when the token is not a well-formed JWT. */
export function subjectFromJwt(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const json = base64UrlDecode(parts[1]);
  if (!json) return null;
  try {
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Reassembles the (possibly chunked) Supabase auth cookie and returns the
 * session's access token, or null.
 */
export function accessTokenFromCookies(cookies: readonly CookieLike[]): string | null {
  const chunks: { index: number; value: string }[] = [];
  for (const c of cookies) {
    const m = AUTH_COOKIE_RE.exec(c.name);
    if (!m || !c.value) continue;
    chunks.push({ index: m[1] === undefined ? -1 : Number(m[1]), value: c.value });
  }
  if (chunks.length === 0) return null;
  // A single unchunked cookie (index -1) wins; otherwise join .0, .1, … in order.
  const single = chunks.find(c => c.index === -1);
  const raw = single ? single.value : chunks.sort((a, b) => a.index - b.index).map(c => c.value).join('');
  if (!raw) return null;

  if (raw.startsWith('base64-')) {
    const json = base64UrlDecode(raw.slice('base64-'.length));
    if (!json) return null;
    try {
      const session = JSON.parse(json) as { access_token?: unknown };
      return typeof session.access_token === 'string' ? session.access_token : null;
    } catch {
      return null;
    }
  }
  // Legacy: raw JSON session, or the bare JWT.
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as { access_token?: unknown } | unknown[];
      if (Array.isArray(parsed)) return typeof parsed[0] === 'string' ? parsed[0] : null;
      return typeof parsed.access_token === 'string' ? parsed.access_token : null;
    } catch {
      return null;
    }
  }
  return raw.split('.').length === 3 ? raw : null;
}

/** The signed-in user's id (JWT `sub`), or null when no valid session cookie is present. */
export function userIdFromCookies(cookies: readonly CookieLike[]): string | null {
  const sub = subjectFromJwt(accessTokenFromCookies(cookies));
  return sub && UUID_RE.test(sub) ? sub : null;
}
