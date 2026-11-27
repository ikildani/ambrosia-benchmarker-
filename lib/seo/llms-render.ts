import { getLiveDealStats } from '@/lib/deal-stats';

export async function renderLlms(template: string): Promise<Response> {
  const stats = await getLiveDealStats();
  const now = new Date();
  const text = template
    .replaceAll('{{DEALS}}', stats.totalDealsDisplay)
    .replaceAll('{{UPDATED}}', now.toISOString().slice(0, 10))
    .replaceAll('{{UPDATED_MONTH}}', now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
