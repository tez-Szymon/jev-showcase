import { labels, descriptions, modeLabel } from '../shared/polish.js';
import { api } from './api.js';
import { defaults, normalize, type Result, type Settings } from '../shared/types.js';
import { extract, genericSelectors } from './sites/generic.js';
import { onetSelectors } from './sites/onet.js';
import { wpSelectors } from './sites/wp.js';
const hostname = location.hostname;
const site = /(^|\.)onet\.pl$/.test(hostname)
  ? 'onet'
  : /(^|\.)wp\.pl$/.test(hostname)
    ? 'wp'
    : 'other';
const selectors = [
  ...(site === 'onet' ? onetSelectors : site === 'wp' ? wpSelectors : []),
  ...genericSelectors,
];
const marker = 'data-headline-lens-processed';
let settings: Settings = defaults;
let running = false,
  timer = 0,
  generation = 0;
let lastError = '';
let retryAt = 0;
const rendered = new Map<HTMLElement, { text: string; host: HTMLElement; result: Result }>();
const colors: Record<string, string> = {
  INFORMATIONAL: '#286952',
  CURIOSITY_GAP: '#7858a5',
  SENSATIONAL: '#a05a1c',
  ALARMIST: '#a63f48',
  OUTRAGE_CONFLICT: '#985072',
  EMOTIONAL: '#a25d78',
  PROMOTIONAL: '#3869a0',
  OTHER: '#65716d',
};
function enabled() {
  return settings.enabled && settings[site];
}
function visible(node: HTMLElement) {
  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.bottom > 0 &&
    box.top < innerHeight &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}
function badge(node: HTMLElement, result: Result) {
  if (!node.isConnected) return;
  const host = document.createElement('span');
  host.dataset.headlineLensUi = 'badge';
  host.lang = 'pl';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{display:inline-block;vertical-align:middle;margin:5px 6px 5px 0;line-height:1.4}button{font:600 9px/1.5 system-ui,sans-serif;letter-spacing:.055em;border:1px solid ${colors[result.category]}40;border-radius:4px;color:${colors[result.category]};background:${colors[result.category]}0c;padding:3px 6px;cursor:help;text-align:left}button:focus-visible{outline:2px solid #264f44}dialog{position:fixed;max-width:540px;width:80vw;border:1px solid #d5ddd8;border-radius:14px;padding:22px;background:#fff;color:#243c34;box-shadow:0 20px 90px #0003;font:13px/1.6 system-ui}dialog::backdrop{background:#14251c50}pre{white-space:pre-wrap;overflow-wrap:anywhere}dialog button{font-size:12px;cursor:pointer}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = [
    settings.category ? labels[result.category] : 'ANALIZA',
    settings.confidence ? `${Math.round(result.confidence * 100)}%` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  button.title = [
    `Kategoria: ${labels[result.category]}`,
    settings.confidence ? `Pewność klasyfikacji: ${Math.round(result.confidence * 100)}%` : '',
    settings.score
      ? `Nastawienie na kliknięcie: ${result.clickDriveScore.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`
      : '',
    descriptions[result.category],
    `Tryb Jev: ${modeLabel(result.mode)}`,
    'Pewność dotyczy klasyfikacji stylu, a nie prawdziwości informacji.',
  ]
    .filter(Boolean)
    .join('\n');
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!settings.debug) return;
    const dialog = document.createElement('dialog');
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(result, null, 2);
    const close = document.createElement('button');
    close.textContent = 'Zamknij';
    close.onclick = () => dialog.close();
    dialog.append(pre, close);
    root.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
  });
  root.append(style, button);
  // Place outside the article link, preserving its navigation and accessible name.
  const anchor = node.closest('a');
  (anchor ?? node).after(host);
  node.setAttribute(marker, normalize(result.text));
  rendered.set(node, { text: result.text, host, result });
}
function reset() {
  generation++;
  for (const [node, item] of rendered) {
    item.host.remove();
    node.removeAttribute(marker);
  }
  rendered.clear();
  retryAt = 0;
  lastError = '';
  schedule();
}
async function scan() {
  if (running || !enabled() || Date.now() < retryAt) return;
  running = true;
  const epoch = generation;
  try {
    for (const [node, item] of rendered)
      if (
        !node.isConnected ||
        normalize(node.textContent ?? '') !== normalize(item.text) ||
        !item.host.isConnected
      ) {
        item.host.remove();
        node.removeAttribute(marker);
        rendered.delete(node);
      }
    const nodes = extract(selectors).filter((node) => !node.hasAttribute(marker) && visible(node));
    const groups = new Map<string, { text: string; nodes: HTMLElement[] }>();
    for (const node of nodes) {
      const text = node.textContent!.replace(/\s+/g, ' ').trim();
      const key = normalize(text);
      if (!groups.has(key)) groups.set(key, { text, nodes: [] });
      groups.get(key)!.nodes.push(node);
    }
    const entries = [...groups.values()];
    for (let i = 0; i < entries.length; i += 20) {
      if (epoch !== generation || !enabled()) break;
      const batch = entries.slice(i, i + 20);
      const response = await api.runtime.sendMessage({
        type: 'classify',
        texts: batch.map((entry) => entry.text),
      });
      if (response.error) throw new Error(response.error);
      if (epoch !== generation || !enabled()) break;
      response.results.forEach((result: Result, j: number) =>
        batch[j].nodes.forEach((node) => {
          if (normalize(node.textContent ?? '') === normalize(result.text)) badge(node, result);
        }),
      );
      lastError = '';
    }
  } catch (error) {
    lastError =
      'Nie udało się przeanalizować nagłówków. Sprawdź lokalny serwer i spróbuj ponownie.';
    retryAt = Date.now() + 15000;
  } finally {
    running = false;
    if (epoch !== generation) schedule();
  }
}
function schedule() {
  clearTimeout(timer);
  timer = window.setTimeout(() => void scan(), 250);
}
api.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'reanalyze') {
    reset();
    respond({ ok: true });
  }
  if (message.type === 'pageStatus') respond({ count: rendered.size, error: lastError, site });
});
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    settings = { ...defaults, ...(changes.settings.newValue as Partial<Settings>) };
    reset();
  }
});
void api.storage.local.get('settings').then((data) => {
  settings = { ...defaults, ...(data.settings as Partial<Settings>) };
  new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          !(r.target instanceof Element && r.target.closest('[data-headline-lens-ui]')) &&
          (r.type === 'characterData' ||
            r.type === 'attributes' ||
            [...r.addedNodes, ...r.removedNodes].some(
              (n) => !(n instanceof Element && n.hasAttribute('data-headline-lens-ui')),
            )),
      )
    )
      schedule();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href', 'class', 'style', 'hidden'],
  });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  setInterval(schedule, 15000);
  schedule();
});
