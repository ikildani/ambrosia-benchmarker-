// One-off: refresh company revenue from SEC XBRL with the verified CIK list and filer-name check (PR #97).
// No AI calls (the cron route also runs the Claude product-revenue pass; this does not).
// Usage: npx tsx scripts/sec-revenue-refresh.ts   (CHECK_ONLY=1 to load without writing)
import { config } from 'dotenv';
config({ path: process.env.ENV_FILE ?? '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const { runXBRLRevenueUpdate } = await import('@/lib/ingestion/sec-xbrl');
  const { PHARMA_CIKS } = await import('@/lib/ingestion/sec-edgar');
  if (process.env.CHECK_ONLY) {
    console.log('loaded; CIKs:', Object.keys(PHARMA_CIKS).length, 'BMS:', Object.entries(PHARMA_CIKS).find(([, n]) => n === 'Bristol-Myers Squibb')?.[0]);
    return;
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const r = await runXBRLRevenueUpdate(supabase);
  console.log(JSON.stringify({ processed: r.processed, updated: r.updated, skipped: r.skipped_anomalies, errors: r.errors.length }));
}

main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
