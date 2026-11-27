import { build } from 'esbuild';
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
const common = {
  manifest_version: 3,
  name: 'Headline Lens',
  version: '1.0.0',
  description:
    'Sprawdź styl nagłówków wiadomości. Kategorie oceniane przez Jev i lokalny tryb demonstracyjny.',
  permissions: ['storage', 'activeTab'],
  host_permissions: ['http://localhost:3001/*'],
  action: { default_popup: 'popup.html', default_title: 'Headline Lens' },
  content_scripts: [
    { matches: ['http://*/*', 'https://*/*'], js: ['content.js'], run_at: 'document_idle' },
  ],
};
await rm('dist', { recursive: true, force: true });
for (const browser of ['chrome', 'firefox']) {
  const outdir = `dist/${browser}`;
  await mkdir(outdir, { recursive: true });
  await build({
    entryPoints: ['extension/content.ts', 'extension/background.ts', 'extension/popup.ts'],
    bundle: true,
    outdir,
    format: 'iife',
    target: ['chrome120', 'firefox140'],
  });
  const manifest =
    browser === 'chrome'
      ? {
          ...common,
          minimum_chrome_version: '120',
          background: { service_worker: 'background.js' },
        }
      : {
          ...common,
          background: { scripts: ['background.js'] },
          browser_specific_settings: {
            gecko: {
              id: 'headline-lens@local.demo',
              strict_min_version: '142.0',
              data_collection_permissions: { required: ['websiteContent'] },
            },
          },
        };
  await writeFile(`${outdir}/manifest.json`, JSON.stringify(manifest, null, 2));
  for (const file of ['popup.html', 'popup.css'])
    await copyFile(`extension/${file}`, `${outdir}/${file}`);
}
console.log('Built dist/chrome and dist/firefox');
