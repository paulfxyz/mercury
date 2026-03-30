# ☿ Mercury

<div align="center">

**Not a chatbot. A thinking process.**

*Every inquiry gets an immediate answer. Then an expert panel of AI models debates, challenges, and votes until they agree.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.7.4-brightgreen?style=for-the-badge)](CHANGELOG.md)
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
  ║   Submit → Answer → Debate → Consensus → Follow up       ║
  ║                                                          ║
  ║   v3.7.4  ·  mercury.sh  ·  github.com/paulfxyz          ║
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

I'm **Paul Fleury** — French internet entrepreneur based in Lisbon. I run [Openline](https://openline.com) and build across a wide surface: infrastructure, automation, AI tooling, SaaS.

I kept hitting the same wall with AI assistants. Not that they were wrong — but that I had no reliable way to *know* when they were wrong.

Ask GPT-4o a nuanced strategic question. Get a confident, well-written answer. Ask Claude. Get a different confident, well-written answer. Ask Llama. Another one. Not one of them volunteers that the others disagreed. The model has no incentive to surface its own uncertainty. It fills every gap with confidence.

**The single-model trap**: one perspective, dressed up as an answer.

Science solved this centuries ago: peer review. You don't publish by asking one expert — you submit to a panel. They challenge the methodology, identify weaknesses, argue. The consensus that emerges from that conflict is worth more than any single opinion.

Mercury applies this to AI. Your inquiry goes through a configurable panel of models. They research independently, challenge each other's findings, vote, and synthesise toward a final answer — only once sufficient consensus is reached.

The result is not just an answer. It's a **debugged answer**.

