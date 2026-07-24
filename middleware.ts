import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, RATE_LIMIT_CONFIGS, getRateLimitHeaders } from '@/lib/rate-limit';
import type { RateLimitConfig } from '@/lib/rate-limit';

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
  '/api/events': RATE_LIMIT_CONFIGS.events,
  '/api/user': { limit: 10, windowSeconds: 60 },
  '/api/companies': RATE_LIMIT_CONFIGS.deals,
  '/api/content': RATE_LIMIT_CONFIGS.default,
  '/api/landing-pages': RATE_LIMIT_CONFIGS.default,
  '/api/report-purchase': { limit: 10, windowSeconds: 60 },
  '/api/embed': RATE_LIMIT_CONFIGS.default,
  '/api/watchlist': RATE_LIMIT_CONFIGS.default,
  '/api/promo': { limit: 10, windowSeconds: 60 },
};

function getRateLimitConfig(pathname: string): RateLimitConfig | null {
  // Check exact matches first, then prefix matches
  for (const [route, config] of Object.entries(ROUTE_RATE_LIMITS)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return config;
    }
  }
  return RATE_LIMIT_CONFIGS.default;
}

export async function middleware(request: NextRequest) {
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
    const rateLimitConfig = getRateLimitConfig(request.nextUrl.pathname);
    if (rateLimitConfig) {
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

      // Prefer user ID from Supabase auth cookie for fairer rate limiting
      // (avoids shared-IP collisions and rotating-IP bypasses)
      let identifier = `ip:${ip}`;
      try {
        const authCookie = request.cookies.getAll().find(c => c.name.includes('auth-token') && !c.name.includes('.'));
        if (authCookie?.value) {
          const payload = JSON.parse(Buffer.from(authCookie.value.split('.')[1], 'base64url').toString());
          if (payload.sub) identifier = `user:${payload.sub}`;
        }
      } catch { /* fall back to IP */ }

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
        "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live https://snap.licdn.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com https://vercel.live https://api.perplexity.ai https://api.semanticscholar.org https://*.ingest.us.sentry.io https://px.ads.linkedin.com",
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
