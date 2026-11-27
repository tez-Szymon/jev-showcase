# Jev vision playground

Polskojęzyczne demo rozumienia obrazów przez Jev. Dodaj zdjęcie PNG/JPEG, wpisz prompt i wybierz `box`, `noul`, `choice` lub `score`.

## Uruchomienie

Wymagany Node.js 22.15 lub nowszy.

```sh
npm install
cp .env.example .env
```

Uzupełnij `TYPESAFE_API_KEY` w `.env`, a następnie:

```sh
npm run dev
```

Otwórz http://localhost:3000. Aplikacja nasłuchuje lokalnie na `127.0.0.1`. Bez klucza można przesyłać i oglądać zdjęcia; analiza jest wyłączona z informacją o konfiguracji. Klucz pozostaje po stronie serwera i nie jest dołączany do kodu przeglądarki.

```sh
npm test
npm run build
npm start
```

`npm start` uruchamia zbudowaną wersję. Zmienna `PORT` zmienia port, a `TYPESAFE_MODEL` model. Domyślnie używany jest `jev-preview`, obsługujący obrazy i Box. Box wymaga Jev 1.14 lub nowszego. Każde zapytanie zawiera wymagany nagłówek `TypeSafe-Danger-Zone-Images: true`.

## Działanie

- **Box** zwraca krawędzie `top`, `bottom`, `left`, `right` od 0 do 1. Ramka jest nakładana na sam obraz, skaluje się wraz z nim i działa także w powiększeniu. Można ją ukryć oraz pobrać zdjęcie z ramką.
- **Noul** pokazuje prawdopodobieństwo odpowiedzi „tak”.
- **Choice** pozwala zdefiniować opcje, pokazuje wybór i rozkład prawdopodobieństw.
- **Score** pozwala zdefiniować uporządkowane poziomy. Ocena jest średnią ważoną poziomów numerowanych od 0.

Każdy wynik ma podgląd JSON, kopiowanie, czas zapytania i nazwę modelu. Pewność jest pokazywana, jeśli jest dostępna. Zmiana zdjęcia, promptu, typu lub kryteriów usuwa poprzedni wynik.

Zdjęcie trafia do lokalnego serwera przy przesłaniu. Sharp poprawia orientację EXIF, usuwa metadane i dopasowuje rozmiar do 280–1568 px na każdym boku bez kadrowania. Podgląd i analiza używają tych samych pikseli. Obrazy o proporcjach powyżej 5,6:1 wymagają przycięcia. Limit pliku wynosi 16 MiB, a dekodowania 40 megapikseli. Zdjęcia są przechowywane tylko w pamięci, bez zapisu na dysku. Do TypeSafe są wysyłane dopiero po uruchomieniu analizy.

Obrazy i Box są eksperymentalne. Box zawsze zwraca prostokąt, także przy braku szukanego obiektu. Demo pokazuje ten fakt przy wyniku; nie traktuje ramki jako potwierdzenia obecności obiektu.

## Weryfikacja

Testy uruchamiają prawdziwy lokalny serwer HTTP oraz przetwarzanie zdjęć. Sprawdzają orientację, skalowanie, odrzucanie błędnych plików, konstrukcję pytań, cztery typy odpowiedzi, walidację współrzędnych oraz brak klucza. Odpowiedzi modelu są w testach kontrolowane; nie zastępuje to testu z prawdziwym kluczem TypeSafe.

React + TypeScript + Vite, Express, oficjalny `@typesafe-ai/sdk`, Sharp. Bez bazy danych. To lokalne demo; przed udostępnieniem serwera publicznie dodaj uwierzytelnianie i limity zapytań.

