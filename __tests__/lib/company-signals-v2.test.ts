import { readFileSync } from 'fs';
import { join } from 'path';
import {
  companyKeys, cjkKey, isDistinctiveKey, nameAgreement, nameKey, urlDomain, type MatchSubject,
} from '@/lib/ingestion/signal-match';
import {
  matchListings, parseAsxCsv, parseCsv, parseEuronextCsv, parseKrxHtml, parseSecTickersExchange, parseSseJson,
  parseSzseRows, parseTickerSuffix, parseTsxJson, listingRow, type ListingEntry,
} from '@/lib/ingestion/listings';
import { awardDate, matchNihProjects, nihYearsToFetch, type NihProject } from '@/lib/ingestion/nih-grants';
import { candidateKeyIndex, decideFiler, filerProfile, parseCikLookupLine, scanCikLookup } from '@/lib/ingestion/edgar-filers';
import { convertRowToUsd, extractFinancialRows, reportingBasis, type CompanyFacts } from '@/lib/ingestion/company-financials';
import { enrichStep, modeForHour } from '@/lib/ingestion/company-signals';

const subject = (id: string, name: string, extra: Partial<MatchSubject> = {}): MatchSubject => ({
  id, name, name_variations: null, country: null, ticker: null, cik: null, website_url: null, website_source: null,
  company_type: null, family_id: null, ...extra,
});

const entry = (e: Partial<ListingEntry> & Pick<ListingEntry, 'exchange' | 'ticker'>): ListingEntry => ({
  market: null, nameEn: null, nameLocal: null, listedAt: null, website: null, shares: null, cik: null, sourceUrl: 'https://example.com/list', ...e,
});

describe('name keys', () => {
  it('drops legal forms and trailing ownership clauses, keeps sector words', () => {
    expect(nameKey('Crinetics Pharmaceuticals, Inc.')).toBe('crinetics pharmaceuticals');
    expect(nameKey('NEUREN PHARMACEUTICALS LIMITED')).toBe('neuren pharmaceuticals');
    expect(nameKey('Juno Therapeutics, Inc., a subsidiary of Bristol Myers Squibb')).toBe('juno therapeutics');
    expect(nameKey('Acme Therapeutics')).not.toBe(nameKey('Acme Biosciences'));
  });

  it('requires a distinctive core', () => {
    expect(isDistinctiveKey('pharmaceuticals')).toBe(false);
    expect(isDistinctiveKey('bio labs')).toBe(false);
    expect(isDistinctiveKey('neuren pharmaceuticals')).toBe(true);
  });

  it('splits scripts and strips Chinese legal forms', () => {
    const k = companyKeys('Danatlas Pharmaceuticals Co., Ltd', ['北京丹擎医药科技有限公司']);
    expect(k.en.has('danatlas pharmaceuticals')).toBe(true);
    expect(k.cjk.has('北京丹擎医药科技')).toBe(true);
    expect(cjkKey('益方生物科技（上海）有限公司')).toBe(cjkKey('益方生物科技(上海)股份有限公司'));
  });

  it('agreement: equal cores, prefixes, containment, none', () => {
    expect(nameAgreement('LG Chem', 'LG Chem Life Sciences')).toBe(100);
    expect(nameAgreement('Genentech', 'Genentech Roche')).toBe(80);
    expect(nameAgreement('Kelun Pharmaceutical', 'Sichuan Kelun Pharmaceutical Co., Ltd.')).toBe(70);
    expect(nameAgreement('Fulcrum Therapeutics', 'Acceleron Pharma')).toBe(0);
  });

  it('domains: registrable, blocked aggregators dropped', () => {
    expect(urlDomain('www.gzboji.com')).toBe('gzboji.com');
    expect(urlDomain('https://ir.example.co.uk/path')).toBe('example.co.uk');
    expect(urlDomain('-')).toBeNull();
  });
});

