#!/usr/bin/env npx tsx
/**
 * Attach primary-source citations to real-looking deal rows that have none.
 *
 * Dry-run by default: decides and logs, writes nothing.
 *
 * Usage:
 *   npx tsx scripts/source-unsourced-deals.ts                   # dry run, 20 rows
 *   npx tsx scripts/source-unsourced-deals.ts --limit 50        # dry run, 50 rows
 *   npx tsx scripts/source-unsourced-deals.ts --apply --limit 25
 *   npx tsx scripts/source-unsourced-deals.ts --log /path/to/decisions.jsonl
 *
 * Every decision is appended as one JSON line to the log (default
 * ./deal-sourcer-<date>.jsonl) so the run can be audited row by row.
 * See lib/ingestion/deal-sourcer.ts for the rule.
 */

import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'fs';
import { sourceUnsourcedDeals } from '@/lib/ingestion/deal-sourcer';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!PERPLEXITY_API_KEY || !ANTHROPIC_API_KEY) {
  console.error('Missing PERPLEXITY_API_KEY or ANTHROPIC_API_KEY');
  process.exit(1);
}

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const limitIdx = argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : 20;
const logIdx = argv.indexOf('--log');
const LOG_PATH = logIdx >= 0 ? argv[logIdx + 1] : `./deal-sourcer-${new Date().toISOString().slice(0, 10)}.jsonl`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log(`${APPLY ? 'MODE: APPLY (writing citations, returning rows to pending)' : 'MODE: dry run (no writes)'} | limit ${LIMIT} | log ${LOG_PATH}`);
  const result = await sourceUnsourcedDeals(supabase, {
    perplexityApiKey: PERPLEXITY_API_KEY!,
    anthropicApiKey: ANTHROPIC_API_KEY!,
    limit: LIMIT,
    dryRun: !APPLY,
    timeBudgetMs: 20 * 60_000,
    onDecision: record => {
      appendFileSync(LOG_PATH, JSON.stringify(record) + '\n');
      const d = record.decision;
      const tag = d.action === 'source' ? `SOURCE  ${d.url}` : d.action === 'skip' ? `skip    ${d.why}` : `ERROR   ${d.why}`;
      console.log(`  ${tag}\n          ${record.licensor} -> ${record.licensee} | ${record.asset ?? '-'} | ${record.announced ?? '-'}`);
    },
  });
  const rate = result.attempted ? Math.round((result.sourced / result.attempted) * 100) : 0;
  console.log(`\nattempted ${result.attempted} | sourced ${result.sourced} (${rate}%) | skipped ${result.skipped} | errors ${result.errors}`);
  console.log(APPLY ? 'Rows with a new citation are back in pending; the deal-verification cron adjudicates them next run.' : 'Dry run: re-run with --apply to write.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
