/**
 * Nov 24 2026: a garbled extractor reply must not be recorded as "not a deal".
 * Null is remembered for 45 days by doc-memory and for good by the EFTS ledger.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());

import { parseDealExtraction } from '@/lib/ingestion/sec-edgar';
import { ExtractionParseError } from '@/lib/ingestion/json-object';
import { firstJsonObject as pressFirstJsonObject, ExtractionParseError as PressParseError } from '@/lib/ingestion/press-releases';
import { drainExtractionBatches, PROCESSED_TABLE } from '@/lib/ingestion/edgar-fts-batch';
import { FunnelCounter } from '@/lib/ingestion/funnel';

describe('parseDealExtraction', () => {
  it('reads the first object when notes after it contain braces', () => {
    const deal = parseDealExtraction('{"licensor":"Dimerix","licensee":"Taiba","confidence_score":90}\n\nNote: {see exhibit} for terms.');
    expect(deal?.licensor).toBe('Dimerix');
  });

  it('returns null only for an explicit is_deal false verdict', () => {
    expect(parseDealExtraction('{"is_deal": false, "reason": "share pledge"}')).toBeNull();
  });

  it('throws on a reply with no JSON object', () => {
    expect(() => parseDealExtraction('I could not read the filing.')).toThrow(ExtractionParseError);
  });

  it('throws on truncated JSON', () => {
    expect(() => parseDealExtraction('{"licensor":"Acadia","licensee":"Neuren"')).toThrow(ExtractionParseError);
  });

  it('press-releases keeps exporting the shared helpers', () => {
    expect(pressFirstJsonObject('x {"a":1} y')).toBe('{"a":1}');
    expect(PressParseError).toBe(ExtractionParseError);
  });
});

describe('drainExtractionBatches', () => {
  function fakeSupabase(docs: unknown[]) {
    const deleted: string[] = [];
    const upserted: Array<Record<string, unknown>> = [];
    const from = jest.fn((table: string) => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ batch_id: 'b1', docs, request_count: docs.length }], error: null }) }) }) }),
      delete: () => ({ eq: async (_c: string, v: string) => { if (table === PROCESSED_TABLE) deleted.push(v); return { error: null }; } }),
      upsert: async (row: Record<string, unknown>) => { if (table === PROCESSED_TABLE) upserted.push(row); return { error: null }; },
      update: () => ({ eq: async () => ({ error: null }) }),
    }));
    return { client: { from } as never, deleted, upserted };
  }

  const doc = (accession: string) => ({
    accession, quarter: '2026Q3', queryKey: 'exclusive_license', sourceType: 'sec_8k',
    doc: { accession, cik: '1', filename: 'ex99.htm', url: 'https://www.sec.gov/x', filingDate: '2026-09-28', form: '8-K', fileType: 'EX-99.1', companyName: 'Co' },
  });

  function fakeAnthropic(results: unknown[]) {
    return {
      messages: {
        batches: {
          retrieve: async () => ({ processing_status: 'ended' }),
          results: async () => (async function* () { for (const r of results) yield r; })(),
        },
      },
    } as never;
  }

  const succeeded = (id: string, text: string) => ({
    custom_id: id,
    result: { type: 'succeeded', message: { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] } },
  });

  it('forgets a garbled reply so a later walk resubmits it, and ledgers a real verdict', async () => {
    const sb = fakeSupabase([doc('A-garbled'), doc('B-notdeal')]);
    const funnel = new FunnelCounter();
    const out = await drainExtractionBatches(sb.client, fakeAnthropic([
      succeeded('A-garbled', '{"licensor":"Acadia","licensee":'),
      succeeded('B-notdeal', '{"is_deal": false, "reason": "earnings"}'),
    ]), { anthropicApiKey: 'k', dryRun: false, minConfidence: 75, funnel, deadline: Date.now() + 60_000 } as never);

    expect(out.errors).toEqual([]);
    expect(sb.deleted).toEqual(['A-garbled']);
    expect(sb.upserted.map(r => [r.accession, r.outcome])).toEqual([['B-notdeal', 'not_a_deal']]);
    const f = funnel.toJSON();
    expect(f.stages.extraction_error).toBe(1);
    expect(f.stages.not_a_deal).toBe(1);
  });
});
