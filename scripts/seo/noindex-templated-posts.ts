/**
 * Mark templated "X Deals Are Up N% in 2026" / "X Deal Trends 2026" blog posts
 * as noindex, keeping only the newest post per series.
 *
 * Why: the market-trend cron published 167 posts from one template across 19
 * dimensions (Jul-Sep 2026). Google crawled them and declined to index the
 * bulk ("Crawled - currently not indexed", 870 URLs in GSC on Sep 21 2026).
 * The newest post per dimension stays indexable; older repeats and every
 * post for the catch-all "Other" dimension get noindex=true. The sitemap
 * already excludes noindex rows and app/blog/[slug] emits the robots tag.
 *
 * Usage:
 *   npx tsx scripts/seo/noindex-templated-posts.ts            # dry run
 *   npx tsx scripts/seo/noindex-templated-posts.ts --apply    # write
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i < 0 || line.startsWith('#')) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
}
loadEnv();

export const SERIES_TITLE = /^(.*?) (Deals? (Are )?(Up|Down) [0-9,%]+ in 20\d\d|Deal Trends 20\d\d)/i;

interface Row { id: string; slug: string; title: string; published_at: string | null; noindex: boolean | null }

async function main() {
  const apply = process.argv.includes('--apply');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb
    .from('blog_posts')
    .select('id, slug, title, published_at, noindex')
    .eq('status', 'published');
  if (error) throw error;

  const groups = new Map<string, Row[]>();
  for (const r of data as Row[]) {
    const m = r.title.match(SERIES_TITLE);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const toNoindex: Row[] = [];
  const kept: Row[] = [];
  for (const [key, rows] of groups) {
    rows.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
    if (key === 'other') { toNoindex.push(...rows); continue; }
    kept.push(rows[0]);
    toNoindex.push(...rows.slice(1));
  }
  const pending = toNoindex.filter((r) => !r.noindex);

  console.log(`series posts: ${[...groups.values()].flat().length} in ${groups.size} groups`);
  console.log(`keep indexable: ${kept.length}`);
  console.log(`noindex: ${toNoindex.length} (${pending.length} not yet flagged)`);
  for (const r of kept) console.log(`  KEEP  ${r.slug}`);
  for (const r of pending.slice(0, 15)) console.log(`  NOIDX ${r.slug}`);
  if (pending.length > 15) console.log(`  ... and ${pending.length - 15} more`);

  if (!apply) { console.log('\nDry run. Re-run with --apply to write.'); return; }

  const ids = pending.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 100) {
    const { error: upErr } = await sb.from('blog_posts').update({ noindex: true }).in('id', ids.slice(i, i + 100));
    if (upErr) throw upErr;
  }
  console.log(`\nApplied noindex to ${ids.length} posts.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
