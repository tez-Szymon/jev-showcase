import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createApp } from '../server/app.js';
import { aiImageQuestion } from '../server/ai-image.js';

async function withServer(options: Parameters<typeof createApp>[0], run: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    await run(`http://127.0.0.1:${address.port}`);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
async function detect(base: string, bytes: Buffer) {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(bytes)]), 'feed-image');
  return fetch(`${base}/api/detect-ai`, { method: 'POST', body: form });
}
test('feed detection prepares CDN WebP and returns raw AI probability', async () => {
  const bytes = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#ccc' } }).webp().toBuffer();
  await withServer({ evaluate: async (buffer, question) => {
    assert.deepEqual(question, aiImageQuestion);
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 1568); assert.equal(metadata.height, 784);
    return { model: 'test', answers: { result: { type: 'noul', noul: .8 } }, usage: { input_tokens: 1, output_tokens: 1 } };
  } }, async base => {
    const response = await detect(base, bytes);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.probability, .8); assert.equal(data.model, 'test');
  });
});
test('feed detection rejects invalid model probabilities and corrupt images', async () => {
  const bytes = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ccc' } }).png().toBuffer();
  for (const probability of [-.1, 1.1, NaN, undefined]) {
    await withServer({ evaluate: async () => ({ model: 'test', answers: { result: { type: 'noul', noul: probability } }, usage: { input_tokens: 1, output_tokens: 1 } }) }, async base => {
      assert.equal((await detect(base, bytes)).status, 502);
      assert.equal((await detect(base, Buffer.from('broken'))).status, 400);
    });
  }
});
test('feed detection requires configuration and never fetches user supplied URLs', async () => {
  await withServer({}, async base => {
    assert.equal((await detect(base, Buffer.from('test'))).status, 503);
  });
  await withServer({ evaluate: async () => { throw new Error('must not run'); } }, async base => {
    assert.equal((await fetch(`${base}/api/detect-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'http://127.0.0.1/private' }) })).status, 400);
  });
});
