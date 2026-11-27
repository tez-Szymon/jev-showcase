import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
for (const browser of ['chrome', 'firefox']) {
  const out = `dist/${browser}`;
  await mkdir(out, { recursive: true });
  await build({
    entryPoints: ['extension/content.ts', 'extension/background.ts', 'extension/popup.ts'],
    bundle: true,
    outdir: out,
    format: 'iife',
    target: ['chrome120', 'firefox121'],
  });
  for (const file of ['content.css', 'popup.css', 'popup.html'])
    await copyFile(`extension/${file}`, `${out}/${file}`);
  const manifest = {
    manifest_version: 3,
    name: 'YouTube Insight Filter',
    version: '1.0.0',
    description: 'Odkrywaj wartościowe informacje i perspektywy w komentarzach YouTube dzięki Jev.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['http://127.0.0.1:4318/*'],
    action: { default_popup: 'popup.html' },
    background:
      browser === 'chrome' ? { service_worker: 'background.js' } : { scripts: ['background.js'] },
    content_scripts: [
      {
        matches: ['https://www.youtube.com/*'],
        js: ['content.js'],
        css: ['content.css'],
        run_at: 'document_idle',
      },
    ],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: { id: 'youtube-insight-filter@local.demo', strict_min_version: '121.0' },
          },
        }
      : {}),
  };
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}
await build({
  entryPoints: ['extension/content.ts'],
  bundle: true,
  outfile: 'dist/demo.js',
  format: 'iife',
  target: 'es2022',
});
console.log('Built Chrome, Firefox, and fixture bundles.');
