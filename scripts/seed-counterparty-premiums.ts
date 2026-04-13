/**
 * One-off seed script — populates the `counterparty_premiums` table by
 * running the same logic the cron route uses, but bypassing the
 * CRON_SECRET check. Useful for the first deployment and for local dev.
 *
 * Usage:
 *   npx tsx scripts/seed-counterparty-premiums.ts
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import {
  computeCounterpartyPremiums,
  type DealRow,
  type CompanyRow,
} from '../lib/financial/counterparty-premiums';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('Pulling deals…');
  const { data: dealRows, error: dealErr } = await supabase
    .from('deals')
    .select('id, licensee_id, licensee_name, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, modality, therapeutic_area')
    .not('total_deal_value_usd', 'is', null)
    .not('licensee_id', 'is', null)
    .limit(5000);
  if (dealErr) throw dealErr;

  console.log('Pulling companies…');
  const { data: companyRows, error: compErr } = await supabase
    .from('companies')
    .select('id, name, company_type')
    .limit(5000);
  if (compErr) throw compErr;

  const deals = (dealRows ?? []) as DealRow[];
  const companies = (companyRows ?? []) as CompanyRow[];

  console.log(`Computing premiums for ${deals.length} deals across ${companies.length} companies…`);
  const premiums = computeCounterpartyPremiums(deals, companies);

  if (premiums.length === 0) {
    console.log('No buyers qualified (need ≥3 disclosed deals each).');
    return;
  }

  console.log(`Computed premiums for ${premiums.length} buyers.`);
  const rows = premiums.map(p => ({
    company_id: p.companyId,
    company_name: p.companyName,
    premium_multiplier: p.premiumMultiplier,
    sample_size: p.sampleSize,
    confidence: p.confidence,
    by_therapeutic_area: p.byTherapeuticArea ?? {},
    by_phase: p.byPhase ?? {},
    calculation_notes: p.calculationNotes ?? null,
    as_of_date: p.asOfDate,
  }));

  const { error: upsertErr } = await supabase
    .from('counterparty_premiums')
    .upsert(rows, { onConflict: 'company_id,as_of_date' });
  if (upsertErr) throw upsertErr;

  console.log(`Upserted ${rows.length} rows. Top 10 by premium:`);
  const sorted = [...premiums].sort((a, b) => b.premiumMultiplier - a.premiumMultiplier).slice(0, 10);
  for (const p of sorted) {
    console.log(`  ${p.companyName.padEnd(35)} ×${p.premiumMultiplier.toFixed(2)} (n=${p.sampleSize}, ${p.confidence})`);
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
