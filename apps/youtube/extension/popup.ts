import { defaults, statusLabel, type Settings } from '../shared/model.js';
let tabId: number | undefined;
const el = (id: string) => document.getElementById(id)!;
async function refresh() {
  if (!tabId) return;
  try {
    const state = await chrome.tabs.sendMessage(tabId, { type: 'status' });
    el('status').textContent =
      `Jev: ${statusLabel(state.mode)}${state.error ? ' · ' + state.error : ''}`;
    el('analyzed').textContent = state.analyzed;
    el('insights').textContent = state.insights;
    el('top').replaceChildren();
    for (const item of state.top) {
      const b = document.createElement('button');
      b.className = 'top-item';
      b.textContent = `${item.score}% · ${item.category}`;
      const small = document.createElement('small');
      small.textContent = item.text;
      b.append(small);
      b.onclick = () => chrome.tabs.sendMessage(tabId!, { type: 'scroll', id: item.id });
      el('top').append(b);
    }
    if (!state.top.length)
      el('top').textContent = 'Nie ma jeszcze komentarzy powyżej wybranego progu.';
  } catch {
    el('status').textContent = 'Otwórz film na YouTube, aby rozpocząć.';
  }
}
async function init() {
  const stored = (await chrome.storage.local.get({ ...defaults })) as unknown as Settings;
  for (const key of ['enabled', 'replies', 'debug'] as const)
    (el(key) as HTMLInputElement).checked = stored[key];
  (el('threshold') as HTMLInputElement).value = String(stored.threshold);
  el('value').textContent = String(stored.threshold);
  (el('mode') as HTMLSelectElement).value = stored.mode;
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    el(key).addEventListener('input', async () => {
      const input = el(key) as HTMLInputElement;
      const value =
        input.type === 'checkbox'
          ? input.checked
          : key === 'threshold'
            ? Number(input.value)
            : input.value;
      await chrome.storage.local.set({ [key]: value });
      if (key === 'threshold') el('value').textContent = String(value);
      await refresh();
    });
  }
  tabId = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  await refresh();
  setInterval(refresh, 1500);
  el('retry').onclick = async () => {
    if (tabId) await chrome.tabs.sendMessage(tabId, { type: 'retry' }).catch(() => {});
    await refresh();
  };
}
void init();
