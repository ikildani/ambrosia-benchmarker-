/**
 * Google Search Console API client.
 * Supports two auth methods:
 *   1. Service account (GOOGLE_SERVICE_ACCOUNT_JSON env var) — original
 *   2. OAuth2 refresh token (stored in Supabase system_config) — fallback
 *      when org policy blocks service account key creation
 */

import { google, type searchconsole_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createServiceClient } from '@/lib/supabase/server';

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
  private authClient: OAuth2Client | null = null;
  private siteUrl: string;
  private configured: boolean = false;
  private authMethod: 'service_account' | 'oauth2' | 'none' = 'none';

  constructor() {
    this.siteUrl = process.env.GSC_SITE_URL || 'https://solidus.ambrosiaventures.co';

    // Method 1: Service account (existing — preferred if available)
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const credentials = JSON.parse(
          Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
        );

        const auth = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: [
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/indexing',
          ],
        });

        this.authClient = auth;
        this.client = google.searchconsole({ version: 'v1', auth });
        this.configured = true;
        this.authMethod = 'service_account';
        return;
      } catch (err) {
        console.error('[GSCClient] Service account init failed:', err instanceof Error ? err.message : 'Unknown');
      }
    }

    // Method 2: OAuth2 — deferred to initOAuth2() since it's async
    // Constructor can't be async, so we set configured = false here
    // and let the caller call initOAuth2() before using the client.
  }

  /**
   * Initialize OAuth2 auth by reading the refresh token from Supabase.
   * Call this once before using the client if service account isn't configured.
   */
  async initOAuth2(): Promise<boolean> {
    if (this.configured) return true;

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('[GSCClient] Neither service account nor OAuth2 credentials configured');
      return false;
    }

    try {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'gsc_oauth_tokens')
        .single();

      if (!data?.value?.refresh_token) {
        console.warn('[GSCClient] OAuth2 configured but no refresh token stored. Visit /api/auth/gsc-authorize to authorize.');
        return false;
      }

      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({
        refresh_token: data.value.refresh_token,
      });

      this.authClient = oauth2Client;
      this.client = google.searchconsole({ version: 'v1', auth: oauth2Client });
      this.configured = true;
      this.authMethod = 'oauth2';
      console.log('[GSCClient] Initialized via OAuth2 refresh token');
      return true;
    } catch (err) {
      console.error('[GSCClient] OAuth2 init failed:', err instanceof Error ? err.message : 'Unknown');
      return false;
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
   * Request indexing for a URL via the Google Indexing API.
   * Returns true if the request was accepted, false otherwise.
   */
  async requestIndexing(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.authClient || !this.configured) {
      return { success: false, error: 'Client not configured' };
    }

    try {
      // Get an access token from the auth client
      const tokenResponse = await this.authClient.getAccessToken();
      const accessToken = typeof tokenResponse === 'string'
        ? tokenResponse
        : tokenResponse?.token;

      if (!accessToken) {
        return { success: false, error: 'Failed to obtain access token' };
      }

      const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url,
          type: 'URL_UPDATED',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[GSCClient] Indexing request failed for ${url}: ${res.status} ${body}`);
        return { success: false, error: `${res.status}: ${body.slice(0, 200)}` };
      }

      console.log(`[GSCClient] Indexing requested for ${url}`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[GSCClient] requestIndexing error for ${url}:`, message);
      return { success: false, error: message };
    }
  }

  /**
   * Get all page URLs that have appeared in search analytics.
   * Returns a set of page URLs that have at least some impressions.
   */
  async getPagesWithImpressions(days: number = 90): Promise<Set<string>> {
    if (!this.client || !this.configured) {
      return new Set();
    }

    try {
      const endDate = formatDate(daysAgo(1));
      const startDate = formatDate(daysAgo(days));

      const res = await this.client.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 5000,
        },
      });

      const pages = new Set<string>();
      for (const row of res.data.rows || []) {
        const pageUrl = row.keys?.[0];
        if (pageUrl) pages.add(pageUrl);
      }
      return pages;
    } catch (err) {
      console.error(
        '[GSCClient] getPagesWithImpressions error:',
        err instanceof Error ? err.message : 'Unknown'
      );
      return new Set();
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getAuthMethod(): string {
    return this.authMethod;
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
