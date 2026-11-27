import { mkdir, copyFile, writeFile } from 'node:fs/promises';
const matches = ['https://www.linkedin.com/*', 'https://www.facebook.com/*'];
for (const browser of ['chrome', 'firefox']) {
  const out = `dist/extension/${browser}`;
  await mkdir(out, { recursive: true });
  for (const file of ['shared.js', 'content.js', 'background.js', 'options.html', 'options.css', 'options.js']) {
    await copyFile(`extension/${file}`, `${out}/${file}`);
  }
  if (browser === 'chrome') {
    await writeFile(`${out}/worker.js`, "importScripts('shared.js', 'background.js');\n");
  }
  const manifest = {
    manifest_version: 3,
    name: 'Jev · filtr obrazów AI',
    version: '1.0.0',
    description: 'Oznacza lub ukrywa obrazy ocenione przez Jev jako wygenerowane przez AI na Facebooku i LinkedInie.',
    permissions: ['storage'],
    host_permissions: ['http://127.0.0.1:3000/*', 'https://*.licdn.com/*', 'https://*.fbcdn.net/*'],
    action: { default_popup: 'options.html', default_title: 'Jev · ustawienia filtra obrazów' },
    options_ui: { page: 'options.html', open_in_tab: true },
    content_scripts: [{ matches, js: ['shared.js', 'content.js'], run_at: 'document_idle' }],
    background: browser === 'chrome' ? { service_worker: 'worker.js' } : { scripts: ['shared.js', 'background.js'] },
    ...(browser === 'firefox' ? { browser_specific_settings: { gecko: {
      id: 'jev-image-filter@demo.local', strict_min_version: '140.0',
      data_collection_permissions: { required: ['websiteContent'] },
    } } } : {}),
  };
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}
console.log('Extension built: dist/extension/chrome and dist/extension/firefox');
