/**
 * Verification without Perplexity (Nov 23 2026): a deal with a primary citation is verified
 * from that document; Perplexity is only the fallback, and only while it is up.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());

import {
  chooseVerificationPath,
  errorsShowPerplexityOutage,
  isDown,
  isPerplexityOutage,
} from '@/lib/ingestion/perplexity-health';
import { hasPrimaryCitation, isPdf } from '@/lib/ingestion/flag-fixer';

describe('verification path', () => {
  it('prefers the primary document whenever the row cites one, Perplexity up or not', () => {
    expect(chooseVerificationPath({ hasPrimaryCitation: true, perplexityConfigured: true, perplexityDown: false })).toBe('primary_document');
    expect(chooseVerificationPath({ hasPrimaryCitation: true, perplexityConfigured: true, perplexityDown: true })).toBe('primary_document');
    expect(chooseVerificationPath({ hasPrimaryCitation: true, perplexityConfigured: false, perplexityDown: true })).toBe('primary_document');
  });

  it('uses Perplexity for uncited rows only while it is configured and up, else the row waits', () => {
    expect(chooseVerificationPath({ hasPrimaryCitation: false, perplexityConfigured: true, perplexityDown: false })).toBe('perplexity');
    expect(chooseVerificationPath({ hasPrimaryCitation: false, perplexityConfigured: true, perplexityDown: true })).toBe('wait');
    expect(chooseVerificationPath({ hasPrimaryCitation: false, perplexityConfigured: false, perplexityDown: false })).toBe('wait');
  });
});

describe('Perplexity outage detection', () => {
  it('treats quota and auth statuses as an outage, not rate limits or server errors', () => {
    expect(isPerplexityOutage(401)).toBe(true);
    expect(isPerplexityOutage(402)).toBe(true);
    expect(isPerplexityOutage(429)).toBe(false);
    expect(isPerplexityOutage(500)).toBe(false);
  });

  it('reads the verifier and discovery error strings seen in production', () => {
    expect(errorsShowPerplexityOutage(['Perplexity 401 for Qyuns Therapeutics Co., Ltd./Caldera Therapeutics, Inc.'])).toBe(true);
    expect(errorsShowPerplexityOutage(['Mega-deal sweep error: Error: Perplexity API error: 401 {"error":{"type":"insufficient_quota"}}'])).toBe(true);
    expect(errorsShowPerplexityOutage(['Perplexity 429 for A/B', 'Query failed: timeout'])).toBe(false);
    expect(errorsShowPerplexityOutage([])).toBe(false);
  });

  it('keeps the down mark until it expires', () => {
    const now = new Date('2026-11-23T12:00:00Z');
    expect(isDown({ downUntil: '2026-11-23T20:00:00Z' }, now)).toBe(true);
    expect(isDown({ downUntil: '2026-11-23T11:59:00Z' }, now)).toBe(false);
    expect(isDown({}, now)).toBe(false);
    expect(isDown(null, now)).toBe(false);
  });
});

describe('primary citation and document type', () => {
  const base = { licensor_name: 'Qyuns Therapeutics', licensee_name: 'Caldera Therapeutics', press_release_url: null };

  it('recognises SEC, exchange and newswire citations as primary, news sites as not', () => {
    expect(hasPrimaryCitation({ ...base, source_url: 'https://www.sec.gov/Archives/edgar/data/1/0001-26-000001/ex99.htm' })).toBe(true);
    expect(hasPrimaryCitation({ ...base, source_url: 'https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1109/2026110900123.pdf' })).toBe(true);
    expect(hasPrimaryCitation({ ...base, source_url: 'https://www.globenewswire.com/news-release/2026/11/09/1/0/en/x.html' })).toBe(true);
    expect(hasPrimaryCitation({ ...base, source_url: 'https://www.fiercebiotech.com/biotech/x' })).toBe(false);
    expect(hasPrimaryCitation({ ...base, source_url: null })).toBe(false);
  });

  it('reads exchange announcements as PDFs', () => {
    expect(isPdf('https://www1.hkexnews.hk/listedco/listconews/sehk/2026/1109/2026110900123.pdf', null)).toBe(true);
    expect(isPdf('https://static.cninfo.com.cn/finalpage/2026-11-09/1225580763.PDF?x=1', null)).toBe(true);
    expect(isPdf('https://example.com/doc', 'application/pdf')).toBe(true);
    expect(isPdf('https://www.sec.gov/Archives/edgar/data/1/x.htm', 'text/html')).toBe(false);
  });
});
