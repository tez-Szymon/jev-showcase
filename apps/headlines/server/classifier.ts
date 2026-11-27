import { normalize, type Result } from '../shared/types.js';
// A single queue bounds upstream concurrency across all tabs. In-flight promises deduplicate overlaps.
export class Classifier {
  private cache = new Map<string, Promise<Result>>();
  private tail: Promise<unknown> = Promise.resolve();
  classified = 0;
  batches = 0;
  constructor(private evaluate: (texts: string[]) => Promise<Result[]>) {}
  async classify(texts: string[]) {
    const missing = [
      ...new Map(
        texts.filter((t) => !this.cache.has(normalize(t))).map((t) => [normalize(t), t]),
      ).values(),
    ];
    if (missing.length) {
      const work = this.tail.then(async () => {
        const results = await this.evaluate(missing);
        if (results.length !== missing.length) throw new Error('Incomplete classification');
        this.classified += missing.length;
        this.batches++;
        return results;
      });
      this.tail = work.catch(() => {});
      missing.forEach((text, i) => {
        const promise = work.then((results) => results[i]);
        this.cache.set(normalize(text), promise);
        void promise.catch(() => {
          this.cache.delete(normalize(text));
        });
      });
      // Bound memory in a long-running demo server.
      if (this.cache.size > 10000)
        for (const key of [...this.cache.keys()].slice(0, 1000)) this.cache.delete(key);
    }
    return Promise.all(
      texts.map(async (text) => ({ ...(await this.cache.get(normalize(text))!), text })),
    );
  }
}
