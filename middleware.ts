import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';
import { userIdFromCookies } from '@/lib/auth/session-cookie';

// Method-specific overrides, checked before the path map. The Radar search
// route serves typeahead on GET (every keystroke, plain DB read) and the
// natural-language parser on POST (a model call); one budget for both meant
// suggestions stopped after five keystrokes.
const METHOD_ROUTE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'GET /api/radar/search': RATE_LIMIT_CONFIGS.radarTypeahead,
  'POST /api/radar/search': RATE_LIMIT_CONFIGS.radarNl,
};

// Route-to-rate-limit config map
const ROUTE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/checkout': { limit: 5, windowSeconds: 60 },
  '/api/deal-memo': RATE_LIMIT_CONFIGS.aiGeneration,
  '/api/playbook': RATE_LIMIT_CONFIGS.aiGeneration,
  '/api/generate': RATE_LIMIT_CONFIGS.aiGeneration,
  '/api/calculations': RATE_LIMIT_CONFIGS.calculations,
  '/api/deals': RATE_LIMIT_CONFIGS.deals,
  '/api/partners': RATE_LIMIT_CONFIGS.partnerMatch,
  '/api/scenarios': RATE_LIMIT_CONFIGS.default,
  '/api/newsletter': { limit: 5, windowSeconds: 60 },
  '/api/share': { limit: 10, windowSeconds: 60 },
  '/api/billing': { limit: 10, windowSeconds: 60 },
  '/api/email': { limit: 5, windowSeconds: 60 },
  '/api/email-results': { limit: 3, windowSeconds: 60 },
  '/api/events': RATE_LIMIT_CONFIGS.events,
  '/api/user': { limit: 10, windowSeconds: 60 },
  '/api/companies': RATE_LIMIT_CONFIGS.deals,
  '/api/content': RATE_LIMIT_CONFIGS.default,
  '/api/landing-pages': RATE_LIMIT_CONFIGS.default,
  '/api/report-purchase': { limit: 10, windowSeconds: 60 },
  '/api/embed': RATE_LIMIT_CONFIGS.default,
  '/api/watchlist': RATE_LIMIT_CONFIGS.default,
  '/api/promo': { limit: 10, windowSeconds: 60 },
  // Asset Radar: narrative calls Opus and export renders a PDF, so they keep
  // the AI budget; search is split by method above; every other Radar route
  // is a plain DB read (feed, facets, compare, signals, watchlist, alerts…).
  '/api/radar/narrative': RATE_LIMIT_CONFIGS.aiGeneration,
  '/api/radar/export': RATE_LIMIT_CONFIGS.aiGeneration,
  '/api/radar': RATE_LIMIT_CONFIGS.radarRead,
};

function getRateLimitConfig(method: string, pathname: string): RateLimitConfig | null {
  const byMethod = METHOD_ROUTE_RATE_LIMITS[`${method.toUpperCase()} ${pathname}`];
  if (byMethod) return byMethod;
  // Check exact matches first, then prefix matches
  for (const [route, config] of Object.entries(ROUTE_RATE_LIMITS)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return config;
    }
  }
  return RATE_LIMIT_CONFIGS.default;
}

export async function middleware(request: NextRequest) {
  // 301 redirect old domain to new domain
  const host = request.headers.get('host') || '';
  if (host === 'calculator.ambrosiaventures.co') {
    const url = new URL(request.url);
    url.host = 'solidus.ambrosiaventures.co';
    return NextResponse.redirect(url.toString(), 301);
  }

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // --- CSRF Protection: Origin validation for mutating API requests ---
  const isMutatingRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const isWebhook = request.nextUrl.pathname === '/api/webhook';
  const isCron = request.nextUrl.pathname.startsWith('/api/cron/');

  if (isMutatingRequest && isApiRoute && !isWebhook && !isCron) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://solidus.ambrosiaventures.co',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000');
    }

    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        return NextResponse.json(
          { error: 'Forbidden: invalid origin' },
          { status: 403 }
        );
      }
    } else {
      // SECURITY: When Origin header is missing (form submissions, legacy browsers),
      // fall back to Referer header validation to prevent CSRF attacks.
      const referer = request.headers.get('referer');
      if (referer) {
        const refererOrigin = new URL(referer).origin;
        if (!allowedOrigins.includes(refererOrigin)) {
          return NextResponse.json(
            { error: 'Forbidden: invalid referer' },
            { status: 403 }
          );
        }
      }
      // If neither Origin nor Referer is present: block sensitive endpoints,
      // allow others (same-origin fetch() may omit both headers).
      const sensitiveRoutes = ['/api/checkout', '/api/billing', '/api/user/delete-data', '/api/user/profile'];
      const isSensitive = sensitiveRoutes.some(r => request.nextUrl.pathname.startsWith(r));
      if (isSensitive) {
        return NextResponse.json(
          { error: 'Forbidden: origin header required' },
          { status: 403 }
        );
      }
    }
  }

  // --- Rate Limiting: apply to all API routes except webhook and cron ---
  if (isApiRoute && !isWebhook && !isCron) {
    const rateLimitConfig = getRateLimitConfig(request.method, request.nextUrl.pathname);
    if (rateLimitConfig) {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

      // Prefer the user id from the Supabase session cookie (chunked
      // @supabase/ssr format handled in lib/auth/session-cookie) so a team
      // behind one office NAT does not share one budget; fall back to IP.
      const userId = userIdFromCookies(request.cookies.getAll());
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;

      try {
        const result = await checkRateLimit(identifier, request.nextUrl.pathname, rateLimitConfig);
        if (!result.success) {
          return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
              status: 429,
              headers: {
                ...getRateLimitHeaders(result),
                'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
              },
            }
          );
        }
      } catch (e) {
        console.warn('[rate-limit] Redis failed:', e);
      }
    }
  }

  // === Enterprise Security Headers ===

  // CSP — tightened for enterprise. unsafe-inline required for Next.js hydration.
  const cspHeader = isApiRoute
    ? ''
    : [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com https://vercel.live https://snap.licdn.com https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vercel.live https://api.perplexity.ai https://api.semanticscholar.org https://*.ingest.us.sentry.io https://px.ads.linkedin.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.analytics.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com",
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

  // Enterprise security headers on all responses
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

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

  // Anonymous traffic (no Supabase auth cookie) has no session to refresh:
  // skip the network round-trip entirely. Crawlers and most visitors land here.
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('auth-token'));
  if (!hasAuthCookie) return supabaseResponse;

  // Refresh session if expired - required for Server Components.
  // Sep 25 2026: Supabase stalled for ~25 minutes and every page returned
  // 504 MIDDLEWARE_INVOCATION_TIMEOUT because this await had no bound.
  // Cap it: on timeout the request proceeds without a refreshed session
  // (server components re-check auth themselves), instead of taking the
  // whole site down with the database.
  const AUTH_REFRESH_TIMEOUT_MS = 4_000;
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('auth refresh timeout')), AUTH_REFRESH_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn('[middleware] session refresh skipped:', e instanceof Error ? e.message : String(e));
  }

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
