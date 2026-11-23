/** Production MonitorContext: real clients, built lazily so a missing key fails only its own check. */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateDealTerms } from '@/lib/calculations';
import { ensureBenchmarksLoaded } from '@/lib/benchmarks';
import type { MonitorContext } from './types';

export const PRODUCTION_URL = 'https://solidus.ambrosiaventures.co';

export function createMonitorContext(now = new Date()): MonitorContext {
  const env = process.env as Record<string, string | undefined>;
  let service: SupabaseClient | null = null;
  let anon: SupabaseClient | null = null;
  let stripe: Stripe | null | undefined;
  return {
    now,
    env,
    appUrl: (env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL).replace(/\/$/, ''),
    fetch: (input, init) => fetch(input, init),
    service: () => (service ??= createServiceClient()),
    anon: () => {
      if (!anon) {
        const url = env.NEXT_PUBLIC_SUPABASE_URL;
        const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL or anon key not set');
        anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      }
      return anon;
    },
    stripe: () => {
      if (stripe === undefined) {
        // Same validation as app/api/checkout/route.ts.
        const key = env.STRIPE_SECRET_KEY?.trim();
        stripe = key && key.startsWith('sk_') ? new Stripe(key) : null;
      }
      return stripe;
    },
    calculate: calculateDealTerms,
    loadBenchmarks: ensureBenchmarksLoaded,
  };
}
