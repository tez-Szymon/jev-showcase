import { readFileSync, existsSync } from 'node:fs';
// Minimal .env reader (KEY=value, # comments). Process env wins over the file.
export function loadEnv(path) {
  const out = {};
  if (existsSync(path))
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  for (const [k, v] of Object.entries(process.env)) if (v) out[k] = v;
  return out;
}
