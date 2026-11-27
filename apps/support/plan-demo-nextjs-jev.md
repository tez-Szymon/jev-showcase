---
title: Support request demo with optional Jev
type: feat
status: active
date: 2026-09-24
---

# Support request demo with optional Jev

## TL;DR

One Next.js application, two portals without authentication, and a shared request database.
The `JEV_ENABLED` flag switches between manual handling and Jev-assisted handling.
Consultants adjust automation thresholds in the UI without rebuilding the application.
Jev routes requests that meet the rules and leaves the rest for a consultant.
The demo ends processing when a request is assigned to a team.

**Key decisions:** App Router, TypeScript, SQLite, one demo customer, and a server-side TypeSafe integration. Both modes share the same code. Spam handling remains manual.

**Open questions and risks:** The plan assumes a local demo using TypeSafe's Jev. Real calls require an API key. Initial thresholds are examples to tune on representative requests, not measured quality guarantees.

**Language update:** The interface, routes, sample data, documentation, and classification prompt use English. The original plan targeted Polish requests. Changing the prompt requires a new question version and fresh threshold evaluation. Existing user-written content is preserved.

## Problem and goal

Demonstrate the same workflow in two modes: consultants categorize requests themselves, or Jev handles clear-cut cases. Users should see why a request was routed automatically or left for review and be able to adjust the automation boundary.

User requirements: Next.js, one repository, two portals without authentication, two modes controlled by a flag, and configurable thresholds. The remaining choices below define the implementation. Sample data represents an internet provider; that affects examples and category descriptions, not the architecture.

At planning time, the workspace had no application code, `AGENTS.md`, wiki, previous plans, or rejected ideas. There were no existing `path:line` patterns to copy. The paths below establish the application's conventions.

## Task characteristics

- `ui_facing: true`: customer form, consultant queue, and settings.
- `structural: true`: new application, request workflow, and Jev adapter.
- `data_operations: true`: persistent requests, analyses, and settings.
- `security_sensitive: true`: server-only API key and validated mutations. No authentication is an intentional demo constraint.
- `trivial_scope: false`: a complete workflow across two portals and an external API.

## Implementation handoff

### Screens and scope

