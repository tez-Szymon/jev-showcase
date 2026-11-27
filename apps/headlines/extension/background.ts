import { api } from './api.js';
import { normalize, validResult, type Result } from '../shared/types.js';
const endpoint = 'http://localhost:3001';
let queue: Promise<unknown> = Promise.resolve();
async function request(path: string, texts?: string[]) {
  const response = await fetch(endpoint + path, {
    method: texts ? 'POST' : 'GET',
    headers: texts ? { 'Content-Type': 'application/json' } : {},
    body: texts ? JSON.stringify({ texts }) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Backend HTTP ${response.status}`);
  return data;
}
async function classify(texts: string[]) {
  const health = await request('/health');
  const namespace = `${health.mode}:${health.model}:`;
  const cache = ((await api.storage.session.get('results')).results ?? {}) as Record<
    string,
    Result
  >;
  const missing = [
    ...new Map(
      texts.filter((t) => !cache[namespace + normalize(t)]).map((t) => [normalize(t), t]),
    ).values(),
  ];
  if (missing.length) {
    const data = await request('/classify', missing);
    if (
      !Array.isArray(data.results) ||
      data.results.length !== missing.length ||
      !data.results.every(validResult)
    )
      throw new Error('Invalid backend response');
    data.results.forEach((r: Result) => {
      cache[namespace + normalize(r.text)] = r;
    });
    const keys = Object.keys(cache);
    for (const key of keys.slice(0, Math.max(0, keys.length - 3000))) delete cache[key];
    await api.storage.session.set({ results: cache });
  }
  return {
    results: texts.map((text) => ({ ...cache[namespace + normalize(text)], text })),
    mode: health.mode,
  };
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== api.runtime.id) return;
  if (message.type === 'health') {
    request('/health')
      .then(respond)
      .catch((e) => respond({ error: e.message }));
    return true;
  }
  if (message.type !== 'classify') return;
  const texts = message.texts;
  if (
    !Array.isArray(texts) ||
    !texts.length ||
    texts.length > 20 ||
    !texts.every((t) => typeof t === 'string' && t.length >= 12 && t.length <= 400)
  ) {
    respond({ error: 'Invalid headlines' });
    return;
  }
  const job = queue.then(() => classify(texts));
  queue = job.catch(() => {});
  job
    .then(respond)
    .catch((e) => respond({ error: e.message || 'Start the local backend on port 3001.' }));
  return true;
});
