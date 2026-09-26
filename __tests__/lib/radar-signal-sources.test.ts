/**
 * Unit tests for the Phase 3 Workstream C signal sources:
 *   lib/ingestion/company-financials.ts  burn / runway math, going-concern
 *                                        and ATM detection, CIK matching
 *   lib/ingestion/management-intent.ts   rubric output validation with a
 *                                        fake SDK client, quote verbatim rule
 *   lib/ingestion/patents-assignee.ts    patent -> drug linking, CPC filter
 *   lib/ingestion/catalysts.ts           derivation, date parsing, dedupe
 * No network, no Supabase.
 */

import {
  buildCikIndex,
  computeBurnAndRunway,
  deriveQuarterlyFlows,
  detectAtmOrShelf,
  detectGoingConcern,
  extractFinancialRows,
  latestPeriodicFiling,
  listRecentFilings,
  matchCikEntry,
  normalizeCompanyKey,
  stripSecTitleNoise,
  padCik,
  type CompanyFacts,
  type FilingRef,
  type Submissions,
  type SubmissionsRecent,
  type XbrlFact,
} from '@/lib/ingestion/company-financials';

import {
  INTENT_BATCH_SIZE,
  INTENT_MODEL,
  classifyParagraphs,
  extractIntentParagraphs,
  htmlToText,
  parseIntentResponse,
  quoteIsVerbatim,
  toIntentRows,
  usageCostUsd,
  validateSignals,
  type IntentClient,
} from '@/lib/ingestion/management-intent';

import {
  assigneeQueryName,
  buildPatentsViewQuery,
  cpcCodesOf,
  isPharmaCpc,
  linkPatentToDrug,
  patentAliasKeys,
  toPatentRow,
  type PatentsViewPatent,
} from '@/lib/ingestion/patents-assignee';

import {
  dedupeCatalysts,
  derivePhaseTransitions,
  derivePressCatalysts,
  deriveTrialCatalysts,
  matchAssetInText,
  parseDateFromText,
  readoutResolvesCompletion,
  type CatalystAsset,
  type CatalystPress,
  type CatalystTrial,
} from '@/lib/ingestion/catalysts';

// ═══════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════

const COMPANY_ID = '11111111-1111-1111-1111-111111111111';
const CIK = '1682852';

function fact(partial: Partial<XbrlFact> & { end: string; val: number }): XbrlFact {
  return { accn: '0001-25-000001', form: '10-Q', filed: '2025-08-01', fy: 2025, fp: 'Q2', ...partial };
}

/** Year-to-date OCF facts like companyfacts emits them, plus balance-sheet instants. */
function companyFactsFixture(): CompanyFacts {
  const ocf: XbrlFact[] = [
    // FY2024 annual (10-K) and its 9-month YTD from the Q3 10-Q
    fact({ start: '2024-01-01', end: '2024-12-31', val: -120_000_000, form: '10-K', fp: 'FY', filed: '2025-03-01', accn: '0001-25-000010' }),
    fact({ start: '2024-01-01', end: '2024-09-30', val: -90_000_000, form: '10-Q', fp: 'Q3', filed: '2024-11-01' }),
    fact({ start: '2024-01-01', end: '2024-06-30', val: -55_000_000, form: '10-Q', fp: 'Q2', filed: '2024-08-01' }),
    fact({ start: '2024-01-01', end: '2024-03-31', val: -25_000_000, form: '10-Q', fp: 'Q1', filed: '2024-05-01' }),
    // FY2025: Q1 direct, H1 YTD
    fact({ start: '2025-01-01', end: '2025-03-31', val: -30_000_000, form: '10-Q', fp: 'Q1', filed: '2025-05-01', accn: '0001-25-000020' }),
    fact({ start: '2025-01-01', end: '2025-06-30', val: -66_000_000, form: '10-Q', fp: 'Q2', filed: '2025-08-01', accn: '0001-25-000030' }),
  ];
  const cash: XbrlFact[] = [
    fact({ end: '2024-12-31', val: 200_000_000, form: '10-K', fp: 'FY', filed: '2025-03-01', accn: '0001-25-000010' }),
    fact({ end: '2025-03-31', val: 170_000_000, form: '10-Q', fp: 'Q1', filed: '2025-05-01', accn: '0001-25-000020' }),
    fact({ end: '2025-06-30', val: 140_000_000, form: '10-Q', fp: 'Q2', filed: '2025-08-01', accn: '0001-25-000030' }),
  ];
  const sti: XbrlFact[] = [
    fact({ end: '2025-06-30', val: 40_000_000, form: '10-Q', fp: 'Q2', filed: '2025-08-01', accn: '0001-25-000030' }),
  ];
  const ni: XbrlFact[] = [
    fact({ start: '2025-04-01', end: '2025-06-30', val: -38_000_000, form: '10-Q', fp: 'Q2', filed: '2025-08-01', accn: '0001-25-000030' }),
  ];
  const shares: XbrlFact[] = [
    fact({ end: '2025-07-31', val: 50_000_000, form: '10-Q', fp: 'Q2', filed: '2025-08-01', accn: '0001-25-000030' }),
  ];
  return {
    cik: Number(CIK),
    entityName: 'Acme Therapeutics, Inc.',
    facts: {
      'us-gaap': {
        CashAndCashEquivalentsAtCarryingValue: { units: { USD: cash } },
        ShortTermInvestments: { units: { USD: sti } },
        NetCashProvidedByUsedInOperatingActivities: { units: { USD: ocf } },
        NetIncomeLoss: { units: { USD: ni } },
      },
      dei: {
        EntityCommonStockSharesOutstanding: { units: { shares } },
      },
    },
  };
}

