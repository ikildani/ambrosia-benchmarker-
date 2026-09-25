/** One-off: fill licensor/licensee country + region on real rows from the name map. Run: ENV_FILE=../ambrosia-benchmarker/.env.local npx tsx scripts/ingestion/classify-countries-once.ts */
import { createClient } from '@supabase/supabase-js';
import { classifyCompanyCountry, deriveRegion } from '@/lib/ingestion/company-geography';
import { readFileSync } from 'fs';
const env: Record<string, string> = {};
for (const line of readFileSync(process.env.ENV_FILE ?? '.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/); if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('missing env'); process.exit(1); }
const sb = createClient(url, key);
(async () => {
  const { data, error } = await sb.from('deals').select('id, licensor_name, licensee_name, licensor_country, licensee_country').eq('is_synthetic', false).or('licensor_country.is.null,licensee_country.is.null').limit(2000);
  if (error) { console.log('read error', error.message); process.exit(1); }
  let updated = 0, unknown = 0;
  for (const d of data ?? []) {
    const patch: Record<string, unknown> = {};
    if (!d.licensor_country) { const c = classifyCompanyCountry(d.licensor_name); if (c.country !== 'unknown') { patch.licensor_country = c.country; patch.licensor_region = deriveRegion(c.country); } }
    if (!d.licensee_country) { const c = classifyCompanyCountry(d.licensee_name); if (c.country !== 'unknown') { patch.licensee_country = c.country; patch.licensee_region = deriveRegion(c.country); } }
    if (Object.keys(patch).length === 0) { unknown++; continue; }
    const { error: ue } = await sb.from('deals').update(patch).eq('id', d.id);
    if (ue) console.log('update error', d.id, ue.message); else updated++;
  }
  console.log('rows scanned', data?.length, 'updated', updated, 'still unknown', unknown);
})();
