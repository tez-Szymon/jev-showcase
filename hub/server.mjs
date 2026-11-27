// Jev showcase hub: starts every demo as a child process (real TypeSafe API only)
// and serves a tabbed page that embeds each one.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apps, HUB_PORT } from './apps.mjs';
import { loadEnv } from './env.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const only = process.argv.slice(2);
const selected = apps.filter((a) => !only.length || only.includes(a.id));
const state = new Map();

const colors = [36, 35, 33, 32, 34, 91, 96];
function start(app, i) {
  const s = state.get(app.id) ?? { logs: [], health: null };
  Object.assign(s, { status: 'starting', child: null, missing: [], health: null });
  state.set(app.id, s);
  const log = (line) => {
    s.logs.push(line);
    if (s.logs.length > 300) s.logs.shift();
    process.stdout.write(`\x1b[${colors[i % colors.length]}m${app.id.padEnd(9)}\x1b[0m ${line}\n`);
  };
  const cwd = `${root}apps/${app.id}`;
  if (!existsSync(`${cwd}/node_modules`)) {
    s.status = 'not-installed';
    return log('dependencies missing — run `npm run setup`');
  }
  const env = loadEnv(root + '.env'); // re-read so keys added later apply on restart
  const childEnv = { ...env, ...app.env(env), FORCE_COLOR: '0' };
  delete childEnv.JEV_MODE;
  s.missing = app.requires.filter((k) => !childEnv[k]).map((k) => app.keyHint?.[k] ?? k);
  if (s.missing.length) {
    s.status = 'missing-key';
    return log(`not started: set ${s.missing.join(', ')} in jev-showcase/.env`);
  }
  const child = spawn(app.command[0], app.command.slice(1), {
    cwd,
    env: childEnv,
    detached: true, // own process group, so we can stop dev servers and their workers
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  s.child = child;
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) if (l.trim()) log(l.replace(/\x1b\[[0-9;]*m/g, ''));
    });
  }
  child.on('exit', (code) => {
    s.status = 'stopped';
    s.health = null;
    s.child = null;
    log(`exited with code ${code}`);
  });
}

async function probe(app) {
  const s = state.get(app.id);
  if (!s?.child) return;
  try {
    const healthPath = app.card?.health ?? (app.extension ? '/health' : null);
    const r = await fetch(`http://127.0.0.1:${app.port}${healthPath ?? app.path}`, {
      signal: AbortSignal.timeout(4000),
    });
    s.status = r.status < 500 ? 'running' : 'error';
    if (healthPath) s.health = r.ok ? await r.json() : null;
  } catch {
    if (s.status === 'running') s.status = 'error';
  }
}
setInterval(() => selected.forEach(probe), 3000).unref();

function stop(id) {
  const s = state.get(id);
  if (!s?.child) return;
  s.status = 'stopping';
  try {
    process.kill(-s.child.pid, 'SIGTERM');
  } catch {}
}
function stopAll() {
  for (const s of state.values())
    if (s.child)
      try {
        process.kill(-s.child.pid, 'SIGTERM');
      } catch {}
}
process.on('SIGINT', () => (stopAll(), process.exit(0)));
process.on('SIGTERM', () => (stopAll(), process.exit(0)));
process.on('exit', stopAll);

const json = (res, code, data) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/apps')
    return json(
      res,
      200,
      selected.map(({ id, name, blurb, port, path, extension, card, sites, firefox }) => {
        const s = state.get(id);
        const hasCard = !!(extension || card);
        return {
          id,
          name,
          blurb,
          url: `http://127.0.0.1:${port}${path}`,
          port,
          extension: !!extension,
          card: hasCard
            ? { name: card?.name ?? name, blurb: card?.blurb ?? blurb, dist: `${root}apps/${id}/${card?.dist ?? 'dist'}` }
            : null,
          sites,
          firefox,
          status: s.status,
          missing: s.missing,
          health: s.health,
        };
      }),
    );
  const logs = url.pathname.match(/^\/api\/logs\/([a-z]+)$/);
  if (logs && state.has(logs[1])) return json(res, 200, state.get(logs[1]).logs.slice(-120));
  const action = url.pathname.match(/^\/api\/(start|stop)\/([a-z]+)$/);
  if (action && req.method === 'POST' && state.has(action[2])) {
    const i = selected.findIndex((a) => a.id === action[2]);
    if (action[1] === 'stop') stop(action[2]);
    else if (!state.get(action[2]).child) start(selected[i], i);
    return json(res, 202, { ok: true });
  }
  const restart = url.pathname.match(/^\/api\/restart\/([a-z]+)$/);
  if (restart && req.method === 'POST' && state.has(restart[1])) {
    const i = selected.findIndex((a) => a.id === restart[1]);
    const s = state.get(restart[1]);
    if (s.child) {
      s.child.removeAllListeners('exit');
      s.child.on('exit', () => start(selected[i], i));
      process.kill(-s.child.pid, 'SIGTERM');
    } else start(selected[i], i);
    return json(res, 202, { ok: true });
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await readFile(new URL('./public/index.html', import.meta.url)));
  }
  json(res, 404, { error: 'Not found' });
}).listen(HUB_PORT, '127.0.0.1', () => {
  console.log(`\nJev showcase → http://127.0.0.1:${HUB_PORT}\n`);
  selected.forEach((app, i) => {
    if (app.extension) state.set(app.id, { status: 'stopped', logs: [], child: null, missing: [] });
    else start(app, i);
  });
});
