import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Generate a nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // CSP disabled — Next.js inline scripts require unsafe-inline which negates nonce benefits.
  // TODO: Re-enable with next/headers nonce propagation when upgrading to Next.js 15+
  const cspHeader = '';

  // Set the nonce in request headers so Server Components can read it
  const requestHeaders = new Headers(request.headers);
  if (cspHeader) {
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', cspHeader);
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP on the response
  if (cspHeader) {
    supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        // Re-apply CSP after creating new response
        if (cspHeader) {
          supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
        }
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not run any Supabase methods between createServerClient
  // and supabase.auth.getUser(). Running queries may reset the auth state.

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
