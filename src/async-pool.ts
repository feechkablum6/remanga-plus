// Bounded-concurrency worker pool. Runs `fn` over `items` with at most `limit`
// promises in flight at once, while preserving input order in the result array.
// Used to parallelise the per-bookmark / per-catalog-page request loops that
// otherwise awaited one round-trip at a time.
//
// Contract: `fn` must NEVER reject — it backs onto Promise.all, so a single
// throw aborts the whole batch and discards in-flight results. Callers wrap
// their fetch + parse in try/catch and return a default (null / []) instead.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("mapWithConcurrency: limit must be an integer >= 1");
  }

  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
