import { loadMatchSubjects, MATCH_SUBJECTS_PAGE } from '@/lib/ingestion/signal-match';

// PostgREST returns at most 1,000 rows per call (max_rows) whatever p_limit asks for.
function cappedRpc(total: number, cap = 1000) {
  const ids = Array.from({ length: total }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
  const calls: Array<Record<string, unknown>> = [];
  return {
    calls,
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      calls.push(args);
      const after = args.p_after as string | null;
      const start = after ? ids.indexOf(after) + 1 : 0;
      const n = Math.min(cap, Number(args.p_limit));
      return { data: ids.slice(start, start + n).map(id => ({ id, name: id })), error: null };
    },
  };
}

describe('loadMatchSubjects paging', () => {
  it('reads every company even when the server caps pages at 1,000 rows', async () => {
    const db = cappedRpc(9_778);
    const out = await loadMatchSubjects(db);
    expect(out).toHaveLength(9_778);
    expect(new Set(out.map(s => s.id)).size).toBe(9_778);
  });

  it('asks for pages no larger than the server cap', () => {
    expect(MATCH_SUBJECTS_PAGE).toBeLessThanOrEqual(1000);
  });

  it('stops on an empty page', async () => {
    const db = cappedRpc(2_000);
    await loadMatchSubjects(db);
    expect(db.calls).toHaveLength(3);
  });
});
