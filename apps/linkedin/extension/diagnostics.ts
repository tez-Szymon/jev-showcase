export interface FeedStatus {
  version: string;
  ready: boolean;
  enabled: boolean;
  cards: number;
  near: number;
  readable: number;
  eligible: number;
  rendered: number;
  pending: number;
  failures: number;
  minLength: number;
  error?: string;
}
export function describeFeed(s: FeedStatus): string {
  if (s.error) return `Błąd analizy: ${s.error}. Przeładuj dodatek i odśwież tę kartę.`;
  if (!s.ready) return 'Dodatek łączy się ze stroną. Sprawdź ponownie za chwilę.';
  if (!s.enabled) return 'Wykrywanie jest wstrzymane. Włącz je powyżej.';
  if (!s.cards)
    return 'Połączono ze stroną, ale nie wykryto postów. Otwórz aktualności i przewiń do posta. Ten układ strony może wymagać aktualizacji dodatku.';
  if (!s.readable)
    return `Wykryte posty: ${s.cards}, ale nie rozpoznano ich tekstu. Ten układ strony wymaga aktualizacji dodatku.`;
  if (!s.near) return `Wykryte posty: ${s.cards}. Przewiń do posta, aby go przeanalizować.`;
  if (!s.eligible)
    return `Żaden pobliski post nie osiąga minimum ${s.minLength} znaków. Zmniejsz minimum lub przewiń do dłuższego posta.`;
  if (s.failures)
    return `Nieudane analizy pobliskich postów: ${s.failures}. Kliknij ponowienie przy poście lub przycisk poniżej.`;
  if (s.pending)
    return `Analizowane unikalne posty: ${s.pending}. Wyświetlone wskaźniki: ${s.rendered}.`;
  return `Wykryte posty: ${s.cards} · w pobliżu: ${s.near} · wskaźniki: ${s.rendered}. Wersja ${s.version}.`;
}