describe('listing parsers', () => {
  it('CSV with quotes and preamble (ASX)', () => {
    const text = 'ASX listed companies as at Tue Nov 24 2026\n\nCompany name,ASX code,GICS industry group\n"NEUREN PHARMACEUTICALS LIMITED","NEU","Pharmaceuticals, Biotechnology & Life Sciences"\n';
    expect(parseCsv('a,"b ""q""",c')).toEqual([['a', 'b "q"', 'c']]);
    expect(parseAsxCsv(text)).toEqual([expect.objectContaining({ exchange: 'ASX', ticker: 'NEU', nameEn: 'NEUREN PHARMACEUTICALS LIMITED', market: 'Pharmaceuticals, Biotechnology & Life Sciences' })]);
  });

  it('Euronext semicolon CSV', () => {
    const text = '﻿Name;ISIN;Symbol;Market;Currency\n"European Equities"\n"24 Nov 2026"\n"x"\nADOCIA;FR0011184241;ADOC;"Euronext Paris";EUR\n';
    expect(parseEuronextCsv(text)).toEqual([expect.objectContaining({ exchange: 'EURONEXT', ticker: 'ADOC', nameEn: 'ADOCIA', market: 'Euronext Paris' })]);
  });

  it('SZSE rows, SSE JSON, TSX JSON, SEC tickers', () => {
    const szse = parseSzseRows([
      ['板块', '公司全称', '英文名称', '注册地址', 'A股代码', 'A股简称', 'A股上市日期', 'A股总股本', 'A股流通股本', 'B股代码', 'B股 简 称', 'B股上市日期', 'B股总股本', 'B股流通股本', '地      区', '省    份', '城     市', '所属行业', '公司网址'],
      ['创业板', '博济医药科技股份有限公司', 'Boji Medical Technology Co., Ltd.', '', '300404', '博济医药', '2015-04-24', '385,750,000', '', '', '', '', '', '', '', '', '', 'M', 'www.gzboji.com'],
    ]);
    expect(szse[0]).toMatchObject({ exchange: 'SZSE', ticker: '300404', nameLocal: '博济医药科技股份有限公司', listedAt: '2015-04-24', shares: 385750000, website: 'www.gzboji.com' });
    const sse = parseSseJson({ pageHelp: { data: [{ A_STOCK_CODE: '688336', FULL_NAME: '三生国健药业(上海)股份有限公司', FULL_NAME_IN_ENGLISH: 'Sunshine Guojian', LIST_DATE: '20200722', DELIST_DATE: '-' }] } }, 'STAR Market');
    expect(sse[0]).toMatchObject({ exchange: 'SSE', ticker: '688336', listedAt: '2020-07-22', market: 'STAR Market' });
    expect(parseTsxJson({ results: [{ symbol: 'CPH', name: 'Cipher Pharmaceuticals Inc.' }, { symbol: 'XBB', name: 'iShares Bond ETF' }] }, 'TSX')).toHaveLength(1);
    const sec = parseSecTickersExchange({ fields: ['cik', 'name', 'ticker', 'exchange'], data: [[1434265, 'Genmab A/S', 'GMAB', 'Nasdaq'], [1, 'X', 'XX', null]] });
    expect(sec).toEqual([expect.objectContaining({ exchange: 'NASDAQ', ticker: 'GMAB', cik: '1434265' })]);
  });

  it('KRX HTML table', () => {
    const html = '<table><tr><th>회사명</th><th>시장구분</th><th>종목코드</th><th>업종</th><th>주요제품</th><th>상장일</th><th>결산월</th><th>대표자명</th><th>홈페이지</th><th>지역</th></tr>'
      + '<tr><td>오스코텍</td><td>코스닥</td><td style="x">039200</td><td>의약품</td><td></td><td>2007-01-17</td><td>12월</td><td>윤태영</td><td>http://www.oscotec.com</td><td>경기도</td></tr></table>';
    expect(parseKrxHtml(html)).toEqual([expect.objectContaining({ exchange: 'KRX', ticker: '039200', nameLocal: '오스코텍', listedAt: '2007-01-17', website: 'http://www.oscotec.com' })]);
  });

  it('ticker suffixes', () => {
    expect(parseTickerSuffix('002422.SZ')).toEqual({ exchange: 'SZSE', code: '002422' });
    expect(parseTickerSuffix('CSL.AX')).toEqual({ exchange: 'ASX', code: 'CSL' });
    expect(parseTickerSuffix('UCB.BR')).toEqual({ exchange: 'EURONEXT', code: 'UCB' });
    expect(parseTickerSuffix('ASND')).toBeNull();
    expect(parseTickerSuffix('2696.HK')).toBeNull();
  });
});

