import 'dotenv/config';
import express from 'express';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { createApp } from './app.js';

const app = createApp({ apiKey: process.env.TYPESAFE_API_KEY, model: process.env.TYPESAFE_MODEL });
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => console.log(`Jev vision playground: http://localhost:${port}`));
