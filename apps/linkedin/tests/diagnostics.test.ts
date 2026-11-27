import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeFeed, type FeedStatus } from '../extension/diagnostics.js';
const ready: FeedStatus = {
  version: '1.0.1',
  ready: true,
  enabled: true,
  cards: 2,
  near: 2,
  readable: 2,
  eligible: 2,
  rendered: 2,
  pending: 0,
  failures: 0,
  minLength: 120,
};
test('feed diagnostics distinguish detection, extraction, length and transport failures', () => {
  assert.match(describeFeed({ ...ready, cards: 0 }), /nie wykryto postów/);
  assert.match(describeFeed({ ...ready, readable: 0 }), /nie rozpoznano ich tekstu/);
  assert.match(describeFeed({ ...ready, eligible: 0 }), /120 znaków/);
  assert.match(describeFeed({ ...ready, failures: 1 }), /Nieudane analizy/);
  assert.match(describeFeed({ ...ready, error: 'Storage unavailable' }), /Storage unavailable/);
  assert.match(describeFeed(ready), /wskaźniki: 2/);
});
