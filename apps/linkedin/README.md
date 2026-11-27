# LinkedIn BS Detector

A Chrome and Firefox extension that rates the **writing in a post**, with a local TypeScript backend and a standalone feed demo. Jev supplies five semantic judgments. Ordinary code calculates the meter. This is a humorous writing-style assessment, not truth verification or a judgment of an author.

## Run the demo

Requires Node.js 22 or later and npm.

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4317**. The default is **Jev: MOCK**, a deterministic keyword simulation that needs no API key. Twelve fictional posts cover motivational fluff, humblebragging, engagement bait, technical advice, case studies, personal lessons, promotion, generic AI claims, and metrics. “Add more posts” simulates infinite scrolling. The demo loads the same extractor and widget bundle as the extension.

The fixture is `demo/linkedin-fixture.html`. Serve it through the backend, rather than opening it as a `file://` URL. Sidebar controls apply to the standalone demo; use the extension popup when the extension is installed.

## Install the extension

Build first, keep the local backend running, and reload existing LinkedIn tabs after installation.

**Chrome 120+**

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `dist/chrome`.
3. Open `https://www.linkedin.com/feed/` or the local fixture. Pin the extension to open its popup.

**Firefox desktop 140+**

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**, then select `dist/firefox/manifest.json`.
3. Allow access to LinkedIn and the loopback backend if prompted. Temporary add-ons disappear on restart.

