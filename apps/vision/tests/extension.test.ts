import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const shared = await readFile(new URL('../extension/shared.js', import.meta.url), 'utf8');
const background = await readFile(new URL('../extension/background.js', import.meta.url), 'utf8');
test('settings default to 80%, marking, and reject malformed persisted values', () => {
  const context = vm.createContext({ URL }); vm.runInContext(shared, context);
  const { settingsFrom, imageUrl } = context.JevImages;
  assert.equal(settingsFrom().threshold, 80); assert.equal(settingsFrom().mode, 'mark');
  assert.equal(settingsFrom({ threshold: 200 }).threshold, 100);
  assert.equal(settingsFrom({ threshold: '0', enabled: 'false', mode: 'bad' }).threshold, 80);
  assert.equal(settingsFrom({ threshold: 0, enabled: false, mode: 'hide' }).enabled, false);
  for (const url of ['http://media.licdn.com/a', 'https://licdn.com.evil.test/a', 'https://localhost/a', 'https://x.fbcdn.net:444/a', 'https://user:pass@x.fbcdn.net/a']) assert.equal(imageUrl(url), null);
  assert.equal(imageUrl('https://media.licdn.com/a'), 'https://media.licdn.com/a');
});
test('background validates senders, downloads without cookies, caches results and blocks redirects', async () => {
  let listener: (message: unknown, sender: unknown, respond: (data: any) => void) => void;
  let calls = 0;
  const api = {
    runtime: { id: 'test-extension', onMessage: { addListener(fn: typeof listener) { listener = fn; } } },
    storage: { local: { get: async () => ({ settings: { enabled: true } }) } },
  };
  const context = vm.createContext({ URL, chrome: api, AbortController, setTimeout, clearTimeout, FormData, Blob,
    fetch: async (url: string, options: RequestInit) => {
      calls++;
      assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
      if (url.startsWith('https://')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
      assert.equal(url, 'http://127.0.0.1:3000/api/detect-ai');
      assert.ok(options.body instanceof FormData);
      return Response.json({ probability: .93, model: 'test' });
    },
  });
  vm.runInContext(shared + '\n' + background, context);
  const send = (url: string, senderUrl = 'https://www.linkedin.com/feed/') => new Promise<any>(resolve => listener({ type: 'jev-analyze-image', url }, { id: 'test-extension', tab: { url: senderUrl } }, resolve));
  assert.match((await send('https://media.licdn.com/a', 'https://evil.test/')).error, /strona/);
  assert.match((await send('http://localhost/private')).error, /adres/);
  assert.equal(calls, 0);
  const [first, second] = await Promise.all([send('https://media.licdn.com/a'), send('https://media.licdn.com/a')]);
  assert.equal(first.probability, .93); assert.equal(second.probability, .93);
  assert.equal((await send('https://media.licdn.com/a')).probability, .93);
  assert.equal(calls, 2);
});
