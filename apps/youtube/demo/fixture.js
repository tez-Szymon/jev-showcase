const comments = [
  [
    'Maya Chen',
    'We deployed this architecture at roughly 20M requests/day. Cache invalidation becomes much more important with multiple regions. Versioned keys eliminated stale reads during our rolling deploys.',
  ],
  ['Alex Rivera', 'Thanks for the video!'],
  [
    'Nora Patel',
    'Small correction: this API became deprecated in v3.2. The replacement is invalidateTags(), which also covers nested resources.',
  ],
  ['Jamie K', 'LOL that part at 3:20 😂'],
  [
    'Sam Okafor',
    'We tried this approach for six months. It worked well for small customers, but once datasets exceeded ~50GB, eviction churn pushed p99 above 800ms. Splitting hot keys into a separate pool helped.',
  ],
  ['Chris M', '🔥🔥🔥'],
  [
    'Eli Santos',
    'However, caching every query adds a consistency trade-off. For account balances, a stale value can be worse than a slower response. I would keep those reads on the primary and cache only the history.',
  ],
  ['Taylor J', 'Great video, love this channel.'],
  [
    'Ravi Shah',
    'How would you prevent a cache stampede when a popular key expires across all regions simultaneously? Would a short lease plus stale-while-revalidate help?',
  ],
  ['Olivia W', "I've been waiting all week for this episode!"],
  [
    'Leo Park',
    'Reference: the Dynamo paper explains how version vectors resolve concurrent writes. Section 4.4 gives a useful comparison to last-write-wins.',
  ],
  ['Casey D', 'First!'],
  [
    'Zoe Martin',
    'For idempotency, store the request key and result atomically. Otherwise a worker crash between the write and the acknowledgement can repeat the side effect.',
  ],
  ['Pat T', 'This is garbage.'],
  [
    'Ava Brooks',
    'Small correction: PostgreSQL actually supports covering indexes with INCLUDE since version 11.',
  ],
  ['Jordan L', 'The algorithm brought me here.'],
  [
    'Noah Kim',
    'In our production setup, adding jitter to TTLs reduced peak origin traffic by 40%. We used a random offset of plus or minus 10% so keys did not expire together.',
  ],
  [
    'Robin F',
    'I have so many thoughts about this video. It is a video that really makes me think about things, and those things are very interesting. There is so much to say and so much to consider. At the end of the day, we all have opinions and this is certainly one of the videos of all time.',
  ],
  [
    'Isla Green',
    'The replication lag metric should measure the oldest unapplied event, not just queue length. A single blocked event can hide behind an otherwise empty queue.',
  ],
  ['Drew H', 'Who else is watching at 2am?'],
  [
    'Arjun Rao',
    'Counterpoint: a local in-process cache avoids network latency entirely. If you can tolerate a few seconds of staleness, broadcasting invalidations is often simpler than a shared remote cache.',
  ],
  ['Morgan P', 'Subscribed!'],
  [
    'Sofia Costa',
    'Could you explain how eviction policy changes under a Zipf distribution? I would expect LFU to outperform LRU when a small set of keys dominates reads.',
  ],
  ['Quinn S', '😂😂😂'],
  [
    'Ben Ellis',
    'The documentation for Redis describes lazy expiration and active sampling. That explains why an expired key may still occupy memory until cleanup runs.',
  ],
  ['Harper N', 'Amazing editing.'],
  [
    'Lena Novak',
    'Small correction: a cache miss is not an error. It should have its own metric rather than inflate your service error rate.',
  ],
  ['Sky R', 'You deserve a million subscribers.'],
  [
    'Omar Ali',
    'We ran a shadow workload before switching the eviction policy. Replaying the same keys exposed a 12% hit-rate regression that the uniform load test missed.',
  ],
  ['Finley B', 'I disagree with everything.'],
  [
    'Sasha Li',
    'What happens if the origin times out while the cache lock is held? Is there a maximum lease duration to prevent every reader from waiting indefinitely?',
  ],
  ['Lee A', 'Please make more videos.'],
];
const more = [
  [
    'Dana B',
    'We tried per-tenant cache quotas. One large tenant had been evicting every small tenant; partitioning the budget restored their hit rate.',
  ],
  ['Alex Rivera', 'Thanks for the video!'],
  ['Ari M', 'Small correction: this API became deprecated in v3.2.'],
  [
    'Bea C',
    'In our production incident, negative caching hid newly created accounts for five minutes. We now use a separate, shorter TTL for missing records.',
  ],
  ['Cam D', '💯'],
  [
    'Dev E',
    'How does the design handle a partial regional outage while preserving the same cache key namespace?',
  ],
  ['Em F', 'Great video!'],
  [
    'Fox G',
    'However, a higher hit rate does not imply lower latency if every lookup adds two network hops. Measure the end-to-end distribution.',
  ],
];
const panel = document.querySelector('#insight-panel');
let count = 0;
function append(items) {
  for (const [author, text] of items) {
    const el = document.createElement('article');
    el.className = 'comment';
    el.dataset.demoComment = '';
    el.innerHTML =
      '<div class="comment-header"><span class="avatar"></span><span class="author"></span><span class="time">2 dni temu</span></div><p data-comment-text></p><div class="comment-actions">♡ Lubię to ↩ Odpowiedz</div>';
    el.querySelector('.avatar').textContent = author
      .split(' ')
      .map((s) => s[0])
      .join('');
    el.querySelector('.author').textContent = author;
    el.querySelector('p').textContent = text;
    document.querySelector('#comments').append(el);
    count++;
  }
  document.querySelector('#comment-count').textContent = count;
}
append(comments);
document.querySelector('#load-more').onclick = () => append(more);
document.querySelector('#theme').onclick = () => document.body.classList.toggle('dark');
for (const id of ['enabled', 'threshold', 'mode', 'replies', 'debug'])
  document.getElementById(id).addEventListener('input', (e) => {
    const input = e.target;
    const value =
      input.type === 'checkbox'
        ? input.checked
        : id === 'threshold'
          ? Number(input.value)
          : input.value;
    if (id === 'threshold') document.querySelector('#value').textContent = value;
    panel.dispatchEvent(new CustomEvent('insight-settings', { detail: { [id]: value } }));
  });
document.querySelector('#retry').onclick = () => panel.dispatchEvent(new Event('insight-retry'));
panel.addEventListener('insight-state', (e) => {
  const state = e.detail;
  for (const id of ['analyzed', 'insights']) document.getElementById(id).textContent = state[id];
  document.querySelector('#engine-mode').textContent =
    { WAITING: 'OCZEKIWANIE', OFFLINE: 'BRAK POŁĄCZENIA' }[state.mode] || state.mode;
  document.querySelector('#status').textContent =
    state.error ||
    'Niezależne oceny połączone w kodzie.';
  const top = document.querySelector('#top');
  top.replaceChildren();
  for (const item of state.top.slice(0, 5)) {
    const b = document.createElement('button');
    b.className = 'top-item';
    const score = document.createElement('strong');
    score.textContent = item.score + '%';
    const text = document.createElement('span');
    text.textContent = item.category;
    const small = document.createElement('small');
    small.textContent = item.text;
    text.append(small);
    b.append(score, text);
    b.onclick = () => panel.dispatchEvent(new CustomEvent('insight-scroll', { detail: item.id }));
    top.append(b);
  }
  if (!state.top.length) top.textContent = 'Nie ma jeszcze komentarzy powyżej tego progu.';
});
