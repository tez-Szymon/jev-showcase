import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { evaluate, models } from './jev.js';
import { normalize, type Comment, type Result } from '../shared/model.js';
const port = Number(process.env.PORT || 4318);
const cache = new Map<string, { result: Result; expires: number }>();
let serial = Promise.resolve();
const stats = { batches: 0, cacheHits: 0, evaluated: 0 };
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const allowed =
    !origin ||
    /^(chrome-extension|moz-extension):\/\/[a-zA-Z0-9-]+$/.test(origin) ||
    [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(origin);
  if (!allowed || ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host || '')) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  const json = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname;
  try {
    if (path === '/health') {
      json(200, {
        mode: 'LIVE',
        ...stats,
      });
      return;
    }
    if (path === '/models') {
      json(200, await models());
      return;
    }
    if (path === '/analyze' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) {
        json(415, { error: 'JSON required' });
        return;
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100000) {
          json(413, { error: 'Batch too large' });
          return;
        }
      }
      const data = JSON.parse(body);
      if (
        !Array.isArray(data.comments) ||
        !data.comments.length ||
        data.comments.length > 12 ||
        typeof data.subject !== 'string' ||
        data.subject.length > 500 ||
        data.comments.some(
          (c: Comment) =>
            typeof c.id !== 'string' ||
            c.id.length > 200 ||
            typeof c.text !== 'string' ||
            !c.text.trim() ||
            c.text.length > 6000,
        )
      ) {
        json(400, {
          error:
            'Expected 1–12 comments, text up to 6000 characters, and subject up to 500 characters',
        });
        return;
      }
      stats.batches++;
      const work = serial.then(async () => {
        const keys = data.comments.map((c: Comment) =>
          createHash('sha256')
            .update(data.subject + '\0' + normalize(c.text))
            .digest('hex'),
        ) as string[];
        const missing = new Map<string, Comment>();
        keys.forEach((key, i) => {
          if ((cache.get(key)?.expires || 0) > Date.now()) stats.cacheHits++;
          else if (missing.has(key)) stats.cacheHits++;
          else missing.set(key, { id: key, text: normalize(data.comments[i].text) });
        });
        if (missing.size) {
          const results = await evaluate([...missing.values()], data.subject);
          stats.evaluated += missing.size;
          for (const result of results) {
            cache.set(result.id, {
              result,
              expires: Date.now() + (result.warning ? 30000 : 3600000),
            });
            if (cache.size > 2000) cache.delete(cache.keys().next().value!);
          }
        }
        return keys.map((key, i) => ({ ...cache.get(key)!.result, id: data.comments[i].id }));
      });
      serial = work.then(
        () => {},
        () => {},
      );
      json(200, { results: await work });
      return;
    }
    const files: Record<string, string> = {
      '/': 'demo/youtube-comments.html',
      '/demo/youtube-comments.html': 'demo/youtube-comments.html',
      '/demo/fixture.js': 'demo/fixture.js',
      '/demo/style.css': 'demo/style.css',
      '/dist/demo.js': 'dist/demo.js',
      '/dist/content.css': 'dist/chrome/content.css',
    };
    if (files[path]) {
      const file = files[path];
      res.writeHead(200, {
        'Content-Type':
          extname(file) === '.html'
            ? 'text/html'
            : extname(file) === '.css'
              ? 'text/css'
              : 'text/javascript',
        'Content-Security-Policy':
          "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'",
      });
      res.end(await readFile(resolve(file)));
      return;
    }
    json(404, { error: 'Not found' });
  } catch {
    json(502, { error: 'Analiza jest niedostępna. Komentarze pozostają bez zmian.' });
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`YouTube Insight Filter: http://127.0.0.1:${port}`),
);
