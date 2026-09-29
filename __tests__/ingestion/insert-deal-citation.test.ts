import { buildCitedDealRow } from '@/lib/ingestion/insert-deal';

const base = { row: { licensor_name: 'A', licensee_name: 'B' }, sourceType: 'press_release', extractionModel: 'test' };

describe('buildCitedDealRow citation fields', () => {
  it('moves a newswire URL passed as a filing id into press_release_url', () => {
    const u = 'https://www.globenewswire.com/news-release/2024/05/13/2880198/0/en/x.html';
    const r = buildCitedDealRow({ ...base, sourceUrl: u, sourceFilingId: u });
    expect(r.source_filing_id).toBeNull();
    expect(r.press_release_url).toBe(u);
    expect(r.source_url).toBe(u);
  });
  it('drops a news-site URL passed as a filing id without making it primary', () => {
    const u = 'https://www.fiercebiotech.com/biotech/x';
    const r = buildCitedDealRow({ ...base, sourceUrl: u, sourceFilingId: u });
    expect(r.source_filing_id).toBeNull();
    expect(r.press_release_url).toBeNull();
    expect(r.source_url).toBe(u);
  });
  it('keeps a real filing id', () => {
    const r = buildCitedDealRow({ ...base, sourceType: 'sec_8k', sourceUrl: 'https://www.sec.gov/x.htm', sourceFilingId: '0001193125-24-000001' });
    expect(r.source_filing_id).toBe('0001193125-24-000001');
  });
  it('treats a press_release row sourced from a newswire as a press-release citation', () => {
    const u = 'https://www.prnewswire.com/news-releases/x-302000000.html';
    const r = buildCitedDealRow({ ...base, sourceUrl: u });
    expect(r.press_release_url).toBe(u);
  });
});
