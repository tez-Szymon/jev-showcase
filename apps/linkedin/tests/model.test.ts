import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, normalize, settingsFrom, type Judgment } from '../shared/model.js';
import { parseAnswers, questions } from '../server/jev.js';
const strong: Judgment = {
  scores: { concreteness: 5, actionable: 5, selfPromotion: 0, platitudes: 0 },
  confidence: { concreteness: 1, actionable: 1, selfPromotion: 1, platitudes: 1 },
  insight: 1,
  mode: 'LIVE',
};
test('formula anchors, bounds, sensitivity and labels', () => {
  assert.equal(assess(strong).bs, 0);
  const fluff: Judgment = {
    ...strong,
    scores: { concreteness: 0, actionable: 0, selfPromotion: 5, platitudes: 5 },
    insight: 0,
  };
  assert.equal(assess(fluff).bs, 100);
  assert.equal(assess(fluff, 100).bs, 100);
  assert.equal(assess(strong, 0).bs, 0);
  assert.ok(
    assess({ ...strong, scores: { ...strong.scores, concreteness: 2 } }, 80).bs >
      assess({ ...strong, scores: { ...strong.scores, concreteness: 2 } }, 20).bs,
  );
  assert.deepEqual(assess(strong).labels, ['ACTUALLY_USEFUL']);
  assert.deepEqual(
    assess({ ...strong, confidence: { ...strong.confidence, concreteness: 0.2 } }).labels,
    [],
  );
});
test('normalization and settings bounds', () => {
  assert.equal(normalize(' A\n  B '), 'A B');
  assert.equal(settingsFrom({ minLength: -5, sensitivity: 200 }).minLength, 0);
  assert.equal(settingsFrom({ sensitivity: 200 }).sensitivity, 100);
});
test('current Jev request uses four six-level Scores and one Noul', () => {
  assert.equal(Object.keys(questions).length, 5);
  for (const key of ['concreteness', 'actionable', 'selfPromotion', 'platitudes'])
    assert.equal((questions[key].criteria as string[]).length, 6);
  assert.equal(questions.insight.type, 'noul');
});
test('Jev parser rejects malformed or out-of-range responses', () => {
  assert.throws(() => parseAnswers({}));
  assert.throws(() =>
    parseAnswers({ answers: { concreteness: { type: 'score', score: 6, confidence: 1 } } }),
  );
  const answers = Object.fromEntries(
    Object.entries(strong.scores).map(([k, v]) => [k, { type: 'score', score: v, confidence: 1 }]),
  );
  assert.deepEqual(
    parseAnswers({ answers: { ...answers, insight: { type: 'noul', noul: 1 } } }),
    strong,
  );
});
test('live transport sends text-only state with named questions and rejects upstream errors', async () => {
  const { evaluateLive } = await import('../server/jev.js');
  const oldFetch = globalThis.fetch,
    oldKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'test-only-placeholder';
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, 'https://api.typesafe.ai/v1/systemone');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.state, { postText: 'Example text' });
      assert.equal(body.questions.insight.type, 'noul');
      assert.equal(Object.keys(body.questions).length, 5);
      return new Response('{}', { status: 429 });
    };
    await assert.rejects(evaluateLive('Example text'), /HTTP 429/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = oldKey;
  }
});
