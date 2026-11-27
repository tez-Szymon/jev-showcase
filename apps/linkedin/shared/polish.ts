// Keep API values and persisted label IDs stable; translate only their presentation.
export const modeLabel = (mode: string) =>
  mode === 'LIVE' ? 'Jev: NA ŻYWO' : 'Jev: nieznany tryb';
export const labelNames: Record<string, string> = {
  ACTUALLY_USEFUL: 'PRZYDATNA TREŚĆ',
  SELF_PROMOTION: 'AUTOPROMOCJA',
  GENERIC_WISDOM: 'OGÓLNIKOWE MĄDROŚCI',
};
