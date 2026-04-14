/**
 * Populate deals.peak_sales_consensus_m from the curated asset-peak-sales
 * lookup table (R60 — data/asset-peak-sales.ts).
 *
 * Runs in two modes:
 *   --dry-run   preview counts per match
 *   --apply     UPDATE rows in production
 *
 * Safety: only UPDATEs rows where peak_sales_consensus_m IS NULL (never
 * overwrites a manually-set value). Matches are logged to stdout.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { lookupAssetPeakSales_M } from '@/data/asset-peak-sales';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE credentials in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const apply = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${apply ? 'APPLY (will UPDATE)' : 'DRY RUN (preview only)'}\n`);

  // Pull all deals with asset_name — paginate through. Only consider rows
  // where peak_sales_consensus_m is NULL (don't overwrite human overrides).
  const PAGE = 1000;
  const all: { id: string; asset_name: string | null; licensor_name: string | null; licensee_name: string | null }[] = [];
  for (let p = 0; p < 10; p++) {
    const { data, error } = await supabase
      .from('deals')
      .select('id, asset_name, licensor_name, licensee_name, peak_sales_consensus_m')
      .is('peak_sales_consensus_m', null)
      .not('asset_name', 'is', null)
      .range(p * PAGE, (p + 1) * PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  console.log(`Fetched ${all.length} deals with asset_name and peak_sales_consensus_m=NULL\n`);

  const updates: Array<{ id: string; peak: number; sample: string }> = [];
  for (const d of all) {
    const headline = `${d.asset_name} — ${d.licensor_name} to ${d.licensee_name}`;
    const peak = lookupAssetPeakSales_M(d.asset_name, headline);
    if (peak !== null) {
      updates.push({ id: d.id, peak, sample: d.asset_name ?? '' });
    }
  }

  console.log(`Matches: ${updates.length} / ${all.length}`);
  console.log('Sample matches (first 20):');
  for (const u of updates.slice(0, 20)) {
    console.log(`  ${u.sample.padEnd(50)} peak=$${u.peak}M`);
  }

  if (!apply) {
    console.log('\nDry run — no UPDATEs executed. Pass --apply to commit.');
    return;
  }

  console.log(`\nApplying ${updates.length} UPDATE statements...`);
  let ok = 0;
  let fail = 0;
  // Batch in groups of 100 to avoid massive single transactions.
  for (const u of updates) {
    const { error } = await supabase
      .from('deals')
      .update({ peak_sales_consensus_m: u.peak })
      .eq('id', u.id)
      .is('peak_sales_consensus_m', null); // extra guard
    if (error) {
      console.error(`  FAIL ${u.id}: ${error.message}`);
      fail++;
    } else {
      ok++;
    }
  }
  console.log(`\nResult: ${ok} updated, ${fail} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
