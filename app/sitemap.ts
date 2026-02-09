import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

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
      url: `${baseUrl}/deals`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    // Glossary page exists but hidden from sitemap until ready
    // {
    //   url: `${baseUrl}/glossary`,
    //   lastModified: new Date(),
    //   changeFrequency: 'monthly',
    //   priority: 0.8,
    // },
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
  ];

  // Dynamic blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  let landingPages: MetadataRoute.Sitemap = [];

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
  } catch (error) {
    // Tables might not exist yet, continue with static pages only
    console.log('Sitemap: Dynamic content tables not available yet');
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

  return [...staticPages, ...blogPages, ...landingPages];
}
