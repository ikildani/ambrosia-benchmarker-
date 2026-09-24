/**
 * Bounded-concurrency map for I/O-bound ingestion work (Claude extractions,
 * SEC document fetches). Workers pull the next item in order; `shouldStart`
 * is consulted before each item so a time budget can stop new work while
 * in-flight items finish.
 */
export interface ConcurrencyResult<R> {
  /** One entry per input item; `undefined` for items never started. */
  results: Array<R | undefined>;
  /** Items that were started (finished or thrown). */
  started: number;
  /** Items that threw; their error is recorded here by index. */
  errors: Array<{ index: number; error: unknown }>;
}

export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  shouldStart: () => boolean = () => true,
): Promise<ConcurrencyResult<R>> {
  const results: Array<R | undefined> = new Array(items.length).fill(undefined);
  const errors: Array<{ index: number; error: unknown }> = [];
  let next = 0;
  let started = 0;
  const workers = Math.max(1, Math.min(limit, items.length));

  async function worker(): Promise<void> {
    while (true) {
      if (next >= items.length || !shouldStart()) return;
      const index = next++;
      started++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        errors.push({ index, error });
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { results, started, errors };
}
