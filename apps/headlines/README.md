# Headline Lens

A Chrome and Firefox extension that annotates **how news headlines are written**. It does not fact-check claims or evaluate political views.

The categories are defined at runtime and evaluated by Jev. **No category-specific model training is involved.** The local mock mode uses clearly labeled deterministic rules for demos without an API key.

## Run locally

Requires Node.js 22.9 or later. Tested with Node 24.

```sh
npm install
cp .env.example .env
npm run build
npm start
```

Open <http://localhost:3001/fixture> after loading the extension. There are 24 fictional Polish headline cards, 22 unique texts, and a button that inserts new and duplicate cards. Scroll through the page to analyze each visible headline. The fixture itself does not inject or simulate extension badges.

`npm run dev` restarts the backend when server files change. Rebuild and reload the extension after changing extension source files.

## Chrome installation

1. Open `chrome://extensions` and enable Developer mode.
2. Select **Load unpacked**, then choose this project's `dist/chrome` directory.
3. Pin Headline Lens to the toolbar.
4. Refresh an existing news tab or open the fixture, Onet, or WP.

## Firefox installation

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on** and choose `dist/firefox/manifest.json`.
3. Allow the requested website permissions if Firefox asks. In the extension permissions menu, allow access on the sites you want to analyze.
4. Open or refresh a news tab.

The Firefox build requires Firefox 142 or newer and uses an MV3 background event page. Chrome uses an MV3 service worker. Temporary Firefox installation lasts until browser exit; permanent distribution requires Mozilla signing. Chromium testing uses an isolated Chrome for Testing instance.

## Configuration

| Variable           | Default      | Meaning                                                                                                                          |
| ------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `TYPESAFE_API_KEY` | empty        | Server-only TypeSafe credential. Empty selects mock mode.                                                                        |
| `TYPESAFE_MODEL`   | `jev-latest` | Model alias used in LIVE mode.                                                                                                   |
| `JEV_MODE`         | `auto`       | `auto`, `mock`, or `live`. Explicit live mode fails on startup without a key.                                                    |
| `PORT`             | `3001`       | Local backend port. The extension is fixed to 3001; if changed, update its background endpoint and manifest host permission too. |

The extension contains no API key. `.env` is ignored and never bundled. The backend binds only to loopback, validates the Host and Origin headers, accepts bounded JSON batches, and returns no credential values. There is no wildcard CORS. Treat this as a local developer service, not a public endpoint.

`GET /health` reports the selected mode, model, and unique classification counters. `GET /models` queries TypeSafe's authenticated model list in LIVE mode. `POST /classify` accepts `{ "texts": ["A headline of at least twelve characters"] }` with up to 20 items of at most 400 characters each.

## Architecture

```text
content script → site adapter + visible headlines → batch runtime message
    → extension background + session cache → localhost:3001/classify
    → server cache + serialized queue → server/jev.ts → TypeSafe
    ← typed results ← shadow-DOM badges
```

- `extension/content.ts`: visible extraction, debounced MutationObserver, scroll discovery, badges, and debug dialogs. A processed attribute prevents repeat classification. Changed or recycled nodes lose their old badges. Turning the lens off removes badges and invalidates pending DOM updates.
- `extension/background.ts`: the only extension code that contacts the backend. A serialized queue limits concurrency across tabs. Session storage preserves results across service-worker restarts; mode and model form part of the cache key.
- `server/classifier.ts`: normalized-text cache and in-flight deduplication. Simultaneous overlapping requests share results. Failures leave no cache entry and may be retried. The backend cache lasts until server restart; browser cache lasts until browser exit. Both caches have size bounds.
- `server/jev.ts`: all TypeSafe-specific HTTP calls, runtime Choice/Score questions, and response validation.
- `server/mockJev.ts`: deterministic Polish/English keyword rules, always labeled MOCK. Confidence and scores are illustrative heuristic values, not model output.
- `shared/types.ts`: category definitions and shared contracts.

A batch sends a `headlines` array as state. For each index, the backend constructs a Choice question for style and a separate Score question for click appeal. Each question explicitly references its headline index. The question IDs only match answers back to code. No LLM is called to write explanations; badge descriptions come from the category definitions.

