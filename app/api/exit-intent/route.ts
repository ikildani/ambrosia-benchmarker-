/**
 * Exit-intent variant API.
 * Returns the currently active exit-intent copy variant from system_config.
 * Called by the ExitIntentCapture client component on mount.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { DEAL_STATS } from '@/lib/config/constants';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ExitIntentVariant {
  id: string;
  headline: string;
  subtext: string;
  buttonText: string;
  footnote: string;
}

const VARIANTS: ExitIntentVariant[] = [
  { id: 'A', headline: 'Wait — before you go', subtext: 'Get a free deal benchmark report for your next calculation.', buttonText: 'Send My Free Report', footnote: `No spam, unsubscribe anytime. ${DEAL_STATS.TOTAL_DEALS} deals benchmarked.` },
  { id: 'B', headline: 'Wait — before you go', subtext: `See how your deal compares to ${DEAL_STATS.TOTAL_DEALS} real biopharma transactions.`, buttonText: 'Show Me the Data', footnote: 'Free benchmarking insight. No credit card required.' },
  { id: 'C', headline: 'Wait — before you go', subtext: 'Join 50+ biotech BD teams using data-driven deal benchmarks.', buttonText: 'Get My Free Benchmark', footnote: 'Trusted by BD teams at top-20 pharma. No spam.' },
  { id: 'D', headline: 'Your deal terms may be below market', subtext: 'Get a free analysis showing how your terms compare to recent deals in your therapeutic area.', buttonText: 'See My Deal Analysis', footnote: `Instant benchmarking against ${DEAL_STATS.TOTAL_DEALS} verified transactions.` },
];

const DEFAULT_VARIANT: ExitIntentVariant = VARIANTS[0];

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'exit_intent_config')
      .single();

    if (!data?.value?.active_variant) {
      return NextResponse.json(DEFAULT_VARIANT);
    }

    const activeId = data.value.active_variant as string;
    const variant = VARIANTS.find((v: ExitIntentVariant) => v.id === activeId) || DEFAULT_VARIANT;

    return NextResponse.json(variant);
  } catch {
    return NextResponse.json(DEFAULT_VARIANT);
  }
}
