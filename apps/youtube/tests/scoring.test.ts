import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalScore, normalize } from '../shared/model.js';
import { buildRequest, parseAnswers, evaluate } from '../server/jev.js';
test('normalized weighted score has correct endpoints', () => {
  assert.equal(
    finalScore({
      information: 5,
      perspective: 5,
      specificity: 5,
      substantive: 1,
      category: 'OTHER',
    }),
    100,
  );
  assert.equal(
    finalScore({
      information: 0,
      perspective: 0,
      specificity: 0,
      substantive: 0,
      category: 'OTHER',
    }),
    0,
  );
});
test('batches five independent questions per comment with explicit references', () => {
  const request = buildRequest(
    [
      { id: 'a', text: 'first' },
      { id: 'b', text: 'second' },
    ],
    'subject',
    'jev-latest',
  );
  assert.equal(Object.keys(request.questions).length, 10);
  assert.match(JSON.stringify(request.questions.c1_information), /comments\[1\]/);
});
test('rejects malformed and out-of-range API results', () => {
  assert.throws(() => parseAnswers({ answers: {} }, [{ id: 'a', text: 'text' }]));
});
test('upstream failure is reported as an error, never as fake results', async () => {
  const fetchBefore = globalThis.fetch,
    key = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'test';
  globalThis.fetch = async () => new Response('', { status: 503 });
  try {
    await assert.rejects(
      evaluate([{ id: 'a', text: 'Small correction: deprecated in v3.2' }], 'API'),
      /Jev HTTP 503/,
    );
  } finally {
    globalThis.fetch = fetchBefore;
    if (key === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = key;
  }
});
