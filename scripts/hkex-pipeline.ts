#!/usr/bin/env npx tsx
/**
 * Read the latest HKEX annual report of each mapped Hong Kong biotech and record its pipeline
 * (lib/ingestion/hkex-pipeline.ts). Run from GitHub Actions (.github/workflows/hkex-pipeline.yml),
 * which holds the API key.
 *
 *   npx tsx scripts/hkex-pipeline.ts --map scripts/data/hkex-biotech-map-20261103.json [--limit N] [--cost-cap 15] [--dry-run]
 */
import { readFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { aiBudgetAvailable, withSpendGuard } from '@/lib/ai/spend-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { runHkexPipeline, type HkexIssuer } from '@/lib/ingestion/hkex-pipeline';
import type { IntentClient } from '@/lib/ingestion/management-intent';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};

async function main() {
  const mapPath = arg('map', 'scripts/data/hkex-biotech-map-20261103.json');
  const limit = Number(arg('limit', '0')) || undefined;
  const costCap = Number(arg('cost-cap', '15'));
  const minutes = Number(arg('minutes', '50'));
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const budget = await aiBudgetAvailable('hkex-pipeline');
  if (!budget.ok) { console.log('AI budget unavailable:', budget.reason); return; }

  const issuers = JSON.parse(readFileSync(mapPath, 'utf8')) as HkexIssuer[];
  const supabase = createServiceClient();
  const client = new Anthropic(withSpendGuard('hkex-pipeline', { apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 })) as unknown as IntentClient;
  const started = Date.now();
  console.log(new Date().toISOString(), 'start', JSON.stringify({ issuers: issuers.length, limit, costCap, dryRun }));
  const r = await runHkexPipeline(supabase, issuers, { client, costCapUsd: costCap, timeBudgetMs: minutes * 60_000, dryRun, limit });
  console.log(new Date().toISOString(), 'result', JSON.stringify({ ...r, usage: undefined, sample: undefined, errors: r.errors.slice(0, 15) }));
  for (const s of r.sample) console.log('  ', s.code, s.company, '|', s.report, '|', s.programs, 'programs', s.created.length ? `created: ${s.created.join(', ')}` : '');

  if (!dryRun) {
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt: started,
      status: deriveRunStatus({ errors: r.errors.length, timedOut: r.timedOut, processed: r.issuers, produced: r.assetsCreated + r.assetsMatched }),
      runType: 'manual',
      fetched: r.issuers,
      processed: r.reportsRead,
      inserted: r.assetsCreated,
      updated: r.assetsMatched,
      skipped: r.skippedSeen + r.noReport,
      failed: r.errors.length,
      errors: r.errors.slice(0, 20),
      parameters: { stage: 'hkex_pipeline', map: mapPath, cost_usd: r.costUsd, unmatched_clinical: r.unmatchedClinical, programs: r.programsExtracted, quotes_dropped: r.quotesDropped },
    });
  }
}

main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
