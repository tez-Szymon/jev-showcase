# Local verification · September 29, 2026

| Check                             | Result                                                    |
| --------------------------------- | --------------------------------------------------------- |
| TypeScript strict check           | Passed                                                    |
| Chrome and Firefox MV3 build      | Passed                                                    |
| Unit and transport-contract tests | 6 passed                                                  |
| Chromium fixture scenarios        | 3 passed                                                  |
| Installed Chrome MV3 smoke test   | Passed                                                    |
| Agent-browser visual smoke check  | Page, controls and meters render; no reported page errors |
| Firefox fixture scenarios         | Blocked at browser launch, not executed                   |
| Live paid Jev inference           | Not run; no API key supplied                              |
| Authenticated LinkedIn DOM        | Not tested against a real account                         |

The Chromium scenarios exercised viewport-only batching, identical-content clones, repeated refreshes, sensitivity changes without new requests, pause/resume, changed post text, dynamically inserted posts, network failure/retry, mobile overflow and rejected cross-origin calls. Every captured analyzed text was unique despite repeated DOM mutations and rescans.

The installed extension smoke test blocked the page's standalone content script and loaded `dist/chrome` into a fresh Chromium profile. This verified actual extension content injection, background HTTP transport, popup health status, disabling/enabling widgets, display preferences, and persistence after popup reload.

The TypeSafe adapter's transport test intercepted fetch and checked the endpoint, text-only state, question count/types, and rejection of HTTP 429. This validates local request handling, not model quality or API-account access. The request contract was inspected in the live OpenAPI schema before implementation.

Playwright downloaded Firefox 155, but Firefox exited with `Could not find profile folder` before any page loaded. Retrying with `TMPDIR=/private/tmp` produced the same error. The Firefox build uses its documented background scripts format, `browser` promise APIs, and website-content data consent declaration. Actual Firefox runtime and installation verification remain pending on a working Firefox environment.

Run `npm run test:browser` on a machine where both Playwright runtimes launch. The configuration retains Firefox rather than skipping it or marking it successful.

## 1.0.1 feed compatibility fix

The user supplied SDUI markup: a keyed `p` containing a `span[data-testid="expandable-text-box"]`, with randomized classes and a localized expand button. The original extractor recognized neither this prose marker nor a keyed-paragraph fallback. A synthetic regression fixture reproduces those attributes without retaining the user's post.

Verified: strict typecheck, both builds, 7 unit/contract tests, and 4 Chromium browser scenarios. The new scenario verifies keyed paragraphs, semantic list items, exclusion of comments/sidebar/expand-button text, and detection during continuous 30ms DOM mutations without repeat requests. Scheduling is now throttled rather than indefinitely reset by every mutation. The installed-extension test also intercepts the LinkedIn feed URL with synthetic SDUI HTML to exercise the actual manifest match, background messaging, and feed-status diagnostics. This is not an authenticated live LinkedIn test. Firefox runtime remains unverified due to the previously recorded launch issue.
