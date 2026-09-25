/**
 * Is there an activated backtest behind the live licensing-intent score?
 * The upgrade gate and the landing copy only say "backtested against
 * announced deals" when this is true. Server-only (service client).
 */

import { createServiceClient } from '@/lib/supabase/server';
import { loadMethodologySummary } from '@/lib/radar/backtest/run';

export async function radarBacktested(): Promise<boolean> {
  try {
    const summary = await loadMethodologySummary(createServiceClient());
    return !summary.fallback_active && !!summary.backtest?.activated;
  } catch {
    return false;
  }
}
