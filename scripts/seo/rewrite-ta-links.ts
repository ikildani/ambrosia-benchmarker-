/**
 * One-off backfill: rewrite `/benchmarks?ta=<key>` links inside published
 * blog posts to their canonical therapeutic-area pages.
 *
 * Why: Google Search Console listed 17 `/benchmarks?ta=…` URLs under
 * "Alternate page with proper canonical tag". They came from AI-generated
 * post bodies. The prompts no longer emit them (lib/seo/ta-links.ts); this
 * script cleans up the rows that already exist.
 *
 * Usage (from repo root):
 *   npx --yes tsx scripts/seo/rewrite-ta-links.ts            # dry run
 *   npx --yes tsx scripts/seo/rewrite-ta-links.ts --apply    # write changes
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { rewriteTaQueryLinks } from '../../lib/seo/ta-links';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, status, content')
    .like('content', '%/benchmarks?ta=%');

  if (error) throw new Error(`Query failed: ${error.message}`);

  const rows = data || [];
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${rows.length} post(s) contain /benchmarks?ta= links`);

  let totalLinks = 0;
  let updated = 0;
  const failures: string[] = [];

  for (const row of rows) {
    const { content, replaced } = rewriteTaQueryLinks(row.content as string);
    if (replaced === 0) continue;
    totalLinks += replaced;
    console.log(`  ${row.status.padEnd(9)} ${row.slug}  (${replaced} link${replaced === 1 ? '' : 's'})`);

    if (!APPLY) continue;
    const { error: updErr } = await supabase
      .from('blog_posts')
      .update({ content })
      .eq('id', row.id);
    if (updErr) failures.push(`${row.slug}: ${updErr.message}`);
    else updated += 1;
  }

  console.log(`\n${totalLinks} link(s) across ${rows.length} post(s)`);
  if (APPLY) {
    console.log(`${updated} row(s) updated, ${failures.length} failure(s)`);
    failures.forEach((f) => console.log(`  FAILED ${f}`));
    if (failures.length) process.exit(1);
  } else {
    console.log('Re-run with --apply to write these changes.');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
