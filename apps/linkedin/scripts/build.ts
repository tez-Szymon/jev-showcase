import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
for (const browser of ['chrome', 'firefox']) {
  const out = `dist/${browser}`;
  await mkdir(out, { recursive: true });
  await build({
    entryPoints: ['extension/content.ts', 'extension/background.ts', 'extension/popup.ts'],
    outdir: out,
    bundle: true,
    format: 'iife',
    target: ['chrome120', 'firefox128'],
    sourcemap: true,
  });
  for (const name of ['popup.html', 'popup.css'])
    await copyFile(`extension/${name}`, `${out}/${name}`);
  const manifest = {
    manifest_version: 3,
    name: 'LinkedIn: Detektor lania wody',
    version: '1.0.2',
    description: 'Wskaźnik lania wody z analizą Jev. Ocenia treść postów, nigdy ludzi.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://www.linkedin.com/*', 'http://127.0.0.1:4317/*'],
    action: { default_popup: 'popup.html' },
    content_scripts: [
      {
        matches: [
          'https://www.linkedin.com/*',
          'http://127.0.0.1:4317/*',
          'http://localhost:4317/*',
        ],
        js: ['content.js'],
      },
    ],
    background:
      browser === 'chrome' ? { service_worker: 'background.js' } : { scripts: ['background.js'] },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'linkedin-bs-detector@demo.local',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['websiteContent'] },
            },
          },
        }
      : {}),
  };
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}
await build({
  entryPoints: ['demo/fixture.ts'],
  outfile: 'dist/demo/fixture.js',
  bundle: true,
  format: 'iife',
  target: 'es2022',
});
console.log('Built Chrome, Firefox and demo bundles.');
