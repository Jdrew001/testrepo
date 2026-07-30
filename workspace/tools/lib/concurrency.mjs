export async function mapConcurrent(items, concurrency, worker) {
  const limit = Math.max(1, Math.min(concurrency || items.length || 1, items.length || 1));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index], index)
        };
      } catch (error) {
        results[index] = {
          status: "rejected",
          reason: error
        };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, runNext));
  return results;
}

export function resolveConcurrency(config, options, metadata = {}, fallback = 3) {
  return options.concurrency
    ?? metadata.concurrency
    ?? config.defaultConcurrency
    ?? fallback;
}
