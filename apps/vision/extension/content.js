(() => {
  if (document.querySelector('jev-image-filter')) return;
  const { api, settingsFrom, imageUrl } = globalThis.JevImages;
  // LinkedIn legacy + SDUI selectors adapted from jev-linkedin-demo/extractor.ts.
  const linkedInCards = '[data-urn^="urn:li:activity:"], [data-id^="urn:li:activity:"], [data-view-name="feed-full-update"], .feed-shared-update-v2, .occludable-update, main [role="article"]';
  const commentary = '[data-testid="expandable-text-box"], [componentkey^="feed-commentary"], .update-components-text';
  const excluded = 'aside, nav, header, [role="dialog"], [componentkey^="comment-"], [data-view-name*="comment-thread"], .comments-comment-item, .comments-comment-list, .comments-comment-entity, [data-visualcompletion="ignore-dynamic"]';
  const facebook = location.hostname === 'www.facebook.com';
  let settings = settingsFrom();
  const records = new Map();
  const results = new Map();
  const inFlight = new Map();
  let active = 0;
  let timer;
  let frame;
  const host = document.createElement('jev-image-filter');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483646!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{font:13px/1.4 system-ui,sans-serif;color:#fff}
    .panel{position:fixed;box-sizing:border-box;pointer-events:none;overflow:hidden;border-radius:8px}
    .cover{background:#183b32;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:16px;pointer-events:auto}
    .badge{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px;padding:7px 10px;border-radius:7px;background:#183b32;box-shadow:0 2px 10px #0003;max-width:calc(100% - 16px);pointer-events:auto}
    .error{background:#5e431c}
    button{font:inherit;border:1px solid #ffffff70;border-radius:5px;padding:5px 9px;background:#fff;color:#183b32;cursor:pointer}
    button:focus-visible{outline:3px solid #f1c65e;outline-offset:2px}
    small{display:block;font-size:11px;opacity:.85}
  </style>`;
  document.documentElement.append(host);
  const hideStyle = document.createElement('style');
  hideStyle.textContent = 'img[data-jev-ai-hidden]{visibility:hidden!important}';
  document.documentElement.append(hideStyle);

  function source(img) { return imageUrl(img.currentSrc || img.src); }
  function eligible(img) {
    if (img.closest(excluded)) return false;
    const rect = img.getBoundingClientRect();
    if (rect.width < 180 || rect.height < 140 || !img.complete || img.naturalWidth < 180 || img.naturalHeight < 140) return false;
    if (facebook) return Boolean(img.closest('[role="article"], [data-pagelet^="FeedUnit_"]'));
    if (img.closest(linkedInCards)) return true;
    const card = img.closest('main [role="listitem"], main article');
    return Boolean(card?.querySelector(commentary));
  }
  function near(img) {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }
  function clear(record) {
    record.panel?.remove();
    record.panel = null;
    record.signature = '';
    record.img.removeAttribute('data-jev-ai-hidden');
  }
  function render(record) {
    const result = record.result;
    const flagged = result && result.probability * 100 >= settings.threshold;
    if (source(record.img) !== record.url || !settings.enabled || !near(record.img) || (!flagged && !record.error)) { clear(record); return; }
    const hidden = flagged && settings.mode === 'hide' && !record.revealed;
    const signature = `${hidden}:${record.revealed}:${result?.probability}:${record.error || ''}`;
    if (record.signature !== signature) {
      clear(record);
      record.signature = signature;
      const panel = document.createElement('div');
      panel.className = hidden ? 'panel cover' : 'panel';
      const body = document.createElement('div');
      body.className = hidden ? '' : `badge${record.error ? ' error' : ''}`;
      const label = document.createElement('span');
      label.textContent = record.error ? 'Analiza niedostępna' : `Możliwe AI · ${Math.round(result.probability * 100)}%`;
      label.title = record.error || `Ocena modelu ${result.model || 'Jev'}. To nie jest dowód pochodzenia obrazu.`;
      body.append(label);
      const button = document.createElement('button');
      button.type = 'button';
      if (record.error) {
        button.textContent = 'Ponów';
        button.onclick = event => { event.preventDefault(); event.stopPropagation(); record.error = ''; clear(record); schedule(); };
        body.append(button);
      } else if (settings.mode === 'hide') {
        button.textContent = hidden ? 'Pokaż obraz' : 'Ukryj ponownie';
        button.onclick = event => { event.preventDefault(); event.stopPropagation(); record.revealed = !record.revealed; render(record); position(); };
        body.append(button);
      }
      if (hidden) {
        const note = document.createElement('small');
        note.textContent = 'Obraz ukryty na podstawie oceny Jev';
        body.append(note);
        record.img.setAttribute('data-jev-ai-hidden', '');
      }
      panel.append(body);
      shadow.append(panel);
      record.panel = panel;
    }
  }
  function position() {
    frame = undefined;
    for (const record of records.values()) {
      render(record);
      if (!record.panel) continue;
      const r = record.img.getBoundingClientRect();
      Object.assign(record.panel.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    }
  }
  function schedule() {
    if (timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; scan(); }, 200);
  }
  async function analyze(record) {
    const url = record.url;
    record.pending = true;
    active++;
    try {
      let task = inFlight.get(url);
      if (!task) {
        task = api.runtime.sendMessage({ type: 'jev-analyze-image', url });
        inFlight.set(url, task);
      }
      const response = await task;
      if (!response || response.error) throw new Error(response?.error || 'Brak odpowiedzi serwera.');
      if (!Number.isFinite(response.probability) || response.probability < 0 || response.probability > 1) throw new Error('Niepoprawny wynik.');
      results.set(url, response);
      if (results.size > 500) results.delete(results.keys().next().value);
      if (source(record.img) === url && records.get(record.img) === record) record.result = response;
    } catch (error) {
      if (source(record.img) === url && records.get(record.img) === record) record.error = error.message;
    } finally {
      inFlight.delete(url);
      record.pending = false;
      active--;
      schedule();
    }
  }
  function scan() {
    for (const [img, record] of records) {
      if (!img.isConnected || source(img) !== record.url || !eligible(img)) {
        clear(record); records.delete(img);
      }
    }
    if (settings.enabled) {
      const scope = document.querySelector('main, [role="main"]') || document;
      for (const img of scope.querySelectorAll('img')) {
        if (!eligible(img)) continue;
        const url = source(img);
        if (!url) continue;
        if (!records.has(img)) records.set(img, { img, url, revealed: false });
      }
      for (const record of records.values()) {
        if (results.has(record.url)) record.result = results.get(record.url);
        if (near(record.img) && !record.result && !record.error && !record.pending && active < 2) void analyze(record);
      }
    }
    position();
  }
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    settings = settingsFrom(changes.settings.newValue);
    for (const record of records.values()) { record.revealed = false; clear(record); }
    schedule();
  });
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['src', 'srcset', 'sizes', 'data-urn', 'data-id', 'role', 'data-pagelet'],
  });
  document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement) schedule(); }, true);
  document.addEventListener('scroll', () => { if (frame === undefined) frame = requestAnimationFrame(position); schedule(); }, true);
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  api.storage.local.get('settings').then(data => { settings = settingsFrom(data.settings); schedule(); });
})();
