/**
 * EDINET (Japan) stub. Document list and PDF download against EDINET API v2.
 * Requires EDINET_API_KEY (free registration). Extraction is wired to the
 * shared filing extractor; there is no cron until a Japanese-language
 * extraction prompt has been validated on real 適時開示 licensing filings.
 */
import { fetchWithTimeout } from '../../fetch-with-timeout';

const BASE = 'https://api.edinet-fsa.go.jp/api/v2';

export interface EdinetDocument {
  docID: string;
  filerName: string;
  docDescription: string;
  submitDateTime: string;
  pdfUrl: string;
}

/** Documents submitted on one date (YYYY-MM-DD). Returns [] without a key. */
export async function listEdinetDocuments(dateIso: string): Promise<EdinetDocument[]> {
  const key = process.env.EDINET_API_KEY;
  if (!key) return [];
  const res = await fetchWithTimeout(`${BASE}/documents.json?date=${dateIso}&type=2&Subscription-Key=${key}`, { timeoutMs: 20_000, retries: 1 });
  if (!res.ok) return [];
  const data = await res.json() as { results?: Array<Record<string, string>> };
  return (data.results ?? [])
    .filter(r => /license|licen|提携|導出|ライセンス|共同開発/i.test(`${r.docDescription ?? ''}`))
    .map(r => ({
      docID: r.docID, filerName: r.filerName ?? '', docDescription: r.docDescription ?? '', submitDateTime: r.submitDateTime ?? '',
      pdfUrl: `${BASE}/documents/${r.docID}?type=2&Subscription-Key=${key}`,
    }));
}

export async function fetchEdinetPdfText(pdfUrl: string): Promise<string> {
  const res = await fetchWithTimeout(pdfUrl, { timeoutMs: 30_000, retries: 1 });
  if (!res.ok) return '';
  const buf = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  return String(text).replace(/\s+/g, ' ').trim();
}
