/**
 * Source-URL persistence: citation selection helper + never-overwrite rule.
 *
 * Run with the scratch config or add `__tests__/ingestion/**` to the `lib`
 * project's testMatch in jest.config.js.
 */

jest.mock('@anthropic-ai/sdk');
jest.mock('../../lib/fetch-with-timeout', () => ({ fetchWithTimeout: jest.fn() }));

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout';
import {
  selectSourceUrl,
  extractCitationUrls,
  extractUrlsFromText,
  isPressReleaseUrl,
  buildSourceUrlUpdate,
  appendVerificationNote,
  companyDomainStem,
  verifyPendingDeals,
} from '../../lib/ingestion/deal-verifier';

describe('selectSourceUrl', () => {
  const parties = { licensor: 'Esperion Therapeutics, Inc.', licensee: 'Daiichi Sankyo Co., Ltd.' };

  it('prefers sec.gov / newswire hosts over earlier generic URLs', () => {
    const urls = [
      'https://www.fiercebiotech.com/biotech/some-story',
      'https://www.prnewswire.com/news-releases/esperion-deal-123.html',
      'https://www.sec.gov/Archives/edgar/data/1/0001.htm',
    ];
    expect(selectSourceUrl(urls, parties)).toEqual({
      url: 'https://www.prnewswire.com/news-releases/esperion-deal-123.html',
      host: 'prnewswire.com',
      path: 'preferred_host',
    });
  });

  it('falls back to a licensor/licensee company domain', () => {
    const urls = [
      'https://www.fiercebiotech.com/biotech/some-story',
      'https://ir.esperion.com/news/2019/collaboration',
    ];
    expect(selectSourceUrl(urls, parties)).toMatchObject({ host: 'ir.esperion.com', path: 'company_domain' });
  });

  it('otherwise takes the first https URL (skipping http)', () => {
    const urls = ['http://insecure.example.com/a', 'https://www.biospace.com/article/x', 'https://ir.esperion.com/y'];
    // biospace comes before the company domain but company_domain wins over first_https
    expect(selectSourceUrl(urls, parties)).toMatchObject({ host: 'ir.esperion.com', path: 'company_domain' });
    expect(selectSourceUrl(urls.slice(0, 2), parties)).toMatchObject({ host: 'biospace.com', path: 'first_https' });
  });

  it('returns null with allowFirstHttps=false when nothing specific matches', () => {
    const urls = ['https://www.biospace.com/article/x'];
    expect(selectSourceUrl(urls, parties, { allowFirstHttps: false })).toBeNull();
    expect(selectSourceUrl([], parties)).toBeNull();
    expect(selectSourceUrl(['not a url', 'ftp://x.y'], parties)).toBeNull();
  });

  it('derives company stems while ignoring corporate suffixes', () => {
    expect(companyDomainStem('Esperion Therapeutics, Inc.')).toBe('esperion');
    expect(companyDomainStem('Daiichi Sankyo Co., Ltd.')).toBe('daiichi');
    expect(companyDomainStem('Inc.')).toBeNull();
    expect(companyDomainStem(null)).toBeNull();
  });
});

describe('citation extraction', () => {
  it('reads chat-completions citations and search_results', () => {
    expect(extractCitationUrls({
      citations: ['https://a.com/1', 'https://b.com/2'],
      search_results: [{ title: 't', url: 'https://c.com/3' }, { url: 'https://a.com/1' }],
    })).toEqual(['https://a.com/1', 'https://b.com/2', 'https://c.com/3']);
  });

  it('reads responses-API url_citation annotations', () => {
    expect(extractCitationUrls({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'x', annotations: [
        { type: 'url_citation', url: 'https://www.sec.gov/f' }, { type: 'other', url: 'https://ignored.com' },
      ] }] }],
    })).toEqual(['https://www.sec.gov/f']);
    expect(extractCitationUrls(null)).toEqual([]);
    expect(extractCitationUrls({ choices: [] })).toEqual([]);
  });

  it('extracts bare URLs from text, trimming trailing punctuation', () => {
    expect(extractUrlsFromText('See https://a.com/x. and (https://b.com/y)')).toEqual(['https://a.com/x', 'https://b.com/y']);
  });
});

describe('isPressReleaseUrl', () => {
  it('recognises newswires and press-release paths', () => {
    expect(isPressReleaseUrl('https://www.globenewswire.com/news-release/2024/1/1/x.html')).toBe(true);
    expect(isPressReleaseUrl('https://ir.acme.com/news-releases/detail/1')).toBe(true);
    expect(isPressReleaseUrl('https://www.fiercebiotech.com/biotech/x')).toBe(false);
    expect(isPressReleaseUrl('garbage')).toBe(false);
  });
});

