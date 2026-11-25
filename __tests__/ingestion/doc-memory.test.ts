/**
 * Document memory: a filing the extractor already judged is not extracted again on the
 * next run of its look-back window (Nov 23 2026: 272 HKEX verdicts covered 6 documents).
 */
const store: Record<string, { state: Record<string, unknown> }> = {};
const failReads = { on: false };
jest.mock('@/lib/radar/sync-cursor', () => ({
  readSyncCursor: jest.fn(async (_sb: unknown, source: string) => {
    if (failReads.on) throw new Error('db down');
    return { source, cursor: null, state: store[source]?.state ?? {}, runs: 0, last_run_at: null };
  }),
  writeSyncCursor: jest.fn(async (_sb: unknown, source: string, _cursor: string, state: Record<string, unknown>) => {
    store[source] = { state };
  }),
}));

import { __resetDocMemory, alreadyJudged, epochDay, flushDocMemories, forgetVerdict, pruneMemory, rememberVerdict } from '@/lib/ingestion/doc-memory';
import { writeSyncCursor } from '@/lib/radar/sync-cursor';

const sb = {} as never;

describe('doc memory', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    failReads.on = false;
    __resetDocMemory();
    (writeSyncCursor as jest.Mock).mockClear();
  });

  it('remembers a verdict across runs once flushed', async () => {
    expect(await alreadyJudged(sb, 'hkex', 'hkex:1')).toBe(false);
    await rememberVerdict(sb, 'hkex', 'hkex:1', 'not_a_deal');
    await flushDocMemories(sb);
    expect(store['docmem:hkex']).toBeDefined();
    expect(await alreadyJudged(sb, 'hkex', 'hkex:1')).toBe(true);
    expect(await alreadyJudged(sb, 'asx', 'hkex:1')).toBe(false);
  });

  it('forgets a verdict when the insert failed, so the document is retried', async () => {
    await rememberVerdict(sb, 'dart', 'dart:9', 'extracted');
    await forgetVerdict(sb, 'dart', 'dart:9');
    await flushDocMemories(sb);
    expect(await alreadyJudged(sb, 'dart', 'dart:9')).toBe(false);
  });

  it('writes nothing on a dry run or when nothing changed', async () => {
    await alreadyJudged(sb, 'tdnet', 'tdnet:1');
    await flushDocMemories(sb);
    await rememberVerdict(sb, 'tdnet', 'tdnet:2', 'not_a_deal');
    await flushDocMemories(sb, { dryRun: true });
    expect(writeSyncCursor).not.toHaveBeenCalled();
  });

  it('never overwrites the stored memory after a failed read', async () => {
    store['docmem:cninfo'] = { state: { ids: { 'cninfo:1': ['not_a_deal', epochDay()] } } };
    failReads.on = true;
    expect(await alreadyJudged(sb, 'cninfo', 'cninfo:1')).toBe(false);
    await rememberVerdict(sb, 'cninfo', 'cninfo:2', 'not_a_deal');
    await flushDocMemories(sb);
    expect(writeSyncCursor).not.toHaveBeenCalled();
    expect(Object.keys((store['docmem:cninfo'].state.ids as Record<string, unknown>))).toEqual(['cninfo:1']);
  });

  it('expires old verdicts and keeps the newest when over the cap', () => {
    const today = 20_000;
    const pruned = pruneMemory({ a: ['not_a_deal', today - 50], b: ['not_a_deal', today - 1], c: ['extracted', today], d: ['x', today - 2] }, today, 45, 2);
    expect(Object.keys(pruned).sort()).toEqual(['b', 'c']);
  });
});
