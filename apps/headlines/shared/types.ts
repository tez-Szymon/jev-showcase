export const categories = {
  INFORMATIONAL: 'Mainly communicates the subject or fact.',
  CURIOSITY_GAP: 'Intentionally withholds key information to force a click.',
  SENSATIONAL: 'Exaggerates importance, surprise or drama.',
  ALARMIST: 'Emphasizes fear, danger or urgency.',
  OUTRAGE_CONFLICT: 'Emphasizes anger, conflict or controversy.',
  EMOTIONAL: 'Primarily designed to trigger an emotional reaction.',
  PROMOTIONAL: 'Primarily promotional or advertorial.',
  OTHER: 'Does not fit the categories well.',
} as const;
export type Category = keyof typeof categories;
export type Mode = 'LIVE';
export interface Result {
  text: string;
  category: Category;
  confidence: number;
  clickDriveScore: number;
  mode: Mode;
}
export const normalize = (text: string) =>
  text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pl');
export interface Settings {
  enabled: boolean;
  onet: boolean;
  wp: boolean;
  other: boolean;
  category: boolean;
  confidence: boolean;
  score: boolean;
  debug: boolean;
}
export const defaults: Settings = {
  enabled: true,
  onet: true,
  wp: true,
  other: true,
  category: true,
  confidence: true,
  score: true,
  debug: false,
};
export const label = (category: Category) => category.replaceAll('_', ' ');
export function validResult(value: unknown): value is Result {
  const r = value as Result | undefined;
  return (
    !!r &&
    typeof r.text === 'string' &&
    Object.hasOwn(categories, r.category) &&
    Number.isFinite(r.confidence) &&
    r.confidence >= 0 &&
    r.confidence <= 1 &&
    Number.isFinite(r.clickDriveScore) &&
    r.clickDriveScore >= 0 &&
    r.clickDriveScore <= 5 &&
    r.mode === 'LIVE'
  );
}
