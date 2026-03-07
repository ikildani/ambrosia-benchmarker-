import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://calculator.ambrosiaventures.co';

  return {
    rules: [
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'anthropic-ai', 'Claude-Web', 'Google-Extended'],
        allow: '/',
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/'],
      },
      {
        userAgent: '*',
        allow: ['/', '/api/og'],
        disallow: ['/api/', '/dashboard', '/admin/', '/auth/', '/share/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
