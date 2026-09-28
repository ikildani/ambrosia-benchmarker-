/**
 * Flag-and-fix: flagged deals are corrected only from a primary document, and
 * a flagged row that duplicates a verified, cited row is removed, not re-dated.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());

import {
  buildPatch,
  documentText,
  evidenceSupported,
  findKeeper,
  likeToken,
  primaryCandidates,
  rolesReversed,
  type CandidateRow,
  type ExtractedTerms,
  type FlaggedDeal,
} from '@/lib/ingestion/flag-fixer';
import { buildFlagFixReportHtml } from '@/lib/ingestion/flag-fix-report';

const deal = (over: Partial<FlaggedDeal> = {}): FlaggedDeal => ({
  id: 'd1',
  licensor_name: 'Hansoh Pharma',
  licensee_name: 'Merck',
  asset_name: 'HS-10535',
  deal_type: 'license',
  announced_date: '2026-07-01',
  upfront_usd: null,
  milestones_total_usd: null,
  total_deal_value_usd: '2000000000',
  phase_at_signing: 'unknown',
  source_url: null,
  press_release_url: null,
  verification_notes: 'flagged by verifier',
  ...over,
});

const terms = (over: Partial<ExtractedTerms> = {}): ExtractedTerms => ({
  same_deal: true,
  announced_date: '2024-12-18',
  licensor: 'Hansoh Pharmaceutical Group',
  licensee: 'Merck & Co.',
  asset_name: 'HS-10535 (oral GLP-1 RA)',
  deal_type: 'license',
  upfront_usd: 112_000_000,
  milestones_total_usd: 1_900_000_000,
  total_deal_value_usd: 2_012_000_000,
  phase_at_signing: 'preclinical',
  evidence: ['Hansoh Pharma will receive an upfront payment of $112 million'],
  ...over,
});

describe('primaryCandidates', () => {
  it('keeps regulator, newswire and company-domain URLs, SEC first, and drops news sites', () => {
    const out = primaryCandidates(
      [
        'https://www.fiercebiotech.com/biotech/merck-hansoh',
        'https://www.prnewswire.com/news-releases/hansoh-merck-302.html',
        'https://www.merck.com/news/merck-enters-license-hansoh/',
        'https://www.sec.gov/Archives/edgar/data/1/ex99.htm',
        'https://en.wikipedia.org/wiki/Merck',
      ],
      { licensor: 'Hansoh Pharma', licensee: 'Merck & Co.' },
    );
    expect(out).toEqual([
      'https://www.sec.gov/Archives/edgar/data/1/ex99.htm',
      'https://www.prnewswire.com/news-releases/hansoh-merck-302.html',
      'https://www.merck.com/news/merck-enters-license-hansoh/',
    ]);
  });
});

describe('evidenceSupported', () => {
  const text = documentText('<html><body><p>RAHWAY, N.J., Dec. 18, 2024 &ndash; Hansoh Pharma will receive an upfront payment of $112 million and is eligible for up to $1.9 billion.</p></body></html>');
  it('accepts quotes that appear in the document', () => {
    expect(evidenceSupported(['Hansoh Pharma will receive an upfront payment of $112 million'], text)).toBe(true);
  });
  it('rejects a quote the document does not contain, or no quote at all', () => {
    expect(evidenceSupported(['Hansoh Pharma will receive an upfront payment of $150 million'], text)).toBe(false);
    expect(evidenceSupported([], text)).toBe(false);
    expect(evidenceSupported(['$112 million'], text)).toBe(false); // too short to prove anything
  });
});

describe('buildPatch', () => {
  it('fills the stated terms, corrects the date, and maps the phase', () => {
    expect(buildPatch(deal(), terms(), '2026-09-28')).toEqual({
      announced_date: '2024-12-18',
      upfront_usd: 112_000_000,
      milestones_total_usd: 1_900_000_000,
      total_deal_value_usd: 2_012_000_000,
      phase_at_signing: 'preclinical',
      asset_name: 'HS-10535 (oral GLP-1 RA)',
    });
  });
  it('never writes a value the document does not state, a future date, or an upfront above the total', () => {
    const p = buildPatch(deal({ total_deal_value_usd: '100000000' }), terms({
      announced_date: '2027-01-01', upfront_usd: 500_000_000, milestones_total_usd: null, total_deal_value_usd: null, phase_at_signing: null, asset_name: null,
    }), '2026-09-28');
    expect(p).toEqual({});
  });
  it('leaves unchanged fields out of the patch', () => {
    const p = buildPatch(deal({ announced_date: '2024-12-18', upfront_usd: '112000000' }), terms(), '2026-09-28');
    expect(p.announced_date).toBeUndefined();
    expect(p.upfront_usd).toBeUndefined();
  });
});

describe('rolesReversed', () => {
  it('detects a record whose licensor is the buyer in the document', () => {
    expect(rolesReversed(deal({ licensor_name: 'Merck', licensee_name: 'Hansoh Pharma' }), terms())).toBe(true);
    expect(rolesReversed(deal(), terms())).toBe(false);
  });
});

describe('findKeeper', () => {
  const row = (over: Partial<CandidateRow>): CandidateRow => ({
    id: 'k1', licensor_name: 'Hansoh Pharmaceutical', licensee_name: 'Merck', announced_date: '2024-12-18',
    upfront_usd: '112000000', total_deal_value_usd: '2012000000', verification_status: 'verified',
    source_url: 'https://www.merck.com/news/x', press_release_url: null, is_synthetic: false, ...over,
  });
  it('returns the verified, cited row holding the same deal', () => {
    expect(findKeeper('d1', terms(), [row({})])?.id).toBe('k1');
  });
  it('ignores unverified, uncited, synthetic, far-dated or differently priced rows', () => {
    expect(findKeeper('d1', terms(), [
      row({ id: 'a', verification_status: 'flagged' }),
      row({ id: 'b', source_url: null }),
      row({ id: 'c', is_synthetic: true }),
      row({ id: 'e', announced_date: '2023-12-26' }),
      row({ id: 'f', upfront_usd: '160000000' }),
      row({ id: 'd1' }),
    ])).toBeNull();
  });
});

describe('likeToken', () => {
  it('yields a short alphanumeric token safe inside ilike', () => {
    expect(likeToken('Eli Lilly and Company')).toBe('lilly');
    expect(likeToken('Merck & Co., Inc.')).toBe('merck');
    expect(likeToken(null)).toBe('zzzz');
  });
});

describe('buildFlagFixReportHtml', () => {
  it('lists fixes with their source and escapes names', () => {
    const html = buildFlagFixReportHtml({
      since: '2026-09-27T12:50:00Z', newlyFlagged: 3, stillFlagged: 40,
      fixed: [{ deal_id: 'd1', issue_type: 'flagged_fixed', action_taken: 'announced_date: 2026-07-01 -> 2024-12-18', new_value: 'https://www.merck.com/news/x', created_at: '', deal: { licensor_name: 'Hansoh <Pharma>', licensee_name: 'Merck', asset_name: null } }],
      duplicates: [], rejected: [], unresolved: [],
    });
    expect(html).toContain('1 fixed from primary sources');
    expect(html).toContain('announced_date: 2026-07-01 -&gt; 2024-12-18');
    expect(html).toContain('href="https://www.merck.com/news/x"');
    expect(html).toContain('Hansoh &lt;Pharma&gt;');
  });
});
