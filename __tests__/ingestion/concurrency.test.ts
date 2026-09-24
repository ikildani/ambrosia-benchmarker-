import { mapWithConcurrency } from '@/lib/ingestion/concurrency';

const tick = () => new Promise(r => setTimeout(r, 5));

describe('mapWithConcurrency', () => {
  it('runs every item and preserves order', async () => {
    const out = await mapWithConcurrency([3, 1, 2], 2, async n => { await tick(); return n * 10; });
    expect(out.results).toEqual([30, 10, 20]);
    expect(out.started).toBe(3);
    expect(out.errors).toEqual([]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0, peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });
    expect(peak).toBe(4);
  });

  it('stops starting new items when shouldStart returns false, but finishes in-flight ones', async () => {
    let allowed = 3;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async n => { await tick(); return n; }, () => allowed-- > 0);
    expect(out.started).toBe(3);
    expect(out.results.filter(r => r !== undefined)).toHaveLength(3);
  });

  it('records errors by index and keeps going', async () => {
    const out = await mapWithConcurrency([1, 2, 3], 3, async n => { if (n === 2) throw new Error('boom'); return n; });
    expect(out.results).toEqual([1, undefined, 3]);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].index).toBe(1);
  });
});