Chrome uses a Manifest V3 service worker. Firefox uses a Manifest V3 background event script, matching [Mozilla's background documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background). Firefox's manifest declares `websiteContent` transmission using its [built-in consent mechanism](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/). Store submission and signing are outside this local demo.

The extension expects port **4317**. `PORT` is useful for standalone backend development; changing it also requires updating the extension URLs and rebuilding.

## Live Jev mode

```sh
cp .env.example .env
# Edit .env: set JEV_MODE=live and TYPESAFE_API_KEY to your key.
npm run dev
```

Stop an already-running mock server before starting live mode. Reload the feed after switching modes to clear its in-memory judgments. `TYPESAFE_MODEL` defaults to `jev-latest`. No key is bundled into the extension or returned to a browser. A missing live key stops startup; live failures never silently fall back to mock results.

The integration is isolated in `server/jev.ts`. The implementation was checked against the [current Swagger schema](https://api.typesafe.ai/docs), its `/openapi.json`, and the [HTTP API reference](https://docs.typesafe.ai/api) on September 29, 2026:

- `POST https://api.typesafe.ai/v1/systemone`, bearer authentication.
- Body: `{ model, state: { postText }, questions }`.
- Four `score` questions use six independently described rubric levels, positions 0–5.
- One `noul` question returns a probability of yes from 0–1.
- Answers are read by question ID and validated for type and numeric bounds.

All five questions are submitted together and evaluated independently over the same text:

| Judgment             | Low end                             | High end                                           |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| Concrete information | Abstract assertions                 | Precise examples, methods, context and limitations |
| Actionability        | No usable next step                 | Reproducible steps, checks and conditions          |
| Self-promotion       | No promotion                        | Almost entirely advertising or status signaling    |
| Platitudes           | Specific reasoning                  | Interchangeable slogans and empty claims           |
| Useful insight       | No independently useful information | Specific transferable lesson or observation        |

The full six-level rubrics are in `server/jev.ts`. Questions explicitly exclude author judgments and tell Jev to treat commands in a post as data. Profiles, follower counts, employer prestige, appearance, and demographics are not extracted. A technical term or number is not proof of substance, and a personal story can contain useful information.

## Deterministic formula

Let `C`, `A`, `P`, `T` be the four 0–5 scores and `I` the useful-insight probability. At balanced sensitivity:

```text
base = 100 × [
  0.30 × (1 − C/5) +
  0.20 × (1 − A/5) +
  0.15 × (1 − I)   +
  0.15 × P/5       +
  0.20 × T/5
]
BS = round(clamp(base + 0.30 × (sensitivity − 50), 0, 100))
```

Specificity gets the largest weight; useful information can offset promotional framing. All-substance anchors at 0, all-fluff at 100. Sensitivity shifts the result by at most 15 points without rerunning Jev. Weights are explicit demo choices, not a scientifically validated scale. A score of 82% means a composite style rating of 82/100, **not** an 82% probability that a post is false.

The five humorous captions are selected in code for bands 0–20, 21–40, 41–60, 61–80, and 81–100. Three conservative optional labels are implemented:

- `ACTUALLY_USEFUL`: concreteness ≥ 3.5, useful-insight probability ≥ 0.8, concreteness confidence ≥ 0.6.
- `SELF_PROMOTION`: self-promotion ≥ 3.5 and confidence ≥ 0.6.
- `GENERIC_WISDOM`: platitudes ≥ 3.5 and confidence ≥ 0.6.

Other suggested labels are omitted because the five judgments do not establish them reliably. Low confidence can produce no labels. Noul is shown as **P(yes)**, with YES at ≥0.65, NO at ≤0.35, and UNCERTAIN between them. It is not presented as a separate model confidence. Mock confidences are fixed illustrative values, not calibrated model output.

## Architecture and behavior

```text
Post text → content script → viewport queue → extension background
         → local backend → Jev's five judgments → cached structured result
         → deterministic formula → Shadow DOM widget
```

`extension/extractor.ts` combines activity URNs, repeated feed containers, semantic articles/list items, SDUI `data-testid="expandable-text-box"` bodies, keyed SDUI paragraphs, and legacy commentary containers. Randomized LinkedIn classes are not used. Expand buttons and known comment/sidebar containers are excluded. It deliberately skips unknown card layouts rather than submitting entire cards with names, comments, and controls. Nested cards are reduced to one outer post. Shared or quoted posts may therefore be treated as one text unit.

`MutationObserver` discovers inserted posts and edited text. `IntersectionObserver` allows analysis only within 250px of the viewport. Throttled batches contain at most eight posts. Continuous DOM changes cannot indefinitely postpone analysis. The first 12,000 characters are evaluated for longer posts. Posts shorter than the configured minimum are skipped.

NFKC and whitespace normalization precede SHA-256 hashing. The content script shares results across identical cards and tracks in-flight hashes. The backend also caches promises, so concurrent duplicate requests reuse inference. Each successful cache is bounded to 1,000 entries. Results are memory-only; eviction, reloads, or server restarts can cause later inference. The backend cache persists for the server process lifetime.

“Re-analyze visible posts” re-extracts text, retries failures, and reuses unchanged cached judgments. Edited/expanded text gets a new hash and a fresh judgment. Changing display settings or sensitivity does not spend API calls. Pause stops new batches; a request already in flight may finish. API failures leave an explicit retry button; they do not create fake scores. Live requests have a 25-second deadline and manual retry rather than unbounded retries.

Widgets use Shadow DOM, scoped styles, text nodes instead of post HTML, and in-flow expandable panels. They do not rewrite post content, resize the feed, inject global styles, or overlay controls. Opening a panel intentionally adds vertical height to its own card. Unusual LinkedIn layouts still need real-world testing; DOM compatibility cannot be guaranteed indefinitely.

## Privacy and boundaries

- Only extracted post text is sent to the backend. It may itself contain personal or sensitive information; this demo does not redact it.
- **MOCK** keeps analysis on the local machine. **LIVE** forwards text to TypeSafe. Review the provider's policies before enabling live mode on sensitive content.
- The key remains in the server environment. The browser receives numeric judgments and mode only. No analytics, database, or post-text request logging is included.
- The server binds to `127.0.0.1`, validates the Host header, rejects unrelated browser origins, requires JSON, bounds request sizes, and limits concurrent batches. Extension origins are accepted for local development; this is not an authenticated multi-user service. Do not expose it publicly.
- The popup saves preferences in local extension storage. No LinkedIn account credentials or cookies are read.
- Independent scores remain fallible. The meter rewards information density and useful reasoning, not the social worth, honesty, or competence of a person. No hiding, ranking, commenting, or account actions are automated.

## Verification

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium firefox
npm run test:browser
# With the local backend running:
npm run test:extension
```

Unit tests cover formula anchors, sensitivity, conservative labels, response validation, normalization, settings bounds, and mock determinism. Browser tests cover viewport gating, dynamically inserted and edited posts, duplicate content, repeated refreshes, settings, failure/retry, mobile overflow, and rejected origins. The Chrome extension test loads the built MV3 package and checks background messaging, popup settings, persistence, and rendering independently of the fixture's standalone bundle.

Verified in this workspace: build, strict TypeScript, unit tests, Chromium fixture tests and a visual browser check. Firefox's downloaded test runtime could not start on this Mac (`Could not find profile folder`), including a retry with a different temporary directory. Its browser tests remain unverified. No paid live Jev call or authenticated LinkedIn feed test was performed; these require API/account access. See `docs/verification.md` for the final local run results.

## Feed shows no meters

Version 1.0.1 adds support for LinkedIn's SDUI feed. Version 1.0.0 missed the `expandable-text-box` markup and could silently skip these posts.

After building, reload the extension in `chrome://extensions` or `about:debugging#/runtime/this-firefox`, then reload the LinkedIn tab. Existing tabs retain the old content script until refreshed. Check site-access permission for `https://www.linkedin.com`.

The popup's **Jev: LIVE** badge reports backend mode, not feed connectivity. Use **Feed connection → Check feed** for the active tab. It distinguishes missing content-script injection, unrecognized post containers/text, short posts, a paused detector, pending analysis, and failed requests. Diagnostics return counts and errors only, never post text.

## Formatowanie kodu

Projekt korzysta z Prettiera. Uruchom `npm run format`, aby sformatować pliki, albo `npm run format:check`, aby sprawdzić formatowanie bez zapisywania zmian. Konfiguracja znajduje się w `.prettierrc.json`. Wygenerowane paczki, wyniki testów, zależności i pliki środowiskowe są pomijane.

Wersja dodatku 1.0.2 ma polski interfejs: ustawienia, wskaźniki, etykiety i diagnostykę. Po przebudowaniu przeładuj dodatek oraz kartę LinkedIna. Tryby są wyświetlane jako „Jev: NA ŻYWO” i „Jev: DEMO (MOCK)”.