> 💡 Designed and built entirely in collaboration with **[Perplexity Computer](https://www.perplexity.ai/computer)** — architecture through implementation, production bugs, deployment, and documentation. Human intent + AI execution, end to end.

---

## 🔬 The exact flow

This is what actually happens when you submit an inquiry in Mercury v3.6:

### Step 1 — Immediate initial answer

The moment you hit submit, Mercury calls `gpt-4o-mini` and returns an answer in ~1–2 seconds. This is a real, complete response — not a placeholder. The UI shows:

```
⚡ Initial answer — Want to make sure? Run the expert debate below.

[The answer text, fully rendered]

  👍 Accept this answer
```

If the quick answer is sufficient, you accept it and the conversation is done. Below the answer, the **debate starter** appears automatically.

### Step 2 — Choose how to run the debate

Three options, no forced wizard:

| Option | What it does |
|---|---|
| ⚡ **Quick debate** | GPT-4o + Claude 3.5 Sonnet + Gemini 2.0 Flash · 3 rounds · temp 0.3. One click, zero config. |
| ★ **Saved workflow** | Any workflow you've saved appears as a one-click card. Reuse a previous configuration instantly. |
| ⚙ **Custom setup** | Slides open a 4-step panel — team size, model selection with custom roles, rounds, temperature + consensus config. Optional: save as a new workflow. |

### Step 3 — The debate

Models run in parallel across 5 phases:

```
Research → Debate → Vote → Synthesis → Final
```

Each phase has a purpose-built system prompt. The live panel is open by default — every model's response streams in round by round. Consensus is tracked after each round. When the required threshold is reached early, the debate exits and proceeds to synthesis immediately.

### Step 4 — Results

- **Consensus % score** — agreement across all voting rounds
- **Model breakdown** — who agreed, who pushed back, who was partial
- **Full debate history** — every round, every model, expandable
- **Copy / Download as Markdown**

### Step 5 — Follow up

After any completed inquiry — quick answer or full debate — a follow-up bar appears. Type a new question, hit send, and it fires as a new inquiry with the previous context visible. The thread continues naturally, no navigation required.

---

## 🌟 Feature overview

| Feature | Detail |
|---|---|
| ⚡ Immediate initial answer | Every inquiry gets a fast single-model response in ~1–2s — never a blank screen |
| 🚀 One-click Quick debate | GPT-4o + Claude 3.5 + Gemini 2.0 · 3 rounds · temp 0.3 — no config required |
| 🧙 Custom setup wizard | 4-step side panel: team size → models + roles → rounds → temperature + consensus |
| 🎭 Custom model roles | Each model gets an optional system prompt — devil's advocate, domain expert, fact-checker |
| 💾 Saved workflows | Named team configurations; one click to reuse across inquiries |
| 🔁 Follow-up inquiry | After any answer, continue the thread immediately with a new question |
| 📡 Real-time live panel | WebSocket streams every model response grouped by round and phase |
| 📊 Phase timeline | Animated progress: Research → Debate → Vote → Synthesis → Final |
| 🎯 Consensus score | Final answer carries % agreement from voting across all rounds |
| 🚪 Early exit | Debate ends when consensus threshold is reached — no wasted rounds |
| 🔑 Multi-key management | Add multiple OpenRouter keys with labels, star a primary, switch anytime |
| 🕐 Session-only key | Use a key that never touches disk — memory only, cleared on tab close |
| 🌡️ Temperature control | Per-workflow: 0 = precise, 1 = creative |
| 📐 Consensus threshold | Required agreement % before Mercury considers the debate settled |
| 📱 Mobile responsive | Collapsible sidebar drawer, full mobile layout across all pages |
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

See [INSTALL.md](INSTALL.md) for full local, Docker, and Fly.io deployment guides.

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

Live at `https://your-app-name.fly.dev`. The live Mercury demo runs exactly this way — `mercury-sh` app, Paris (`cdg`) region, with `demo.mercury.sh` pointing at it via DNS on SiteGround.

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

Every inquiry starts here, before the debate is even considered:

```typescript
// POST /api/quick-answer
const answer = await callModel(apiKey, "openai/gpt-4o-mini",
  [{ role: "user", content: query }],
  "You are a helpful, concise assistant. Answer directly and clearly.",
  0.3
);

storage.updateSession(sessionId, { status: "completed", quickAnswer: answer });
broadcast(sessionId, { type: "quick_complete", answer });
```

The frontend polls `session.quickAnswer` every 1.2 seconds. No complexity classifier, no branching logic — every inquiry always goes through this path first.

### Key resolution (v3.5+)

API keys are resolved in priority order per request:

```typescript
function resolveApiKey(req: Request): string | undefined {
  // 1. X-Api-Key header — session-only key, never stored
  const header = req.headers["x-api-key"];
  if (header) return header.trim();

  // 2. Primary saved key from the api_keys table
  const primary = storage.getPrimaryApiKey();
  if (primary) return primary.value;

  // 3. Legacy openrouter_api_key setting (backwards compat)
  return storage.getSetting("openrouter_api_key")?.value;
}
```

The session key is set in React state and injected by `queryClient.ts` as an `X-Api-Key` header on every request. It never touches the database or localStorage.

### Follow-up inquiry chain (v3.6+)

```
Session completes
  → FollowUpBar renders at bottom
  → User types follow-up
  → navigate("/chat?q=<encoded>")
  → chat.tsx reads ?q= on mount
  → auto-fires quickMutation after 80ms
  → new inquiry starts, accepted context visible above
```

The `?q=` URL param approach means follow-ups are also deep-linkable — send someone a pre-filled inquiry URL and it fires automatically on load.

### Real-time WebSocket

```typescript
// Relative URL — works correctly under any proxy subpath
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

### SQLite schema

```
api_keys    — id, label, value, is_primary, created_at
sessions    — one row per inquiry: status, query, final answer, workflow reference
iterations  — one row per debate round: all model responses as JSON
workflows   — saved team configs: steps, iterations, temperature, consensus threshold
settings    — key-value: legacy API key, theme
```

`better-sqlite3` is fully synchronous — no async/await on database calls. Drizzle provides type-safe queries. The database is a single file at `mercury.db` locally or `/app/data/mercury.db` on Fly.io (persistent volume).

---

## 🪨 The hardest bugs

### 1. Alpine Linux kills `better-sqlite3`

The first Fly.io deploy failed immediately:

```
Error relocating better_sqlite3.node: fcntl64: symbol not found
```

`better-sqlite3` compiles a native C++ addon. The build environment runs Ubuntu (glibc). Fly.io's container runs Alpine Linux (musl libc). `fcntl64` is a glibc symbol — musl doesn't export it. The pre-built binary was simply incompatible with the runtime.

The fix: compile the native addon *inside* the Alpine container, and do it *twice*:

```dockerfile
RUN apk add --no-cache python3 make g++  # build tools
RUN npm install
RUN npm run build
RUN npm rebuild better-sqlite3            # compile for musl
RUN npm prune --omit=dev                  # removes compiled binaries (!)
RUN npm rebuild better-sqlite3            # compile again — prune wiped them
```

The double rebuild is not a typo. `npm prune` removes native `.node` binaries even from production dependencies because they live in a cache directory that prune treats as purgeable. Without the second rebuild, the app deploys, starts, can't find the binary, and crashes silently.

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

HTTP headers are Latin-1 (bytes 0–255). The em dash is codepoint 8212. Node's `fetch` enforces this at the byte level. The error tells you exactly what happened — but only if you know that 8212 = em dash.

```typescript
"X-Title": "Mercury - Deep Research Engine",  // ✓ hyphen, not em dash
```

One character. Invisible in source. Lethal at runtime. The lesson: never put typographic punctuation in HTTP headers.

### 3. React Query `staleTime: Infinity` traps the onboarding guard

After saving the API key, the mutation invalidates `/api/onboarding`. But if navigation happens before the invalidation promise resolves, the component remounts with stale `{ hasApiKey: false }` in cache — and the guard redirects back to onboarding, clearing the just-saved state.

Fix: override `staleTime` specifically on the onboarding query:

```typescript
useQuery({
  queryKey: ["/api/onboarding"],
  staleTime: 0,           // always refetch on mount
  refetchOnMount: true,   // even if recently fetched
})
```

The global default of `staleTime: Infinity` is correct for most data. The onboarding check is the one exception — it must always reflect the server's current state.

### 4. WebSocket URL breaks under proxy subpaths

```typescript
// Wrong — constructs from origin root, breaks behind any subpath proxy
const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${id}`;

// Correct — resolves relative to current page URL
const base = new URL("./ws", location.href);
base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${base.href}?sessionId=${id}`;
```

`new URL("./ws", location.href)` handles any subpath automatically — `/`, `/app/`, `/port/5000/` — without needing to know the deployment environment.

### 5. Radix Dialog captures pointer events, model selection impossible

The model search dropdown inside the inquiry wizard needed to float above the dialog. We used `createPortal()` to render it at `position: fixed` on `document.body`, and tried `onPointerDown` with `stopPropagation`.

It didn't work. Radix Dialog's overlay fires `onPointerDownOutside` at the document level — before any child handler runs. Every model selection closed the dialog.

The fix: stop fighting the abstraction. Remove `<Dialog>` entirely.

```typescript
// Before — Radix Dialog, model selection broken
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent><StepBuilder /></DialogContent>
</Dialog>

// After — sibling split-panel, no overlay, works perfectly
<div className="flex h-full overflow-hidden">
  <div className="flex-1">{/* chat */}</div>
  <div className={cn("border-l transition-all", open ? "w-[480px]" : "w-0")}>
    {/* wizard slides in from right */}
  </div>
</div>
```

No overlay, no z-index conflicts, no pointer capture. `onMouseDown` on dropdown items works because there is nothing above them.

### 6. Session key can't use localStorage — sandbox blocks it

The session-only API key (never persisted) needs to survive React re-renders and be available to all HTTP requests. The obvious answer — `localStorage` — is blocked in the sandboxed preview iframe used during development.

Solution: keep the key in React state via a context provider (`SessionKeyProvider` in `App.tsx`) and export a module-level setter so `queryClient.ts` can inject it as a request header without needing to be inside a React tree.

```typescript
// queryClient.ts — module-level, accessible anywhere
let _sessionKey: string | null = null;
export function setSessionKey(k: string | null) { _sessionKey = k; }

// Injected automatically on every request
function sessionHeaders() {
  return _sessionKey ? { "X-Api-Key": _sessionKey } : {};
}
```

The context provider calls `setSessionKey` on every state change, keeping the module-level value in sync. No localStorage, no cookies, no sandboxing issues.

### 7. Mobile: sidebar consumes 100% viewport width

On screens < 768px, the `w-56` sidebar had no breakpoint. It rendered at full-height, full-width, leaving `~0px` for the main content. Settings was entirely blank — the content area had zero width.

The fix was architectural: replace the always-visible sidebar with a conditional layout — `hidden md:flex` on desktop, a fixed `translate-x` drawer on mobile with a backdrop overlay and a hamburger button in a top bar.

```tsx
// Desktop — always visible at ≥768px
<aside className="hidden md:flex flex-col w-56 ...">

// Mobile — slide-in drawer with z-50, backdrop at z-40
<aside className={cn(
  "fixed inset-y-0 left-0 z-50 flex flex-col w-72 md:hidden transition-transform",
  open ? "translate-x-0" : "-translate-x-full"
)}>
```

Also: `h-screen` replaced with `h-[100dvh]` to handle iOS Safari's dynamic viewport chrome (address bar appears/disappears on scroll, making `100vh` larger than the visible area).

---

## 🎓 Lessons learned

### Always give the user something immediately

The original flow classified each query before doing anything — an extra API call to decide "simple" or "complex". Users waited for a classifier result, then got different UI paths depending on a model that was wrong ~20% of the time.

The current flow: every inquiry always gets a real answer in ~1–2 seconds. No classification, no branching. The user sees immediate value. The debate becomes an optional deepening, not a separate mode.

**Never make the user wait for nothing.**

### The debate starter reduces friction at the exact right moment

After the quick answer, the user's real question is not "which models?" — it's "do I even need to debate this?" The three-option picker (Quick / Saved / Custom) answers that question at a glance. The full wizard only opens if explicitly requested. Removing one mandatory step from the common path meaningfully changes the feel of the product.

### Heterogeneous panels produce better debates

Three instances of GPT-4o produce worse debates than GPT-4o + Claude + Gemini. Same training company, same RLHF approach — they agree on everything and call it consensus. Different providers mean genuinely different perspectives, different uncertainty estimates, and genuine conflict that the synthesis phase has something real to resolve.

**Model diversity is a feature, not a workaround.**

### Temperature 0.3 is the sweet spot for "reliable but interesting"

High temperature (>0.7) produces wild divergence — models explore completely different framings and the synthesis struggles to reconcile them. Low temperature (<0.2) produces convergence without insight — models agree too fast on the least controversial answer. 0.3 is the Quick debate default for a reason: fast convergence on a real answer, with enough variance to surface genuine disagreement.

### Custom model roles change the entire debate dynamic

Without roles, each model independently analyses the question and repeats variations of the same structure. With roles — "you are a devil's advocate", "focus only on empirical evidence", "synthesise only, do not advocate" — the debate becomes structured. Models push against each other's frames rather than piling onto the same one. The final synthesis has genuine conflict to resolve.

This is the most powerful feature and the least obvious to new users.

### Follow-ups are more natural than new sessions

The original flow was: get answer → close → new inquiry → retype context. This is how most AI tools work, and it's wrong. Inquiry is iterative — you ask, learn something, refine, push back, explore a branch. The follow-up bar (visible after every completed inquiry) makes the natural loop zero-friction: the previous question and answer are visible as context, the new input is right there.

### The onboarding key choice matters

Offering "save to server" vs "this session only" at first run sounds like a minor UX detail. It's actually a meaningful trust decision for users evaluating whether to expose their API key to an unfamiliar self-hosted tool. The session-only option removes a blocker entirely — try the tool without commitment, decide later. Several users would never have entered their key without it.

### SQLite is correct for self-hosted single-user tools

The choice of SQLite over PostgreSQL was deliberate. For one machine, one or a few concurrent users: a database server is pure overhead. SQLite is a file. It deploys with the app. It backs up with `cp`. It never needs a connection string, a username, or a port. `better-sqlite3` is synchronous — no async plumbing, no connection pool management. For this use case, it is strictly better than a client-server database in every dimension that matters.

### Split-panel beats modal for complex interactive UI

Every time you put a multi-step form with dropdowns inside a Radix modal, you fight the modal's pointer event capture. The split-panel pattern — content left, panel slides in from right — eliminates the entire class of z-index, pointer capture, and focus management bugs. It's also better UX: the user can see both the original context and the new panel simultaneously.

---

## 🤖 Building with Perplexity Computer

Mercury was designed and built entirely in collaboration with [Perplexity Computer](https://www.perplexity.ai/computer). Every version — from the initial scaffold to the Fly.io deployment with custom domain, SSL, and DNS — happened in persistent session context.

What that looks like in practice:

**Architecture decisions were collaborative.** The 5-phase debate system, the initial-answer-first UX, the debate starter, the split-panel wizard, the session-key approach — these were worked out in conversation. When a design idea didn't work, the conversation course-corrected immediately without losing context.

**Every production bug was diagnosed in context.** The `fcntl64` crash in Fly.io logs. The em dash header error in the browser console. The stale React Query cache blocking onboarding. The Radix Dialog pointer capture. Each was identified and fixed without leaving the session — no GitHub issues, no Slack threads, no context switching.

**The full deployment chain was automated.** Fly.io app creation, volume provisioning, SSL cert issuance, DNS management, FTP uploads for the landing page — all handled incrementally in the same conversation.

**The codebase was written to be readable in conversation.** Clear section comments, consistent naming, no clever abstractions that can't be explained in one sentence. The code was written for a human to understand and maintain — even though an AI produced it.

This is what serious AI-assisted engineering looks like. Not autocomplete. A collaborator that holds 10,000+ lines of context, reasons about tradeoffs in real time, and catches the bugs you'd spend hours finding alone.

---

## 📁 Project structure

```
mercury/
├── client/src/
│   ├── pages/
│   │   ├── chat.tsx          Inquiry input, quick answer, debate starter, follow-up
│   │   ├── session.tsx       Live progress, debate history, results, follow-up bar
│   │   ├── workflows.tsx     Workflow CRUD — split-panel form, model search
│   │   ├── settings.tsx      Multi-key manager, session key, theme, danger zone
│   │   └── onboarding.tsx    First-run — save to server vs session-only choice
│   ├── components/
│   │   └── Layout.tsx        Responsive sidebar (desktop always-on, mobile drawer)
│   ├── lib/
│   │   └── queryClient.ts    Session key injection, relative URL helper, TanStack Query
│   └── App.tsx               ThemeProvider + SessionKeyProvider + onboarding guard
├── server/
│   ├── orchestrator.ts       Debate engine, quick answer, 5-phase system, WebSocket
│   ├── routes.ts             Express routes, key resolution, WebSocket server
│   ├── storage.ts            SQLite via Drizzle ORM — sessions, keys, workflows
│   └── index.ts              Express + HTTP server bootstrap
├── shared/
│   └── schema.ts             Drizzle schema: sessions, iterations, workflows, api_keys, settings
├── fly.toml                  Fly.io config (CDG region, auto-stop, volume mount)
├── Dockerfile                Alpine + double npm rebuild for better-sqlite3
├── CHANGELOG.md              Full version history
└── INSTALL.md                Local, Docker, and Fly.io deployment guide
```

---

## 📡 API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/onboarding` | `{ hasApiKey: boolean }` |
| `GET/POST` | `/api/settings` | API key status / save or clear legacy key |
| `GET/POST` | `/api/settings/theme` | Theme persistence |
| `GET` | `/api/keys` | List all saved API keys (values masked) |
| `POST` | `/api/keys` | Add a new API key with label |
| `POST` | `/api/keys/:id/primary` | Set a key as primary |
| `DELETE` | `/api/keys/:id` | Delete a saved key |
| `POST` | `/api/keys/migrate-legacy` | Migrate old settings key to the key manager |
| `GET` | `/api/models` | All models available on OpenRouter |
| `POST` | `/api/quick-answer` | Immediate single-model response (gpt-4o-mini) |
| `POST` | `/api/inquire` | Launch full multi-model debate |
| `GET` | `/api/sessions` | List all sessions, newest first |
| `GET` | `/api/sessions/:id` | Session status and final answer |
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

**Session key header:**

Pass `X-Api-Key: sk-or-v1-...` on any request to use a session-only key. The server resolves keys in this order: `X-Api-Key` header → primary saved key → legacy setting.

---

## 🧪 Model recommendations

| Use case | Team |
|---|---|
| **Balanced all-round** | `openai/gpt-4o` + `anthropic/claude-3.5-sonnet` + `google/gemini-2.0-flash` + `meta-llama/llama-4-maverick` |
| **Budget** | `openai/gpt-4o-mini` + `anthropic/claude-haiku` + `google/gemini-flash-lite` |
| **Deep research** | `openai/o3-mini` + `anthropic/claude-3.7-sonnet` + `google/gemini-2.0-pro` + `deepseek/deepseek-r1` |
| **Structured debate** | Any mix above + assign explicit roles (researcher, critic, synthesiser, fact-checker) |

Key insight: **diversity beats raw capability**. Three different mid-tier models from different providers outperform three instances of the same frontier model. Different training histories mean genuinely different perspectives — and genuine disagreement is what the synthesis phase needs to produce real insight.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

Current: **v3.7.4** — follow-up inquiry, multi-key management, session-only key, mobile layout, debate starter, split-panel wizard, version-stamped releases.

---

## 👤 Author

**Paul Fleury** — French internet entrepreneur, based in Lisbon.

- [paulfleury.com](https://paulfleury.com)
- GitHub: [@paulfxyz](https://github.com/paulfxyz)
- [Openline](https://openline.com) — instant eSIMs in 190+ countries

Other projects: [mang.sh](https://mang.sh) · [ase.so](https://ase.so)

---

*MIT licensed. See [LICENSE](LICENSE).*
