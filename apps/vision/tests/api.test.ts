import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import sharp from 'sharp';
import type { Question } from '@typesafe-ai/sdk';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { createApp } from '../server/app.js';
import { buildQuestion } from '../server/questions.js';
import type { Answer } from '../src/types.js';

let server: Server;
let base: string;
let imageBytes: Buffer;
let lastQuestion: Question;
let invalidBox = false;

before(async () => {
  imageBytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#c5e3ad' } }).jpeg().toBuffer();
  const app = createApp({ evaluate: async (_image, question) => {
    lastQuestion = question;
    const answers: Record<string, Answer> = {
      box: { type: 'box', box: { top: .2, bottom: .8, left: .1, right: invalidBox ? 1.5 : .6 }, confidence: null },
      noul: { type: 'noul', noul: .87 },
      choice: { type: 'choice', choice: 'Kawa', probabilities: { Kawa: .9, Herbata: .1 }, confidence: .8 },
      score: { type: 'score', score: .75, legend: { '0': 'Ciemne', '1': 'Jasne' }, probabilities: { '0': .25, '1': .75 }, confidence: .5 },
    };
    return { model: 'test-only', answers: { result: answers[question.type] }, usage: { input_tokens: 1, output_tokens: 1 } };
  } });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

async function upload(buffer: Buffer, name = 'photo.jpg') {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(buffer)]), name);
  return fetch(`${base}/api/image`, { method: 'POST', body: form });
}

async function evaluate(type: string, criteria: string[] = [], bytes = imageBytes) {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(bytes)]), 'photo.jpg');
  form.append('prompt', 'Znajdź obiekt na zdjęciu.');
  form.append('type', type); form.append('criteria', JSON.stringify(criteria));
  return fetch(`${base}/api/evaluate`, { method: 'POST', body: form });
}

test('upload rotates EXIF and preserves the image coordinate system', async () => {
  const rotated = await sharp(imageBytes).withMetadata({ orientation: 6 }).toBuffer();
  const response = await upload(rotated);
  assert.equal(response.status, 200);
  const photo = await response.json();
  assert.equal(photo.width, 600); assert.equal(photo.height, 800);
  const metadata = await sharp(Buffer.from(photo.dataUrl.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.orientation, undefined);
});

test('large and small photos are resized within the API limits', async () => {
  for (const [width, height, expected] of [[3000, 2000, [1568, 1045]], [140, 140, [280, 280]]] as const) {
    const bytes = await sharp({ create: { width, height, channels: 3, background: '#fff' } }).png().toBuffer();
    const response = await upload(bytes);
    assert.equal(response.status, 200);
    const photo = await response.json();
    assert.deepEqual([photo.width, photo.height], expected);
  }
});

test('unsupported formats, corrupt files and extreme aspect ratios are rejected', async () => {
  const webp = await sharp(imageBytes).webp().toBuffer();
  const panorama = await sharp({ create: { width: 2000, height: 100, channels: 3, background: '#fff' } }).png().toBuffer();
  for (const bytes of [webp, Buffer.from('not an image'), panorama]) {
    const response = await upload(bytes);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('all four response types roundtrip through the API', async () => {
  for (const [type, criteria] of [['box', []], ['noul', []], ['choice', ['Kawa', 'Herbata']], ['score', ['Ciemne', 'Jasne']]] as const) {
    const response = await evaluate(type, [...criteria]);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.answer.type, type);
    assert.equal(data.raw.model, 'test-only');
    assert.equal(typeof data.elapsedMs, 'number');
    if (type === 'box') assert.deepEqual(data.answer.box, { top: .2, bottom: .8, left: .1, right: .6 });
    if (lastQuestion.type === 'choice') assert.deepEqual(lastQuestion.criteria, { Kawa: null, Herbata: null });
    if (lastQuestion.type === 'score') assert.deepEqual(lastQuestion.criteria, ['Ciemne', 'Jasne']);
  }
});

test('invalid upstream coordinates never reach the overlay', async () => {
  invalidBox = true;
  try { assert.equal((await evaluate('box')).status, 502); } finally { invalidBox = false; }
});

test('invalid question criteria and unprepared images are rejected', async () => {
  assert.throws(() => buildQuestion('choice', 'Q', ['A', 'A']));
  assert.throws(() => buildQuestion('score', 'Q', ['A']));
  assert.throws(() => buildQuestion('unknown', 'Q', []));
  assert.throws(() => buildQuestion('box', ' ', []));
  assert.equal((await evaluate('choice', ['Kawa'])).status, 400);
  const tiny = await sharp(imageBytes).resize(100, 100).toBuffer();
  assert.equal((await evaluate('box', [], tiny)).status, 400);
});

test('missing server API key is reported without sending an upstream request', async () => {
  const unconfigured = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => unconfigured.once('listening', resolve));
  try {
    const address = unconfigured.address(); assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/evaluate`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /TYPESAFE_API_KEY/);
  } finally { unconfigured.close(); }
});

test('official SDK sends multipart image, asset reference and the experimental header', async () => {
  let sent = false;
  const client = new TypeSafeClient({ apiKey: 'test-key-only', compression: false, fetch: async (url, init) => {
    sent = true;
    assert.equal(String(url), 'https://api.typesafe.ai/v1/systemone');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('TypeSafe-Danger-Zone-Images'), 'true');
    assert.equal(headers.get('Authorization'), 'Bearer test-key-only');
    const form = await new Response(init?.body, { headers }).formData();
    const requestPart = form.get('request'); assert.ok(requestPart);
    const request = JSON.parse(typeof requestPart === 'string' ? requestPart : await requestPart.text());
    assert.equal(request.model, 'jev-preview');
    assert.equal(request.questions.result.type, 'box');
    const asset = request.assets[request.state.photo]; assert.ok(asset);
    const file = form.get(asset.part); assert.ok(file instanceof Blob);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), imageBytes);
    return Response.json({ model: 'sdk-transport-test', answers: { result: { type: 'box', box: { top: .1, bottom: .5, left: .2, right: .6 }, confidence: null } }, usage: { input_tokens: 1, output_tokens: 1 } });
  } });
  const sdkServer = createApp({ client }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => sdkServer.once('listening', resolve));
  try {
    const address = sdkServer.address(); assert.ok(address && typeof address !== 'string');
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(imageBytes)]), 'photo.jpg');
    form.append('type', 'box'); form.append('prompt', 'Wskaż filiżankę.');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/evaluate`, { method: 'POST', body: form });
    assert.equal(response.status, 200, await response.text());
    assert.equal(sent, true);
  } finally { sdkServer.close(); }
});
