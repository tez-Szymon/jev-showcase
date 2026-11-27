import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { prepareImage } from './prepare-image.js';
import { aiImageQuestion } from './ai-image.js';
import { APIError, image, TypeSafeClient } from '@typesafe-ai/sdk';
import type { Question } from '@typesafe-ai/sdk';
import { buildQuestion, InputError } from './questions.js';
import type { Evaluation } from '../src/types.js';

type Evaluate = (buffer: Buffer, question: Question) => Promise<Evaluation['raw']>;

export function createApp(options: { apiKey?: string; model?: string; evaluate?: Evaluate; client?: TypeSafeClient } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024, files: 1, fields: 4, fieldSize: 256 * 1024 } });
  const model = options.model || 'jev-preview';
  const client = options.client || (options.apiKey ? new TypeSafeClient({ apiKey: options.apiKey, timeout: 60000, retry: { maxRetries: 1 } }) : null);

  app.get('/api/status', (_req, res) => res.json({ configured: Boolean(client || options.evaluate), model }));

  app.post('/api/image', upload.single('image'), async (req, res) => {
    if (!req.file) throw new InputError('Wybierz zdjęcie do przesłania.');
    const { buffer, info } = await prepareImage(req.file.buffer);
    res.json({ dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`, width: info.width, height: info.height, size: buffer.length });
  });

  // Accept bytes, never remote URLs: the server cannot be used as an SSRF proxy.
  app.post('/api/detect-ai', upload.single('image'), async (req, res) => {
    if (!client && !options.evaluate) return res.status(503).json({ error: 'Dodaj TYPESAFE_API_KEY do pliku .env i uruchom ponownie serwer.' });
    if (!req.file) throw new InputError('Prześlij obraz do analizy.');
    const { buffer } = await prepareImage(req.file.buffer, true);
    const start = performance.now();
    const raw = options.evaluate
      ? await options.evaluate(buffer, aiImageQuestion)
      : await client!.systemOne({ model, state: { photo: image(new Uint8Array(buffer)) }, questions: { result: aiImageQuestion } },
        { headers: { 'TypeSafe-Danger-Zone-Images': 'true' } });
    const answer = raw.answers.result;
    if (answer?.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) {
      throw new Error('Invalid upstream probability');
    }
    res.json({ probability: answer.noul, model: raw.model, elapsedMs: Math.round(performance.now() - start) });
  });

  app.post('/api/evaluate', upload.single('image'), async (req, res) => {
    if (!client && !options.evaluate) return res.status(503).json({ error: 'Dodaj TYPESAFE_API_KEY do pliku .env i uruchom ponownie serwer.' });
    if (!req.file) throw new InputError('Najpierw prześlij zdjęcie.');
    let criteria: unknown;
    try { criteria = JSON.parse(req.body.criteria || '[]'); } catch { throw new InputError('Niepoprawna lista kryteriów.'); }
    const question = buildQuestion(req.body.type, req.body.prompt, criteria);
    try {
      const metadata = await sharp(req.file.buffer).metadata();
      if (!['jpeg', 'png'].includes(metadata.format || '') || (metadata.pages || 1) > 1 || !metadata.width || !metadata.height ||
        metadata.width < 280 || metadata.height < 280 || metadata.width > 1568 || metadata.height > 1568) {
        throw new InputError('Zdjęcie musi mieć od 280 do 1568 pikseli na każdym boku. Prześlij je ponownie.');
      }
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError('Niepoprawny plik obrazu.');
    }
    const start = performance.now();
    const raw = options.evaluate
      ? await options.evaluate(req.file.buffer, question)
      : await client!.systemOne({ model, state: { photo: image(new Uint8Array(req.file.buffer)) }, questions: { result: question } },
        { headers: { 'TypeSafe-Danger-Zone-Images': 'true' } });
    const answer = raw.answers.result;
    if (!answer || answer.type !== question.type) throw new Error('Invalid upstream answer');
    if (answer.type === 'box') {
      const box = answer.box;
      if (!box || ![box.top, box.bottom, box.left, box.right].every(value => Number.isFinite(value) && value >= 0 && value <= 1) || box.top >= box.bottom || box.left >= box.right) {
        throw new Error('Invalid upstream box');
      }
    }
    res.json({ answer, raw, elapsedMs: Math.round(performance.now() - start) });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Nieznany endpoint.' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Maksymalny rozmiar zdjęcia to 16 MB.' : 'Niepoprawny plik lub zbyt duże dane formularza.' });
    if (error instanceof InputError) return res.status(400).json({ error: error.message });
    if (error instanceof APIError) {
      const status = error.status === 401 || error.status === 403 ? 502 : error.status === 429 ? 429 : 502;
      const message = error.status === 401 || error.status === 403 ? 'TypeSafe odrzucił klucz API. Sprawdź konfigurację serwera.'
        : error.status === 429 ? 'Limit zapytań został przekroczony. Spróbuj za chwilę.'
        : 'TypeSafe nie przyjął zapytania. Sprawdź prompt, kryteria i dostępność modelu.';
      return res.status(status).json({ error: message });
    }
    res.status(502).json({ error: 'Nie udało się uzyskać poprawnej odpowiedzi od Jev. Spróbuj ponownie.' });
  });
  return app;
}
