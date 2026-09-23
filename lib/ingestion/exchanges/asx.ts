/**
 * ASX (Australia) stub. Announcements JSON per company code. Needs a code
 * list (ASX sector 3520 Pharmaceuticals & Biotechnology) to be useful; PDF
 * URLs are behind an interstitial that requires a browser-like fetch. No cron.
 */
import { fetchWithTimeout } from '../../fetch-with-timeout';

export interface AsxAnnouncement {
  id: string;
  code: string;
  header: string;
  document_release_date: string;
  url: string;
}

export async function listAsxAnnouncements(code: string): Promise<AsxAnnouncement[]> {
  const res = await fetchWithTimeout(`https://www.asx.com.au/asx/1/company/${encodeURIComponent(code)}/announcements?count=50&market_sensitive=false`, {
    timeoutMs: 20_000, retries: 1, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return [];
  const data = await res.json() as { data?: Array<Record<string, string>> };
  return (data.data ?? [])
    .filter(r => /licen|collaborat|partnership|co-development|option/i.test(r.header ?? ''))
    .map(r => ({ id: r.id, code, header: r.header, document_release_date: r.document_release_date, url: r.url }));
}
