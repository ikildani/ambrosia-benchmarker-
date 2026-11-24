/**
 * Free company signals (migration 189): HKEX listing match and announcement rules, SEC Form D,
 * and the point-in-time candidate features. Fixtures only, no network.
 */
import {
  buildHkexIndex, classifyHkexAnnouncement, companyNameCores, coreIsDistinctive, dedupeRepeatedIntents, hkexAnnouncementRows,
  hkexMatchDue, hkexNameCore, hkexNameIsBare, hkexQuote, listedEquities, matchHkexIssuers, parseActiveStock,
  parseListOfSecuritiesSheet, staleHkexAssignments, titleStem, type HkexIntentRow, type HkexMatch, type HkexSecurity,
} from '@/lib/ingestion/hkex-signals';
import {
  formDDocUrl, formDEventRow, formDNameMatch, parseDisplayName, parseEftsFormDHits, parseFormDXml, pickFormDCik, type FormDHit,
} from '@/lib/ingestion/form-d';
import { decodeHtmlEntities, modeForHour, validFinancingRows, type FinancingEventRow } from '@/lib/ingestion/company-signals';
import {
  buildCandidateFeatures, buildFeatureVector, CANDIDATE_FEATURE_NAMES, emptyFeatureBundle, FEATURE_NAMES, vectorToRow,
  type FeatureAsset, type FeatureBundle,
} from '@/lib/radar/backtest/features';

// ═══════════════════════════════════════════════════════════════════════
// HKEX: List of Securities
// ═══════════════════════════════════════════════════════════════════════

const SHEET = `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>
<x:row r="1"><x:c r="A1" s="23" t="s"><x:v>2</x:v></x:c></x:row>
<x:row r="2"><x:c r="A2" t="str"><x:v>Updated as at 17/11/2026</x:v></x:c></x:row>
<x:row r="3"><x:c r="A3" t="str"><x:v>Stock Code</x:v></x:c><x:c r="B3" t="str"><x:v>Name of Securities</x:v></x:c><x:c r="C3" t="str"><x:v>Category</x:v></x:c><x:c r="D3" t="str"><x:v>Sub-Category</x:v></x:c></x:row>
<x:row r="4"><x:c r="A4" t="str"><x:v>01877</x:v></x:c><x:c r="B4" t="str"><x:v>JUNSHI BIO</x:v></x:c><x:c r="C4" t="str"><x:v>Equity</x:v></x:c><x:c r="D4" t="str"><x:v>Equity Securities (Main Board)</x:v></x:c><x:c r="E4" t="str"><x:v>200</x:v></x:c></x:row>
<x:row r="5"><x:c r="A5" t="str"><x:v>00950</x:v></x:c><x:c r="B5" t="str"><x:v>LEE&#x27;S PHARM</x:v></x:c><x:c r="C5" t="str"><x:v>Equity</x:v></x:c><x:c r="D5" t="str"><x:v>Equity Securities (Main Board)</x:v></x:c></x:row>
<x:row r="6"><x:c r="A6" t="str"><x:v>12345</x:v></x:c><x:c r="B6" t="str"><x:v>HS#JUNSHI RC2701A</x:v></x:c><x:c r="C6" t="str"><x:v>Callable Bull/Bear Contracts</x:v></x:c><x:c r="D6" t="str"><x:v></x:v></x:c></x:row>
<x:row r="7"><x:c r="A7" t="str"><x:v>08001</x:v></x:c><x:c r="B7" t="str"><x:v>ORIENT SEC INTL</x:v></x:c><x:c r="C7" t="str"><x:v>Equity</x:v></x:c><x:c r="D7" t="str"><x:v>Equity Securities (GEM)</x:v></x:c></x:row>
</x:sheetData></x:worksheet>`;

