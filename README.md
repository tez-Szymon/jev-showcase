# Jev Showcase

Every Jev demo in one tabbed app, using the live TypeSafe API only. There are no mock modes.

```sh
cp .env.example .env   # set TYPESAFE_API_KEY, plus OPENROUTER_API_KEY (or OPENAI_API_KEY) for RAG
npm run setup          # npm ci in every demo + builds the extension bundles
npm start              # hub on http://127.0.0.1:4310
```

`npm start` launches the hub and the web demos. Each web demo runs in its own tab. Stopping the hub (Ctrl+C) stops every demo it started.

| Tab                  | Source copy       | Port | Notes                                     |
| -------------------- | ----------------- | ---- | ----------------------------------------- |
| Support desk         | `apps/support`    | 4311 | Jev analysis always on                    |
| RAG routing          | `apps/rag`        | 4312 | needs `OPENROUTER_API_KEY` or `OPENAI_API_KEY` |
| Vision playground    | `apps/vision`     | 3000 | `jev-preview` (images, Box); also backs the AI image filter extension |
| Hotdog / not hotdog  | `apps/hotdog`     | 4314 | `jev-preview`                             |
| Image references     | `apps/refs`       | 4315 | new in this repo: pictures in instructions and criteria (`jev-preview`) |
| Extensions           | see below         |      | start/stop buttons, live `/health` status |

### Extensions tab

Headline Lens (`apps/headlines`, port 3001), LinkedIn BS detector (`apps/linkedin`, 4317), YouTube insights (`apps/youtube`, 4318) and the AI image filter (`apps/vision`, 3000) are browser extensions. The first three backends do not start automatically. The AI image filter uses the Vision playground server, which starts with the hub; stopping it from its card also stops the Vision tab. Its builds are in `apps/vision/dist/extension/{chrome,firefox}`. Use the Start/Stop buttons on the Extensions tab. Each card shows the Jev mode, model and request counters from the server's `/health`, the install steps, and recent server output. Load `apps/<id>/dist/chrome` (Chrome, Load unpacked) or `apps/<id>/dist/firefox/manifest.json` (Firefox, Load Temporary Add-on). The ports are fixed because the extensions call them.

## Changes from the original repos

The originals under `../jev-*` are untouched. These copies differ in the following ways:

- **Headlines, LinkedIn, YouTube:** the MOCK classifiers are removed. The servers need a key to start, and a failed Jev call returns an error instead of fake results. YouTube no longer falls back to MOCK. Tests that exercised the mocks were removed or rewritten.
- **Support desk:** `JEV_ENABLED` is ignored, so Jev is always on. Without a key, new requests still go to manual review. Confident spam goes straight to the spam queue (same confidence and margin thresholds, plus its own optional threshold in Settings); a consultant can restore it.
- **Vision playground:** a row of sample buttons under the photo loads a picture together with a matching question (coffee Box, street-sign Box and Noul, sign Choice, battery Score). The drawn samples are in `apps/vision/public/samples`.
- **Hotdog:** the npm placeholder `test` script is removed.
- **RAG:** the LLM call caps output at `OPENAI_MAX_TOKENS` (default 2000), so low-balance OpenRouter keys aren't rejected with HTTP 402. The server log now shows the real provider error. The turn inspector has an **LLM log**: the raw HTTP exchange with OpenRouter/OpenAI (recorded by passing a `fetch` wrapper to the OpenAI SDK, see `apps/rag/lib/llmLog.ts`), with the key redacted. When generation fails, the same log appears under the error message, so you can see what the provider returned.

### Image references tab

`apps/refs` is new in this repo (there is no original). It shows four ways a picture can be part of a question rather than the state:

- **Compare with a reference:** each reference picture sits inside one Noul's `instructions` sentence (`{reference}` in the text).
- **Options defined by example:** each Choice option in `criteria` is a picture, with an optional description and an optional "none of these" option.
- **Find this picture:** each target picture sits inside a Box question's `instructions`, so Jev boxes whatever matches it. A Box always returns a box, so each target also gets a Noul asking whether it is in the photo at all.
- **Score levels by example:** each level of the Score rubric is a picture, lowest first.

Presets with drawn traffic signs, a street scene and battery icons work out of the box. Uploaded photos (drop, paste or click) make a stronger demo. After each run, the page shows the request as sent, with each image reference shown as a thumbnail. Below it, the raw HTTP log (recorded by wrapping the SDK's `fetch`, see `apps/refs/wire.js`) shows the real exchange: headers with the API key redacted, the zstd-compressed and uncompressed sizes, the multipart body part by part (the JSON `request` part, then one binary JPEG part per image), and the response.

## Configuration

All demos read one root `.env`. The hub re-reads it whenever a demo starts or restarts, so after you add a key, use **Restart server** on that tab. For RAG, `OPENROUTER_API_KEY` routes the OpenAI SDK through `https://openrouter.ai/api/v1` with `OPENROUTER_MODEL` (default `openai/gpt-4.1-mini`; the model must support structured JSON output). `OPENAI_API_KEY` wins if both are set. Optional overrides: `SUPPORT_TYPESAFE_API_KEY`, `<APP>_TYPESAFE_MODEL` (see `.env.example`), and `HUB_PORT`.

`npm test` and `npm run typecheck` run the scripts in every demo that defines them. The app list lives in `hub/apps.mjs`. `npm start -- support hotdog` starts only those demos.
