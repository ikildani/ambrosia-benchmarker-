/**
 * Regulatory designations ingester (GitHub Actions; see .github/workflows/designations.yml).
 *
 *   npx tsx scripts/designations.ts [--since 2015-01-01] [--limit N] [--dry-run]
 *
 * Pulls the FDA orphan drug designation export (one POST, no key, no model),
 * matches sponsors to companies and drugs to assets, creates preclinical
 * assets for designations with no trial (asset_origin = 'designation'), and
 * records every designation in asset_designations. Logged to
 * data_ingestion_log as stage designations.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { runFdaOrphanIngestion } from '@/lib/ingestion/fda-orphan';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const started = Date.now();
  const supabase = createServiceClient();
  const dryRun = flag('dry-run');
  const r = await runFdaOrphanIngestion(supabase, { sinceIso: arg('since', '2015-01-01'), limit: Number(arg('limit', '0')) || undefined, dryRun });
  console.log('TOTAL', JSON.stringify({ ...r, errors: r.errors.slice(0, 5), errorCount: r.errors.length }));
  if (dryRun) return;
  await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt: started,
    status: deriveRunStatus({ errors: r.errors.length, timedOut: false, processed: r.parsed, produced: r.assetsCreated + r.assetsMatched }),
    runType: 'scheduled',
    fetched: r.parsed,
    processed: r.designationsUpserted,
    inserted: r.assetsCreated,
    updated: r.assetsMatched,
    skipped: r.approvedSkipped + r.noCompany,
    failed: r.errors.length,
    errors: r.errors.slice(0, 20),
    parameters: {
      stage: 'designations',
      agency: 'fda',
      worker: process.env.REGISTRY_WORKER_RUNTIME ?? 'local',
      companies_matched: r.companiesMatched,
      companies_created: r.companiesCreated,
      no_company: r.noCompany,
      approved_skipped: r.approvedSkipped,
      sample: r.sample,
      duration_seconds: Math.round((Date.now() - started) / 1000),
    },
    notes: `FDA orphan designations: ${r.parsed} rows, ${r.assetsCreated} assets created, ${r.assetsMatched} matched, ${r.companiesCreated} companies created`,
  });
}

main().catch(err => {
  console.error('FATAL', err instanceof Error ? err.stack : err);
  process.exit(1);
});
