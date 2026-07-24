import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://solidus.ambrosiaventures.co';

  return {
    rules: [
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'anthropic-ai', 'Claude-Web', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'cohere-ai'],
        allow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/auth/', '/portfolio/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
