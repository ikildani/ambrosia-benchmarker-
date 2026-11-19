/**
 * Dry run of the server-side pipeline-page path (lib/ingestion/pipeline-pages-http.ts).
 *
 *   npx tsx --env-file=.env.local scripts/preclinical-pages-dry-run.ts --companies <uuid,uuid,...> [--cost-cap 2] [--clinical] [--out report.json]
 *   npx tsx --env-file=.env.local scripts/preclinical-pages-dry-run.ts --limit 30
 *
 * Read only: locates and reads each company's pipeline page, extracts live (no batch),
 * and runs persistPrograms with dryRun, so it reports what would be matched, created or
 * skipped without writing anything. The Anthropic client is NOT wrapped in the spend
 * guard (the guard writes to the spend ledger); --cost-cap bounds the run instead.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'node:fs';
import { createServiceClient } from '@/lib/supabase/server';
import { runPipelinePagesHttp, type PagesClient } from '@/lib/ingestion/pipeline-pages-http';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

async function main() {
  const companies = arg('companies', '').split(',').map(s => s.trim()).filter(Boolean);
  const costCap = Number(arg('cost-cap', '2'));
  const out = arg('out', '');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 180_000 }) as unknown as PagesClient;
  const r = await runPipelinePagesHttp(createServiceClient(), {
    client,
    dryRun: true,
    companyIds: companies.length ? companies : undefined,
    limit: Number(arg('limit', '30')),
    costCapUsd: costCap,
    concurrency: Number(arg('concurrency', '5')),
    timeBudgetMs: Number(arg('minutes', '15')) * 60_000,
    createUnknownClinical: process.argv.includes('--clinical'),
  });
  for (const c of r.companies) {
    const decided = (c.decisions ?? []).map(d => `${d.action}:${d.program}${d.matched_asset ? `=>${d.matched_asset}` : ''}${d.foreign_owner ? `@${d.foreign_owner}` : ''}`);
    console.log(JSON.stringify({ company: c.company, outcome: c.outcome, url: c.url, programs: c.programs, created: c.created, matched: c.matched, decided }));
  }
  const { companies: list, ...totals } = r;
  console.log('TOTAL', JSON.stringify(totals));
  if (out) writeFileSync(out, JSON.stringify(r, null, 2));
}

main().catch(err => {
  console.error('FATAL', err instanceof Error ? err.stack : err);
  process.exit(1);
});