describe('matchListings', () => {
  const entries: ListingEntry[] = [
    entry({ exchange: 'ASX', ticker: 'NEU', nameEn: 'NEUREN PHARMACEUTICALS LIMITED' }),
    entry({ exchange: 'SZSE', ticker: '300404', nameLocal: '博济医药科技股份有限公司', nameEn: 'Boji Medical Technology Co., Ltd.', website: 'www.gzboji.com' }),
    entry({ exchange: 'SZSE', ticker: '002422', nameLocal: '四川科伦药业股份有限公司', nameEn: 'Sichuan Kelun Pharmaceutical Co., Ltd.' }),
    entry({ exchange: 'TSX', ticker: 'ABC', nameEn: 'Acme Health Corp.' }),
    entry({ exchange: 'TSX', ticker: 'ABD', nameEn: 'Acme Health Inc.' }),
    entry({ exchange: 'NASDAQ', ticker: 'GMAB', nameEn: 'Genmab A/S', cik: '1434265' }),
  ];

  it('matches exact names, CJK names, tickers, CIKs and trusted domains', () => {
    const { matches } = matchListings([
      subject('a', 'Neuren Pharmaceuticals Limited'),
      subject('b', '博济医药科技股份有限公司'),
      subject('c', 'Kelun Pharmaceutical', { ticker: '002422.SZ' }),
      subject('d', 'Genmab', { cik: '0001434265' }),
      subject('e', 'Boji Medical', { website_url: 'https://www.gzboji.com', website_source: 'ctgov_contact' }),
      subject('f', 'Boji Medical Guess', { website_url: 'https://www.gzboji.com', website_source: 'domain_guess' }),
    ], entries);
    const by = Object.fromEntries(matches.map(m => [m.companyId, `${m.entry.exchange}:${m.entry.ticker}:${m.method}:${m.confidence}`]));
    expect(by).toEqual({
      a: 'ASX:NEU:exact_name_en:90',
      b: 'SZSE:300404:exact_name_cn:92',
      c: 'SZSE:002422:ticker:95',
      d: 'NASDAQ:GMAB:cik:98',
      e: 'SZSE:300404:website_domain:85',
    });
  });

  it('drops a key naming two issuers on one exchange, and a ticker whose name disagrees', () => {
    const { matches } = matchListings([
      subject('x', 'Acme Health'),
      subject('y', 'Unrelated Bio', { ticker: '002422.SZ' }),
    ], entries);
    expect(matches).toEqual([]);
  });

  it('drops an issuer claimed by many unrelated rows', () => {
    const subs = ['1', '2', '3', '4'].map(i => subject(i, `Neuren Pharmaceuticals`, { family_id: `fam${i}`, name_variations: [`row ${i}`] }));
    const r = matchListings(subs, entries);
    expect(r.matches).toEqual([]);
    expect(r.ambiguousIssuers).toBe(1);
  });

  it('builds a row with provenance', () => {
    const { matches } = matchListings([subject('a', 'Neuren Pharmaceuticals')], entries);
    const row = listingRow(matches[0], new Date('2026-11-24T00:00:00Z'));
    expect(row).toMatchObject({ company_id: 'a', exchange: 'ASX', ticker: 'NEU', source: 'exchange_list', source_id: 'ASX:NEU', listing_status: 'listed' });
    expect(row.source_url).toMatch(/^https:\/\//);
    expect(row.evidence).toContain('NEUREN');
  });
});

describe('NIH SBIR/STTR matching', () => {
  const p = (id: number, org: string, state: string, extra: Partial<NihProject> = {}): NihProject => ({
    appl_id: id, project_num: `1R43GM${id}-01`, fiscal_year: 2024, award_amount: 300000, award_notice_date: '2024-05-01T00:00:00',
    activity_code: 'R43', project_title: 'T', organization: { org_name: org, org_state: state }, ...extra,
  });

  it('matches exact names, skips multi-state keys and large pharma', () => {
    const subs = [subject('a', 'Vidasym, Inc.'), subject('b', 'Pfizer Inc.', { company_type: 'large_pharma' }), subject('c', 'Common Name Therapeutics')];
    const r = matchNihProjects(subs, [
      p(1, 'VIDASYM, INC.', 'SD'), p(2, 'VIDASYM INC', 'SD', { activity_code: 'R41' }),
      p(3, 'PFIZER INC', 'NY'),
      p(4, 'COMMON NAME THERAPEUTICS', 'CA'), p(5, 'COMMON NAME THERAPEUTICS LLC', 'TX'), p(6, 'Common Name Therapeutics', 'MA'),
    ], new Date('2026-11-24T00:00:00Z'));
    expect(r.rows.map(x => [x.company_id, x.award_id, x.program, x.resolution_confidence])).toEqual([['a', '1', 'nih_sbir', 92], ['a', '2', 'nih_sttr', 92]]);
    expect(r.skippedMultiState).toBe(1);
    expect(r.rows[0]).toMatchObject({ awarded_at: '2024-05-01', source_url: 'https://reporter.nih.gov/project-details/1', org_name: 'VIDASYM, INC.' });
  });

  it('award date falls back to project start, then the fiscal year start', () => {
    expect(awardDate({ fiscal_year: 2020, project_start_date: '2020-02-01T00:00:00' })).toBe('2020-02-01');
    expect(awardDate({ fiscal_year: 2020 })).toBe('2019-10-01');
  });

  it('backfills fiscal years, then refreshes the latest two', () => {
    const now = new Date('2026-11-24T00:00:00Z'); // FY2027
    expect(nihYearsToFetch(null, now, 6)).toEqual([2008, 2009, 2010, 2011, 2012, 2013]);
    expect(nihYearsToFetch(2025, now, 6)).toEqual([2025, 2026, 2027]);
    expect(nihYearsToFetch(2028, now, 6)).toEqual([2026, 2027]);
  });
});

describe('EDGAR filer index', () => {
  it('parses lookup lines with colons in names', () => {
    expect(parseCikLookupLine('ACUSPHERE INC:0001101854:')).toEqual({ name: 'ACUSPHERE INC', cik: '1101854' });
    expect(parseCikLookupLine('A:B HOLDINGS:0000000001:')).toEqual({ name: 'A:B HOLDINGS', cik: '1' });
    expect(parseCikLookupLine(':0001003197:')).toBeNull();
  });

  it('scans names against candidate keys', () => {
    const idx = candidateKeyIndex([
      { id: 'a', name: 'Acusphere', name_variations: null, company_type: null },
      { id: 'p', name: 'Pfizer Inc.', name_variations: null, company_type: 'large_pharma' },
    ]);
    const out = scanCikLookup(['ACUSPHERE INC:0001101854:', 'PFIZER INC:0000078003:', 'OTHER CO:0000000002:'], idx);
    expect([...out.entries()].map(([k, v]) => [k, [...v]])).toEqual([['a', ['1101854']]]);
  });

  const subs = (form: string[], dates: string[], sic: string | undefined, name = 'ACUSPHERE INC') => ({
    name, sic, filings: { recent: { form, filingDate: dates, accessionNumber: form.map((_, i) => `0000-${i}`), primaryDocument: form.map(f => (f === 'D' ? 'xslFormDX01/primary_doc.xml' : 'doc.htm')) } },
  });

  it('classifies health-care periodic filers, Form D filers and the rest', () => {
    const now = new Date('2026-11-24T00:00:00Z');
    const periodic = filerProfile(subs(['10-K', '10-Q', '4'], ['2016-03-01', '2016-11-01', '2017-01-10'], '2834'), '1101854');
    expect(periodic).toMatchObject({ health: true, periodicLast: '2016-11-01' });
    const d = decideFiler([periodic], ['Acusphere'], now);
    expect(d).toMatchObject({ kind: 'filer', active: false, nameAgrees: true });

    const formD = filerProfile(subs(['D', 'D/A'], ['2019-10-31', '2020-01-01'], undefined, 'Avenzoar Pharmaceuticals, Inc.'), '42');
    expect(formD.health).toBe(true);
    expect(formD.formD[0]).toMatchObject({ adsh: '0000-0', primaryDoc: 'primary_doc.xml', form: 'D' });

    const bank = filerProfile(subs(['10-K'], ['2026-03-01'], '6022'), '7');
    expect(decideFiler([bank], ['Acusphere'], now)).toEqual({ kind: 'none', reason: 'not a health-care filer' });
    expect(decideFiler([periodic, formD], ['Acusphere'], now)).toMatchObject({ kind: 'none' });

    const active = filerProfile(subs(['10-Q'], ['2026-08-01'], '2834', 'Vaxart, Inc.'), '9');
    expect(decideFiler([active], ['Aviragen Therapeutics'], now)).toMatchObject({ kind: 'filer', active: true, nameAgrees: false });
  });
});

describe('IFRS financials', () => {
  const facts: CompanyFacts = {
    cik: 1434265,
    entityName: 'Genmab A/S',
    facts: {
      'ifrs-full': {
        CashAndCashEquivalents: { units: { DKK: [
          { end: '2024-12-31', val: 10_000, accn: '0001-24', form: '20-F', filed: '2025-02-12', fp: 'FY' },
        ] } },
        CashFlowsFromUsedInOperatingActivities: { units: { DKK: [
          { start: '2024-01-01', end: '2024-12-31', val: -4_000, accn: '0001-24', form: '20-F', filed: '2025-02-12' },
        ] } },
      },
    },
  };

  it('picks IFRS and the reporting currency when US GAAP is absent', () => {
    expect(reportingBasis(facts)).toEqual({ taxonomy: 'ifrs-full', currency: 'DKK' });
    const rows = extractFinancialRows(facts, 'c1', '1434265');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fiscal_period_end: '2024-12-31', period_type: 'FY', cash_and_equivalents: 10_000, reporting_currency: 'DKK', fx_rate_to_usd: null, taxonomy: 'ifrs-full' });
  });

  it('converts amounts to USD and keeps runway', () => {
    const row = extractFinancialRows(facts, 'c1', '1434265')[0];
    const usd = convertRowToUsd({ ...row, quarterly_burn: 1000, runway_months: 30 }, 0.14);
    expect(usd).toMatchObject({ cash_and_equivalents: 1400, total_liquidity: 1400, quarterly_burn: 140, runway_months: 30, fx_rate_to_usd: 0.14 });
  });
});

