/**
 * API Integration Tests for /api/embed/stats
 *
 * These tests verify:
 * - GET returns JSON stats by default
 * - GET with format=html returns HTML widget
 * - CORS headers are set
 * - Cache headers are set
 */

import { NextRequest } from 'next/server';

// The widget reads the live corpus count; pin it so the test doesn't depend on the database.
jest.mock('@/lib/deal-stats', () => ({
  getLiveDealStats: jest.fn().mockResolvedValue({
    totalDeals: 1959,
    totalDealsDisplay: '1,900+',
    therapeuticAreas: 12,
    lastAddedAt: '2026-09-28T00:00:00.000Z',
    fallback: false,
  }),
}));

import { GET } from '@/app/api/embed/stats/route';

describe('/api/embed/stats', () => {
  describe('GET', () => {
    it('should return 200 with JSON stats by default', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total_deals).toBe(1959);
      expect(data.therapeutic_areas).toBe(12);
      expect(data.avg_upfront_oncology_phase2).toBe(95);
      expect(data.modalities_covered).toBe(25);
      expect(data.last_updated).toBe('2026-09-28');
      expect(data.source).toBe('Ambrosia Ventures');
      expect(data.source_url).toBe('https://solidus.ambrosiaventures.co');
      expect(data.last_updated).toBeDefined();
    });

    it('should include CORS and Cache-Control headers on JSON response', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats');

      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('max-age=3600');
    });

    it('should return HTML widget when format=html', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats?format=html');

      const response = await GET(request);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(body).toContain('av-widget');
      expect(body).toContain('Powered by Ambrosia Ventures');
    });

    it('should support dark theme for HTML widget', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats?format=html&theme=dark');

      const response = await GET(request);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('#1e293b'); // dark background color
    });

    it('should include CORS headers on HTML response', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats?format=html');

      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
