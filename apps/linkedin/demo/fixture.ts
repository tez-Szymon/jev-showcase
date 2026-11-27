import { modeLabel } from '../shared/polish.js';
import { defaults, settingsFrom, type Settings } from '../shared/model.js';
const posts = [
  [
    'Alex Morgan',
    'Building things. Learning out loud.',
    'Your comfort zone is a beautiful place. But nothing ever grows there.\n\nWake up. Show up. Hustle. Believe in your potential. The journey is the reward. Leadership is a mindset, not a title.\n\nUnlock your dreams. Inspire the future. Synergy starts with YOU. Agree?',
  ],
  [
    'Sam Rivera',
    'Engineer · databases & distributed systems',
    'We cut p95 query latency from 840ms to 95ms in our billing service.\n\nThe query filtered by tenant_id and sorted by created_at, but our index only covered tenant_id. A composite index on (tenant_id, created_at DESC) removed the sort.\n\nFirst run EXPLAIN ANALYZE on a realistic sample. Then compare buffers and execution time before and after. Check write latency too: our inserts became 6% slower. This helps read-heavy tables; it is not a free win.',
  ],
  [
    'Jordan Lee',
    'On a very humbling journey',
    'Humbled. Honored. Beyond grateful.\n\nI never imagined my little side hustle would hit a million in revenue and win this award. Thrilled to be named a Top Voice while launching my book and my course.\n\nI share this not to brag, but to inspire. Your journey can change everything.',
  ],
  [
    'Taylor Chen',
    'Curious about what comes next',
    'I asked an AI what the future of work looks like.\n\nIts answer changed everything. AI is a game-changer. We must unlock its potential to revolutionize leadership and inspire a new mindset.\n\nThe future belongs to those who embrace the journey. Are you ready?',
  ],
  [
    'Morgan Patel',
    'Product operations',
    'Our onboarding experiment failed. The shorter form increased sign-ups from 31% to 38%, but week-4 activation fell from 22% to 16%. Sample: 2,400 users, randomized over 4 weeks.\n\nWe had removed the use-case question that routed people to relevant examples. We restored it and kept the other cuts.\n\nBefore optimizing completion, check a downstream outcome. This sample excluded enterprise accounts, so we cannot generalize to them.',
  ],
  [
    'Casey Brooks',
    'Conversations that matter',
    'Unpopular opinion: the best leaders listen.\n\nLet that sink in.\n\nMost people will scroll past this. The top 1% will understand. The secret? A growth mindset and an unstoppable hustle.\n\nAgree? Comment YES if you believe. Follow for part two.',
  ],
  [
    'Jamie Walsh',
    'Learning to manage',
    'Last month I gave a teammate feedback in a public review. They stopped asking questions for two weeks. I thought I was being efficient. I was making it harder to admit uncertainty.\n\nNow I ask privately whether they want feedback in the meeting or afterward. First ask permission, then describe one concrete behavior and its impact. Check a week later whether it helped. That small change brought questions back.',
  ],
  [
    'Robin Ellis',
    'Founder · The Growth Playbook',
    'Thrilled to launch my course! Proud to share the system behind my million-dollar journey.\n\nMy book has already inspired thousands. Now you can unlock your potential too. Sign up today, buy the workbook, and join the leadership revolution.\n\nYour future self will thank you.',
  ],
  [
    'Drew Kim',
    'Measuring what matters',
    'Our support team received 1,284 tickets in August, compared with 1,610 in July. Median first response was 46 minutes versus 71.\n\nThe largest drop was password-reset requests after adding a recovery link. These are descriptive metrics, not causal proof: August also had 12% fewer active users.\n\nUse tickets per active user before celebrating raw volume reductions.',
  ],
  [
    'Avery Singh',
    'Backend engineer',
    'A retry loop made our outage worse. Each client retried immediately, so the queue tripled during recovery.\n\nUse exponential backoff with jitter and a retry budget. First check whether the operation is idempotent. Then cap attempts at 3 and measure total retry traffic.\n\nTest by injecting a 503 response for 30 seconds. We now alert when retries exceed 10% of requests.',
  ],
  [
    'Quinn Davis',
    'Notes from the messy middle',
    'I used to say yes to every meeting because I wanted to help. Last week I tracked them: 19 hours, with no decision recorded in 11 of the 14 meetings.\n\nBefore accepting, I now ask for the decision we need and the person who owns it. Try canceling one recurring meeting for two weeks and check whether anyone misses its output. Some will matter. Keep those.',
  ],
  [
    'Riley Jones',
    'Leadership enthusiast',
    'Coffee in hand. Vision in mind. Fire in my soul.\n\nLeadership is not a destination. It is a journey. Success is a mindset. Failure is fuel. Dreams are the blueprint. Believe in your potential.\n\nLet us unlock synergy and inspire the future. This is your sign to hustle harder. Agree?',
  ],
];
let inserted = 0;
function addPost(post: string[], index: number) {
  const article = document.createElement('article');
  article.className = 'post';
  article.dataset.bsPost = String(index);
  article.setAttribute('aria-label', `Autor posta: ${post[0]}`);
  const head = document.createElement('div');
  head.className = 'post-head';
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.style.setProperty('--avatar', ['#e0e7d8', '#e8dfd2', '#dce5e7', '#e6dfeb'][index % 4]);
  avatar.textContent = post[0]
    .split(' ')
    .map((x) => x[0])
    .join('');
  const info = document.createElement('div');
  for (const [cls, text] of [
    ['author', post[0]],
    ['role', post[1]],
    ['time', `${index + 1} godz. · ◉`],
  ]) {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = text;
    info.append(div);
  }
  const more = document.createElement('span');
  more.className = 'more';
  more.textContent = '···';
  head.append(avatar, info, more);
  const text = document.createElement('div');
  text.className = 'post-text';
  text.dataset.postText = '';
  text.textContent = post[2];
  const footer = document.createElement('div');
  footer.className = 'post-footer';
  footer.textContent =
    '♡ Poleć                         ◯ Skomentuj                         ↗ Udostępnij';
  article.append(head, text, footer);
  document.getElementById('feed')!.append(article);
}
posts.forEach(addPost);
document.getElementById('load-more')!.onclick = () => {
  inserted++;
  addPost(
    [
      'New arrival',
      'Inserted dynamically',
      `Update ${inserted}: We measured the queue after 30 minutes. Latency fell from 900ms to 120ms because we capped retries. First test with a failed request, then compare the sample before enabling this for everyone. Check for duplicate writes; use an idempotency key.`,
    ],
    12 + inserted,
  );
  document.querySelector('.sample-count')!.textContent = `Przykładowe posty: ${12 + inserted}`;
};
const settings: Settings = { ...defaults };
for (const key of Object.keys(settings) as (keyof Settings)[]) {
  const input = document.getElementById(key) as HTMLInputElement;
  input.oninput = () => {
    Object.assign(
      settings,
      settingsFrom({
        ...settings,
        [key]: input.type === 'checkbox' ? input.checked : Number(input.value),
      }),
    );
    document.getElementById('level')!.textContent =
      settings.sensitivity < 35 ? 'Łagodna' : settings.sensitivity > 65 ? 'Surowa' : 'Umiarkowana';
    document.dispatchEvent(new CustomEvent('bs-settings', { detail: settings }));
  };
}
document.getElementById('reanalyze')!.onclick = () =>
  document.dispatchEvent(new Event('bs-reanalyze'));
fetch('/health')
  .then((r) => r.json())
  .then((data) => {
    document.getElementById('mode')!.textContent = `● ${modeLabel(data.mode)}`;
  })
  .catch(() => {
    document.getElementById('mode')!.textContent = 'Serwer niedostępny';
  });

// Give a document-idle extension the first opportunity to own the fixture.
setTimeout(() => {
  if (document.documentElement.getAttribute('data-bs-detector-active') === 'extension') {
    document
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input,.controls button')
      .forEach((input) => (input.disabled = true));
    document.querySelector('.privacy')!.textContent =
      'Dodatek jest aktywny. Zmieniaj ustawienia w jego oknie na pasku przeglądarki.';
  } else if (!document.documentElement.hasAttribute('data-bs-detector-active')) {
    const script = document.createElement('script');
    script.src = '/content.js';
    document.body.append(script);
  }
}, 350);
