/**
 * Sitemap regression tests.
 *
 * Background: Next.js passes the generateSitemaps() id as a STRING at request
 * time. app/sitemap.ts used to `switch (id)` against numeric constants, so
 * every shard returned [] and the site published zero URLs to Google for
 * weeks (GSC: 778 "crawled - currently not indexed"). Separately, Next does
 * not emit a sitemap index, so /sitemap.xml 404'd. These tests pin both.
 */

jest.mock('@/lib/supabase/server', () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    from: chain,
    select: chain,
    eq: chain,
    neq: chain,
    order: chain,
    limit: () => Promise.resolve({ data: [], error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  });
  return {
    createServiceClient: () => builder,
    createServerClient: () => builder,
  };
});

jest.mock('@/lib/playbook-data', () => ({
  listAllSlugs: async () => ['pfizer', 'novartis'],
}));

import sitemap, {
  generateSitemaps,
  SITEMAP,
  SITEMAP_IDS,
  HANDWRITTEN_INSIGHT_SLUGS,
} from '@/app/sitemap';
import { GET as sitemapIndex } from '@/app/sitemap.xml/route';
import { isIndexableBenchmark } from '@/lib/seo/search-allowlist';

const BASE = 'https://solidus.ambrosiaventures.co';

describe('sitemap shards', () => {
  it('generateSitemaps lists every shard id', async () => {
    const ids = (await generateSitemaps()).map((s) => s.id);
    expect(ids).toEqual(SITEMAP_IDS);
    expect(ids).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it.each(SITEMAP_IDS.filter((id) => id !== SITEMAP.COMPANIES))(
    'shard %s emits URLs when id arrives as a string',
    async (id) => {
      const entries = await sitemap({ id: String(id) });
      expect(entries.length).toBeGreaterThan(0);
    },
  );

  it('string and numeric ids dispatch identically', async () => {
    const asNumber = await sitemap({ id: SITEMAP.CORE });
    const asString = await sitemap({ id: '0' });
    expect(asString.map((e) => e.url)).toEqual(asNumber.map((e) => e.url));
  });

  it('every URL is absolute, on the Solidus host, and has no query string', async () => {
    for (const id of SITEMAP_IDS) {
      const entries = await sitemap({ id });
      for (const e of entries) {
        expect(e.url.startsWith(`${BASE}`)).toBe(true);
        expect(e.url).not.toContain('?');
        expect(e.url).not.toMatch(/\/$/);
      }
    }
  });

  it('no URL appears in more than one shard', async () => {
    const seen = new Map<string, number>();
    for (const id of SITEMAP_IDS) {
      for (const e of await sitemap({ id })) {
        expect(seen.has(e.url)).toBe(false);
        seen.set(e.url, id);
      }
    }
  });

  it('core shard has no fabricated lastModified on static pages', async () => {
    const core = await sitemap({ id: SITEMAP.CORE });
    expect(core.length).toBeGreaterThan(30);
    expect(core.every((e) => e.lastModified === undefined)).toBe(true);
    expect(core.map((e) => e.url)).toEqual(expect.arrayContaining([
      BASE,
      `${BASE}/calculator`,
      `${BASE}/companies`,
      `${BASE}/methodology/engine`,
      `${BASE}/therapeutic-areas/rareDisease`,
    ]));
  });

  it('insights shard covers the hand-written page folders', async () => {
    const urls = (await sitemap({ id: SITEMAP.INSIGHTS })).map((e) => e.url);
    for (const slug of HANDWRITTEN_INSIGHT_SLUGS) {
      expect(urls).toContain(`${BASE}/insights/${slug}`);
    }
    expect(urls).toContain(`${BASE}/insights/rnpv-vs-dcf-biotech-valuation`);
  });

  it('content shard includes guide and report pages but no noindexed playbook pages', async () => {
    const urls = (await sitemap({ id: SITEMAP.CONTENT })).map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/playbook/pfizer`);
    expect(urls.some((u) => u.startsWith(`${BASE}/playbook/`))).toBe(false);
    expect(urls).toContain(`${BASE}/guides/rnpv-biotech-valuation`);
    expect(urls).toContain(`${BASE}/reports/q2-2026-biopharma-deal-benchmarks`);
  });

  it('benchmarks and reference shards list only indexable pages', async () => {
    const bench = (await sitemap({ id: SITEMAP.BENCHMARKS })).map((e) => e.url);
    expect(bench).toContain(`${BASE}/benchmarks`);
    expect(bench.some((u) => u.includes('/benchmarks/data/'))).toBe(false);
    for (const u of bench.filter((x) => x.startsWith(`${BASE}/benchmarks/`))) {
      expect(isIndexableBenchmark(u.slice(`${BASE}/benchmarks/`.length))).toBe(true);
    }
    const ref = (await sitemap({ id: SITEMAP.REFERENCE })).map((e) => e.url);
    expect(ref.some((u) => u.includes('/glossary/'))).toBe(true);
    expect(ref.some((u) => /\/data\/[^/]+$/.test(u))).toBe(false);
  });

  it('unknown shard id returns an empty list', async () => {
    expect(await sitemap({ id: '99' })).toEqual([]);
  });
});

describe('sitemap index (/sitemap.xml)', () => {
  it('lists one <sitemap> per shard with an XML content type', async () => {
    const res = sitemapIndex();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/application\/xml/);
    const xml = await res.text();
    expect(xml).toContain('<sitemapindex');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(SITEMAP_IDS.map((id) => `${BASE}/sitemap/${id}.xml`));
  });
});