Dokumentacja: [obrazy](https://docs.typesafe.ai/images), [Box](https://docs.typesafe.ai/primitives/box), [SDK JavaScript](https://docs.typesafe.ai/sdk/javascript).

Zdjęcie przykładowe: [Unsplash](https://images.unsplash.com/photo-1495474472287-4d71bcdd2085). Fonty DM Sans i Manrope są pobierane z Google Fonts; bez sieci używane są fonty systemowe.

## Wtyczka do przeglądarek: filtr obrazów AI

Wtyczka analizuje obrazy w postach na `www.linkedin.com` i `www.facebook.com`. Domyślnie **oznacza obrazy przy prawdopodobieństwie AI ≥ 80%**. Kliknij ikonę rozszerzenia, aby zmienić próg od 0 do 100%, wybrać oznaczanie lub ukrywanie albo wyłączyć analizę. Ukryty obraz ma przycisk „Pokaż obraz”. Zapisane ustawienia działają również w otwartych kartach, bez ponownej analizy obrazów.

### Uruchomienie i instalacja

1. Uzupełnij `TYPESAFE_API_KEY` w `.env` i uruchom `npm run dev`. Wtyczka korzysta z serwera `http://127.0.0.1:3000`, więc pozostaw domyślny `PORT=3000`.
2. Wykonaj `npm run build:extension`, aby zbudować samą wtyczkę, albo `npm run build`, aby zbudować też aplikację.
3. **Chrome / Edge:** otwórz `chrome://extensions` lub `edge://extensions`, włącz tryb dewelopera, wybierz „Załaduj rozpakowane” i wskaż folder `dist/extension/chrome`.
4. **Firefox:** otwórz `about:debugging#/runtime/this-firefox`, wybierz tymczasowy dodatek i wskaż `dist/extension/firefox/manifest.json`. Instalacja tymczasowa wygasa po restarcie Firefoxa. Wymagany Firefox 140 lub nowszy.
5. Odśwież otwarte karty LinkedIna i Facebooka po zainstalowaniu lub przeładowaniu rozszerzenia. Kliknij ikonę wtyczki, aby sprawdzić połączenie z serwerem i zmienić ustawienia.

Po zmianie kodu wykonaj ponownie build, przeładuj rozszerzenie na stronie zarządzania dodatkami i odśwież feed. Paczki są przeznaczone do lokalnego ładowania, nie zostały opublikowane ani podpisane do dystrybucji w sklepach.

### Analiza i prywatność

- Skrypt wykrywa obrazy w kartach postów, pomijając nawigację, małe miniatury i rozpoznane sekcje komentarzy. Obsługuje doładowywanie postów, zmiany `src`/`srcset` i starszy oraz SDUI feed LinkedIna. Selektory LinkedIna pochodzą z projektu `jev-linkedin-demo`.
- Analiza rozpoczyna się dla załadowanych obrazów widocznych w oknie, o rozmiarze co najmniej 180 × 140 px. Nie obejmuje filmów, grafik CSS, obrazów `blob:` ani `data:`. Wyłączenie przywraca ukryte obrazy i zatrzymuje nowe analizy; już wysłane zapytania mogą się zakończyć.
- Rozszerzenie pobiera obrazy wyłącznie z domen `licdn.com` i `fbcdn.net`, bez ciasteczek i bez przekierowań. Zablokowane lub niedostępne obrazy mają informację o błędzie i przycisk ponowienia. Błąd nigdy nie jest traktowany jako wykrycie AI.
- Bajty obrazów trafiają do lokalnego endpointu `POST /api/detect-ai`, a następnie do TypeSafe. Tekst postu, dane autora i ciasteczka konta nie są wysyłane do modelu. Klucz API pozostaje w `.env` serwera, poza paczką rozszerzenia.
- Serwer przyjmuje statyczne PNG/JPEG/WebP/AVIF do 16 MiB i 40 megapikseli. Poprawia orientację, usuwa metadane i skaluje obraz jak w playgroundzie. Odrzuca animacje i proporcje powyżej 5,6:1. Nie pobiera przekazanych URL-i.
- Wyniki są przechowywane tylko w pamięci: maksymalnie 500 adresów obrazów na kartę i w procesie rozszerzenia. Restart lub uśpienie procesu tła może usunąć jego cache. Każdy nowy obraz oznacza zapytanie do płatnego API; jednocześnie działają najwyżej trzy analizy w tle, do dwóch na kartę.

Próg odnosi się bezpośrednio do prawdopodobieństwa „obraz został w istotnej części wygenerowany przez AI” zwróconego przez Noul. Noul nie ma osobnego pola confidence, zgodnie z [dokumentacją TypeSafe](https://docs.typesafe.ai/primitives/noul). To ocena modelu na podstawie pikseli, a nie zweryfikowany detektor pochodzenia. Próg 80% nie oznacza potwierdzonej 80-procentowej skuteczności. Projekt nie ma jeszcze walidacji na oznaczonym zbiorze obrazów z tych feedów.

### Testy wtyczki

```sh
npm test
npm run test:browser
```

Testy przeglądarkowe korzystają domyślnie z zainstalowanego Google Chrome. Alternatywnie uruchom `npx playwright install chromium`, a następnie `PLAYWRIGHT_CHANNEL=chromium npm run test:browser`.

Testy API sprawdzają przygotowanie WebP, niepoprawne wyniki modelu, brak konfiguracji i odrzucanie URL-i zamiast plików. Testy logiki tła sprawdzają walidację domen i nadawcy, brak ciasteczek, blokowanie przekierowań oraz łączenie równoległych zapytań o ten sam obraz. Testy w Chromium używają kontrolowanych fixture'ów LinkedIna i Facebooka oraz odpowiedzi modelu. Sprawdzają próg dokładnie 80%, ukrywanie i przywracanie, zmianę ustawień, doładowywanie postów, zmianę obrazu, przewijanie, cache i ponawianie błędów. Nie zastępują testu na zalogowanych, aktualnych feedach, których struktura DOM może się zmieniać.
