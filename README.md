# ☿ Mercury

<div align="center">

**Not a chatbot. A thinking process.**

*Every inquiry gets an immediate answer. Then an expert panel of AI models debates, challenges, and votes until they agree.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.1.1-brightgreen?style=for-the-badge)](CHANGELOG.md)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Powered by OpenRouter](https://img.shields.io/badge/Powered%20by-OpenRouter-6c47ff?style=for-the-badge)](https://openrouter.ai)
[![Deploy on Fly.io](https://img.shields.io/badge/Deploy%20on-Fly.io-7c3aed?style=for-the-badge&logo=flydotio&logoColor=white)](https://fly.io)
[![Self-hosted](https://img.shields.io/badge/Self--hosted-your%20server-111?style=for-the-badge)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](https://github.com/paulfxyz/mercury/pulls)

**[demo.mercury.sh](https://demo.mercury.sh)** · **[mercury.sh](https://mercury.sh)**

</div>

---

```
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║   ☿   MERCURY   ·   Expert Inquiry Engine                ║
  ║                                                          ║
  ║   One model gives you an answer.                         ║
  ║   Many models give you the truth.                        ║
  ║                                                          ║
  ║   Submit → Initial answer → Debate → Consensus           ║
  ║                                                          ║
  ║   v3.1.1  ·  mercury.sh  ·  github.com/paulfxyz          ║
  ╚══════════════════════════════════════════════════════════╝
```

---

> This README is a complete technical reference — not just *how* to run Mercury, but *why* every decision was made, the exact bugs that surfaced in production, and the lessons learned building a multi-model consensus engine from scratch. If you're building something similar, read on.

---

## Table of Contents

1. [Why this exists](#-why-this-exists)
2. [The exact flow](#-the-exact-flow)
3. [Feature overview](#-feature-overview)
4. [Quick start](#-quick-start)
5. [Deploy to Fly.io](#-deploy-to-flyio)
6. [Architecture deep dive](#-architecture--how-it-works)
7. [The hardest bugs](#-the-hardest-bugs)
8. [Lessons learned](#-lessons-learned)
9. [Building with Perplexity Computer](#-building-with-perplexity-computer)
10. [Project structure](#-project-structure)
11. [API reference](#-api-reference)
12. [Model recommendations](#-model-recommendations)
13. [Changelog](#-changelog)
14. [Author](#-author)

---

## 👨‍💻 Why this exists

I'm **Paul Fleury** — French internet entrepreneur based in Lisbon. I run [Openline](https://openline.ai) and build across a wide surface: infrastructure, automation, AI tooling, SaaS.

I kept hitting the same wall with AI assistants. Not that they were wrong — but that I had no reliable way to *know* when they were wrong.

Ask GPT-4o a nuanced strategic question. Get a confident, well-written answer. Ask Claude. Get a different confident, well-written answer. Ask Llama. Another one. Not one of them volunteers that the others disagreed with them. The model has no incentive to surface its own uncertainty. It fills every gap with confidence.

**The single-model trap**: one perspective, dressed up as an answer.

Science solved this centuries ago: peer review. You don't publish by asking one expert — you submit to a panel. They challenge the methodology, identify weaknesses, argue. The consensus that emerges from that conflict is worth more than any single opinion.

Mercury applies this to AI. Your inquiry goes through a configurable panel of models. They research independently, challenge each other's findings, vote, and synthesise toward a final answer — only once sufficient consensus is reached.

The result is not just an answer. It's a **debugged answer**.

> 💡 Designed and built entirely in collaboration with **[Perplexity Computer](https://www.perplexity.ai)** — architecture through implementation, production bugs, deployment, and documentation. Human intent + AI execution, end to end.

---

## 🔬 The exact flow

This is what actually happens when you submit an inquiry in Mercury v3:

### Step 1 — Immediate initial answer

The moment you hit submit, Mercury calls `gpt-4o-mini` and returns an answer in ~1–2 seconds. This isn't a placeholder — it's a real, complete response. The UI shows:

```
⚡ Initial answer — Want to make sure? Run the expert debate below.

[The answer text here, fully rendered]

  Accept this answer ↓
```

The answer is real and usable — not a placeholder. Below it, the **debate starter** appears automatically.

### Step 2 — Choose how to run the debate

Instead of jumping straight into a configuration wizard, Mercury presents three clear options:

| Option | What it does |
|---|---|
| ⚡ **Quick debate** | Launches instantly with GPT-4o + Claude 3.5 Sonnet + Gemini 2.0 Flash · 3 rounds · temperature 0.3. One click, no setup. |
| ★ **Saved workflow** | Any workflow you've created appears here as a one-click option. Reuse a previous configuration without re-entering anything. |
| ⚙ **Custom setup** | Opens a 4-step side panel — choose team size, pick models, set rounds, tune temperature and consensus. Save it as a workflow when you're done. |

The common path — Quick debate — requires zero configuration and launches the debate in one click. The full wizard is always accessible but never mandatory.

### Step 2b — Custom setup wizard (optional)

If you choose "Custom setup", a panel slides in from the right:

| Step | What happens |
|---|---|
| **Size** | Choose 2–12 models for the expert panel |
| **Models** | Search OpenRouter's 100+ catalog. Each model gets an optional custom system prompt — assign roles like "You are a devil's advocate" or "Focus only on economic evidence" |
| **Rounds** | 5–30 debate rounds. 15 is the default sweet spot |
| **Config** | Temperature (0 = precise, 1 = creative), required consensus % (50–100%), optional: save this configuration as a named **workflow** for future reuse |

### Step 3 — The debate

Models run in parallel across 5 phases. Each phase has a purpose-built system prompt:

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Research │ → │  Debate  │ → │   Vote   │ → │Synthesis │ → │  Final   │
│          │   │          │   │          │   │          │   │          │
│ Analyse  │   │ Challenge│   │ AGREE /  │   │ Extract  │   │Definitive│
│ the      │   │ each     │   │ PARTIAL /│   │ strongest│   │ consensus│
│ inquiry  │   │ other    │   │ DISAGREE │   │ points   │   │ answer   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

The live progress panel is open by default. You watch each model's response stream in round by round — who agreed, who pushed back, what they said.

If the required consensus threshold is hit before all rounds complete, the debate exits early and proceeds to synthesis.

### Step 4 — Consensus answer

The final answer carries:
- A **consensus % score** based on model agreement across voting rounds
- **Model badges** listing every expert that participated
- The full **debate history** — every round, every model's response, expandable
- **Copy** and **Download as Markdown** buttons

---

## 🌟 Feature overview

| Feature | Detail |
|---|---|
| ⚡ Immediate initial answer | Every inquiry gets a fast single-model response before any debate — never a blank screen |
| 🚀 One-click Quick debate | Launch with the top 3 models (GPT-4o, Claude 3.5, Gemini 2.0) · 3 rounds · temp 0.3 — no setup required |
| 🧙 Expert team wizard | 4-step side panel: team size → model selection → rounds → temperature + consensus config |
| 🎭 Custom model roles | Each model in the team gets an optional system prompt — assign devil's advocate, domain specialist, fact-checker |
| 💾 Saved workflows | Name and save team configurations; one click to reuse in future inquiries |
| 📡 Real-time live panel | WebSocket streams every model response as it arrives, grouped by round and phase |
| 📊 Phase timeline | Pulses at the active phase: Research → Debate → Vote → Synthesis → Final |
| 🎯 Consensus score | Final answer carries % agreement based on voting across all rounds |
| 🚪 Early exit | Debate ends early when consensus threshold is reached — no wasted rounds |
| 🌡️ Temperature control | Per-workflow: 0 = precise, 1 = creative |
| 📐 Consensus threshold | Required agreement % before Mercury considers the debate settled |
| 🔒 Self-hosted | Your API key, your server, your data. Nothing leaves your infrastructure |
| ☀️🌙 Light + dark mode | Persistent, server-stored theme preference |
| 📄 Export | Copy or download final consensus answer as Markdown |
| 🗂️ Full history | Every session, debate round, and model response in SQLite — forever |

---

## 🚀 Quick start

```bash
git clone https://github.com/paulfxyz/mercury.git
cd mercury
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) → enter your [OpenRouter API key](https://openrouter.ai/keys) → submit your first inquiry.

```bash
# Production build
npm run build
npm start
```

---

## 🛫 Deploy to Fly.io

Mercury ships with a `Dockerfile` and `fly.toml`. The full stack — Express + React SPA + SQLite — runs in a single Alpine container with a persistent volume for the database.

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login

flyctl apps create your-app-name
flyctl volumes create mercury_data --size 1 --region cdg

flyctl deploy
```

Live at `https://your-app-name.fly.dev`. The live Mercury demo is deployed exactly this way — `mercury-sh` app, Paris (`cdg`) region, with `demo.mercury.sh` pointing at it via A/AAAA records on SiteGround DNS.

### Scale to zero

`fly.toml` uses `auto_stop_machines = "stop"` and `min_machines_running = 0`. Zero cost when idle, ~2s cold start on first request.

### Custom domain

```bash
flyctl certs add demo.yourdomain.com --app your-app-name
```

Fly provisions a Let's Encrypt cert automatically. Point A + AAAA records at the IPs it gives you. Cert verified in under 30 seconds.

---

## 🏗️ Architecture — how it works

### The orchestration loop

```typescript
// server/orchestrator.ts — simplified
for (let i = 0; i < totalIterations; i++) {
  const phase = selectPhase(i, totalIterations);  // research|debate|vote|synthesis|final

  const responses = await Promise.allSettled(
    models.map(modelId => callModel(apiKey, modelId, history, phase.systemPrompt, temperature))
  );

  const consensus = successfulResponses.length / total;

  broadcast(sessionId, { type: "iteration_complete", iteration: i+1, phase, responses, consensus });

  // Early exit when threshold met
  if (i >= 5 && consensus >= consensusThreshold && phaseIndex >= 2) break;
}

storage.updateSession(sessionId, { status: "completed", finalAnswer });
broadcast(sessionId, { type: "completed", finalAnswer });
```

### The initial answer path

Before any debate, Mercury runs the inquiry through a single cheap model:

```typescript
// POST /api/quick-answer
const answer = await callModel(apiKey, "openai/gpt-4o-mini", [{ role: "user", content: query }],
  "You are a helpful, concise assistant. Answer the question directly and clearly.", 0.3);

storage.updateSession(sessionId, { status: "completed", quickAnswer: answer, finalAnswer: answer });
broadcast(sessionId, { type: "quick_complete", answer });
```

The frontend polls for `session.quickAnswer` every 1.2 seconds and renders it the moment it arrives. No complexity classifier, no branching — every inquiry always goes through this path first. Simple, predictable, fast.

### Real-time WebSocket

```typescript
// Every iteration broadcasts to all connected clients for that session
broadcast(sessionId, {
  type: "iteration_complete",
  iteration: i + 1,
  phase: phase.type,       // "research" | "debate" | "vote" | "synthesis" | "final"
  phaseLabel: phase.label, // human-readable
  responses: modelResults, // full text from each model, including errors
  consensus: score,
  summary: `${n}/${total} experts responded.`
});
```

The frontend connects via `new URL("./ws", location.href)` — relative URL construction that works correctly both locally and behind any proxy subpath.

### SQLite as the truth

The schema is intentionally minimal:

```
sessions    — one row per inquiry: status, query, final answer, workflow reference
iterations  — one row per debate round: all model responses stored as JSON
workflows   — saved expert team configurations: steps, iterations, temperature, consensus threshold
settings    — key-value: API key (server-side only), theme
```

`better-sqlite3` is synchronous — no async/await on database calls, no connection pools, no ORM ceremony. Drizzle provides type-safe queries. The database is a single file. Backup is `cp mercury.db mercury.db.bak`.

---

## 🪨 The hardest bugs

### 1. Alpine Linux kills `better-sqlite3`

The first Fly.io deploy failed immediately:

```
Error relocating better_sqlite3.node: fcntl64: symbol not found
```

`better-sqlite3` is a native C++ addon. The sandbox where we built it runs Ubuntu (glibc). Fly.io's containers run Alpine Linux (musl libc). `fcntl64` is a glibc symbol that musl doesn't export. The pre-built binary was simply incompatible.

The fix is to compile the native addon *inside* the Alpine container:

```dockerfile
RUN apk add --no-cache python3 make g++  # build tools for native modules
RUN npm install                           # installs better-sqlite3 source
RUN npm run build                         # compile the app
RUN npm rebuild better-sqlite3            # compile native addon for musl/Alpine
RUN npm prune --omit=dev                  # remove dev dependencies
RUN npm rebuild better-sqlite3            # rebuild AGAIN — prune removes compiled binaries
```

The double `npm rebuild` is intentional. `npm prune` removes compiled native binaries even when the package is a production dependency, because the binaries live in `.cache`. Without the second rebuild, the app starts, finds no binary, crashes.

### 2. An em dash breaks every API call

Every single OpenRouter call was failing with a cryptic error:

```
Cannot convert argument to a ByteString because the character at index 8
has a value of 8212 which is greater than 255.
```

Character 8212 is `—` (U+2014, em dash). It was in the `X-Title` HTTP header:

```typescript
"X-Title": "Mercury — Deep Research Engine",  // ← kills every request
```

HTTP headers are Latin-1 (0–255). The em dash is 8212. Node's `fetch` enforces this at the byte level. The error message tells you exactly what happened — but only if you know that 8212 = em dash.

```typescript
"X-Title": "Mercury - Deep Research Engine",  // ✓
```

One character. Took an hour to find. The lesson: never put typographic punctuation in HTTP headers. They're invisible in source code but lethal at runtime.

### 3. React Query `staleTime` blocks the onboarding guard

The onboarding guard checks `/api/onboarding` and redirects to the API key screen if no key is configured. The global QueryClient default was `staleTime: Infinity`.

After saving the API key, the mutation invalidates the query. But if navigation happens before the invalidation promise resolves, the component remounts with the stale `{ hasApiKey: false }` in cache — and the guard redirects back to onboarding.

Fix: set `staleTime: 0, refetchOnMount: true` specifically on the onboarding query, overriding the global default.

### 4. WebSocket URL breaks under proxy subpaths

Original:
```typescript
const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${id}`;
```

This constructs an absolute URL from the origin root. When the app is deployed behind a proxy that serves it at a subpath (Perplexity Computer's preview proxy serves at `/port/5000/`), the WebSocket connects to the wrong path.

```typescript
// Correct: relative URL resolves the current path automatically
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

`new URL("./ws", location.href)` resolves correctly regardless of where in the URL hierarchy the app lives.

### 5. Radix Dialog kills model selection — ditch the Dialog entirely

The model search dropdown needed to float above the dialog. We used `createPortal()` to render it on `document.body` at `position: fixed`, and tried `onPointerDown` with `stopPropagation` to outrun Radix's overlay.

It didn't work. Radix Dialog's overlay fires `onPointerDownOutside` regardless — it captures pointer events at the document level before any child handler can prevent them. Every model selection attempt closed the dialog instead.

The fix was to stop fighting the abstraction and remove the `<Dialog>` entirely:

```typescript
// Before: Radix Dialog with portalled dropdown — model selection broken
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent> <StepBuilder /> </DialogContent>
</Dialog>

// After: sibling split-panel — chat left, wizard slides in from right, zero overlay
<div className="flex h-full overflow-hidden">
  <div className="flex-1"> {/* chat */} </div>
  <div className={cn("w-[480px] border-l", !open && "w-0")}> {/* wizard */} </div>
</div>
```

No overlay, no pointer capture, no z-index battles. `onMouseDown` on dropdown items works perfectly because there is nothing above them to intercept.

---

## 🎓 Lessons learned

### Always show something immediately

The original flow used a complexity classifier before doing anything — an extra API call that classified the inquiry as "simple" or "complex" before routing to either a quick answer or the wizard. This meant users stared at a spinner while the classifier ran, then got different experiences depending on a classifier that wasn't always right.

The current flow is simpler and better: every inquiry always gets an immediate answer first. The user sees their inquiry is understood. The answer is real and useful. Then they choose to go deeper. The expert debate becomes the natural next step, not a hidden fast path.

**Always give the user something. Never make them wait for nothing.**

### Heterogeneous panels beat homogeneous ones

A panel of three GPT-4o instances produces a worse debate than GPT-4o + Claude + Llama + Mixtral. Different training data, different RLHF approaches, different knowledge cutoffs — genuine diversity produces genuine disagreement, and genuine disagreement produces genuine insight.

The synthesis phase explicitly benefits from this: when Claude has pushed back on GPT-4o's framing, the synthesiser has real conflict to resolve, not just three versions of the same opinion.

### Temperature matters for debate quality

At temperature 0.7+, models explore wildly different framings and the synthesis struggles to reconcile them. At 0.3 or below, models converge fast but the debate loses its depth. For most research inquiries, 0.5–0.7 is the right range. For creative or speculative questions, push toward 0.8. For technical or factual questions, 0.3–0.5.

### Reduce steps to the first decision point

The wizard used to be the first thing shown after the quick answer. But for most users the first real question is not "which models?" — it's "do I even need a full debate?" The debate starter answers that question first, with three options at a glance. The wizard only opens if the user explicitly wants more control. Ten lines of code, meaningfully better experience.

### Custom model roles change everything

Giving each model a specific role — "you are a devil's advocate", "you focus only on empirical evidence", "you synthesise and find common ground" — produces a structured debate rather than each model just repeating variations of the same analysis. The custom system prompt per model is one of the most powerful features and one of the least obvious to new users. It deserves to be prominent.

### SQLite is the right database for self-hosted tools

The choice of SQLite over PostgreSQL or MySQL was a deliberate one. For a tool designed to run on a single machine with one or a few concurrent users, a database server is pure operational overhead. SQLite is a file. It deploys with the app. It backs up with `cp`. It works offline. It never needs a connection string, a username, or a port. For this use case, it is strictly better than a client-server database in every dimension that matters.

---

## 🤖 Building with Perplexity Computer

Mercury was designed and built entirely in collaboration with [Perplexity Computer](https://www.perplexity.ai). Every version — from the initial React + Express scaffold to the Fly.io deployment with custom domain — happened in a single persistent session context.

What that looks like in practice:

**Architecture decisions were collaborative.** The 5-phase debate system, the initial-answer-first UX, the wizard flow, the portal-based dropdown — these were worked out in conversation, not handed down from a spec. When a design idea didn't work, the conversation course-corrected immediately.

**Every production bug was fixed in context.** The `fcntl64` crash appeared in Fly.io logs. The em dash header error appeared in the browser console. The WebSocket proxy bug appeared in a deploy preview. Each was diagnosed and fixed without leaving the conversation. No GitHub issues, no Slack threads, no context switching.

**The deployment chain was automated.** Fly.io app creation, volume provisioning, SSL cert issuance, DNS record management (SiteGround), FTP landing page uploads — all handled in the same session, incrementally, with verification at each step.

**The codebase is intentionally readable.** Because all code was written to be reviewed in conversation, every module has clear section comments, consistent naming, and no clever abstractions that would be hard to explain. The code reads like it was written for a human to maintain — because it was, even if an AI wrote it.

This is what it looks like to use AI as a serious engineering partner. Not autocomplete. A collaborator that holds full context across 10,000+ lines, reasons about tradeoffs in real time, and catches bugs you'd spend hours finding alone.

---

## 📁 Project structure

```
mercury/
├── client/src/
│   ├── pages/
│   │   ├── chat.tsx          Inquiry input, immediate answer, wizard launch
│   │   ├── session.tsx       Live progress panel, debate history, results
│   │   ├── workflows.tsx     Workflow CRUD with portal search dropdown
│   │   ├── settings.tsx      API key, theme, danger zone
│   │   └── onboarding.tsx    First-run API key setup
│   ├── components/
│   │   └── Layout.tsx        Sidebar, navigation, theme toggle
│   ├── lib/
│   │   └── queryClient.ts    Relative URL helper + TanStack Query client
│   └── App.tsx               ThemeProvider + onboarding guard + routing
├── server/
│   ├── orchestrator.ts       Debate engine, quick answer, phase system
│   ├── routes.ts             All Express routes + WebSocket server
│   ├── storage.ts            SQLite via Drizzle ORM
│   └── index.ts              Express + HTTP server bootstrap
├── shared/
│   └── schema.ts             Sessions, iterations, workflows, settings
├── fly.toml                  Fly.io config (CDG region, auto-stop, volume)
├── Dockerfile                Alpine + native module rebuild pattern
├── CHANGELOG.md              Full version history
└── INSTALL.md                Local, Docker, Fly.io deployment guide
```

---

## 📡 API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/onboarding` | `{ hasApiKey: boolean }` |
| `GET/POST` | `/api/settings` | API key status / save or clear key |
| `GET/POST` | `/api/settings/theme` | Theme persistence |
| `GET` | `/api/models` | All models available on OpenRouter |
| `POST` | `/api/quick-answer` | Immediate single-model response |
| `POST` | `/api/inquire` | Launch full multi-model debate |
| `GET` | `/api/sessions` | List all sessions (newest first) |
| `GET` | `/api/sessions/:id` | Session with status and final answer |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `DELETE` | `/api/sessions` | Delete all sessions |
| `GET` | `/api/sessions/:id/iterations` | Full debate history |
| `GET/POST/PUT/DELETE` | `/api/workflows` | Workflow CRUD |
| `WS` | `/ws?sessionId=:id` | Real-time debate stream |

**WebSocket event types:**

| Event | Payload fields |
|---|---|
| `iteration_start` | `iteration`, `phase`, `phaseLabel`, `totalIterations` |
| `iteration_complete` | `iteration`, `phase`, `phaseLabel`, `responses[]`, `summary`, `consensus` |
| `quick_start` | `model` |
| `quick_complete` | `answer` |
| `completed` | `finalAnswer` |
| `error` | `message` |

---

## 🧪 Model recommendations

| Use case | Team |
|---|---|
| **Balanced all-round** | `openai/gpt-4o` + `anthropic/claude-3.5-sonnet` + `meta-llama/llama-4-maverick` + `mistralai/mixtral-large` |
| **Budget** | `openai/gpt-4o-mini` + `anthropic/claude-haiku-4.5` + `meta-llama/llama-3.2-3b` |
| **Deep research** | `openai/o3-mini` + `anthropic/claude-3.7-sonnet` + `google/gemini-2.0-flash` + `deepseek/deepseek-r1` |
| **Structured debate** | Mix of above + assign explicit roles per model (researcher, critic, synthesiser, fact-checker) |

Key insight: **diversity beats raw capability**. Three different mid-tier models from different providers outperform three instances of the same frontier model. Different training histories mean genuinely different perspectives.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

Current: **v3.1.1** — debate starter (Quick debate / saved workflow / custom setup), split-panel wizard, model selection fixed, version-stamped releases.

---

## 👤 Author

**Paul Fleury** — French internet entrepreneur, based in Lisbon.

- [paulfleury.com](https://paulfleury.com)
- GitHub: [@paulfxyz](https://github.com/paulfxyz)
- [Openline](https://openline.ai) — instant eSIMs in 190+ countries

Other projects: [mang.sh](https://mang.sh) · [ase.so](https://ase.so)

---

*MIT licensed. See [LICENSE](LICENSE).*
