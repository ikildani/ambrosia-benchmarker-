/**
 * Is there an activated backtest behind the live licensing-intent score?
 * The upgrade gate and the landing copy only say "backtested against
 * announced deals" when this is true. Server-only (service client).
 */

import { createClient } from '@supabase/supabase-js';
import { loadMethodologySummary } from '@/lib/radar/backtest/run';

/**
 * Service-role client built here rather than through lib/supabase/server,
 * whose `next/headers` import makes a local `next build` reject this module's
 * chain from app/radar/page.tsx ("You're importing a component that needs
 * next/headers", Sep 25 2026). This helper never needs request cookies.
 */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function radarBacktested(): Promise<boolean> {
  try {
    const summary = await loadMethodologySummary(serviceClient());
    return !summary.fallback_active && !!summary.backtest?.activated;
  } catch {
    return false;
  }
}
