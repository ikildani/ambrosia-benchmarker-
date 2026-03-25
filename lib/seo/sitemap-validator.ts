/**
 * Sitemap URL health validator.
 * Fetches sitemap.xml, samples URLs, and checks for broken links,
 * redirect chains, and server errors.
 */

export interface SitemapHealthResult {
  totalUrls: number;
  checked: number;
  healthy: number;
  issues: { url: string; status: number; error?: string }[];
}

/**
 * Validate a site's sitemap by sampling URLs and checking HTTP status.
 *
 * @param siteUrl  Base URL of the site (no trailing slash)
 * @param maxChecks  Maximum number of URLs to sample (default 50)
 */
export async function validateSitemap(
  siteUrl: string,
  maxChecks: number = 50
): Promise<SitemapHealthResult> {
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  // 1. Fetch sitemap
  let sitemapXml: string;
  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return {
        totalUrls: 0,
        checked: 0,
        healthy: 0,
        issues: [{ url: sitemapUrl, status: res.status, error: 'Failed to fetch sitemap' }],
      };
    }
    sitemapXml = await res.text();
  } catch (err) {
    return {
      totalUrls: 0,
      checked: 0,
      healthy: 0,
      issues: [
        {
          url: sitemapUrl,
          status: 0,
          error: `Sitemap fetch error: ${err instanceof Error ? err.message : 'Unknown'}`,
        },
      ],
    };
  }

  // 2. Extract <loc> URLs via regex (no XML parser dependency)
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(sitemapXml)) !== null) {
    urls.push(match[1]);
  }

  if (urls.length === 0) {
    return {
      totalUrls: 0,
      checked: 0,
      healthy: 0,
      issues: [{ url: sitemapUrl, status: 0, error: 'No <loc> entries found in sitemap' }],
    };
  }

  // 3. Random sample up to maxChecks
  const sampled = shuffleAndTake(urls, maxChecks);

  // 4. Check each URL with HEAD request
  const issues: SitemapHealthResult['issues'] = [];
  let healthy = 0;

  // Process in parallel batches of 10 to avoid overwhelming the server
  const BATCH_SIZE = 10;
  for (let i = 0; i < sampled.length; i += BATCH_SIZE) {
    const batch = sampled.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((url) => checkUrl(url)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const url = batch[j];

      if (result.status === 'rejected') {
        issues.push({ url, status: 0, error: String(result.reason) });
        continue;
      }

      const { status, error } = result.value;
      if (status >= 200 && status < 300) {
        healthy++;
      } else {
        issues.push({ url, status, error });
      }
    }
  }

  return {
    totalUrls: urls.length,
    checked: sampled.length,
    healthy,
    issues,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function checkUrl(
  url: string,
  maxRedirects: number = 5
): Promise<{ status: number; error?: string }> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    try {
      const res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });

      // Success
      if (res.status >= 200 && res.status < 300) {
        return { status: res.status };
      }

      // Redirect — follow manually to detect chains
      if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
        const location = res.headers.get('location');
        if (!location) {
          return { status: res.status, error: 'Redirect with no Location header' };
        }
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        redirectCount++;
        continue;
      }

      // Client or server error
      return { status: res.status, error: `HTTP ${res.status}` };
    } catch (err) {
      return {
        status: 0,
        error: `Request failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      };
    }
  }

  return {
    status: 301,
    error: `Redirect loop or chain exceeded ${maxRedirects} hops`,
  };
}

function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
