# ☿ Mercury

<div align="center">

**Ask once. Get an instant answer. Then, if it matters, let a panel of AI models research, debate and vote.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.8.0-brightgreen?style=for-the-badge)](CHANGELOG.md)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by OpenRouter](https://img.shields.io/badge/Powered%20by-OpenRouter-6c47ff?style=for-the-badge)](https://openrouter.ai)

[Live demo](https://demo.mercury.sh) · [Website](https://mercury.sh) · [Install](INSTALL.md) · [Changelog](CHANGELOG.md) · [Audit](docs/AUDIT.md) · [Benchmark](docs/BENCHMARK.md)

</div>

---

## What it is

Mercury is a self-hosted web app for asking one question to many language models through [OpenRouter](https://openrouter.ai). Every inquiry gets a fast answer from a single cheap model within seconds. From there you can ask follow-ups, or launch a debate in which a panel of models you choose works through the question in rounds:

1. **Research.** Each model answers independently.
2. **Debate and vote.** Each model reads the others' answers, points out errors, and ends with a vote and a 1 to 10 agreement score.
3. **Synthesis.** The panel's surviving claims are merged.
4. **Final answer.** One model writes the answer to your original question.

You can watch the rounds arrive live, reopen old debates, run several debates under one inquiry, and save panel setups as workflows (including a custom role per model). The interface is available in 15 languages.

## What it does and does not do

Mercury is a way to compare and combine several models and to see their disagreement. It is not a guarantee of a better answer. On a 30-question test with exactly checkable answers, a four-round debate between three small models scored the same as the best single models, cost about twelve times as much as one small-model call, and took about seven times as long. It did answer every question, while three of the six single-model arms had at least one run with no answer. The question types where a panel is supposed to help (open-ended strategy, judgement, research synthesis) are not measured. Read [docs/BENCHMARK.md](docs/BENCHMARK.md) for the method, the numbers and the limits.

The "consensus" percentage is the models' own report of how much they agree. It tells you when the panel has settled, not whether it is right.

## Quick start

Requirements: Node.js 20 or newer and an [OpenRouter API key](https://openrouter.ai/keys).

```bash
git clone https://github.com/paulfxyz/mercury.git
cd mercury
npm install
npm run dev          # http://localhost:5000
```

Production build: `npm run build && npm start`. Docker and Fly.io instructions are in [INSTALL.md](INSTALL.md).

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP port. |
| `DB_PATH` | `mercury.db` | Location of the SQLite file. |
| `MERCURY_PASSWORD` | unset | If set, the whole app (including the WebSocket) asks for this password using HTTP Basic authentication. Use it for any instance reachable from the internet. |
| `MERCURY_DEMO` | unset | Set to `1` for a public demo. See below. |

### Your API key

Mercury has two ways to hold your OpenRouter key:

- **This session only.** The key lives in the browser tab's memory and is sent in an `X-Api-Key` header with each request. The server uses it for that request and does not store it.
- **Save on server.** The key is stored in the SQLite database in plain text, so anyone who can read the database file or reach an instance without a password can use it. This is fine on your own machine. For anything exposed, set `MERCURY_PASSWORD`, protect the volume, or use session-only keys.

### Public demo mode

`MERCURY_DEMO=1` is for instances that strangers can open, such as [demo.mercury.sh](https://demo.mercury.sh). In this mode:

- Keys are never stored on the server; visitors paste their own, kept in their tab.
- Each visitor only sees their own inquiries, workflows and theme (identified by an anonymous cookie). Nothing is shared between visitors.
- Limits apply: at most 5 models and 10 rounds per debate, and 20 new inquiries per hour per visitor.

The cookie identifies a browser, not a person. Clearing cookies orphans that visitor's data.

## How it works

```
client (React, Vite, Tailwind, TanStack Query, 15 languages)
   │  REST + WebSocket (/ws?sessionId=…)
server (Express, ws)
   ├─ routes.ts        validation, key resolution, demo scoping, optional password
   ├─ orchestrator.ts  OpenRouter client (timeout, retries, cost), phase plan, vote parsing
   └─ storage.ts       SQLite through Drizzle ORM
```

- **Phases.** `planPhases(n)` builds research, alternating debate and vote rounds, synthesis, and a final round. A 2-round run is research and final; a 3-round run adds one debate round.
- **Consensus.** Models end debate and vote rounds with `VOTE: <AGREE|PARTIALLY_AGREE|DISAGREE> | SCORE: <1-10>`. The round's consensus is the mean score. When a vote round after at least two debate rounds reaches your threshold, the remaining debate rounds are skipped and the run goes to synthesis and the final answer.
- **Resilience.** Each OpenRouter call has a 120-second timeout and up to three attempts with backoff on rate limits, server errors, network errors and empty completions. A model that keeps failing is skipped in later rounds; the final answer falls back to the next model.
- **Live updates.** Progress is pushed over the WebSocket. The session page also polls every 2 seconds as a fallback, for example after a refresh mid-debate. There is no server-sent-events path.
- **Threads.** A debate runs as a child session under its inquiry, so one inquiry can hold several debates and follow-ups in order. Only one debate can run per thread at a time.
- **Cost.** OpenRouter reports the exact cost of every call; the orchestrator sums it per run.

More detail, including the hardest bugs and the reasoning behind decisions, is in [docs/ENGINEERING_NOTES.md](docs/ENGINEERING_NOTES.md).

## Models

Model IDs are checked against the live OpenRouter catalogue by `python3 benchmark/verify_models.py`. As of 29 October 2026 the wizard suggests four starting panels; the lists are in `client/src/lib/models.ts` and `shared/defaults.ts`, and you can pick any model OpenRouter offers.

| Panel | Models |
|---|---|
| Quick and affordable (the one-click default) | Claude Haiku 5.5, GPT-6 Luna, DeepSeek V4.1 Flash |
| Balanced | GPT-6.1 Terra, Claude Sonnet 5.5, Gemini 3.8 Flash, Grok 4.7 |
| Frontier | Claude Opus 5.5, GPT-6.1 Sol, Gemini 4 Argon, Grok 4.7 |
| Global mix | Kimi K3.1 Pro, DeepSeek V4.1 Flash, GLM 5.3 Prime, Qwen 3.8 Max Prime, Mistral Large 4 |

These are starting points. The benchmark did not compare panel compositions, so there is no evidence yet that mixing vendors beats using one.

## Project layout

```
client/src/        pages (chat, session, workflows, settings, onboarding), components, lib (i18n, models, config)
server/            index, routes, orchestrator (+ tests), storage, static, vite
shared/            schema.ts (Drizzle tables), defaults.ts (model IDs and limits used by both sides)
script/i18n/       sources for the 15-language string table (python3 script/i18n/combine.py)
benchmark/         questions, runner, report, model-ID check, raw results
docs/              AUDIT.md, BENCHMARK.md, ENGINEERING_NOTES.md
```

Useful commands: `npm run check` (types), `npm test` (unit tests for phase planning and vote parsing), `npm run build`.

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | `{ demo, limits, quickModel }` |
| `GET` | `/api/onboarding` | `{ hasApiKey }` |
| `GET/POST` | `/api/settings/theme` | Theme persistence (per visitor in demo mode) |
| `GET/POST` | `/api/keys` | List or add saved keys (disabled in demo mode) |
| `POST` | `/api/keys/:id/primary` | Make a saved key primary |
| `DELETE` | `/api/keys/:id` | Delete a saved key |
| `POST` | `/api/keys/migrate-legacy` | Move a pre-3.5 key into the key manager |
| `GET` | `/api/models` | Text models available on OpenRouter (cached for 10 minutes) |
| `POST` | `/api/detect-complexity` | `{ complexity: "simple" \| "complex" }` |
| `POST` | `/api/quick-answer` | New inquiry answered by the quick model |
| `POST` | `/api/inquire` | New inquiry with a full debate |
| `POST` | `/api/sessions/:id/debate` | Launch a debate under an existing inquiry |
| `POST` | `/api/sessions/:id/followup` | Follow-up answered with the thread as context |
| `GET` | `/api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/iterations` | Read inquiries and debate rounds |
| `PATCH` | `/api/sessions/:id/title`, `/api/sessions/:id/pin` | Rename or pin |
| `DELETE` | `/api/sessions/:id`, `/api/sessions` | Delete one inquiry (and its debates) or all of yours |
| `GET/POST/PUT/DELETE` | `/api/workflows` | Saved panel setups |
| `GET` | `/healthz` | Liveness check |
| `WS` | `/ws?sessionId=:id` | Live stream for one session |

A debate request accepts `selectedModels` (array of OpenRouter IDs), `roles` (optional array of per-model role text, same order), `iterations`, `temperature` and `consensusThreshold`. The server validates and clamps all of them.

WebSocket events: `iteration_start`, `iteration_complete` (with `responses[]`, `consensus`), `early_consensus`, `completed` (with `finalAnswer`, `consensus`, `costUsd`), `quick_start`, `quick_complete`, `debate_started`, `followup_complete`, `followup_error`, `error`.

A request with an `X-Api-Key: sk-or-v1-…` header uses that key. Without it, the server falls back to the saved primary key, except in demo mode.

## Known limitations

- Self-hosted instances have no user accounts. Access control is the optional `MERCURY_PASSWORD`; saved keys are stored unencrypted.
- The demo rate limit is in memory, per process, and resets on restart.
- SQLite on a single machine; not designed for multiple instances.
- A model that spends its whole output budget on hidden reasoning returns an empty answer; Mercury retries and then skips it for that round.
- The test suite is small: unit tests for planning and vote parsing, plus the benchmark and manual smoke tests. There are no end-to-end tests in the repository.

See [docs/AUDIT.md](docs/AUDIT.md) for the full list of what was checked and changed in v3.8.0.

## Changelog

The latest release is **v3.8.0**: a code and claims audit, a real consensus mechanism, a public-demo privacy fix, refreshed models, a benchmark, and the remaining hard-coded English removed from the interface. See [CHANGELOG.md](CHANGELOG.md).

## Author

**Paul Fleury**, French internet entrepreneur based in Lisbon.

- [paulfleury.com](https://paulfleury.com)
- GitHub: [@paulfxyz](https://github.com/paulfxyz)
- [Openline](https://openline.com): instant eSIMs in 190+ countries

Other projects: [mang.sh](https://mang.sh) · [ase.so](https://ase.so)

---

## 🤙 A note on vibe coding

This project is 100% vibe coding.

I am not a software engineer, a professional developer, or a computer scientist. I don't pretend to be. I'm a former hacker turned entrepreneur — someone who has always had a healthy obsession with technology and a very good working relationship with AI tools like [Claude](https://claude.ai) and [Perplexity Computer](https://computer.perplexity.ai).

Every line of code in Mercury was written in collaboration with AI. The architecture decisions, the bug fixes, the TypeScript types, the SQL schema, the Dockerfile — all of it emerged from a conversation, not a career. The technical depth in this README reflects what I've learned *during* the build, not what I knew going in.

If something in here looks well-engineered, credit the tools. If something looks opinionated or unconventional, that's probably me.

Vibe coding doesn't mean low quality. It means the barrier between an idea and a working product is now a conversation. I think that's worth celebrating.

---

*MIT licensed. See [LICENSE](LICENSE).*
