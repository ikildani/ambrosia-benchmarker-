/**
 * Find corpus assets that are NOT matching the ASSET_PEAK_SALES_TABLE
 * but have specific named/code asset_names (not descriptive indication strings).
 * These are the highest-ROI targets for table expansion — real deal assets
 * that BD users could type into the calculator.
 */
import { SUPABASE_COMPARABLE_DEALS } from '@/data/comparable-deals-supabase';
import { lookupAssetPeakSales_M } from '@/data/asset-peak-sales';

interface Unmatched {
  asset: string;
  ta: string;
  phase: string;
  upfront: number;
  actualTotal: number;
  licensor: string;
  licensee: string;
}

// Descriptive indication-like strings that aren't real asset names
const DESCRIPTIVE_PATTERNS = [
  /^[a-z]+_[a-z]+_[a-z]+$/i,           // slug-style "breast_her2_solid"
  /^[a-z ]+ cancer$/i,                 // "breast cancer", "lung cancer"
  /^[a-z ]+ disease$/i,
  /^(depression|schizophrenia|obesity|psoriasis|autoimmune|fibrosis)$/i,
  /^solid[ _]tumors?$/i,
];

const unmatched: Unmatched[] = [];
for (const d of SUPABASE_COMPARABLE_DEALS) {
  if (!d.assetName || d.assetName.trim().length < 3) continue;
  const isDescriptive = DESCRIPTIVE_PATTERNS.some((re) => re.test(d.assetName!.trim()));
  if (isDescriptive) continue;
  if (lookupAssetPeakSales_M(d.assetName, d.headline) !== null) continue;
  unmatched.push({
    asset: d.assetName,
    ta: d.therapeuticArea,
    phase: d.phase,
    upfront: d.upfront,
    actualTotal: d.totalDealValue,
    licensor: d.licensor,
    licensee: d.licensee,
  });
}

// Sort by upfront descending (high-leverage deals)
unmatched.sort((a, b) => b.upfront - a.upfront);

console.log(`Unmatched named assets: ${unmatched.length} / ${SUPABASE_COMPARABLE_DEALS.length}`);
console.log(`\nTop 30 by upfront (highest-leverage to add to table):\n`);
for (const u of unmatched.slice(0, 30)) {
  console.log(
    `  ${u.asset.slice(0, 40).padEnd(40)} ${u.ta.padEnd(18)} ${u.phase.padEnd(12)} $${u.upfront.toFixed(0).padStart(5)}M  (${u.licensor.slice(0, 24)} → ${u.licensee.slice(0, 20)})`,
  );
}