| Route                      | Behavior                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/`                        | Portal selection and visible Manual or Jev mode.                                                                     |
| `/customer`                | Subject and description form, plus one demo customer's request history.                                              |
| `/customer/tickets/[id]`   | Request content, status, and assigned team.                                                                          |
| `/consultant`              | Queue filtered by needs review, assigned, or spam; automatic-assignment counter.                                     |
| `/consultant/tickets/[id]` | Content, category, team, assignment, spam, and restore controls. Jev mode also shows the analysis and decision rule. |
| `/consultant/settings`     | Threshold form, category overrides, save, and restore defaults.                                                      |

No accounts or user tables. All requests belong to one demo customer. Portals are separate routes without access control. Assigning a team writes the assignment and status to the database. It sends no messages and calls no departmental systems.

Consultant categories: `technical` → IT, `complaint` → Complaints, `offer` → Marketing, `other` → Customer support. One shared catalog supplies the form, validation, and Jev adapter. The consultant selects a category; the application derives the team.

### Architecture

- Next.js App Router and TypeScript, one application package and npm lockfile. No monorepo, separate backend, or duplicate screens for the two modes.
- Server Components read the database; Server Actions handle forms. Client Components are limited to interactions. See [Next.js mutations](https://nextjs.org/docs/app/getting-started/mutating-data).
- SQLite through `better-sqlite3`, using `data/demo.sqlite` and the Node.js runtime. Transactions cover request changes and history, never the API wait. The library supports transactions and parameterized queries. See the [project documentation](https://github.com/WiseLibs/better-sqlite3).
- Local execution uses one server and a persistent database file. Hosting with an ephemeral filesystem needs a later storage change.
- Zod validates forms on the server. Trimmed subject: 3–160 characters. Trimmed description: 10–5,000 characters. No attachments or HTML.
- Mutations invalidate the relevant routes and refresh the view. The other portal provides a Refresh button and refreshes when focus returns. No WebSockets or promise of instant synchronization between tabs.
- Database, environment, and Jev modules use `server-only`. The API key never reaches the browser.
- English UI and date formatting; decimal points for numeric scores. Keep the configured Europe/Warsaw display time zone and UTC storage.

### Feature flag and configuration

Server configuration in `.env.local`, documented in `.env.example`:

```dotenv
JEV_ENABLED=false
TYPESAFE_API_KEY=
TYPESAFE_DEFAULT_MODEL=jev-1.13.0
DATABASE_PATH=./data/demo.sqlite
```

With `JEV_ENABLED=false`, every new request goes to a consultant, without initializing TypeSafe or calling its API. With `true`, new requests go through Jev. The flag has no `NEXT_PUBLIC_` prefix. Changing it requires restarting Next.js, not building a second application. History and assignments survive mode changes. Enabling the flag does not automatically analyze old requests.

Thresholds live in the database, are edited at `/consultant/settings`, and are read for each new analysis:

| Setting             | Initial value | Rule                                                                     |
| ------------------- | ------------- | ------------------------------------------------------------------------ |
| `minConfidence`     | `0.90`        | Minimum Jev confidence.                                                  |
| `minMargin`         | `0.20`        | Minimum difference between the highest and second-highest probabilities. |
| `categoryOverrides` | `{}`          | Optional confidence overrides for `technical`, `complaint`, and `offer`. |

Numeric fields and sliders range from 0 to 1 in 0.01 steps. The server rejects missing, non-finite, or out-of-range values. The form shows each category's effective threshold. Saving is atomic, increments `version`, and requires the expected version to prevent a stale tab from overwriting settings. Restoring defaults also creates a new version.

Confidence describes distribution concentration, not "90% correct decisions." Display "Jev confidence: 0.90" separately from category probabilities. Thresholds require evaluation on the application's own data. See [TypeSafe confidence](https://docs.typesafe.ai/confidence).

Settings changes affect analyses started after the save. Every analysis keeps its starting settings snapshot. Earlier statuses remain unchanged. Request details can preview "What would happen with current thresholds?" using saved results. The preview makes no writes or API calls and is available only for compatible question and catalog versions.

### Workflow and automatic decisions

1. Validate the form and save a request with `needs_review` status. The client also submits a UUID `submissionId`; a unique index prevents duplicate requests when the same submission is retried.
2. If Jev is disabled, return confirmation immediately.
3. If Jev is enabled, record an attempt and settings snapshot. Await analysis within the same request for at most eight seconds, with no automatic retries. Show a pending state in the form.
4. Select one of `technical`, `complaint`, `offer`, `other`, `mixed`, `insufficient`, or `spam`. Special labels cover no category match, multiple equally important requests, insufficient information, and spam.
5. Automation is allowed only for the first three labels, when `confidence >= effectiveThreshold` and `p1 - p2 >= minMargin`. Both conditions must pass. Equality passes.
6. A positive result saves the category, team, `decisionBy=jev`, and `routed` status. Every other result leaves `needs_review` with a reason code. Suspected spam is never deleted automatically.
7. A consultant selects and accepts a category or moves the request to spam. They can also correct a Jev assignment. Restoring spam always returns to `needs_review`, without rerunning automation.

AI result persistence checks the request's starting version and status. If a consultant has already made a decision, save the late analysis as not applied; do not overwrite the human decision. Save request changes and their history event in one transaction.

This small demo has no worker or job queue. A process crash during the API call leaves a saved request available for manual review. When read, an attempt still marked started after eight seconds is shown as interrupted. It does not disable consultant controls.

### Jev contract and application logic

Use `@typesafe-ai/sdk`, `TypeSafeClient.systemOne`, and a `choice` question. Input is `{ ticket: { subject, description } }`. Criteria describe category boundaries, including `mixed` and `insufficient`; low confidence alone is not assumed to detect every ambiguous case. See the [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript) and [Choice](https://docs.typesafe.ai/primitives/choice).

Pin the planned model to `jev-1.13.0` and save the actual response model identifier. Model or question changes require threshold reevaluation. English samples are now the demo baseline; quality in any other language must be evaluated on representative content. See [TypeSafe models](https://docs.typesafe.ai/models).

Configure `timeout: 8000` and a single attempt without retries, according to the installed SDK's types. The timeout applies per attempt, so timeout alone does not bound total time when retries are enabled. See [client configuration](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig) and [retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy).

Application contracts, rather than a copy of the entire provider API:

```ts
type Category = 'technical' | 'complaint' | 'offer' | 'other';
type Label = Category | 'mixed' | 'insufficient' | 'spam';
type Status = 'needs_review' | 'routed' | 'spam';
type Reason = 'manual_mode' | 'special_label' | 'low_confidence'
  | 'small_margin' | 'api_error' | 'invalid_result' | 'auto_routed'
  | 'stale_result';

