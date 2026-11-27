import { api } from './api.js';
import {
  defaults,
  normalize,
  settingsFrom,
  type Judgment,
  type Settings,
} from '../shared/model.js';
import { cards, extract } from './extractor.js';
import { widget } from './widget.js';
import type { FeedStatus } from './diagnostics.js';
const extension = !!api?.runtime?.id;
const isFixture = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
let startupError: string | undefined;
let getStatus: () => FeedStatus = () => ({
  version: extension ? api.runtime.getManifest().version : 'standalone',
  ready: false,
  enabled: true,
  cards: 0,
  near: 0,
  readable: 0,
  eligible: 0,
  rendered: 0,
  pending: 0,
  failures: 0,
  minLength: 120,
  error: startupError,
});
if (extension)
  api.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === 'feed-status') {
      respond(getStatus());
      return false;
    }
  });
// A fixture can load this same bundle directly; avoid running twice when installed.
if (!document.documentElement.hasAttribute('data-bs-detector-active')) {
  document.documentElement.setAttribute(
    'data-bs-detector-active',
    extension ? 'extension' : 'standalone',
  );
  void start().catch((error) => {
    startupError = error instanceof Error ? error.message : 'Nie udało się uruchomić dodatku';
    console.error('LinkedIn BS Detector:', startupError);
  });
}
async function start() {
  let settings: Settings = extension
    ? settingsFrom((await api.storage.local.get('settings')).settings || {})
    : { ...defaults };
  const near = new Set<HTMLElement>(),
    known = new Set<HTMLElement>(),
    pending = new Set<string>();
  const cache = new Map<string, Judgment>(),
    errors = new Map<string, string>();
  const hashes = new Map<string, string>();
  let busy = false,
    dirty = true,
    rerun = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  getStatus = () => {
    const nearby = [...near].filter((card) => card.isConnected);
    return {
      version: extension ? api.runtime.getManifest().version : 'standalone',
      ready: true,
      enabled: settings.enabled,
      cards: known.size,
      near: nearby.length,
      readable: [...known].filter((card) => !!extract(card)).length,
      eligible: nearby.filter(
        (card) => extract(card).length >= settings.minLength && !!extract(card),
      ).length,
      rendered: document.querySelectorAll('linkedin-bs-meter').length,
      pending: pending.size,
      failures: nearby.filter((card) => !!card.querySelector(':scope > .bs-status')).length,
      minLength: settings.minLength,
      error: startupError,
    };
  };
  async function hash(text: string) {
    let h = hashes.get(text);
    if (h) return h;
    h = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalize(text))),
      ),
    ]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (hashes.size > 1000) hashes.delete(hashes.keys().next().value!);
    hashes.set(text, h);
    return h;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) near.add(e.target as HTMLElement);
        else near.delete(e.target as HTMLElement);
      }
      schedule();
    },
    { rootMargin: '250px' },
  );
  function scan() {
    for (const card of known)
      if (!card.isConnected) {
        observer.unobserve(card);
        known.delete(card);
        near.delete(card);
      }
    for (const card of cards())
      if (!known.has(card)) {
        known.add(card);
        observer.observe(card);
      }
  }
  function schedule() {
    // A trailing debounce can be starved forever by LinkedIn's continuous mutations.
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      void process().catch((error) => {
        startupError =
          error instanceof Error ? error.message : 'Analiza aktualności nie powiodła się';
      });
    }, 200);
  }
  function clear(card: HTMLElement) {
    card.querySelector(':scope > linkedin-bs-meter, :scope > .bs-status')?.remove();
    delete card.dataset.bsRendered;
  }
  function render(card: HTMLElement, text: string, h: string) {
    const signature = `${h}:${JSON.stringify(settings)}`;
    if (
      card.dataset.bsRendered === signature &&
      card.querySelector(':scope > linkedin-bs-meter, :scope > .bs-status')
    )
      return;
    clear(card);
    const judgment = cache.get(h);
    if (judgment) {
      card.append(widget(judgment, settings));
      card.dataset.bsRendered = signature;
    } else if (errors.has(h)) {
      const status = document.createElement('button');
      status.className = 'bs-status';
      status.textContent = 'Analiza niedostępna · kliknij, aby ponowić';
      status.title = errors.get(h)!;
      status.style.cssText =
        'display:block;max-width:100%;margin:10px 0;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#755f41;cursor:pointer';
      status.onclick = () => {
        errors.delete(h);
        clear(card);
        schedule();
      };
      card.append(status);
      card.dataset.bsRendered = signature;
    }
  }
  async function process() {
    if (busy) {
      rerun = true;
      return;
    }
    if (dirty) {
      dirty = false;
      scan();
    }
    if (!settings.enabled) return;
    busy = true;
    try {
      const batch = new Map<string, string>();
      for (const card of near) {
        if (!card.isConnected) continue;
        const text = extract(card);
        if (text.length < settings.minLength || !text) {
          clear(card);
          continue;
        }
        const h = await hash(text);
        if (cache.has(h) || errors.has(h)) render(card, text, h);
        else if (!pending.has(h) && batch.size < 8) batch.set(h, text);
      }
      if (!batch.size) return;
      const entries = [...batch];
      entries.forEach(([h]) => pending.add(h));
      try {
        const posts = entries.map(([, text]) => text);
        const response = extension
          ? await api.runtime.sendMessage({ type: 'analyze', posts })
          : await fetch('/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ posts }),
              signal: AbortSignal.timeout(30000),
            }).then((r) => r.json());
        if (response.error || response.results?.length !== entries.length)
          throw new Error(response.error || 'Nieprawidłowa odpowiedź serwera');
        entries.forEach(([h], i) => {
          cache.set(h, response.results[i]);
          if (cache.size > 1000) cache.delete(cache.keys().next().value!);
        });
      } catch (error) {
        entries.forEach(([h]) =>
          errors.set(h, error instanceof Error ? error.message : 'Serwer niedostępny'),
        );
      } finally {
        entries.forEach(([h]) => pending.delete(h));
      }
      schedule();
    } finally {
      busy = false;
      if (rerun) {
        rerun = false;
        schedule();
      }
    }
  }
  function apply(next: Settings) {
    settings = next;
    for (const card of known) clear(card);
    if (settings.enabled) schedule();
  }
  function reanalyze() {
    dirty = true;
    startupError = undefined;
    for (const card of near) clear(card);
    errors.clear();
    schedule();
  }
  if (extension) {
    api.storage.onChanged.addListener((changes) => {
      if (changes.settings) apply(settingsFrom(changes.settings.newValue || {}));
    });
    api.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message.type === 'reanalyze') {
        reanalyze();
        respond({ ok: true });
        return false;
      }
    });
  } else if (isFixture) {
    document.addEventListener('bs-settings', (event) =>
      apply(settingsFrom((event as CustomEvent).detail)),
    );
    document.addEventListener('bs-reanalyze', reanalyze);
  }
  new MutationObserver((records) => {
    if (
      records.every(
        (r) =>
          (r.target as Element).closest?.('linkedin-bs-meter,.bs-status') ||
          (r.type === 'childList' &&
            [...r.addedNodes, ...r.removedNodes].every(
              (n) => n instanceof Element && n.matches('linkedin-bs-meter,.bs-status'),
            )),
      )
    )
      return;
    dirty = true;
    schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
}
