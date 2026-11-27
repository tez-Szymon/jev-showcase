export const categories = [
  'ADDITIONAL_INFORMATION',
  'PERSONAL_EXPERIENCE',
  'CORRECTION',
  'COUNTERPOINT',
  'TECHNICAL_DETAIL',
  'USEFUL_QUESTION',
  'GENERIC_REACTION',
  'PRAISE_ONLY',
  'JOKE_ONLY',
  'OTHER',
] as const;
export type Category = (typeof categories)[number];
export interface Comment {
  id: string;
  text: string;
}
export interface Judgment {
  information: number;
  perspective: number;
  specificity: number;
  substantive: number;
  category: Category;
}
export interface Result extends Judgment {
  id: string;
  score: number;
  mode: 'LIVE';
  debug?: { input: unknown; output: unknown };
  warning?: string;
}
export interface Settings {
  enabled: boolean;
  threshold: number;
  mode: 'highlight' | 'dim' | 'only';
  replies: boolean;
  debug: boolean;
}
export const defaults: Settings = {
  enabled: true,
  threshold: 70,
  mode: 'highlight',
  replies: false,
  debug: false,
};
export const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
export function finalScore(j: Judgment) {
  return Math.round(
    100 *
      ((0.4 * j.information) / 5 +
        (0.3 * j.perspective) / 5 +
        (0.2 * j.specificity) / 5 +
        0.1 * j.substantive),
  );
}
const polishCategories: Record<Category, string> = {
  ADDITIONAL_INFORMATION: 'Dodatkowe informacje',
  PERSONAL_EXPERIENCE: 'Własne doświadczenie',
  CORRECTION: 'Sprostowanie',
  COUNTERPOINT: 'Kontrargument',
  TECHNICAL_DETAIL: 'Szczegół techniczny',
  USEFUL_QUESTION: 'Wartościowe pytanie',
  GENERIC_REACTION: 'Ogólna reakcja',
  PRAISE_ONLY: 'Pochwała',
  JOKE_ONLY: 'Żart',
  OTHER: 'Inne',
};
export const label = (s: string) => polishCategories[s as Category] ?? s;
export const statusLabel = (s: string) =>
  ({ WAITING: 'OCZEKIWANIE', OFFLINE: 'BRAK POŁĄCZENIA' })[s] ?? s;
