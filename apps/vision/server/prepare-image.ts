import sharp, { type OutputInfo } from 'sharp';
import { InputError } from './questions.js';

export async function prepareImage(input: Buffer, feedImage = false) {
  let buffer: Buffer;
  let info: OutputInfo;
  try {
    const metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    if (!(feedImage ? ['jpeg', 'png', 'webp', 'heif'] : ['jpeg', 'png']).includes(metadata.format || '') || (metadata.pages || 1) > 1) {
      throw new InputError(feedImage ? 'Wybierz statyczny obraz PNG, JPEG, WebP lub AVIF.' : 'Wybierz statyczny obraz PNG lub JPEG.');
    }
    let { width = 0, height = 0 } = metadata;
    if (metadata.orientation && metadata.orientation >= 5) [width, height] = [height, width];
    if (!width || !height || Math.max(width, height) / Math.min(width, height) > 1568 / 280) {
      throw new InputError('Zdjęcie jest zbyt panoramiczne. Przytnij je do proporcji nie większych niż 5,6:1.');
    }
    const scale = Math.max(280 / Math.min(width, height), Math.min(1, 1568 / Math.max(width, height)));
    const prepared = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate().resize(Math.round(width * scale), Math.round(height * scale))
      .flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
    buffer = prepared.data;
    info = prepared.info;
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(feedImage ? 'Nie udało się odczytać obrazu PNG, JPEG, WebP lub AVIF do 40 megapikseli.' : 'Nie udało się odczytać zdjęcia. Wybierz poprawny PNG lub JPEG do 40 megapikseli.');
  }
  return { buffer, info };
}
