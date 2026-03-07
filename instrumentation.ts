export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Validate critical environment variables at startup (production only)
    if (process.env.NODE_ENV === 'production') {
      const required: [string, string][] = [
        ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase connection'],
        ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase auth'],
        ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role'],
        ['ANTHROPIC_API_KEY', 'AI generation (deal memos, playbooks)'],
      ];
      const missing = required.filter(([key]) => !process.env[key]);
      if (missing.length > 0) {
        const names = missing.map(([key, desc]) => `  - ${key} (${desc})`).join('\n');
        console.error(`[startup] Missing required environment variables:\n${names}`);
      }

      const recommended: [string, string][] = [
        ['STRIPE_SECRET_KEY', 'Payment processing'],
        ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook verification'],
        ['UPSTASH_REDIS_REST_URL', 'Rate limiting (falls back to in-memory)'],
        ['SENTRY_DSN', 'Error monitoring'],
      ];
      const missingRecommended = recommended.filter(([key]) => !process.env[key]);
      if (missingRecommended.length > 0) {
        const names = missingRecommended.map(([key, desc]) => `  - ${key} (${desc})`).join('\n');
        console.warn(`[startup] Recommended environment variables not set:\n${names}`);
      }
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