describe('buildSourceUrlUpdate — never overwrite', () => {
  const pr = 'https://www.businesswire.com/news/home/1/en/x';

  it('returns an empty patch when source_url is already set', () => {
    expect(buildSourceUrlUpdate({ source_url: 'https://existing.com', press_release_url: null }, { url: pr, excerpt: 'e' })).toEqual({});
  });

  it('fills only null fields', () => {
    expect(buildSourceUrlUpdate({ source_url: null, press_release_url: null, raw_text_excerpt: null }, { url: pr, excerpt: 'e' }))
      .toEqual({ source_url: pr, press_release_url: pr, raw_text_excerpt: 'e' });
    expect(buildSourceUrlUpdate({ source_url: null, press_release_url: 'https://kept.com', raw_text_excerpt: 'kept' }, { url: pr, excerpt: 'e' }))
      .toEqual({ source_url: pr });
    expect(buildSourceUrlUpdate({ source_url: null }, { url: 'https://www.fiercebiotech.com/x', excerpt: 'a'.repeat(700) }).raw_text_excerpt)
      .toHaveLength(600);
  });

  it('appends verification notes instead of replacing them', () => {
    expect(appendVerificationNote('old', 'new')).toBe('old | new');
    expect(appendVerificationNote(null, 'new')).toBe('new');
  });
});

describe('verifyPendingDeals persists citations without overwriting', () => {
  function makeSupabase(rows: Array<Record<string, unknown>>) {
    const updates: Array<{ patch: Record<string, unknown>; id: string; guardedNull: boolean }> = [];
    const chain = (data: unknown) => {
      const q: Record<string, unknown> = {};
      const self = () => q;
      for (const m of ['select', 'eq', 'in', 'is', 'or', 'order', 'limit']) q[m] = self;
      (q as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
      return q;
    };
    const supabase = {
      from: jest.fn((table: string) => ({
        select: (cols: string) => {
          expect(table).toBe('deals');
          expect(cols).toContain('press_release_url');
          return chain(rows);
        },
        update: (patch: Record<string, unknown>) => {
          const entry = { patch, id: '', guardedNull: false };
          updates.push(entry);
          const q = {
            eq: (_c: string, id: string) => { entry.id = id; return q; },
            is: (c: string, v: unknown) => { if (c === 'source_url' && v === null) entry.guardedNull = true; return q; },
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
          };
          return q;
        },
      })),
    };
    return { supabase, updates };
  }

  const perplexityBody = {
    citations: ['https://www.fiercebiotech.com/biotech/story', 'https://www.prnewswire.com/news-releases/acme-beta-deal.html'],
    output: [{ type: 'message', content: [{ type: 'output_text', text: 'Acme Bio licensed ACM-1 to Beta Pharma for $50M upfront in a deal announced in 2023 with milestones up to $500M and tiered royalties. '.repeat(2) }] }],
  };

  beforeEach(() => {
    (fetchWithTimeout as jest.Mock).mockResolvedValue({ ok: true, json: async () => perplexityBody });
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: { create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ status: 'verified', confidence: 90, reason: 'matches' }) }] }) },
    }));
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 as unknown as NodeJS.Timeout; }) as unknown as typeof setTimeout);
  });
  afterEach(() => jest.restoreAllMocks());

  const base = { licensor_name: 'Acme Bio', licensee_name: 'Beta Pharma', asset_name: 'ACM-1', announced_date: '2023-05-01', press_release_url: null, raw_text_excerpt: null, verification_notes: null, phase_at_signing: 'phase_2' };

  it('fills source_url + press_release_url + excerpt and appends a note when the row has no URL', async () => {
    const { supabase, updates } = makeSupabase([{ ...base, id: 'd1', source_url: null }]);
    const result = await verifyPendingDeals(supabase as never, 'pk', 'ak', { maxDeals: 1 });
    expect(result.verified).toBe(1);
    expect(result.sourceUrlsAdded).toBe(1);
    const patch = updates.find(u => u.id === 'd1')!.patch;
    expect(patch.source_url).toBe('https://www.prnewswire.com/news-releases/acme-beta-deal.html');
    expect(patch.press_release_url).toBe(patch.source_url);
    expect(String(patch.raw_text_excerpt)).toContain('Beta Pharma');
    expect(String(patch.raw_text_excerpt).length).toBeLessThanOrEqual(600);
    expect(patch.verification_notes).toBe('matches | source_url set by deal-verifier from Perplexity citation (preferred_host: prnewswire.com)');
  });

  it('never touches an existing source_url', async () => {
    const { supabase, updates } = makeSupabase([{ ...base, id: 'd2', source_url: 'https://kept.example.com/pr' }]);
    const result = await verifyPendingDeals(supabase as never, 'pk', 'ak', { maxDeals: 1 });
    expect(result.sourceUrlsAdded).toBe(0);
    const patch = updates.find(u => u.id === 'd2')!.patch;
    expect(patch).not.toHaveProperty('source_url');
    expect(patch).not.toHaveProperty('press_release_url');
    expect(patch.verification_notes).toBe('matches');
  });

  it('does not attach a URL to a rejected verdict', async () => {
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({
      messages: { create: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ status: 'rejected', confidence: 90, reason: 'no evidence' }) }] }) },
    }));
    const { supabase, updates } = makeSupabase([{ ...base, id: 'd3', source_url: null }]);
    await verifyPendingDeals(supabase as never, 'pk', 'ak', { maxDeals: 1 });
    expect(updates.find(u => u.id === 'd3')!.patch).not.toHaveProperty('source_url');
  });
});
