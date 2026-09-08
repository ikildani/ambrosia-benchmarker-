import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllBenchmarkSlugsWithDb } from '@/lib/benchmarkPages';
import { getAllInsightSlugs } from '@/lib/insightPages';
import { getAllTermSlugs } from '@/lib/glossaryTerms';
import { blogPosts as hardcodedBlogPosts } from '@/lib/blogPosts';
import { SEO_INSIGHT_SLUGS } from '@/lib/insights/seo-pages';
import { getAllProgrammaticSlugs } from '@/lib/seo/programmatic-pages';
import { getAllPseoSlugs } from '@/lib/pseoPages';
import { listAllSlugs as listPlaybookSlugs } from '@/lib/playbook-data';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

// ---------------------------------------------------------------------------
// Sub-sitemap IDs — each produces a separate /sitemap/{id}.xml
//
// NOTE: Next.js does NOT generate a sitemap index for generateSitemaps().
// The index at /sitemap.xml is served by app/sitemap.xml/route.ts, which
// must list every id below. Keep the two in sync via SITEMAP_IDS.
// ---------------------------------------------------------------------------
export const SITEMAP = {
  CORE: 0,       // Static pages, therapeutic areas, compare pages
  CONTENT: 1,    // Blog, landing pages, guides, reports, playbooks
  BENCHMARKS: 2, // Benchmark deal pages + pSEO (modality x phase)
  INSIGHTS: 3,   // Insight pages, SEO insights, lead magnets
  COMPANIES: 4,  // Company profiles (DB-driven)
  REFERENCE: 5,  // Glossary terms + programmatic data pages
} as const;

export const SITEMAP_IDS: number[] = Object.values(SITEMAP);

// ---------------------------------------------------------------------------
// generateSitemaps — tells Next.js to produce one file per id
// ---------------------------------------------------------------------------
export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }));
}

