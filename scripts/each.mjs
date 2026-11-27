// Runs an npm script in every demo that defines it: node scripts/each.mjs test
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { apps } from '../hub/apps.mjs';
const script = process.argv[2];
let failed = [];
for (const { id } of apps) {
  const cwd = new URL(`../apps/${id}/`, import.meta.url).pathname;
  if (!JSON.parse(readFileSync(cwd + 'package.json', 'utf8')).scripts?.[script]) continue;
  console.log(`\n▸ ${id}: npm run ${script}`);
  if (spawnSync('npm', ['run', script], { cwd, stdio: 'inherit' }).status !== 0) failed.push(id);
}
if (failed.length) (console.error(`\nFailed: ${failed.join(', ')}`), process.exit(1));
