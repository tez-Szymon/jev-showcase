import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Classifier } from '../server/classifier.js';
import type { Result } from '../shared/types.js';
const stub = (texts: string[]): Result[] =>
  texts.map((text) => ({ text, category: 'OTHER', confidence: 0.5, clickDriveScore: 1, mode: 'LIVE' }));
import { buildRequest, parseAnswers } from '../server/jev.js';
import { normalize } from '../shared/types.js';
test('normalization handles Unicode, whitespace and case', () =>
  assert.equal(normalize('  POLACY   są w szoku '), normalize('Polacy są w szoku')));
test('concurrent overlapping batches share inference and cache', async () => {
  const calls: string[][] = [];
  const classifier = new Classifier(async (texts) => {
    calls.push(texts);
    await new Promise((r) => setTimeout(r, 10));
    return stub(texts);
  });
  const a = 'Polacy są w szoku. Tego nikt nie przewidział';
  const b = 'NBP opublikował nowe dane o inflacji';
  const results = await Promise.all([
    classifier.classify([a, a.toUpperCase()]),
    classifier.classify([a, b]),
  ]);
  assert.equal(calls.flat().length, 2);
  assert.equal(results[0].length, 2);
  await classifier.classify([a]);
  assert.equal(calls.flat().length, 2);
});
test('failed batches are evicted and can be retried', async () => {
  let attempts = 0;
  const classifier = new Classifier(async (texts) => {
    if (++attempts === 1) throw new Error('Offline');
    return stub(texts);
  });
  await assert.rejects(classifier.classify(['NBP opublikował nowe dane o inflacji']));
  assert.equal(
    (await classifier.classify(['NBP opublikował nowe dane o inflacji']))[0].mode,
    'LIVE',
  );
});
test('runtime questions follow inspected OpenAPI and point at each headline', () => {
  const request = buildRequest(['First headline', 'Second headline'], 'jev-latest');
  assert.deepEqual(request.state.headlines, ['First headline', 'Second headline']);
  assert.equal(Object.keys(request.questions).length, 4);
  const question = request.questions.style_1 as {
    type: string;
    instructions: string;
    criteria: object;
  };
  assert.equal(question.type, 'choice');
  assert.match(question.instructions, /headlines\[1\]/);
  assert.equal(Object.keys(question.criteria).length, 8);
  assert.equal((request.questions.drive_0 as { criteria: string[] }).criteria.length, 6);
});
test('live response mapping rejects missing, unknown and out-of-range answers', () => {
  const payload = {
    answers: {
      style_0: { type: 'choice', choice: 'INFORMATIONAL', confidence: 0.9 },
      drive_0: { type: 'score', score: 0.5 },
    },
  };
  assert.equal(parseAnswers(['Headline'], payload)[0].mode, 'LIVE');
  assert.throws(() => parseAnswers(['Headline', 'Missing'], payload));
  payload.answers.style_0.choice = 'invented';
  assert.throws(() => parseAnswers(['Headline'], payload));
  payload.answers.style_0.choice = 'INFORMATIONAL';
  payload.answers.drive_0.score = 99;
  assert.throws(() => parseAnswers(['Headline'], payload));
});
