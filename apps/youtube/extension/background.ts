chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'analyze') return;
  if (!sender.tab || !sender.url || !/^https:\/\/www\.youtube\.com\//.test(sender.url)) {
    respond({ error: 'Nieobsługiwana strona' });
    return;
  }
  fetch('http://127.0.0.1:4318/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments: message.comments, subject: message.subject }),
    signal: AbortSignal.timeout(25000),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('Lokalny serwer jest niedostępny');
      respond(await r.json());
    })
    .catch(() =>
      respond({ error: 'Lokalny serwer jest wyłączony. Uruchom npm run dev i ponów próbę.' }),
    );
  return true;
});
