import type { Category, Mode } from './types.js';
export const labels: Record<Category, string> = {
  INFORMATIONAL: 'INFORMACYJNY',
  CURIOSITY_GAP: 'LUKA CIEKAWOŚCI',
  SENSATIONAL: 'SENSACYJNY',
  ALARMIST: 'ALARMISTYCZNY',
  OUTRAGE_CONFLICT: 'OBURZENIE / KONFLIKT',
  EMOTIONAL: 'EMOCJONALNY',
  PROMOTIONAL: 'PROMOCYJNY',
  OTHER: 'INNY',
};
export const descriptions: Record<Category, string> = {
  INFORMATIONAL: 'Nagłówek przede wszystkim przedstawia temat lub informację.',
  CURIOSITY_GAP: 'Nagłówek pomija kluczową informację, aby zachęcić do kliknięcia.',
  SENSATIONAL: 'Nagłówek wyolbrzymia znaczenie, zaskoczenie lub dramatyzm wydarzenia.',
  ALARMIST: 'Nagłówek podkreśla strach, zagrożenie lub pilność sytuacji.',
  OUTRAGE_CONFLICT: 'Nagłówek eksponuje oburzenie, konflikt lub kontrowersje.',
  EMOTIONAL: 'Nagłówek ma przede wszystkim wywołać reakcję emocjonalną.',
  PROMOTIONAL: 'Nagłówek ma przede wszystkim charakter reklamowy lub promocyjny.',
  OTHER: 'Nagłówek nie pasuje jednoznacznie do pozostałych kategorii.',
};
export const modeLabel = (_mode: Mode) => 'NA ŻYWO (LIVE)';
