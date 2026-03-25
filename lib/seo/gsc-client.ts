/**
 * Google Search Console API client.
 * Wraps the googleapis package to provide performance data, coverage info,
 * and sitemap management for the Ambrosia Benchmarker site.
 */

import { google, type searchconsole_v1 } from 'googleapis';

export interface GSCPerformanceRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCCoverageData {
  indexedPages: number;
  errors: number;
  warnings: number;
  excluded: number;
}

export class GSCClient {
  private client: searchconsole_v1.Searchconsole | null = null;
  private siteUrl: string;
  private configured: boolean = false;

  constructor() {
    this.siteUrl = process.env.GSC_SITE_URL || 'https://calculator.ambrosiaventures.co';

    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.warn('[GSCClient] GOOGLE_SERVICE_ACCOUNT_JSON not configured — GSC calls will return empty data');
      return;
    }

    try {
      const credentials = JSON.parse(
        Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
      );

      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });

      this.client = google.searchconsole({ version: 'v1', auth });
      this.configured = true;
    } catch (err) {
      console.error(
        '[GSCClient] Failed to initialize:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  /**
   * Fetch search performance data (queries + pages) for the last N days.
   */
  async getPerformanceData(days: number = 28): Promise<GSCPerformanceRow[]> {
    if (!this.client || !this.configured) {
      return [];
    }

    try {
      const endDate = formatDate(daysAgo(1));
      const startDate = formatDate(daysAgo(days));

      const res = await this.client.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: 5000,
        },
      });

      if (!res.data.rows) {
        return [];
      }

      return res.data.rows.map((row) => ({
        query: row.keys?.[0] || '',
        page: row.keys?.[1] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }));
    } catch (err) {
      console.error(
        '[GSCClient] getPerformanceData error:',
        err instanceof Error ? err.message : 'Unknown'
      );
      return [];
    }
  }

  /**
   * Get the number of indexed pages from the sitemap.
   */
  async getIndexedPageCount(): Promise<number> {
    if (!this.client || !this.configured) {
      return 0;
    }

    try {
      const sitemapUrl = `${this.siteUrl}/sitemap.xml`;
      const res = await this.client.sitemaps.get({
        siteUrl: this.siteUrl,
        feedpath: sitemapUrl,
      });

      const contents = res.data.contents;
      if (!contents || contents.length === 0) {
        return 0;
      }

      // Sum indexed counts across all content types in the sitemap
      let totalIndexed = 0;
      for (const entry of contents) {
        totalIndexed += Number(entry.indexed) || 0;
      }
      return totalIndexed;
    } catch (err) {
      console.error(
        '[GSCClient] getIndexedPageCount error:',
        err instanceof Error ? err.message : 'Unknown'
      );
      return 0;
    }
  }

  /**
   * Submit (or re-submit) a sitemap to Google Search Console.
   */
  async submitSitemap(sitemapUrl: string): Promise<void> {
    if (!this.client || !this.configured) {
      console.warn('[GSCClient] Cannot submit sitemap — client not configured');
      return;
    }

    try {
      await this.client.sitemaps.submit({
        siteUrl: this.siteUrl,
        feedpath: sitemapUrl,
      });
      console.log(`[GSCClient] Sitemap submitted: ${sitemapUrl}`);
    } catch (err) {
      console.error(
        '[GSCClient] submitSitemap error:',
        err instanceof Error ? err.message : 'Unknown'
      );
    }
  }

  /**
   * Whether the client is properly configured with credentials.
   */
  isConfigured(): boolean {
    return this.configured;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
