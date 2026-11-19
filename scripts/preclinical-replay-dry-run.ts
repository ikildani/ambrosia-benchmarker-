/**
 * Dry run of replayUnmatchedDisclosures (lib/ingestion/preclinical-pipeline.ts): re-decides
 * asset_disclosures rows recorded as unmatched_clinical with identifier matching, the
 * cross-company code guard and (with --clinical) unknown-code clinical creation. Read only.
 *
 *   npx tsx scripts/preclinical-replay-dry-run.ts --limit 400 [--clinical] [--out replay.json]
 */

import { writeFileSync } from 'node:fs';
import { createServiceClient } from '@/lib/supabase/server';
import { replayUnmatchedDisclosures } from '@/lib/ingestion/preclinical-pipeline';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

async function main() {
  const r = await replayUnmatchedDisclosures(createServiceClient(), {
    limit: Number(arg('limit', '400')),
    afterId: arg('after', '') || null,
    dryRun: true,
    createUnknownClinical: process.argv.includes('--clinical'),
  });
  const { sample, ...totals } = r;
  for (const s of sample) console.log(JSON.stringify({ company: s.company, source: s.source, decided: s.decisions.map(d => `${d.action}:${d.program}${d.matched_asset ? `=>${d.matched_asset}` : ''}${d.foreign_owner ? `@${d.foreign_owner}` : ''}`) }));
  console.log('TOTAL', JSON.stringify(totals));
  const out = arg('out', '');
  if (out) writeFileSync(out, JSON.stringify(r, null, 2));
}

main().catch(err => { console.error('FATAL', err instanceof Error ? err.stack : err); process.exit(1); });
