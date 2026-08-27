import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllBenchmarkSlugsWithDb } from '@/lib/benchmarkPages';
import { getAllInsightSlugs } from '@/lib/insightPages';
import { getAllTermSlugs } from '@/lib/glossaryTerms';
import { blogPosts as hardcodedBlogPosts } from '@/lib/blogPosts';
import { SEO_INSIGHT_SLUGS } from '@/lib/insights/seo-pages';
import { getAllProgrammaticSlugs } from '@/lib/seo/programmatic-pages';
import { getAllPseoSlugs } from '@/lib/pseoPages';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

// ---------------------------------------------------------------------------
// Sub-sitemap IDs — each produces a separate /sitemap/{id}.xml
// Next.js generates a sitemap index at /sitemap.xml pointing to each.
// ---------------------------------------------------------------------------
const SITEMAP = {
  CORE: 0,       // Static pages, therapeutic areas, compare pages
  CONTENT: 1,    // Blog, landing pages, guides, reports, backlinks
  BENCHMARKS: 2, // Benchmark deal pages + pSEO (modality x phase)
  INSIGHTS: 3,   // Insight pages, SEO insights, lead magnets
  COMPANIES: 4,  // Company profiles (DB-driven)
  REFERENCE: 5,  // Glossary terms + programmatic data pages
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic Date for a given slug within a date range.
 * Uses a simple string hash so each slug always maps to the same date
 * (stable across builds) and dates spread naturally across the range.
 */
function staggeredDate(slug: string, rangeStart: string, rangeDays: number): Date {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash) + slug.charCodeAt(i);
    hash |= 0;
  }
  const offset = Math.abs(hash) % rangeDays;
  const d = new Date(rangeStart);
  d.setDate(d.getDate() + offset);
  return d;
}

// ---------------------------------------------------------------------------
// generateSitemaps — tells Next.js to produce a sitemap index
// ---------------------------------------------------------------------------
export async function generateSitemaps() {
  return Object.values(SITEMAP).map((id) => ({ id }));
}

// ---------------------------------------------------------------------------
// Main sitemap handler — dispatches by sub-sitemap id
// ---------------------------------------------------------------------------
export default async function sitemap(
  { id }: { id: number },
): Promise<MetadataRoute.Sitemap> {
  switch (id) {
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
// 0 — Core static pages
// ---------------------------------------------------------------------------
function getCorePages(): MetadataRoute.Sitemap {
  const taPages = [
    'oncology', 'neurology', 'immunology', 'cardiovascular', 'metabolic',
    'rareDisease', 'infectiousDisease', 'ophthalmology', 'dermatology',
    'womensHealth', 'gastroenterology', 'hematology',
  ];

  return [
    { url: BASE_URL, lastModified: '2026-07-28', changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/calculator`, lastModified: '2026-07-14', changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/insights`, lastModified: '2026-07-20', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/glossary`, lastModified: '2026-06-10', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/pulse`, lastModified: '2026-07-25', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: '2026-01-15', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: '2026-01-15', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/press`, lastModified: '2026-06-20', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/playbook`, lastModified: '2026-07-08', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/tracker`, lastModified: '2026-07-28', changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/trade-space`, lastModified: '2026-07-18', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/simulator`, lastModified: '2026-07-12', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/intelligence`, lastModified: '2026-07-27', changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/methodology`, lastModified: '2026-05-15', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/therapeutic-areas`, lastModified: '2026-07-22', changeFrequency: 'weekly', priority: 0.8 },
    // 12 TA-specific pages — staggered across Jun-Jul 2026
    ...taPages.map((ta) => ({
      url: `${BASE_URL}/therapeutic-areas/${ta}`,
      lastModified: staggeredDate(ta, '2026-06-01', 50),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${BASE_URL}/benchmark`, lastModified: '2026-07-20', changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/contact`, lastModified: '2026-03-10', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/compare`, lastModified: '2026-06-05', changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/compare/evaluate-pharma`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare/capital-iq`, lastModified: '2026-06-08', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare/cortellis`, lastModified: '2026-06-15', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare/dealforma`, lastModified: '2026-07-01', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: '2026-04-20', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/for/bd-teams`, lastModified: '2026-08-26', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/for/biotech-ceos`, lastModified: '2026-08-26', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/for/vc-operating-partners`, lastModified: '2026-08-26', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/pro`, lastModified: '2026-06-25', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/portfolio`, lastModified: '2026-06-25', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/companies`, lastModified: '2026-07-22', changeFrequency: 'weekly', priority: 0.8 },
  ];
}

// ---------------------------------------------------------------------------
// 1 — Content pages (blog, landing, guides, reports, backlinks)
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

  // Guide pages — staggered realistic dates
  const guidePages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/guides`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/guides/how-to-value-biotech-deal`, lastModified: '2026-03-12', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides/negotiate-pharma-royalty-rates`, lastModified: '2026-03-25', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides/biotech-licensing-deal-structure`, lastModified: '2026-04-08', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides/rnpv-biotech-valuation`, lastModified: '2026-04-18', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides/pharma-ma-vs-licensing`, lastModified: '2026-05-02', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/guides/biopharma-licensing-benchmarks`, lastModified: '2026-05-20', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/guides/life-sciences-deal-calculator-guide`, lastModified: '2026-06-01', changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/guides/monte-carlo-biotech-valuation`, lastModified: '2026-07-15', changeFrequency: 'monthly', priority: 0.8 },
  ];

  // Report pages
  const reportPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/reports`, lastModified: '2026-04-15', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/reports/deal-trends-2026`, lastModified: '2026-04-10', changeFrequency: 'monthly', priority: 0.8 },
  ];

  // Backlink engine pages
  const backlinkPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/press/data-kit`, lastModified: '2026-05-10', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/reports/q1-2026-biopharma-deal-benchmarks`, lastModified: '2026-04-01', changeFrequency: 'monthly', priority: 0.9 },
  ];

  return [...blogIndex, ...blogPages, ...landingPages, ...guidePages, ...reportPages, ...backlinkPages];
}

