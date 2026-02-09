import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Build CSP — use 'self' + 'unsafe-inline' for scripts since Next.js App Router
  // injects inline scripts for hydration that don't carry nonces automatically.
  // TODO: Re-enable nonce-based CSP when upgrading to Next.js 15+ with next/headers nonce propagation
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const cspHeader = isApiRoute
    ? '' // API routes don't need CSP
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vercel.live",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://vercel.live",
        "frame-ancestors 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "upgrade-insecure-requests",
      ].join('; ');

  const requestHeaders = new Headers(request.headers);
  if (cspHeader) {
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