function submissionsFixture(overrides: Partial<SubmissionsRecent> = {}): Submissions {
  return {
    cik: padCik(CIK),
    filings: {
      recent: {
        accessionNumber: ['0001-25-000030', '0001-25-000025', '0001-25-000020', '0001-24-000099'],
        filingDate: ['2025-08-01', '2025-06-15', '2025-05-01', '2024-03-01'],
        form: ['10-Q', '424B5', '10-Q', 'S-3'],
        primaryDocument: ['acme-10q.htm', 'acme-424b5.htm', 'acme-10q.htm', 'acme-s3.htm'],
        ...overrides,
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPANY FINANCIALS
// ═══════════════════════════════════════════════════════════════════════

describe('company-financials: quarterly de-cumulation', () => {
  it('turns YTD cash-flow facts into discrete quarters', () => {
    const q = deriveQuarterlyFlows(companyFactsFixture().facts!['us-gaap']!.NetCashProvidedByUsedInOperatingActivities.units!.USD);
    const byEnd = Object.fromEntries(q.map(x => [x.end, x]));
    expect(byEnd['2024-03-31'].value).toBe(-25_000_000);
    expect(byEnd['2024-03-31'].derived).toBe('direct');
    expect(byEnd['2024-06-30'].value).toBe(-30_000_000); // 55 - 25
    expect(byEnd['2024-09-30'].value).toBe(-35_000_000); // 90 - 55
    expect(byEnd['2024-12-31'].value).toBe(-30_000_000); // 120 - 90 (annual minus 9-month YTD)
    expect(byEnd['2025-03-31'].value).toBe(-30_000_000);
    expect(byEnd['2025-06-30'].value).toBe(-36_000_000); // 66 - 30
    expect(byEnd['2025-06-30'].derived).toBe('diff');
  });

  it('ignores a YTD fact with no matching prior period', () => {
    const q = deriveQuarterlyFlows([fact({ start: '2025-01-01', end: '2025-09-30', val: -90 })]);
    expect(q).toEqual([]);
  });
});

describe('company-financials: burn and runway', () => {
  const flows = [
    { end: '2025-03-31', value: -30_000_000, form: '10-Q', filed: '2025-05-01', accn: 'a', derived: 'direct' as const },
    { end: '2025-06-30', value: -36_000_000, form: '10-Q', filed: '2025-08-01', accn: 'b', derived: 'diff' as const },
  ];

  it('averages the trailing two quarters and divides liquidity by monthly burn', () => {
    const r = computeBurnAndRunway('2025-06-30', flows, 180_000_000);
    expect(r.quarterly_burn).toBe(33_000_000);
    expect(r.runway_months).toBe(16.4); // 180 / 11
  });

  it('uses one quarter when only one is within the trailing window', () => {
    const r = computeBurnAndRunway('2025-03-31', flows, 170_000_000);
    expect(r.quarterly_burn).toBe(30_000_000);
    expect(r.runway_months).toBe(17);
  });

  it('reports zero burn and null runway for cash-generative quarters', () => {
    const r = computeBurnAndRunway('2025-06-30', flows.map(f => ({ ...f, value: 5_000_000 })), 100);
    expect(r).toEqual({ quarterly_burn: 0, runway_months: null });
  });

  it('returns nulls with no flows', () => {
    expect(computeBurnAndRunway('2025-06-30', [], 100)).toEqual({ quarterly_burn: null, runway_months: null });
  });
});

describe('company-financials: extractFinancialRows', () => {
  it('builds one row per balance-sheet period with liquidity, burn, runway, shares', () => {
    const rows = extractFinancialRows(companyFactsFixture(), COMPANY_ID, CIK, { goingConcern: true, atmOrShelf: true, now: new Date('2025-09-01T00:00:00Z') });
    expect(rows.map(r => r.fiscal_period_end)).toEqual(['2025-06-30', '2025-03-31', '2024-12-31']);
    const latest = rows[0];
    expect(latest.period_type).toBe('Q');
    expect(latest.cash_and_equivalents).toBe(140_000_000);
    expect(latest.short_term_investments).toBe(40_000_000);
    expect(latest.total_liquidity).toBe(180_000_000);
    expect(latest.operating_cash_flow).toBe(-36_000_000);
    expect(latest.net_loss).toBe(-38_000_000);
    expect(latest.quarterly_burn).toBe(33_000_000);
    expect(latest.runway_months).toBe(16.4);
    expect(latest.shares_outstanding).toBe(50_000_000);
    expect(latest.going_concern).toBe(true);
    expect(latest.atm_or_shelf_filed).toBe(true);
    expect(latest.source).toBe('sec_xbrl');
    expect(latest.source_url).toBe('https://www.sec.gov/Archives/edgar/data/1682852/000125000030/');
    expect(latest.filed_at).toBe('2025-08-01');
    expect(latest.cik).toBe(CIK);
    // Present-tense flags only on the newest row.
    expect(rows[1].going_concern).toBeNull();
    expect(rows[2].period_type).toBe('FY');
    expect(rows[2].short_term_investments).toBeNull();
  });

  it('honours the per-company cursor', () => {
    const rows = extractFinancialRows(companyFactsFixture(), COMPANY_ID, CIK, { afterPeriodEnd: '2025-03-31' });
    expect(rows.map(r => r.fiscal_period_end)).toEqual(['2025-06-30']);
  });
});

describe('company-financials: going concern and ATM/shelf', () => {
  it('flags an S-3 / 424B5 inside the trailing 12 months only', () => {
    const filings = listRecentFilings(submissionsFixture());
    expect(detectAtmOrShelf(filings, new Date('2025-09-01T00:00:00Z'))).toMatchObject({ filed: true, latest: { form: '424B5', filingDate: '2025-06-15' } });
    expect(detectAtmOrShelf(filings, new Date('2026-09-01T00:00:00Z')).filed).toBe(false);
  });

  it('marks going concern only when the hit is the latest 10-K/10-Q accession', () => {
    const filings = listRecentFilings(submissionsFixture());
    const latest = latestPeriodicFiling(filings) as FilingRef;
    expect(latest.accessionNumber).toBe('0001-25-000030');
    expect(detectGoingConcern([{ _source: { accession_number: '0001-25-000030', form: '10-Q' } }], latest)).toBe(true);
    expect(detectGoingConcern([{ _source: { adsh: '0001-25-000020', form: '10-Q' } }], latest)).toBe(false);
    expect(detectGoingConcern([], latest)).toBe(false);
    expect(detectGoingConcern([{ _source: { accession_number: '0001-25-000030' } }], null)).toBeNull();
  });
});

describe('company-financials: CIK resolution', () => {
  const index = buildCikIndex([
    { cik_str: 1682852, ticker: 'MRNA', title: 'Moderna, Inc.' },
    { cik_str: 875045, ticker: 'VRTX', title: 'Vertex Pharmaceuticals Inc' },
    { cik_str: 1000, ticker: 'ACMA', title: 'Acme Therapeutics Inc' },
    { cik_str: 1001, ticker: 'ACMB', title: 'Acme Biosciences Inc' },
  ]);

  it('matches by ticker first, stripping exchange suffixes', () => {
    expect(matchCikEntry({ name: 'Whatever', ticker: 'NASDAQ:MRNA' }, index)).toMatchObject({ cik: '1682852', method: 'ticker' });
    expect(matchCikEntry({ name: 'Whatever', ticker: 'vrtx' }, index)).toMatchObject({ cik: '875045', method: 'ticker' });
  });

  it('ignores state-of-incorporation and share-class noise in SEC titles', () => {
    const noisy = buildCikIndex([
      { cik_str: 2001, ticker: 'ALPH', title: 'ALPHA THERAPEUTICS INC /DE/' },
      { cik_str: 2002, ticker: 'BETA', title: 'BETA BIO INC/NEW' },
      { cik_str: 2003, ticker: 'GAMM', title: 'GAMMA PHARMACEUTICALS PLC /ADR/' },
      { cik_str: 2004, ticker: 'DELT', title: 'Delta Corp (DE)' },
    ]);
    expect(stripSecTitleNoise('ALPHA THERAPEUTICS INC /DE/')).toBe('ALPHA THERAPEUTICS INC');
    expect(matchCikEntry({ name: 'Alpha Therapeutics' }, noisy)).toMatchObject({ cik: '2001', method: 'name' });
    expect(matchCikEntry({ name: 'Beta Bio, Inc.' }, noisy)).toMatchObject({ cik: '2002', method: 'name' });
    expect(matchCikEntry({ name: 'Gamma Pharmaceuticals' }, noisy)).toMatchObject({ cik: '2003' });
    expect(matchCikEntry({ name: 'Delta Corporation' }, noisy)).toMatchObject({ cik: '2004' });
  });

  it('matches by normalized name, only when unique', () => {
    expect(matchCikEntry({ name: 'Vertex Pharmaceuticals, Inc.' }, index)).toMatchObject({ cik: '875045', method: 'name' });
    expect(matchCikEntry({ name: 'Acme Therapeutics' }, index)).toMatchObject({ cik: '1000' });
    // 'Acme' alone collapses both Acme entries under the strict key -> ambiguous -> null.
    expect(matchCikEntry({ name: 'Acme' }, index)).toBeNull();
    expect(matchCikEntry({ name: 'Nonexistent Pharma' }, index)).toBeNull();
  });

  it('normalizes corporate suffixes', () => {
    expect(normalizeCompanyKey('Vertex Pharmaceuticals, Inc.')).toBe('vertex');
    expect(padCik('1682852')).toBe('0001682852');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MANAGEMENT INTENT
// ═══════════════════════════════════════════════════════════════════════

const P0 = 'We are actively seeking a partner to advance ACM-101 into Phase 3 outside the United States, and we have initiated discussions with several potential licensees.';
const P1 = 'We retain all worldwide rights to ACM-202 and intend to commercialize it ourselves in the U.S.';
const P2 = 'These conditions raise substantial doubt about our ability to continue as a going concern within one year after the date these financial statements are issued.';

function fakeClient(responseText: string, usage: Partial<Record<string, number>> = {}): IntentClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    messages: {
      create: async (params: unknown) => {
        calls.push(params);
        return {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: INTENT_MODEL,
          stop_reason: 'end_turn',
          stop_sequence: null,
          content: [{ type: 'text', text: responseText, citations: null }],
          usage: { input_tokens: 800, output_tokens: 200, cache_read_input_tokens: 1200, cache_creation_input_tokens: 0, ...usage },
        } as never;
      },
    },
  };
}

describe('management-intent: response parsing and validation', () => {
  it('parses strict JSON, tolerates fences, salvages valid items', () => {
    const good = parseIntentResponse('```json\n{"signals":[{"paragraph_index":0,"signal_type":"seeking_partner","polarity":"bullish","stance":"s","quote":"seeking a partner","confidence":90}]}\n```');
    expect(good.parseError).toBeNull();
    expect(good.signals).toHaveLength(1);

    const mixed = parseIntentResponse('{"signals":[{"paragraph_index":0,"signal_type":"seeking_partner","polarity":"bullish","stance":"s","quote":"q","confidence":90},{"paragraph_index":0,"signal_type":"not_a_type","polarity":"bullish","stance":"s","quote":"q","confidence":90}]}');
    expect(mixed.signals).toHaveLength(1);
    expect(mixed.invalid).toBe(1);

    expect(parseIntentResponse('no json here').parseError).toMatch(/no JSON/);
    expect(parseIntentResponse('{"signals": [}').parseError).toMatch(/JSON.parse/);
  });

  it('drops signals whose quote is not verbatim, out of range, or low confidence', () => {
    const { kept, dropped } = validateSignals([
      { paragraph_index: 0, signal_type: 'seeking_partner', polarity: 'bullish', stance: 's', quote: 'actively  seeking a partner', confidence: 92 },
      { paragraph_index: 0, signal_type: 'seeking_partner', polarity: 'bullish', stance: 'dup', quote: 'seeking a partner', confidence: 80 },
      { paragraph_index: 1, signal_type: 'retaining_rights', polarity: 'bearish', stance: 's', quote: 'we will keep the rights forever', confidence: 95 },
      { paragraph_index: 5, signal_type: 'layoffs', polarity: 'bullish', stance: 's', quote: 'x', confidence: 95 },
      { paragraph_index: 2, signal_type: 'going_concern_language', polarity: 'bullish', stance: 's', quote: 'substantial doubt', confidence: 20 },
    ], [P0, P1, P2]);
    expect(kept).toHaveLength(1);
    expect(kept[0].quote).toBe('actively seeking a partner');
    expect(dropped).toBe(4);
  });

  it('quoteIsVerbatim folds whitespace and curly quotes', () => {
    expect(quoteIsVerbatim('“seeking a partner”', 'we are "seeking   a partner"')).toBe(true);
    expect(quoteIsVerbatim('seeking partners', P0)).toBe(false);
  });
});

describe('management-intent: classifyParagraphs with a mocked SDK', () => {
  it('batches 10 paragraphs per call, caches the rubric, keeps verbatim signals, accounts tokens', async () => {
    const paragraphs = [P0, P1, P2, ...Array.from({ length: 9 }, (_, i) => `Filler paragraph number ${i} about partnering discussions that are ongoing.`)];
    const client = fakeClient(JSON.stringify({
      signals: [
        { paragraph_index: 0, signal_type: 'seeking_partner', polarity: 'bullish', stance: 'Seeking ex-US partner.', quote: 'actively seeking a partner to advance ACM-101', confidence: 92 },
        { paragraph_index: 1, signal_type: 'retaining_rights', polarity: 'bearish', stance: 'Keeps ACM-202.', quote: 'We retain all worldwide rights to ACM-202', confidence: 88 },
        { paragraph_index: 2, signal_type: 'going_concern_language', polarity: 'bullish', stance: 'GC.', quote: 'paraphrased, not verbatim', confidence: 90 },
      ],
    }));
    const res = await classifyParagraphs(client, paragraphs);
    expect(client.calls).toHaveLength(2); // 12 paragraphs -> 10 + 2
    const first = client.calls[0] as { model: string; system: Array<{ cache_control?: { type: string } }>; messages: Array<{ content: string }> };
    expect(first.model).toBe(INTENT_MODEL);
    expect(first.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(first.messages[0].content).toContain('"paragraph_index":9');
    expect(first.messages[0].content).not.toContain('"paragraph_index":10');
    expect(INTENT_BATCH_SIZE).toBe(10);
    // The fake returns the same 3 signals for both batches; batch 2 has only 2
    // paragraphs so index 2 is out of range there, and the non-verbatim quote
    // is dropped in batch 1.
    expect(res.signals.map(s => `${s.paragraph_index}:${s.signal_type}`)).toEqual([
      '0:seeking_partner', '1:retaining_rights',
    ]);
    expect(res.dropped).toBeGreaterThanOrEqual(1);
    expect(res.usage.calls).toBe(2);
    expect(res.usage.input_tokens).toBe(1600);
    expect(res.usage.cache_read_input_tokens).toBe(2400);
    expect(usageCostUsd(res.usage)).toBeCloseTo((1600 * 2 + 400 * 10 + 2400 * 0.2) / 1_000_000, 8);
  });

  it('stops before a batch when the cost cap is already reached', async () => {
    const client = fakeClient('{"signals":[]}');
    const res = await classifyParagraphs(client, [P0], { costCapUsd: 0.001, spentUsd: 0.002 });
    expect(client.calls).toHaveLength(0);
    expect(res.errors[0]).toMatch(/cost cap/);
  });

  it('collects SDK errors per batch instead of throwing', async () => {
    const client: IntentClient = { messages: { create: async () => { throw new Error('rate limited'); } } };
    const res = await classifyParagraphs(client, [P0]);
    expect(res.signals).toEqual([]);
    expect(res.errors[0]).toMatch(/rate limited/);
  });
});

describe('management-intent: rows, paragraphs, html', () => {
  it('never emits a row without an http source_url and keeps one row per type', () => {
    const signals = [
      { paragraph_index: 0, signal_type: 'seeking_partner' as const, polarity: 'bullish' as const, stance: 'a', quote: 'q1', confidence: 70 },
      { paragraph_index: 3, signal_type: 'seeking_partner' as const, polarity: 'bullish' as const, stance: 'b', quote: 'q2', confidence: 95 },
      { paragraph_index: 1, signal_type: 'layoffs' as const, polarity: 'bullish' as const, stance: 'c', quote: '', confidence: 95 },
    ];
    const rows = toIntentRows(signals, { company_id: COMPANY_ID, source_type: '10q', source_id: '0001-25-000030', source_url: 'https://www.sec.gov/x.htm', observed_at: '2025-08-01' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ signal_type: 'seeking_partner', quote: 'q2', confidence: 95, model: INTENT_MODEL, source_type: '10q' });
    expect(toIntentRows(signals, { company_id: COMPANY_ID, source_type: 'press_release', source_id: 'x', source_url: 'urn:press:abc', observed_at: '2025-08-01' })).toEqual([]);
  });

  it('extracts keyword paragraphs and prefers those after the MD&A heading', () => {
    const doc = [
      'Risk Factors',
      'If we are unable to raise capital we may need to seek a partner for our programs, which could be on unfavorable terms and this sentence is long enough to count as a paragraph.',
      "Item 7. Management's Discussion and Analysis of Financial Condition",
      'Liquidity and Capital Resources. We believe our cash runway will fund operations into the second quarter of 2027 and we are evaluating partnering opportunities for our second program.',
      'Our headquarters lease expires in 2029 and we do not expect any material change to occupancy costs during the coming year at all.',
    ].join('\n\n');
    const paras = extractIntentParagraphs(doc, 1);
    expect(paras).toHaveLength(1);
    expect(paras[0]).toMatch(/Liquidity and Capital Resources/);
    expect(extractIntentParagraphs(doc, 10)).toHaveLength(2);
  });

  it('strips html into paragraph-separated text', () => {
    const text = htmlToText('<html><body><p>We are <b>seeking</b> a partner.</p><p>Next&nbsp;paragraph.</p><script>x()</script></body></html>');
    expect(text).toContain('We are seeking a partner.');
    expect(text).toContain('Next paragraph.');
    expect(text).not.toContain('x()');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PATENTS
// ═══════════════════════════════════════════════════════════════════════

describe('patents-assignee', () => {
  const lookup = new Map<string, { drug_id: string; alias_type: string }>([
    ['acm101', { drug_id: 'drug-code', alias_type: 'code' }],
    ['acmelizumab', { drug_id: 'drug-inn', alias_type: 'inn' }],
  ]);

  it('links by development code in the title, INN in the abstract, code winning over INN', () => {
    expect(linkPatentToDrug('Formulations of ACM-101', 'A stable formulation.', lookup)).toBe('drug-code');
    expect(linkPatentToDrug('Anti-CD20 antibodies', 'The antibody acmelizumab binds CD20.', lookup)).toBe('drug-inn');
    expect(linkPatentToDrug('Methods of treating', 'acmelizumab combined with ACM 101', lookup)).toBe('drug-code');
    expect(linkPatentToDrug('Generic method', 'Nothing relevant here.', lookup)).toBeNull();
  });

  it('produces normalized alias keys and skips registry ids', () => {
    const keys = patentAliasKeys('ACM-101 and NCT01234567', 'acmelizumab');
    expect(keys).toContain('acm101');
    expect(keys).toContain('acmelizumab');
    expect(keys.some(k => k.startsWith('nct'))).toBe(false);
  });

  it('filters by pharma CPC prefixes and builds rows with a Google Patents URL', () => {
    const p: PatentsViewPatent = {
      patent_id: '11000001',
      patent_title: 'Compositions comprising ACM-101',
      patent_date: '2025-02-04',
      patent_abstract: 'An ADC.',
      application: [{ filing_date: '2022-06-01' }],
      assignees: [{ assignee_organization: 'Acme Therapeutics, Inc.' }],
      cpc_current: [{ cpc_group_id: 'A61K47/68' }, { cpc_group_id: 'C07K16/28' }],
    };
    expect(cpcCodesOf(p)).toEqual(['A61K47/68', 'C07K16/28']);
    expect(isPharmaCpc(cpcCodesOf(p))).toBe(true);
    expect(isPharmaCpc(['G06F17/00'])).toBe(false);
    const row = toPatentRow(p, COMPANY_ID, 'drug-code', new Date('2025-09-01T00:00:00Z'));
    expect(row).toMatchObject({
      company_id: COMPANY_ID, patent_id: '11000001', filing_date: '2022-06-01', grant_date: '2025-02-04',
      assignee_raw: 'Acme Therapeutics, Inc.', drug_master_id: 'drug-code', source: 'patentsview',
      source_url: 'https://patents.google.com/patent/US11000001',
    });
  });

  it('strips legal suffixes for the assignee query and filters filings from 2015', () => {
    expect(assigneeQueryName('Acme Therapeutics, Inc.')).toBe('Acme Therapeutics');
    expect(assigneeQueryName('Hutchison MediPharma Co., Ltd.')).toBe('Hutchison MediPharma');
    expect(assigneeQueryName('BioNTech SE')).toBe('BioNTech');
    const q = buildPatentsViewQuery('Acme Therapeutics', { sinceGrantDate: '2025-01-01' }) as { _and: Record<string, unknown>[] };
    expect(q._and[0]).toEqual({ _gte: { 'application.filing_date': '2015-01-01' } });
    expect(q._and[1]).toEqual({ _begins: { 'assignees.assignee_organization': 'Acme Therapeutics' } });
    expect(q._and[2]).toEqual({ _gte: { patent_date: '2025-01-01' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CATALYSTS
// ═══════════════════════════════════════════════════════════════════════

const TODAY = '2026-09-15';

function catalystAsset(overrides: Partial<CatalystAsset> = {}): CatalystAsset {
  return {
    id: 'asset-1', company_id: COMPANY_ID, asset_name: 'ACM-101', asset_aliases: ['acmelizumab'],
    nct_ids: ['NCT01000001', 'NCT01000002'], lead_nct_id: 'NCT01000001', phase: 'phase_2', phase_history: null,
    ...overrides,
  };
}

function trial(overrides: Partial<CatalystTrial> & { nct_id: string }): CatalystTrial {
  return { company_id: COMPANY_ID, status: 'recruiting', phase: 'phase_2', primary_completion_date: null, completion_date: null, last_update_posted: null, ...overrides };
}

describe('catalysts: date parsing', () => {
  it('parses explicit, month, quarter and half-year expressions', () => {
    expect(parseDateFromText('PDUFA target action date of March 15, 2027')).toEqual({ iso: '2027-03-15', granularity: 'day' });
    expect(parseDateFromText('the PDUFA date is 15 March 2027')).toEqual({ iso: '2027-03-15', granularity: 'day' });
    expect(parseDateFromText('date: 2027-03-15')).toEqual({ iso: '2027-03-15', granularity: 'day' });
    expect(parseDateFromText('expected in March 2027')).toEqual({ iso: '2027-03-31', granularity: 'month' });
    expect(parseDateFromText('topline data in the first quarter of 2027')).toEqual({ iso: '2027-03-31', granularity: 'quarter' });
    expect(parseDateFromText('readout in Q4 2026')).toEqual({ iso: '2026-12-31', granularity: 'quarter' });
    expect(parseDateFromText('data in the second half of 2027')).toEqual({ iso: '2027-12-31', granularity: 'half' });
    expect(parseDateFromText('mid-2027')).toEqual({ iso: '2027-06-30', granularity: 'half' });
    expect(parseDateFromText('no dates at all')).toBeNull();
    expect(parseDateFromText('February 30, 2027')).toBeNull();
  });

  it('picks the date nearest the anchor', () => {
    const text = 'Presented on June 1, 2026. The PDUFA date is set for December 20, 2026.';
    expect(parseDateFromText(text, text.indexOf('PDUFA'))?.iso).toBe('2026-12-20');
  });
});

describe('catalysts: trial derivation', () => {
  it('emits primary/study completion with observed dates when passed or completed', () => {
    const rows = deriveTrialCatalysts(catalystAsset(), [
      trial({ nct_id: 'NCT01000001', primary_completion_date: '2027-01-31', completion_date: '2027-06-30' }),
      trial({ nct_id: 'NCT01000002', status: 'completed', primary_completion_date: '2026-03-31', completion_date: '2026-12-31', last_update_posted: '2026-08-01' }),
      trial({ nct_id: 'NCT09999999', primary_completion_date: '2027-01-31' }), // not on the asset
      trial({ nct_id: 'NCT01000001', status: 'withdrawn', primary_completion_date: '2027-01-31' }),
    ], TODAY);
    expect(rows).toHaveLength(4);
    const byKey = Object.fromEntries(rows.map(r => [`${r.nct_id}:${r.catalyst_type}`, r]));
    expect(byKey['NCT01000001:primary_completion']).toMatchObject({ expected_date: '2027-01-31', observed_date: null, source: 'ctgov', source_url: 'https://clinicaltrials.gov/study/NCT01000001', confidence: 70 });
    expect(byKey['NCT01000002:primary_completion']).toMatchObject({ expected_date: '2026-03-31', observed_date: '2026-03-31' });
    expect(byKey['NCT01000002:study_completion']).toMatchObject({ expected_date: '2026-12-31', observed_date: '2026-08-01' });
  });

  it('derives phase transitions from phase_history', () => {
    const rows = derivePhaseTransitions(catalystAsset({ phase_history: [
      { phase: 'phase_1', date: '2024-01-10' }, { phase: 'phase_2', date: '2025-06-01' }, { phase: 'phase_2', date: '2025-09-01' },
    ] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ catalyst_type: 'phase_transition', expected_date: '2025-06-01', observed_date: '2025-06-01', nct_id: null, source: 'phase_history' });
    expect(derivePhaseTransitions(catalystAsset({ phase_history: [] }))).toEqual([]);
  });
});

describe('catalysts: press derivation and dedupe', () => {
  const press = (overrides: Partial<CatalystPress>): CatalystPress => ({
    id: 'pr-1', headline: 'Acme announces FDA acceptance of NDA for ACM-101', body_text: 'The FDA assigned a PDUFA target action date of March 15, 2027.',
    published_at: '2026-06-01T12:00:00Z', source_url: 'https://www.globenewswire.com/x', company_ids: [COMPANY_ID], categories: ['regulatory'],
    ...overrides,
  });

  it('matches assets by name or alias with word boundaries', () => {
    expect(matchAssetInText(catalystAsset(), 'data on ACM-101 were presented')).toBe(true);
    expect(matchAssetInText(catalystAsset(), 'data on ACM 101 were presented')).toBe(true);
    expect(matchAssetInText(catalystAsset(), 'Acmelizumab, an antibody')).toBe(true);
    expect(matchAssetInText(catalystAsset(), 'ACM-1010 is different')).toBe(false);
    expect(matchAssetInText(catalystAsset({ asset_name: 'AB', asset_aliases: [] }), 'AB')).toBe(false);
  });

  it('parses PDUFA dates, conference presentations and readouts', () => {
    const asset = catalystAsset();
    const pdufa = derivePressCatalysts(press({}), [asset], TODAY);
    expect(pdufa).toHaveLength(1);
    expect(pdufa[0]).toMatchObject({ catalyst_type: 'pdufa', expected_date: '2027-03-15', observed_date: null, confidence: 85, source: 'press_release' });

    const conf = derivePressCatalysts(press({
      headline: 'Acme to present ACM-101 data at ASCO 2026', body_text: 'Oral presentation on May 30, 2026 at the ASCO Annual Meeting.',
      published_at: '2026-04-20T00:00:00Z', categories: ['conference'],
    }), [asset], TODAY);
    expect(conf).toHaveLength(1);
    expect(conf[0]).toMatchObject({ catalyst_type: 'conference_presentation', expected_date: '2026-05-30', observed_date: '2026-05-30' });

    const readout = derivePressCatalysts(press({
      headline: 'Acme reports positive topline results from Phase 2 study of acmelizumab', body_text: 'The study met its primary endpoint.',
      published_at: '2026-07-10T00:00:00Z', categories: ['clinical'],
    }), [asset], TODAY);
    expect(readout).toHaveLength(1);
    expect(readout[0]).toMatchObject({ catalyst_type: 'readout_announced', expected_date: '2026-07-10', observed_date: '2026-07-10' });

    expect(derivePressCatalysts(press({ headline: 'Unrelated company news', body_text: 'PDUFA date January 1, 2027' }), [asset], TODAY)).toEqual([]);
    expect(derivePressCatalysts(press({ source_url: 'urn:press:abc' }), [asset], TODAY)).toEqual([]);
  });

  it('dedupes on the upsert key, keeping confidence and any observed date', () => {
    const base = { asset_id: 'asset-1', company_id: COMPANY_ID, catalyst_type: 'pdufa' as const, expected_date: '2027-03-15', nct_id: null, source: 'press_release', source_url: 'https://a' };
    const rows = dedupeCatalysts([
      { ...base, observed_date: null, confidence: 65 },
      { ...base, observed_date: '2027-03-15', confidence: 85, source_url: 'https://b' },
      { ...base, observed_date: null, confidence: 50, source_url: 'https://c' },
      { ...base, nct_id: 'NCT01000001', observed_date: null, confidence: 50 },
    ]);
    expect(rows).toHaveLength(2);
    const merged = rows.find(r => r.nct_id === null)!;
    expect(merged.confidence).toBe(85);
    expect(merged.observed_date).toBe('2027-03-15');
    expect(merged.source_url).toBe('https://b');
  });

  it('readouts resolve the nearest unobserved primary completion within six months', () => {
    const completions = deriveTrialCatalysts(catalystAsset(), [
      trial({ nct_id: 'NCT01000001', primary_completion_date: '2026-10-31' }),
      trial({ nct_id: 'NCT01000002', primary_completion_date: '2028-01-31' }),
    ], TODAY);
    const hit = readoutResolvesCompletion('2026-07-10', completions);
    expect(hit.map(h => h.nct_id)).toEqual(['NCT01000001']);
  });
});
