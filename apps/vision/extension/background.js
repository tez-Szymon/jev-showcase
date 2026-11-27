const { api, imageUrl, settingsFrom } = globalThis.JevImages;
const cache = new Map();
const pending = new Map();
let active = 0;
const MAX_BYTES = 16 * 1024 * 1024;
async function analyze(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Pobieranie obrazu: HTTP ${response.status}`);
    if (!/^image\/(jpeg|png|webp|avif)(;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error('Nieobsługiwany format obrazu.');
    }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Obraz przekracza 16 MB.');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Obraz przekracza 16 MB.'); }
      chunks.push(value);
    }
    const form = new FormData();
    form.append('image', new Blob(chunks, { type: response.headers.get('content-type') }), 'feed-image');
    const result = await fetch('http://127.0.0.1:3000/api/detect-ai', {
      method: 'POST', body: form, signal: controller.signal, credentials: 'omit', redirect: 'error',
    });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || `Serwer: HTTP ${result.status}`);
    if (!Number.isFinite(data.probability) || data.probability < 0 || data.probability > 1) throw new Error('Niepoprawny wynik modelu.');
    cache.set(url, { probability: data.probability, model: data.model });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return cache.get(url);
  } finally { clearTimeout(timer); }
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'jev-analyze-image') return;
  if (sender.id !== api.runtime.id || !/^https:\/\/www\.(linkedin|facebook)\.com\//.test(sender.tab?.url || '')) {
    respond({ error: 'Nieobsługiwana strona.' }); return;
  }
  const url = imageUrl(message.url);
  if (!url) { respond({ error: 'Nieobsługiwany adres obrazu.' }); return; }
  (async () => {
    const { settings } = await api.storage.local.get('settings');
    if (!settingsFrom(settings).enabled) return { error: 'Analiza jest wyłączona.' };
    if (cache.has(url)) return cache.get(url);
    if (pending.has(url)) return pending.get(url);
    if (active >= 3) return { error: 'Analiza zajęta. Ponów za chwilę.' };
    active++;
    const task = analyze(url).finally(() => { pending.delete(url); active--; });
    pending.set(url, task);
    return task;
  })().then(respond).catch(error => respond({ error: error.name === 'AbortError'
    ? 'Przekroczono czas analizy.' : `${error.message}. Sprawdź, czy lokalny serwer działa na porcie 3000.` }));
  return true;
});
