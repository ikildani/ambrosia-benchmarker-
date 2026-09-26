import { advance, allQuartersDone, type BackfillCursorState } from '@/lib/ingestion/edgar-fts-backfill';
import { PHARMA_DEAL_QUERIES, quartersSince } from '@/lib/ingestion/edgar-fts';

const quarters = quartersSince(2010, new Date('2026-09-25T00:00:00Z'));
const lastQuery = PHARMA_DEAL_QUERIES.length - 1;

function state(over: Partial<BackfillCursorState>): BackfillCursorState {
  return { quarterKey: '2017Q1', queryIndex: 0, from: 0, completedQuarters: [], ...over };
}

describe('backfill cursor walk', () => {
  it('covers 2010 through the current quarter', () => {
    expect(quarters[0].key).toBe('2010Q1');
    expect(quarters[quarters.length - 1].key).toBe('2026Q3');
  });

  it('rolls the last query into the next open quarter and marks the current one complete', () => {
    const next = advance(state({ quarterKey: '2018Q1', queryIndex: lastQuery, completedQuarters: ['2017Q1', '2017Q2', '2017Q3', '2017Q4'] }), quarters, 'next_query');
    expect(next.quarterKey).toBe('2018Q2');
    expect(next.queryIndex).toBe(0);
    expect(next.completedQuarters).toContain('2018Q1');
  });

  it('wraps to the earliest open quarter after the present', () => {
    const done = quarters.map(q => q.key).filter(k => k >= '2017Q1' && k !== '2026Q3');
    const next = advance(state({ quarterKey: '2026Q3', queryIndex: lastQuery, completedQuarters: done }), quarters, 'next_query');
    expect(next.quarterKey).toBe('2010Q1');
  });

  it('skips quarters already completed when moving forward', () => {
    const next = advance(state({ quarterKey: '2019Q4', queryIndex: lastQuery, completedQuarters: ['2020Q1', '2020Q2'] }), quarters, 'next_query');
    expect(next.quarterKey).toBe('2020Q3');
  });

  it('is finished only when every quarter is complete', () => {
    const all = quarters.map(q => q.key);
    expect(allQuartersDone(state({ completedQuarters: all }), quarters)).toBe(true);
    expect(allQuartersDone(state({ completedQuarters: all.slice(1) }), quarters)).toBe(false);
  });

  it('stays on the page when capped and increments retries', () => {
    const next = advance(state({ quarterKey: '2018Q1', queryIndex: 2, from: 100, retries: 1 }), quarters, 'stay');
    expect(next.from).toBe(100);
    expect(next.retries).toBe(2);
  });

  it('query keys are unique and cover the six structures', () => {
    const keys = PHARMA_DEAL_QUERIES.map(q => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['research_collaboration', 'option_to_license', 'license_terms', 'co_development', 'merger_biopharma', 'reformulation_505b2', 'distribution_supply']) {
      expect(keys).toContain(k);
    }
  });
});
