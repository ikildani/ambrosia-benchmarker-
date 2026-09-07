/**
 * READ-ONLY probe of the production `deals` table: which enrichment columns
 * exist and how many rows populate them. Used by the per-factor calibration
 * study to decide which factor inputs are actually observable.
 *
 * Run: npx tsx scripts/calibration/live-enrichment-coverage.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Performs SELECT queries only.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.log('No Supabase credentials in .env.local — skipping live probe.');
    return;
  }
  const sb = createClient(url, key);
  const { data, error } = await sb.from('deals').select('*').limit(1);
  if (error) throw error;
  const columns = Object.keys(data?.[0] ?? {});
  console.log('deals columns:', columns.join(', '));

  const base = () => sb.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false);
  const { count: total } = await base();
  console.log('non-synthetic rows:', total);

  const candidates = columns.filter(c =>
    /designation|mechanism|target|biomarker|line_of|competitive|combination|data_quality|indication_specific|modality|phase|territory|deal_type|first_in|orphan|breakthrough/i.test(c),
  );
  for (const c of candidates) {
    const { count } = await base().not(c, 'is', null);
    let nonEmpty = count ?? 0;
    // Array columns default to '{}' — count rows with at least one element.
    if (Array.isArray(data?.[0]?.[c])) {
      const { count: ne } = await base().not(c, 'eq', '{}');
      nonEmpty = ne ?? 0;
    }
    console.log(`${c}: non-null=${count} non-empty=${nonEmpty} (${(((nonEmpty) / (total || 1)) * 100).toFixed(1)}%)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
