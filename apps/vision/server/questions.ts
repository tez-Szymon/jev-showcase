import type { Question } from '@typesafe-ai/sdk';

export class InputError extends Error {}

export function buildQuestion(type: unknown, prompt: unknown, criteria: unknown): Question {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) {
    throw new InputError('Wpisz prompt o długości od 1 do 8000 znaków.');
  }
  const instructions = { image: 'Use the image in `photo`.', task: prompt.trim() };
  if (type === 'box' || type === 'noul') return { type, instructions };
  if (type !== 'choice' && type !== 'score') throw new InputError('Nieznany typ odpowiedzi.');
  if (!Array.isArray(criteria) || criteria.some(value => typeof value !== 'string' || !value.trim() || value.length > 1000)) {
    throw new InputError('Każda opcja musi zawierać opis o długości do 1000 znaków.');
  }
  const values = criteria.map(value => (value as string).trim());
  const max = type === 'choice' ? 255 : 10;
  if (values.length < 2 || values.length > max || new Set(values).size !== values.length) {
    throw new InputError(`Podaj od 2 do ${max} różnych ${type === 'choice' ? 'opcji' : 'poziomów'}.`);
  }
  return type === 'choice'
    ? { type, instructions, criteria: Object.fromEntries(values.map(value => [value, null])) }
    : { type, instructions, criteria: [values[0], values[1], ...values.slice(2)] };
}