describe('HKEX List of Securities', () => {
  it('parses inline-string rows, skips header rows and decodes entities', () => {
    const rows = parseListOfSecuritiesSheet(SHEET);
    expect(rows.map(r => r.code)).toEqual(['01877', '00950', '12345', '08001']);
    expect(rows[1].name).toBe("LEE'S PHARM");
  });

  it('keeps Main Board and GEM equities only', () => {
    expect(listedEquities(parseListOfSecuritiesSheet(SHEET)).map(r => r.code)).toEqual(['01877', '00950', '08001']);
  });

  it('maps codes to HKEXnews stock ids', () => {
    const m = parseActiveStock([{ i: 209261, c: '01877', n: 'JUNSHI BIO' }, { c: 'x' }, null]);
    expect(m.get('01877')).toBe(209261);
    expect(m.size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HKEX: name cores and matching
// ═══════════════════════════════════════════════════════════════════════

describe('HKEX name cores', () => {
  it('drops sector abbreviations, share-class suffixes and glued sector words', () => {
    expect(hkexNameCore('JUNSHI BIO')).toBe('junshi');
    expect(hkexNameCore('JW THERAP-B')).toBe('jw');
    expect(hkexNameCore('EVEREST MED')).toBe('everest');
    expect(hkexNameCore('DUALITYBIO-B')).toBe('duality');
    expect(hkexNameCore('ZHAOKE OPHTH-B')).toBe('zhaoke');
  });

  it('keeps HKEX place names so "JIANGSU HORIZON" is not "horizon"', () => {
    expect(hkexNameCore('JIANGSU HORIZON')).toBe('jiangsu horizon');
  });

  it('indexes our names with and without leading places and parentheticals', () => {
    expect(companyNameCores('Innovent Biologics (Suzhou) Co. Ltd.')).toEqual(['innovent']);
    expect(companyNameCores('Shanghai Junshi Biosciences Co., Ltd.')).toEqual(['junshi', 'shanghai junshi']);
    expect(companyNameCores('Hutchmed')).toEqual(['hutch']);
  });

  it('knows bare brand names from names with extra words', () => {
    expect(hkexNameIsBare('HENLIUS')).toBe(true);
    expect(hkexNameIsBare('ZHONGSHENG HLDG')).toBe(false);
    expect(hkexNameIsBare('KANGHUA HEALTH')).toBe(false);
  });

  it('requires a life-sciences name or a bare 5+ letter brand', () => {
    const ref = (shortName: string) => buildHkexIndex([{ code: '00001', name: shortName, category: 'Equity', subCategory: 'Equity Securities (Main Board)' }]).byCore.get(hkexNameCore(shortName))![0];
    expect(coreIsDistinctive('junshi', ref('JUNSHI BIO'))).toBe(true);
    expect(coreIsDistinctive('henlius', ref('HENLIUS'))).toBe(true);
    expect(coreIsDistinctive('zhongsheng', ref('ZHONGSHENG HLDG'))).toBe(false);
    expect(coreIsDistinctive('rec', ref('RECBIO-B'))).toBe(false);
  });
});

const EQUITIES: HkexSecurity[] = [
  'JUNSHI BIO', 'HENLIUS', 'EVEREST MED', 'JIANGSU HORIZON', 'RAINMED-B', 'ZHONGSHENG HLDG', 'INNOVENT BIO', 'CLARITY MEDICAL',
].map((name, i) => ({ code: String(1000 + i).padStart(5, '0'), name, category: 'Equity', subCategory: 'Equity Securities (Main Board)' }));
const INDEX = buildHkexIndex(EQUITIES, new Map([['01000', 209261]]));

describe('matchHkexIssuers', () => {
  it('matches Greater China companies whose core is unique on both sides', () => {
    const res = matchHkexIssuers([
      { id: 'a', name: 'Shanghai Junshi Biosciences Co., Ltd.', country: 'CN' },
      { id: 'b', name: 'Shanghai Henlius', country: 'China' },
      { id: 'c', name: 'Everest Medicines', country: 'HK' },
    ], INDEX);
    expect(res.matches.map(m => [m.companyId, m.code, m.method])).toEqual([['a', '01000', 'name_core'], ['b', '01001', 'name_core'], ['c', '01002', 'name_core']]);
    expect(res.matches[0].stockId).toBe(209261);
  });

  it('never matches by name outside Greater China (the dry-run false positives)', () => {
    const res = matchHkexIssuers([
      { id: 'h', name: 'Horizon Therapeutics', country: 'US' },
      { id: 'cl', name: 'Clarity Pharmaceuticals Ltd', country: 'AU' },
    ], INDEX);
    expect(res.matches).toEqual([]);
  });

  it('rejects unknown-country short cores and hint-less names with extra words', () => {
    const res = matchHkexIssuers([
      { id: 'r', name: 'Rain Therapeutics', country: null },
      { id: 'z', name: 'Guangdong Zhongsheng Pharmaceutical Co., Ltd.', country: 'CN' },
    ], INDEX);
    expect(res.matches).toEqual([]);
  });

  it('skips a core shared by two of our companies', () => {
    const res = matchHkexIssuers([
      { id: 'i1', name: 'Innovent Biologics', country: 'CN' },
      { id: 'i2', name: 'Innovent Biologics (Suzhou) Co. Ltd.', country: 'CN' },
    ], INDEX);
    expect(res.matches).toEqual([]);
    expect(res.ambiguous).toBe(2);
  });

  it('applies the hand-checked map first and never reassigns its code', () => {
    const verified: HkexMatch[] = [{ companyId: 'i1', companyName: 'Innovent Biologics', code: '01006', shortName: 'INNOVENT BIO', stockId: 202911, core: 'innovent', method: 'verified_map' }];
    const res = matchHkexIssuers([
      { id: 'i1', name: 'Innovent Biologics', country: 'CN' },
      { id: 'i2', name: 'Innovent Biologics (Suzhou) Co. Ltd.', country: 'CN' },
    ], INDEX, verified);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0]).toMatchObject({ companyId: 'i1', code: '01006', method: 'verified_map' });
  });

  it('clears stale name-core holders, never verified ones', () => {
    const current = [
      { id: 'a', hkex_stock_code: '01000', hkex_match_method: 'name_core' },
      { id: 'b', hkex_stock_code: '01001', hkex_match_method: 'name_core' },
      { id: 'v', hkex_stock_code: '01006', hkex_match_method: 'verified_map' },
      { id: 'n', hkex_stock_code: null, hkex_match_method: null },
    ];
    const matches = [{ companyId: 'a', code: '01000' }] as HkexMatch[];
    expect(staleHkexAssignments(current, matches)).toEqual(['b']);
  });

  it('runs the listing match weekly', () => {
    const now = new Date('2026-11-17T00:00:00Z');
    expect(hkexMatchDue(undefined, now)).toBe(true);
    expect(hkexMatchDue('2026-11-12T00:00:00Z', now)).toBe(false);
    expect(hkexMatchDue('2026-11-09T00:00:00Z', now)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HKEX: announcement rules
// ═══════════════════════════════════════════════════════════════════════

const kinds = (title: string, cat = '') => {
  const c = classifyHkexAnnouncement(title, cat);
  return [c.financing ? `financing:${c.financing}` : null, ...c.intents.map(i => i.type)].filter(Boolean);
};

describe('classifyHkexAnnouncement', () => {
  it('classifies placings, subscriptions and rights issues, not their completions', () => {
    expect(kinds('PLACING OF NEW H SHARES UNDER GENERAL MANDATE', 'Announcements and Notices - [Placing / Issue of Shares under a General Mandate]')).toEqual(['financing:placing']);
    expect(kinds('SUBSCRIPTIONS OF NEW SHARES UNDER GENERAL MANDATE')).toEqual(['financing:share_subscription']);
    expect(kinds('PROPOSED RIGHTS ISSUE ON THE BASIS OF ONE RIGHTS SHARE FOR EVERY TWO SHARES')).toEqual(['financing:rights_issue']);
    expect(kinds('COMPLETION OF PLACING OF NEW SHARES UNDER GENERAL MANDATE')).toEqual([]);
    expect(kinds('(1) COMPLETION OF SUBSCRIPTION OF NEW SHARES UNDER GENERAL MANDATE; (2) CONTINUING CONNECTED TRANSACTION')).toEqual([]);
    expect(kinds('INSIDE INFORMATION CHANGE IN USE OF PROCEEDS FROM 2023 PLACING')).toEqual([]);
  });

  it('ignores treasury products the issuer buys', () => {
    expect(kinds('DISCLOSEABLE TRANSACTIONS - SUBSCRIPTION OF WEALTH MANAGEMENT PRODUCTS')).toEqual([]);
  });

  it('records a share issue that rides on a collaboration as both events', () => {
    expect(kinds('GLOBAL STRATEGIC COLLABORATION WITH TAKEDA AND ISSUE OF SHARES UNDER GENERAL MANDATE')).toEqual(['financing:share_subscription', 'licensing_agreement']);
  });

  it('classifies new licensing deals but not payments, regulatory licenses or intra-group agreements', () => {
    expect(kinds('INSIDE INFORMATION ANNOUNCEMENT - ENTERING INTO EXCLUSIVE GLOBAL LICENSE AGREEMENT WITH ROCHE FOR NOVEL DLL3 ADC')).toEqual(['licensing_agreement']);
    expect(kinds('INSIDE INFORMATION LICENCE AND COLLABORATION AGREEMENT WITH ASTRAZENECA FOR PAN-KRAS INHIBITOR JAB-23E73')).toEqual(['licensing_agreement']);
    expect(kinds('Voluntary Announcement - Entering into Exclusive License-out and Supply Agreement with Ashlins')).toEqual(['licensing_agreement']);
    expect(kinds('VOLUNTARY ANNOUNCEMENT - RECEIPT OF US$30 MILLION UPFRONT PAYMENT UNDER THE COLLABORATION, OPTION AND LICENSE AGREEMENT WITH ASTRAZENECA')).toEqual([]);
    expect(kinds('VOLUNTARY ANNOUNCEMENT JACOBIO RECEIVED $100 MILLION UPFRONT PAYMENT FROM ASTRAZENECA UNDER THE LICENSE AND COOPERATION AGREEMENT')).toEqual([]);
    expect(kinds('VOLUNTARY ANNOUNCEMENT - ACCEPTANCE OF BIOLOGIC LICENSE APPLICATION OF USTEKINUMAB INJECTION')).toEqual([]);
    expect(kinds('CONTINUING CONNECTED TRANSACTIONS: BUSINESS COLLABORATION AGREEMENT')).toEqual([]);
  });

  it('keeps a licensing termination', () => {
    const c = classifyHkexAnnouncement('TERMINATION OF THE EXCLUSIVE LICENSE AGREEMENT WITH PARTNER X');
    expect(c.intents).toEqual([expect.objectContaining({ type: 'licensing_agreement', stance: expect.stringMatching(/terminated/) })]);
  });

  it('separates profit warnings from positive profit alerts', () => {
    expect(kinds('PROFIT WARNING', 'Announcements and Notices - [Profit Warning / Inside Information]')).toEqual(['profit_warning']);
    expect(kinds('POSITIVE PROFIT ALERT', 'Announcements and Notices - [Profit Warning / Inside Information]')).toEqual([]);
  });

  it('classifies spin-offs and possible disposals as strategic review, not their updates', () => {
    const c = classifyHkexAnnouncement('PROPOSED SPIN-OFF AND SEPARATE LISTING OF XUANZHU BIOPHARM ON THE MAIN BOARD');
    expect(c.intents).toEqual([expect.objectContaining({ type: 'strategic_review', polarity: 'bullish', confidence: 65 })]);
    expect(kinds('POSSIBLE DISPOSAL OF A SUBSIDIARY')).toEqual(['strategic_review']);
    expect(kinds('UPDATE ON THE PROPOSED SPIN-OFF AND SEPARATE LISTING OF XUANZHU BIOPHARM')).toEqual([]);
  });

  it('classifies major transactions once', () => {
    expect(kinds('MAJOR TRANSACTION IN RELATION TO THE DISPOSAL OF 45% EQUITY INTEREST IN SHANGHAI HUTCHISON PHARMACEUTICALS LIMITED')).toEqual(['major_transaction']);
    expect(kinds('MAJOR TRANSACTION IN RELATION TO THE DISPOSAL OF 45% EQUITY INTEREST - TIMING OF DISPATCH OF CIRCULAR')).toEqual([]);
  });

  it('classifies executive changes, CFO and CBO separately, and ignores board-only changes', () => {
    const cat = 'Announcements and Notices - [Change in Directors or of Important Executive Functions or Responsibilities]';
    expect(kinds('CHANGE OF CHIEF EXECUTIVE OFFICER', cat)).toEqual(['executive_change']);
    expect(kinds('CHANGE OF CHIEF FINANCIAL OFFICER', cat)).toEqual(['cfo_cbo_change']);
    expect(kinds('VOLUNTARY ANNOUNCEMENT - APPOINTMENT OF CHIEF BUSINESS OFFICER')).toEqual(['cfo_cbo_change']);
    expect(kinds('RESIGNATION OF NON-EXECUTIVE DIRECTOR AND APPOINTMENT OF NON-EXECUTIVE DIRECTOR', cat)).toEqual([]);
    expect(kinds('CHANGE IN COMPOSITION OF NOMINATION COMMITTEE', cat)).toEqual([]);
    expect(kinds('(1) POLL RESULTS OF THE 2025 ANNUAL GENERAL MEETING (2) APPOINTMENT OF DIRECTORS', cat)).toEqual([]);
  });

  it('produces nothing for routine notices', () => {
    expect(kinds('Monthly Return of Equity Issuer on Movements in Securities for the month ended 31 October 2026')).toEqual([]);
    expect(kinds('VOLUNTARY ANNOUNCEMENT - ZYBRIVO (SINTILIMAB) RECEIVES POSITIVE CHMP OPINION')).toEqual([]);
  });
});

describe('HKEX rows', () => {
  const ann = {
    newsId: '12414967', dateTime: '22/10/2025 07:44', url: 'https://www1.hkexnews.hk/listedco/listconews/sehk/2025/1022/2025102200017.pdf',
    title: 'GLOBAL STRATEGIC COLLABORATION WITH TAKEDA AND ISSUE OF SHARES UNDER\nGENERAL MANDATE', category: 'Announcements and Notices - [Other - Business Update]',
  };

  it('stores the verbatim title, the document URL and the release date', () => {
    const r = hkexAnnouncementRows('co', ann, new Date('2026-11-17T00:00:00Z'));
    expect(r.financing).toMatchObject({ event_type: 'share_subscription', announced_at: '2025-10-22', source: 'hkex_announcement', source_id: '12414967', source_url: ann.url, amount_usd: null });
    expect(r.financing!.evidence).toBe('GLOBAL STRATEGIC COLLABORATION WITH TAKEDA AND ISSUE OF SHARES UNDER GENERAL MANDATE');
    expect(r.intents).toEqual([expect.objectContaining({ signal_type: 'licensing_agreement', source_type: 'hkex_announcement', observed_at: '2025-10-22', model: 'rules:hkex-title-v1' })]);
    expect(r.intents[0].confidence).toBeGreaterThanOrEqual(0);
    expect(r.intents[0].confidence).toBeLessThanOrEqual(100);
  });

  it('writes nothing without a date or URL', () => {
    expect(hkexAnnouncementRows('co', { ...ann, url: '' })).toEqual({ financing: null, intents: [] });
    expect(hkexAnnouncementRows('co', { ...ann, dateTime: 'n/a' })).toEqual({ financing: null, intents: [] });
  });

  it('decodes entities and fits quotes into 400 characters at a word boundary', () => {
    expect(hkexQuote('INNOVENT&#x27;S PARTNER&#x3b; A&#x2f;B')).toBe("INNOVENT'S PARTNER; A/B");
    const long = hkexQuote('WORD '.repeat(120));
    expect(long.length).toBeLessThanOrEqual(400);
    expect(long.endsWith('WORD')).toBe(true);
  });

  it('keeps the first of repeated notices about one event, but every licensing deal', () => {
    const row = (observed_at: string, signal_type: HkexIntentRow['signal_type'], quote: string): HkexIntentRow => ({
      company_id: 'co', signal_type, polarity: 'neutral', stance: '', quote, source_type: 'hkex_announcement', source_id: observed_at,
      source_url: 'https://x', observed_at, confidence: 80, model: 'rules', fetched_at: '',
    });
    const out = dedupeRepeatedIntents([
      row('2025-03-02', 'strategic_review', 'PROPOSED SPIN-OFF OF MANDI INC. - SUPPLEMENTAL'),
      row('2025-01-10', 'strategic_review', 'PROPOSED SPIN-OFF OF MANDI INC.'),
      row('2025-02-01', 'licensing_agreement', 'EXCLUSIVE LICENSE AGREEMENT WITH A'),
      row('2025-02-02', 'licensing_agreement', 'EXCLUSIVE LICENSE AGREEMENT WITH A'),
    ]);
    expect(out.map(r => `${r.signal_type}@${r.observed_at}`)).toEqual(['strategic_review@2025-01-10', 'licensing_agreement@2025-02-01', 'licensing_agreement@2025-02-02']);
    expect(titleStem('VOLUNTARY ANNOUNCEMENT - PROPOSED SPIN-OFF OF MANDI INC. - SUPPLEMENTAL')).toBe('proposed spin off of mandi inc');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SEC Form D
// ═══════════════════════════════════════════════════════════════════════

const OLLIN_XML = `<?xml version="1.0"?>
<edgarSubmission>
  <schemaVersion>X0708</schemaVersion>
  <submissionType>D</submissionType>
  <primaryIssuer>
    <cik>0002141184</cik>
    <entityName>Ollin Biosciences, Inc.</entityName>
    <issuerAddress><city>AUSTIN</city><stateOrCountry>TX</stateOrCountry></issuerAddress>
  </primaryIssuer>
  <offeringData>
    <industryGroup><industryGroupType>Biotechnology</industryGroupType></industryGroup>
    <typeOfFiling>
      <newOrAmendment><isAmendment>false</isAmendment></newOrAmendment>
      <dateOfFirstSale><value>2026-05-14</value></dateOfFirstSale>
    </typeOfFiling>
    <offeringSalesAmounts>
      <totalOfferingAmount>330000000</totalOfferingAmount>
      <totalAmountSold>156249990</totalAmountSold>
      <totalRemaining>173750010</totalRemaining>
    </offeringSalesAmounts>
  </offeringData>
</edgarSubmission>`;

const EFTS = {
  hits: { hits: [
    { _id: '0002141184-26-000002:primary_doc.xml', _source: { adsh: '0002141184-26-000002', display_names: ['Ollin Biosciences, Inc.  (CIK 0002141184)'], form: 'D', file_date: '2026-06-24' } },
    { _id: '0001111111-25-000001:primary_doc.xml', _source: { adsh: '0001111111-25-000001', display_names: ['Ollin Biosciences Fund I, LP  (CIK 0001111111)'], form: 'D', file_date: '2025-01-02' } },
    { _id: '0002141184-25-000009:x.htm', _source: { adsh: '0002141184-25-000009', display_names: ['Ollin Biosciences, Inc.  (CIK 0002141184)'], form: '8-K', file_date: '2025-03-02' } },
  ] },
};

describe('Form D', () => {
  it('parses display names, with and without tickers', () => {
    expect(parseDisplayName('Ollin Biosciences, Inc.  (CIK 0002141184)')).toEqual({ name: 'Ollin Biosciences, Inc.', cik: '2141184', tickers: [] });
    expect(parseDisplayName('EAGLE PHARMACEUTICALS, INC.  (EGRX)  (CIK 0000827871)')).toEqual({ name: 'EAGLE PHARMACEUTICALS, INC.', cik: '827871', tickers: ['EGRX'] });
    expect(parseDisplayName('no cik here')).toBeNull();
  });

  it('keeps D and D/A hits only', () => {
    const hits = parseEftsFormDHits(EFTS);
    expect(hits.map(h => [h.cik, h.form, h.fileDate])).toEqual([['2141184', 'D', '2026-06-24'], ['1111111', 'D', '2025-01-02']]);
  });

  it('matches names conservatively', () => {
    expect(formDNameMatch('Ollin Biosciences, Inc.', ['Ollin Biosciences'])).toBe('exact');
    expect(formDNameMatch('Orna Therapeutics Holdings, LLC', ['Orna Therapeutics'])).toBe('exact');
    expect(formDNameMatch('Ollin Biosciences Fund I, LP', ['Ollin Biosciences'])).toBeNull();
    expect(formDNameMatch('Acme Bio, Inc.', ['Acme Therapeutics'])).toBeNull();
    expect(formDNameMatch('Kinnate Pharma Inc', ['Kinnate Biopharma'])).toBe('strict');
    expect(formDNameMatch('Orna Bio Inc', ['Orna Therapeutics'])).toBeNull();
  });

  it('picks a CIK only when exactly one filer matches', () => {
    const hits = parseEftsFormDHits(EFTS);
    expect(pickFormDCik(hits, ['Ollin Biosciences, Inc.'])).toMatchObject({ cik: '2141184', method: 'exact' });
    const twin: FormDHit = { ...hits[0], cik: '9999999', adsh: '0009999999-24-000001' };
    expect(pickFormDCik([...hits, twin], ['Ollin Biosciences, Inc.'])).toBeNull();
  });

  it('parses primary_doc.xml', () => {
    expect(parseFormDXml(OLLIN_XML)).toMatchObject({
      submissionType: 'D', entityName: 'Ollin Biosciences, Inc.', cik: '2141184', stateOrCountry: 'TX', industryGroupType: 'Biotechnology',
      dateOfFirstSale: '2026-05-14', isAmendment: false, totalOfferingAmount: 330000000, totalAmountSold: 156249990, totalOfferingIndefinite: false,
    });
    expect(parseFormDXml('<html/>')).toBeNull();
    const indefinite = parseFormDXml(OLLIN_XML.replace('<totalOfferingAmount>330000000', '<totalOfferingAmount>Indefinite'))!;
    expect(indefinite.totalOfferingAmount).toBeNull();
    expect(indefinite.totalOfferingIndefinite).toBe(true);
  });

  it('builds an event keyed on the filing date with the filed values as evidence', () => {
    const hit = parseEftsFormDHits(EFTS)[0];
    const row = formDEventRow('co', ['Ollin Biosciences'], hit, parseFormDXml(OLLIN_XML)!, new Date('2026-11-17T00:00:00Z'))!;
    expect(row).toMatchObject({
      event_type: 'form_d', amount_usd: 156249990, amount_offered_usd: 330000000, announced_at: '2026-06-24', source: 'sec_form_d',
      source_id: '0002141184-26-000002', filer_cik: '2141184', industry_group: 'Biotechnology',
      source_url: 'https://www.sec.gov/Archives/edgar/data/2141184/000214118426000002/primary_doc.xml',
    });
    expect(row.metadata.date_of_first_sale).toBe('2026-05-14');
    expect(row.evidence).toBe('Form D filed 2026-06-24 by "Ollin Biosciences, Inc." (CIK 0002141184); industryGroupType Biotechnology; dateOfFirstSale 2026-05-14; totalOfferingAmount 330000000; totalAmountSold 156249990');
  });

  it('rejects other industries, other filer names, and marks amendments', () => {
    const hit = parseEftsFormDHits(EFTS)[0];
    const realEstate = parseFormDXml(OLLIN_XML.replace('Biotechnology', 'REITS and Finance'))!;
    expect(formDEventRow('co', ['Ollin Biosciences'], hit, realEstate)).toBeNull();
    expect(formDEventRow('co', ['Someone Else Therapeutics'], hit, parseFormDXml(OLLIN_XML)!)).toBeNull();
    const amended = formDEventRow('co', ['Ollin Biosciences'], { ...hit, form: 'D/A' }, parseFormDXml(OLLIN_XML)!)!;
    expect(amended.event_type).toBe('form_d_amendment');
    expect(formDDocUrl('0002141184', '0002141184-26-000002')).toBe('https://www.sec.gov/Archives/edgar/data/2141184/000214118426000002/primary_doc.xml');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Shared helpers and cron rotation
// ═══════════════════════════════════════════════════════════════════════

describe('company-signals helpers', () => {
  it('decodes HTML entities', () => {
    expect(decodeHtmlEntities('R&amp;D &#x2f; A&#39;s &quot;x&quot; &bogus;')).toBe('R&D / A\'s "x" &bogus;');
  });

  it('drops financing rows without evidence, an https source or a date', () => {
    const base: FinancingEventRow = {
      company_id: 'c', event_type: 'placing', amount_usd: null, amount_offered_usd: null, currency: 'HKD', announced_at: '2025-06-26',
      source: 'hkex_announcement', source_url: 'https://www1.hkexnews.hk/x.pdf', source_id: '1', evidence: 'PLACING OF NEW SHARES', industry_group: null,
      filer_cik: null, metadata: {}, fetched_at: '',
    };
    expect(validFinancingRows([base, { ...base, evidence: ' ' }, { ...base, source_url: 'http://x' }, { ...base, announced_at: '26/06/2025' }])).toEqual([base]);
  });

  it('rotates the unparameterized cron run by UTC hour', () => {
    expect([0, 12].map(modeForHour)).toEqual(['financials', 'financials']);
    expect([6, 18].map(modeForHour)).toEqual(['enrich', 'enrich']);
    expect([2, 8, 14, 20].map(modeForHour)).toEqual(['hkex', 'hkex', 'hkex', 'hkex']);
    expect([4, 10, 16, 22].map(modeForHour)).toEqual(['form_d', 'form_d', 'form_d', 'form_d']);
    expect(modeForHour(3)).toBe('financials');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Candidate features (point-in-time)
// ═══════════════════════════════════════════════════════════════════════

const ASSET: FeatureAsset = {
  id: 'a1', company_id: 'c1', company_name: 'Acme', asset_name: 'AC-1', phase: 'phase_2', therapeutic_area: 'oncology',
  indication_category: null, modality: 'antibody', partnership_status: 'unpartnered', nct_ids: [], first_posted_date: '2020-01-01', owner_type: 'industry',
};

function bundle(extra: Partial<FeatureBundle> = {}): FeatureBundle {
  return { ...emptyFeatureBundle(ASSET), financingEvents: [], listing: null, ...extra };
}

describe('candidate company-signal features', () => {
  const asOf = new Date('2025-07-01T00:00:00Z');
  const ev = (announced_at: string, event_type = 'form_d', amount_usd: number | null = null) => ({
    event_type, amount_usd, announced_at, source: 'sec_form_d', source_url: `https://www.sec.gov/${announced_at}`, evidence: `Form D filed ${announced_at}`,
  });

  it('are not part of the trained feature set', () => {
    for (const n of CANDIDATE_FEATURE_NAMES) expect(FEATURE_NAMES).not.toContain(n);
    const v = buildFeatureVector(bundle({ financingEvents: [ev('2025-01-01', 'form_d', 5e6)] }), asOf);
    expect(vectorToRow(v)).toHaveLength(FEATURE_NAMES.length);
    expect(v.values.months_since_last_financing).toBeCloseTo(6, 0);
  });

  it('use only financings public on or before the snapshot date, and skip amendments in counts', () => {
    const f = buildCandidateFeatures(bundle({ financingEvents: [
      ev('2025-09-01', 'form_d', 50e6),          // after asOf: invisible
      ev('2025-03-01', 'form_d_amendment', 20e6), // amendment: size yes, count no
      ev('2024-01-01', 'form_d', 10e6),
      ev('2022-01-01', 'placing'),               // outside 24 months
    ] }), asOf);
    expect(f.financing_count_24m).toBe(1);
    expect(f.months_since_last_financing).toBeCloseTo(18, 0);
    expect(f.log_last_financing_usd).toBeCloseTo(Math.log1p(20), 2);
  });

  it('caps months since the last financing at 36 and is null without any', () => {
    expect(buildCandidateFeatures(bundle({ financingEvents: [ev('2019-01-01')] }), asOf).months_since_last_financing).toBe(36);
    const none = buildCandidateFeatures(bundle(), asOf);
    expect(none.months_since_last_financing).toBeNull();
    expect(none.financing_count_24m).toBe(0);
    expect(none.log_last_financing_usd).toBeNull();
  });

  it('are null, not zero, when the financing table failed to load', () => {
    const f = buildCandidateFeatures({ ...bundle(), sourceErrors: { company_financing_events: 'relation does not exist' } }, asOf);
    expect(f.financing_count_24m).toBeNull();
    expect(f.months_since_last_financing).toBeNull();
  });

  it('flag listed companies point-in-time', () => {
    const filed = bundle({ financials: [{ fiscal_period_end: '2024-12-31', filed_at: '2025-03-01' }] });
    expect(buildCandidateFeatures(filed, asOf).listed_public).toBe(1);
    expect(buildCandidateFeatures(filed, new Date('2025-01-15T00:00:00Z')).listed_public).toBe(0); // 10-K not yet filed
    expect(buildCandidateFeatures(bundle({ listing: { hkex_stock_code: '01877' } }), asOf).listed_public).toBe(1);
    const inactive = bundle({ listing: { sec_inactive_cik: '1060736', sec_last_10k_at: '2023-02-15' } });
    expect(buildCandidateFeatures(inactive, new Date('2023-06-01T00:00:00Z')).listed_public).toBe(1);
    expect(buildCandidateFeatures(inactive, asOf).listed_public).toBe(0);
  });

  it('flag recent licensing or strategic review and distress from intent signals', () => {
    const sig = (signal_type: string, observed_at: string) => ({ signal_type, polarity: 'neutral', observed_at, quote: signal_type, source_url: 'https://x' });
    const f = buildCandidateFeatures(bundle({ intentSignals: [sig('licensing_agreement', '2025-02-01'), sig('profit_warning', '2023-02-01')] }), asOf);
    expect(f.licensing_or_review_12m).toBe(1);
    expect(f.distress_12m).toBe(0); // older than 12 months
    const later = buildCandidateFeatures(bundle({ intentSignals: [sig('profit_warning', '2025-08-01')] }), asOf);
    expect(later.distress_12m).toBe(0); // after asOf
    expect(buildCandidateFeatures(bundle(), asOf, { going_concern: 1 }).distress_12m).toBe(1);
  });
});
