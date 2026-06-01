import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  return {
    rules: [
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'anthropic-ai', 'Claude-Web', 'Google-Extended', 'PerplexityBot', 'Applebot-Extended', 'cohere-ai'],
        allow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/', '/calculator?*', '/pricing?*', '/&', '/yr', '/mo', '/seat/', '/_next/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/'],
      },
      {
        userAgent: '*',
        allow: ['/', '/api/og'],
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/', '/_next/', '/portfolio/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
