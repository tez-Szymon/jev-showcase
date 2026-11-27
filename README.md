# Jev Showcase

Every Jev demo in one tabbed app, using the live TypeSafe API only. There are no mock modes.

```sh
cp .env.example .env   # set TYPESAFE_API_KEY, plus OPENROUTER_API_KEY (or OPENAI_API_KEY) for RAG
npm run setup          # npm ci in every demo + builds the extension bundles
npm start              # hub on http://127.0.0.1:4310
```

`npm start` launches the hub and the web demos. Each web demo runs in its own tab. Stopping the hub (Ctrl+C) stops every demo it started.

| Tab                  | Folder            | Port | Notes                                     |
| -------------------- | ----------------- | ---- | ----------------------------------------- |
| Support desk         | `apps/support`    | 4311 | Jev routes new requests to a team         |
| RAG routing          | `apps/rag`        | 4312 | needs `OPENROUTER_API_KEY` or `OPENAI_API_KEY` |
| Vision playground    | `apps/vision`     | 3000 | `jev-preview` (images, Box); also backs the AI image filter extension |
| Hotdog / not hotdog  | `apps/hotdog`     | 4314 | `jev-preview`                             |
| Image references     | `apps/refs`       | 4315 | pictures in instructions and criteria (`jev-preview`) |
| Extensions           | see below         |      | start/stop buttons, live `/health` status |

Every demo calls the live API. If a key is missing the server refuses to start, and a failed Jev call shows an error rather than fake results.

### Support desk tab

Jev routes each new request to a team. Without a key, new requests go to manual review. Confident spam goes straight to the spam queue (confidence and margin thresholds, plus an optional threshold in Settings); a consultant can restore it.

### Vision playground tab

A row of sample buttons under the photo loads a picture together with a matching question (coffee Box, street-sign Box and Noul, sign Choice, battery Score). The drawn samples are in `apps/vision/public/samples`.

### RAG routing tab

Jev decides whether a chat turn needs retrieval; an LLM writes the answer. The LLM call caps output at `OPENAI_MAX_TOKENS` (default 2000), so low-balance OpenRouter keys aren't rejected with HTTP 402. The turn inspector has an **LLM log**: the raw HTTP exchange with OpenRouter/OpenAI (recorded by passing a `fetch` wrapper to the OpenAI SDK, see `apps/rag/lib/llmLog.ts`), with the key redacted. When generation fails, the same log appears under the error message, so you can see what the provider returned.

### Image references tab

`apps/refs` shows four ways a picture can be part of a question rather than the state:

- **Compare with a reference:** each reference picture sits inside one Noul's `instructions` sentence (`{reference}` in the text).
- **Options defined by example:** each Choice option in `criteria` is a picture, with an optional description and an optional "none of these" option.
- **Find this picture:** each target picture sits inside a Box question's `instructions`, so Jev boxes whatever matches it. A Box always returns a box, so each target also gets a Noul asking whether it is in the photo at all.
- **Score levels by example:** each level of the Score rubric is a picture, lowest first.

Presets with drawn traffic signs, a street scene and battery icons work out of the box. Uploaded photos (drop, paste or click) make a stronger demo. After each run, the page shows the request as sent, with each image reference shown as a thumbnail. Below it, the raw HTTP log (recorded by wrapping the SDK's `fetch`, see `apps/refs/wire.js`) shows the real exchange: headers with the API key redacted, the zstd-compressed and uncompressed sizes, the multipart body part by part (the JSON `request` part, then one binary JPEG part per image), and the response.

## Browser extensions

Four demos are browser extensions with a local backend:

| Extension            | Folder           | Backend port | Works on                          | Firefox  |
| -------------------- | ---------------- | ------------ | --------------------------------- | -------- |
| Headline Lens        | `apps/headlines` | 3001         | onet.pl, wp.pl and other news sites | 142+   |
| LinkedIn BS detector | `apps/linkedin`  | 4317         | linkedin.com feed                 | 140+     |
| YouTube insights     | `apps/youtube`   | 4318         | YouTube video comments            | 121+     |
| AI image filter      | `apps/vision`    | 3000         | LinkedIn and Facebook images      | 140+     |

### Running the backends

The first three backends don't start with the hub: use **Start**/**Stop** on the Extensions tab. Each card shows the Jev model and request counters from the server's `/health`, install steps and recent server output. The AI image filter uses the Vision playground server, which starts with the hub; stopping it from its card also stops the Vision tab.

The extensions call `127.0.0.1` on the fixed ports above, so the hub must run on the same machine as the browser. The ports are hard-coded in each extension's `background` script; changing one means editing it there and in `hub/apps.mjs`, then rebuilding.

### Installing

`npm run setup` builds every extension. Then load the build in your browser:

- **Chrome / Edge:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick `apps/<id>/dist/chrome` (for the AI image filter: `apps/vision/dist/extension/chrome`).
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on** and pick `manifest.json` in `apps/<id>/dist/firefox` (AI image filter: `apps/vision/dist/extension/firefox`). Temporary add-ons are removed when Firefox closes.

After changing extension code, run `npm run build` in that app (`npm run build:extension` for the vision app) and reload the extension.

### Extension settings

The API key and model live only on the backend (root `.env`: `TYPESAFE_API_KEY`, `HEADLINES_TYPESAFE_MODEL`, `LINKEDIN_TYPESAFE_MODEL`, `YOUTUBE_TYPESAFE_MODEL`, `VISION_TYPESAFE_MODEL`); the extensions never see them. Everything else is set in the browser and stored per browser profile (`storage.local`). The extension UI is in Polish.

| Extension            | Where              | Settings (default)                                                                 |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Headline Lens        | toolbar popup      | on/off (on); sites: Onet, Wirtualna Polska, other news sites (all on); show category, confidence, clickbait score (all on); **Przeanalizuj ponownie** re-runs the page |
| LinkedIn BS detector | toolbar popup      | sensitivity 0–100 (50); meter, detailed scores, content labels (all on); minimum post length (120 characters); **Sprawdź aktualności** checks the feed, **Oceń widoczne posty ponownie** re-scores visible posts |
| YouTube insights     | toolbar popup      | on/off (on); minimum value score 0–100 (70); mode: highlight valuable / dim low-value / show only valuable (highlight); analyse replies (off); show Jev details (off); **Ponów połączenie** retries the backend |
| AI image filter      | extension options page | on/off (on); AI probability threshold 0–100 % (80); above the threshold: mark with a label or hide with a show button (mark) |

Each popup also shows whether its backend is reachable. If it says the server is offline, start it on the Extensions tab.

## Configuration

All demos read one root `.env`. The hub re-reads it whenever a demo starts or restarts, so after you add a key, use **Restart server** on that tab. For RAG, `OPENROUTER_API_KEY` routes the OpenAI SDK through `https://openrouter.ai/api/v1` with `OPENROUTER_MODEL` (default `openai/gpt-4.1-mini`; the model must support structured JSON output). `OPENAI_API_KEY` wins if both are set. Optional overrides: `SUPPORT_TYPESAFE_API_KEY`, `<APP>_TYPESAFE_MODEL` (see `.env.example`), and `HUB_PORT`.

`npm test` and `npm run typecheck` run the scripts in every demo that defines them. The app list lives in `hub/apps.mjs`. `npm start -- support hotdog` starts only those demos.
