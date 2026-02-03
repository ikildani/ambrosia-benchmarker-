/**
 * Simple in-memory rate limiter for API endpoints.
 * For production at scale, consider using Redis-based solution like @upstash/ratelimit.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
// Keys are formatted as `${identifier}:${endpoint}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Auto-cleanup of expired entries
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  limit: number;
  // Time window in seconds
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
  // Standard API endpoints
  default: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  // High-traffic read endpoints
  deals: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  // Computation-heavy endpoints
  calculations: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
  // Partner matching (expensive queries)
  partnerMatch: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  // Event tracking (high volume expected)
  events: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  // AI generation (very expensive)
  aiGeneration: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
};

/**
 * Check and update rate limit for a given identifier and endpoint.
 *
 * @param identifier - Unique identifier (IP address, user ID, or anonymous ID)
 * @param endpoint - Endpoint name for separate limits
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and limit info
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.default
): RateLimitResult {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + config.windowSeconds * 1000,
    };
    rateLimitStore.set(key, entry);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get rate limit headers for response.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  };
}

/**
 * Extract identifier from request for rate limiting.
 * Prioritizes: user_id > anonymous_id > session_id > IP address
 */
export function getIdentifier(request: Request): string {
  // Try to get user/session identifiers from query params or headers
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const anonymousId = url.searchParams.get('anonymous_id');
  const sessionId = url.searchParams.get('session_id');

  if (userId) return `user:${userId}`;
  if (anonymousId) return `anon:${anonymousId}`;
  if (sessionId) return `session:${sessionId}`;

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}