// ---------------------------------------------------------------------------
// 2 — Benchmark pages + pSEO benchmark data
// ---------------------------------------------------------------------------
async function getBenchmarkPages(): Promise<MetadataRoute.Sitemap> {
  const benchmarkSlugs = await getAllBenchmarkSlugsWithDb();
  const pseoSlugs = getAllPseoSlugs();

  return [
    { url: `${BASE_URL}/benchmarks`, lastModified: '2026-07-20', changeFrequency: 'weekly', priority: 0.8 },
    ...benchmarkSlugs.map((slug) => ({
      url: `${BASE_URL}/benchmarks/${slug}`,
      lastModified: staggeredDate(slug, '2026-04-01', 100),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...pseoSlugs.map((slug) => ({
      url: `${BASE_URL}/benchmarks/data/${slug}`,
      lastModified: staggeredDate(slug, '2026-05-01', 75),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}

// ---------------------------------------------------------------------------
// 3 — Insight pages (all types)
// ---------------------------------------------------------------------------
function getInsightPages(): MetadataRoute.Sitemap {
  const insightSlugs = getAllInsightSlugs();

  // Regular insight pages
  const insightPages: MetadataRoute.Sitemap = insightSlugs.map((slug) => ({
    url: `${BASE_URL}/insights/${slug}`,
    lastModified: staggeredDate(slug, '2026-03-01', 120),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // SEO long-form insight pages
  const seoInsightPages: MetadataRoute.Sitemap = SEO_INSIGHT_SLUGS.map((slug) => ({
    url: `${BASE_URL}/insights/${slug}`,
    lastModified: staggeredDate(slug, '2026-04-01', 90),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  // Lead magnet pages
  const leadMagnetPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/insights/biopharma-deal-benchmarks-2026`,
      lastModified: '2026-06-15',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  return [...insightPages, ...seoInsightPages, ...leadMagnetPages];
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
    // Programmatic data index
    { url: `${BASE_URL}/data`, lastModified: '2026-07-15', changeFrequency: 'weekly', priority: 0.7 },
    // Individual glossary terms
    ...termSlugs.map((slug) => ({
      url: `${BASE_URL}/glossary/${slug}`,
      lastModified: staggeredDate(slug, '2026-02-01', 120),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    // Programmatic data pages (TA x Phase x Territory)
    ...programmaticSlugs.map((slug) => ({
      url: `${BASE_URL}/data/${slug}`,
      lastModified: staggeredDate(slug, '2026-04-01', 90),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