## Jev integration

The request contract was inspected on 2026-09-29 using the [official OpenAPI schema](https://api.typesafe.ai/openapi.json), [API reference](https://docs.typesafe.ai/api), [Choice guidance](https://docs.typesafe.ai/primitives/choice), and [Score guidance](https://docs.typesafe.ai/primitives/score).

`POST https://api.typesafe.ai/v1/systemone` takes `model`, `state`, and named `questions`. Choice uses a map of category names to descriptions. Score uses six ordered descriptions, whose indices define the 0–5 scale. Answers are read from `answers.style_N` and `answers.drive_N`. Choice confidence is the API's `confidence` field, not the winning probability. Score is the API's probability-weighted `score`.

To try LIVE mode, put your key in `.env` and restart the backend. Re-analyze the page to replace existing badges. LIVE failures remain errors, never silently become mock results. An unavailable backend is reported in the popup; failed scans can retry after 15 seconds or immediately via Re-analyze. Upstream requests have a 25-second timeout. No automatic upstream rate-limit retry is made within a batch.

Only selected headline text is sent, not article bodies, browsing URLs, cookies, or history. In LIVE mode TypeSafe receives that text through the local proxy. With the default “Other news sites” switch enabled, generic extraction also runs on other HTTP(S) pages. Disable it or restrict browser site access when you want narrower coverage.

## Site adapters

`extension/sites/onet.ts` and `wp.ts` each provide several candidate selectors, combined with `generic.ts`. The fallback looks for linked headings, article containers, and links in repeated card structures. Shared filtering excludes navigation, headers, footers, sidebars, UI text, short labels, and timestamps. It requires a usable HTTP(S) link, sensible text length, and viewport visibility.

These adapters are heuristics. Publisher redesigns, consent overlays, shadow DOM, frames, and unusual card markup can require adjustments. Add selectors to the appropriate adapter, keep the common exclusions, then verify on the current portal layout. Live Onet/WP coverage is not guaranteed by the local fixture test.

## Popup and badges

The popup controls the global switch, each site group, category/confidence visibility, score hover details, and debug mode. Hover or keyboard-focus a badge for its accessible description. In debug mode, click to open JSON containing the headline and result. Escape or Close dismisses it. Re-analyze scans the current page and reuses cached results; it does not force paid reclassification.

MOCK is printed on every mock badge and in the popup. The lens describes presentation, not truth; confidence is not a fact-checking score.

## Verification

```sh
npm run check       # TypeScript, unit tests, both browser builds
npm start           # Keep the backend running in MOCK mode
npm run test:e2e    # Actual unpacked Chromium extension, isolated profile
```

If Playwright's browser is absent, run `npx playwright install chromium` first. Screenshots are saved in `artifacts/`. The browser test checks visible-only discovery, 24 fixture cards, duplicates, dynamic insertion, recycled DOM text, popup settings, disable/re-enable, debug JSON, and browser errors.

Optional native Firefox test:

```sh
python3 -m venv /tmp/headline-lens-venv
/tmp/headline-lens-venv/bin/pip install marionette_driver
/tmp/headline-lens-venv/bin/python tests/firefox.py
```

Set `FIREFOX_BINARY` to your Firefox executable on non-macOS systems. The test uses a temporary profile and temporary add-on installation, leaving personal browser profiles alone.

The LIVE payload and response mapping have unit coverage. An authenticated live inference requires your TypeSafe key and is not part of the offline tests.

### Verified in this workspace

Type checking, all unit tests, both builds, and the actual Chromium extension fixture test passed. The fixture rendered without browser errors. Firefox package lint passed, but native Firefox runtime verification could not complete: the installed Firefox exited with “Could not find profile folder” before loading the extension, including with explicit isolated profiles. LIVE inference and current Onet/WP layouts still need verification with an API key and those pages.

## Formatowanie kodu

Projekt używa Prettiera. Uruchom `npm run format`, aby sformatować pliki, lub
`npm run format:check`, aby sprawdzić formatowanie bez zmian. `npm run check`
zawiera również kontrolę formatowania. Pliki wynikowe, zależności i pliki `.env` są pomijane.
