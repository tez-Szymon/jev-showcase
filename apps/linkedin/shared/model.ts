export const dimensions = ['concreteness', 'actionable', 'selfPromotion', 'platitudes'] as const;
export type Dimension = (typeof dimensions)[number];
export interface Judgment {
  scores: Record<Dimension, number>;
  confidence: Record<Dimension, number>;
  insight: number;
  mode: 'LIVE';
}
export interface Settings {
  enabled: boolean;
  sensitivity: number;
  meter: boolean;
  details: boolean;
  labels: boolean;
  minLength: number;
}
export const defaults: Settings = {
  enabled: true,
  sensitivity: 50,
  meter: true,
  details: true,
  labels: true,
  minLength: 120,
};
export function settingsFrom(value: Partial<Settings>): Settings {
  const s = { ...defaults };
  for (const key of ['enabled', 'meter', 'details', 'labels'] as const)
    if (typeof value[key] === 'boolean') s[key] = value[key];
  if (Number.isFinite(value.sensitivity))
    s.sensitivity = Math.max(0, Math.min(100, value.sensitivity!));
  if (Number.isFinite(value.minLength))
    s.minLength = Math.max(0, Math.min(3000, Math.round(value.minLength!)));
  return s;
}
export const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
export function assess(j: Judgment, sensitivity = 50) {
  const { concreteness: c, actionable: a, selfPromotion: p, platitudes: t } = j.scores;
  const bs = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 *
          (0.3 * (1 - c / 5) +
            0.2 * (1 - a / 5) +
            0.15 * (1 - j.insight) +
            (0.15 * p) / 5 +
            (0.2 * t) / 5) +
          (sensitivity - 50) * 0.3,
      ),
    ),
  );
  const labels: string[] = [];
  if (c >= 3.5 && j.insight >= 0.8 && j.confidence.concreteness >= 0.6)
    labels.push('ACTUALLY_USEFUL');
  if (p >= 3.5 && j.confidence.selfPromotion >= 0.6) labels.push('SELF_PROMOTION');
  if (t >= 3.5 && j.confidence.platitudes >= 0.6) labels.push('GENERIC_WISDOM');
  const quip = [
    'Zaskakująco przydatne',
    'Głównie konkrety',
    'LinkedInowa równowaga',
    'Energia lidera opinii',
    'Krytyczny poziom synergii',
  ][Math.min(4, Math.floor(Math.max(0, bs - 1) / 20))];
  return { bs, labels, quip };
}
