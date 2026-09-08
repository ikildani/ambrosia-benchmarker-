import { SITEMAP_IDS } from '../sitemap';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const revalidate = 3600;

/**
 * Sitemap index.
 *
 * Next.js's generateSitemaps() only emits the per-shard files at
 * /sitemap/{id}.xml — it does not produce an index. robots.txt and Google
 * Search Console both point at /sitemap.xml, which 404'd until this route
 * existed. Keep the id list in sync with app/sitemap.ts via SITEMAP_IDS.
 */
export function GET() {
  const entries = SITEMAP_IDS
    .map((id) => `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${id}.xml</loc>\n  </sitemap>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