describe('cron rotation', () => {
  it('enrich runs at 06 and 18', () => {
    expect(modeForHour(6)).toBe('enrich');
    expect(modeForHour(18)).toBe('enrich');
    expect(modeForHour(0)).toBe('financials');
  });

  it('enrich step: listings weekly, else EDGAR in the morning while pending, NIH in the evening', () => {
    const morning = new Date('2026-11-24T06:20:00Z');
    const evening = new Date('2026-11-24T18:20:00Z');
    expect(enrichStep({ listingsRunAt: null, edgarPending: 5 }, morning)).toBe('listings');
    expect(enrichStep({ listingsRunAt: '2026-11-23T06:20:00Z', edgarPending: 5 }, morning)).toBe('edgar_index');
    expect(enrichStep({ listingsRunAt: '2026-11-23T06:20:00Z', edgarPending: 0 }, morning)).toBe('nih_grants');
    expect(enrichStep({ listingsRunAt: '2026-11-23T06:20:00Z', edgarPending: 5 }, evening)).toBe('nih_grants');
    expect(enrichStep({ listingsRunAt: '2026-11-10T06:20:00Z', edgarPending: 5 }, evening)).toBe('listings');
  });
});

describe('migration 198', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/198_company_signals_v2.sql'), 'utf8');

  it('every new signal table carries provenance and confidence', () => {
    for (const t of ['company_listings', 'company_grants']) {
      const body = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1] ?? '';
      expect(body).toMatch(/source_url\s+text NOT NULL CHECK \(source_url ~ '\^https:\/\/'\)/);
      expect(body).toMatch(/evidence\s+text NOT NULL/);
      expect(body).toMatch(/resolution_confidence integer NOT NULL/);
    }
  });

  it('family roll-down is limited to financials and live listings', () => {
    const fn = /FUNCTION public\.company_signal_covered[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    const family = fn.slice(fn.indexOf('family_id IS NOT NULL'));
    expect(family).toContain('company_financials');
    expect(family).toContain("listing_status = 'listed'");
    expect(family).not.toContain('company_financing_events');
    expect(family).not.toContain('company_intent_signals');
    expect(family).not.toContain('company_grants');
  });

  it('patches the scorecard through company_signal_covered and fails loudly', () => {
    expect(sql).toContain("public.company_signal_covered(f.company_id)");
    expect(sql).toContain('RAISE EXCEPTION');
  });
});
