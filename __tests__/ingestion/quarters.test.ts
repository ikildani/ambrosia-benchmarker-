import { quartersBetween, quartersSince } from '@/lib/ingestion/edgar-fts';

describe('backfill quarter lists', () => {
  it('quartersBetween covers every quarter inclusive, oldest first', () => {
    const q = quartersBetween(2010, 2011);
    expect(q.map(x => x.key)).toEqual(['2010Q1', '2010Q2', '2010Q3', '2010Q4', '2011Q1', '2011Q2', '2011Q3', '2011Q4']);
    expect(q[0]).toMatchObject({ startdt: '2010-01-01', enddt: '2010-03-31' });
  });
  it('the combined walk puts recent years before the early pass', () => {
    const combined = [...quartersSince(2017, new Date('2026-09-25T00:00:00Z')), ...quartersBetween(2010, 2016)];
    expect(combined[0].key).toBe('2017Q1');
    expect(combined[combined.indexOf(combined.find(q => q.key === '2026Q3')!) + 1].key).toBe('2010Q1');
    expect(combined[combined.length - 1].key).toBe('2016Q4');
  });
});
