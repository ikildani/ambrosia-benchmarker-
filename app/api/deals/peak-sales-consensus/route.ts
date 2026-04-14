/**
 * GET /api/deals/peak-sales-consensus
 *
 * Returns the analyst-consensus peak-sales anchor ($M) for a given
 * therapeutic-area + indication cohort, sourced from the deals table's
 * `peak_sales_consensus_m` column (populated by R60b migration 052 +
 * asset-peak-sales.ts lookup).
 *
 * Used by the calculator's "Use analyst consensus peak" helper — when a
 * BD user is valuing an asset in a cohort that has disclosed comparable
 * deals, this returns the median of their peak-sales anchors instead of
 * the TA default.
 *
 * Query params:
 *   ?ta=oncology&indication=lung_nsclc      required
 *   ?phase=phase3                            optional phase filter
 *   ?modality=mab                            optional modality filter
 *
 * Response:
 *   { count: n, median: $M, low: $M, high: $M, source: 'analyst_consensus' }
 *   OR { count: 0, median: null }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const ta = url.searchParams.get('ta');
  const indication = url.searchParams.get('indication');
  const phase = url.searchParams.get('phase');
  const modality = url.searchParams.get('modality');

  if (!ta || !indication) {
    return NextResponse.json(
      { error: 'ta and indication query params are required' },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  // R60d: production uses snake_case indication_category ("hemophilia_b",
  // "wet_amd") AND free-form indication_specific ("hemophilia B", "Wet AMD").
  // Calculator sends camelCase slug ("hemophiliaB"). Normalize both sides
  // (strip non-alphanum, lowercase) and compare client-side so we don't need
  // to rebuild the Supabase data.
  const normalize = (s: string): string => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const needle = normalize(indication);

  let query = supabase
    .from('deals')
    .select('peak_sales_consensus_m, asset_name, phase_at_signing, modality, indication_category, indication_specific')
    .eq('therapeutic_area', ta)
    .not('peak_sales_consensus_m', 'is', null);

  if (phase) query = query.eq('phase_at_signing', phase);
  if (modality) query = query.eq('modality', modality);

  const { data, error } = await query.limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    peak_sales_consensus_m: number | null;
    asset_name: string | null;
    indication_category: string | null;
    indication_specific: string | null;
  };
  const allRows = (data ?? []) as Row[];
  // Client-side normalized match: needle matches indication_category OR
  // indication_specific (either stripped to alphanumeric lowercase).
  const rows = allRows.filter((r) => {
    const cat = r.indication_category ? normalize(r.indication_category) : '';
    const spec = r.indication_specific ? normalize(r.indication_specific) : '';
    // Match if needle is exactly equal to cat/spec, OR cat/spec contains needle
    // as a prefix (e.g., "hemophiliab" matches "hemophiliabsevere"). This is
    // stricter than raw substring to avoid "amd" matching "gastric".
    return (
      cat === needle ||
      spec === needle ||
      cat.startsWith(needle) ||
      spec.startsWith(needle) ||
      needle.startsWith(cat) && cat.length >= 4 ||
      needle.startsWith(spec) && spec.length >= 4
    );
  });
  const peaks = rows
    .map((r) => r.peak_sales_consensus_m)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);

  if (peaks.length === 0) {
    return NextResponse.json({ count: 0, median: null, source: 'analyst_consensus' });
  }

  const median = peaks[Math.floor(peaks.length / 2)];
  const low = peaks[Math.floor(peaks.length * 0.25)];
  const high = peaks[Math.floor(peaks.length * 0.75)];

  return NextResponse.json({
    count: peaks.length,
    median,
    low,
    high,
    sampleAssets: rows
      .filter((r) => r.peak_sales_consensus_m != null)
      .slice(0, 5)
      .map((r) => ({ asset: r.asset_name, peak_M: r.peak_sales_consensus_m })),
    source: 'analyst_consensus',
  });
}
