import { modeLabel } from '../shared/polish.js';
import { describeFeed } from './diagnostics.js';
import { api } from './api.js';
import { settingsFrom, type Settings } from '../shared/model.js';
async function main() {
  const settings = settingsFrom((await api.storage.local.get('settings')).settings || {});
  const status = document.querySelector<HTMLElement>('#status')!;
  const feedStatus = document.querySelector<HTMLElement>('#feed-status')!;
  async function checkFeed() {
    try {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No tab');
      const result = await api.tabs.sendMessage(tab.id, { type: 'feed-status' });
      feedStatus.textContent = describeFeed(result);
    } catch {
      feedStatus.textContent =
        'Brak połączenia ze stroną. Po przeładowaniu dodatku odśwież kartę LinkedIna. Sprawdź, czy dodatek ma dostęp do tej witryny.';
    }
  }
  document.getElementById('check-feed')!.addEventListener('click', () => void checkFeed());
  void checkFeed();
  const level = document.querySelector<HTMLOutputElement>('#level')!;
  function updateLevel() {
    level.value =
      settings.sensitivity < 35 ? 'Łagodna' : settings.sensitivity > 65 ? 'Surowa' : 'Umiarkowana';
  }
  for (const key of Object.keys(settings) as (keyof Settings)[]) {
    const input = document.getElementById(key) as HTMLInputElement;
    if (typeof settings[key] === 'boolean') input.checked = settings[key] as boolean;
    else input.value = String(settings[key]);
    input.addEventListener('change', async () => {
      const next = {
        ...settings,
        [key]: input.type === 'checkbox' ? input.checked : Number(input.value),
      };
      Object.assign(settings, settingsFrom(next));
      await api.storage.local.set({ settings });
      updateLevel();
      status.textContent = 'Zapisano';
      void checkFeed();
    });
  }
  updateLevel();
  document.getElementById('reanalyze')!.addEventListener('click', async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    try {
      if (!tab.id) throw new Error();
      await api.tabs.sendMessage(tab.id, { type: 'reanalyze' });
      status.textContent = 'Odświeżono widoczne posty. Wykorzystano zapisane oceny.';
    } catch {
      status.textContent =
        'Brak połączenia ze stroną. Odśwież kartę LinkedIna i sprawdź uprawnienia dodatku.';
    }
  });
  try {
    const r = await fetch('http://127.0.0.1:4317/health', { signal: AbortSignal.timeout(3000) });
    const data = await r.json();
    document.getElementById('mode')!.textContent = modeLabel(data.mode);
  } catch {
    document.getElementById('mode')!.textContent = 'Serwer niedostępny';
  }
}
void main();
