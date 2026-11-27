# Jev routing playground

A local conversational RAG demo built with Next.js, React, TypeScript, and plain CSS. Jev decides which company source a question needs. Retrieval is a small deterministic lookup. A single OpenAI call produces both the answer and the compact state used by Jev on the next turn.

## Run locally

Use Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000. Both API keys are required to chat.

Copy `.env.example` to `.env.local`, fill in both keys, and restart the server:

```dotenv
TYPESAFE_API_KEY=
OPENAI_API_KEY=
TYPESAFE_MODEL=jev-latest
OPENAI_MODEL=gpt-4.1-mini
```

Keys are read only by server code. Do not prefix them with `NEXT_PUBLIC_`. Missing keys disable chat and show setup instructions. The server checks both keys before any provider call. A LIVE badge means a key is configured, not that credentials or service availability have been verified.

## Why this architecture exists

An agentic RAG application often calls an LLM to decide whether retrieval is necessary. This demo tests whether Jev can replace that routing call with a focused structured decision model. The LLM remains responsible for language generation, while Jev is responsible for routing. This demo does not establish a latency or accuracy advantage; measure that with live traffic and a representative evaluation set.

```text
                 Previous State
                       │
                       ▼
User message ───────► Jev
                       │
            ┌──────────┴──────────┐
            │                     │
         NO_RAG                  RAG
            │                     │
            │                Mock retrieval
            │                     │
            └──────────┬──────────┘
                       ▼
                      LLM
                  ┌────┴────┐
                  │         │
               Answer   New State
                  │         │
                  ▼         └──────► next turn
                User
```

`lib/chat.ts` owns this sequence. No language model runs before Jev. The `NO_RAG` branch never calls the retrieval function. Displayed elapsed times measure server stages and exclude browser/network round-trip time.

## Live Jev integration

`lib/jev.ts` uses the official [`@typesafe-ai/sdk`](https://docs.typesafe.ai/sdk/javascript) package. `choice()` and `noul()` build typed questions, and `TypeSafeClient.systemOne()` calls `POST https://api.typesafe.ai/v1/systemone`. The SDK handles bearer authentication, JSON transport, timeouts, and HTTP errors. The adapter keeps runtime validation of the selected route and probability bounds before returning a live decision. The request and response schema was checked against the [current OpenAPI specification](https://api.typesafe.ai/openapi.json) and [API reference](https://docs.typesafe.ai/api) on 2026-09-29.

The body contains `model`, `state`, and named `questions`. The state has the current message and previous compact state. Two independent questions run in the same request:

- `route`, a Choice with `NO_RAG`, `HR`, `PRODUCT_DOCS`, and `CRM` criteria.
- `needs_context`, a Noul for the probability that company data is needed.

The route in `answers.route.choice` controls the branch. Choice confidence is displayed separately from `answers.needs_context.noul`. The Noul is diagnostic and never overrides the Choice. They may disagree. Choice confidence is distribution concentration, not a guarantee that the answer is correct. There is no confidence threshold in this harmless demo.

The default alias is `jev-latest`. To discover alternatives, call `GET https://api.typesafe.ai/v1/models` with the same Authorization header and put a returned name in `TYPESAFE_MODEL`. See [Choice documentation](https://docs.typesafe.ai/primitives/choice).

## Generation and memory

`lib/llm.ts` uses the official `openai` SDK through `client.chat.completions.create()` with strict JSON Schema output. The SDK handles authentication, JSON transport, timeouts, and HTTP errors. The existing schema and runtime answer/state validation remain in the adapter. See [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). One response contains `answer` and `conversationState`. State contains only `topic`, `intent`, `subject`, `dataDomain`, and `lastAction`. Fields are nullable, text fields are capped at 160 characters, and stale topics are replaced. Refused, incomplete, or invalid output fails the turn with a visible error.

The UI retains messages and per-turn traces in memory, but sends only the current message and latest state to the server. Refreshing or resetting clears the conversation. Selecting an older trace changes inspection only; the next message still uses the newest state. No database or browser persistence is used.

## Live-only behavior

Every successful turn uses the real Jev and OpenAI SDKs. There is no keyword router, canned answer generator, or provider fallback. Missing keys return HTTP 503. Provider failures return HTTP 502 with a provider-specific message, without exposing raw provider errors. Failed turns preserve the last successful conversation state and restore the input for manual retry.

Jev has a 15-second timeout and OpenAI has a 30-second timeout. Automatic retries and SDK logging are disabled. Successful model responses remain available in the turn inspector.

Retrieval always uses fictional hardcoded records in `data/`. It matches employees or customers and uses compact state to resolve follow-ups. Missing records produce clarification rather than an invented balance. There are no embeddings or vector databases. All data and raw traces are demo data. This local app has no authentication and should not be connected to private company records as-is.

## Live demo script

1. Ask **How many vacation days do I have left?** Inspect HR routing and the 12-day record.
2. Ask **And Tomek from Sales?** Inspect the previous state, HR route, and 7-day record.
3. Reset. Ask **Explain dependency injection in two sentences.** Confirm `NO_RAG` and skipped retrieval.
4. Reset. Ask **Does our product support SSO?** Then **What plan do I need?** Both should route to product docs and mention Business and Enterprise.
5. In that conversation, ask **How many vacation days do I have?** Confirm the switch from product docs to HR and updated state.
6. Ask **What plan is Globex on?** Confirm CRM and Enterprise. Follow with **Who is the account owner?** to see Anna.
7. Select an earlier turn in the inspector, open previous state and raw responses, and compare it with the latest turn.

## Code map

- `app/api/chat/route.ts`: validates the incoming message and compact state.
- `lib/chat.ts`: sequential routing, optional retrieval, generation, and trace timing.
- `lib/jev.ts`: all TypeSafe-specific routing logic.
- `lib/mockRag.ts`, `data/`: fictional sources and simple retrieval.
- `lib/llm.ts`: OpenAI answer/state generation and validation.
- `lib/conversationState.ts`, `types/`: compact state and application contracts.
- `components/`: chat, flow badges, and per-turn inspector.

## Formatting

Run `npm run format` to format the project, or `npm run format:check` to check formatting without changing files. Prettier is pinned as a dev dependency; generated files, dependencies, and environment files are ignored.

## Verify

```bash
npm run format:check
npm test
npm run typecheck
npm run build
```

Tests use HTTP fixtures with the real SDK adapters to check stage ordering, state propagation, source selection, skipped retrieval, required keys, and explicit provider failures. They do not measure real model routing accuracy. Run the demo script with valid API keys to evaluate live behavior.
