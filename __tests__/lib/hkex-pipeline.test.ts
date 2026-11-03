import { toNewAssetRow, type DisclosedProgram, type FilingContext } from '@/lib/ingestion/preclinical-pipeline';
import { HKEX_PIPELINE_FORM, HKEX_PIPELINE_SOURCE } from '@/lib/ingestion/hkex-pipeline';

const program: DisclosedProgram = {
  program_name: 'JAB-BX467', aliases: [], stage: 'ind_enabling', target: 'HER2', target_class: null, modality: 'adc',
  therapeutic_area: null, indication_category: null, indication_specific: null, mechanism_short: 'HER2-STING iADC',
  partnered: false, partner_name: null, evidence_quote: 'JAB-BX467, our HER2-STING iADC, is in IND-enabling studies.', confidence: 90,
} as DisclosedProgram;

const ctx = (extra: Partial<FilingContext> = {}): FilingContext => ({
  company_id: 'c1', company_name: 'Jacobio Pharmaceuticals', form: HKEX_PIPELINE_FORM, accession: '11223344',
  filing_date: '2026-04-24', url: 'https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0424/2026042400744.pdf',
  model: 'claude-sonnet-5', now: new Date('2026-11-03T00:00:00Z'), origin: 'filing', ...extra,
});

describe('HKEX pipeline rows', () => {
  it('tags assets created from an HKEX report with their own source, not sec_filing', () => {
    const row = toNewAssetRow(program, ctx({ dataSource: HKEX_PIPELINE_SOURCE }), null)!;
    expect(row.data_sources).toEqual(['hkex_filing']);
    expect(row.disclosure_source_type).toBe('hkex_annual_report');
    expect(row.disclosure_url).toMatch(/hkexnews\.hk/);
    expect(row.phase).toBe('preclinical');
  });

  it('keeps sec_filing as the default for SEC filings', () => {
    expect(toNewAssetRow(program, ctx({ form: '10-K' }), null)!.data_sources).toEqual(['sec_filing']);
  });
});
