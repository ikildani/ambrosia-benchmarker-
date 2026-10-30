import { normalizeFilerName, secNameMatches } from '@/lib/ingestion/sec-name-match';
import { PHARMA_CIKS } from '@/lib/ingestion/sec-edgar';

describe('secNameMatches', () => {
  it('accepts the same company under SEC formatting', () => {
    expect(secNameMatches('VERTEX PHARMACEUTICALS INC / MA', ['Vertex Pharmaceuticals'])).toBe(true);
    expect(secNameMatches('BRISTOL MYERS SQUIBB CO', ['Bristol-Myers Squibb'])).toBe(true);
    expect(secNameMatches('JOHNSON & JOHNSON', ['Johnson & Johnson'])).toBe(true);
    expect(secNameMatches('NOVARTIS AG', ['Novartis'])).toBe(true);
    expect(secNameMatches('GSK plc', ['GSK', 'GlaxoSmithKline'])).toBe(true);
    expect(secNameMatches('Merck & Co., Inc.', ['Merck'])).toBe(true);
  });

  it('matches on any of the company name variations', () => {
    expect(secNameMatches('ASTRAZENECA PLC', ['AZ', 'AstraZeneca'])).toBe(true);
  });

  it('rejects the wrong filers that were in PHARMA_CIKS on 2026-10-30', () => {
    expect(secNameMatches('BANK OF AMERICA CORP /DE/', ['Bristol-Myers Squibb'])).toBe(false);
    expect(secNameMatches('COCA COLA CO', ['Johnson & Johnson'])).toBe(false);
    expect(secNameMatches('Autodesk, Inc.', ['Gilead Sciences'])).toBe(false);
    expect(secNameMatches('lululemon athletica inc.', ['Novartis'])).toBe(false);
    expect(secNameMatches('ABBOTT LABORATORIES', ['AstraZeneca'])).toBe(false);
  });

  it('does not match a short name inside an unrelated word', () => {
    expect(secNameMatches('SINOPEC SHANGHAI PETROCHEMICAL CO LTD', ['Roche'])).toBe(false);
    expect(secNameMatches('PTC THERAPEUTICS, INC.', ['PepTcell Limited'])).toBe(false);
    expect(secNameMatches('ANI PHARMACEUTICALS INC', ['Humanigen, Inc.'])).toBe(false);
    expect(secNameMatches('Vertex, Inc.', ['Vertex Pharmaceuticals'])).toBe(true); // same word: the CIK list, not this check, must disambiguate
  });

  it('keeps Merck KGaA apart from Merck & Co.', () => {
    expect(secNameMatches('Merck & Co., Inc.', ['Merck KGaA'])).toBe(false);
  });

  it('rejects empty input', () => {
    expect(secNameMatches(null, ['Pfizer'])).toBe(false);
    expect(secNameMatches('PFIZER INC', [null, ''])).toBe(false);
  });

  it('normalizes SEC state suffixes and legal forms', () => {
    expect(normalizeFilerName('VERTEX PHARMACEUTICALS INC / MA')).toBe('vertex pharmaceuticals');
    expect(normalizeFilerName('BANK OF AMERICA CORP /DE/')).toBe('bank of america');
  });
});

describe('PHARMA_CIKS', () => {
  it('lists each CIK once', () => {
    expect(new Set(Object.keys(PHARMA_CIKS)).size).toBe(Object.keys(PHARMA_CIKS).length);
  });

  it('carries the SEC CIKs for the large pharmas checked on 2026-10-30', () => {
    const byName = Object.fromEntries(Object.entries(PHARMA_CIKS).map(([cik, name]) => [name, cik]));
    expect(byName['Bristol-Myers Squibb']).toBe('14272');
    expect(byName['Johnson & Johnson']).toBe('200406');
    expect(byName['Gilead Sciences']).toBe('882095');
    expect(byName['Novartis']).toBe('1114448');
    expect(byName['AstraZeneca']).toBe('901832');
    expect(byName['Abbott Laboratories']).toBe('1800');
    expect(byName['Vertex Pharmaceuticals']).toBe('875320');
    expect(byName['Pfizer']).toBe('78003');
  });
});
