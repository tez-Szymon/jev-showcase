# YouTube Insight Filter

A Chrome and Firefox Manifest V3 extension that highlights useful YouTube comments with Jev by TypeSafe. Low-value comments remain visible by default. The companion fixture contains 32 comments and dynamically adds eight more on demand.

## Run the demo

Requires Node.js 22.9 or newer and npm.

```sh
npm install
npm run build
npm run dev
```

Open http://127.0.0.1:4318. With no API key, the server uses clearly labeled **MOCK** judgments. The fixture runs the same extraction, batching, scoring display, and observer code as the extension; it does not need an extension installed.

## Install in Chrome

1. Build with `npm run build` and keep the local proxy running.
2. Open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `dist/chrome`.
3. Open or reload a YouTube video and load its comments. Use the extension popup to change the threshold, display mode, replies, or debug output.

## Install in Firefox

1. Build and keep the proxy running.
2. Open `about:debugging#/runtime/this-firefox` and select Load Temporary Add-on.
3. Select `dist/firefox/manifest.json`. Grant the requested YouTube and loopback permissions if prompted, then reload the video.

The Firefox build uses a background script; Chrome uses a service worker. Temporary Firefox installs are removed on restart. Store distribution requires signing and the relevant store privacy declarations. This project is packaged for local development.

## Live TypeSafe configuration

```sh
cp .env.example .env
```

Set `TYPESAFE_API_KEY` in `.env`, leave `JEV_MODE=auto`, and restart the server. Never put the key in extension files. `TYPESAFE_MODEL` defaults to `jev-latest`; `GET http://127.0.0.1:4318/models` lists models available to the configured account. `JEV_MODE=mock` forces the fixture classifier even with a key.

The adapter is isolated in `server/jev.ts`. It uses `POST https://api.typesafe.ai/v1/systemone` with Bearer authentication. The official [OpenAPI schema](https://api.typesafe.ai/openapi.json) was inspected on 2026-09-29 and is saved in `docs/typesafe-openapi.json`. See the official [API reference](https://docs.typesafe.ai/api) and [Score reference](https://docs.typesafe.ai/primitives/score).

Every comment gets three independent Score questions, one Noul question, and one Choice question in the same upstream request. Each instruction explicitly identifies its comment in shared state. Score criteria have six descriptive levels, numbered 0 to 5. Choice returns a single primary category. No likes, author identity, subscriber counts, or popularity enter the model request. The video title supplies limited subject context; there is no transcript-based fact checking.

## Scoring

```
score = round(100 × (
  0.4 × information / 5 +
  0.3 × perspective / 5 +
  0.2 × specificity / 5 +
  0.1 × substantiveProbability
))
```

This ranges from 0 to 100. The default highlight threshold is 70; qualifying comments at 85 or above receive stronger styling. The percentage is a contribution score, not a probability of factual correctness. Noul is a probability of substantive contribution. Changing the threshold or display mode reuses existing judgments.

Click a comment badge for component scores and its primary category; hovering gives a text tooltip. Debug mode adds the actual question/state input, typed output, and final arithmetic. Top Insights ranks currently loaded, eligible comments above the threshold and scrolls to a selected comment.

## DOM extraction and batching

The script watches `ytd-comment-thread-renderer` descendants using current `ytd-comment-view-model` and legacy `ytd-comment-renderer` selectors, extracting `#content-text`. Replies are optional. It processes loaded comments, including those below the viewport; it does not fetch unloaded YouTube comments. YouTube markup can change, so selectors are centralized in `extension/content.ts`.

A MutationObserver debounces discovery for 100ms. A 200ms queue sends up to 12 comments per batch through the extension background script to the loopback proxy. Only one batch per page runs at once. The fixture sends that same payload directly to the same-origin proxy. Successful elements receive `data-yt-insight-analyzed`. Changed/recycled comment nodes and YouTube SPA navigation are handled, and detached nodes are removed from the active ranking.

NFKC and whitespace-normalized text plus the video title are SHA-256 hashed. The page cache deduplicates text across loaded nodes and batches. The proxy additionally deduplicates within batches and across tabs, serializes upstream work, and keeps at most 2,000 entries for one hour. Fallback entries expire after 30 seconds server-side. Page judgments last until reload; reload after restoring the live API to replace existing MOCK results. `/health` exposes batch, evaluation, and cache-hit counters without comment text.

## Failures and mock mode

The mock classifier uses explicit keyword rules for the fixture. It is deterministic and deliberately does not claim general semantic accuracy. It scores short corrections highly and generic reactions poorly without using text length.

Jev requests time out after 15 seconds. HTTP failures, malformed answers, and out-of-range scores fall back to results marked MOCK with a visible warning. No API response body or API key is exposed in errors. If the local proxy is offline, unanalyzed comments stay untouched; Retry analysis resumes pending work. Existing results remain readable. Disabling the extension removes all styling and restores collapsed comments.

## Privacy and local proxy

Analyzed comment text and the video title are sent to the configured local proxy. In LIVE mode the proxy sends them to TypeSafe. In MOCK mode no comment data goes to TypeSafe. Data is cached in memory only; there is no database or comment logging. Debug details appear locally in the DOM and may be included in screenshots. The extension key is never bundled; only the Node process reads `.env`.

The server binds only to `127.0.0.1`, validates Host and Origin, accepts JSON only for analysis, and limits comment length and batch size. It accepts extension origins and its own fixture origin. This is a personal development proxy, not an authenticated public service. Keep it on loopback. If changing `PORT`, also update the extension endpoint/host permission and test configuration, then rebuild.

## Verification

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Unit tests cover scoring endpoints, mock examples, request batching shape, malformed output, and API-failure fallback. Browser tests cover dynamic insertion, batches, duplicates, theme switching, Top Insights focus/scroll, collapsing/restoring, debug details, and proxy failure/retry. Browser screenshots are written to `test-results/`.

The fixture and the built Chrome package are verified in Chromium, including its background message bridge and popup settings. The extension test uses a controlled YouTube-shaped page. Actual YouTube DOM compatibility and installation in a full Chrome/Firefox profile should be smoke-tested with your account; authenticated LIVE semantic accuracy requires your TypeSafe key.

## Code formatting

Prettier formats TypeScript, JavaScript, HTML, CSS, JSON, and Markdown with two-space indentation and a 100-character target line width.

```sh
npm run format
npm run format:check
```

Generated builds, test artifacts, the lockfile, the downloaded API schema, and environment files are excluded. Run `format:check` when validating changes.
