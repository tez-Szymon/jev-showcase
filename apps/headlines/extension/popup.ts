import { labels, modeLabel } from '../shared/polish.js';
import { api } from './api.js';
import { defaults, type Settings } from '../shared/types.js';
const $ = (id: string) => document.getElementById(id)!;
let settings: Settings = defaults;
let mode = '';
function paint() {
  for (const key of Object.keys(defaults) as (keyof Settings)[])
    ($(key) as HTMLInputElement).checked = settings[key];
  $('status').textContent = settings.enabled ? 'Analiza włączona' : 'Analiza wyłączona';
  $('preview').textContent = [
    settings.category ? labels.CURIOSITY_GAP : 'ANALIZA',
    settings.confidence ? '91%' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
async function activeTab() {
  return (await api.tabs.query({ active: true, currentWindow: true }))[0];
}
async function init() {
  settings = {
    ...defaults,
    ...((await api.storage.local.get('settings')).settings as Partial<Settings>),
  };
  paint();
  for (const key of Object.keys(defaults) as (keyof Settings)[])
    $(key).addEventListener('change', async () => {
      settings[key] = ($(key) as HTMLInputElement).checked;
      await api.storage.local.set({ settings });
      paint();
    });
  try {
    const health = await api.runtime.sendMessage({ type: 'health' });
    if (health.error) throw new Error(health.error);
    $('mode').textContent = `Tryb Jev: ${modeLabel(health.mode)}`;
    $('dot').style.background = health.mode === 'LIVE' ? '#548467' : '#bc9450';
    mode = health.mode;
    paint();
  } catch {
    $('mode').textContent = 'Serwer niedostępny';
    $('message').textContent =
      'Uruchom npm start w folderze projektu. Następnie otwórz ponownie ten panel.';
  }
  try {
    const tab = await activeTab();
    if (tab.id) {
      const status = await api.tabs.sendMessage(tab.id, { type: 'pageStatus' });
      $('message').textContent =
        status.error || `Oznaczone nagłówki na tej stronie: ${status.count}.`;
    }
  } catch {
    if (!$('message').textContent)
      $('message').textContent =
        'Otwórz portal informacyjny lub stronę demonstracyjną. Odśwież karty otwarte przed instalacją.';
  }
}
$('reanalyze').addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!tab.id) throw new Error();
    await api.tabs.sendMessage(tab.id, { type: 'reanalyze' });
    $('message').textContent =
      'Trwa analiza widocznych nagłówków. Zapisane wyniki zostaną użyte ponownie.';
  } catch {
    $('message').textContent =
      'Nie można przeanalizować tej strony. Otwórz portal informacyjny i odśwież kartę.';
  }
});
void init();
