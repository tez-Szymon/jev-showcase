const { api, settingsFrom } = globalThis.JevImages;
const enabled = document.querySelector('#enabled');
const threshold = document.querySelector('#threshold');
const mode = document.querySelector('#mode');
const value = document.querySelector('#value');
(async () => {
  try {
    const data = await api.storage.local.get('settings');
    const settings = settingsFrom(data.settings);
    enabled.checked = settings.enabled;
    threshold.value = settings.threshold;
    value.textContent = `${settings.threshold}%`;
    mode.value = settings.mode;
  } catch { document.querySelector('#status').textContent = 'Nie udało się odczytać ustawień.'; }
})();
threshold.addEventListener('input', () => { value.textContent = `${threshold.value}%`; });
document.querySelector('form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api.storage.local.set({ settings: settingsFrom({ enabled: enabled.checked, threshold: Number(threshold.value), mode: mode.value }) });
    document.querySelector('#status').textContent = 'Zapisano. Zmiany działają także w otwartych kartach.';
  } catch { document.querySelector('#status').textContent = 'Nie udało się zapisać ustawień.'; }
});
fetch('http://127.0.0.1:3000/api/status', { signal: AbortSignal.timeout(5000) })
  .then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(data => { document.querySelector('#connection').textContent = data.configured ? 'Serwer gotowy do analizy.' : 'Dodaj TYPESAFE_API_KEY do .env i uruchom ponownie serwer.'; })
  .catch(() => { document.querySelector('#connection').textContent = 'Serwer niedostępny. Uruchom npm run dev w projekcie.'; });