// ---------------------------------------------------------------------------
// Main sitemap handler — dispatches by sub-sitemap id.
//
// Next.js passes `id` as a STRING at request time ("0", not 0). A strict
// switch against the numeric constants silently matched nothing and every
// shard shipped empty for weeks. Always coerce before dispatching.
// ---------------------------------------------------------------------------
export default async function sitemap(
  { id }: { id: number | string },
): Promise<MetadataRoute.Sitemap> {
  const shard = Number(id);
  switch (shard) {
    case SITEMAP.CORE:
      return getCorePages();
    case SITEMAP.CONTENT:
      return getContentPages();
    case SITEMAP.BENCHMARKS:
      return getBenchmarkPages();
    case SITEMAP.INSIGHTS:
      return getInsightPages();
    case SITEMAP.COMPANIES:
      return getCompanyPages();
    case SITEMAP.REFERENCE:
      return getReferencePages();
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Freq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

/**
 * Static entry with no lastModified. We deliberately omit lastmod for pages
 * whose true edit date we don't track — Google ignores sitemaps whose
 * lastmod values are fabricated, and only DB-backed rows carry a real
 * updated_at.
 */
function staticEntry(path: string, changeFrequency: Freq, priority: number): MetadataRoute.Sitemap[number] {
  return { url: path ? `${BASE_URL}${path}` : BASE_URL, changeFrequency, priority };
}

// ---------------------------------------------------------------------------
// 0 — Core static pages
// ---------------------------------------------------------------------------
export const TA_SLUGS = [
  'oncology', 'neurology', 'immunology', 'cardiovascular', 'metabolic',
  'rareDisease', 'infectiousDisease', 'ophthalmology', 'dermatology',
  'womensHealth', 'gastroenterology', 'hematology',
] as const;

function getCorePages(): MetadataRoute.Sitemap {
  return [
    staticEntry('', 'weekly', 1),
    staticEntry('/calculator', 'weekly', 0.9),
    staticEntry('/estimate', 'weekly', 0.8),
    staticEntry('/start', 'monthly', 0.7),
    staticEntry('/insights', 'weekly', 0.8),
    staticEntry('/glossary', 'monthly', 0.7),
    staticEntry('/pulse', 'weekly', 0.8),
    staticEntry('/radar', 'weekly', 0.7),
    staticEntry('/privacy', 'yearly', 0.3),
    staticEntry('/terms', 'yearly', 0.3),
    staticEntry('/security', 'yearly', 0.4),
    staticEntry('/press', 'monthly', 0.6),
    staticEntry('/playbook', 'weekly', 0.8),
    staticEntry('/tracker', 'weekly', 0.9),
    staticEntry('/trade-space', 'weekly', 0.8),
    staticEntry('/simulator', 'weekly', 0.8),
    staticEntry('/intelligence', 'daily', 0.7),
    staticEntry('/methodology', 'monthly', 0.7),
    staticEntry('/methodology/engine', 'monthly', 0.7),
    staticEntry('/therapeutic-areas', 'weekly', 0.8),
    ...TA_SLUGS.map((ta) => staticEntry(`/therapeutic-areas/${ta}`, 'weekly', 0.8)),
    staticEntry('/benchmark', 'weekly', 0.9),
    staticEntry('/contact', 'monthly', 0.6),
    staticEntry('/compare', 'weekly', 0.8),
    staticEntry('/compare/evaluate-pharma', 'monthly', 0.8),
    staticEntry('/compare/capital-iq', 'monthly', 0.8),
    staticEntry('/compare/cortellis', 'monthly', 0.8),
    staticEntry('/compare/dealforma', 'monthly', 0.8),
    staticEntry('/about', 'monthly', 0.7),
    staticEntry('/for/bd-teams', 'monthly', 0.9),
    staticEntry('/for/biotech-ceos', 'monthly', 0.9),
    staticEntry('/for/vc-operating-partners', 'monthly', 0.9),
    staticEntry('/pro', 'monthly', 0.9),
    staticEntry('/portfolio', 'monthly', 0.9),
    staticEntry('/companies', 'weekly', 0.8),
  ];
}

// ---------------------------------------------------------------------------
// 1 — Content pages (blog, landing, guides, reports, playbooks)
// ---------------------------------------------------------------------------
async function getContentPages(): Promise<MetadataRoute.Sitemap> {
  let blogPages: MetadataRoute.Sitemap = [];
  let landingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    // Blog posts — prefer updated_at over published_at for accurate freshness
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .neq('noindex', true);

    if (postsError) {
      console.error('Sitemap: Error fetching blog posts:', postsError.message);
    }

    if (posts?.length) {
      blogPages = posts.map((post) => ({
        url: `${BASE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at || post.published_at || '2026-06-01'),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
    }

    // Landing pages — prefer updated_at over published_at
    const { data: pages, error: pagesError } = await supabase
      .from('landing_pages')
      .select('slug, updated_at, published_at')
      .eq('status', 'published');

    if (pagesError) {
      console.error('Sitemap: Error fetching landing pages:', pagesError.message);
    }

    if (pages?.length) {
      landingPages = pages.map((page) => ({
        url: `${BASE_URL}/${page.slug}`,
        lastModified: new Date(page.updated_at || page.published_at || '2026-06-01'),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }));
    }
  } catch {
    console.log('Sitemap [content]: Dynamic content tables not available yet');
  }

  // Fallback to hardcoded blog posts if DB returned none
  if (blogPages.length === 0 && hardcodedBlogPosts.length > 0) {
    blogPages = hardcodedBlogPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  }

  // Blog index — lastmod = date of newest post
  const blogIndex: MetadataRoute.Sitemap = [];
  if (blogPages.length > 0) {
    const newestBlog = blogPages.reduce((newest, p) => {
      const d = p.lastModified instanceof Date
        ? p.lastModified
        : new Date(String(p.lastModified));
      return d > newest ? d : newest;
    }, new Date(0));

    blogIndex.push({
      url: `${BASE_URL}/blog`,
      lastModified: newestBlog,
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }

  // Counterparty playbooks — one page per buyer
  let playbookPages: MetadataRoute.Sitemap = [];
  try {
    const slugs = await listPlaybookSlugs();
    playbookPages = slugs.map((slug) => staticEntry(`/playbook/${slug}`, 'monthly', 0.7));
  } catch {
    console.log('Sitemap [content]: Playbook data not available');
  }

  const guidePages: MetadataRoute.Sitemap = [
    staticEntry('/guides', 'monthly', 0.7),
    staticEntry('/guides/how-to-value-biotech-deal', 'monthly', 0.8),
    staticEntry('/guides/negotiate-pharma-royalty-rates', 'monthly', 0.8),
    staticEntry('/guides/biotech-licensing-deal-structure', 'monthly', 0.8),
    staticEntry('/guides/rnpv-biotech-valuation', 'monthly', 0.8),
    staticEntry('/guides/pharma-ma-vs-licensing', 'monthly', 0.8),
    staticEntry('/guides/biopharma-licensing-benchmarks', 'monthly', 0.9),
    staticEntry('/guides/life-sciences-deal-calculator-guide', 'monthly', 0.9),
    staticEntry('/guides/monte-carlo-biotech-valuation', 'monthly', 0.8),
  ];

  const reportPages: MetadataRoute.Sitemap = [
    staticEntry('/reports', 'monthly', 0.7),
    staticEntry('/reports/deal-trends-2026', 'monthly', 0.8),
    staticEntry('/reports/q1-2026-biopharma-deal-benchmarks', 'monthly', 0.9),
    staticEntry('/reports/q2-2026-biopharma-deal-benchmarks', 'monthly', 0.9),
    staticEntry('/press/data-kit', 'monthly', 0.8),
  ];

  return [...blogIndex, ...blogPages, ...landingPages, ...playbookPages, ...guidePages, ...reportPages];
}

// ---------------------------------------------------------------------------
// 2 — Benchmark pages + pSEO benchmark data
// ---------------------------------------------------------------------------
async function getBenchmarkPages(): Promise<MetadataRoute.Sitemap> {
  const benchmarkSlugs = await getAllBenchmarkSlugsWithDb();
  const pseoSlugs = getAllPseoSlugs();

  return [
    staticEntry('/benchmarks', 'weekly', 0.8),
    ...benchmarkSlugs.map((slug) => staticEntry(`/benchmarks/${slug}`, 'monthly', 0.8)),
    ...pseoSlugs.map((slug) => staticEntry(`/benchmarks/data/${slug}`, 'monthly', 0.7)),
  ];
}

// ---------------------------------------------------------------------------
// 3 — Insight pages (all types)
// ---------------------------------------------------------------------------

/**
 * Hand-written insight pages that live as physical folders under
 * app/insights/<slug>/ and therefore appear in neither getAllInsightSlugs()
 * (pSEO, served by app/insights/[slug]) nor SEO_INSIGHT_SLUGS.
 * Add a slug here whenever a new folder is created.
 */
export const HANDWRITTEN_INSIGHT_SLUGS = [
  'adc-vs-bispecific-deal-benchmarks-2026',
  'biopharma-deal-benchmarking-tools-2026',
  'biopharma-deal-benchmarks-2026',
  'biotech-fundraising-deal-benchmarks',
  'deal-committee-presentation-guide',
  'how-much-is-my-biotech-asset-worth',
  'licensing-vs-acquisition-deal-terms',
  'pharma-partner-identification-guide',
  'phase-2-vs-phase-3-deal-economics',
  'q1-2026-deal-benchmarks',
  'rnpv-vs-dcf-biotech-valuation',
] as const;

function getInsightPages(): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const add = (slug: string, priority: number) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    entries.push(staticEntry(`/insights/${slug}`, 'monthly', priority));
  };

  HANDWRITTEN_INSIGHT_SLUGS.forEach((slug) => add(slug, 0.9));
  SEO_INSIGHT_SLUGS.forEach((slug) => add(slug, 0.9));
  getAllInsightSlugs().forEach((slug) => add(slug, 0.7));

  return entries;
}

// ---------------------------------------------------------------------------
// 4 — Company pages (DB-driven with real updated_at)
// ---------------------------------------------------------------------------
async function getCompanyPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = createServiceClient();

    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, updated_at')
      .order('deals_last_12mo', { ascending: false, nullsFirst: false })
      .limit(200);

    if (error) {
      console.error('Sitemap: Error fetching companies:', error.message);
      return [];
    }

    if (!companies?.length) return [];

    return companies.map((company) => ({
      url: `${BASE_URL}/companies/${company.id}`,
      lastModified: new Date(company.updated_at || '2026-06-01'),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    console.log('Sitemap [companies]: Companies table not available yet');
    return [];
  }
}

// ---------------------------------------------------------------------------
// 5 — Reference pages (glossary terms + programmatic data)
// ---------------------------------------------------------------------------
function getReferencePages(): MetadataRoute.Sitemap {
  const termSlugs = getAllTermSlugs();
  const programmaticSlugs = getAllProgrammaticSlugs();

  return [
    staticEntry('/data', 'weekly', 0.7),
    ...termSlugs.map((slug) => staticEntry(`/glossary/${slug}`, 'monthly', 0.6)),
    ...programmaticSlugs.map((slug) => staticEntry(`/data/${slug}`, 'monthly', 0.6)),
  ];
}
