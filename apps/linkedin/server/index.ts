import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluateLive } from './jev.js';
import { normalize, type Judgment } from '../shared/model.js';
const port = Number(process.env.PORT || 4317);
const mode = 'live';
if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is required');
const cache = new Map<string, Promise<Judgment>>();
let active = 0;
const files: Record<string, string> = {
  '/': 'demo/linkedin-fixture.html',
  '/demo/linkedin-fixture.html': 'demo/linkedin-fixture.html',
  '/fixture.js': 'dist/demo/fixture.js',
  '/content.js': 'dist/chrome/content.js',
  '/demo.css': 'demo/demo.css',
};
createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const origin = req.headers.origin;
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`)
    return send(403, { error: 'Invalid host' });
  if (
    origin &&
    !/^chrome-extension:\/\/[a-p]{32}$|^moz-extension:\/\/[a-f0-9-]+$/.test(origin) &&
    origin !== `http://127.0.0.1:${port}` &&
    origin !== `http://localhost:${port}`
  )
    return send(403, { error: 'Origin not allowed' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
    res.writeHead(204);
    return res.end();
  }
  if (req.url === '/health') return send(200, { mode: mode.toUpperCase() });
  if (req.method === 'GET' && files[req.url || '']) {
    try {
      const path = files[req.url!];
      res.setHeader(
        'Content-Type',
        path.endsWith('.html')
          ? 'text/html'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/javascript',
      );
      res.end(await readFile(new URL('../' + path, import.meta.url)));
    } catch {
      send(404, { error: 'Run npm run build first' });
    }
    return;
  }
  if (req.method !== 'POST' || req.url !== '/analyze') return send(404, { error: 'Not found' });
  if (!req.headers['content-type']?.startsWith('application/json'))
    return send(415, { error: 'JSON required' });
  if (active >= 4) return send(429, { error: 'Busy; retry shortly' });
  active++;
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 100000) {
        send(413, { error: 'Batch too large' });
        return;
      }
    }
    const input = JSON.parse(body);
    if (
      !Array.isArray(input.posts) ||
      input.posts.length < 1 ||
      input.posts.length > 8 ||
      input.posts.some((p: unknown) => typeof p !== 'string' || p.length > 12000 || !p.trim())
    )
      return send(400, { error: 'Expected 1–8 nonempty post strings, max 12000 characters each' });
    const results = await Promise.all(
      input.posts.map((text: string) => {
        const normalized = normalize(text),
          hash = createHash('sha256').update(normalized).digest('hex');
        let pending = cache.get(hash);
        if (!pending) {
          pending = evaluateLive(normalized);
          cache.set(hash, pending);
          pending.catch(() => cache.delete(hash));
          if (cache.size > 1000) cache.delete(cache.keys().next().value!);
        }
        return pending;
      }),
    );
    send(200, { results });
  } catch (error) {
    send(502, {
      error:
        error instanceof SyntaxError
          ? 'Invalid JSON'
          : error instanceof Error
            ? error.message
            : 'Analysis failed',
    });
  } finally {
    active--;
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`LinkedIn BS Detector · Jev ${mode.toUpperCase()} · http://127.0.0.1:${port}`),
);
