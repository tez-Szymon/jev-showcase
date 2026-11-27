import {
  defaults,
  label,
  normalize,
  type Settings,
  type Result,
  type Comment,
} from '../shared/model.js';
const demo = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const selector =
  'ytd-comment-thread-renderer ytd-comment-view-model, ytd-comment-thread-renderer ytd-comment-renderer, [data-demo-comment]';
interface Entry {
  element: HTMLElement;
  text: string;
  id: string;
  result?: Result;
  pending?: boolean;
}
const entries = new Map<HTMLElement, Entry>();
const cached = new Map<string, Result>();
let settings: Settings = { ...defaults },
  counter = 0,
  busy = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  error = '',
  mode = 'WAITING',
  generation = 0;
let subject = title();
function title() {
  return (
    document.querySelector('.video-caption h2, h1 yt-formatted-string, h1')?.textContent ||
    document.title
  )
    .trim()
    .slice(0, 500);
}
function textOf(el: HTMLElement) {
  return normalize(el.querySelector('#content-text, [data-comment-text]')?.textContent || '');
}
function included(el: HTMLElement) {
  return settings.replies || !el.closest('ytd-comment-replies-renderer, [data-reply]');
}
function scan() {
  for (const [el, e] of entries)
    if (!el.isConnected || textOf(el) !== e.text) {
      clear(el);
      entries.delete(el);
    }
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (!included(el) || entries.has(el)) return;
    const text = textOf(el);
    if (!text || text.length > 6000) return;
    const e: Entry = { element: el, text, id: `insight-${++counter}` };
    entries.set(el, e);
  });
  schedule();
}
function schedule() {
  if (!timer && settings.enabled)
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, 200);
}
async function hash(text: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(subject + '\0' + text),
  );
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
}
async function flush() {
  if (busy || !settings.enabled) return;
  const candidates = [...entries.values()].filter(
    (e) => !e.result && !e.pending && included(e.element),
  );
  if (!candidates.length) return;
  busy = true;
  const epoch = generation;
  const group = candidates.slice(0, 12);
  group.forEach((e) => (e.pending = true));
  try {
    const keys = await Promise.all(group.map((e) => hash(e.text)));
    const unique = new Map<string, Comment>();
    keys.forEach((key, i) => {
      if (!cached.has(key)) unique.set(key, { id: key, text: group[i].text });
    });
    if (unique.size) {
      const payload = { type: 'analyze', comments: [...unique.values()], subject };
      const response = demo
        ? await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25000),
          }).then((r) => {
            if (!r.ok) throw new Error('Lokalny serwer jest niedostępny');
            return r.json();
          })
        : await chrome.runtime.sendMessage(payload);
      if (response.error || !Array.isArray(response.results))
        throw new Error(response.error || 'Nieprawidłowa odpowiedź serwera');
      for (const r of response.results as Result[]) cached.set(r.id, r);
      if (cached.size > 2000) cached.delete(cached.keys().next().value!);
    }
    if (epoch !== generation) return;
    group.forEach((e, i) => {
      const result = cached.get(keys[i]);
      if (result && e.element.isConnected && textOf(e.element) === e.text) {
        e.result = result;
        e.element.dataset.ytInsightAnalyzed = 'true';
        mode = result.mode;
        render(e);
      }
    });
    error = group.find((e) => e.result?.warning)?.result?.warning || '';
  } catch (err) {
    error = err instanceof Error ? err.message : 'Analiza jest niedostępna';
    mode = 'OFFLINE';
  } finally {
    group.forEach((e) => (e.pending = false));
    busy = false;
    updatePanel();
    if (mode !== 'OFFLINE') schedule();
  }
}
function clear(el: HTMLElement) {
  el.classList.remove('yif-useful', 'yif-strong', 'yif-dim', 'yif-collapse');
  el.querySelector(':scope > .yif-details')?.remove();
  delete el.dataset.ytInsightAnalyzed;
}
function render(e: Entry) {
  const el = e.element;
  clear(el);
  if (!e.result || !settings.enabled || !included(el)) return;
  el.dataset.ytInsightAnalyzed = 'true';
  const r = e.result,
    good = r.score >= settings.threshold;
  el.classList.toggle('yif-useful', good);
  el.classList.toggle('yif-strong', good && r.score >= 85);
  el.classList.toggle('yif-dim', !good && settings.mode === 'dim');
  el.classList.toggle('yif-collapse', !good && settings.mode === 'only');
  if (!good && !settings.debug) return;
  const details = document.createElement('details');
  details.className = 'yif-details';
  const summary = document.createElement('summary');
  summary.textContent = `${r.score >= 85 ? '✦ Wartościowy komentarz' : 'Ciekawa perspektywa'} · ${r.score}% · ${label(r.category)} · ${r.mode}`;
  const info = `Ocena wartości: ${r.score}%\nInformacje: ${r.information.toFixed(1)} / 5\nPerspektywa: ${r.perspective.toFixed(1)} / 5\nKonkretność: ${r.specificity.toFixed(1)} / 5\nMerytoryczny: ${r.substantive >= 0.5 ? 'TAK' : 'NIE'} · ${Math.round(r.substantive * 100)}%\nRodzaj: ${label(r.category)}\nOcena wartości wypowiedzi, nie jej prawdziwości.`;
  summary.title = info;
  const pre = document.createElement('pre');
  pre.textContent = info;
  details.append(summary, pre);
  if (settings.debug) {
    const debug = document.createElement('pre');
    debug.textContent = `DANE WEJŚCIOWE JEV\n${JSON.stringify(r.debug?.input, null, 2)}\nWYNIK JEV\n${JSON.stringify(r.debug?.output, null, 2)}\nOCENA KOŃCOWA\n${r.score} = round(8 × information + 6 × perspective + 4 × specificity + 10 × substantive)`;
    details.append(debug);
  }
  el.prepend(details);
}
function snapshot() {
  const analyzed = [...entries.values()].filter(
    (e) => e.element.isConnected && included(e.element) && e.result,
  );
  return {
    settings,
    mode,
    error,
    analyzed: analyzed.length,
    insights: analyzed.filter((e) => e.result!.score >= settings.threshold).length,
    top: analyzed
      .filter((e) => e.result!.score >= settings.threshold)
      .sort((a, b) => b.result!.score - a.result!.score)
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        score: e.result!.score,
        category: label(e.result!.category),
        text: e.text.slice(0, 95),
      })),
  };
}
function scroll(id: string) {
  const e = [...entries.values()].find((e) => e.id === id);
  if (e) {
    e.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    e.element.setAttribute('tabindex', '-1');
    e.element.focus({ preventScroll: true });
  }
}
function apply(next: Partial<Settings>) {
  settings = { ...settings, ...next };
  for (const e of entries.values()) render(e);
  scan();
  updatePanel();
}
let panel: HTMLElement | undefined;
function updatePanel() {
  if (panel) panel.dispatchEvent(new CustomEvent('insight-state', { detail: snapshot() }));
}
if (demo) {
  panel = document.querySelector<HTMLElement>('#insight-panel')!;
  panel.addEventListener('insight-settings', ((event: CustomEvent) =>
    apply(event.detail)) as EventListener);
  panel.addEventListener('insight-scroll', ((event: CustomEvent) =>
    scroll(event.detail)) as EventListener);
  panel.addEventListener('insight-retry', () => {
    error = '';
    schedule();
  });
} else {
  chrome.storage.local.get({ ...defaults }).then((s) => {
    apply(s);
  });
  chrome.storage.onChanged.addListener((changes) => {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) if (k in defaults) next[k] = v.newValue;
    apply(next);
  });
  chrome.runtime.onMessage.addListener((m, _s, respond) => {
    if (m.type === 'status') respond(snapshot());
    if (m.type === 'scroll') {
      scroll(m.id);
      respond({ ok: true });
    }
    if (m.type === 'retry') {
      error = '';
      schedule();
      respond({ ok: true });
    }
  });
}
const observer = new MutationObserver((records) => {
  if (
    records.some(
      (r) => !(r.target instanceof Element && r.target.closest('.yif-details, #insight-panel')),
    )
  ) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 100);
  }
});
let scanTimer: ReturnType<typeof setTimeout>;
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
document.addEventListener('yt-navigate-finish', () => {
  generation++;
  for (const e of entries.values()) clear(e.element);
  entries.clear();
  subject = title();
  error = '';
  scan();
});
scan();
updatePanel();
