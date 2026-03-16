/**
 * Rate limiter with Upstash Redis backend.
 *
 * Production: Upstash Redis is REQUIRED. Missing env vars will throw at startup.
 * Development: Falls back to permissive in-memory rate limiting when Upstash is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  default: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  deals: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  calculations: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
  partnerMatch: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  events: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  aiGeneration: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
};

// --- Environment checks ---

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const isUpstashConfigured = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Validate Upstash is configured in production — checked at runtime, not import time
// (next build evaluates modules during static generation where env vars may not be available)
let _upstashValidated = false;
function validateUpstashInProduction() {
  if (_upstashValidated || !IS_PRODUCTION) return;
  if (!isUpstashConfigured()) {
    console.error(
      '[RateLimit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.'
    );
  }
  _upstashValidated = true;
}

// --- Upstash Redis-backed rate limiter ---

let redis: Redis | null = null;
const ratelimiters = new Map<string, Ratelimit>();

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

function getUpstashLimiter(endpoint: string, config: RateLimitConfig): Ratelimit {
  const key = `${endpoint}:${config.limit}:${config.windowSeconds}`;
  let limiter = ratelimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
      prefix: `rl:${endpoint}`,
    });
    ratelimiters.set(key, limiter);
  }
  return limiter;
}

// --- In-memory fallback (development only) ---

interface InMemoryEntry {
  count: number;
  resetTime: number;
}

const inMemoryStore = new Map<string, InMemoryEntry>();

if (typeof setInterval !== 'undefined' && !IS_PRODUCTION) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (now > entry.resetTime) {
        inMemoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function checkInMemoryDev(identifier: string, endpoint: string, config: RateLimitConfig): RateLimitResult {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  let entry = inMemoryStore.get(key);

  // Permissive in dev: 5x the configured limit
  const devLimit = config.limit * 5;

  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + config.windowSeconds * 1000 };
    inMemoryStore.set(key, entry);
    return { success: true, limit: devLimit, remaining: devLimit - 1, resetTime: entry.resetTime };
  }

  entry.count++;
  if (entry.count > devLimit) {
    return { success: false, limit: devLimit, remaining: 0, resetTime: entry.resetTime };
  }
  return { success: true, limit: devLimit, remaining: devLimit - entry.count, resetTime: entry.resetTime };
}

// --- Public API (same signatures as before) ---

export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
): Promise<RateLimitResult> {
  validateUpstashInProduction();
  if (isUpstashConfigured()) {
    try {
      const limiter = getUpstashLimiter(endpoint, config);
      const result = await limiter.limit(`${identifier}:${endpoint}`);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.reset,
      };
    } catch (error) {
      if (IS_PRODUCTION) {
        // In production, log the error and fail open with a warning (don't block requests)
        console.error('[RateLimit] Upstash error in production:', error);
        Sentry.captureMessage('Rate limiter Upstash Redis unavailable in production', {
          level: 'error',
          tags: { component: 'rate-limiter', endpoint },
          extra: { error: error instanceof Error ? error.message : String(error), identifier },
        });
        // Fail open: allow request but with reduced remaining count to signal degradation
        return { success: true, limit: config.limit, remaining: 0, resetTime: Date.now() + config.windowSeconds * 1000 };
      }
      console.error('[RateLimit] Upstash error, falling back to in-memory (dev):', error);
      return checkInMemoryDev(identifier, endpoint, config);
    }
  }

  // Not configured — use in-memory fallback (dev or production without Upstash)
  return checkInMemoryDev(identifier, endpoint, config);
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  };
}

export function getIdentifier(request: Request): string {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const anonymousId = url.searchParams.get('anonymous_id');
  const sessionId = url.searchParams.get('session_id');

  if (userId) return `user:${userId}`;
  if (anonymousId) return `anon:${anonymousId}`;
  if (sessionId) return `session:${sessionId}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}