type Settings = {
  version: number;
  minConfidence: number;
  minMargin: number;
  categoryOverrides: Partial<Record<'technical' | 'complaint' | 'offer', number>>;
};
type Analysis = {
  choice: Label;
  confidence: number;
  probabilities: Record<Label, number>;
  model: string;
  questionVersion: string;
};
type Decision =
  | { action: 'route'; category: 'technical' | 'complaint' | 'offer'; reason: 'auto_routed' }
  | { action: 'review'; reason: Reason };
type Result<T> = { ok: true; data: T } | {
  ok: false;
  code: 'validation' | 'not_found' | 'conflict' | 'storage';
  message: string;
};

classifyTicket(input: { subject: string; description: string }): Promise<Analysis>;
decideRouting(analysis: Analysis, settings: Settings): Decision;
submitTicket(input: { submissionId: string; subject: string; description: string }): Promise<Result<{ id: string }>>;
routeTicket(input: { id: string; category: Category; expectedVersion: number }): Promise<Result<void>>;
markSpam(input: { id: string; expectedVersion: number }): Promise<Result<void>>;
restoreTicket(input: { id: string; expectedVersion: number }): Promise<Result<void>>;
saveSettings(input: Omit<Settings, 'version'>, expectedVersion: number): Promise<Result<Settings>>;
```

Validate responses before applying rules: complete label set, finite numbers in [0,1], probability sum within 0.01 of 1, and a choice that matches the maximum probability. Missing fields, unknown labels, or inconsistent output require manual review. Explain the reason code in the UI, for example "Confidence 0.82 below threshold 0.90." Do not invent model explanations.

### Data

- `tickets`: `id`, unique `submission_id`, `subject`, `description`, `status`, nullable `category`, nullable `department`, nullable `decision_by`, `version`, `created_at`, `updated_at`. `routed` requires a category and its matching team. Spam and restore clear the active assignment; history preserves earlier assignments.
- `analyses`: `id`, `ticket_id`, `started_at`, nullable `finished_at`, `started|success|error` status, nullable `Analysis` JSON, `Settings` snapshot JSON, `reason`, `applied`, nullable error code. Never store API keys or full provider errors.
- `settings`: one record with version, thresholds and overrides as JSON, and change time. Created once; restarting does not reset it.
- `ticket_events`: `id`, `ticket_id`, `actor=client|consultant|jev|system`, event kind, before and after state JSON, and time. History is visible in consultant details.

Use UUIDs and UTC timestamps. Categories and teams live in the code catalog. No catalog CRUD, account tables, or separate permission system.

For databases created before the English update, migrate team names and unchanged sample content without deleting requests or resetting settings. Retain user-written text, IDs, decisions, and timestamps. Translate sample snapshots consistently with current sample rows. Increment the question/catalog version so old analyses are not silently treated as results from the new prompt.

### Files

The original workspace had no existing files or neighboring patterns to follow. The structure below establishes the project's conventions.

| File                                                                                                                                                                                                                            | Responsibility                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`                                                                                                      | Next.js, TypeScript, ESLint, and scripts; ignore local environment, database, and test reports.              |
| `.env.example`, `README.md`                                                                                                                                                                                                     | Both startup modes, API configuration, thresholds, sample data, and local-only scope.                        |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`                                                                                                                                                                 | Shell, portal selection, and plain CSS without a component framework.                                        |
| `src/app/error.tsx`, `src/app/not-found.tsx`                                                                                                                                                                                    | Read errors and missing-request screens.                                                                     |
| `src/app/customer/page.tsx`, `src/app/customer/tickets/[id]/page.tsx`                                                                                                                                                           | Customer form, list, and details.                                                                            |
| `src/app/consultant/page.tsx`, `src/app/consultant/tickets/[id]/page.tsx`                                                                                                                                                       | Queue, decisions, analysis, and history.                                                                     |
| `src/app/consultant/settings/page.tsx`                                                                                                                                                                                          | Settings read and threshold form.                                                                            |
| `src/app/actions/tickets.ts`, `src/app/actions/settings.ts`                                                                                                                                                                     | Thin Server Actions, input validation, service calls, and route invalidation.                                |
| `src/components/ticket-form.tsx`, `src/components/ticket-controls.tsx`, `src/components/threshold-form.tsx`, `src/components/analysis-panel.tsx`, `src/components/refresh-control.tsx`, `src/components/ticket-list.tsx`        | Forms, pending states, feedback, rule preview, refresh, and shared lists.                                    |
| `src/lib/domain.ts`, `src/lib/catalog.ts`, `src/lib/validation.ts`                                                                                                                                                              | Types, category mapping, and Zod schemas.                                                                    |
| `src/lib/env.ts`, `src/lib/db.ts`, `src/lib/schema.sql`, `src/lib/repository.ts`, `src/lib/migrations.ts`, `src/lib/legacy-seed-hashes.json`                                                                                    | Environment, SQLite initialization, queries, transactions, and safe migration of the original demo database. |
| `src/lib/ticket-service.ts`, `src/lib/settings-service.ts`, `src/lib/runtime.ts`                                                                                                                                                | Request flow, version checks, settings persistence, and runtime wiring.                                      |
| `src/lib/jev/client.ts`, `src/lib/jev/questions.ts`, `src/lib/jev/policy.ts`                                                                                                                                                    | Adapter, versioned criteria, and pure decision rules.                                                        |
| `scripts/seed.ts`, `fixtures/tickets.json`                                                                                                                                                                                      | Idempotent sample seeding into the manual queue, without API calls or deleting data.                         |
| `vitest.config.ts`, `playwright.config.ts`, `tests/policy.test.ts`, `tests/ticket-service.test.ts`, `tests/settings.test.ts`, `tests/adapter.test.ts`, `tests/migrations.test.ts`, `tests/e2e/demo.spec.ts`, `tests/fixtures/*` | Rule, service, migration, SDK transport, and end-to-end tests.                                               |

Patterns: parameterized application queries in the repository, validation on every mutation, expected errors as `Result`, and technical errors without secrets. The lack of an authorization boundary is intentional. Tests inject a Jev adapter or control HTTP transport; the application has no mock mode and never presents mock results as real analysis.

### Edge cases

| Case                                                            | Expected behavior                                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No key, flag off                                                | Complete manual flow with no API dependency.                                                       |
| No key, 429, timeout, or API error with flag on                 | Saved request stays available for review; unavailable analysis is shown.                           |
| Restart during analysis                                         | Request remains in the manual queue; interrupted analysis does not block handling.                 |
| Result exactly at a threshold                                   | Automation passes if all other conditions pass.                                                    |
| High confidence for `spam`, `mixed`, `other`, or `insufficient` | Always consultant review.                                                                          |
| Thresholds change during a call                                 | Analysis uses its saved settings version.                                                          |
| Consultant acts during analysis or from a stale tab             | Conditional writes protect the latest decision; conflicts require refresh.                         |
| Same `submissionId` submitted again                             | Return the same request ID without another analysis; different content conflicts.                  |
| Database error before creation                                  | The form does not report success.                                                                  |
| Analysis result write fails                                     | The request remains available for manual review; no fictional assignment is shown.                 |
| Manual routing attempted from spam                              | Restore to the queue first.                                                                        |
| Existing database opened after translation                      | Preserve request history and decisions; migrate only controlled labels and unchanged seed content. |

### Tests and acceptance criteria

- `tests/policy.test.ts`: eligible labels route only when both thresholds pass; either failure causes review; equality passes; category overrides work; special labels and invalid data never route.
- `tests/ticket-service.test.ts`: disabled flag makes no adapter call; model errors preserve requests; duplicates produce one record; late AI cannot overwrite a consultant; assignment and history are atomic; spam restores; timeout and interrupted attempts remain manually actionable. Use isolated databases.
- `tests/settings.test.ts`: validate ranges and versions, persist across database reopen, and preserve previous decisions after settings changes.
- `tests/adapter.test.ts`: validate real SDK request/response mapping using a controlled transport, reject malformed output, and disable retries.
- `tests/migrations.test.ts`: safely convert an existing database, preserve IDs, decisions and user text, update sample snapshots, enforce the new team constraints, and remain idempotent.
- `tests/e2e/demo.spec.ts`: customer submits, consultant assigns, customer refreshes and sees the team; identical classification routes below one confidence threshold and waits above another; spam/restore, settings conflicts, category override/reset, and mobile navigation work. Assert state changes and outcomes rather than element existence alone.
- SDK tests make no external network calls. Playwright uses controlled HTTP responses or a test adapter at the service boundary. Run separate servers for each flag value with isolated databases.
- A separate live Jev check should cover clear, mixed, sparse, and spam requests in English. Record assignment correctness and the share of automated decisions at several thresholds. This is a tuning exercise, not a guarantee that every example always passes a threshold.

Scripts: `npm run lint` → `eslint .`; `npm run typecheck` → `tsc --noEmit`; `npm test` → `vitest run`; `npm run test:e2e` → `playwright test`; `npm run build` → `next build`; `npm run db:seed` → the seed script under the server condition; `npm run dev` → the local server. Record exact resolved dependency versions in the npm lockfile.

### Implementation order

1. Create the Next.js app, configuration, and SQLite storage. Acceptance: both portals read the same persistent requests.
2. Build manual submission, queue, category selection, assignment, spam, and restore. Acceptance: complete handling without an API key.
3. Add the server flag, persistent versioned settings, and pure decision function. Acceptance: threshold boundary tests and settings saves.
4. Connect the real Jev adapter, timeout, result validation, and concurrent-decision protection. Acceptance: automatic and manual outcomes in one application.
5. Add analysis, history, current-threshold preview, and sample requests. Acceptance: a clear demonstration across two browser tabs.
6. Run tests and production build, evaluate the real API on representative requests, and complete the README. If a key is unavailable, explicitly record that live integration was not checked. Test doubles do not replace that evaluation.
7. Translate all application-owned content and the plan to English; migrate existing controlled data; rerun the relevant checks. Prepare a local commit. Do not publish or push until requested again.

Implement sequentially: this small application shares categories, types, services, and a database. Independent implementation groups would not help.

### Pitfalls and boundaries

Confidence and the winning category's probability are different values. Changing labels can change the distribution and requires retuning. A high score for a special category does not authorize automation. Page cache invalidation alone does not synchronize all tabs. Do not leave analysis running as an unawaited background call without a persistent queue. Saving before the API call makes manual handling possible after interruption.

Out of scope: authentication, real customer accounts, departmental portals, replies, SLAs, attachments, email/SMS, CRM/Jira integration, automatic spam deletion, splitting requests across teams, automatic historical reprocessing, production infrastructure, and deployment. Do not add these to the demo incidentally.
