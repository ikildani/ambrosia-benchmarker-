/**
 * Exchange-disclosure adapters. Every adapter follows the same contract as
 * HKEX: a title/keyword search over a bounded window that returns documents
 * with a verbatim URL, a document-text fetch, and extraction through the
 * shared filing extractor into the shared cited-insert path.
 *
 * Status (17 Sep 2026):
 *   hkex     implemented; daily + 2017→present backfill crons
 *   edinet   stub: fetch layer works (EDINET API v2 needs a free API key,
 *            env EDINET_API_KEY); document list endpoint + PDF download wired;
 *            extraction call in place; no cron yet
 *   tdnet    stub: TDnet has no public search API; the daily list page is
 *            HTML and Japanese-only. Not wired. Prefer EDINET for now.
 *   dart     stub: DART OpenAPI (Korea) needs a free key, env DART_API_KEY;
 *            list endpoint wired; document is a zipped XML, unzip not wired
 *   sedar    stub: SEDAR+ has no public API; CSA search is a form post with
 *            anti-bot protection. Not wired.
 *   asx      stub: ASX announcements JSON endpoint per company code wired;
 *            needs a biotech code list (ASX sector 3520) to be useful; no cron
 */

export { runHkexIngestion, searchHkexTitles, parseHkexResult, isDealTitle, hkexDateToIso } from './hkex';
export { listEdinetDocuments, fetchEdinetPdfText } from './edinet';
export { listDartDisclosures } from './dart';
export { listAsxAnnouncements } from './asx';
