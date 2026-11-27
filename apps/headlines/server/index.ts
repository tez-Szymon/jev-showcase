import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { classifyJev, listModels } from './jev.js';
import { Classifier } from './classifier.js';
const key = process.env.TYPESAFE_API_KEY?.trim() ?? '';
if (!key) throw new Error('TYPESAFE_API_KEY is required');
const mode = 'LIVE';
const model = process.env.TYPESAFE_MODEL || 'jev-latest';
const classifier = new Classifier((texts) => classifyJev(texts, key, model));
const port = Number(process.env.PORT || 3001);
const server = createServer(async (req, res) => {
  const reply = (code: number, data: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  // No wildcard CORS: content scripts delegate requests to the extension background.
  const origin = req.headers.origin;
  if (req.headers.host !== `localhost:${port}` && req.headers.host !== `127.0.0.1:${port}`)
    return reply(403, { error: 'Invalid host' });
  if (
    origin &&
    !/^(chrome-extension|moz-extension):\/\/[a-zA-Z0-9-]+$/.test(origin) &&
    origin !== `http://localhost:${port}` &&
    origin !== `http://127.0.0.1:${port}`
  )
    return reply(403, { error: 'Origin denied' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.writeHead(204);
    return res.end();
  }
  try {
    if (req.method === 'GET' && req.url === '/health')
      return reply(200, {
        mode,
        model,
        classified: classifier.classified,
        batches: classifier.batches,
      });
    if (req.method === 'GET' && req.url === '/models')
      return reply(200, await listModels(key));
    if (req.method === 'GET' && (req.url === '/' || req.url === '/fixture')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await readFile(new URL('../fixture/index.html', import.meta.url)));
    }
    if (req.method !== 'POST' || req.url !== '/classify') return reply(404, { error: 'Not found' });
    if (!req.headers['content-type']?.startsWith('application/json'))
      return reply(415, { error: 'Use application/json' });
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 20000) return reply(413, { error: 'Body too large' });
    }
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      return reply(400, { error: 'Invalid JSON' });
    }
    const texts = (input as { texts?: unknown })?.texts;
    if (
      !Array.isArray(texts) ||
      texts.length < 1 ||
      texts.length > 20 ||
      !texts.every((t) => typeof t === 'string' && t.trim().length >= 12 && t.length <= 400)
    )
      return reply(400, { error: 'texts must contain 1–20 headlines, each 12–400 characters' });
    reply(200, { mode, results: await classifier.classify(texts) });
  } catch (error) {
    reply(502, { error: error instanceof Error ? error.message : 'Classification failed' });
  }
});
server.requestTimeout = 30000;
server.listen(port, '127.0.0.1', () =>
  console.log(`Headline Lens • ${mode} • http://localhost:${port}/fixture`),
);
