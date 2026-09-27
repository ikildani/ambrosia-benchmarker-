/**
 * Lazy Supabase browser client (Sep 2026 performance pass).
 *
 * `@supabase/ssr` + `@supabase/supabase-js` are 48 KB compressed and ~300 ms of
 * main-thread time on a phone, and every page paid for them at startup through
 * AuthContext and the tracking hook even when nobody was signed in. This module
 * has no Supabase import of its own: callers ask for the client only when a
 * session may exist (hasLocalSession) or when the visitor actually signs in.
 */
export const isSupabaseConfigured = (): boolean =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when this browser has any trace of a Supabase session or our own signed-in flag. */
export function hasLocalSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('is_authenticated') === 'true') return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith('sb-') && k.includes('auth-token')) return true;
    }
    if (typeof document !== 'undefined' && /(^|;\s*)sb-[^=]*auth[^=]*=/.test(document.cookie)) return true;
  } catch {
    // storage blocked: treat as anonymous
  }
  return false;
}

type ClientModule = typeof import('@/lib/supabase/client');
let modulePromise: Promise<ClientModule> | null = null;

/** Loads the client module on first use; resolves to null when Supabase is not configured. */
export async function getSupabaseClient(): Promise<ReturnType<ClientModule['createClient']> | null> {
  if (!isSupabaseConfigured()) return null;
  if (!modulePromise) modulePromise = import('@/lib/supabase/client');
  const m = await modulePromise;
  return m.createClient();
}

export type LazySupabaseClient = NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>;
