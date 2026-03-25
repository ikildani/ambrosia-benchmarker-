import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllBenchmarkSlugs } from '@/lib/benchmarkPages';
import { getAllInsightSlugs } from '@/lib/insightPages';
import { getAllTermSlugs } from '@/lib/glossaryTerms';
import { blogPosts as hardcodedBlogPosts } from '@/lib/blogPosts';
import { SEO_INSIGHT_SLUGS } from '@/lib/insights/seo-pages';
import { getAllProgrammaticSlugs } from '@/lib/seo/programmatic-pages';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/calculator`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/glossary`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pulse`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/press`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/therapeutic-areas`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // 12 TA-specific pages
    ...['oncology', 'neurology', 'immunology', 'cardiovascular', 'metabolic', 'rareDisease',
        'infectiousDisease', 'ophthalmology', 'dermatology', 'womensHealth', 'gastroenterology', 'hematology']
      .map(ta => ({
        url: `${baseUrl}/therapeutic-areas/${ta}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
  ];

  // Dynamic pages
  let blogPages: MetadataRoute.Sitemap = [];
  let landingPages: MetadataRoute.Sitemap = [];
  let companyPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    // Fetch published blog posts
    const { data: posts, error: postsError } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .eq('status', 'published');

    if (postsError) {
      console.error('Sitemap: Error fetching blog posts:', postsError.message);
    }

    if (posts) {
      blogPages = posts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.published_at || new Date()),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
    }

    // Fetch published landing pages
    const { data: pages, error: pagesError } = await supabase
      .from('landing_pages')
      .select('slug, published_at')
      .eq('status', 'published');

    if (pagesError) {
      console.error('Sitemap: Error fetching landing pages:', pagesError.message);
    }

    if (pages) {
      landingPages = pages.map((page) => ({
        url: `${baseUrl}/${page.slug}`,
        lastModified: new Date(page.published_at || new Date()),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }));
    }

    // Fetch companies for sitemap
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id')
      .order('deals_last_12mo', { ascending: false, nullsFirst: false })
      .limit(200);

    if (companiesError) {
      console.error('Sitemap: Error fetching companies:', companiesError.message);
    }

    if (companies) {
      companyPages = companies.map((company) => ({
        url: `${baseUrl}/companies/${company.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (error) {
    // Tables might not exist yet, continue with static pages only
    console.log('Sitemap: Dynamic content tables not available yet');
  }

  // Fallback to hardcoded blog posts if DB returned none
  if (blogPages.length === 0 && hardcodedBlogPosts.length > 0) {
    blogPages = hardcodedBlogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  }

  // Add blog index if there are posts
  if (blogPages.length > 0) {
    staticPages.push({
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    });
  }

  // About page
  staticPages.push({
    url: `${baseUrl}/about`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  });

  // Benchmark pages (statically generated)
  const benchmarkSlugs = getAllBenchmarkSlugs();
  const benchmarkPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/benchmarks`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...benchmarkSlugs.map((slug) => ({
      url: `${baseUrl}/benchmarks/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];

  // Insight pages (statically generated, social-friendly)
  const insightSlugs = getAllInsightSlugs();
  const insightPages: MetadataRoute.Sitemap = insightSlugs.map((slug) => ({
    url: `${baseUrl}/insights/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Companies index page
  staticPages.push({
    url: `${baseUrl}/companies`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  });

  // Individual glossary term pages
  const termSlugs = getAllTermSlugs();
  const glossaryTermPages: MetadataRoute.Sitemap = termSlugs.map((slug) => ({
    url: `${baseUrl}/glossary/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Guide pages
  const guidePages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/guides/how-to-value-biotech-deal`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides/negotiate-pharma-royalty-rates`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides/biotech-licensing-deal-structure`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides/rnpv-biotech-valuation`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides/pharma-ma-vs-licensing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  // Report pages
  const reportPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/reports`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/reports/deal-trends-2026`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  // Lead magnet / data insight pages
  const leadMagnetPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/insights/biopharma-deal-benchmarks-2026`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  // SEO long-form insight pages
  const seoInsightPages: MetadataRoute.Sitemap = SEO_INSIGHT_SLUGS.map(slug => ({
    url: `${baseUrl}/insights/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }));

  // Programmatic data pages (TA × Phase × Territory)
  const programmaticSlugs = getAllProgrammaticSlugs();
  const programmaticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/data`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...programmaticSlugs.map(slug => ({
      url: `${baseUrl}/data/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];

  return [...staticPages, ...blogPages, ...landingPages, ...benchmarkPages, ...insightPages, ...companyPages, ...glossaryTermPages, ...guidePages, ...reportPages, ...leadMagnetPages, ...seoInsightPages, ...programmaticPages];
}
