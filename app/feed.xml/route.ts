import { createServiceClient } from '@/lib/supabase/server';

const SITE_URL = 'https://calculator.ambrosiaventures.co';

export async function GET() {
  let items = '';

  try {
    const supabase = createServiceClient();
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('title, slug, excerpt, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(50);

    if (posts) {
      items = posts
        .map(
          (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt || ''}]]></description>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    </item>`
        )
        .join('');
    }
  } catch {
    // Blog table may not exist yet — return empty feed
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ambrosia Ventures Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Expert analysis of biotech licensing deals, modality trends, and negotiation strategies for life sciences professionals.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
