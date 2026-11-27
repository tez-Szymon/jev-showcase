// Installs every demo's dependencies and builds the ones that serve bundled pages.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { apps } from '../hub/apps.mjs';
const only = process.argv.slice(2);
for (const app of apps.filter((a) => !only.length || only.includes(a.id))) {
  const cwd = new URL(`../apps/${app.id}/`, import.meta.url).pathname;
  const run = (args) => {
    console.log(`\n▸ ${app.id}: npm ${args.join(' ')}`);
    const r = spawnSync('npm', args, { cwd, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`${app.id}: npm ${args.join(' ')} failed`);
  };
  run([existsSync(cwd + 'package-lock.json') ? 'ci' : 'install', '--no-audit', '--no-fund']);
  if (app.build) run(['run', app.build]);
}
console.log('\nAll demos are ready. Run: npm start');
