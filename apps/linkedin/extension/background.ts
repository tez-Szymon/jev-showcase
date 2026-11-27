import { api } from './api.js';
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'analyze') return;
  if (
    !sender.tab?.url ||
    !/^https:\/\/www\.linkedin\.com\/|^http:\/\/(127\.0\.0\.1|localhost):4317\//.test(
      sender.tab.url,
    )
  ) {
    respond({ error: 'Nieobsługiwana strona' });
    return;
  }
  fetch('http://127.0.0.1:4317/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ posts: message.posts }),
    signal: AbortSignal.timeout(30000),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Serwer: HTTP ${r.status}`);
      return r.json();
    })
    .then(respond)
    .catch((error) => respond({ error: error.message }));
  return true;
});
