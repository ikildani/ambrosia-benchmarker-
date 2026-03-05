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

import { GET } from '@/app/api/embed/stats/route';

describe('/api/embed/stats', () => {
  describe('GET', () => {
    it('should return 200 with JSON stats by default', async () => {
      const request = new NextRequest('http://localhost/api/embed/stats');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total_deals).toBe(500);
      expect(data.avg_upfront_oncology).toBe(45);
      expect(data.avg_upfront_rare_disease).toBe(35);
      expect(data.modalities_covered).toBe(15);
      expect(data.source).toBe('Ambrosia Ventures');
      expect(data.source_url).toBe('https://calculator.ambrosiaventures.co');
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
