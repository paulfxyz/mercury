# ☿ Mercury

<div align="center">

**Not a chatbot. A thinking process.**

*Submit an inquiry. An expert panel of AI models debates, challenges, and votes until they agree.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.0.0-brightgreen?style=for-the-badge)](CHANGELOG.md)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by OpenRouter](https://img.shields.io/badge/Powered%20by-OpenRouter-6c47ff?style=for-the-badge)](https://openrouter.ai)
[![Deploy on Fly.io](https://img.shields.io/badge/Deploy%20on-Fly.io-7c3aed?style=for-the-badge&logo=flydotio&logoColor=white)](https://fly.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](https://github.com/paulfxyz/mercury/pulls)
[![Self-hosted](https://img.shields.io/badge/Self--hosted-your%20server-111?style=for-the-badge)]()

<a href="https://demo.mercury.sh">
  <img src="https://paulfleury.com/github/mercury.png" alt="Mercury — Expert Inquiry Engine" width="700" />
</a>

*→ [demo.mercury.sh](https://demo.mercury.sh) — live instance, bring your own OpenRouter key*

</div>

---

```
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║   ☿   MERCURY   ·   Expert Inquiry Engine            ║
  ║                                                      ║
  ║   One model gives you an answer.                     ║
  ║   Many models give you the truth.                    ║
  ║                                                      ║
  ║   Submit → Detect → Debate → Synthesise → Consensus  ║
  ║                                                      ║
  ║   v3.0.0  ·  mercury.sh  ·  github.com/paulfxyz      ║
  ╚══════════════════════════════════════════════════════╝
```

---

> This README is a complete technical reference — not just *how* to run Mercury, but *why* every architectural decision was made, the real bugs that surfaced in production, and the lessons learned building a multi-model consensus engine from scratch. If you're building something similar or curious about multi-agent orchestration, read on.

---

## Table of Contents

1. [Why this exists](#-why-this-exists)
2. [How it works](#-how-it-works)
3. [Feature overview](#-feature-overview)
4. [Quick start](#-quick-start)
5. [Deploy to Fly.io](#-deploy-to-flyio)
6. [See it in action](#-see-it-in-action)
7. [Architecture deep dive](#-architecture--how-it-works)
8. [The hardest problems](#-the-hardest-problems)
9. [Bugs worth documenting](#-bugs-worth-documenting)
10. [Lessons learned](#-lessons-learned)
11. [Building with Perplexity Computer](#-building-with-perplexity-computer)
12. [Project structure](#-project-structure)
13. [API reference](#-api-reference)
14. [Configuration](#️-configuration)
15. [Model recommendations](#-model-recommendations)
16. [Changelog](#-changelog)
17. [Contributing](#-contributing)
18. [Author](#-author)

---

## 👨‍💻 Why this exists

I'm **Paul Fleury** — French internet entrepreneur based in Lisbon. I run [Openline](https://openline.ai) and build products across a wide surface area: infrastructure, automation, AI tooling.

I kept running into the same frustration with LLMs. Not that they were wrong — but that I had no reliable way to *know* when they were wrong.

Ask GPT-4o about a nuanced strategic question. Get a confident, well-written answer. Ask Claude the same question. Get a different confident, well-written answer. Ask Llama. Another one. None of them will volunteer that the other three disagreed with them.

This is the single-model trap: you get one perspective dressed up as an answer. The model has no incentive to flag its own uncertainty. It fills the void with confidence.

The scientific community solved this centuries ago: peer review. You don't publish a finding by asking one expert. You submit it to a panel. They challenge the methodology. They identify weaknesses. They argue. The consensus that emerges from that process is worth more than any single expert's opinion.

Mercury applies that same logic to AI. Your inquiry goes through a configurable panel of models. They research independently, challenge each other's findings, vote on what they agree with, and synthesise toward a final answer — only when they reach sufficient consensus.

**The result is not just an answer. It is a debugged answer.**

> 💡 Designed and built in full collaboration with **[Perplexity Computer](https://www.perplexity.ai)** — from architecture through implementation, debugging, and documentation. Human intent + AI execution.

---

## 🔬 How it works

When you submit an inquiry, Mercury runs a 5-phase orchestrated debate:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Research   │ →  │   Debate    │ →  │    Vote     │ →  │  Synthesis  │ →  │   Final     │
│             │    │             │    │             │    │             │    │   Answer    │
│ All models  │    │ Models read │    │ Each model  │    │ Best points │    │ Definitive  │
│ analyse     │    │ each other, │    │ votes:      │    │ extracted,  │    │ consensus   │
│ the inquiry │    │ challenge,  │    │ AGREE /     │    │ contradic-  │    │ response    │
│ from scratch│    │ push back   │    │ PARTIALLY / │    │ tions       │    │             │
│             │    │             │    │ DISAGREE    │    │ resolved    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

Before that, a **complexity detector** classifies the inquiry:

- **Simple** (factual, one-answer) → instant response from a single cheap model, with an option to escalate to the full debate
- **Complex** (nuanced, multi-perspective) → launches the 5-step wizard to configure and launch the full panel debate

Every response is streamed live via **WebSocket** so you can watch the debate unfold in real time.

---

## 🌟 Feature overview

| Feature | Detail |
|---|---|
| 🧠 Smart routing | Heuristic + LLM classifier detects simple vs. complex queries before committing resources |
| ⚡ Quick answer | Simple questions answered instantly by a single model — no waiting for a 15-round debate |
| 🧙 Inquiry wizard | 5-step modal: team size → models → rounds → temperature → consensus threshold |
| 💾 Workflow system | Save configurations as named workflows and reuse them across future inquiries |
| 📡 Real-time live panel | WebSocket streams every model response as it arrives — watch the debate happen |
| 📊 Phase timeline | Visual tracker pulses at the active phase: Research → Debate → Vote → Synthesis → Final |
| 🎯 Consensus score | Final answer carries a % consensus score based on model agreement across rounds |
| 🌡️ Temperature control | Per-workflow temperature: 0 = precise and conservative, 1 = creative and exploratory |
| 📐 Consensus threshold | Set the required agreement % before Mercury considers the debate settled; early exit if met |
| 🔒 Self-hosted | Your API key, your server, your data. Nothing leaves your infrastructure |
| ☀️🌙 Light + dark mode | Persistent, server-stored theme preference |
| 📄 Export | Copy or download final consensus answer as Markdown |
| 🗂️ History | All sessions, debate rounds, and final answers preserved in SQLite |

---

## 🚀 Quick start

### Prerequisites

- Node.js 20+
- An [OpenRouter](https://openrouter.ai/keys) API key — free tier available, no credit card required

### Run locally

```bash
git clone https://github.com/paulfxyz/mercury.git
cd mercury
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) → enter your OpenRouter key → submit your first inquiry.

### Production build

```bash
npm run build
npm start
```

Server serves the API and static frontend together on a single port. Set `PORT` env var to override (default: 5000).

---

## 🛫 Deploy to Fly.io

Mercury ships with a `Dockerfile` and `fly.toml`. The full stack — Express backend + React SPA + SQLite — runs in a single container with a persistent volume for the database.

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Authenticate
flyctl auth login

# 3. Create the app
flyctl apps create your-app-name

# 4. Create a persistent volume for SQLite
flyctl volumes create mercury_data --size 1 --region cdg

# 5. Deploy
flyctl deploy
```

Your app is live at `https://your-app-name.fly.dev`.

### Custom domain

```bash
flyctl certs add demo.yourdomain.com --app your-app-name
```

Fly provisions a Let's Encrypt certificate automatically. Point an `A` record and `AAAA` record at the IPs it gives you.

> The live demo at [demo.mercury.sh](https://demo.mercury.sh) is deployed exactly this way — `mercury-sh` on Fly.io (Paris region), with a SiteGround DNS zone pointing `demo.mercury.sh` at Fly's IPs.

### Scale to zero (free tier)

`fly.toml` is configured with `auto_stop_machines = "stop"` and `min_machines_running = 0`. The app costs nothing when idle and wakes on the first request (~2s cold start). For a demo instance this is ideal.

---

## 🎬 See it in action

```
☿ Mercury  —  Expert Inquiry Engine

┌─────────────────────────────────────────────────────────────────┐
│  What is the strongest philosophical argument against free will, │
│  and can it be reconciled with moral responsibility?            │
│                                                                 │
│  ⊹ Deep Research · 4 models · 15 rounds            Inquire ↑   │
└─────────────────────────────────────────────────────────────────┘

  Mercury detected a complex, multi-perspective inquiry.
  Launching your expert team…

╔══════════════════════════════════════════════════════════════╗
║  Round 8 of 15  —  Debate                            53%     ║
║  ████████████████████░░░░░░░░░░░░░░░░                        ║
║                                                              ║
║  ● Research  ● Debate  ○ Vote  ○ Synthesis  ○ Final          ║
║                                     ↑ active                 ║
╚══════════════════════════════════════════════════════════════╝

  Live — Expert debate in progress              8 rounds complete

  Round 8 — Debate
  ┌────────────────────────────────────────────────────────────┐
  │ gpt-4o   The hard determinist position is strongest when   │
  │          you apply it to the neuroscience literature...    │
  ├────────────────────────────────────────────────────────────┤
  │ claude   I'd push back on the neuroscience framing —       │
  │          Libet's experiments have been significantly       │
  │          reinterpreted since 2008...                       │
  ├────────────────────────────────────────────────────────────┤
  │ llama4   Both miss the compatibilist escape route. The     │
  │          question isn't whether determinism is true but    │
  │          whether it's the right level of analysis...       │
  ├────────────────────────────────────────────────────────────┤
  │ mixtral  Synthesising: the strongest argument is hard      │
  │          incompatibilism, but the moral responsibility     │
  │          reconciliation depends on which theory of         │
  │          responsibility you adopt...                       │
  └────────────────────────────────────────────────────────────┘

  [15 rounds later]

  ✓ Inquiry complete  ·  15 rounds  ·  4 experts  ·  78% consensus

  ✦ Consensus Answer
  ┌────────────────────────────────────────────────────────────┐
  │ The strongest philosophical argument against free will is  │
  │ hard incompatibilism, grounded in causal closure of the    │
  │ physical...                                                │
  │                                                            │
  │ [full structured answer with headers, evidence, nuance]    │
  └────────────────────────────────────────────────────────────┘
                                            [Copy]  [Download .md]
```

---

## 🏗️ Architecture — how it works

### The orchestration loop

The core engine (`server/orchestrator.ts`) runs a phase-based loop:

```typescript
for (let i = 0; i < totalIterations; i++) {
  const phase = selectPhase(i, totalIterations);  // research | debate | vote | synthesis | final
  const models = selectModels(i, modelIds);       // all for first 3 rounds, rotating subset later
  const responses = await Promise.allSettled(     // parallel model calls
    models.map(modelId => callModel(apiKey, modelId, history, phase.systemPrompt, temperature))
  );
  const consensus = computeConsensus(responses);
  broadcastToClients(sessionId, { iteration, phase, responses, consensus });

  if (earlyExit(i, consensus, consensusThreshold)) break;  // reached threshold early
}
```

Each phase has a carefully designed system prompt:

- **Research** — "Analyse independently. Be comprehensive."
- **Debate** — "Read what your peers said. Challenge. Push back."
- **Vote** — "Rate agreement 1-10. Vote AGREE / PARTIALLY_AGREE / DISAGREE."
- **Synthesis** — "Extract the strongest points. Resolve contradictions."
- **Final** — "Deliver the definitive answer, backed by the full reasoning trail."

### The complexity detector

Before launching any debate, Mercury classifies the inquiry:

```typescript
// Fast heuristic pass first
const simplePatterns = [/^what is /i, /^who is /i, /^when (was|did|is) /i, ...];
if (query.length < 60 && simplePatterns.some(p => p.test(query))) return "simple";

// LLM classification for ambiguous cases
const result = await callModel(apiKey, "openai/gpt-4o-mini",
  [{ role: "user", content: `Classify as SIMPLE or COMPLEX: "${query}"` }],
  undefined, 0.1
);
return result.includes("SIMPLE") ? "simple" : "complex";
```

Simple queries skip the entire debate engine and return in ~1 second. The user can still escalate to the full debate with one click.

### Real-time WebSocket

Every iteration broadcasts a structured event to connected clients:

```typescript
broadcast(sessionId, {
  type: "iteration_complete",
  iteration: i + 1,
  phase: phase.type,
  phaseLabel: phase.label,
  responses: modelResults,   // full text from each model
  consensus: score,
  summary: `${successful.length}/${total} experts responded.`
});
```

The frontend renders these events as they arrive — you see each model's response stream into the live panel in real time, round by round.

### SQLite as the source of truth

Every session, every debate round, every model response is persisted to SQLite via Drizzle ORM. The database schema is deliberately minimal:

```
sessions      — one row per inquiry, tracks status and final answer
iterations    — one row per round per session, stores all model responses as JSON
workflows     — saved expert team configurations
settings      — key-value store (API key, theme)
```

This means you can close the tab mid-debate, come back, and see the full history. The server holds no in-memory state — everything is in SQLite.

---

## 🪨 The hardest problems

### 1. native module compilation on Alpine Linux

`better-sqlite3` is a C++ native addon. When the Docker image built on the sandbox (Ubuntu, glibc), and then ran on Fly.io's Alpine containers (musl libc), it crashed immediately:

```
Error: Error relocating better_sqlite3.node: fcntl64: symbol not found
```

`fcntl64` is a glibc symbol. musl doesn't export it. The pre-compiled binary was incompatible.

**The fix:** make the Dockerfile compile `better-sqlite3` inside the Alpine container, not outside it:

```dockerfile
RUN apk add --no-cache python3 make g++   # build deps for native modules
RUN npm install                            # install including better-sqlite3 source
RUN npm run build                          # compile the app
RUN npm rebuild better-sqlite3             # recompile native addon for Alpine/musl
RUN npm prune --omit=dev                   # remove dev deps
RUN npm rebuild better-sqlite3             # rebuild again after prune (prune can remove the binary)
```

The double `npm rebuild` is not a mistake — `npm prune` can remove compiled native binaries even when the package itself is a production dependency, because the build artifacts are in `node_modules/.cache`.

### 2. Unicode characters in HTTP headers

Every single OpenRouter API call was failing with:

```
Error: Cannot convert argument to a ByteString because the character at
index 8 has a value of 8212 which is greater than 255.
```

Character 8212 is `—` (em dash, U+2014). It was in the `X-Title` header:

```typescript
"X-Title": "Mercury — Deep Research Engine",  // ← this kills every single API call
```

HTTP headers are Latin-1 (byte values 0–255 only). The em dash is U+2014 = 8212, which exceeds 255. Node's `fetch` enforces this strictly at runtime, not compile time.

**The fix:** replace the em dash with a regular hyphen. One character. Took an hour to find.

```typescript
"X-Title": "Mercury - Deep Research Engine",  // ✓
```

**Lesson:** never put typographic punctuation (em dashes, curly quotes, ellipsis characters) in HTTP headers. They look identical in source code but destroy network calls at runtime.

### 3. Shared vs. dedicated IPs on Fly.io

Fly.io allocates a shared IPv4 by default (`v4 · shared`). When adding a custom domain, Fly recommends AAAA (IPv6) records + the shared IPv4 for fallback. The cert validation expects both.

When we first ran `flyctl certs check demo.mercury.sh`, the cert showed `Status: Not verified` because only the A record was set. Adding the AAAA record immediately triggered verification. Total time from DNS records created to `Certificate is verified and active`: 15 seconds.

### 4. React Query cache and the onboarding guard

The onboarding guard checks `/api/onboarding` and redirects to `/onboarding` if no API key is saved. The query has `staleTime: Infinity` as a global default — which means once the query result is cached (even with `{hasApiKey: false}`), it won't refetch.

After saving the API key via a mutation, the mutation correctly calls `queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] })`. But if you navigate *before* the invalidation completes, the old cached result is still there, and the guard re-redirects to onboarding.

**The fix:** set `staleTime: 0` and `refetchOnMount: true` specifically on the onboarding query, so it always fetches fresh on every mount.

### 5. WebSocket paths behind a proxy

The original WebSocket URL was:
```typescript
const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${id}`;
```

This uses an absolute path from the origin root — which works when the app is served at `/`, but breaks when deployed behind a proxy that serves the app at a subpath (like Perplexity Computer's preview proxy, which serves at `/port/5000/`).

**The fix:** construct the WebSocket URL relative to the current page:
```typescript
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

`new URL("./ws", location.href)` resolves the relative path correctly regardless of where in the URL hierarchy the app is served.

---

## 🎓 Lessons learned

### On multi-model consensus

**The debate genuinely improves answers.** When we tested Mercury on the same questions against a direct single-model call, the debate consistently produced more nuanced, better-qualified responses. The models don't just average their outputs — they genuinely push each other. Claude will challenge a GPT-4o framing. Llama will surface an angle neither found. The synthesis step distils the strongest points into something neither model would have produced alone.

**But temperature matters enormously.** At temperature 0.7+ across all models, the debate becomes generative but also more contradictory — models explore wildly different framings and the synthesis struggles to reconcile them. At 0.3 or below, models converge faster but the debate produces less original insight. The sweet spot for most research inquiries is 0.5–0.7.

**Model selection is a genuine skill.** A homogeneous panel (three GPT-4o instances) produces a worse debate than a heterogeneous one (GPT-4o + Claude + Llama + Mixtral). The diversity of training data and RLHF approaches means genuinely different perspectives. Mixing model families produces a better debate — more pushback, more disagreement, more interesting synthesis.

### On the architecture

**Single-process is the right call for a self-hosted tool.** Mercury runs as one Node.js process — Express backend + Vite dev server (in dev) or static file serving (in prod). There's no Redis, no queue, no worker pool. For a tool designed to run on a single machine with a handful of concurrent users, this is the right level of complexity. Background orchestration runs via `setImmediate` + async. It works.

**SQLite is genuinely underrated for this use case.** Every session, every iteration, every model response is persisted. The database is a single file. Backup is `cp mercury.db mercury.db.bak`. Deployment to Fly.io is `flyctl volumes create`. Zero operational overhead. For a single-user self-hosted app, a PostgreSQL cluster would be pure overhead.

**Drizzle ORM is the right abstraction level.** We used Drizzle because it's thin — it generates SQL you can actually read, has a type-safe query builder, and doesn't try to hide the database from you. The schema lives in one file (`shared/schema.ts`), migrations are explicit, and the `better-sqlite3` synchronous driver means no async/await ceremony on every DB call.

### On the UX

**Complexity detection changes the product feel entirely.** Without it, every inquiry triggers the 5-step wizard — which is appropriate for a nuanced policy question but bizarre for "what is a REST API?". Routing simple questions to an instant answer makes the product feel responsive and smart rather than bureaucratic.

**The wizard needs to skip itself when there's nothing to choose from.** The original design always showed step 1 (saved workflows). When there are no saved workflows, showing a screen that says "you have no saved workflows" and making the user click "build new" is friction for no reason. The wizard now jumps to step 2 immediately when no workflows exist.

**Live progress is the product.** Watching 4 models argue about your question in real time is the experience that makes Mercury memorable. The final answer is useful — but the live debate panel showing GPT-4o and Claude push back on each other is the moment that makes people understand why this is different from just asking a single model.

---

## 🤖 Building with Perplexity Computer

Mercury was designed and built entirely in collaboration with [Perplexity Computer](https://www.perplexity.ai). The full development history — from initial concept to v3.0.0 — happened in a single persistent session context.

What that meant in practice:

- **Architecture decisions were collaborative.** The phase system, the complexity detector, the WebSocket broadcasting pattern — these were worked out in conversation, not handed down from a design doc.
- **Every bug was fixed in context.** When the `fcntl64` crash appeared in Fly.io logs at 4am, the fix (Alpine-native `npm rebuild`) was identified in the same conversation that was deploying.
- **The codebase is human-readable by design.** Because the code was written to be reviewed in conversation, every module has clear section comments, consistent naming, and no clever tricks that would make sense to an AI assistant but not a human reading it six months later.

This is what it looks like to use AI for serious software development — not autocomplete, but a full engineering partner that holds the context of 10,000 lines across multiple files, reasons about tradeoffs, and catches the bugs you'd spend 3 hours finding alone.

---

## 📁 Project structure

```
mercury/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── chat.tsx          Main inquiry input + smart routing + 5-step wizard
│       │   ├── session.tsx       Live progress panel + debate history + results view
│       │   ├── workflows.tsx     Workflow CRUD — create, edit, delete, set default
│       │   ├── settings.tsx      API key management, theme, danger zone
│       │   └── onboarding.tsx    First-run API key setup
│       ├── components/
│       │   └── Layout.tsx        Sidebar, navigation, recent sessions, theme toggle
│       ├── lib/
│       │   └── queryClient.ts    TanStack Query client + relative API path helper
│       └── App.tsx               ThemeProvider, onboarding guard, hash-based routing
├── server/
│   ├── orchestrator.ts           Multi-model debate engine, complexity detector, quick answer
│   ├── routes.ts                 All Express routes + WebSocket server
│   ├── storage.ts                SQLite persistence layer via Drizzle ORM
│   └── index.ts                  Express + HTTP server bootstrap
├── shared/
│   └── schema.ts                 Drizzle schema: sessions, iterations, workflows, settings
├── fly.toml                      Fly.io app config (region, machine size, volume mount)
├── Dockerfile                    Alpine-based container with native module rebuild steps
├── README.md                     You're reading it
├── CHANGELOG.md                  Full version history
├── INSTALL.md                    Deploy guide: local, Docker, Fly.io, custom domain
└── LICENSE                       MIT
```

---

## 📡 API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/onboarding` | `{ hasApiKey: boolean }` — used by the onboarding guard |
| `GET` | `/api/settings` | Current API key status and theme |
| `POST` | `/api/settings` | Save or clear OpenRouter API key |
| `GET` | `/api/settings/theme` | Current theme (`light` \| `dark`) |
| `POST` | `/api/settings/theme` | Persist theme preference |
| `GET` | `/api/models` | Fetch all models available on OpenRouter |
| `POST` | `/api/detect-complexity` | Classify inquiry as `simple` or `complex` |
| `POST` | `/api/quick-answer` | Single-model fast response (no debate) |
| `POST` | `/api/inquire` | Launch full multi-model debate session |
| `GET` | `/api/sessions` | List all sessions (newest first) |
| `GET` | `/api/sessions/:id` | Get session with status and final answer |
| `DELETE` | `/api/sessions/:id` | Delete a single session |
| `DELETE` | `/api/sessions` | Delete all sessions |
| `GET` | `/api/sessions/:id/iterations` | Full debate history — all rounds, all responses |
| `GET` | `/api/workflows` | List saved workflows |
| `POST` | `/api/workflows` | Create a workflow |
| `PUT` | `/api/workflows/:id` | Update a workflow |
| `DELETE` | `/api/workflows/:id` | Delete a workflow |
| `WS` | `/ws?sessionId=:id` | Real-time debate stream |

**WebSocket event types:**

| Event | Payload |
|---|---|
| `iteration_start` | `{ iteration, phase, phaseLabel, totalIterations }` |
| `iteration_complete` | `{ iteration, phase, phaseLabel, responses[], summary, consensus }` |
| `quick_start` | `{ model }` |
| `quick_complete` | `{ answer }` |
| `completed` | `{ finalAnswer }` |
| `error` | `{ message }` |

---

## ⚙️ Configuration

All settings are stored server-side in SQLite and persist across restarts.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | — | Set to `production` for static file serving |
| `DB_PATH` | `mercury.db` | SQLite database path (override for Docker volumes) |

---

## 🧪 Model recommendations

Mercury works with any model available on OpenRouter. Based on testing, these combinations produce the best debates:

| Use case | Team composition |
|---|---|
| **Best all-round** | `gpt-4o` + `claude-3.5-sonnet` + `llama-4-maverick` + `mixtral-large` |
| **Budget** | `gpt-4o-mini` + `claude-haiku` + `llama-3.2-3b` |
| **Deep research** | `o3-mini` + `claude-3.7-sonnet` + `gemini-2.0-flash` + `deepseek-r1` |
| **Creative / speculative** | `gpt-4o` + `claude-3.5-sonnet` + `mistral-large` — temperature 0.8 |

**Key insight:** diversity beats quality. Three different mid-tier models from different providers produce a better debate than three instances of the same frontier model. Different training approaches mean genuinely different perspectives.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

Current version: **3.0.0** — inquiry wizard, smart complexity detection, live progress panel, Fly.io deployment, full-sentence notifications.

---

## 🤝 Contributing

The repository is currently private. Contributions will be welcomed when it goes public. If you find a bug or have a feature idea in the meantime, open an issue.

---

## 👤 Author

**Paul Fleury** — French internet entrepreneur, based in Lisbon.

- Website: [paulfleury.com](https://paulfleury.com)
- GitHub: [@paulfxyz](https://github.com/paulfxyz)
- Project: [Openline](https://openline.ai) — instant eSIMs in 190+ countries

Other open source projects:
- [mang.sh](https://mang.sh) — natural language to shell commands, built in Rust
- [ASE](https://ase.so) — domain, uptime, DNS and SSL monitor

---

*Mercury is MIT licensed. See [LICENSE](LICENSE).*
