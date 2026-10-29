# Audit of v3.7.9 and what changed in v3.8.0

Date: 29 October 2026. Scope: server, client, dependencies, the public demo at demo.mercury.sh, the README, and the landing page at mercury.sh. Method: reading the code, running the app locally in normal and demo mode, probing the live demo with unauthenticated requests, running `npm audit`, comparing the OpenRouter catalogue with the hard-coded model lists, and a benchmark ([BENCHMARK.md](BENCHMARK.md)).

Status key: Fixed means the code or text was changed in v3.8.0. Corrected means the claim was rewritten to match reality. Open means it is still a limitation.

## Claims against evidence

| # | Claim (README, landing page or app) | Finding in v3.7.9 | Status |
|---|---|---|---|
| 1 | Models debate and vote "until they agree"; the app shows a consensus percentage. | Consensus was `successful responders / total`, so it was about 100 percent whenever the API calls succeeded, whatever the models said. Votes were never read. | Fixed. Models end debate and vote rounds with `VOTE: … \| SCORE: 1-10`, which is parsed; consensus is the mean score. Covered by unit tests. |
| 2 | "Early exit when the consensus threshold is reached." | The loop `break`ed after shrinking the total, skipping synthesis and the final answer. With the old consensus value it fired for the wrong reason. | Fixed. Early exit drops only the remaining debate and vote rounds. |
| 3 | The one-click "Quick debate" runs research, debate, vote, synthesis and final (3 models, 3 rounds). | Three rounds produced research, synthesis and final. There was no debate. | Fixed. Phases are planned explicitly; 3 rounds include a debate, and the quick debate is now 4 rounds. |
| 4 | "Custom roles change the entire debate dynamic." | The wizard and workflows collected role text, but the request never carried it. The server could not use it. The claim was never testable. | Fixed (roles are now sent and applied). Corrected (the claim is now an untested hypothesis in the engineering notes). |
| 5 | "Diversity beats raw capability. Three mid-tier models from different vendors outperform three instances of one frontier model." | No comparison existed. | Corrected. Removed from the README. The benchmark did not test panel composition, so the claim stays unproven. |
| 6 | "A panel gives you better answers than one model." (implied throughout) | Untested. | Measured. On 30 checkable questions a small-model panel matched the best single models and did not beat them; it was never without an answer, while 3 of 6 single arms had gaps. Open-ended questions are untested. See BENCHMARK.md. |
| 7 | Live updates over WebSocket, "no polling", with a server-sent-events fallback (landing page, all 15 languages). | The client polls the session every 2 seconds (3 seconds for child debates) as a fallback. There is no SSE. The README said 1.2 seconds. | Corrected in the README, engineering notes, and landing page. |
| 8 | "Your API key stays on the server and never reaches the browser" / "keys never leave your server". | Contradicts the session-only mode, where the key is held in the browser tab and sent with each request. Saved keys sit unencrypted in SQLite. | Corrected. Both modes and the plain-text storage are described plainly in the README, INSTALL and landing page. Open: keys are not encrypted at rest. |
| 9 | The public demo is a safe place to try Mercury. | `GET /api/sessions` was unauthenticated and returned every visitor's inquiries, answers and debates. Workflows and the theme were shared between all visitors. | Fixed. `MERCURY_DEMO=1` scopes sessions, workflows and theme per visitor (anonymous cookie), refuses to store keys, and caps models, rounds and request rate. Verified with two cookie jars. Existing orphaned sessions are hidden, not deleted. |
| 10 | The server is safe to expose. | An unauthenticated `/api/upload` endpoint wrote files to disk (unused by the client). There was no input validation on model IDs, round counts or temperature. A no-op key route and a legacy route used an internal Express API. | Fixed. Upload, legacy research and no-op routes removed; inputs validated and clamped. Added optional `MERCURY_PASSWORD`. Open: no accounts, and the demo rate limit is in memory. |
| 11 | "Full app i18n: 15 languages, every visible string." (v3.7.9 release notes) | About 45 strings were still hard-coded in English: the whole workflow editor, model search, round and consensus labels, several toasts, the menu aria labels and the onboarding intro. | Fixed. All moved into the string table with translations for all 15 languages (243 keys per language, up from 194). The translation sources are now in `script/i18n/`. |
| 12 | "100+ models", "Top 3 models", "GPT-4o + Claude 3.5 + Gemini 2.0". | OpenRouter lists 450+ models. The model lists were two generations old. The "Top 3" panel was whatever was hard-coded. | Fixed. Models refreshed; IDs centralised; `benchmark/verify_models.py` checks every ID against OpenRouter. Wording changed to "hundreds" and "three fast, low-cost models". |
| 13 | A friendly error is shown when a model fails. | No timeout, no retry, no handling of empty completions. A single hung request could block a round forever. | Fixed. 120-second timeout, three attempts with backoff, and per-model fallback for the final answer. |
| 14 | Follow-up questions continue the conversation. | A follow-up was sent with no context at all. | Fixed. It is answered with the original question, its answer, and the last three follow-ups. |
| 15 | The debate panel uses "the top half of models" after round 3 (README and notes). | The code did that, but it was an undocumented heuristic with no evidence behind it. | Removed. All selected models take part in every debate round; the rule was dropped rather than defended. |
| 16 | "Mercury v3.6" and "Current: v3.7.9" in different parts of the README. | Version strings were out of sync. | Fixed. One version source (`package.json`), mirrored in README, CHANGELOG, INSTALL and the landing page. |

## Other fixes

- Sessions left in the "running" state by a crash or restart are marked as errors on boot.
- Deleting an inquiry deletes its child debates (previously they were orphaned).
- The model catalogue endpoint filters out routers with placeholder negative prices and asynchronous batch variants, and is cached for 10 minutes.
- About 450 lines of a duplicate, unused wizard in `chat.tsx` and an unused `ModelSelector` component were deleted.
- `max_tokens` was too small for reasoning models and produced empty replies; it is now 8,000.

## Dependencies

`npm audit --omit=dev` before: 14 findings, 1 critical (`proxy-addr` via Express), 10 high. After `npm audit fix`, updating `drizzle-orm` to 0.45.4, and removing `multer` and the unused `zod-validation-error`: 2 findings.

- `zod` (high): a memory-exhaustion issue when validating oversized collections. Zod is used here only to derive TypeScript types from the Drizzle schema; no request body is parsed with it. A major upgrade (to 4.x) is deferred because it would need `drizzle-zod` changes. Open, low practical risk.
- `esbuild` in `tsx` (low): a Windows development-server file-read issue; not part of the production bundle. Open.

## Verification performed

- `npm run check`, `npm test` (8 unit tests) and `npm run build` pass.
- Local server in demo mode: key storage refused with 403, a second visitor gets 404 for the first visitor's session, an anonymous request lists no sessions, a 6-model request is rejected.
- Browser pass (Chromium, 1280 px and 375 px wide): onboarding in demo mode, a seeded debate with a vote round, the custom-setup wizard with the suggested panels. No console errors.
- Model IDs checked against the live OpenRouter catalogue.
- Benchmark: about 1,000 model calls across 7 arms.

## Not verified or still open

- Open-ended questions: no evidence either way on whether a panel helps.
- Browser automation did not exercise a real debate end to end through the UI (it needs a paid API key); the orchestrator was exercised through the benchmark harness instead.
- Saved keys are unencrypted; there are no user accounts; the demo rate limit is per process.
- Only 15 languages are covered by a manual read of the new strings. They were written for this release and have not been reviewed by native speakers.
