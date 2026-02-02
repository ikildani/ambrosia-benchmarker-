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
  ];

  // Dynamic blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  let landingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    // Fetch published blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published');

    if (posts) {
      blogPages = posts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at || post.published_at),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
    }

    // Fetch published landing pages
    const { data: pages } = await supabase
      .from('landing_pages')
      .select('slug, updated_at, published_at')
      .eq('status', 'published');

    if (pages) {
      landingPages = pages.map((page) => ({
        url: `${baseUrl}/${page.slug}`,
        lastModified: new Date(page.updated_at || page.published_at),
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
